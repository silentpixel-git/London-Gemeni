/**
 * scripts/qa-turn.ts
 *
 * Drives POST /api/turn (server/turn.ts, contract server/TURN.md) in-process
 * against the toy Story with the memory store and the `recorded` AI provider:
 * NDJSON line order, the Event log's seq series, replay across requests, the
 * sidebar view, Ticks, errors, an out-of-set Selection, and both gate
 * rejection branches. No key, no network.
 *
 * The recordings in packages/ai/recordings/toy are authored here: the
 * Selections and prose below are the hand-written answers, and
 *   npx tsx scripts/qa-turn.ts --author
 * rewrites the recording files from them (needed whenever the engine or the
 * projections change what a turn's input looks like, since keys hash it).
 */

import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { EventPayload, NarrationContext, NarrationResult, Selection } from '../packages/schema/index.js';
import { replay } from '../packages/engine/index.js';
import { recorded, recording } from '../packages/ai/recorded.js';
import type { Ai } from '../packages/ai/types.js';
import { memoryStore, type InvestigationStore } from '../server/investigationStore.js';
import { fileStoryLoader, handleTurn, type TurnDeps } from '../server/turn.js';

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
const ai: Ai = AUTHOR ? recording(author, RECORDINGS) : recorded(RECORDINGS);

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

const look = await post({ investigationId: id, text: 'look around' }, { store });
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
  result.prose === PROSE.look ? { ok: false, inventions: [INVENTED] } : { ok: true, inventions: [] });
check('gate rejects once: the retry\'s prose is the narrated text', once.done?.narrated.text === PROSE.retry, once.done?.narrated.text);
if (!AUTHOR) check('gate rejects once: only the first attempt streamed', once.streamed === PROSE.look && wellOrdered(once.kinds));

const always = await lookWithGate(ctx =>
  ctx.events.some(e => e.kind === 'Looked') ? { ok: false, inventions: [INVENTED] } : { ok: true, inventions: [] });
const fallbackBeats = always.done?.narrated.beats as string[];
check('gate rejects twice: falls back to the Beats alone, no Observations',
  always.done?.narrated.text === fallbackBeats.join(' ') && fallbackBeats.length > 0 && always.done?.observations.length === 0,
  always.done?.narrated.text);

console.log(`\n${pass} passed, ${fail} failed${AUTHOR ? ` (recordings rewritten in ${RECORDINGS})` : ''}`);
process.exit(fail === 0 ? 0 : 1);
