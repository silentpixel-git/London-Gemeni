/**
 * scripts/qa-turn.ts
 *
 * Drives POST /api/turn (server/turn.ts, contract server/TURN.md) in-process
 * against the toy Story with the memory store and the `recorded` AI provider:
 * NDJSON line order, the Event log's seq series, replay across requests, the
 * sidebar view, Ticks, errors, an out-of-set Selection, both gate rejection
 * branches, the exact-command fast path, and one-turn-at-a-time (409 on an
 * open turn, a lost seq race, a failed or stale turn closed). No key, no network.
 *
 * The recordings in packages/ai/recordings/toy are authored here: the
 * Selections and prose below are the hand-written answers, and
 *   npx tsx scripts/qa-turn.ts --author
 * rewrites the recording files from them (needed whenever the engine or the
 * projections change what a turn's input looks like, since keys hash it).
 */

import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { CandidateSet, EventPayload, NarrationContext, NarrationResult, Selection } from '../packages/schema/index.js';
import { candidates, exactSelection, initialState, replay } from '../packages/engine/index.js';
import { recorded, recording } from '../packages/ai/recorded.js';
import type { Ai } from '../packages/ai/types.js';
import { memoryStore, type InvestigationStore } from '../server/investigationStore.js';
import { fileStoryLoader, handleTurn, STALE_TURN_MS, type TurnDeps } from '../server/turn.js';

const RECORDINGS = join('packages', 'ai', 'recordings', 'toy');
const AUTHOR = process.argv.includes('--author');
const loadStory = fileStoryLoader([join('stories'), join('packages', 'schema', 'fixtures')]);
const story = loadStory('toy')!; // the toy fixture's directory; its story id is locked_study

// ── The authored answers ────────────────────────────────────────────────────

const SELECTIONS: Record<string, Selection> = {
  'look around': { kind: 'intent', verb: 'look' },
  'ask the housekeeper about the key': { kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' },
  'open the clock': { kind: 'intent', verb: 'open', target: 'hall_clock' },
  'take the key': { kind: 'intent', verb: 'take', target: 'brass_key' },
  // A model that names something not in the Candidate Set.
  'light the lamp': { kind: 'intent', verb: 'use', target: 'ghost_lamp' },
};

const INVENTED = 'Lestrade';
const PROSE = {
  opening: 'The house is dark when you arrive. In the hall a long-case clock ticks, and the housekeeper watches you from the foot of the stairs.',
  look: 'Cold tiles, a worn mat before the study door, and the clock. The housekeeper says the master would not have wanted strangers here.',
  ask: 'She hesitates, then tells you: the master kept the study key inside the long-case clock.',
  open: 'The little door below the face swings open. Exactly where she said it would be.',
  take: 'You take the brass key. It is worn bright at the bow.',
  tick: 'The clock ticks on. A cat crosses the hall without looking at you.',
  rejected: 'You reach for a lamp that is not there.',
  retry: 'You look again: tiles, the mat, the clock, and the housekeeper by the stairs.',
};

function authoredNarration(ctx: NarrationContext): NarrationResult {
  const kinds = new Set(ctx.events.map(e => e.kind));
  if (ctx.beats.some(b => b.includes(INVENTED))) return { prose: PROSE.retry, observations: [] };
  if (ctx.mode === 'opening') {
    return { prose: PROSE.opening, observations: [{ key: 'hall_tiles_cold', subject: 'hall', text: 'The hall tiles are cold enough to feel through a boot.' }] };
  }
  if (kinds.has('TickResolved')) return { prose: PROSE.tick, observations: [] };
  if (kinds.has('IntentRejected')) return { prose: PROSE.rejected, observations: [] };
  if (kinds.has('Taken')) return { prose: PROSE.take, observations: [] };
  if (kinds.has('Opened')) return { prose: PROSE.open, observations: [] };
  if (kinds.has('FactDisclosed')) return { prose: PROSE.ask, observations: [] };
  if (kinds.has('Looked')) return { prose: PROSE.look, observations: [] };
  throw new Error(`no authored narration for ${ctx.mode} ${[...kinds].join(',')}`);
}

const author: Ai = {
  async select(input) {
    const s = SELECTIONS[input.text];
    if (!s) throw new Error(`no authored selection for ${JSON.stringify(input.text)}`);
    return s;
  },
  async *narrate(ctx) {
    yield { kind: 'done', result: authoredNarration(ctx) };
  },
};

if (AUTHOR) rmSync(RECORDINGS, { recursive: true, force: true });
const inner: Ai = AUTHOR ? recording(author, RECORDINGS) : recorded(RECORDINGS);
let selectCalls = 0;
const ai: Ai = { select: input => { selectCalls++; return inner.select(input); }, narrate: ctx => inner.narrate(ctx) };

// ── Harness ─────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${ok || !detail ? '' : `\n       ${detail}`}`);
}

type Line = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function post(body: unknown, deps: Partial<TurnDeps> & { store: InvestigationStore }) {
  const res = await handleTurn(
    new Request('http://localhost/api/turn', { method: 'POST', body: JSON.stringify(body) }),
    { ai, loadStory, newSeed: () => 42, ...deps },
  );
  const lines: Line[] = (await res.text()).split('\n').filter(Boolean).map(l => JSON.parse(l));
  const events = lines.find(l => l.kind === 'events');
  const done = lines.find(l => l.kind === 'done');
  const texts = lines.filter(l => l.kind === 'text').map(l => l.delta as string);
  return { status: res.status, lines, events, done, streamed: texts.join(''), kinds: lines.map(l => l.kind as string) };
}

/** events, then text*, then done: nothing else, nothing out of order. */
function wellOrdered(kinds: string[]): boolean {
  return /^events(,text)*,done$/.test(kinds.join(','));
}

async function logOf(store: InvestigationStore, id: string) {
  return (await store.load(id))!.events;
}

function consecutive(seqs: number[]): boolean {
  return seqs.every((s, i) => s === i);
}

const eventKinds = (r: { events?: Line }) => ((r.events?.events ?? []) as EventPayload[]).map(e => e.kind);

// ── The playthrough ─────────────────────────────────────────────────────────

const store = memoryStore();

const start = await post({ start: { storyId: 'toy', name: 'QA' } }, { store });
const id = start.events?.investigationId as string;
check('start: 200 and NDJSON in order events → text → done', start.status === 200 && wellOrdered(start.kinds), start.kinds.join(','));
check('start: the events line is InvestigationStarted(locked_study) at seq 0 and names the new id',
  start.events?.seqFrom === 0 && eventKinds(start).join() === 'InvestigationStarted'
  && start.events?.events[0].story === 'locked_study' && typeof id === 'string');
// The authoring stub sends no text chunks; only replay streams.
if (!AUTHOR) check('start: streamed text is the narrated text', start.streamed === start.done?.narrated.text && start.streamed === PROSE.opening);
check('start: done.state is the opening view',
  start.done?.state.act === 0 && start.done?.state.location === 'hall' && start.done?.state.clock === 1230
  && start.done?.state.period === 'night' && start.done?.state.weather === 'foggy'
  && JSON.stringify(start.done?.state.inventory) === '["matches"]'
  && JSON.stringify(start.done?.state.personsPresent) === '["housekeeper"]' && start.done?.state.ended === null,
  JSON.stringify(start.done?.state));
check('start: the Observation is returned and logged',
  start.done?.observations.length === 1
  && (await logOf(store, id)).some(e => e.payload.kind === 'ObservationRecorded' && e.payload.observation.key === 'hall_tiles_cold'));

const callsBeforeLook = selectCalls;
const look = await post({ investigationId: id, text: 'look around' }, { store });
check('look: an exact command never reaches the selection model', selectCalls === callsBeforeLook);
check('look: NDJSON in order, events before any text', look.status === 200 && wellOrdered(look.kinds), look.kinds.join(','));
check('look: seqFrom continues the log after start (3 rows)', look.events?.seqFrom === 3, String(look.events?.seqFrom));
check('look: resolved as Looked, with the greeting Beat',
  eventKinds(look).includes('Looked') && eventKinds(look).includes('BeatQueued'), eventKinds(look).join(','));
check('look: Narrated carries the turn\'s Beats',
  (look.done?.narrated.beats as string[]).some(b => b.startsWith('The housekeeper says the master')));

const ask = await post({ investigationId: id, text: 'ask the housekeeper about the key' }, { store });
check('ask: the housekeeper discloses key_in_clock to the player',
  ((ask.events?.events ?? []) as EventPayload[]).some(e => e.kind === 'FactDisclosed' && e.fact === 'key_in_clock' && e.to === 'player'));

const open = await post({ investigationId: id, text: 'open the clock' }, { store });
check('open: the clock opens, with the authored Beat',
  eventKinds(open).includes('Opened') && eventKinds(open).includes('BeatQueued'), eventKinds(open).join(','));

const clockBeforeTake = open.done?.state.clock as number;
const take = await post({ investigationId: id, text: 'take the key' }, { store });
check('take: replayed from the log, the key is now carried',
  eventKinds(take).includes('Taken') && (take.done?.state.inventory as string[]).includes('brass_key'), JSON.stringify(take.done?.state));
check('take: the clock advanced across requests', (take.done?.state.clock as number) > clockBeforeTake && clockBeforeTake > 1230,
  `${clockBeforeTake} → ${take.done?.state.clock}`);

const tick = await post({ investigationId: id, tick: true }, { store });
check('tick: NDJSON in order and the turn is a TickResolved', wellOrdered(tick.kinds) && eventKinds(tick)[0] === 'TickResolved',
  eventKinds(tick).join(','));
check('tick: TickResolved is in the stored log', (await logOf(store, id)).some(e => e.payload.kind === 'TickResolved'));
check('tick: the key is still carried', (tick.done?.state.inventory as string[]).includes('brass_key'));

const bogus = await post({ investigationId: id, text: 'light the lamp' }, { store });
check('out-of-set Selection: 200, and IntentRejected rather than IntentSelected',
  bogus.status === 200 && wellOrdered(bogus.kinds) && eventKinds(bogus).includes('IntentRejected') && !eventKinds(bogus).includes('IntentSelected'),
  `${bogus.status} ${eventKinds(bogus).join(',')}`);

const log = await logOf(store, id);
check('the stored log has consecutive seq from 0', consecutive(log.map(e => e.seq)), log.map(e => e.seq).join(','));
check('the stored turn numbers never go backwards', log.every((e, i) => i === 0 || e.turn >= log[i - 1].turn));
const replayed = replay(story, log.map(e => e.payload));
check('replaying the stored log gives the last done.state',
  replayed.location === bogus.done?.state.location && replayed.clock === bogus.done?.state.clock
  && JSON.stringify(Object.keys(replayed.objects).filter(o => replayed.objects[o].placement.kind === 'inventory').sort())
    === JSON.stringify([...(bogus.done?.state.inventory as string[])].sort()));

// ── Errors ──────────────────────────────────────────────────────────────────

const missing = await post({ investigationId: '00000000-0000-0000-0000-000000000000', text: 'look around' }, { store });
check('unknown investigation: 404 and a single error line',
  missing.status === 404 && missing.lines.length === 1 && missing.lines[0].kind === 'error', `${missing.status} ${missing.kinds.join(',')}`);

const malformed = await post({ investigationId: id }, { store });
check('malformed request: 400 and a single error line',
  malformed.status === 400 && malformed.lines.length === 1 && malformed.lines[0].kind === 'error');

const noStory = await post({ start: { storyId: 'no_such_story', name: 'QA' } }, { store });
check('unknown story: 404 and a single error line', noStory.status === 404 && noStory.kinds.join() === 'error');

// ── The gate ────────────────────────────────────────────────────────────────

async function lookWithGate(gate: TurnDeps['gate']) {
  const s = memoryStore();
  const st = await post({ start: { storyId: 'toy', name: 'QA gate' } }, { store: s, gate });
  return post({ investigationId: st.events?.investigationId, text: 'look around' }, { store: s, gate });
}

const once = await lookWithGate((_ctx, result) =>
  result.prose === PROSE.look ? { ok: false, inventions: [{ kind: 'name' as const, token: INVENTED }] } : { ok: true, inventions: [] });
check('gate rejects once: the retry\'s prose is the narrated text', once.done?.narrated.text === PROSE.retry, once.done?.narrated.text);
if (!AUTHOR) check('gate rejects once: only the first attempt streamed', once.streamed === PROSE.look && wellOrdered(once.kinds));

const always = await lookWithGate(ctx =>
  ctx.events.some(e => e.kind === 'Looked') ? { ok: false, inventions: [{ kind: 'name' as const, token: INVENTED }] } : { ok: true, inventions: [] });
const fallbackBeats = always.done?.narrated.beats as string[];
check('gate rejects twice: falls back to the Beats alone, no Observations',
  always.done?.narrated.text === fallbackBeats.join(' ') && fallbackBeats.length > 0 && always.done?.observations.length === 0,
  always.done?.narrated.text);

// ── The exact-command fast path (ADR-0003) ──────────────────────────────────

const opening: CandidateSet = candidates(story, initialState(story, 42));
const exact = (text: string, set = opening) => JSON.stringify(exactSelection(text, set));
const MOVE_STUDY = JSON.stringify({ kind: 'intent', verb: 'move', exit: 'study_door' });
check('fast path: look, l, "Look around." and inventory, i, z',
  ['look', 'L', 'Look around.'].every(t => exact(t) === '{"kind":"intent","verb":"look"}')
  && ['inventory', 'i'].every(t => exact(t) === '{"kind":"intent","verb":"inventory"}') && exact('z') === '{"kind":"intent","verb":"wait"}');
check('fast path: an exit by any authored name, an abbreviation, or after "go"/"go to"',
  ['north', 'N', 'go north', 'Go to the study door', 'study'].every(t => exact(t) === MOVE_STUDY)
  && exact('e') === JSON.stringify({ kind: 'intent', verb: 'move', exit: 'garden_door' }));
check('fast path: declines an undeclared direction and anything that is not an exact command',
  ['south', 'open the clock', 'look at the clock', 'go'].every(t => exact(t) === 'null'));
check('fast path: declines a word that is also an Object\'s name, or that two exits share',
  exact('study', { ...opening, objects: [...opening.objects, { id: 'study_sign', name: 'Study', where: 'here' }] }) === 'null'
  && exact('north', { ...opening, exits: [...opening.exits, { id: 'trapdoor', names: ['north'] }] }) === 'null');

// ── One turn at a time ──────────────────────────────────────────────────────

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}
const passGate: TurnDeps['gate'] = () => ({ ok: true, inventions: [] });
const QUIET: NarrationResult = { prose: 'Quiet.', observations: [] };

/** The authored Selections, with hooks to hold a request inside select or narrate. */
function stubAi(hooks: { beforeSelect?: () => Promise<void>; narrate?: () => Promise<NarrationResult>; noSelect?: boolean } = {}): Ai {
  return {
    async select(input) {
      if (hooks.noSelect) throw new Error(`select called for ${JSON.stringify(input.text)}`);
      await hooks.beforeSelect?.();
      return SELECTIONS[input.text] ?? { kind: 'none' };
    },
    async *narrate() {
      yield { kind: 'done', result: hooks.narrate ? await hooks.narrate() : QUIET };
    },
  };
}

async function startWith(s: InvestigationStore, extra: Partial<TurnDeps> = {}) {
  const st = await post({ start: { storyId: 'toy', name: 'QA turns' } }, { store: s, ai: stubAi(), gate: passGate, ...extra });
  return st.events?.investigationId as string;
}
const kindsIn = async (s: InvestigationStore, invId: string) => (await logOf(s, invId)).map(e => e.payload.kind);
const isError = (r: { status: number; kinds: string[] }, status: number) => r.status === status && r.kinds.join() === 'error';

{
  const s = memoryStore();
  const invId = await startWith(s);
  const north = await post({ investigationId: invId, text: 'N' }, { store: s, ai: stubAi({ noSelect: true }), gate: passGate });
  check('fast path through the endpoint: "N" tries the locked study door with no select call',
    north.status === 200 && wellOrdered(north.kinds) && eventKinds(north).includes('MoveBlocked')
    && north.events?.events.some((e: EventPayload) => e.kind === 'IntentSelected' && e.exit === 'study_door'),
    `${north.status} ${eventKinds(north).join(',')}`);
}

{
  const s = memoryStore();
  const invId = await startWith(s);
  const started = deferred();
  const release = deferred();
  const slow = stubAi({ narrate: async () => { started.resolve(); await release.promise; return QUIET; } });
  const first = post({ investigationId: invId, text: 'look around' }, { store: s, ai: slow, gate: passGate });
  await started.promise;
  const second = await post({ investigationId: invId, text: 'open the clock' }, { store: s, ai: stubAi(), gate: passGate });
  check('a turn while another is narrating: 409 and a single error line', isError(second, 409), `${second.status} ${second.kinds.join(',')}`);
  release.resolve();
  const done = await first;
  const log = await logOf(s, invId);
  check('…the narrating turn completes, and the log holds only its rows after the opening',
    done.status === 200 && wellOrdered(done.kinds) && consecutive(log.map(e => e.seq))
    && log.filter(e => e.payload.kind === 'TurnReceived').length === 1 && log.at(-1)?.payload.kind === 'Narrated');
}

{
  const s = memoryStore();
  const invId = await startWith(s);
  // Both requests load the same closed log, then both try to append at the same seq.
  const bothLoaded = deferred();
  let arrived = 0;
  const release = deferred();
  const racing = stubAi({
    beforeSelect: async () => { if (++arrived === 2) bothLoaded.resolve(); await bothLoaded.promise; },
    narrate: async () => { await release.promise; return QUIET; },
  });
  const a = post({ investigationId: invId, text: 'open the clock' }, { store: s, ai: racing, gate: passGate });
  const b = post({ investigationId: invId, text: 'open the clock' }, { store: s, ai: racing, gate: passGate });
  // The loser retries, finds the winner's turn open, and is refused before the winner narrates.
  const settled = await Promise.race([a, b]);
  release.resolve();
  const results = [await a, await b];
  const log = await logOf(s, invId);
  check('two turns racing for one seq: one 200, one 409 (not a 500)',
    isError(settled, 409) && results.filter(r => r.status === 200).length === 1, results.map(r => r.status).join(','));
  check('…and the clock was opened once, with seq unbroken',
    consecutive(log.map(e => e.seq)) && log.filter(e => e.payload.kind === 'Opened').length === 1);
}

{
  const s = memoryStore();
  const invId = await startWith(s);
  const failing = stubAi({ narrate: async () => { throw new Error('provider down'); } });
  const broken = await post({ investigationId: invId, text: 'look around' }, { store: s, ai: failing, gate: passGate });
  const kinds = await kindsIn(s, invId);
  check('narration fails: an error line after events, and the turn is closed with its Beats',
    broken.kinds.join() === 'events,error' && kinds.at(-1) === 'Narrated'
    && ((await logOf(s, invId)).at(-1)?.payload as { text: string }).text.includes('A cold tiled hall'), `${broken.kinds.join(',')} / ${kinds.join(',')}`);
  const next = await post({ investigationId: invId, text: 'open the clock' }, { store: s, ai: stubAi(), gate: passGate });
  check('…so the next turn is not refused', next.status === 200 && eventKinds(next).includes('Opened'), `${next.status}`);
}

{
  let now = 1_000_000;
  const s = memoryStore(() => now);
  const invId = await startWith(s, { now: () => now });
  const started = deferred();
  const hung = stubAi({ narrate: () => { started.resolve(); return new Promise<NarrationResult>(() => {}); } });
  void post({ investigationId: invId, text: 'look around' }, { store: s, ai: hung, gate: passGate, now: () => now });
  await started.promise;
  const early = await post({ investigationId: invId, text: 'open the clock' }, { store: s, ai: stubAi(), gate: passGate, now: () => now });
  now += STALE_TURN_MS + 1;
  const late = await post({ investigationId: invId, text: 'open the clock' }, { store: s, ai: stubAi(), gate: passGate, now: () => now });
  const log = await logOf(s, invId);
  const lookAt = log.findIndex(e => e.payload.kind === 'Looked');
  const nextTurn = log.findIndex((e, i) => i > lookAt && e.payload.kind === 'TurnReceived');
  check('a turn whose request died: 409 while fresh, then closed with its Beats by the next request after the stale limit',
    isError(early, 409) && late.status === 200 && eventKinds(late).includes('Opened') && consecutive(log.map(e => e.seq))
    && log[nextTurn - 1]?.payload.kind === 'Narrated' && late.events?.seqFrom === nextTurn,
    `${early.status} ${late.status} ${log.map(e => e.payload.kind).join(',')}`);
}

console.log(`\n${pass} passed, ${fail} failed${AUTHOR ? ` (recordings rewritten in ${RECORDINGS})` : ''}`);
process.exit(fail === 0 ? 0 : 1);
