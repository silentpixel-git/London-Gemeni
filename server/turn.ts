// POST /api/turn (contract: server/TURN.md). One request per player turn or
// Tick: replay the log, select, resolve, append, then stream narration.
// Supabase and the environment stay outside: api/turn.ts and the dev
// middleware build the deps, scripts/qa-turn.ts passes in-memory ones.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  Id, Story, type EventPayload, type LogEvent, type NarrationContext, type NarrationMode, type NarrationResult,
} from '../packages/schema/index.js';
import { loadStoryDir } from '../packages/schema/load.js';
import {
  apply, buildNarrationContext, candidates, currentAct, currentPeriod, initialState, inventory, personsPresent,
  replay, resolveTurn, tick, type State,
} from '../packages/engine/index.js';
import { gateNarration, type GateVerdict } from '../packages/ai/gate.js';
import { confineSelection } from '../packages/ai/selection.js';
import type { Ai } from '../packages/ai/types.js';
import type { InvestigationStore } from './investigationStore.js';

export interface TurnDeps {
  store: InvestigationStore;
  ai: Ai;
  loadStory: (storyId: string) => Story | null;
  /** The authenticated caller; owner of any Investigation this request starts. */
  ownerId?: string | null;
  gate?: (ctx: NarrationContext, result: NarrationResult) => GateVerdict;
  /** Seed for a new Investigation; QA fixes it so recordings stay stable. */
  newSeed?: () => number;
}

const TurnRequest = z.union([
  z.object({ investigationId: z.string().min(1), text: z.string().trim().min(1) }).strict(),
  z.object({ investigationId: z.string().min(1), tick: z.literal(true) }).strict(),
  z.object({ start: z.object({ storyId: Id, name: z.string().trim().min(1) }).strict() }).strict(),
]);

/** Player lines offered to the selection model for "open it". */
const RECENT_TEXTS = 4;

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
      try {
        // investigationId is not in TURN.md's line shape; a start request needs it back somewhere.
        send({ kind: 'events', events: turn.events, seqFrom: turn.seqFrom, investigationId: turn.investigationId });
        const ctx = buildNarrationContext(turn.story, turn.state, turn.events, turn.mode);
        const result = await narrateGated(ctx, deps.ai, deps.gate ?? gateNarration, delta => send({ kind: 'text', delta }));
        const narrated: EventPayload = { kind: 'Narrated', text: result.prose, beats: ctx.beats };
        const tail: EventPayload[] = [narrated, ...result.observations.map(observation => ({ kind: 'ObservationRecorded' as const, observation }))];
        const { rows, state } = number(turn.story, turn.state, tail, turn.seqFrom + turn.events.length);
        await deps.store.append(turn.investigationId, rows);
        send({ kind: 'done', narrated, observations: result.observations, state: view(turn.story, state) });
      } catch (err) {
        console.error('api/turn stream:', err);
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

/** Server steps 1–3: everything that can still answer with a plain HTTP error. */
async function prepare(body: z.infer<typeof TurnRequest>, deps: TurnDeps): Promise<Prepared | { status: number; message: string }> {
  if ('start' in body) {
    const story = deps.loadStory(body.start.storyId);
    if (!story) return { status: 404, message: `no story ${body.start.storyId}` };
    const { id } = await deps.store.create(story.id, body.start.name, deps.ownerId ?? null);
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
  const prior = inv.events.map(e => e.payload);
  const before = replay(story, prior);

  let events: EventPayload[];
  if ('tick' in body) {
    events = tick(story, before).events;
  } else {
    const set = candidates(story, before);
    const recentTexts = prior.flatMap(e => (e.kind === 'TurnReceived' ? [e.text] : [])).slice(-RECENT_TEXTS);
    // The adapter confines too; the endpoint does not trust that it did.
    const selection = confineSelection(await deps.ai.select({ text: body.text, candidates: set, recentTexts }), set);
    events = resolveTurn(story, before, { text: body.text, selection }).events;
  }

  const seqFrom = (inv.events.at(-1)?.seq ?? -1) + 1;
  const { rows, state } = number(story, before, events, seqFrom);
  await deps.store.append(body.investigationId, rows);
  return { investigationId: body.investigationId, story, state, events, seqFrom, mode: modeFor(events) };
}

/** Step 4: what the turn produced decides how much prose it earns. */
function modeFor(events: EventPayload[]): NarrationMode {
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
    ? { ...ctx, beats: [`Rejected inventions, not in this context: ${verdict.inventions.join(', ')}.`, ...ctx.beats] }
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
 * Stories by id from directories of Story directories, tried in order. A
 * directory named after the id wins; otherwise the first whose story.json
 * declares that id (the toy fixture lives in `toy/` but its id is
 * `locked_study`). Parsed once per process.
 */
export function fileStoryLoader(roots: string[]): (storyId: string) => Story | null {
  const cache = new Map<string, Story>();
  return storyId => {
    const hit = cache.get(storyId);
    if (hit) return hit;
    const dir = findStoryDir(roots, storyId);
    if (!dir) return null;
    const story = Story.parse(loadStoryDir(dir));
    cache.set(storyId, story);
    return story;
  };
}

function findStoryDir(roots: string[], storyId: string): string | null {
  for (const root of roots) {
    if (!existsSync(root)) continue;
    if (existsSync(join(root, storyId, 'story.json'))) return join(root, storyId);
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const file = join(root, entry.name, 'story.json');
      if (!entry.isDirectory() || !existsSync(file)) continue;
      try {
        if ((JSON.parse(readFileSync(file, 'utf8')) as { id?: unknown }).id === storyId) return join(root, entry.name);
      } catch { /* a malformed story.json is the validator's problem, not a match */ }
    }
  }
  return null;
}
