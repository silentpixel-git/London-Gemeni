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
 *  - turnsAtLocationWithoutProgress is NOT advanced, so act safety nets
 *    (the workbox nag, the at-the-door card nag) never fire in a golden run.
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
  expectBeat?: boolean;            // a scripted beat fired this turn
  expectNoticeIncludes?: string;   // substring of the beat payload
  expectApproachNpc?: string | null; // npcApproach fired (by npcId) / explicitly none
  expectItemGained?: string;       // exact inventory entry present after the turn
  expectWordBudget?: number;       // aiContext.extraWordBudget — playtest-tuned, load-bearing
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
  if (checks.expectBeat !== undefined) {
    const beat = result.aiContext.scriptedBeat;
    !!beat === checks.expectBeat
      ? pass(`${prefix} → scripted beat ${checks.expectBeat ? 'fired' : 'did not fire'}`)
      : fail(`${prefix} → expected scriptedBeat=${checks.expectBeat}, got ${JSON.stringify(beat)}`);
  }
  if (checks.expectNoticeIncludes !== undefined) {
    JSON.stringify(result.aiContext.scriptedBeat ?? {}).includes(checks.expectNoticeIncludes)
      ? pass(`${prefix} → beat carries "${checks.expectNoticeIncludes}"`)
      : fail(`${prefix} → beat payload missing "${checks.expectNoticeIncludes}"`, JSON.stringify(result.aiContext.scriptedBeat));
  }
  if (checks.expectApproachNpc !== undefined) {
    const approach = (result.aiContext as any).npcApproach;
    if (checks.expectApproachNpc === null) {
      !approach
        ? pass(`${prefix} → no NPC approach`)
        : fail(`${prefix} → unexpected approach`, JSON.stringify(approach));
    } else {
      approach?.npcId === checks.expectApproachNpc
        ? pass(`${prefix} → approach from "${checks.expectApproachNpc}"`)
        : fail(`${prefix} → expected approach from "${checks.expectApproachNpc}"`, JSON.stringify(approach));
    }
  }
  if (checks.expectItemGained !== undefined) {
    next.inventory.includes(checks.expectItemGained)
      ? pass(`${prefix} → inventory gained "${checks.expectItemGained}"`)
      : fail(`${prefix} → inventory missing "${checks.expectItemGained}"`, JSON.stringify(next.inventory));
  }
  if (checks.expectWordBudget !== undefined) {
    const budget = (result.aiContext as any).extraWordBudget;
    budget === checks.expectWordBudget
      ? pass(`${prefix} → extraWordBudget=${checks.expectWordBudget}`)
      : fail(`${prefix} → expected extraWordBudget=${checks.expectWordBudget}, got ${budget}`);
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
// Canonical give-branch run. Scenes A–H; six-flag gate across five verbs.

function runGoldenAct0(): void {
  console.log('\n=== GOLDEN: Act 0 — The Bank Holiday (give branch) ===');
  const A0 = 'Act0';
  let s = buildSnapshot();

  // Before anything: Mrs Kemp offstage, her belongings invisible, travel sealed.
  probe(A0, s, 'ask mrs kemp about her sister', { blocked: true, flagNotSet: 'asked_mrs_kemp_about_kemp_sister_missing' });
  probe(A0, s, 'examine the pawn ticket', { blocked: true, flagNotSet: 'examined_baker_street_pawn_ticket' });
  probe(A0, s, 'go to dorset street', { blocked: true });

  // Scene A — the window. Beats 1–3 stage the opening, one per action.
  s = goldenStep(A0, s, 'look out the window', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_open_window', 'examined_baker_street', 'beat_act0_holmes_reads_the_crowd'],
    expectBeat: true,
    expectNpcs: ['holmes'],
    expectHidden: ['pawn', 'workbasket', 'boots'],
  });
  s = goldenStep(A0, s, 'examine the concluded case', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_concluded_case_file', 'beat_act0_holmes_notices_the_caller'],
    expectBeat: true,
    expectNpcs: ['holmes'],
  });
  s = goldenStep(A0, s, 'examine the chemistry table', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_holmes_chemistry_table', 'beat_act0_the_bell'],
    expectBeat: true,
    expectNoticeIncludes: 'Door bell',
  });

  // Scene B — the arrival (beat 4 sets the presence flag) and the account.
  s = goldenStep(A0, s, 'look', {
    expectSuccess: true,
    expectFlags: ['beat_act0_kemp_shown_up', 'world_event_kemp_arrives'],
    expectBeat: true,
    expectNpcs: ['holmes', 'mrs_kemp'],
    expectVisible: ['pawn', 'workbasket', 'boots'],
    expectHidden: ['correspondence', 'subscriber'],
  });
  s = goldenStep(A0, s, 'ask mrs kemp about her sister', {
    expectSuccess: true,
    expectFlags: ['asked_mrs_kemp_about_kemp_sister_missing', 'talked_to_mrs_kemp_at_baker_street', 'beat_act0_holmes_opening_account'],
    expectBeat: true, // beat 5 — the last scripted beat; control handed over
  });

  // Scene C — the ticket and the boots.
  s = goldenStep(A0, s, 'examine the pawn ticket', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_pawn_ticket', 'filed_pawn_ticket'],
    expectItemGained: "Nell's Pawn Ticket",
    expectBeat: false, // turns 6+ are beat-free
  });
  s = goldenStep(A0, s, 'examine the boots', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_nells_boots'],
    expectBeat: false,
  });
  s = goldenStep(A0, s, 'show the ticket to holmes', {
    expectSuccess: true,
    expectFlags: ['showed_pawn_ticket_to_holmes'],
  });

  // Scene D — the workbox. Examining is not opening; the card can't be shown yet.
  probe(A0, s, 'show the card to holmes', { blocked: true, flagNotSet: 'showed_charity_card_to_holmes' });
  probe(A0, s, 'examine the workbox', { flagNotSet: 'opened_baker_street_nells_workbox' });
  s = goldenStep(A0, s, 'open the workbox', {
    expectSuccess: true,
    expectFlags: ['opened_baker_street_nells_workbox'],
    // Deliberate, and NOT a bug — asserted so the reason stays on the record.
    // The contents are absent from availableObjects for exactly this one turn:
    // flagsNow (engine/narrationContext.ts:102) merges world-event and
    // scripted-beat flags but not the resolver's own flagsUpdate. The prose is
    // still correct, because resolveOpen's own note names them outright —
    // "Inside: Nell's Correspondence, A Subscriber's Card. Describe only these
    // contents and nothing else" (engine/resolvers/open.ts:42,62) — and an OPEN
    // turn is compact mode, where the player-facing "Objects of interest" line
    // is not emitted at all. Do NOT "fix" this by folding outcome.flagsUpdate
    // into flagsNow: that same bag feeds NPC presence (line 112) and the
    // knowledge envelope (line 366), so it would pull NPCs onstage a turn early
    // and unseal all six of Holmes's gated facts on the turn the card is shown.
    expectHidden: ['correspondence', 'subscriber'],
  });
  s = goldenStep(A0, s, "examine nell's letters", {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_nells_letters'],
    expectVisible: ['correspondence', 'subscriber'], // present from the turn after the open
  });
  s = goldenStep(A0, s, 'examine the card', {
    expectSuccess: true,
    expectFlags: ['examined_baker_street_charity_card', 'filed_charity_card'],
    expectItemGained: "A Subscriber's Card",
  });

  // Scene E — the reconstruction. The closing fact is sealed until it fires.
  probe(A0, s, 'ask holmes about the criminal classes', { flagNotSet: 'asked_holmes_about_holmes_crime_grown_dull' });
  s = goldenStep(A0, s, 'show the card to holmes', {
    expectSuccess: true,
    expectFlags: ['showed_charity_card_to_holmes'],
    // The reconstruction needs room for both reveals — 170 dropped the
    // "Marchant" turn of the screw in live generations (clues.ts). Without this
    // assertion the budget can be deleted and the suite stays green.
    expectWordBudget: 220,
  });

  // Scene F — the choice (give branch) and the ticket she leaves behind.
  s = goldenStep(A0, s, 'give the card to mrs kemp', {
    expectSuccess: true,
    expectFlags: ['showed_charity_card_to_mrs_kemp'],
  });
  s = goldenStep(A0, s, 'take the ticket', {
    expectSuccess: true,
    expectFlags: ['took_baker_street_pawn_ticket'],
    expectAct: 0, // 5/6 gate flags — the closing ask is still owed
  });
  probe(A0, s, 'examine the chemistry table', { noActAdvance: true });

  // Scene G — the window again (the guaranteed act beat, full-mode turn).
  s = goldenStep(A0, s, 'look', {
    expectSuccess: true,
    expectFlags: ['approach_holmes_invisible_in_a_crowd'],
    expectApproachNpc: 'holmes',
    expectAct: 0,
  });

  // Scene H — crime grown dull: gate flag 6/6, act advance, anchor cut.
  s = goldenStep(A0, s, 'ask holmes about the criminal classes', {
    expectSuccess: true,
    expectFlags: ['asked_holmes_about_holmes_crime_grown_dull', 'act_1_started'],
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
    'look out the window', 'examine the concluded case', 'examine the chemistry table', 'look',
    'ask mrs kemp about her sister', 'examine the pawn ticket', 'examine the boots',
    'show the ticket to holmes', 'open the workbox', "examine nell's letters",
    'examine the card', 'show the card to holmes',
  ]) {
    s = goldenStep(A0W, s, input);
  }

  s = goldenStep(A0W, s, 'say nothing', {
    expectFlags: ['withheld_address'],
    expectNotFlags: ['showed_charity_card_to_mrs_kemp'],
  });
  s = goldenStep(A0W, s, 'take the ticket', {
    expectFlags: ['took_baker_street_pawn_ticket'],
    expectAct: 0,
  });
  s = goldenStep(A0W, s, 'ask holmes about the criminal classes', {
    expectFlags: ['asked_holmes_about_holmes_crime_grown_dull'],
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
