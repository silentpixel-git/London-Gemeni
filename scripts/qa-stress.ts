/**
 * scripts/qa-stress.ts — the new engine driven through the stress Story
 * (packages/schema/fixtures/stress: "The Saltmarsh Light").
 *
 * Where qa-core proves each mechanic once on a three-room toy, this proves the
 * mechanics that only show up in combination: a companion who follows through
 * a whole act, a rumor that matures across a period boundary, a room that is
 * closed at some hours, a clock Rule that moves a person to meet a proximity
 * Rule, a flag-locked exit opened by a social puzzle, a lockExit/unlockExit
 * pair, a document introduction, per-person fact voices, three endings, and
 * exact replay of every run.
 *
 * Run: npx tsx scripts/qa-stress.ts     Exit 1 on any FAIL.
 */
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Effect, Story, Trigger, inCandidateSet, validateStory, type EventPayload, type Selection } from '../packages/schema';
import { gateNarration } from '../packages/ai/gate';
import { loadStoryDir } from '../packages/schema/load';
import {
  buildNarrationContext, candidates, currentPeriod, exitLock, personLocation, personsPresent,
  playerView, replay, resolveTurn, startInvestigation, tick, type State,
} from '../packages/engine';
import { fixedRng } from '../packages/engine/rng';

const rawStory = loadStoryDir(join('packages', 'schema', 'fixtures', 'stress')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const story = Story.parse(rawStory);
/** A copy of the fixture with authored changes, for the pinned-semantics probes (section 6). */
const variant = (mutate: (raw: any) => void) => { const raw = structuredClone(rawStory); mutate(raw); return raw; }; // eslint-disable-line @typescript-eslint/no-explicit-any

let fails = 0;
const pass = (l: string) => console.log(`[PASS] ${l}`);
const fail = (l: string, d?: string) => { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; };
const check = (cond: boolean, label: string, detail?: string) => (cond ? pass(label) : fail(label, detail));
const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}`);

// ── Harness ──────────────────────────────────────────────────────────────────
type Sel = Omit<Extract<Selection, { kind: 'intent' }>, 'kind'>;
const has = (es: EventPayload[], pred: (e: EventPayload) => boolean) => es.some(pred);
const fired = (es: EventPayload[], rule: string) => has(es, e => e.kind === 'RuleFired' && e.rule === rule);
const everFired = new Set<string>();
const everKinds = new Set<string>();

/** One Investigation: its State and the Event log that must replay to it. Probes never touch either. */
class Run {
  s: State;
  log: EventPayload[] = [];
  /** Opens as the server opens: the opening turn and the Rules it sets off. */
  constructor(public name: string, public seed: number, public story: Story = Run.base) {
    const o = startInvestigation(this.story, seed);
    this.s = o.state; this.absorb(o.events, o.state);
  }
  static base: Story;

  go(text: string, sel: Sel, draw = 0): EventPayload[] {
    const r = resolveTurn(this.story, this.s, { text, selection: { kind: 'intent', ...sel } }, fixedRng([draw]));
    return this.absorb(r.events, r.state);
  }
  idle(minutes: number, draw = 0): EventPayload[] {
    const r = tick(this.story, this.s, minutes, fixedRng([draw]));
    return this.absorb(r.events, r.state);
  }
  private absorb(events: EventPayload[], state: State) {
    this.log.push(...events); this.s = state;
    for (const e of events) { everKinds.add(e.kind); if (e.kind === 'RuleFired') everFired.add(e.rule); }
    return events;
  }
  move(exit: string) { return this.go(`go ${exit}`, { verb: 'move', exit }); }
  ask(person: string, topic: string) { return this.go(`ask ${person} about ${topic}`, { verb: 'ask', person, topic }); }
  wait() { return this.go('wait', { verb: 'wait' }); }
  look() { return this.go('look', { verb: 'look' }); }
  where(id: string) { return this.s.objects[id].placement; }
  present() { return personsPresent(this.story, this.s); }
  cand() { return candidates(this.story, this.s); }
  /** A turn on a copy of the state: observed, never logged. */
  probe(sel: Sel, draw = 0) { return resolveTurn(this.story, this.s, { text: 'probe', selection: { kind: 'intent', ...sel } }, fixedRng([draw])); }
  /** Replaying the log from scratch must land on exactly this State. */
  replays(): boolean { return isDeepStrictEqual(replay(this.story, this.log, this.seed), this.s); }
}
Run.base = story;

const ASKABLE = (r: Run, person: string, fact: string, dir: 'ask' | 'tell') =>
  r.cand().topics.some(t => t.person === person && t.fact === fact && t.direction === dir);

/** Shortest honest route into act 1: ines (who knows about the barrels) is asked, then the log is read. */
function toAct1(r: Run) {
  r.move('to_kitchen');
  r.ask('ines', 'cargo_was_barrels');
  r.go('read the log', { verb: 'read', target: 'keeper_log' });
}
/** Through act 1 into the lamp room: chest, key, store, cask, tell the cook, hatch, wait for Orrin, wick promise. */
function toAct2(r: Run) {
  toAct1(r);
  r.move('to_jetty'); r.ask('orrin', 'cargo_was_barrels');
  r.go('open chest', { verb: 'open', target: 'tackle_chest' });
  r.go('take key', { verb: 'take', target: 'store_key' });
  r.move('to_kitchen'); r.move('to_store');
  r.go('read cask', { verb: 'read', target: 'oil_cask' });
  r.move('to_kitchen'); r.ask('maud', 'oil_watered');
  r.move('to_tower'); r.ask('dov', 'hatch_sticks');
  r.go('grease hinge', { verb: 'use', target: 'hatch_hinge' });
  r.move('to_kitchen');
  let guard = 0; while (r.s.clock < 960 && guard++ < 20) r.wait();
  r.move('to_jetty'); r.move('to_loft'); r.look();
  r.move('to_jetty'); r.move('to_kitchen'); r.move('to_tower'); r.move('to_lamp_room');
}

// ── 0. The fixture itself ────────────────────────────────────────────────────
section('fixture shape');
{
  check(story.acts.length === 3 && story.acts.map(a => a.id).join() === '0,1,2', 'three acts, ids 0..2');
  check(new Set(story.acts.map(a => a.anchorLocation)).size === 3, 'three different anchor locations');
  check(new Set(story.acts.map(a => a.weather)).size >= 2, 'at least two weather states across the acts');
  check(story.locations.length >= 6 && story.persons.length >= 4 && story.facts.length >= 8 && story.clues.length >= 4 && story.endings.length >= 3 && story.rules.length >= 25,
    'size floor: 6 locations, 4 persons, 8 facts, 4 clues, 3 endings, 25 rules');
  const trig = new Set(story.rules.map(r => r.trigger.kind));
  const eff = new Set(story.rules.flatMap(r => r.effects.map(e => e.kind)));
  const missT = Trigger.options.map((o: any) => o.shape.kind.value as string).filter(k => !trig.has(k as never));
  const missE = Effect.options.map((o: any) => o.shape.kind.value as string).filter(k => !eff.has(k as never));
  check(missT.length === 0, 'every Trigger kind appears in some Rule', missT.join(', '));
  check(missE.length === 0, 'every Effect kind appears in some Rule', missE.join(', '));
}

// ── 1. Act 0: companion absent, closed room, rumor, voices ───────────────────
section('act 0 / closed room / rumor / voice');
const main = new Run('main', 11);
{
  const r = main;
  check(r.s.act === 0 && r.s.location === 'jetty' && r.s.clock === 660 && currentPeriod(story, r.s) === 'morning', 'opening: act 0, jetty, 11:00 (morning)');
  const absent = () => !r.present().includes('dov') && personLocation(story, r.s, 'dov') === null;
  check(absent(), 'companion absent at the jetty in act 0');

  const closed = r.move('to_loft');
  check(has(closed, e => e.kind === 'MoveBlocked' && e.reason === 'closed' && e.lock === null) && r.s.location === 'jetty', 'morning: the net loft is closed → MoveBlocked{closed}');

  const chestShut = r.probe({ verb: 'open', target: 'tackle_chest' }).events;
  check(has(chestShut, e => e.kind === 'OpenBlocked' && e.lock.kind === 'flag'), 'the tackle chest is flag-locked until Orrin speaks');
  check(!fired(chestShut, 'chest_creaks'), 'an action Rule on "open chest" must not fire when the open was blocked',
    'ENGINE BUG: resolveTurn raises the action Firing for every verb result except IntentRejected, so OpenBlocked / MoveBlocked still fire action Rules');
  check(!r.cand().objects.some(o => o.id === 'store_key'), 'key inside the locked chest is not offered');

  const told = r.ask('orrin', 'cargo_was_barrels');
  check(has(told, e => e.kind === 'FactDisclosed' && e.from === 'orrin' && e.to === 'player' && e.fact === 'cargo_was_barrels'), 'Orrin discloses the barrels fact');
  check(has(told, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_barrels'), 'its clue is found');
  check(fired(told, 'orrin_rumor_to_maud') && !fired(told, 'orrin_unlatches_chest'), 'rumor rule fires; the act-1 chest rule does not');
  check(has(told, e => e.kind === 'GrantScheduled' && e.person === 'maud' && e.fact === 'cargo_was_barrels' && e.maturesAtBoundary === 1), 'rumor to Maud scheduled one boundary out');
  const ctx = buildNarrationContext(story, r.s, told, 'full');
  const orrinVoice = story.facts.find(f => f.id === 'cargo_was_barrels')!.voices!.orrin;
  check(ctx.facts.find(f => f.id === 'cargo_was_barrels')?.voice === orrinVoice, "voices: Orrin's phrasing reaches the narration context on the turn of disclosure");
  check(has(told, e => e.kind === 'FactDisclosed') && ctx.facts.find(f => f.id === 'cargo_was_barrels')?.statement.startsWith('Orrin ferried'), 'the plain statement travels with the voice');

  r.move('to_kitchen');
  check(absent() && r.present().includes('maud') && r.present().includes('ines'), 'kitchen, act 0: Maud and Ines present, companion still absent');
  check(!ASKABLE(r, 'maud', 'cargo_was_barrels', 'ask'), 'before the boundary: Maud cannot be asked about the barrels');
  check(ASKABLE(r, 'maud', 'cargo_was_barrels', 'tell'), 'before the boundary: the player could only tell Maud');
  check(r.cand().persons.find(p => p.id === 'ines')?.name === 'the woman in oilskins', 'Ines is shown by alias before her log is read');
  check(r.s.persons.ines.introduced === false, 'persons.ines.introduced is false');

  r.wait();
  check(r.s.boundaries === 0 && !ASKABLE(r, 'maud', 'cargo_was_barrels', 'ask'), 'one wait, still morning: still no ask entry for Maud');
  const cross = r.wait();
  check(r.s.boundaries === 1 && currentPeriod(story, r.s) === 'afternoon', 'second wait crosses noon into the afternoon');
  check(has(cross, e => e.kind === 'FactLearned' && e.person === 'maud' && e.fact === 'cargo_was_barrels'), 'the grant matures on the boundary');
  check(ASKABLE(r, 'maud', 'cargo_was_barrels', 'ask') && !ASKABLE(r, 'maud', 'cargo_was_barrels', 'tell'), 'after the boundary: Maud can be asked, and no longer told');
  const second = r.ask('maud', 'cargo_was_barrels');
  check(has(second, e => e.kind === 'FactDisclosed' && e.from === 'maud' && e.to === 'player' && e.fact === 'cargo_was_barrels'), 'asking Maud yields FactDisclosed{from: maud}');
  const ctx2 = buildNarrationContext(story, r.s, second, 'full');
  check(ctx2.facts.find(f => f.id === 'cargo_was_barrels')?.voice === story.facts.find(f => f.id === 'cargo_was_barrels')!.voices!.maud, "voices: Maud's own phrasing, not Orrin's");

  // The loft is open in the afternoon.
  r.move('to_jetty');
  const open = r.move('to_loft');
  check(has(open, e => e.kind === 'Moved' && e.to === 'net_loft') && absent(), 'afternoon: the loft opens → Moved; companion still absent');
  check(fired(open, 'loft_first_look') && has(open, e => e.kind === 'CuePlayed' && e.sound === 'foghorn_far'), 'enter rule fires in the loft, and leaving the jetty played the leave cue');
  const out = r.move('to_jetty');
  check(has(out, e => e.kind === 'CuePlayed' && e.sound === 'foghorn_far') === false, 'leaving the loft is silent');
  r.move('to_kitchen');
  const leaveJetty = main.log.filter(e => e.kind === 'CuePlayed' && e.sound === 'foghorn_far').length;
  check(leaveJetty >= 1, 'leave trigger: leaving the jetty played the foghorn cue');

  // ── Document introduction ─────────────────────────────────────────────────
  section('document introduction');
  check(r.cand().persons.find(p => p.id === 'ines')?.name === 'the woman in oilskins', 'still an alias in the kitchen');
  const early = r.log.length;
  const read = r.go('read the log', { verb: 'read', target: 'keeper_log' });
  check(has(read, e => e.kind === 'Read' && e.object === 'keeper_log') && r.s.persons.ines.introduced === true, 'reading the log flips persons.ines.introduced');
  check(r.cand().persons.find(p => p.id === 'ines')?.name === 'Ines Tarrow', 'the candidate name changes to Ines Tarrow');
  check(has(read, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_crane'), 'the log also teaches its fact (clue_crane)');
  check(buildNarrationContext(story, r.s, read, 'full').personsPresent.find(p => p.id === 'ines')?.label === 'Ines Tarrow', 'the narration context labels her by name');
  void early;
  check(fired(read, 'log_read_starts_storm') && has(read, e => e.kind === 'ActEntered' && e.act === 1) && r.s.act === 1, 'barrels known → reading the log enters act 1');
}

// ── 2. Act 1: companion follows everywhere ───────────────────────────────────
section('act 1 / companion');
{
  const r = main;
  const dovHere = () => r.present().includes('dov') && personLocation(story, r.s, 'dov') === r.s.location;
  check(r.s.act === 1 && r.s.location === 'kitchen' && r.s.clock === 840 && story.weathers.find(w => w.id === story.acts[1].weather)!.name === 'Squall', 'act 1: kitchen, 14:00, squall');
  check(dovHere(), 'companion present in the kitchen on entering act 1');
  check(r.s.knows.player.storm_due === true, 'entering the kitchen briefed the player (grantFact to player)');
  check(buildNarrationContext(story, r.s, [], 'full').clock.weather === 'Squall', 'narration context reports the act weather');

  const route: Array<[string, string]> = [];
  const step = (exit: string) => { r.move(exit); route.push([exit, r.s.location]); check(dovHere(), `companion present after moving to ${r.s.location}`); };
  step('to_jetty');
  check(!r.present().includes('ines') && r.present().includes('orrin'), 'jetty: Orrin is here, Ines is not');

  // Orrin, asked again in act 1, unlatches the chest.
  const again = r.ask('orrin', 'cargo_was_barrels');
  check(fired(again, 'orrin_unlatches_chest') && r.s.flags.chest_ok === true && !fired(again, 'orrin_rumor_to_maud'), 'asking Orrin in act 1 sets chest_ok; the once-only rumor does not repeat');
  check(r.s.knows.player.store_key_in_chest === true, 'and grants the player the store-key fact');
  const op = r.go('open chest', { verb: 'open', target: 'tackle_chest' });
  check(has(op, e => e.kind === 'Opened') && fired(op, 'chest_creaks') && has(op, e => e.kind === 'CuePlayed' && e.sound === 'chest_creak'), 'chest opens; the action rule cues its creak');
  check(r.cand().objects.some(o => o.id === 'store_key' && o.where === 'here'), 'the key inside the open chest is now offered');
  r.go('take key', { verb: 'take', target: 'store_key' });
  check(r.where('store_key').kind === 'inventory', 'key carried');
  check(has(r.idle(15), e => e.kind === 'TickResolved' && e.rule === 'tick_gulls'), 'tick at the jetty draws the gull rule');

  step('to_kitchen');
  const store = r.s.objects.store_key;
  check(exitLock(story, r.s, 'kitchen', 'to_store')?.kind === 'key' && store.placement.kind === 'inventory', 'key was found at the jetty; its lock is in the kitchen');
  // ── Timing puzzle ──
  section('timing puzzle');
  check(r.s.clock < 960 && personLocation(story, r.s, 'orrin') === 'jetty' && !r.s.flags.orrin_at_loft, 'before 16:00: Orrin is at the jetty and the proximity flag is unset', `clock ${r.s.clock}, orrin ${personLocation(story, r.s, 'orrin')}, flag ${r.s.flags.orrin_at_loft}`);
  let guard = 0;
  while (r.s.clock < 960 && guard++ < 20) r.wait();
  check(fired(r.log.slice(-60), 'orrin_ducks_into_loft') && personLocation(story, r.s, 'orrin') === 'net_loft', 'the 16:00 clock rule moved Orrin into the loft (movePerson)');
  check(!r.s.flags.orrin_at_loft, 'with the player elsewhere the proximity flag is still unset');
  step('to_jetty');
  check(!r.present().includes('orrin'), 'the jetty is empty of Orrin now');
  const inLoft = r.move('to_loft');
  check(has(inLoft, e => e.kind === 'Moved' && e.to === 'net_loft') && currentPeriod(story, r.s) === 'afternoon', 'the loft is still open (afternoon) → Moved');
  check(dovHere() && r.present().includes('orrin'), 'in the loft with Orrin and the companion');
  check(fired(inLoft, 'orrin_seen_in_loft') && r.s.flags.orrin_at_loft === true, 'proximity fires on arrival: walking in on Orrin sets orrin_at_loft on the move itself');
  check(fired(inLoft, 'orrin_promises_wick') && r.s.flags.wick_promised === true, 'flag trigger cascades in the same turn: wick_promised');
  const look = r.look();
  check(!fired(look, 'dov_remarks') && !has(look, e => e.kind === 'RuleFired'), 'staying together raises no proximity: the next look fires nothing, not even the repeatable dov_remarks');
  step('to_jetty'); step('to_kitchen');
  step('to_store');
  check(r.s.location === 'oil_store', 'carrying the key opens the oil store');
  check(r.where('store_key').kind === 'nowhere' && exitLock(story, r.s, 'kitchen', 'to_store') === null, 'store_door_snaps: takeItem consumed the key, unlockExit removed the lock');
  const cask = r.go('read the cask', { verb: 'read', target: 'oil_cask' });
  check(has(cask, e => e.kind === 'FactLearned' && e.person === 'player' && e.fact === 'oil_watered') && has(cask, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_oil'), 'reading the cask teaches oil_watered and finds its clue');
  step('to_kitchen');
  // The key is gone but the door stays open for the way back.
  check(r.probe({ verb: 'move', exit: 'to_store' }).events.some(e => e.kind === 'Moved'), 'the oil store can be re-entered without the key');

  // ── Flag-locked exit, social puzzle ──
  section('flag-locked exit / social puzzle');
  const locked = r.move('to_tower');
  check(has(locked, e => e.kind === 'MoveBlocked' && e.reason === 'locked' && e.lock?.kind === 'flag') && r.s.location === 'kitchen', 'tower door: MoveBlocked{locked} before the disclosure');
  check(ASKABLE(r, 'maud', 'oil_watered', 'tell'), 'the player can tell Maud about the oil');
  check(!ASKABLE(r, 'ines', 'oil_watered', 'tell') && !ASKABLE(r, 'dov', 'oil_watered', 'tell'), 'nobody else needs telling');
  const tell = r.ask('maud', 'oil_watered');
  check(has(tell, e => e.kind === 'FactDisclosed' && e.from === 'player' && e.to === 'maud' && e.fact === 'oil_watered'), 'telling Maud: FactDisclosed player → maud');
  check(fired(tell, 'maud_unbars_tower') && r.s.flags.tower_unbarred === true, 'disclosed trigger sets tower_unbarred');
  check(r.where('tower_keys').kind === 'person' && (r.where('tower_keys') as { person: string }).person === 'dov', 'moveObject put the ring of keys on Dov');
  step('to_tower');
  check(r.s.location === 'tower_stair', 'tower door: Moved after the disclosure');

  // ── lockExit / unlockExit pair ──
  section('lockExit / unlockExit');
  check(fired(main.log, 'hatch_swells') && exitLock(story, r.s, 'tower_stair', 'to_lamp_room')?.kind === 'key', 'entering the stair locked the hatch (lockExit on an authored-open exit)');
  const stuck = r.move('to_lamp_room');
  check(has(stuck, e => e.kind === 'MoveBlocked' && e.reason === 'locked' && e.lock?.kind === 'key'), 'hatch: MoveBlocked{locked} with a key lock nobody can fetch');
  const early = r.go('grease the hinge', { verb: 'use', target: 'hatch_hinge' });
  check(!fired(early, 'free_hatch') && exitLock(story, r.s, 'tower_stair', 'to_lamp_room') !== null, 'using the hinge before learning the trick does nothing');
  const trick = r.ask('dov', 'hatch_sticks');
  check(fired(trick, 'hatch_trick_learned') && r.s.flags.hatch_trick_known === true, 'learning the trick (from anyone) sets hatch_trick_known');
  const grease = r.go('grease the hinge', { verb: 'use', target: 'hatch_hinge' });
  check(fired(grease, 'free_hatch') && has(grease, e => e.kind === 'ExitLockChanged' && e.lock === null) && exitLock(story, r.s, 'tower_stair', 'to_lamp_room') === null, 'use rule: unlockExit frees the hatch');

  // ── Tick: weights, once-only summon ──
  section('tick rules');
  const eligible = (loc: string) => { const st = { ...r.s, location: loc }; return tick(story, st, 15, fixedRng([0])).events.find(e => e.kind === 'TickResolved'); };
  check((eligible('jetty') as { rule: string | null }).rule === 'tick_gulls', 'jetty: only the gull rule is eligible');
  check((eligible('kitchen') as { rule: string | null }).rule === 'tick_kettle', 'kitchen: only the kettle rule is eligible');
  const summoned = r.idle(15, 0.5);
  check(has(summoned, e => e.kind === 'TickResolved' && e.rule === 'tick_maud_climbs'), 'tower stair: the once-only summon rule is drawn');
  check(r.present().includes('maud') && dovHere(), 'summonPerson brought Maud to the stair; the companion is still there');
  const noMore = r.idle(15, 0.5);
  check(!has(noMore, e => e.kind === 'TickResolved' && e.rule === 'tick_maud_climbs') && has(noMore, e => e.kind === 'TickResolved' && e.rule === null), 'once:true: no second summon (nothing else eligible)');
  r.idle(15, 0.5); // keep the tick log honest: ticks are replayable like any turn

  const up = r.move('to_lamp_room');
  check(has(up, e => e.kind === 'Moved' && e.to === 'lamp_room') && fired(up, 'lamp_room_reached') && has(up, e => e.kind === 'ActEntered' && e.act === 2), 'the freed hatch leads up; entering the lamp room enters act 2');
  check(route.map(x => x[1]).filter((v, i, a) => a.indexOf(v) === i).length >= 3, 'the companion was checked at three or more distinct locations');
}

// ── 3. Act 2: combine, voice, examine, deduce ────────────────────────────────
section('act 2 / combine / deduce');
{
  const r = main;
  check(r.s.act === 2 && r.s.location === 'lamp_room' && r.s.clock === 1140, 'act 2: lamp room, 19:00');
  check(r.present().includes('dov') && !r.present().includes('ines'), 'companion present at the top of the tower; Ines is on the stair');
  check(buildNarrationContext(story, r.s, [], 'full').clock.weather === 'Sea fog', 'weather has changed to fog');
  check(fired(r.log.slice(-40), 'drawer_wick') && r.where('lamp_wick').kind === 'inventory', 'giveItem: the promised wick is in the inventory');
  check(!r.cand().objects.some(o => o.id === 'torn_page'), 'the hidden page is not offered');
  check(r.cand().objects.some(o => o.id === 'dust_sheet'), 'the dust sheet is');

  // Tick weights: three eligible Rules in the lamp room (fog bell, dull lens).
  const draw = (d: number) => (tick(story, r.s, 15, fixedRng([d])).events.find(e => e.kind === 'TickResolved') as { rule: string | null }).rule;
  check(draw(0.1) === 'tick_fog_bell' && draw(0.9) === 'tick_lens_dull', 'weighted draw picks among the fog bell and the dull lens');

  check(has(r.idle(15, 0.9), e => e.kind === 'TickResolved' && e.rule === 'tick_lens_dull'), 'logged tick: the dull lens');
  const comb = r.go('combine wick and can', { verb: 'combine', target: 'lamp_wick', secondary: 'oil_can' });
  check(has(comb, e => e.kind === 'Combined') && fired(comb, 'prime_lamp'), 'combine → prime_lamp (item order does not matter)');
  check(r.cand().objects.some(o => o.id === 'torn_page') && !r.cand().objects.some(o => o.id === 'dust_sheet'), 'the combine revealed the page and hid the dust sheet');
  check(draw(0.9) === 'tick_lamp_hum', 'primed lamp: a third tick Rule joins the draw');

  const exam = r.go('examine the lens', { verb: 'examine', target: 'lamp_lens' });
  check(fired(exam, 'lens_examined') && fired(exam, 'lens_flaw_noted') && r.s.knows.player.lens_is_cracked === true, 'examine → flag → grantFact to the player (same cascade)');
  check(has(exam, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_lens'), 'clue_lens found');
  const polish = r.go('polish the lens', { verb: 'use', target: 'soft_cloth', secondary: 'lamp_lens' });
  check(has(polish, e => e.kind === 'Used' && e.object === 'soft_cloth' && e.on === 'lamp_lens') && fired(polish, 'polish_lens') && r.s.flags.lens_polished === true, 'use … on … matches a secondary-target Rule');
  check(r.probe({ verb: 'use', target: 'soft_cloth' }).events.some(e => e.kind === 'RuleFired' && e.rule === 'polish_lens') === false, 'a plain use of the cloth does not');

  check(has(r.idle(15, 0.9), e => e.kind === 'TickResolved' && e.rule === 'tick_lamp_hum'), 'logged tick: primed lamp, polished lens → the burner hum');
  const page = r.go('read the page', { verb: 'read', target: 'torn_page' });
  check(has(page, e => e.kind === 'FactLearned' && e.fact === 'log_page_torn') && has(page, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_page'), 'reading the page teaches the fact and finds its clue');
  const half = r.go('deduce partly', { verb: 'deduce', facts: ['oil_watered'] });
  check(has(half, e => e.kind === 'Deduced') && !r.s.ended, 'naming only one of the two facts does not end the game');
  const done = r.go('it was the doctored oil', { verb: 'deduce', facts: ['oil_watered', 'log_page_torn'] });
  check(fired(done, 'deduce_saboteur') && r.s.ended === 'lamp_restored', 'two-fact deduction → lamp_restored');
  check(has(done, e => e.kind === 'BeatQueued') === false && buildNarrationContext(story, r.s, done, 'full').beats.some(b => b.includes('lamp room goes very quiet')), 'the ending beat reaches the narration context');
  check(has(r.go('look', { verb: 'look' }), e => e.kind === 'IntentRejected'), 'turns after the end are rejected');
  check(r.replays(), 'main run: replaying the log reproduces the final State exactly');
}

// ── 4. Branches on fresh Investigations ──────────────────────────────────────
section('key given to the cook');
{
  const r = new Run('give', 21);
  toAct1(r);
  r.move('to_jetty'); r.ask('orrin', 'cargo_was_barrels');
  r.go('open chest', { verb: 'open', target: 'tackle_chest' }); r.go('take key', { verb: 'take', target: 'store_key' });
  r.move('to_kitchen');
  const g = r.go('give the key to Maud', { verb: 'give', target: 'store_key', person: 'maud' });
  check(has(g, e => e.kind === 'Given' && e.object === 'store_key' && e.person === 'maud') && fired(g, 'maud_takes_key'), 'give trigger fires on the right item and person');
  check(r.where('store_key').kind === 'nowhere' && r.s.persons.maud.disposition === 'warm', 'takeItem removed the key; setDisposition warmed Maud');
  check(exitLock(story, r.s, 'kitchen', 'to_store') === null && r.move('to_store').some(e => e.kind === 'Moved'), 'unlockExit: the store opens without the key in hand');
  check(r.replays(), 'give branch replays exactly');
}
section('early log read');
{
  const r = new Run('early_log', 22);
  r.move('to_kitchen');
  const es = r.go('read the log', { verb: 'read', target: 'keeper_log' });
  check(r.s.persons.ines.introduced && r.s.act === 0 && !fired(es, 'log_read_starts_storm'), 'the introduction does not depend on the act change (barrels unknown → still act 0)');
  check(r.replays(), 'early-log branch replays exactly');
}
section('proximity at the origin (suspected engine fault)');
{
  // Orrin is at the jetty until 16:00. A rule that fires on proximity to him AND requires
  // location net_loft should not fire while he stands at the jetty and the player walks to the loft.
  const r = new Run('proximity_probe', 23);
  toAct1(r);
  r.move('to_jetty');
  check(r.present().includes('orrin') && personLocation(story, r.s, 'orrin') === 'jetty', 'setup: Orrin and the player are both at the jetty');
  r.move('to_loft');
  check(r.s.location === 'net_loft' && personLocation(story, r.s, 'orrin') === 'jetty', 'setup: the player is now in the loft; Orrin is still at the jetty');
  check(!r.s.flags.orrin_at_loft, 'proximity Rule with when.location=net_loft must not fire when Orrin is NOT in the loft',
    'ENGINE BUG: proximity is computed from presence at the START of the turn but when.location is checked AFTER the move, so walking out of Orrin\'s room into the rule\'s room fires it');
  check(r.replays(), 'proximity-probe branch replays exactly');
}
section('endings on fresh Investigations');
{
  const bad = new Run('bad', 31);
  const b = bad.go('it was the cook', { verb: 'deduce', facts: [], person: 'maud' });
  check(fired(b, 'deduce_cook') && bad.s.ended === 'wrong_accusation', 'suspect-only deduction → wrong_accusation');
  check(bad.replays(), 'bad ending replays exactly');

  const good = new Run('good', 32);
  toAct2(good);
  check(good.s.act === 2 && good.where('lamp_wick').kind === 'inventory', 'fast route reaches act 2 with the wick');
  good.go('combine', { verb: 'combine', target: 'oil_can', secondary: 'lamp_wick' });
  good.go('read page', { verb: 'read', target: 'torn_page' });
  good.go('deduce', { verb: 'deduce', facts: ['oil_watered', 'log_page_torn'] });
  check(good.s.ended === 'lamp_restored', 'good ending on a fresh game');
  check(good.replays(), 'good ending replays exactly');

  const late = new Run('timeout', 33);
  toAct2(late);
  let guard = 0; while (!late.s.ended && guard++ < 20) late.wait();
  check(late.s.ended === 'ship_lost' && late.s.clock >= 1320, 'ten o\'clock in act 2 → ship_lost');
  check(late.s.persons.ines.override === null, 'dismissPerson ran before endGame');
  check(guard <= 8, 'the deadline is a handful of waits away', String(guard));
  check(late.replays(), 'timeout ending replays exactly');
}

// ── 6. Pinned semantics (docs/adr/0005) ──────────────────────────────────────
// Each of the seven decisions, on a variant of the fixture authored here.
const load = (raw: unknown) => Story.parse(raw);
section('pinned 1: the opening counts as entering an act');
{
  const v = load(variant(r => {
    r.rules.push({ id: 'jetty_welcome', trigger: { kind: 'enter', location: 'jetty' }, once: true, effects: [{ kind: 'setFlag', flag: 'welcomed' }] });
    r.rules.push({ id: 'orrin_nods', trigger: { kind: 'proximity', person: 'orrin' }, when: { act: [0] }, once: true, effects: [{ kind: 'setFlag', flag: 'nodded' }] });
  }));
  const r = new Run('opening', 41, v);
  check(fired(r.log, 'jetty_welcome') && r.s.flags.welcomed === true, 'an enter Rule on the opening location fires on the opening turn');
  check(fired(r.log, 'orrin_nods') && r.s.flags.nodded === true, 'a proximity Rule for someone standing there fires on the opening turn');
  check(r.log.every(e => e.kind !== 'TurnReceived'), 'and both before any player turn');
  r.move('to_kitchen');
  check(!fired(r.move('to_jetty'), 'jetty_welcome'), 'once: returning does not fire it again');
  check(r.replays(), 'the opening replays exactly');
}
section('pinned 2: proximity fires on arrival, not every turn');
{
  const r = new Run('arrival', 42);
  const into = r.move('to_kitchen');
  check(fired(into, 'maud_greets'), 'walking into the kitchen: the repeatable maud_greets fires on arrival');
  check(!fired(r.look(), 'maud_greets') && !fired(r.look(), 'maud_greets'), 'and not on the turns the player stays');
  r.move('to_jetty');
  check(fired(r.move('to_kitchen'), 'maud_greets'), 'leaving and coming back is a new arrival');
  check(r.replays(), 'replays exactly');

  const ahead = load(variant(r2 => {
    r2.rules.push({ id: 'meet_ines_starts_act2', trigger: { kind: 'proximity', person: 'ines' }, when: { act: [0] }, once: true, effects: [{ kind: 'advanceAct', act: 2 }] });
  }));
  const a = new Run('arrival_act', 43, ahead);
  const met = a.move('to_kitchen');
  check(fired(met, 'meet_ines_starts_act2') && a.s.act === 2 && a.s.location === 'lamp_room', 'a proximity Rule that enters an act does so on the arrival turn itself');
  check(!a.cand().persons.some(p => p.id === 'ines'), 'so the next command is chosen against the new act, not against someone who is no longer there');

  const sched = load(variant(r2 => {
    r2.persons.find((p: { id: string }) => p.id === 'orrin').schedule['0'] = { default: { kind: 'at', location: 'jetty' }, byPeriod: { afternoon: { kind: 'at', location: 'kitchen' } } };
    r2.rules.push({ id: 'orrin_comes_in', trigger: { kind: 'proximity', person: 'orrin' }, when: { location: ['kitchen'] }, once: false, effects: [{ kind: 'playBeat', beats: ['The boatman stamps in out of the wind.'] }] });
  }));
  const b = new Run('arrival_schedule', 44, sched);
  b.move('to_kitchen');
  let noon: EventPayload[] = []; let guard = 0;
  while (currentPeriod(sched, b.s) === 'morning' && guard++ < 20) noon = b.idle(15);
  check(fired(noon, 'orrin_comes_in') && b.present().includes('orrin'), 'a schedule that brings someone to the player is an arrival, on the Tick that crosses the period');
  check(!fired(b.idle(15), 'orrin_comes_in'), 'the following Tick, with him still there, fires nothing');
  check(b.replays(), 'replays exactly');
}
section('pinned 3: an act boundary is time enough for every rumour');
{
  const r = new Run('rumour_act', 45);
  const told = r.ask('orrin', 'cargo_was_barrels');
  check(has(told, e => e.kind === 'GrantScheduled' && e.person === 'maud'), 'the rumour to Maud is scheduled one period out, in the morning');
  r.move('to_kitchen');
  const entered = r.go('read the log', { verb: 'read', target: 'keeper_log' });
  const at = entered.findIndex(e => e.kind === 'ActEntered');
  check(at >= 0 && entered.findIndex(e => e.kind === 'FactLearned' && e.person === 'maud' && e.fact === 'cargo_was_barrels') > at,
    'entering act 1 delivers it right after ActEntered, though no period boundary was crossed');
  check(r.s.pendingGrants.length === 0 && ASKABLE(r, 'maud', 'cargo_was_barrels', 'ask'), 'the queue is empty and Maud can be asked at once');
  check(r.replays(), 'replays exactly');

  const tickAct = load(variant(r2 => {
    r2.rules.push({ id: 'tick_jump', trigger: { kind: 'tick' }, when: { act: [0], location: ['jetty'] }, once: true, weight: 100, effects: [{ kind: 'advanceAct', act: 1 }] });
  }));
  const t = new Run('tick_act', 46, tickAct);
  t.idle(15, 0.99);
  check(t.s.act === 1 && t.s.clock === tickAct.acts[1].startClockMinutes, 'a Tick that enters an act starts it at the act\'s own clock, with no Tick minutes added');

  const atStart = validateStory(variant(r2 => {
    r2.rules.push({ id: 'bell_at_start', trigger: { kind: 'clock', atMinutes: 840, act: [1] }, once: true, effects: [{ kind: 'cue', sound: 'bell' }] });
  }));
  check(!atStart.ok && atStart.issues.some(i => i.level === 'fail' && i.at === 'rules/bell_at_start/trigger'), 'a clock Rule restricted to an act, at that act\'s start time, fails validation');
  const daily = validateStory(variant(r2 => {
    r2.rules.push({ id: 'daily_chime', trigger: { kind: 'clock', atMinutes: 840 }, once: false, effects: [{ kind: 'cue', sound: 'bell' }] });
  }));
  check(daily.ok && daily.issues.some(i => i.level === 'warn' && i.at === 'rules/daily_chime/trigger'), 'an unrestricted daily Rule at some act\'s start time only warns');
  const overnight = validateStory(variant(r2 => {
    r2.rules.push({ id: 'midnight', trigger: { kind: 'clock', atMinutes: 0, act: [2] }, once: true, effects: [{ kind: 'cue', sound: 'bell' }] });
  }));
  check(overnight.ok && !overnight.issues.some(i => i.at === 'rules/midnight/trigger'), 'an overnight clock Rule (midnight in an evening act) is accepted silently');
}
section('pinned 4: leave Rules judge from the room being left');
{
  const v = load(variant(r2 => {
    r2.rules.unshift({ id: 'enter_kitchen_listed_first', trigger: { kind: 'enter', location: 'kitchen' }, once: false, effects: [{ kind: 'cue', sound: 'door' }] });
    r2.rules.push({ id: 'orrin_calls_after', trigger: { kind: 'leave', location: 'jetty' }, when: { location: ['jetty'], personsPresent: ['orrin'] }, once: false, effects: [{ kind: 'cue', sound: 'shout' }] });
  }));
  const r = new Run('leave', 47, v);
  const out = r.move('to_kitchen');
  check(fired(out, 'orrin_calls_after'), 'when.location and when.personsPresent are judged from the jetty being left');
  const order = out.filter(e => e.kind === 'RuleFired').map(e => (e as { rule: string }).rule);
  check(order.indexOf('jetty_foghorn') < order.indexOf('orrin_calls_after') && order.indexOf('orrin_calls_after') < order.indexOf('enter_kitchen_listed_first')
    && order.indexOf('enter_kitchen_listed_first') < order.indexOf('maud_greets'),
    'firing order is leave, then enter, then arrivals; Story order holds only within each', order.join(','));
  check(r.replays(), 'replays exactly');
}
section('pinned 5: a player can accuse anyone met; examine and use reach people');
{
  const r = new Run('suspects', 48);
  const accuse = (c: ReturnType<Run['cand']>) => inCandidateSet({ kind: 'intent', verb: 'deduce', facts: [], person: 'maud' }, c);
  check(JSON.stringify(r.cand().suspects.map(p => p.id)) === '["orrin"]', 'at the opening the only suspect is whoever stands there');
  check(!accuse(r.cand()), 'Maud, not yet met, cannot be accused');
  r.move('to_kitchen'); r.move('to_jetty');
  check(r.cand().suspects.some(p => p.id === 'maud') && !r.present().includes('maud') && accuse(r.cand()), 'once met, Maud can be accused from the jetty');
  check(r.cand().suspects.find(p => p.id === 'ines')?.name === 'the woman in oilskins', 'suspects carry the label the player knows them by');
  check(inCandidateSet({ kind: 'intent', verb: 'examine', target: 'orrin' }, r.cand()), 'examine accepts a person present');
  check(inCandidateSet({ kind: 'intent', verb: 'use', target: 'tackle_chest', secondary: 'orrin' }, r.cand()), 'use … on accepts a person present');
  check(!inCandidateSet({ kind: 'intent', verb: 'take', target: 'orrin' }, r.cand()) && !inCandidateSet({ kind: 'intent', verb: 'examine', target: 'maud' }, r.cand()),
    'but only for those verbs, and only someone present');
  const accused = r.go('it was the woman in oilskins', { verb: 'deduce', facts: [], person: 'ines' });
  const ctx = buildNarrationContext(story, r.s, accused, 'compact');
  check(!fired(accused, 'deduce_cook') && JSON.stringify(ctx.personsNamed) === '[{"id":"ines","label":"the woman in oilskins"}]',
    'an absent suspect reaches the narrator by the label the player knows, not as a bare id', JSON.stringify(ctx.personsNamed));
  check(!gateNarration(ctx, { prose: 'You name her. Far off in the kitchen, Tarrow would not have flinched.', observations: [] }).ok,
    'her surname, which no id carries, is still an invention to the gate (an id like "ines" itself still licenses a first name: review finding H8)');
  const diary = playerView(story, r.log).diary.persons.map(p => p.id).sort().join();
  check(diary === r.cand().suspects.map(p => p.id).sort().join(), 'the diary\'s people met are exactly the suspects', diary);
  check(r.replays(), 'replays exactly');
}
section('pinned 6 and 7: visibleFromAct gates speech; knownBy player is honoured');
{
  const v = load(variant(r2 => {
    r2.facts.push({ id: 'relief_overdue', statement: 'The relief boat was due three days ago.', knownBy: ['player'], visibleFromAct: 0, topics: ['the relief boat'] });
    r2.clues.push({ id: 'clue_relief', name: 'Overdue', fact: 'relief_overdue', summary: 'The relief boat is three days late.' });
  }));
  const r = new Run('known_by_player', 49, v);
  check(r.s.knows.player.relief_overdue === true && r.cand().knownFacts.some(f => f.id === 'relief_overdue'), 'a Fact knownBy player is known from the start, and may be named in a deduction');
  check(has(r.log, e => e.kind === 'ClueDiscovered' && e.clue === 'clue_relief') && r.log.every(e => e.kind !== 'TurnReceived'), 'its Clue is found on the opening turn');
  check(ASKABLE(r, 'orrin', 'relief_overdue', 'tell'), 'and the player can tell it to someone who does not know it');
  check(r.replays(), 'replays exactly');

  const early = new Run('early_learning', 50);
  early.move('to_kitchen');
  early.go('read the log', { verb: 'read', target: 'keeper_log' });
  check(early.s.act === 0 && early.s.knows.player.crane_found_at_lamp === true, 'reading a document teaches its Fact before the Fact\'s visibleFromAct (the prover reports it as EARLY)');
  check(!ASKABLE(early, 'maud', 'crane_found_at_lamp', 'ask'), 'but nobody tells the player that Fact before its act');
}

// ── 5. Coverage ──────────────────────────────────────────────────────────────
section('coverage');
{
  const never = story.rules.map(r => r.id).filter(id => !everFired.has(id));
  check(never.length === 0, 'every Rule fired at least once across the runs', never.join(', '));
  const wanted = ['ExitLockChanged', 'PersonMoved', 'GrantScheduled', 'CuePlayed', 'BeatQueued', 'ObjectPlaced', 'DispositionChanged', 'ActEntered', 'GameEnded', 'ClueDiscovered', 'TickResolved'];
  const missing = wanted.filter(k => !everKinds.has(k));
  check(missing.length === 0, 'the Event kinds each Effect produces were all seen', missing.join(', '));
}

console.log(`\n${fails === 0 ? 'OK' : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
