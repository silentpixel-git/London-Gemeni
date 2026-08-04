/**
 * QA harness: golden playthroughs.
 *
 * One scenario per act, transcribed from that act's approved mechanical score
 * (docs/act-authoring-process.md). Each scenario threads ONE session through
 * the act turn by turn — unlike qa-engine.ts, whose helpers deliberately freeze
 * the clock and turn counter between steps, this harness advances both
 * (mirroring useGameState's ACTION_TIME_MINUTES table, the midnight clamp, and
 * the act-advance clock reset). That is what lets it catch the content-bug
 * classes qa-engine's isolated snapshot checks cannot: content firing on the
 * wrong turn, NPCs present before their gate, objects visible before their
 * flag, facts askable before they are earned.
 *
 * KNOWN LIMITS of the fidelity — do not read these as covered:
 *  - turnsAtLocationWithoutProgress is NOT advanced, so act safety nets are
 *    not exercised in a golden run.
 *  - ITEM_SPENT_AFTER_ACT pruning happens in the hook, not here, so a
 *    post-transition snapshot still carries items live play has taken away.
 *  - Narration prose is never inspected; these are mechanical assertions.
 *
 * Assertions come from the score, not from the code — when a golden step fails
 * after a story-data edit, the score is the arbiter of which side is wrong.
 *
 * Run: npm run qa:golden   (part of qa:all; exits 1 on any FAIL)
 */

import { gameEngine, SessionSnapshot, getPresentNpcIds, timePeriodFor, resolveActDay } from '../engine/GameEngine';
import { parseIntent } from '../engine/intentParser';
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';
import { resolveActDiary } from '../engine/stories/whitechapel-1888/diaryActs';
import {
  INITIAL_LOCATION,
  INITIAL_INTRODUCED_NPCS,
  INITIAL_NPC_STATES,
  INITIAL_INVENTORY,
} from '../constants';

type EngineResult = ReturnType<typeof gameEngine.resolve>;

// ── Logging helpers (same conventions as qa-engine.ts) ────────────────────────

let passes = 0;
let fails = 0;

function pass(label: string) { console.log(`[PASS] ${label}`); passes++; }
function fail(label: string, detail?: string) { console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`); fails++; }

// ── Snapshot helpers ──────────────────────────────────────────────────────────

function buildSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    location: INITIAL_LOCATION,
    inventory: [...INITIAL_INVENTORY],
    flags: {},
    npcStates: { ...INITIAL_NPC_STATES },
    currentAct: 0,
    medicalPoints: 0,
    moralPoints: 0,
    discoveredClueIds: [],
    turnsAtLocationWithoutProgress: 0,
    elapsedMinutes: 0,
    introducedNpcs: [...INITIAL_INTRODUCED_NPCS],
    locationVisitCounts: {},
    turnCount: 0,
    rumorEvents: {},
    ...overrides,
  };
}

// Mirror of useGameState's per-turn clock cost (hooks/useGameState.ts).
const ACTION_TIME_MINUTES: Partial<Record<EngineResult['actionType'], number>> = {
  move: 10, talk: 5, deduce: 5, examine: 2, open: 2,
  use: 2, take: 1, inventory: 0, query: 1, help: 0, other: 2,
};

/**
 * Apply an EngineResult onto a snapshot the way live play does — the
 * qa-engine.ts applyResult mutations PLUS the clock, approach-cooldown, and
 * act-advance behaviors that file deliberately leaves frozen.
 * (The turn counter is advanced by goldenStep BEFORE resolve, mirroring the
 * hook's 1-based turnCount for player actions.)
 */
function applyGolden(snap: SessionSnapshot, result: EngineResult): SessionSnapshot {
  const advancingAct = result.newAct !== undefined;

  // Clock: minutesAdvanced (WAIT) or the per-verb cost, clamped at 11:59 PM,
  // reset to the new act's own clock space on an act advance.
  const actionMinutes = result.minutesAdvanced ?? ACTION_TIME_MINUTES[result.actionType] ?? 2;
  const actDay = resolveActDay(
    WHITECHAPEL_MANIFEST.actTimeConfig[snap.currentAct] ?? WHITECHAPEL_MANIFEST.actTimeConfig[1],
    snap.flags,
  );
  const maxElapsedForDay = 1439 - actDay.canonicalMinutes;
  const elapsedMinutes = advancingAct ? 0 : Math.min(snap.elapsedMinutes + actionMinutes, maxElapsedForDay);

  return {
    ...snap,
    flags: { ...snap.flags, ...(result.flagsUpdate ?? {}) },
    rumorEvents: { ...snap.rumorEvents, ...(result.rumorEventsUpdate ?? {}) },
    introducedNpcs: [
      ...snap.introducedNpcs,
      ...Object.keys(result.introductionFlagsUpdate ?? {}).filter(k => result.introductionFlagsUpdate![k]),
    ],
    inventory: [
      ...snap.inventory.filter(i => !(result.inventoryRemove ?? []).includes(i)),
      ...(result.inventoryAdd ?? []),
    ],
    medicalPoints: snap.medicalPoints + (result.medicalPointsDelta ?? 0),
    moralPoints: snap.moralPoints + (result.moralPointsDelta ?? 0),
    discoveredClueIds: [...snap.discoveredClueIds, ...(result.discoveredClueIds ?? [])],
    location: result.newLocation ?? snap.location,
    currentAct: result.newAct ?? snap.currentAct,
    elapsedMinutes,
    lastApproachAtMinutes: advancingAct
      ? undefined
      : ((result as any).approachAtMinutes ?? snap.lastApproachAtMinutes),
    npcStates: result.npcUpdates
      ? Object.entries(result.npcUpdates).reduce(
          (acc, [id, upd]) => ({
            ...acc,
            [id]: { ...(acc[id] ?? { npcId: id, disposition: 50, status: 'alive', memory: [] }), ...upd },
          }),
          { ...snap.npcStates }
        )
      : snap.npcStates,
  };
}

/** NPC ids present at the snapshot's location, per the engine's own presence oracle. */
function presentNpcs(snap: SessionSnapshot): string[] {
  const period = timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, snap.currentAct, snap.elapsedMinutes, snap.flags);
  return getPresentNpcIds(
    WHITECHAPEL_MANIFEST.npcs, snap.location, snap.npcStates, snap.currentAct, period, snap.flags,
  ).sort();
}

// ── The golden step ───────────────────────────────────────────────────────────

interface GoldenChecks {
  expectSuccess?: boolean;
  expectFlags?: string[];          // truthy in flags after the turn
  expectNotFlags?: string[];       // still unset after the turn
  expectLocation?: string;
  expectAct?: number;
  expectNpcs?: string[];           // exact present set (sorted) after the turn
  expectNpcPresent?: string[];     // membership only (for act-entry landings)
  expectNpcAbsent?: string[];
  expectVisible?: string[];        // case-insensitive substrings of aiContext.availableObjects
  expectHidden?: string[];
  expectEvent?: string | null;      // storyEvent id, or explicitly none
  expectNoticeIncludes?: string;   // substring of the event payload
  expectItemGained?: string;       // exact inventory entry present after the turn
  expectWordBudget?: number;       // storyEvent.maxWords — playtest-tuned, load-bearing
}

function goldenStep(label: string, snap: SessionSnapshot, input: string, checks: GoldenChecks = {}): SessionSnapshot {
  // turnCount is 1-based for player actions: increment BEFORE resolve, as live play does.
  const acting: SessionSnapshot = { ...snap, turnCount: snap.turnCount + 1 };
  const result = gameEngine.resolve(parseIntent(input), acting);
  const next = applyGolden(acting, result);
  const prefix = `${label} T${acting.turnCount} ("${input}")`;

  if (checks.expectSuccess !== undefined) {
    result.actionSuccess === checks.expectSuccess
      ? pass(`${prefix} → actionSuccess=${checks.expectSuccess}`)
      : fail(`${prefix} → expected actionSuccess=${checks.expectSuccess}, got ${result.actionSuccess}`, result.blockedReason);
  }
  for (const flag of checks.expectFlags ?? []) {
    next.flags[flag]
      ? pass(`${prefix} → flag "${flag}" set`)
      : fail(`${prefix} → flag "${flag}" not set`, `flagsUpdate: ${JSON.stringify(result.flagsUpdate)}`);
  }
  for (const flag of checks.expectNotFlags ?? []) {
    !next.flags[flag]
      ? pass(`${prefix} → flag "${flag}" still unset`)
      : fail(`${prefix} → flag "${flag}" was set prematurely`);
  }
  if (checks.expectLocation !== undefined) {
    next.location === checks.expectLocation
      ? pass(`${prefix} → location=${checks.expectLocation}`)
      : fail(`${prefix} → expected location=${checks.expectLocation}, got ${next.location}`);
  }
  if (checks.expectAct !== undefined) {
    next.currentAct === checks.expectAct
      ? pass(`${prefix} → act=${checks.expectAct}`)
      : fail(`${prefix} → expected act=${checks.expectAct}, got ${next.currentAct}`);
  }
  if (checks.expectNpcs !== undefined) {
    const present = presentNpcs(next);
    const expected = [...checks.expectNpcs].sort();
    JSON.stringify(present) === JSON.stringify(expected)
      ? pass(`${prefix} → present NPCs exactly [${expected.join(', ')}]`)
      : fail(`${prefix} → expected NPCs [${expected.join(', ')}], got [${present.join(', ')}]`);
  }
  if (checks.expectNpcPresent || checks.expectNpcAbsent) {
    const present = presentNpcs(next);
    for (const id of checks.expectNpcPresent ?? []) {
      present.includes(id)
        ? pass(`${prefix} → NPC "${id}" present`)
        : fail(`${prefix} → NPC "${id}" absent`, `present: [${present.join(', ')}]`);
    }
    for (const id of checks.expectNpcAbsent ?? []) {
      !present.includes(id)
        ? pass(`${prefix} → NPC "${id}" absent`)
        : fail(`${prefix} → NPC "${id}" present but should be offstage`);
    }
  }
  if (checks.expectVisible || checks.expectHidden) {
    const objects = ((result.aiContext as any).availableObjects as string[] | undefined) ?? [];
    const lower = objects.map(o => o.toLowerCase());
    for (const sub of checks.expectVisible ?? []) {
      lower.some(o => o.includes(sub.toLowerCase()))
        ? pass(`${prefix} → object "${sub}" visible`)
        : fail(`${prefix} → object "${sub}" not in availableObjects`, JSON.stringify(objects));
    }
    for (const sub of checks.expectHidden ?? []) {
      !lower.some(o => o.includes(sub.toLowerCase()))
        ? pass(`${prefix} → object "${sub}" hidden`)
        : fail(`${prefix} → object "${sub}" visible before its gate`, JSON.stringify(objects));
    }
  }
  if (checks.expectEvent !== undefined) {
    const event = result.aiContext.storyEvent;
    event?.id === checks.expectEvent || (checks.expectEvent === null && !event)
      ? pass(`${prefix} → story event ${checks.expectEvent ?? 'did not fire'}`)
      : fail(`${prefix} → expected storyEvent=${checks.expectEvent}, got ${JSON.stringify(event)}`);
  }
  if (checks.expectNoticeIncludes !== undefined) {
    JSON.stringify(result.aiContext.storyEvent ?? {}).includes(checks.expectNoticeIncludes)
      ? pass(`${prefix} → event carries "${checks.expectNoticeIncludes}"`)
      : fail(`${prefix} → event payload missing "${checks.expectNoticeIncludes}"`, JSON.stringify(result.aiContext.storyEvent));
  }
  if (checks.expectItemGained !== undefined) {
    next.inventory.includes(checks.expectItemGained)
      ? pass(`${prefix} → inventory gained "${checks.expectItemGained}"`)
      : fail(`${prefix} → inventory missing "${checks.expectItemGained}"`, JSON.stringify(next.inventory));
  }
  if (checks.expectWordBudget !== undefined) {
    const budget = result.aiContext.storyEvent?.maxWords;
    budget === checks.expectWordBudget
      ? pass(`${prefix} → storyEvent.maxWords=${checks.expectWordBudget}`)
      : fail(`${prefix} → expected storyEvent.maxWords=${checks.expectWordBudget}, got ${budget}`);
  }
  return next;
}

/**
 * Stateless negative probe: resolve an input against the timeline WITHOUT
 * applying the result, so "this must not work yet" checks never disturb the
 * canonical run. The bug classes live in these negatives.
 */
function probe(label: string, snap: SessionSnapshot, input: string, expect: {
  blocked?: boolean;
  flagNotSet?: string;      // absent from result.flagsUpdate
  noActAdvance?: boolean;
}): void {
  const acting: SessionSnapshot = { ...snap, turnCount: snap.turnCount + 1 };
  const result = gameEngine.resolve(parseIntent(input), acting);
  const prefix = `${label} probe ("${input}")`;

  if (expect.blocked !== undefined) {
    result.actionSuccess !== expect.blocked
      ? pass(`${prefix} → ${expect.blocked ? 'blocked' : 'allowed'}`)
      : fail(`${prefix} → expected ${expect.blocked ? 'blocked' : 'allowed'}, got actionSuccess=${result.actionSuccess}`);
  }
  if (expect.flagNotSet !== undefined) {
    !(result.flagsUpdate ?? {})[expect.flagNotSet]
      ? pass(`${prefix} → does not set "${expect.flagNotSet}"`)
      : fail(`${prefix} → prematurely sets "${expect.flagNotSet}"`);
  }
  if (expect.noActAdvance !== undefined) {
    result.newAct === undefined
      ? pass(`${prefix} → no act advance`)
      : fail(`${prefix} → advanced act to ${result.newAct}`);
  }
}

// ── Act 0 — The Bank Holiday (score: docs/act0-bank-holiday-spec.md) ─────────
//
// Canonical give-branch run through the action-triggered event chain.

function runGoldenAct0(): void {
  console.log('\n=== GOLDEN: Act 0 — The Bank Holiday (give branch) ===');
  const A0 = 'Act0';
  let s = buildSnapshot();

  // Before anything: Mrs Kemp offstage, her belongings invisible, travel sealed.
  probe(A0, s, 'ask mrs kemp about her sister', { blocked: true, flagNotSet: 'asked_mrs_kemp_about_kemp_sister_missing' });
  probe(A0, s, 'examine the pawn ticket', { blocked: true, flagNotSet: 'examined_baker_street_pawn_ticket' });
  probe(A0, s, 'go to dorset street', { blocked: true });

  // Scene A — Holmes reads the crowd only when Watson engages him or it.
  s = goldenStep(A0, s, 'examine the chemistry table', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_holmes_chemistry_table'],
    expectNotFlags: ['act0_caller_noticed'],
    expectEvent: null,
    expectNpcs: ['holmes'],
    expectHidden: ['pawn', 'workbasket', 'boots'],
  });
  s = goldenStep(A0, s, 'talk to holmes', {
    expectSuccess: true,
    expectFlags: ['act0_caller_noticed', 'story_event_act0_caller_noticed'],
    expectNotFlags: ['act0_bell_rang'],
    expectEvent: 'act0_caller_noticed',
    expectNpcs: ['holmes'],
  });
  s = goldenStep(A0, s, 'examine the concluded case', {
    expectSuccess: true,
    expectNotFlags: ['act0_bell_rang'],
    expectEvent: null,
  });
  s = goldenStep(A0, s, 'examine the woman', {
    expectSuccess: true,
    expectFlags: ['act0_bell_rang', 'story_event_act0_bell_rang'],
    expectEvent: 'act0_bell_rang',
    expectNoticeIncludes: 'Door bell',
  });

  // Scene B — the caller waits for an explicit door action.
  s = goldenStep(A0, s, 'look', {
    expectSuccess: true,
    expectNotFlags: ['world_event_kemp_arrives'],
    expectEvent: null,
    expectNpcs: ['holmes'],
  });
  s = goldenStep(A0, s, 'answer the door', {
    expectSuccess: true,
    expectFlags: ['world_event_kemp_arrives', 'story_event_act0_kemp_arrives'],
    expectNotFlags: ['act0_kemp_business_heard'],
    expectEvent: 'act0_kemp_arrives',
    expectNpcs: ['holmes', 'mrs_kemp'],
    expectVisible: ['pawn', 'workbasket', 'boots'],
    expectHidden: ['correspondence', 'subscriber'],
  });
  s = goldenStep(A0, s, 'talk to mrs kemp', {
    expectSuccess: true,
    expectFlags: ['act0_kemp_business_heard', 'talked_to_mrs_kemp_at_baker_street', 'story_event_act0_kemp_business'],
    expectEvent: 'act0_kemp_business',
  });

  // Scene C — the ticket and the boots.
  s = goldenStep(A0, s, 'examine the pawn ticket', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_pawn_ticket'],
    expectEvent: null,
  });
  s = goldenStep(A0, s, 'examine the boots', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_nells_boots', 'act0_boots_analyzed', 'story_event_act0_boots_analyzed'],
    expectEvent: 'act0_boots_analyzed',
  });

  // Scene D — all three evidence prerequisites are required for reconstruction.
  probe(A0, s, 'ask holmes about the card', { flagNotSet: 'act0_reconstruction_complete' });
  probe(A0, s, 'examine the workbox', { flagNotSet: 'opened_baker_street_nells_workbox' });
  s = goldenStep(A0, s, 'open the workbox', {
    expectSuccess: true,
    expectFlags: ['opened_baker_street_nells_workbox'],
    expectVisible: ['correspondence', 'subscriber'],
    expectEvent: null,
  });
  s = goldenStep(A0, s, "examine nell's letters", {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_nells_letters'],
    expectVisible: ['correspondence', 'subscriber'],
  });
  s = goldenStep(A0, s, 'examine the card', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_charity_card', 'filed_charity_card'],
    expectItemGained: "A Subscriber's Card",
  });

  // Scene E — the reconstruction is one bounded story event.
  s = goldenStep(A0, s, 'show the card to holmes', {
    expectSuccess: true,
    expectFlags: ['showed_charity_card_to_holmes', 'act0_reconstruction_complete', 'story_event_act0_reconstruction'],
    expectEvent: 'act0_reconstruction',
    expectWordBudget: 300,
  });

  // Scene F — the choice (give branch) and the ticket she leaves behind.
  s = goldenStep(A0, s, 'give the card to mrs kemp', {
    expectSuccess: true,
    expectFlags: ['showed_charity_card_to_mrs_kemp', 'act0_kemp_choice_resolved', 'story_event_act0_give_card'],
    expectEvent: 'act0_give_card',
    expectNpcAbsent: ['mrs_kemp'],
  });
  s = goldenStep(A0, s, 'take the ticket', {
    expectSuccess: true,
    expectFlags: ['took_baker_street_pawn_ticket'],
    expectItemGained: "Nell's Pawn Ticket",
    expectAct: 0,
  });
  probe(A0, s, 'examine the chemistry table', { noActAdvance: true });

  // Scene G — Watson deliberately returns to Holmes and the window.
  s = goldenStep(A0, s, 'talk to holmes', {
    expectSuccess: true,
    expectFlags: ['act0_closing_complete', 'story_event_act0_closing', 'act_1_started'],
    expectEvent: 'act0_closing',
    expectAct: 1,
    expectLocation: 'dorset_street',
    expectNpcPresent: ['holmes'],   // follows_watson carries him through the cut
    expectNpcAbsent: ['mrs_kemp'],  // no act-1 schedule entry — offstage for good
  });

  // The act-close diary remembers the choice.
  const diary = resolveActDiary(0, s.flags) ?? '';
  diary.includes('gave her the card')
    ? pass('Act0 → act-close diary uses the gave-card variant')
    : fail('Act0 → act-close diary missing the gave-card variant', diary.slice(0, 200));
}

// Withhold branch: same road to the choice, then silence instead of mercy.
function runGoldenAct0Withhold(): void {
  console.log('\n=== GOLDEN: Act 0 — The Bank Holiday (withhold branch) ===');
  const A0W = 'Act0Withhold';
  let s = buildSnapshot();

  // Fast-forward through the settled canonical path (asserted in the run above).
  for (const input of [
    'talk to holmes', 'examine the woman', 'answer the door', 'talk to mrs kemp',
    'examine the pawn ticket', 'examine the boots', 'open the workbox', "examine nell's letters",
    'examine the card', 'show the card to holmes',
  ]) {
    s = goldenStep(A0W, s, input);
  }

  s = goldenStep(A0W, s, 'say nothing', {
    expectFlags: ['withheld_address', 'act0_kemp_choice_resolved', 'story_event_act0_withhold_card'],
    expectNotFlags: ['showed_charity_card_to_mrs_kemp'],
    expectEvent: 'act0_withhold_card',
    expectNpcAbsent: ['mrs_kemp'],
  });
  s = goldenStep(A0W, s, 'take the ticket', {
    expectFlags: ['took_baker_street_pawn_ticket'],
    expectAct: 0,
  });
  s = goldenStep(A0W, s, 'examine the street', {
    expectFlags: ['act0_closing_complete', 'story_event_act0_closing'],
    expectEvent: 'act0_closing',
    expectAct: 1,
    expectLocation: 'dorset_street',
  });

  const diary = resolveActDiary(0, s.flags) ?? '';
  diary.includes('stayed in my pocket')
    ? pass('Act0Withhold → act-close diary uses the withhold variant')
    : fail('Act0Withhold → act-close diary missing the withhold variant', diary.slice(0, 200));
}

// Diary variant precedence: first match wins, in authored order.
function runAct0DiaryVariants(): void {
  console.log('\n=== GOLDEN: Act 0 diary variant precedence ===');
  const gave = resolveActDiary(0, { showed_charity_card_to_mrs_kemp: true, asked_mrs_kemp_about_kemp_why_she_hid: true }) ?? '';
  gave.includes('gave her the card')
    ? pass('DiaryVariants → gave-card wins when both flags are set (first match)')
    : fail('DiaryVariants → expected gave-card variant', gave.slice(0, 200));

  const asked = resolveActDiary(0, { asked_mrs_kemp_about_kemp_why_she_hid: true }) ?? '';
  asked.includes('hidden herself')
    ? pass('DiaryVariants → asked-first variant selected')
    : fail('DiaryVariants → expected asked-first variant', asked.slice(0, 200));

  const withheld = resolveActDiary(0, {}) ?? '';
  withheld.includes('stayed in my pocket')
    ? pass('DiaryVariants → withhold/default variant selected')
    : fail('DiaryVariants → expected withhold variant', withheld.slice(0, 200));
}

// ── Runner ────────────────────────────────────────────────────────────────────

try {
  runGoldenAct0();
  runGoldenAct0Withhold();
  runAct0DiaryVariants();
} catch (err) {
  console.error('\n[FATAL] Uncaught exception in golden harness:', err);
  process.exit(1);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passes} passed · ${fails} failed`);
console.log('─'.repeat(60));

if (fails > 0) {
  console.error(`\n✗ ${fails} golden assertion(s) FAILED — the act's timeline has drifted from its score`);
  process.exit(1);
} else {
  console.log('\n✓ All golden playthroughs match their scores');
}
