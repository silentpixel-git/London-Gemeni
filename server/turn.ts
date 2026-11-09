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
  apply, buildNarrationContext, candidates, exactSelection, feedOf, initialState, personsPresent, playerView,
  replay, resolveTurn, startInvestigation, tick, type State,
} from '../packages/engine/index.js';
import { findInventions, gateNarration, type GateVerdict } from '../packages/ai/gate.js';
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
  z.object({ investigationId: z.string().min(1), resume: z.literal(true) }).strict(),
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
    return fail(400, 'expected {investigationId, text}, {investigationId, tick: true}, {investigationId, resume: true} or {start: {storyId, name}}');
  }
  if ('resume' in body) {
    try {
      return await resume(body.investigationId, deps);
    } catch (err) {
      console.error('api/turn resume:', err);
      return fail(500, 'the investigation could not be loaded');
    }
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
        // A quiet Tick costs nothing: no narration call, and an empty Narrated closes it.
        const result = turn.quiet
          ? { prose: '', observations: [] }
          : await narrateGated(ctx, deps.ai, deps.gate ?? gateNarration, delta => send({ kind: 'text', delta }));
        const narrated: EventPayload = { kind: 'Narrated', text: result.prose, beats: turn.quiet ? [] : ctx.beats };
        const tail: EventPayload[] = [narrated, ...result.observations.map(observation => ({ kind: 'ObservationRecorded' as const, observation }))];
        const { rows } = number(turn.story, turn.state, tail, turn.seqFrom + turn.events.length);
        await deps.store.append(turn.investigationId, rows);
        closed = true;
        const log = [...turn.prior, ...turn.events, ...tail];
        const feed = feedOf(turn.story, log).slice(feedOf(turn.story, turn.prior).length);
        send({ kind: 'done', narrated, observations: result.observations, view: playerView(turn.story, log), feed });
      } catch (err) {
        console.error('api/turn stream:', err);
        // Close the turn with its Beats so the Investigation is not left busy.
        if (!closed) {
          const ctx = buildNarrationContext(turn.story, turn.state, turn.events, turn.mode);
          const { rows } = number(turn.story, turn.state, [fallbackNarrated(ctx)], turn.seqFrom + turn.events.length);
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
  /** The log before this turn, for the feed and view projections. */
  prior: EventPayload[];
  seqFrom: number;
  mode: NarrationMode;
  /** A Tick that changed nothing the player can see: not narrated. */
  quiet: boolean;
}

type Refusal = { status: number; message: string };
/** A request that resolves a turn (a resume reads only). */
type TurnBody = Exclude<z.infer<typeof TurnRequest>, { resume: true }>;

/** Server steps 1–3: everything that can still answer with a plain HTTP error. A lost race for the next seq starts over from a fresh load. */
async function prepare(body: TurnBody, deps: TurnDeps): Promise<Prepared | Refusal> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prepareOnce(body, deps);
    } catch (err) {
      if (!(err instanceof SeqConflict)) throw err;
      if (attempt === PREPARE_ATTEMPTS) return { status: 409, message: BUSY };
    }
  }
}

async function prepareOnce(body: TurnBody, deps: TurnDeps): Promise<Prepared | Refusal> {
  if ('start' in body) {
    const story = deps.loadStory(body.start.storyId);
    if (!story) return { status: 404, message: `no story ${body.start.storyId}` };
    const { id } = await deps.store.create(body.start.storyId, body.start.name, deps.ownerId ?? null);
    const seed = (deps.newSeed ?? randomSeed)();
    // The opening is a turn: InvestigationStarted, then the Rules it sets off (ADR-0005).
    const { events } = startInvestigation(story, seed);
    const { rows, state } = number(story, initialState(story, seed), events, 0);
    await deps.store.append(id, rows);
    return { investigationId: id, story, state, events, prior: [], seqFrom: 0, mode: 'opening', quiet: false };
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
  const mode = modeFor(events);
  const quiet = 'tick' in body && mode === 'compact' && state.location === before.location
    && personsPresent(story, state).join() === personsPresent(story, before).join();
  return { investigationId: body.investigationId, story, state, events, prior, seqFrom, mode, quiet };
}

/** The whole feed and the current view, for a page load or a second browser. Appends nothing. */
async function resume(id: string, deps: TurnDeps): Promise<Response> {
  const inv = await deps.store.load(id);
  if (!inv) return fail(404, `no investigation ${id}`);
  const story = deps.loadStory(inv.storyId);
  if (!story) return fail(500, `the investigation's story ${inv.storyId} is not on this server`);
  const log = inv.events.map(e => e.payload);
  const busy = log.length > 0 && !closesTurn(log[log.length - 1]);
  const line = { kind: 'resume', investigationId: id, name: inv.name, feed: feedOf(story, log), view: playerView(story, log), busy };
  return new Response(JSON.stringify(line) + '\n', { headers: NDJSON });
}

/** A turn's last rows are its Narrated and Observations; anything else last means a turn is open. */
function closesTurn(e: EventPayload): boolean {
  return e.kind === 'Narrated' || e.kind === 'ObservationRecorded';
}

/** The turn's fallback narration as its closing row, when prose cannot be had at all. */
function fallbackNarrated(ctx: NarrationContext): EventPayload {
  return { kind: 'Narrated', text: fallbackProse(ctx), beats: ctx.beats };
}

/**
 * An Observation is canon from the moment it is kept, and licenses its words on
 * later turns, so it must pass the strict check (its first word too). One that
 * does not is dropped; the prose around it stands.
 */
function canonObservations(ctx: NarrationContext, result: NarrationResult): NarrationResult {
  return { ...result, observations: result.observations.filter(o => findInventions(o.text, ctx, { strict: true }).length === 0) };
}

/** A sentence kept with no narration around it: it passes the gate, and the strict check, on its own. */
const standsAlone = (ctx: NarrationContext, sentence: string, gate: NonNullable<TurnDeps['gate']>) =>
  gate(ctx, { prose: sentence, observations: [] }).ok && findInventions(sentence, ctx, { strict: true }).length === 0;

/** The miss line when nothing better can be said. Tense- and person-neutral, and never the selection model's own reason. */
const NOTHING_TO_HAND = 'Nothing of the kind to hand.';

/** A rejected narration attempt, with whether the gate found an invented name in it. */
interface Attempt { prose: string; inventedName: boolean }

/**
 * What the player reads when the narration cannot be used, in order:
 *   the turn's Beats, which carry its substance;
 *   on a turn with none, the Facts it told the player, in the speaker's voice;
 *   the narrator's sentences that pass the gate on their own, from an attempt
 *     that invented no name (a sentence about an invented person would
 *     survive without them: "He nods to you.");
 *   a fixed miss line for a rejected intent;
 *   the names of what the turn touched.
 * Nothing written by the selection model, and nothing that failed the gate,
 * reaches the log.
 */
function fallbackProse(ctx: NarrationContext, attempts: Attempt[] = [], gate?: NonNullable<TurnDeps['gate']>): string {
  if (ctx.beats.length) return ctx.beats.join(' ');
  if (ctx.facts.length) return ctx.facts.map(f => f.voice ?? f.statement).join(' ');
  if (gate) {
    for (const a of attempts) {
      if (a.inventedName) continue;
      const kept = a.prose.split(/\n{2,}/)
        .map(par => par.replace(/\b(Mr|Mrs|Ms|Dr|St|Rev|[A-Z])\.\s+/g, '$1.\u0001').split(/(?<=[.!?…]["”’')]*)\s+/).map(x => x.replace(/\u0001/g, ' ')).filter(s => s.trim() && standsAlone(ctx, s, gate)).join(' '))
        .filter(Boolean).join('\n\n');
      if (kept) return kept;
    }
  }
  if (ctx.events.some(e => e.kind === 'IntentRejected')) return NOTHING_TO_HAND;
  const name = (id: string) => {
    const object = ctx.objectsVisible.find(o => o.id === id)?.name;
    return object ? `the ${object}` : ctx.personsPresent.find(p => p.id === id)?.label ?? ctx.personsNamed.find(p => p.id === id)?.label;
  };
  const touched = [...new Set(ctx.events.flatMap(e => ('object' in e ? [e.object] : 'person' in e && typeof e.person === 'string' ? [e.person] : [])))]
    .map(name).filter((x): x is string => !!x);
  return touched.map(t => `${t[0].toUpperCase()}${t.slice(1)}.`).join(' ');
}

/** Close a turn whose request died before narrating it, with the fallback it would have used. */
async function closeStaleTurn(story: Story, log: LogEvent[], id: string, store: InvestigationStore): Promise<LogEvent[]> {
  let from = log.length;
  while (from > 0 && !closesTurn(log[from - 1].payload)) from--;
  const open = log.slice(from).map(e => e.payload);
  const state = replay(story, log.map(e => e.payload));
  const ctx = buildNarrationContext(story, state, open, modeFor(open));
  const { rows } = number(story, state, [fallbackNarrated(ctx)], log[log.length - 1].seq + 1);
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
  if (verdict.ok) return canonObservations(ctx, first);
  const retryCtx: NarrationContext = verdict.inventions.length
    ? { ...ctx, beats: [`Rejected inventions, not in this context: ${verdict.inventions.map(i => i.token).join(', ')}.`, ...ctx.beats] }
    : ctx;
  const second = await collect(ai.narrate(retryCtx), () => {});
  const again = second.prose.trim() ? gate(ctx, second) : { ok: false, inventions: [] };
  if (again.ok) return canonObservations(ctx, second);
  const named = (v: GateVerdict) => v.inventions.some(i => i.kind === 'name');
  const attempts = [{ prose: second.prose, inventedName: named(again) }, { prose: first.prose, inventedName: named(verdict) }];
  return { prose: fallbackProse(ctx, attempts, gate), observations: [] };
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
