/**
 * scripts/qa-whitechapel.ts — the golden scenario for the Whitechapel Story.
 *
 * Act 0, "The Wager", transcribed from its frozen mechanical score
 * (docs/act0-mechanical-score.md, §11), never improvised: every step asserts
 * what a score row promises, the negatives included (not on the same turn,
 * not before, not twice). It drives the real engine with explicit Selections,
 * the way qa-stress does; the selection model is not in the loop. Whether a
 * player's words reach these Selections is the score's verb-coverage table
 * and the playtest.
 *
 * Run: npx tsx scripts/qa-whitechapel.ts     Exit 1 on any FAIL.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Story, validateStory, type EventPayload, type NarrationMode, type Selection } from '../packages/schema';
import { loadStoryDir } from '../packages/schema/load';
import {
  buildNarrationContext, candidates, playerView, replay, resolveTurn, startInvestigation, tick, type State,
} from '../packages/engine';
import { fixedRng } from '../packages/engine/rng';

let fails = 0;
const pass = (l: string) => console.log(`[PASS] ${l}`);
const fail = (l: string, d?: string) => { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; };
const check = (cond: boolean, label: string, detail?: string) => (cond ? pass(label) : fail(label, detail));
const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}`);

const DIR = join('stories', 'whitechapel_1888');
if (!existsSync(join(DIR, 'story.json'))) {
  fail('the Whitechapel Story exists', `no ${DIR}/story.json: Act 0 is not authored yet`);
  console.log(`\n${fails} FAILURE(S)`);
  process.exit(1);
}
const raw = loadStoryDir(DIR);
const validation = validateStory(raw);
check(validation.ok, 'the Story validates', validation.issues.filter(i => i.level === 'fail').map(i => `${i.at}: ${i.message}`).join('; '));
const story = Story.parse(raw);

// ── Harness ──────────────────────────────────────────────────────────────────
type Sel = Omit<Extract<Selection, { kind: 'intent' }>, 'kind'>;
const fired = (es: EventPayload[], rule: string) => es.some(e => e.kind === 'RuleFired' && e.rule === rule);
const firedAny = (es: EventPayload[]) => es.filter(e => e.kind === 'RuleFired').map(e => (e as { rule: string }).rule);
const has = (es: EventPayload[], pred: (e: EventPayload) => boolean) => es.some(pred);
const disclosed = (es: EventPayload[], fact: string) => has(es, e => e.kind === 'FactDisclosed' && e.fact === fact && e.to === 'player');

/** The server's mode choice (server/turn.ts modeFor), so the budget check sees what the narrator will. */
function modeFor(events: EventPayload[]): NarrationMode {
  if (events.some(e => e.kind === 'InvestigationStarted')) return 'opening';
  if (events.some(e => e.kind === 'FlavourRequested')) return 'flavour';
  const substantive = events.some(e =>
    e.kind === 'ClueDiscovered' || e.kind === 'BeatQueued' || e.kind === 'Moved' || e.kind === 'ActEntered' || e.kind === 'GameEnded'
    || (e.kind === 'FactDisclosed' && e.to === 'player') || (e.kind === 'FactLearned' && e.person === 'player'));
  return substantive ? 'full' : 'compact';
}

class Run {
  s: State;
  log: EventPayload[] = [];
  last: EventPayload[] = [];
  constructor(public seed: number) {
    const o = startInvestigation(story, seed);
    this.s = o.state; this.log.push(...o.events); this.last = o.events;
  }
  go(text: string, sel: Sel): EventPayload[] {
    const r = resolveTurn(story, this.s, { text, selection: { kind: 'intent', ...sel } }, fixedRng([0]));
    return this.absorb(r.events, r.state);
  }
  idle(draw = 0): EventPayload[] {
    const r = tick(story, this.s, 15, fixedRng([draw]));
    return this.absorb(r.events, r.state);
  }
  private absorb(events: EventPayload[], state: State) { this.log.push(...events); this.s = state; this.last = events; return events; }
  talk() { return this.go('talk to holmes', { verb: 'talk', person: 'holmes' }); }
  ask(topic?: string) { return this.go(`ask holmes about ${topic ?? 'something'}`, { verb: 'ask', person: 'holmes', ...(topic ? { topic } : {}) }); }
  examine(target: string) { return this.go(`examine ${target}`, { verb: 'examine', target }); }
  use(target: string, secondary: string) { return this.go(`use ${target} on ${secondary}`, { verb: 'use', target, secondary }); }
  look() { return this.go('look', { verb: 'look' }); }
  cand() { return candidates(story, this.s); }
  objectsHere() { return this.cand().objects.map(o => o.id); }
  askable(fact: string) { return this.cand().topics.some(t => t.person === 'holmes' && t.fact === fact && t.direction === 'ask'); }
  carried(id: string) { return this.s.objects[id].placement.kind === 'inventory'; }
  /** Words of the beats and Facts this turn's narration must carry, against its mode's budget. */
  budget(): { words: number; budget: number; mode: NarrationMode } {
    const mode = modeFor(this.last);
    const ctx = buildNarrationContext(story, this.s, this.last, mode);
    const text = [...ctx.beats, ...ctx.facts.map(f => f.voice ?? f.statement)].join(' ');
    return { words: text.split(/\s+/).filter(Boolean).length, budget: ctx.wordBudget, mode };
  }
  replays() { return isDeepStrictEqual(replay(story, this.log, this.seed), this.s); }
}
const withinBudget = (r: Run, label: string) => {
  const b = r.budget();
  check(b.words <= b.budget, `budget: ${label} carries ${b.words} words of beats in a ${b.mode} turn of ${b.budget}`, `${b.words} > ${b.budget}`);
};

// ── 0. The Story's frame ─────────────────────────────────────────────────────
section('frame');
check(story.id === 'whitechapel_1888' && story.acts.length === 1 && story.acts[0].name === 'The Wager', 'one act: 0, The Wager');
check(story.acts[0].startClockMinutes === 1170 && story.acts[0].anchorLocation === 'baker_street', 'Act 0 opens at 7:30 PM in Baker Street');
check(story.persons.map(p => p.id).join() === 'holmes', 'the cast is Holmes alone (Watson is the narrator)');
check(story.narrator?.name === 'Watson', 'the narrator is Watson');
check(story.endings.map(e => e.id).sort().join() === 'wager_lost,wager_won', 'two endings: wager_won, wager_lost');
check(story.locations.find(l => l.id === 'baker_street')?.exits.length === 0, 'Baker Street has no exits');

// ── 1. Lost, the soldier first ───────────────────────────────────────────────
section('the opening');
const lost = new Run(1);
{
  const r = lost;
  check(r.s.act === 0 && r.s.location === 'baker_street' && r.s.clock === 1170, 'opening: act 0, Baker Street, 7:30 PM');
  check(firedAny(r.last).length === 0, 'the opening fires no Rule (no enter or arrival Rule in Act 0)', firedAny(r.last).join());
  check(!r.objectsHere().includes('opera_glass'), 'the glass is in Holmes\'s hand: not in the Candidate Set');
  check(!r.objectsHere().includes('street_soldier') && !r.objectsHere().includes('street_clergyman'), 'the two figures are hidden before the wager');
  check(r.askable('holmes_holiday_dull') && r.askable('holmes_opera_glass'), 'Holmes can be asked about the holiday and his glass from the start');
  check(!r.askable('holmes_heath_road_dust'), 'not about the Heath road before the demonstration');
  withinBudget(r, 'the opening');
}
section('the demonstration');
{
  const r = lost;
  const es = r.talk();
  check(fired(es, 'demonstration') && fired(es, 'demonstration_on_talk'), 'talking to Holmes starts the demonstration');
  check(!fired(es, 'wager_on_talk') && !fired(es, 'wager'), 'and not the wager on the same turn (R1 precedes R4)');
  check(has(es, e => e.kind === 'CuePlayed' && e.sound === 'glass_down'), 'the glass is set down, with its cue');
  check(r.objectsHere().includes('opera_glass') && r.s.objects.opera_glass.placement.kind === 'location', 'the glass now lies in the room, takeable');
  check(r.askable('holmes_heath_road_dust') && r.askable('holmes_victualler_deduction') && r.askable('holmes_observation_vs_inference'), 'the demonstration\'s three Facts are askable');
  withinBudget(r, 'the demonstration (talk)');
  const q = r.ask('holmes_heath_road_dust');
  check(disclosed(q, 'holmes_heath_road_dust') && !fired(q, 'wager'), 'a follow-up question is answered, and does not start the wager');
}
section('the wager');
{
  const r = lost;
  const es = r.talk();
  check(fired(es, 'wager') && fired(es, 'wager_on_talk'), 'talking to Holmes again strikes the wager');
  check(!fired(es, 'wager_prompt'), 'and is not also prompted on the same turn (R7 precedes R1)');
  check(r.objectsHere().includes('street_soldier') && r.objectsHere().includes('street_clergyman'), 'both figures are now in the Candidate Set');
  check(r.cand().objects.find(o => o.id === 'street_soldier')?.name === 'the old man by the cab rank', 'the soldier is shown as "the old man by the cab rank"');
  check(r.askable('holmes_the_wager') && r.askable('holmes_violin_stake') && r.askable('holmes_monograph'), 'the terms, the violin and the monograph are askable');
  check(r.s.persons.holmes.disposition === 'warm', 'Holmes warms once the wager is struck');
  withinBudget(r, 'the wager');
  check(fired(r.talk(), 'wager_prompt'), 'talking again with a reading outstanding: Holmes prompts');
}
section('the soldier, read rightly');
{
  const r = lost;
  check(!r.askable('holmes_soldier_grandchild'), 'before Watson has looked at him, the soldier is not a topic');
  const early = r.ask();
  check(!has(early, e => e.kind === 'FactDisclosed') && !fired(early, 'soldier_reading'), 'asking Holmes about him then commits nothing: a deflection');
  const look = r.examine('street_soldier');
  check(fired(look, 'soldier_looked_at') && !fired(look, 'soldier_reading'), 'examining him describes; it reads nothing');
  check(r.askable('holmes_soldier_grandchild'), 'now Holmes will hear the reading');
  const read = r.ask('holmes_soldier_grandchild');
  check(fired(read, 'soldier_reading') && r.s.flags.soldier_read === true, 'asking Holmes about him commits the reading');
  check(has(read, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_old_soldier'), 'the diary gains The Old Soldier');
  check(!fired(read, 'verdict_after_soldier'), 'one reading is no verdict');
  check(r.askable('holmes_watsons_service'), 'Holmes can now be asked about Watson\'s service');
  withinBudget(r, 'the soldier\'s reading');
}
section('the clergyman, read wrongly: the wager lost');
{
  const r = lost;
  r.examine('street_clergyman');
  const read = r.ask('holmes_actor_reading');
  check(fired(read, 'clergyman_reading_wrong') && !fired(read, 'clergyman_reading_right'), 'without the glass, the wrong reading');
  check(fired(read, 'verdict_after_clergyman') && fired(read, 'wager_lost') && !fired(read, 'wager_won'), 'the second reading brings the verdict: lost');
  check(has(read, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_actor') && has(read, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_wager_lost'), 'the diary gains The Actor and The Wager Lost');
  check(!fired(read, 'closing'), 'the closing does not ride on the verdict');
  withinBudget(r, 'the wrong reading and the verdict');
  const followUp = r.ask('holmes_actor_reading');
  check(!fired(followUp, 'closing') && !fired(followUp, 'closing_on_action'), 'a follow-up question after the verdict is answered, not taken over by the closing');
  const after = r.use('opera_glass', 'street_clergyman');
  check(!fired(after, 'clergyman_through_glass') && !fired(after, 'greasepaint'), 'after the verdict the glass no longer reads anyone');
}
section('the closing and the ending');
{
  const r = lost;
  // The use above was an action after the verdict: it closed.
  check(r.s.flags.closing_begun === true && r.s.knows.player.holmes_invisible_in_a_crowd === true, 'the first non-question action after the verdict brought the closing');
  check(fired(r.last, 'closing') && !fired(r.last, 'ending_lost'), 'and the ending did not ride on it');
  check(has(r.last, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_what_asks'), 'the diary gains What Asks to Be Seen');
  withinBudget(r, 'the closing');
  const end = r.talk();
  check(fired(end, 'ending_lost') && r.s.ended === 'wager_lost', 'the next action ends the game: The Wager Lost');
  withinBudget(r, 'the ending');
  check(has(r.look(), e => e.kind === 'IntentRejected'), 'nothing after the end');
  const diary = playerView(story, r.log).diary.clues.map(c => c.id).sort().join();
  check(diary === 'clue_actor,clue_old_soldier,clue_wager_lost,clue_what_asks', 'the diary holds four Clues', diary);
  check(r.replays(), 'the lost game replays exactly');
}

// ── 2. Won, the clergyman first, through the glass ───────────────────────────
section('the clergyman through the glass: the wager won');
{
  const r = new Run(2);
  r.talk(); r.talk();
  const glass = r.use('opera_glass', 'street_clergyman');
  check(fired(glass, 'clergyman_through_glass') && fired(glass, 'greasepaint'), 'using the glass on the clergyman shows the greasepaint');
  check(r.carried('opera_glass'), 'and puts the glass in Watson\'s hand');
  check(r.askable('holmes_actor_reading'), 'Holmes will now hear the clergyman\'s reading');
  withinBudget(r, 'the greasepaint');
  const read = r.ask('holmes_actor_reading');
  check(fired(read, 'clergyman_reading_right') && !fired(read, 'clergyman_reading_wrong') && !fired(read, 'wager_won'), 'the right reading; no verdict yet');
  withinBudget(r, 'the right reading');
  const look = r.examine('street_soldier');
  check(fired(look, 'soldier_examined_with_glass') && fired(look, 'regimental_button'), 'examining the soldier while holding the glass looks through it');
  withinBudget(r, 'the soldier through the glass');
  const second = r.ask('holmes_soldier_grandchild');
  check(fired(second, 'verdict_after_soldier') && fired(second, 'wager_won') && has(second, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_wager_won'), 'the verdict, on the soldier: won');
  withinBudget(r, 'the soldier\'s reading and the verdict');
  const close = r.talk();
  check(fired(close, 'closing') && !fired(close, 'wager_prompt'), 'talking to Holmes after the verdict brings the closing, not the prompt');
  const end = r.idle();
  check(fired(end, 'ending_won_on_idle') && r.s.ended === 'wager_won', 'a Tick ends it: The Wager Won');
  check(r.replays(), 'the won game replays exactly');
}
section('the other ways through the glass');
{
  const a = new Run(3); a.talk(); a.talk();
  check(fired(a.use('street_clergyman', 'opera_glass'), 'clergyman_through_glass_reversed') && a.s.flags.greasepaint_seen, 'the glass named second works too');
  const b = new Run(4); b.talk(); b.talk();
  b.go('take the glass', { verb: 'take', target: 'opera_glass' });
  check(b.carried('opera_glass') && fired(b.examine('street_clergyman'), 'clergyman_examined_with_glass') && b.s.flags.greasepaint_seen, 'holding the glass, examining the clergyman looks through it');
  const c = new Run(5); c.talk(); c.talk();
  const plain = c.examine('street_clergyman');
  check(!fired(plain, 'clergyman_examined_with_glass') && !c.s.flags.greasepaint_seen, 'without it, examining him is only a look');
  check(fired(c.go('combine', { verb: 'combine', target: 'opera_glass', secondary: 'street_clergyman' }), 'clergyman_through_glass'), '"combine" the glass with him counts as using it');
  const d = new Run(6); d.talk();
  check(fired(d.use('opera_glass', 'crowd'), 'glass_on_street') && d.carried('opera_glass'), 'the glass on the crowd gives texture, never "nothing happens"');
  check(fired(d.use('opera_glass', 'holmes_violin'), 'glass_on_room'), 'the glass on the violin too');
}

// ── 3. Idle: the wager, the closing and the ending by Ticks ──────────────────
section('idle');
{
  const r = new Run(7);
  check(firedAny(r.idle()).length === 0, 'before the demonstration an idle Tick is quiet');
  r.talk();
  const wager = r.idle();
  check(fired(wager, 'wager_on_idle') && fired(wager, 'wager'), 'unanswered, Holmes proposes the wager anyway');
  check(fired(r.idle(), 'barrel_organ'), 'during the wager an idle Tick draws the barrel-organ');
  check(fired(r.go('deduce', { verb: 'deduce', facts: [] }), 'reading_as_deduction'), 'a reading typed as a conclusion gets Holmes\'s prompt');
  r.examine('street_soldier'); r.ask('holmes_soldier_grandchild');
  r.examine('street_clergyman'); r.ask('holmes_actor_reading');
  check(r.s.flags.verdict_given === true, 'the verdict is given');
  const close = r.idle();
  check(fired(close, 'closing_on_idle') && fired(close, 'closing') && !fired(close, 'barrel_organ'), 'an idle Tick after the verdict closes, and never draws the barrel-organ');
  const end = r.idle();
  check(fired(end, 'ending_lost_on_idle') && r.s.ended === 'wager_lost', 'the next idle Tick ends it');
  check(r.log.filter(e => e.kind === 'RuleFired' && e.rule === 'lamplighter').length === 1, 'the lamplighter passed exactly once on the way');
  check(r.replays(), 'the idle game replays exactly');
}

// ── 4. One more negative: the demonstration by the window ───────────────────
section('the demonstration by the window');
{
  const r = new Run(8);
  const es = r.examine('open_window');
  check(fired(es, 'demonstration_on_street') && fired(es, 'demonstration') && !fired(es, 'wager'), 'examining the window starts the demonstration, not the wager');
  withinBudget(r, 'the demonstration (window)');
  check(fired(r.examine('crowd'), 'wager_on_street'), 'examining the street again strikes the wager');
}

console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
