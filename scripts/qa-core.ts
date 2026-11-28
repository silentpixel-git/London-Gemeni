/**
 * scripts/qa-core.ts — the new engine driven through the toy Story.
 *
 * This file is the behavioural specification for packages/engine: every
 * built-in verb, every Trigger kind, the Ledger, delayed grants, act entry,
 * endings, determinism and exact replay. It reads as a playthrough.
 *
 * Run: npx tsx scripts/qa-core.ts     Exit 1 on any FAIL.
 */
import { join } from 'node:path';
import { Story, validateStory, type EventPayload, type Selection } from '../packages/schema';
import { loadStoryDir } from '../packages/schema/load';
import { buildNarrationContext, candidates, fallbackProse, initialState, playerView, replay, resolveTurn, startInvestigation, tick, type State } from '../packages/engine';
import { suggestionsFor } from '../services/viewFormat';
import { confineSelection, repairSelectionReply } from '../packages/ai/selection';
import { fixedRng } from '../packages/engine/rng';
import { prove } from '../packages/engine/prover';

const story = Story.parse(loadStoryDir(join('packages', 'schema', 'fixtures', 'toy')));

let fails = 0;
const pass = (l: string) => console.log(`[PASS] ${l}`);
const fail = (l: string, d?: string) => { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; };
const check = (cond: boolean, label: string, detail?: string) => (cond ? pass(label) : fail(label, detail));
const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}`);

// ── Harness ──────────────────────────────────────────────────────────────────
// The game opens as the server opens it: the opening turn, with its Rules (ADR-0005).
const opening = startInvestigation(story, 42);
let s: State = opening.state;
const log: EventPayload[] = [...opening.events];
const verbsUsed = new Set<string>();
const has = (es: EventPayload[], pred: (e: EventPayload) => boolean) => es.some(pred);
const fired = (es: EventPayload[], rule: string) => has(es, e => e.kind === 'RuleFired' && e.rule === rule);

function go(text: string, sel: Omit<Extract<Selection, { kind: 'intent' }>, 'kind'>, draw = 0): EventPayload[] {
  verbsUsed.add(sel.verb);
  const r = resolveTurn(story, s, { text, selection: { kind: 'intent', ...sel } }, fixedRng([draw]));
  log.push(...r.events); s = r.state; return r.events;
}
function idle(minutes: number, draw = 0): EventPayload[] {
  const r = tick(story, s, minutes, fixedRng([draw]));
  log.push(...r.events); s = r.state; return r.events;
}
const where = (id: string) => s.objects[id].placement;
const present = () => candidates(story, s).persons.map(p => p.id);

// ── 1. Opening ───────────────────────────────────────────────────────────────
section('opening');
check(s.act === 0 && s.location === 'hall' && s.clock === 1230, 'opening state: act 0, hall, 20:30');
{
  const c = candidates(story, s);
  check(c.objects.some(o => o.id === 'hall_clock' && o.where === 'here'), 'candidates: clock is here');
  check(c.objects.some(o => o.id === 'matches' && o.where === 'carried'), 'candidates: matches are carried');
  check(!c.objects.some(o => o.id === 'brass_key'), 'candidates: key inside a closed clock is not offered');
  check(c.persons.some(p => p.id === 'housekeeper' && p.name === 'the housekeeper'), 'candidates: housekeeper shown by alias before introduction');
  check(c.exits.some(x => x.id === 'study_door'), 'candidates: locked exits are still offered');
  check(c.topics.some(t => t.person === 'housekeeper' && t.fact === 'key_in_clock' && t.direction === 'ask'), 'candidates: she can be asked about the key');
  check(!c.topics.some(t => t.fact === 'gardener_fled'), 'candidates: act-1 fact is not a topic in act 0');
  check(c.knownFacts.length === 0, 'candidates: player knows nothing yet');
}

// ── 2. proximity on arrival, look ────────────────────────────────────────────
section('proximity on arrival / look');
{
  const es = opening.events;
  check(es[0].kind === 'InvestigationStarted', 'the opening turn begins with InvestigationStarted');
  check(fired(es, 'greet_housekeeper'), 'proximity fires on the opening: she is standing there when the game begins');
  check(has(es, e => e.kind === 'BeatQueued') && has(es, e => e.kind === 'DispositionChanged' && e.disposition === 'neutral'), 'its beat and disposition effects land');
  check(s.beats.length === 1, 'state.beats holds the beat for the opening narration');
  check(JSON.stringify(replay(story, es, 42)) === JSON.stringify(s), 'the opening turn replays from its own Events');
  const look = go('look around', { verb: 'look' });
  check(has(look, e => e.kind === 'Looked'), 'look → Looked');
  check(!has(look, e => e.kind === 'RuleFired'), 'staying together raises no proximity: nothing fires on the first look');
  check(s.beats.length === 0, 'beats cleared on the next turn');
  go('look', { verb: 'look' });
  check(s.clock === 1234, 'two looks cost 4 minutes');
}

// ── 3. locked door, inventory, bad target ───────────────────────────────────
section('move blocked / inventory / rejection');
{
  const es = go('go into the study', { verb: 'move', exit: 'study_door' });
  check(has(es, e => e.kind === 'MoveBlocked' && e.reason === 'locked' && e.lock?.kind === 'key'), 'locked exit → MoveBlocked with the key lock');
  check(s.location === 'hall', 'player stays put');
  check(has(go('inventory', { verb: 'inventory' }), e => e.kind === 'InventoryChecked'), 'inventory → InventoryChecked');
  const bad = go('take the rose', { verb: 'take', target: 'rose' });
  check(has(bad, e => e.kind === 'IntentRejected') && !has(bad, e => e.kind === 'Taken'), 'taking an object not here → IntentRejected only');
  check(!has(bad, e => e.kind === 'ClockAdvanced'), 'a rejected intent costs no time');
}

// ── 4. ask → disclosure → ledger → flag rule → delayed grant ────────────────
section('ask / disclosed / ledger');
{
  const es = go('ask her about the key', { verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' });
  check(has(es, e => e.kind === 'Spoke' && e.person === 'housekeeper' && e.fact === 'key_in_clock'), 'Spoke with the fact');
  check(has(es, e => e.kind === 'FactDisclosed' && e.from === 'housekeeper' && e.to === 'player'), 'FactDisclosed person → player');
  check(has(es, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_key'), 'the Clue for that fact is discovered');
  check(fired(es, 'housekeeper_tells_key') && s.flags.knows_key_location === true, 'disclosed trigger fired and set its flag');
  check(fired(es, 'housekeeper_remembers_overnight') && s.pendingGrants.length === 1, 'flag trigger cascaded within the same turn; delayed grant scheduled');
  check(s.ledger.housekeeper?.told.includes('key_in_clock'), 'ledger: she has told the player');
  check(s.knows.player.key_in_clock === true, 'player knows the fact');
  check(s.persons.housekeeper.introduced, 'self-introducing person is named after first exchange');
  check(candidates(story, s).persons[0].name === 'Mrs. Hale', 'candidates now show her name');
  const again = go('ask about the key again', { verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' });
  check(!fired(again, 'housekeeper_tells_key'), 'asking again does not refire the once rule');
  check(s.ledger.housekeeper.told.filter(f => f === 'key_in_clock').length === 1, 'ledger does not duplicate');
  const gated = go('ask about the gardener', { verb: 'ask', person: 'housekeeper', topic: 'gardener_fled' });
  check(has(gated, e => e.kind === 'Spoke' && e.fact === undefined && !e.greeting) && !has(gated, e => e.kind === 'FactDisclosed'), 'act-gated fact: deflection (not a greeting), no disclosure');
  check(!s.knows.housekeeper.master_was_afraid, 'delayed grant has not matured yet');
}

// ── 5. open container, take key, examine, drop/take ─────────────────────────
section('open / take / examine / drop');
{
  const es = go('open the clock', { verb: 'open', target: 'hall_clock' });
  check(has(es, e => e.kind === 'Opened'), 'open → Opened');
  check(fired(es, 'open_clock_knowing'), 'action rule with flag condition fires');
  check(candidates(story, s).objects.some(o => o.id === 'brass_key' && o.where === 'here'), 'key inside the open clock is now offered as here');
  check(has(go('examine the key', { verb: 'examine', target: 'brass_key' }), e => e.kind === 'Examined'), 'examine → Examined');
  check(has(go('take the key', { verb: 'take', target: 'brass_key' }), e => e.kind === 'Taken') && where('brass_key').kind === 'inventory', 'take → carried');
  check(has(go('drop the key', { verb: 'drop', target: 'brass_key' }), e => e.kind === 'Dropped') && where('brass_key').kind === 'location', 'drop → lies here');
  go('take key', { verb: 'take', target: 'brass_key' });
  check(has(go('close the clock', { verb: 'close', target: 'hall_clock' }), e => e.kind === 'Closed'), 'close → Closed');
  check(has(go('examine the housekeeper', { verb: 'examine', target: 'housekeeper' }), e => e.kind === 'Examined' && e.object === 'housekeeper'), 'a present person can be examined');
}

// ── 6. move with key, leave/enter rules, cue ─────────────────────────────────
section('move / enter / leave');
{
  const es = go('go to the study', { verb: 'move', exit: 'study_door' });
  check(has(es, e => e.kind === 'Moved' && e.to === 'study'), 'carrying the key opens the way');
  check(has(es, e => e.kind === 'CuePlayed' && e.sound === 'clock_chime'), 'leave rule → cue');
  check(fired(es, 'study_is_dark'), 'enter rule with flagsNone fires');
  check(!candidates(story, s).objects.some(o => o.id === 'letter'), 'hidden letter is not offered');
  check(present().length === 0, 'housekeeper stayed in the hall');
  const back = go('back', { verb: 'move', exit: 'to_hall' });
  const fwd = go('study', { verb: 'move', exit: 'study_door' });
  check(!fired(back, 'study_is_dark') && fired(fwd, 'study_is_dark'), 'once:false enter rule fires on every entry');
}

// ── 7. combine, reveal, use ──────────────────────────────────────────────────
section('combine / use');
{
  go('take candle', { verb: 'take', target: 'candle' });
  const es = go('light the candle', { verb: 'combine', target: 'matches', secondary: 'candle' });
  check(has(es, e => e.kind === 'Combined'), 'combine → Combined');
  check(fired(es, 'light_candle'), 'combine trigger matches regardless of item order');
  check(s.flags.candle_lit === true && s.objects.letter.hidden === false, 'flag set and letter revealed');
  check(candidates(story, s).objects.some(o => o.id === 'letter'), 'revealed letter is offered');
  check(has(go('use the candle', { verb: 'use', target: 'candle' }), e => e.kind === 'Used'), 'use → Used');
}

// ── 8. tick: weighted choice recorded, summon ────────────────────────────────
section('tick');
{
  // eligible in authored order: tick_cat(3), tick_fog(1), tick_housekeeper_comes_to_the_light(2) → draw 0.9 selects the third
  const es = idle(15, 0.9);
  const t = es.find(e => e.kind === 'TickResolved');
  check(t?.kind === 'TickResolved' && t.rule === 'tick_housekeeper_comes_to_the_light' && t.draw === 0.9 && t.minutes === 15, 'TickResolved records draw, choice and minutes');
  check(present().includes('housekeeper'), 'summonPerson brought her to the study');
  const cat = idle(15, 0.1);
  check(cat.find(e => e.kind === 'TickResolved')?.kind === 'TickResolved' && (cat.find(e => e.kind === 'TickResolved') as { rule: string | null }).rule === 'tick_cat', 'draw 0.1 selects the cat');
  // A probe on a copy of the state: not logged, so replay stays exact.
  const quiet = tick(story, { ...s, location: 'garden' }, 15, fixedRng([0.5])).events;
  check((quiet.find(e => e.kind === 'TickResolved') as { rule: string | null } | undefined)?.rule === 'tick_fog', 'in the garden only the fog rule is eligible');
}

// ── 9. read → learn → clue → act advance ─────────────────────────────────────
section('read / act entry');
{
  check(has(go('take the letter', { verb: 'take', target: 'letter' }), e => e.kind === 'Taken'), 'the revealed letter can be taken');
  const es = go('read the letter', { verb: 'read', target: 'letter' });
  check(has(es, e => e.kind === 'Read') && has(es, e => e.kind === 'FactLearned' && e.person === 'player' && e.fact === 'letter_confession'), 'read → FactLearned from Object.fact');
  check(has(es, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_letter'), 'Clue discovered');
  check(fired(es, 'read_letter') && fired(es, 'letter_opens_the_garden'), 'action rule set the flag; flag rule cascaded');
  check(has(es, e => e.kind === 'ActEntered' && e.act === 1), 'ActEntered 1');
  check(s.act === 1 && s.location === 'garden' && s.clock === 1290, 'act entry: anchor location, act clock');
  const afraid = es.findIndex(e => e.kind === 'FactLearned' && e.person === 'housekeeper' && e.fact === 'master_was_afraid');
  check(afraid > es.findIndex(e => e.kind === 'ActEntered') && s.knows.housekeeper.master_was_afraid === true && s.pendingGrants.length === 0,
    'act entry delivers the delayed grant still in flight, right after ActEntered');
  check(s.flags.garden_unlocked === true, 'garden unlocked');
  check(present().includes('housekeeper') && s.persons.housekeeper.override === undefined, 'housekeeper is in the garden by schedule, not by a pin');
  check(candidates(story, s).topics.some(t => t.fact === 'gardener_fled' && t.direction === 'ask'), 'act-1 fact is now askable');
  check(candidates(story, s).topics.some(t => t.fact === 'letter_confession' && t.direction === 'tell'), 'player may tell her about the letter');
}

// ── 10. show → disclosure player→person, takeItem/moveObject ────────────────
section('show / give');
{
  const es = go('show her the letter', { verb: 'show', target: 'letter', person: 'housekeeper' });
  check(has(es, e => e.kind === 'Shown') && has(es, e => e.kind === 'FactDisclosed' && e.from === 'player' && e.to === 'housekeeper' && e.fact === 'letter_confession'), 'show → FactDisclosed player → person');
  check(fired(es, 'housekeeper_takes_letter'), 'disclosed trigger from player fires');
  check(where('letter').kind === 'person' && s.persons.housekeeper.disposition === 'trusting', 'takeItem/moveObject/setDisposition landed');
  check(s.ledger.housekeeper.heard.includes('letter_confession'), 'ledger: she has heard it from the player');
  check(has(go('ask about the gardener', { verb: 'ask', person: 'housekeeper', topic: 'gardener_fled' }), e => e.kind === 'FactDisclosed'), 'act-1 fact disclosed now');
  const again = go('take candle', { verb: 'take', target: 'candle' }); // the candle is carried already
  check(has(again, e => e.kind === 'IntentRejected' && e.reason === 'you already have it'), 'take on a carried thing says so, and does not deny it exists');
  const gv = go('give her the candle', { verb: 'give', target: 'candle', person: 'housekeeper' });
  check(has(gv, e => e.kind === 'Given') && where('candle').kind === 'person', 'give → Given, object on the person');
  const talked = go('talk to her', { verb: 'talk', person: 'housekeeper' });
  check(has(talked, e => e.kind === 'Spoke' && e.fact === undefined && e.greeting === true), 'talk → Spoke as a greeting, without a fact');
  const greetCtx = buildNarrationContext(story, s, talked, 'compact');
  const greetLine = fallbackProse(story, greetCtx);
  check(greetLine.includes('waits for you to ask something in particular'), 'talk fallback invites a particular question', greetLine);
  const beatLine = fallbackProse(story, { ...greetCtx, beats: ['She says the clock has stopped.'] });
  check(!beatLine.includes('waits for you to ask'), 'a greeting with a beat this turn lets the beat speak, without the invitation', beatLine);
}

// ── 11. clock rule ───────────────────────────────────────────────────────────
section('clock rule');
{
  const es = go('wait', { verb: 'wait' });
  check(has(es, e => e.kind === 'TickResolved' && e.minutes === 30), 'wait is a 30-minute tick');
  go('wait', { verb: 'wait' }); go('wait', { verb: 'wait' }); go('wait', { verb: 'wait' }); go('wait', { verb: 'wait' }); // past 00:00
  check(fired(log.slice(-40), 'midnight_bells'), 'clock rule fired when the clock passed midnight');
  check(has(log.slice(-40), e => e.kind === 'BeatQueued' && e.asQuote === true), 'its beat is a quote');
  check(present().length === 0, 'housekeeper offstage in late_night by schedule');
}

// ── 12. deduction → ending ───────────────────────────────────────────────────
section('deduce / ending');
{
  const es = go('it was the gardener', { verb: 'deduce', facts: ['letter_confession', 'gardener_fled'] });
  check(has(es, e => e.kind === 'Deduced') && fired(es, 'deduce_gardener'), 'deduction trigger with all facts named');
  check(has(es, e => e.kind === 'GameEnded' && e.ending === 'solved') && s.ended === 'solved', 'game ended: solved');
  const after = go('look', { verb: 'look' });
  check(has(after, e => e.kind === 'IntentRejected') && !has(after, e => e.kind === 'Looked'), 'turns after the end are rejected');
}

// ── 13. replay and determinism ───────────────────────────────────────────────
section('replay / determinism');
{
  const replayed = replay(story, log, 42);
  check(JSON.stringify(replayed) === JSON.stringify(s), 'replaying the log reproduces the final state exactly');
  // Re-run the opening of the scenario with the same draws and compare event streams.
  const run = () => {
    let st = initialState(story, 42); const out: EventPayload[] = [];
    const step = (sel: Selection, d: number) => { const r = resolveTurn(story, st, { text: 'x', selection: sel }, fixedRng([d])); out.push(...r.events); st = r.state; };
    step({ kind: 'intent', verb: 'look' }, 0);
    step({ kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' }, 0);
    step({ kind: 'intent', verb: 'wait' }, 0.3);
    return JSON.stringify(out);
  };
  check(run() === run(), 'same inputs and draws → identical event stream');
}

// ── 14. other endings on fresh games ─────────────────────────────────────────
section('alternate endings');
{
  s = initialState(story, 7); log.length = 0;
  const es = go('it was the housekeeper', { verb: 'deduce', facts: [], person: 'housekeeper' });
  check(has(es, e => e.kind === 'GameEnded' && e.ending === 'accused_wrongly'), 'naming a suspect alone ends it: accused_wrongly');
  s = initialState(story, 8);
  // get to act 1 quickly via the engine, then wait to 01:00
  go('ask', { verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' });
  go('open', { verb: 'open', target: 'hall_clock' }); go('take', { verb: 'take', target: 'brass_key' });
  go('go', { verb: 'move', exit: 'study_door' }); go('take', { verb: 'take', target: 'candle' });
  go('light', { verb: 'combine', target: 'candle', secondary: 'matches' }); go('read', { verb: 'read', target: 'letter' });
  check(s.act === 1, 'shortest path reaches act 1');
  let guard = 0; while (!s.ended && guard++ < 20) go('wait', { verb: 'wait' });
  check(s.ended === 'unsolved' && s.persons.housekeeper.override === null, 'one o\'clock ends it unsolved and dismisses her');
}

// ── 14b. delayed grant matures on a period boundary, within an act ───────────
section('delayed grant / period boundary');
{
  s = startInvestigation(story, 12).state;
  go('ask her about the key', { verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' });
  check(s.pendingGrants.length === 1 && s.boundaries === 0, 'the grant is scheduled one boundary out (act 0, night)');
  let before = true; let cross: EventPayload[] = []; let guard = 0;
  while (s.boundaries === 0 && guard++ < 10) { before = before && !s.knows.housekeeper.master_was_afraid; cross = go('wait', { verb: 'wait' }); }
  check(before, 'not known on any turn before the boundary');
  check(has(cross, e => e.kind === 'FactLearned' && e.person === 'housekeeper' && e.fact === 'master_was_afraid') && s.act === 0,
    'it matures on the turn the clock crosses into the small hours, still in act 0');
  check(s.pendingGrants.length === 0, 'pending queue emptied');
}

// ── 15. flavour and none selections ──────────────────────────────────────────
section('flavour / none');
{
  s = initialState(story, 9);
  const fl = resolveTurn(story, s, { text: 'look at the ceiling', selection: { kind: 'flavour', subject: 'the ceiling' } }).events;
  check(has(fl, e => e.kind === 'FlavourRequested') && has(fl, e => e.kind === 'ClockAdvanced'), 'flavour → FlavourRequested, costs a look');
  const no = resolveTurn(story, s, { text: 'fly', selection: { kind: 'none' } }).events;
  check(has(no, e => e.kind === 'IntentRejected') && !has(no, e => e.kind === 'ClockAdvanced'), 'none → IntentRejected, costs nothing');
}

// ── 16. player view: what has been tried (the "Try" chips) ──────────────────
section('player view: tried');
{
  let v = initialState(story, 5);
  const vlog: EventPayload[] = [{ kind: 'InvestigationStarted', story: story.id, seed: 5 }];
  const turn = (sel: Omit<Extract<Selection, { kind: 'intent' }>, 'kind'>) => {
    const r = resolveTurn(story, v, { text: sel.verb, selection: { kind: 'intent', ...sel } }, fixedRng([0]));
    vlog.push(...r.events); v = r.state;
  };
  const view0 = playerView(story, vlog);
  check(!view0.objects.some(o => o.examined) && !view0.persons.some(p => p.spokenTo) && !view0.exits.some(x => x.visited),
    'opening view: nothing examined, spoken to or visited', JSON.stringify([view0.objects, view0.persons, view0.exits]));
  check(JSON.stringify(suggestionsFor(view0)) === JSON.stringify(['examine long-case clock', 'examine doormat', 'talk to the housekeeper', 'go study']),
    'chips: objects, then people, then places, at most four, with the sidebar\'s commands', JSON.stringify(suggestionsFor(view0)));

  turn({ verb: 'examine', target: 'mat' });
  turn({ verb: 'talk', person: 'housekeeper' });
  const view1 = playerView(story, vlog);
  check(view1.objects.find(o => o.id === 'mat')?.examined === true && !view1.objects.find(o => o.id === 'hall_clock')?.examined,
    'examine marks only that object', JSON.stringify(view1.objects));
  check(view1.persons.find(p => p.id === 'housekeeper')?.spokenTo === true, 'talk marks the person as spoken to here');
  check(!suggestionsFor(view1).some(c => c.includes('doormat') || c.startsWith('talk to')) && suggestionsFor(view1).includes('go garden'),
    'chips drop what was tried and let the next untried thing in', JSON.stringify(suggestionsFor(view1)));

  turn({ verb: 'read', target: 'hall_clock' });
  check(playerView(story, vlog).objects.find(o => o.id === 'hall_clock')?.examined === true, 'read counts as tried, like examine');

  turn({ verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' });
  turn({ verb: 'open', target: 'hall_clock' }); turn({ verb: 'take', target: 'brass_key' });
  turn({ verb: 'move', exit: 'study_door' });
  const view2 = playerView(story, vlog);
  check(view2.location.id === 'study' && view2.exits.find(x => x.id === 'to_hall')?.visited === true,
    'in the study, the way back to the hall (where the game began) is visited', JSON.stringify(view2.exits));
  turn({ verb: 'move', exit: 'to_hall' });
  check(playerView(story, vlog).exits.find(x => x.id === 'study_door')?.visited === true, 'back in the hall, the study is visited');
}

// ── The prose's world, on this Story ─────────────────────────────────────────
// The same general mechanisms qa:stress proves on the stress Story, here on unrelated content:
// a part named in an Object's beats, a person's trait, a document examined, a miss on scenery.
section('the prose\'s world, on this Story');
{
  let w: State = startInvestigation(story, 42).state;
  const step = (sel: Omit<Extract<Selection, { kind: 'intent' }>, 'kind'>, text = '') => {
    const r = resolveTurn(story, w, { text, selection: { kind: 'intent', ...sel } }, fixedRng([0]));
    w = r.state; return r;
  };
  const hall = candidates(story, w);
  check(hall.objects.find(o => o.id === 'hall_clock')?.description.some(b => b.includes('small door')) === true
    && hall.persons.find(p => p.id === 'housekeeper')?.description.some(b => b.includes('black dress')) === true
    && hall.location.description.some(b => b.includes('mat')),
    'the parser sees each thing\'s description: the clock\'s small door, the housekeeper\'s black dress, the hall');
  check(JSON.stringify(confineSelection({ kind: 'intent', verb: 'open', target: 'hall_clock', secondary: 'small door' }, hall)) === '{"kind":"intent","verb":"open","target":"hall_clock"}',
    'a part as a stray word does not sink the reading: open the small door opens the clock');
  check(JSON.stringify(confineSelection({ kind: 'intent', verb: 'talk', target: 'housekeeper' }, hall)) === '{"kind":"intent","verb":"talk","person":"housekeeper"}',
    'a person in the wrong slot moves to the slot talk reads');
  check(JSON.stringify(confineSelection({ kind: 'intent', verb: 'open', target: 'study_door' }, hall)) === '{"kind":"intent","verb":"move","exit":"study_door"}',
    'opening a door that is an exit is trying the way: open the study door moves through it');
  check(JSON.stringify(confineSelection({ kind: 'intent', verb: 'use', target: 'brass_key', secondary: 'study door' }, hall)) === '{"kind":"intent","verb":"move","exit":"study_door"}',
    'a key used on a door, named by its name rather than its id, is trying the way');
  const miss = resolveTurn(story, w, { text: 'draw the curtains', selection: { kind: 'none', reason: 'no candidate' } });
  check(fallbackProse(story, buildNarrationContext(story, miss.state, miss.events, 'compact')) === 'Nothing comes of it.',
    'a miss on scenery comes to nothing, and denies nothing');
  step({ verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' });
  step({ verb: 'open', target: 'hall_clock' }); step({ verb: 'take', target: 'brass_key' });
  step({ verb: 'move', exit: 'study_door' });
  const desk = step({ verb: 'examine', target: 'desk' });
  check(has(desk.events, e => e.kind === 'Examined' && e.object === 'desk') && !has(desk.events, e => e.kind === 'Read'), 'examining the desk (no document) is an examine');
  const lit = step({ verb: 'use', target: 'matches', secondary: 'candle' }, 'light the candle with the matches');
  check(fired(lit.events, 'light_candle') && w.objects.letter.hidden === false, 'using the matches on the candle fires this Story\'s combine Rule: the flame shows the letter');
  const letter = step({ verb: 'examine', target: 'letter' }, 'look at the letter');
  const letterObj = story.objects.find(o => o.id === 'letter')!;
  check(has(letter.events, e => e.kind === 'Read' && e.object === 'letter') && has(letter.events, e => e.kind === 'FactLearned' && e.person === 'player' && e.fact === 'letter_confession'),
    'looking at the letter reads it and teaches its Fact');
  check(fired(letter.events, 'read_letter') && w.act === 1, 'and fires this Story\'s read Rule: the garden opens, act 1 begins');
  check(JSON.stringify(buildNarrationContext(story, letter.state, letter.events, 'full').beats) === JSON.stringify([...letterObj.beats, letterObj.document]),
    'and the narrator gets the letter\'s own beats, then its text');
  const garden = story.locations.find(l => l.id === w.location)!;
  check(w.location !== 'study' && garden.beats.every(b => buildNarrationContext(story, letter.state, letter.events, 'full', 'study').beats.includes(b))
    && !garden.beats.some(b => buildNarrationContext(story, letter.state, letter.events, 'full', w.location).beats.includes(b)),
    'an act that brings the player somewhere new is narrated as an arrival there; begun in place, it is not');
}

// ── Telling and asking at the seam ───────────────────────────────────────────
// A topic offered as "tell" (the player knows it, the person does not) is the player telling.
// The selector says whether the line tells; a question about that subject is an ask with no topic.
section('telling and asking');
{
  const knows = Story.parse({ ...story, facts: story.facts.map(f => (f.id === 'letter_confession' ? { ...f, knownBy: ['player'] } : f)) });
  let w: State = startInvestigation(knows, 42).state;
  const set = candidates(knows, w);
  check(set.topics.some(t => t.person === 'housekeeper' && t.fact === 'letter_confession' && t.direction === 'tell'), 'the player\'s own Fact is offered to her as a tell topic');
  const asked = confineSelection({ kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'letter_confession' }, set, 'what do you make of the letter?');
  check(JSON.stringify(asked) === '{"kind":"intent","verb":"ask","person":"housekeeper"}', 'a question about a tell subject keeps no topic: it is an ask, not the player telling');
  const told = confineSelection({ kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'letter_confession', telling: true }, set, 'tell her about the letter');
  check(told.kind === 'intent' && told.topic === 'letter_confession', 'the same subject, told, keeps its topic');
  const unnamed = confineSelection({ kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'letter_confession', telling: true }, set, 'it was the gardener who did it');
  check(unnamed.kind === 'intent' && unnamed.topic === 'letter_confession', 'a told answer need not name its subject to count');
  const accuseThing = confineSelection({ kind: 'intent', verb: 'deduce', facts: ['letter_confession'], person: 'mat' }, set, 'i accuse the mat');
  check(accuseThing.kind === 'none', 'a deduction naming a thing as its suspect is no deduction: it could otherwise fire into an ending');
  const offTopic = confineSelection({ kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'letter_confession', telling: true, agrees: false }, set, 'i am sure it will rain');
  check(offTopic.kind === 'intent' && offTopic.topic === undefined, 'a telling line that shares no word with the subject or its answer does not use the answer up');
  const leak = confineSelection({ kind: 'flavour', subject: 'the blackmail demand that names the gardener' }, set, 'look around the hall');
  check(leak.kind === 'none', 'a flavour subject that would show the player a hidden answer becomes none');
  const ownWords = confineSelection({ kind: 'flavour', subject: 'the gardener' }, set, 'think about the gardener');
  check(ownWords.kind === 'flavour', 'the player\'s own words are never a leak');
  const plain = confineSelection({ kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' }, set, 'ask her about the key');
  check(plain.kind === 'intent' && plain.topic === 'key_in_clock', 'an ordinary ask needs no telling');
  const object = confineSelection({ kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'mat' }, set, 'ask her about the mat');
  check(JSON.stringify(object) === '{"kind":"intent","verb":"ask","person":"housekeeper"}', 'an Object given as a topic is the designed deflection, not a rejected line');
  const lens = confineSelection({ kind: 'intent', verb: 'examine', target: 'hall_clock', secondary: 'mat' }, set, 'look at the clock through the mat');
  check(JSON.stringify(lens) === '{"kind":"intent","verb":"use","target":"mat","secondary":"hall_clock"}', 'examining something with an object at hand is using that object on it');
  const byLamp = confineSelection({ kind: 'intent', verb: 'read', target: 'hall_clock', secondary: 'mat' }, set, 'read the clock by the mat');
  check(byLamp.kind === 'intent' && byLamp.verb === 'read' && byLamp.target === 'hall_clock', 'reading something by or with another object is still reading it');
  const both = { ...set, persons: [...set.persons, { id: 'gardener', name: 'The Gardener', description: [] }],
    topics: [...set.topics.filter(t => t.fact !== 'key_in_clock'), { person: 'gardener', fact: 'key_in_clock', phrase: 'the key', direction: 'ask' as const }] };
  const wrongPerson = confineSelection({ kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'key_in_clock' }, both, 'ask her about the key');
  check(JSON.stringify(wrongPerson) === '{"kind":"intent","verb":"ask","person":"housekeeper"}', 'a topic offered only for someone else is the designed deflection, not a rejected line');
  const r = resolveTurn(knows, w, { text: 'tell her about the letter', selection: told }, fixedRng([0]));
  w = r.state;
  check(has(r.events, e => e.kind === 'FactDisclosed' && e.from === 'player' && e.to === 'housekeeper'), 'telling her discloses it to her');
  check(!candidates(knows, w).topics.some(t => t.person === 'housekeeper' && t.fact === 'letter_confession'),
    'once told, she is never offered as telling it back: a person does not repeat to the player what the player told them');
  check(JSON.stringify(repairSelectionReply({ kind: 'ask', person: 'housekeeper', topic: 'key_in_clock' })) === '{"kind":"intent","verb":"ask","person":"housekeeper","topic":"key_in_clock"}',
    'a reply that puts the verb in "kind" is read as that intent');
  check(JSON.stringify(repairSelectionReply({ kind: 'none', reason: 'x' })) === '{"kind":"none","reason":"x"}', 'a well-formed reply is left alone');
}

// ── A told answer is judged ──────────────────────────────────────────────────
// Telling a person a Fact the player holds (an answer, a reading) carries whether what the line claims agrees
// with the Fact's statement; the selector judges it server side, and disclosed Rules may branch on it.
section('a told answer is judged');
{
  const judged = Story.parse({
    ...story,
    facts: story.facts.map(f => (f.id === 'letter_confession' ? { ...f, knownBy: ['player'] } : f)),
    rules: [...story.rules,
      { id: 'told_right', trigger: { kind: 'disclosed', fact: 'letter_confession', from: 'player', agrees: true }, once: true, effects: [{ kind: 'playBeat', beats: ['Right.'] }] },
      { id: 'told_wrong', trigger: { kind: 'disclosed', fact: 'letter_confession', from: 'player', agrees: false }, once: true,
        effects: [{ kind: 'playBeat', beats: ['Wrong.'] }, { kind: 'grantFact', person: 'player', fact: 'master_was_afraid' }] }],
    clues: [...story.clues, { id: 'clue_afraid', name: 'Afraid', fact: 'master_was_afraid', summary: 'He was afraid.' }],
  });
  const w0: State = startInvestigation(judged, 42).state;
  const set = candidates(judged, w0);
  const entry = set.topics.find(t => t.person === 'housekeeper' && t.fact === 'letter_confession' && t.direction === 'tell');
  check(entry?.answer === judged.facts.find(f => f.id === 'letter_confession')!.statement, 'a tell topic carries its answer (here the statement), for the selector to judge against');
  check(set.topics.filter(t => t.direction === 'ask').every(t => t.answer === undefined), 'an ask topic does not: nothing a person knows is shown before it is told');
  const withAnswer = Story.parse({ ...judged, facts: judged.facts.map(f => (f.id === 'letter_confession' ? { ...f, answer: 'It was the gardener.' } : f)) });
  check(candidates(withAnswer, startInvestigation(withAnswer, 42).state).topics.find(t => t.fact === 'letter_confession')?.answer === 'It was the gardener.',
    'a Fact\'s own answer, when it has one, is what the selector judges against; its statement stays what is narrated');
  const tell = (agrees?: boolean) => resolveTurn(judged, w0, { text: 'tell her', selection: { kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'letter_confession', telling: true, ...(agrees === undefined ? {} : { agrees }) } }, fixedRng([0]));
  const right = tell(true), wrong = tell(false), plain = tell();
  check(has(right.events, e => e.kind === 'FactDisclosed' && e.agrees === true) && fired(right.events, 'told_right') && !fired(right.events, 'told_wrong'), 'an agreeing answer fires the Rule that waits for one');
  check(has(wrong.events, e => e.kind === 'FactDisclosed' && e.agrees === false) && fired(wrong.events, 'told_wrong') && !fired(wrong.events, 'told_right'), 'a contrary answer fires the other');
  check(fired(plain.events, 'told_right') && has(plain.events, e => e.kind === 'FactDisclosed' && e.agrees === true), 'an answer not judged is taken as agreeing');
  const untold = confineSelection({ kind: 'intent', verb: 'ask', person: 'housekeeper', topic: 'key_in_clock', agrees: false }, set, 'ask her about the key');
  check(untold.kind === 'intent' && untold.agrees === undefined, 'agrees means nothing on a line that does not tell: dropped');
  const contrary = wrong.state;
  check(contrary.knows.housekeeper?.letter_confession === true && contrary.ledger.housekeeper?.contrary?.includes('letter_confession') === true
    && !contrary.ledger.housekeeper?.heard.includes('letter_confession'),
    'a contrary answer: she knows the subject was answered, and her Ledger records the player\'s contrary claim, not the Fact');
  check(!buildNarrationContext(judged, contrary, wrong.events, 'full').ledger.some(l => l.heard.length > 0),
    'the narrator is never told she heard the right answer the player did not give');
  check(!candidates(judged, contrary).topics.some(t => t.fact === 'letter_confession'), 'and the answered subject is offered in neither direction: the first answer holds');
  const fails = (trigger: object) => validateStory({ ...story, rules: [...story.rules, { id: 'probe', trigger, once: true, effects: [{ kind: 'playBeat', beats: ['x'] }] }] })
    .issues.filter(i => i.level === 'fail' && i.at.startsWith('rules/probe/')).length;
  check(fails({ kind: 'disclosed', fact: 'key_in_clock', from: 'housekeeper', agrees: false }) === 1, 'validator: only the player\'s answers are judged, so agrees on another teller can never fire');
  check(fails({ kind: 'disclosed', fact: 'key_in_clock', to: 'player', agrees: true }) === 1, 'validator: nor on a disclosure to the player');
  check(fails({ kind: 'disclosed', fact: 'key_in_clock', from: 'player', agrees: false }) === 0, 'validator: agrees on the player\'s answer is fine');
  const p = prove(judged);
  check(p.lines.find(l => l.goal.id === 'clue_afraid')?.reachable === true, 'the prover offers the contrary answer too: a Clue only a wrong answer gives is REACHABLE');
}

// ── An Object used on itself is no use ───────────────────────────────────────
section('use on itself');
{
  let w: State = startInvestigation(story, 42).state;
  const r = resolveTurn(story, w, { text: 'use the mat on the mat', selection: { kind: 'intent', verb: 'use', target: 'mat', secondary: 'mat' } }, fixedRng([0]));
  w = r.state;
  check(has(r.events, e => e.kind === 'IntentRejected' && e.reason === 'it cannot be used on itself') && !has(r.events, e => e.kind === 'Used') && w.clock === startInvestigation(story, 42).state.clock,
    'using an Object on itself is refused, as combining it with itself is, so no Rule listing it in both slots fires');
  check(JSON.stringify(confineSelection({ kind: 'intent', verb: 'use', target: 'mat', secondary: 'mat' }, candidates(story, startInvestigation(story, 42).state)))
    === '{"kind":"intent","verb":"use","target":"mat"}',
    'the selector reads a duplicated secondary as a plain use, never as a use on itself');
}

// ── An attributed grant: a Rule's Beat speaks for a person ───────────────────
// grantFact with `from` records the grant as that person telling it, exactly as an
// answered ask does: the Ledger, who heard the turn, the Clue. Built on a copy of
// the toy Story so the fixture (and everything keyed on it) is unchanged.
section('attributed grant');
{
  const told = Story.parse({
    ...story,
    rules: [...story.rules, {
      id: 'housekeeper_volunteers', trigger: { kind: 'action', verb: ['look'] }, when: { personsPresent: ['housekeeper'] }, once: true,
      effects: [
        { kind: 'grantFact', person: 'player', fact: 'letter_confession', from: 'housekeeper' },
        { kind: 'grantFact', person: 'player', fact: 'master_was_afraid' },
      ],
    }, {
      id: 'confession_heard', trigger: { kind: 'disclosed', fact: 'letter_confession', from: 'housekeeper' }, once: true,
      effects: [{ kind: 'playBeat', beats: ['She lowers her voice.'] }],
    }],
  });
  let w: State = startInvestigation(told, 42).state;
  const r = resolveTurn(told, w, { text: 'look around', selection: { kind: 'intent', verb: 'look' } }, fixedRng([0]));
  w = r.state;
  const at = (pred: (e: EventPayload) => boolean) => r.events.findIndex(pred);
  const teaches = at(e => e.kind === 'FactLearned' && e.person === 'housekeeper' && e.fact === 'letter_confession');
  const discloses = at(e => e.kind === 'FactDisclosed' && e.from === 'housekeeper' && e.to === 'player' && e.fact === 'letter_confession');
  check(discloses >= 0 && !has(r.events, e => e.kind === 'FactLearned' && e.person === 'player' && e.fact === 'letter_confession'),
    'a grant with `from` is a disclosure from that person, not a bare learning');
  check(teaches >= 0 && teaches < discloses && w.knows.housekeeper?.letter_confession === true,
    'the teller learns it first if they did not know it: nobody tells what they do not know');
  check(w.ledger.housekeeper?.told.includes('letter_confession') === true, 'the Ledger records it as told by her, as an ask would');
  check(has(r.events, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_letter'), 'and its Clue is discovered');
  check(w.involved.includes('housekeeper'), 'the turn involves her, so she hears its prose');
  check(fired(r.events, 'confession_heard'), 'and a disclosed Rule on that Fact from her fires, as on an ask');
  check(has(r.events, e => e.kind === 'Spoke' && e.person === 'housekeeper' && e.fact === 'letter_confession') && w.persons.housekeeper.introduced,
    'she speaks it (Spoke), so a self-introducing teller is introduced, as on an ask');

  // The same grant, but the player already knows the Fact: still told, as an ask still tells.
  const knew = Story.parse({ ...told, facts: told.facts.map(f => (f.id === 'letter_confession' ? { ...f, knownBy: ['player'] } : f)) });
  const k = resolveTurn(knew, startInvestigation(knew, 42).state, { text: 'look around', selection: { kind: 'intent', verb: 'look' } }, fixedRng([0]));
  check(has(k.events, e => e.kind === 'FactDisclosed' && e.from === 'housekeeper' && e.fact === 'letter_confession')
    && k.state.ledger.housekeeper?.told.includes('letter_confession') === true && fired(k.events, 'confession_heard'),
    'a player who already knows it is still told: the Ledger records it and the disclosed Rule fires');

  // The player tells a person: the other direction, as an ask on a "tell" topic.
  const tells = Story.parse({
    ...story,
    facts: story.facts.map(f => (f.id === 'letter_confession' ? { ...f, knownBy: ['player'] } : f)),
    rules: [...story.rules, { id: 'player_confides', trigger: { kind: 'action', verb: ['look'] }, once: true,
      effects: [{ kind: 'grantFact', person: 'housekeeper', fact: 'letter_confession', from: 'player' }] }],
  });
  const t = resolveTurn(tells, startInvestigation(tells, 42).state, { text: 'look around', selection: { kind: 'intent', verb: 'look' } }, fixedRng([0]));
  check(has(t.events, e => e.kind === 'FactDisclosed' && e.from === 'player' && e.to === 'housekeeper')
    && t.state.ledger.housekeeper?.heard.includes('letter_confession') === true && t.state.knows.housekeeper?.letter_confession === true,
    'from the player to a person: the Ledger records that she heard it');

  // A teller who is not here cannot tell: the grant is recorded unattributed, and nobody absent hears the turn.
  const gone = Story.parse({
    ...story,
    rules: [...story.rules, { id: 'told_from_afar', trigger: { kind: 'action', verb: ['look'] }, once: true,
      effects: [{ kind: 'dismissPerson', person: 'housekeeper' }, { kind: 'grantFact', person: 'player', fact: 'letter_confession', from: 'housekeeper' }] }],
  });
  const g = resolveTurn(gone, startInvestigation(gone, 42).state, { text: 'look around', selection: { kind: 'intent', verb: 'look' } }, fixedRng([0]));
  check(has(g.events, e => e.kind === 'FactLearned' && e.person === 'player' && e.fact === 'letter_confession')
    && !has(g.events, e => e.kind === 'FactDisclosed') && !g.state.involved.includes('housekeeper') && !g.state.ledger.housekeeper,
    'an absent teller: the player learns it, attributed to no one, and she does not hear the turn');
  check(has(r.events, e => e.kind === 'FactLearned' && e.person === 'player' && e.fact === 'master_was_afraid')
    && !w.ledger.housekeeper?.told.includes('master_was_afraid'),
    'a grant without `from` is unchanged: learned, attributed to no one');
  const issues = (effect: object) => validateStory({ ...story, rules: [...story.rules, { id: 'probe', trigger: { kind: 'tick' }, weight: 1, once: true, effects: [effect] }] })
    .issues.filter(i => i.level === 'fail' && i.at.startsWith('rules/probe/'));
  check(issues({ kind: 'grantFact', person: 'player', fact: 'master_was_afraid', from: 'housekeeper', delayPeriods: 1 }).length === 1,
    'validator: a delayed grant cannot be attributed (a rumour arrives, nobody is telling it then)');
  check(issues({ kind: 'grantFact', person: 'housekeeper', fact: 'master_was_afraid', from: 'housekeeper' }).length === 1,
    'validator: nobody tells themself');
  check(issues({ kind: 'grantFact', person: 'player', fact: 'master_was_afraid', from: 'nobody_here' }).length === 1,
    'validator: the teller must be a person in the Story');
  check(issues({ kind: 'grantFact', person: 'player', fact: 'master_was_afraid', from: 'housekeeper' }).length === 0,
    'validator: an attributed grant to the player from a person is fine');
  const twoPeople = Story.parse({ ...story, persons: [...story.persons, { ...story.persons[0], id: 'gardener', name: 'The Gardener', alias: undefined, introduction: undefined }] });
  check(validateStory({ ...twoPeople, rules: [...twoPeople.rules, { id: 'probe', trigger: { kind: 'tick' }, weight: 1, once: true,
    effects: [{ kind: 'grantFact', person: 'housekeeper', fact: 'master_was_afraid', from: 'gardener' }] }] })
    .issues.filter(i => i.level === 'fail' && i.at.startsWith('rules/probe/')).length === 1,
    'validator: an attributed grant has the player on one side (between two people, nobody tells the player anything)');
  const warns = (rule: object) => validateStory({ ...story, rules: [...story.rules, rule] }).issues.filter(i => i.level === 'warn' && i.at.startsWith('rules/probe'));
  check(warns({ id: 'probe', trigger: { kind: 'tick' }, weight: 1, once: true, effects: [{ kind: 'grantFact', person: 'player', fact: 'letter_confession', from: 'housekeeper' }] })
    .some(i => i.message.includes('present')),
    'validator: warns when the Rule does not require the teller present');
  check(warns({ id: 'probe', trigger: { kind: 'tick' }, weight: 1, once: true, when: { personsPresent: ['housekeeper'] },
    effects: [{ kind: 'grantFact', person: 'player', fact: 'letter_confession', from: 'housekeeper' }] }).length === 0,
    'validator: no warning once the Rule requires the teller present');
  check(warns({ id: 'probe', trigger: { kind: 'tick' }, weight: 1, once: true, when: { personsPresent: ['housekeeper'] },
    effects: [{ kind: 'grantFact', person: 'housekeeper', fact: 'gardener_fled', from: 'player' }] })
    .some(i => i.message.includes('gardener_fled')),
    'validator: a grant from the player warns early like a grant to the player (the player learns it in telling it)');
}

// ── Coverage ─────────────────────────────────────────────────────────────────
section('coverage');
{
  const allVerbs = ['look', 'examine', 'read', 'take', 'drop', 'open', 'close', 'use', 'combine', 'show', 'give', 'talk', 'ask', 'deduce', 'move', 'wait', 'inventory'];
  const missing = allVerbs.filter(v => !verbsUsed.has(v));
  check(missing.length === 0, 'every verb exercised', missing.join(', '));
}

console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
