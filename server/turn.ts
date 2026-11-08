// POST /api/turn (contract: server/TURN.md). One request per player turn or
// Tick: replay the log, select, resolve, append, then stream narration.
// Supabase and the environment stay outside: api/turn.ts and the dev
// middleware build the deps, scripts/qa-turn.ts passes in-memory ones.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  Id, Story, type EventPayload, type LogEvent, type NarrationContext, type NarrationMode, type NarrationResult,
} from '../packages/schema/index.js';
import { loadStoryDir } from '../packages/schema/load.js';
import {
  apply, buildNarrationContext, candidates, currentAct, currentPeriod, exactSelection, initialState, inventory,
  personsPresent, replay, resolveTurn, tick, type State,
} from '../packages/engine/index.js';
import { gateNarration, type GateVerdict } from '../packages/ai/gate.js';
import { confineSelection } from '../packages/ai/selection.js';
import type { Ai } from '../packages/ai/types.js';
import { SeqConflict, type InvestigationStore } from './investigationStore.js';

export interface TurnDeps {
  store: InvestigationStore;
  ai: Ai;
  loadStory: (storyId: string) => Story | null;
  /** The authenticated caller; owner of any Investigation this request starts. */
  ownerId?: string | null;
  gate?: (ctx: NarrationContext, result: NarrationResult) => GateVerdict;
  /** Seed for a new Investigation; QA fixes it so recordings stay stable. */
  newSeed?: () => number;
  /** The clock stale-turn recovery reads; QA moves it. */
  now?: () => number;
}

const TurnRequest = z.union([
  z.object({ investigationId: z.string().min(1), text: z.string().trim().min(1) }).strict(),
  z.object({ investigationId: z.string().min(1), tick: z.literal(true) }).strict(),
  z.object({ start: z.object({ storyId: Id, name: z.string().trim().min(1) }).strict() }).strict(),
]);

/** Player lines offered to the selection model for "open it". */
const RECENT_TEXTS = 4;

/**
 * One turn at a time per Investigation. A turn is open from its engine rows
 * until its Narrated row lands, and Narrated is attributed by its position in
 * the log (its turn number, whose Transcript it joins), so a second turn may
 * not slip in between. A request that finds a turn open is refused with 409.
 */
const BUSY = 'another turn on this investigation is still being narrated';
/** A turn still open after this long belongs to a request that died mid-narration; the next request closes it. */
export const STALE_TURN_MS = 120_000;
/** Attempts at a turn when another request takes the next seq first. */
const PREPARE_ATTEMPTS = 3;

const NDJSON = { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' };

export async function handleTurn(request: Request, deps: TurnDeps): Promise<Response> {
  let body: z.infer<typeof TurnRequest>;
  try {
    body = TurnRequest.parse(await request.json());
  } catch {
    return fail(400, 'expected {investigationId, text}, {investigationId, tick: true} or {start: {storyId, name}}');
  }

  let turn: Prepared;
  try {
    const prepared = await prepare(body, deps);
    if ('status' in prepared) return fail(prepared.status, prepared.message);
    turn = prepared;
  } catch (err) {
    console.error('api/turn:', err);
    return fail(500, 'the turn could not be resolved');
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: object) => controller.enqueue(encoder.encode(JSON.stringify(line) + '\n'));
      let closed = false;
      try {
        // investigationId is not in TURN.md's line shape; a start request needs it back somewhere.
        send({ kind: 'events', events: turn.events, seqFrom: turn.seqFrom, investigationId: turn.investigationId });
        const ctx = buildNarrationContext(turn.story, turn.state, turn.events, turn.mode);
        const result = await narrateGated(ctx, deps.ai, deps.gate ?? gateNarration, delta => send({ kind: 'text', delta }));
        const narrated: EventPayload = { kind: 'Narrated', text: result.prose, beats: ctx.beats };
        const tail: EventPayload[] = [narrated, ...result.observations.map(observation => ({ kind: 'ObservationRecorded' as const, observation }))];
        const { rows, state } = number(turn.story, turn.state, tail, turn.seqFrom + turn.events.length);
        await deps.store.append(turn.investigationId, rows);
        closed = true;
        send({ kind: 'done', narrated, observations: result.observations, state: view(turn.story, state) });
      } catch (err) {
        console.error('api/turn stream:', err);
        // Close the turn with its Beats so the Investigation is not left busy.
        if (!closed) {
          const ctx = buildNarrationContext(turn.story, turn.state, turn.events, turn.mode);
          const { rows } = number(turn.story, turn.state, [beatsOnly(ctx)], turn.seqFrom + turn.events.length);
          await deps.store.append(turn.investigationId, rows).catch(e => console.error('api/turn close:', e));
        }
        send({ kind: 'error', message: 'narration failed' });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: NDJSON });
}

interface Prepared {
  investigationId: string;
  story: Story;
  /** State after this turn's engine Events. */
  state: State;
  events: EventPayload[];
  seqFrom: number;
  mode: NarrationMode;
}

type Refusal = { status: number; message: string };

/** Server steps 1–3: everything that can still answer with a plain HTTP error. A lost race for the next seq starts over from a fresh load. */
async function prepare(body: z.infer<typeof TurnRequest>, deps: TurnDeps): Promise<Prepared | Refusal> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prepareOnce(body, deps);
    } catch (err) {
      if (!(err instanceof SeqConflict)) throw err;
      if (attempt === PREPARE_ATTEMPTS) return { status: 409, message: BUSY };
    }
  }
}

async function prepareOnce(body: z.infer<typeof TurnRequest>, deps: TurnDeps): Promise<Prepared | Refusal> {
  if ('start' in body) {
    const story = deps.loadStory(body.start.storyId);
    if (!story) return { status: 404, message: `no story ${body.start.storyId}` };
    const { id } = await deps.store.create(body.start.storyId, body.start.name, deps.ownerId ?? null);
    const seed = (deps.newSeed ?? randomSeed)();
    const events: EventPayload[] = [{ kind: 'InvestigationStarted', story: story.id, seed }];
    const { rows, state } = number(story, initialState(story, seed), events, 0);
    await deps.store.append(id, rows);
    return { investigationId: id, story, state, events, seqFrom: 0, mode: 'opening' };
  }

  const inv = await deps.store.load(body.investigationId);
  if (!inv) return { status: 404, message: `no investigation ${body.investigationId}` };
  const story = deps.loadStory(inv.storyId);
  if (!story) return { status: 500, message: `the investigation's story ${inv.storyId} is not on this server` };
  let log = inv.events;
  if (log.length && !closesTurn(log[log.length - 1].payload)) {
    const age = inv.headAt === null ? 0 : (deps.now ?? Date.now)() - inv.headAt;
    if (age < STALE_TURN_MS) return { status: 409, message: BUSY };
    log = [...log, ...(await closeStaleTurn(story, log, body.investigationId, deps.store))];
  }
  const prior = log.map(e => e.payload);
  const before = replay(story, prior);

  let events: EventPayload[];
  if ('tick' in body) {
    events = tick(story, before).events;
  } else {
    const set = candidates(story, before);
    const recentTexts = prior.flatMap(e => (e.kind === 'TurnReceived' ? [e.text] : [])).slice(-RECENT_TEXTS);
    // Exact commands skip the model (ADR-0003). The adapter confines too; the endpoint does not trust that it did.
    const chosen = exactSelection(body.text, set) ?? (await deps.ai.select({ text: body.text, candidates: set, recentTexts }));
    const selection = confineSelection(chosen, set);
    events = resolveTurn(story, before, { text: body.text, selection }).events;
  }

  const seqFrom = (log.at(-1)?.seq ?? -1) + 1;
  const { rows, state } = number(story, before, events, seqFrom);
  await deps.store.append(body.investigationId, rows);
  return { investigationId: body.investigationId, story, state, events, seqFrom, mode: modeFor(events) };
}

/** A turn's last rows are its Narrated and Observations; anything else last means a turn is open. */
function closesTurn(e: EventPayload): boolean {
  return e.kind === 'Narrated' || e.kind === 'ObservationRecorded';
}

/** The turn's Beats as its whole narration: the fallback when prose cannot be had. */
function beatsOnly(ctx: NarrationContext): EventPayload {
  return { kind: 'Narrated', text: ctx.beats.join(' '), beats: ctx.beats };
}

/** Close a turn whose request died before narrating it, with the Beats it would have fallen back to. */
async function closeStaleTurn(story: Story, log: LogEvent[], id: string, store: InvestigationStore): Promise<LogEvent[]> {
  let from = log.length;
  while (from > 0 && !closesTurn(log[from - 1].payload)) from--;
  const open = log.slice(from).map(e => e.payload);
  const state = replay(story, log.map(e => e.payload));
  const ctx = buildNarrationContext(story, state, open, modeFor(open));
  const { rows } = number(story, state, [beatsOnly(ctx)], log[log.length - 1].seq + 1);
  await store.append(id, rows);
  return rows;
}

/** Step 4: what the turn produced decides how much prose it earns. */
function modeFor(events: EventPayload[]): NarrationMode {
  if (events.some(e => e.kind === 'InvestigationStarted')) return 'opening';
  if (events.some(e => e.kind === 'FlavourRequested')) return 'flavour';
  const substantive = events.some(e =>
    e.kind === 'ClueDiscovered' || e.kind === 'BeatQueued' || e.kind === 'Moved' || e.kind === 'ActEntered' || e.kind === 'GameEnded'
    || (e.kind === 'FactDisclosed' && e.to === 'player') || (e.kind === 'FactLearned' && e.person === 'player'));
  return substantive ? 'full' : 'compact';
}

/**
 * Step 5. Only the first attempt streams: a retry or the Beats fallback is
 * sent whole in `done.narrated.text`, which is the canonical prose for the
 * turn and replaces whatever streamed. The gate always judges against the
 * original context, since the retry's extra line names the very inventions
 * it rejected and would otherwise license them.
 */
async function narrateGated(
  ctx: NarrationContext, ai: Ai, gate: NonNullable<TurnDeps['gate']>, onDelta: (delta: string) => void,
): Promise<NarrationResult> {
  const first = await collect(ai.narrate(ctx), onDelta);
  const verdict = first.prose.trim() ? gate(ctx, first) : { ok: false, inventions: [] };
  if (verdict.ok) return first;
  const retryCtx: NarrationContext = verdict.inventions.length
    ? { ...ctx, beats: [`Rejected inventions, not in this context: ${verdict.inventions.map(i => i.token).join(', ')}.`, ...ctx.beats] }
    : ctx;
  const second = await collect(ai.narrate(retryCtx), () => {});
  if (second.prose.trim() && gate(ctx, second).ok) return second;
  return { prose: ctx.beats.join(' '), observations: [] };
}

async function collect(chunks: AsyncIterable<{ kind: 'text'; delta: string } | { kind: 'done'; result: NarrationResult }>, onDelta: (delta: string) => void): Promise<NarrationResult> {
  for await (const c of chunks) {
    if (c.kind === 'text') onDelta(c.delta);
    else return c.result;
  }
  throw new Error('narration ended without a done chunk');
}

/** Number Events as log rows continuing at seqFrom, folding State as it goes for each row's turn. */
function number(story: Story, from: State, events: EventPayload[], seqFrom: number): { rows: LogEvent[]; state: State } {
  let state = from;
  const rows = events.map((payload, i) => {
    state = apply(story, state, payload);
    return { seq: seqFrom + i, turn: state.turn, payload };
  });
  return { rows, state };
}

/** The sidebar's view of State: the client never needs the whole thing. */
function view(story: Story, s: State) {
  return {
    act: s.act,
    location: s.location,
    clock: s.clock,
    period: currentPeriod(story, s),
    weather: currentAct(story, s).weather,
    inventory: inventory(s),
    personsPresent: personsPresent(story, s),
    ended: s.ended,
  };
}

function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ kind: 'error', message }) + '\n', { status, headers: NDJSON });
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * Stories by directory name, from roots tried in order (TURN.md: `stories/<id>`
 * then `packages/schema/fixtures/<id>`). The directory name is the key an
 * Investigation stores. For a real Story it equals story.json's id; the
 * fixtures are variants sharing one id (toy, unsolvable and broken are all
 * `locked_study`), so only the directory tells them apart: the toy is `toy`.
 * Parsed once per process.
 */
export function fileStoryLoader(roots: string[]): (storyId: string) => Story | null {
  const cache = new Map<string, Story>();
  return storyId => {
    const hit = cache.get(storyId);
    if (hit) return hit;
    const dir = roots.map(root => join(root, storyId)).find(d => existsSync(join(d, 'story.json')));
    if (!dir) return null;
    const story = Story.parse(loadStoryDir(dir));
    cache.set(storyId, story);
    return story;
  };
}
