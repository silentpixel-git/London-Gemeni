/**
 * scripts/qa-whitechapel.ts — the golden scenario for the Whitechapel Story
 * (stories/whitechapel_1888), transcribed from the signed-off score:
 * Act 0, docs/act0-wager-score.md (§5 Rules, §6 turn windows).
 *
 * It drives resolveTurn / tick with explicit Selections, as qa-stress does for
 * the stress fixture, and asserts the negatives as well as the path: nothing
 * fires before its window, examining never commits, a question never sets off
 * the closing, the closing's turn never plays the coda, one Actor Clue per
 * branch. It ends with validation, the prover and exact replay.
 *
 * Run: npx tsx scripts/qa-whitechapel.ts     Exit 1 on any FAIL.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Story, validateStory, type EventPayload, type Selection } from '../packages/schema';
import { loadStoryDir } from '../packages/schema/load';
import { candidates, replay, resolveTurn, startInvestigation, tick, type State } from '../packages/engine';
import { prove, formatProof } from '../packages/engine/prover';
import { fixedRng } from '../packages/engine/rng';

const DIR = join('stories', 'whitechapel_1888');

let fails = 0;
const pass = (l: string) => console.log(`[PASS] ${l}`);
const fail = (l: string, d?: string) => { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; };
const check = (cond: boolean, label: string, detail?: string) => (cond ? pass(label) : fail(label, detail));
const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}`);
const done = () => { console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`); process.exit(fails === 0 ? 0 : 1); };

if (!existsSync(join(DIR, 'story.json'))) {
  fail(`${DIR} exists`, 'the Story has not been written yet');
  done();
}
const raw = loadStoryDir(DIR);
const story = Story.parse(raw);

// ── Harness ──────────────────────────────────────────────────────────────────
type Sel = Omit<Extract<Selection, { kind: 'intent' }>, 'kind'>;
const has = (es: EventPayload[], pred: (e: EventPayload) => boolean) => es.some(pred);
const fired = (es: EventPayload[], rule: string) => has(es, e => e.kind === 'RuleFired' && e.rule === rule);
const clue = (es: EventPayload[], id: string) => has(es, e => e.kind === 'ClueDiscovered' && e.clue === id);
const cue = (es: EventPayload[], sound: string) => has(es, e => e.kind === 'CuePlayed' && e.sound === sound);

class Run {
  s: State;
  log: EventPayload[] = [];
  opening: EventPayload[];
  constructor(public seed: number) {
    const o = startInvestigation(story, seed);
    this.s = o.state; this.log.push(...o.events); this.opening = o.events;
  }
  go(text: string, sel: Sel): EventPayload[] {
    const r = resolveTurn(story, this.s, { text, selection: { kind: 'intent', ...sel } }, fixedRng([0]));
    this.log.push(...r.events); this.s = r.state; return r.events;
  }
  idle(): EventPayload[] {
    const r = tick(story, this.s, undefined, fixedRng([0]));
    this.log.push(...r.events); this.s = r.state; return r.events;
  }
  /** A turn on a copy of the State: observed, never logged. */
  probe(text: string, sel: Sel) { return resolveTurn(story, this.s, { text, selection: { kind: 'intent', ...sel } }, fixedRng([0])); }
  talk() { return this.go('talk to holmes', { verb: 'talk', person: 'holmes' }); }
  tell(fact: string) { return this.go(`tell holmes about ${fact}`, { verb: 'ask', person: 'holmes', topic: fact }); }
  examine(target: string) { return this.go(`examine ${target}`, { verb: 'examine', target }); }
  visible(id: string) { return candidates(story, this.s).objects.some(o => o.id === id); }
  topic(fact: string, direction: 'ask' | 'tell') { return candidates(story, this.s).topics.some(t => t.person === 'holmes' && t.fact === fact && t.direction === direction); }
  flag(f: string) { return this.s.flags[f] === true; }
  told(fact: string) { return this.s.ledger.holmes?.told.includes(fact) === true; }
  replays() { return isDeepStrictEqual(replay(story, this.log, this.seed), this.s); }
}

// ── The opening ──────────────────────────────────────────────────────────────
section('the opening (score §1.1, §2.2)');
{
  const r = new Run(42);
  check(r.s.act === 0 && r.s.location === 'baker_street' && r.s.clock === 1170, 'opens in act 0 at 221B, 7:30 PM');
  check(isDeepStrictEqual(r.s.objects.opera_glass.placement, { kind: 'person', person: 'holmes' }), 'the opera glass is in Holmes\'s hand');
  check(!r.visible('opera_glass'), '…so it is not yet in the Candidate Set');
  check(!r.visible('street_soldier') && !r.visible('street_clergyman'), 'the two figures are not in the street yet');
  check(!r.topic('watson_reading_soldier', 'tell') && !r.topic('watson_reading_clergyman', 'tell'), 'no reading can be told before the wager');
  check(r.topic('holmes_opera_glass', 'ask') && r.topic('holmes_watsons_service', 'ask') && r.topic('holmes_violin', 'ask'), 'Holmes can be asked about his glass, Watson\'s service and the violin from the start');
  check(!r.topic('holmes_heath_road_dust', 'ask'), 'but not about Hampstead before he has read the street');
  check(!has(r.opening, e => e.kind === 'RuleFired'), 'the opening fires no scene');
}

// ── The win (score §6, shortest win) ─────────────────────────────────────────
section('the win: glass first');
const win = new Run(7);
{
  const t1 = win.talk();
  check(fired(t1, 'holmes_turns_on_action') && fired(t1, 'demonstration'), 'turn 1: the first action sets off the demonstration');
  check(!fired(t1, 'wager') && !win.flag('wager_offered'), 'turn 1: not the wager in the same turn');
  check(isDeepStrictEqual(win.s.objects.opera_glass.placement, { kind: 'location', location: 'baker_street' }) && win.visible('opera_glass'),
    'turn 1: the glass is set on the mantel and can now be seen');
  check(cue(t1, 'glass_down'), 'turn 1: the glass-down cue');
  check(['holmes_victualler', 'holmes_heath_road_dust', 'holmes_observation_vs_inference'].every(f => win.told(f)),
    'turn 1: what he said is on record as told by Holmes (the Ledger)');

  const t2 = win.talk();
  check(fired(t2, 'wager_on_exchange') && fired(t2, 'wager'), 'turn 2: the next exchange with Holmes is the wager');
  check(win.visible('street_soldier') && win.visible('street_clergyman'), 'turn 2: the two figures are in the street');
  check(win.topic('watson_reading_soldier', 'tell') && win.topic('watson_reading_clergyman', 'tell'), 'turn 2: both readings can now be told to Holmes');
  check(win.told('holmes_the_wager') && win.s.persons.holmes.disposition === 'warm', 'turn 2: the terms are on record; Holmes warms to it');

  const looked = win.probe('examine the clergyman', { verb: 'examine', target: 'street_clergyman' });
  check(!looked.state.flags.clergyman_seen_through_glass && !looked.state.knows.holmes?.watson_reading_clergyman,
    'examining the clergyman by eye neither counts as the glass nor commits a reading');

  const t3 = win.go('look at the clergyman through the glass', { verb: 'use', target: 'opera_glass', secondary: 'street_clergyman' });
  check(fired(t3, 'glass_on_clergyman') && fired(t3, 'clergyman_through_glass') && win.flag('clergyman_seen_through_glass'),
    'turn 3: the glass on the clergyman finds the greasepaint');
  check(isDeepStrictEqual(win.s.objects.opera_glass.placement, { kind: 'inventory' }), 'turn 3: Watson now holds the glass');

  const t4 = win.tell('watson_reading_soldier');
  check(fired(t4, 'soldier_verdict') && win.flag('soldier_read') && clue(t4, 'clue_old_soldier'), 'turn 4: telling Holmes the soldier commits; The Old Soldier enters the diary');
  check(win.told('holmes_soldier_grandchild'), 'turn 4: the grandchild is on record as Holmes\'s');
  check(win.log.some(e => e.kind === 'RuleFired' && e.rule === 'lamplighter') && fired(t4, 'lamplighter'), 'turn 4: the clock passes 7:45 and the lamplighter goes by');
  check(!win.topic('watson_reading_soldier', 'tell') && win.topic('watson_reading_soldier', 'ask'), 'after the verdict, the soldier is something to ask Holmes about, not to tell');

  const asked = win.probe('ask holmes about the grandchild', { verb: 'ask', person: 'holmes', topic: 'holmes_soldier_grandchild' });
  check(!fired(asked.events, 'closing'), 'a question after a verdict is answered and never sets off the closing');

  const t5 = win.tell('watson_reading_clergyman');
  check(fired(t5, 'clergyman_verdict_won') && !fired(t5, 'clergyman_verdict_lost') && win.flag('wager_won'), 'turn 5: the clergyman read through the glass wins the wager');
  check(clue(t5, 'clue_actor_found') && !win.s.clues.includes('clue_actor_shown'), 'turn 5: one Actor Clue, the found one');
  check(!fired(t5, 'closing'), 'turn 5: the second verdict is a question, so the closing does not fire');

  const t6 = win.examine('crowd');
  check(fired(t6, 'closing') && clue(t6, 'clue_what_asks_to_be_seen') && win.told('holmes_invisible_in_a_crowd'), 'turn 6: the next action is the closing; What Asks to Be Seen enters the diary');
  check(!fired(t6, 'evening_ends_on_action') && !win.s.ended, 'turn 6: the closing\'s turn does not also play the coda');

  const t7 = win.examine('open_window');
  check(fired(t7, 'evening_ends_on_action') && fired(t7, 'coda_won') && !fired(t7, 'coda_lost'), 'turn 7: the coda, won');
  check(has(t7, e => e.kind === 'GameEnded' && e.ending === 'prologue_end') && win.s.ended === 'prologue_end', 'turn 7: the prologue ends the game');
  check(win.s.clock <= 1200, `the shortest win ends by 8:00 PM (${win.s.clock})`);
  check(win.replays(), 'the win replays exactly');
}

// ── The loss (score §6, shortest loss) ───────────────────────────────────────
section('the loss: no glass');
{
  const r = new Run(11);
  r.talk(); r.talk();
  r.tell('watson_reading_soldier');
  const t = r.tell('watson_reading_clergyman');
  check(fired(t, 'clergyman_verdict_lost') && !fired(t, 'clergyman_verdict_won') && !r.flag('wager_won'), 'the clergyman read by eye loses the wager');
  check(clue(t, 'clue_actor_shown') && !r.s.clues.includes('clue_actor_found'), 'one Actor Clue, the shown one');
  check(isDeepStrictEqual(r.s.objects.opera_glass.placement, { kind: 'location', location: 'baker_street' }), 'Holmes puts the glass back on the mantel');
  check(r.told('holmes_actor_reading') && r.told('actor_shown_through_glass'), 'the actor and the rebuke are on record as Holmes\'s');
  r.examine('crowd');
  check(r.flag('closing_heard'), 'the closing');
  const coda = r.idle();
  check(fired(coda, 'evening_ends_on_tick') && fired(coda, 'coda_lost') && cue(coda, 'pages_riffle'), 'an idle Tick after the closing plays the coda, lost, with the riffled pages');
  check(r.s.ended === 'prologue_end', 'the prologue ends the game');
  check(r.replays(), 'the loss replays exactly');
}

// ── The other routes (score §5) ──────────────────────────────────────────────
section('the other routes');
{
  const r = new Run(3);
  const d = r.idle();
  check(fired(d, 'holmes_turns_on_tick') && fired(d, 'demonstration'), 'an idle Tick sets off the demonstration');
  const w = r.idle();
  check(fired(w, 'wager_on_tick') && fired(w, 'wager'), 'and the next idle Tick, the wager');
  r.go('take the opera glass', { verb: 'take', target: 'opera_glass' });
  const closely = r.examine('street_clergyman');
  check(fired(closely, 'clergyman_examined_with_glass') && r.flag('clergyman_seen_through_glass'), 'examining the clergyman with the glass in hand counts as the glass');
  const crowd1 = r.go('look at the crowd through the glass', { verb: 'use', target: 'opera_glass', secondary: 'crowd' });
  const crowd2 = r.go('look at the crowd through the glass', { verb: 'use', target: 'opera_glass', secondary: 'crowd' });
  check(fired(crowd1, 'glass_on_crowd') && fired(crowd2, 'glass_on_crowd'), 'the glass on the crowd always answers (it repeats)');
  const soldier = r.go('look at the old fellow through the glass', { verb: 'use', target: 'opera_glass', secondary: 'street_soldier' });
  check(fired(soldier, 'glass_on_soldier') && !r.flag('soldier_read'), 'the glass on the soldier adds the ribbon and commits nothing');
  const ded = r.go('i deduce the clergyman is an actor', { verb: 'deduce', facts: ['watson_reading_clergyman'] });
  check(fired(ded, 'deduce_clergyman') && fired(ded, 'clergyman_verdict_won'), 'a deduction about the clergyman commits the reading');
  check(!fired(ded, 'closing'), 'and does not set off the closing');
  check(r.replays(), 'this route replays exactly');
}

// ── Validation and the prover ────────────────────────────────────────────────
section('validation and the prover');
{
  const v = validateStory(raw);
  check(v.ok, 'the Story validates', v.issues.filter(i => i.level === 'fail').map(i => `${i.at}: ${i.message}`).join('; '));
  check(v.issues.length === 0, 'with no warnings', v.issues.map(i => `${i.at}: ${i.message}`).join('; '));
  const p = prove(story);
  const want = ['clue_old_soldier', 'clue_actor_found', 'clue_actor_shown', 'clue_what_asks_to_be_seen', 'prologue_end'];
  for (const id of want) {
    const line = p.lines.find(l => l.goal.id === id);
    check(line?.reachable === true, `prover: ${id} REACHABLE`, line ? 'UNREACHABLE' : 'not a goal');
  }
  check(!p.capped && p.errors.length === 0, 'prover: the search is not capped and the engine never threw', p.capped ? 'capped' : formatProof(p));
  check(p.early.length === 0, 'prover: no Fact reaches the player before its act');
}

done();
