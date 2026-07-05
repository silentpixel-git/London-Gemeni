/**
 * scripts/qa-engine.ts
 *
 * Deterministic engine QA harness for London Bleeds.
 * Drives gameEngine.resolve() with scripted intents and validates state transitions.
 * No AI calls. No browser. No Supabase.
 *
 * Key engine facts (discovered by reading GameEngine.ts):
 * - resolveTalk does NOT call checkActProgression — act won't advance from a talk action alone.
 *   Fix: make the last gate-completing action an examine, not a talk.
 * - resolveExamine DOES check act progression with merged flags (including the new flag just set).
 * - resolveMove checks act progression using CURRENT session flags (before this move's flagsUpdate).
 *   The locationExaminedFlag is only set by examine, not by move.
 * - visited_private_asylum (Act 6 gate) is set by EXAMINING something at the asylum, not by moving there.
 * - private_asylum requiresFlag = 'asylum_unlocked' (set by correct deduction, not 'correct_deduction').
 * - Wrong deductions: actionSuccess=false but gameOver=true (cold case).
 * - Unknown object targets → parseIntent returns targetId=undefined → general look-around → always succeeds.
 *
 * Location graph (relevant exits):
 *   baker_street → dorset_street
 *   dorset_street → millers_court, baker_street, h_division_station
 *   millers_court → dorset_street
 *   h_division_station → dorset_street, whitechapel_pub
 *   whitechapel_pub → h_division_station, bucks_row
 *   bucks_row → whitechapel_mortuary, hanbury_street, whitechapel_pub
 *   whitechapel_mortuary → dorset_street, bucks_row
 *   hanbury_street → bucks_row, dutfields_yard
 *   dutfields_yard → hanbury_street, working_mens_club, mitre_square
 *   working_mens_club → dutfields_yard
 *   mitre_square → dutfields_yard, goulston_street
 *   goulston_street → mitre_square, lusk_office
 *   lusk_office → goulston_street, bond_office
 *   bond_office → lusk_office, private_asylum, baker_street
 *   private_asylum → bond_office, baker_street
 *
 * Run: npx tsx scripts/qa-engine.ts
 * Exit code 1 if any FAIL.
 */

import { gameEngine, SessionSnapshot, npcLocationAt, timePeriodFor, PERIOD_ORDER } from '../engine/GameEngine';
import { parseIntent } from '../engine/intentParser';
import { deriveKnowledgeEnvelope } from '../engine/stories/knowledge';
import type { StoryFact } from '../engine/stories/types';
import { NPCS } from '../engine/stories/whitechapel-1888/npcs';
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';
import {
  INITIAL_LOCATION,
  INITIAL_INTRODUCED_NPCS,
  INITIAL_NPC_STATES,
  INITIAL_INVENTORY,
} from '../constants';

// ── Logging helpers ───────────────────────────────────────────────────────────

let passes = 0;
let fails = 0;
let warns = 0;

function pass(label: string) { console.log(`[PASS] ${label}`); passes++; }
function fail(label: string, detail?: string) { console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`); fails++; }
function warn(label: string, detail?: string) { console.warn(`[WARN] ${label}${detail ? ` — ${detail}` : ''}`); warns++; }

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
    ...overrides,
  };
}

/** Apply an EngineResult's state mutations onto a snapshot, returning a new snapshot. */
function applyResult(snap: SessionSnapshot, result: ReturnType<typeof gameEngine.resolve>): SessionSnapshot {
  return {
    ...snap,
    flags: { ...snap.flags, ...(result.flagsUpdate ?? {}) },
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
    // Mirror the hook: NPC location/state updates must persist across steps
    // (Bond moving to Miller's Court on the Act 1 cut, Tumblety going offstage, …)
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

function step(
  label: string,
  snap: SessionSnapshot,
  input: string,
  checks: {
    expectSuccess?: boolean;
    expectLocation?: string;
    expectFlag?: string;
    expectClue?: string;
    expectAct?: number;
    expectGameOver?: boolean;
    expectEndingType?: 'cold_case' | 'true_ending';
  } = {}
): SessionSnapshot {
  const intent = parseIntent(input);
  const result = gameEngine.resolve(intent, snap);
  const next = applyResult(snap, result);
  const prefix = `${label} (input: "${input}")`;

  if (checks.expectSuccess !== undefined) {
    result.actionSuccess === checks.expectSuccess
      ? pass(`${prefix} → actionSuccess=${checks.expectSuccess}`)
      : fail(`${prefix} → expected actionSuccess=${checks.expectSuccess}, got ${result.actionSuccess}`, result.blockedReason);
  }
  if (checks.expectLocation !== undefined) {
    next.location === checks.expectLocation
      ? pass(`${prefix} → location=${checks.expectLocation}`)
      : fail(`${prefix} → expected location=${checks.expectLocation}, got ${next.location}`);
  }
  if (checks.expectFlag !== undefined) {
    next.flags[checks.expectFlag]
      ? pass(`${prefix} → flag "${checks.expectFlag}" set`)
      : fail(`${prefix} → flag "${checks.expectFlag}" not set`);
  }
  if (checks.expectClue !== undefined) {
    next.discoveredClueIds.includes(checks.expectClue)
      ? pass(`${prefix} → clue "${checks.expectClue}" discovered`)
      : fail(`${prefix} → clue "${checks.expectClue}" not discovered`, `clues: ${JSON.stringify(next.discoveredClueIds)}`);
  }
  if (checks.expectAct !== undefined) {
    next.currentAct === checks.expectAct
      ? pass(`${prefix} → act advanced to ${checks.expectAct}`)
      : fail(`${prefix} → expected act=${checks.expectAct}, got ${next.currentAct}`);
  }
  if (checks.expectGameOver !== undefined) {
    !!result.gameOver === checks.expectGameOver
      ? pass(`${prefix} → gameOver=${checks.expectGameOver}`)
      : fail(`${prefix} → expected gameOver=${checks.expectGameOver}, got ${!!result.gameOver}`);
  }
  if (checks.expectEndingType !== undefined) {
    result.endingType === checks.expectEndingType
      ? pass(`${prefix} → endingType=${checks.expectEndingType}`)
      : fail(`${prefix} → expected endingType=${checks.expectEndingType}, got ${result.endingType}`);
  }
  return next;
}

// ── Scenario 1: Winning path ──────────────────────────────────────────────────

function runWinningPath() {
  console.log('\n=== SCENARIO: winning-path (reweave) ===');

  // The rewoven critical path: five suspect-theory acts, anchor auto-moves
  // between them, and the Act 5 Baker Street convergence driving the advance.

  // Act 0 — the vigil. Tutorial: talk, examine, take, show.
  let s = buildSnapshot();
  s = step('Act0', s, 'talk to holmes',          { expectSuccess: true, expectFlag: 'talked_to_holmes_at_baker_street' });
  s = step('Act0', s, 'examine case files wall', { expectSuccess: true, expectFlag: 'examined_baker_street_case_files_wall', expectClue: 'clue_00_campaign_timeline' });
  s = step('Act0', s, 'examine newspaper pile',  { expectSuccess: true }); // yields the clipping (takeable)
  if (s.inventory.includes('Newspaper Clipping (the "Dear Boss" letter)')) {
    pass('Act0 → newspaper clipping added to inventory');
  } else {
    fail(`Act0 → clipping not in inventory: ${JSON.stringify(s.inventory)}`);
  }
  s = step('Act0', s, 'show newspaper clipping to holmes', { expectSuccess: true, expectFlag: 'showed_newspaper_pile_to_holmes' });
  s = step('Act0', s, 'examine telegrams pile',  {
    expectSuccess: true,
    expectFlag: 'examined_baker_street_telegrams_pile',
    expectAct: 1,
    expectLocation: 'dorset_street', // ← anchor auto-move (overnight cut; Kelly dies tonight)
  });

  // Act 1 — "The Stranger". Hutchinson gated; closes on Bond's aftermath beat.
  s = step('Act1', s, 'talk to hutchinson',      { expectSuccess: true, expectFlag: 'talked_to_hutchinson_at_dorset_street' });
  s = step('Act1', s, 'go to millers court',     { expectSuccess: true, expectLocation: 'millers_court' });
  s = step('Act1', s, 'examine burned clothing', { expectSuccess: true, expectFlag: 'examined_millers_court_burned_clothing', expectClue: 'clue_01_killer_confidence' });
  s = step('Act1', s, 'examine the bed',         { expectSuccess: true, expectFlag: 'examined_millers_court_the_bed' });
  s = step('Act1', s, 'talk to bond', {
    expectSuccess: true,
    expectFlag: 'talked_to_bond_at_millers_court',
    expectAct: 2,                            // ← talk-gated advance (the capstone)
    expectLocation: 'whitechapel_mortuary',  // ← anchor auto-move
  });

  // Act 2 — "The Mad Doctor". Mortuary + cold scenes, then Tumblety in custody.
  s = step('Act2', s, 'examine bonds desk',          { expectSuccess: true, expectFlag: 'examined_whitechapel_mortuary', expectClue: 'clue_02c_small_hands' });
  s = step('Act2', s, 'talk to phillips',            { expectSuccess: true, expectFlag: 'talked_to_phillips_at_whitechapel_mortuary' });
  s = step('Act2', s, 'go to bucks row',             { expectSuccess: true, expectLocation: 'bucks_row' });
  s = step('Act2', s, 'examine cobblestone roadway', { expectSuccess: true, expectFlag: 'examined_bucks_row', expectClue: 'clue_01_respectable_approach' });
  s = step('Act2', s, 'go to hanbury street',        { expectSuccess: true, expectLocation: 'hanbury_street' });
  s = step('Act2', s, 'examine ground where body was discovered', { expectSuccess: true, expectFlag: 'examined_hanbury_street', expectClue: 'clue_02_anatomical_knowledge' });
  // Route to the station: hanbury → bucks row → the pub → the station
  s = step('Act2', s, 'go to bucks row',             { expectSuccess: true });
  s = step('Act2', s, 'go to whitechapel pub',       { expectSuccess: true, expectLocation: 'whitechapel_pub' });
  s = step('Act2', s, 'go to h division station',    { expectSuccess: true, expectLocation: 'h_division_station' });
  s = step('Act2', s, 'talk to tumblety',            { expectSuccess: true, expectFlag: 'talked_to_tumblety_at_h_division_station' });
  s = step('Act2', s, 'talk to holmes', {
    expectSuccess: true,
    expectFlag: 'talked_to_holmes_at_h_division_station',
    expectAct: 3,                       // ← capstone talk advance
    expectLocation: 'dutfields_yard',   // ← anchor auto-move
  });

  // Act 3 — "The Foreigner". The double event, Pizer, the erased wall.
  s = step('Act3', s, 'examine yard entrance gate', { expectSuccess: true, expectFlag: 'examined_dutfields_yard', expectClue: 'clue_03_interrupted_ritual' });
  s = step('Act3', s, 'go to working mens club',    { expectSuccess: true, expectLocation: 'working_mens_club' });
  s = step('Act3', s, 'talk to pizer',              { expectSuccess: true, expectFlag: 'talked_to_pizer_at_working_mens_club' });
  s = step('Act3', s, 'go to dutfields yard',       { expectSuccess: true });
  s = step('Act3', s, 'go to mitre square',         { expectSuccess: true, expectLocation: 'mitre_square' });
  s = step('Act3', s, 'examine square walls',       { expectSuccess: true, expectFlag: 'examined_mitre_square', expectClue: 'clue_04_kidney_removal' });
  s = step('Act3', s, 'go to goulston street',      { expectSuccess: true, expectLocation: 'goulston_street' }); // act 3 now
  s = step('Act3', s, 'examine apron fragment location', { expectSuccess: true, expectFlag: 'examined_goulston_street', expectClue: 'clue_03b_unremarked_passage' });
  s = step('Act3', s, 'talk to holmes', {
    expectSuccess: true,
    expectFlag: 'talked_to_holmes_at_goulston_street',
    expectAct: 4,                   // ← capstone at the erased wall
    expectLocation: 'lusk_office',  // ← anchor auto-move
  });

  // Act 4 — "The Vanishing Gentleman". The letter; Tumblety flees offstage.
  s = step('Act4', s, 'examine from hell letter', { expectSuccess: true, expectFlag: 'examined_lusk_office', expectClue: 'clue_05_from_hell_letter' });
  if (s.inventory.includes('From Hell Letter (transcript)')) {
    pass('Act4 → letter transcript added to inventory (needed for the convergence)');
  } else {
    fail(`Act4 → letter transcript missing from inventory: ${JSON.stringify(s.inventory)}`);
  }
  s = step('Act4', s, 'talk to abberline',        { expectSuccess: true, expectFlag: 'talked_to_abberline_at_lusk_office' });
  s = step('Act4', s, 'talk to holmes', {
    expectSuccess: true,
    expectFlag: 'talked_to_holmes_at_lusk_office',
    expectAct: 5,                   // ← capstone synthesis
    expectLocation: 'bond_office',  // ← anchor auto-move
  });

  // Act 5 — "The Quiet Man". The gather, then the Baker Street convergence.
  s = step('Act5', s, 'examine medical reports',  { expectSuccess: true, expectFlag: 'examined_bond_office', expectClue: 'clue_07_edmunds_presence' });
  s = step('Act5', s, 'examine anatomical texts', { expectSuccess: true, expectClue: 'clue_09_medical_background' });
  // The forensic note: copy + NAME — but NO clue_06 (the connection is the player's, at home).
  const beforeNote = s.discoveredClueIds.length;
  s = step('Act5', s, 'examine edmund forensic note', { expectSuccess: true });
  s.discoveredClueIds.length === beforeNote
    ? pass('Act5 → forensic note examine yields NO clue (clue_06 reserved for the convergence)')
    : fail(`Act5 → forensic note prematurely granted a clue: ${JSON.stringify(s.discoveredClueIds.slice(beforeNote))}`);
  s.inventory.includes("Assistant's Forensic Note (copy)")
    ? pass('Act5 → forensic note copy added to inventory')
    : fail(`Act5 → note copy missing: ${JSON.stringify(s.inventory)}`);
  // No act advance yet — Act 5 has no flag gate.
  s.currentAct === 5
    ? pass('Act5 → act holds at 5 after the gather (no bare-examine gate)')
    : fail(`Act5 → act advanced prematurely to ${s.currentAct}`);
  // The convergence — at home, against the casefiles.
  s = step('Act5', s, 'go to baker street', { expectSuccess: true, expectLocation: 'baker_street' });
  s = step('Act5', s, 'use forensic note with from hell letter', {
    expectSuccess: true,
    expectClue: 'clue_06_prasarved_spelling', // ← THE MATCH, player-made
  });
  // The naming — the Act 5→6 advance IS the deduction; the rush auto-moves to Bond's office.
  s = step('Act5', s, 'deduce Edmund Halward is the killer', {
    expectSuccess: true,
    expectFlag: 'asylum_unlocked',
    expectAct: 6,
    expectLocation: 'bond_office', // ← the rush ("he's gone")
    expectGameOver: false,
  });

  // Act 6 — the confrontation and the extraction.
  s = step('Act6', s, 'go to private asylum', { expectSuccess: true, expectLocation: 'private_asylum' });
  s = step('Act6', s, 'talk to edmund',       { expectSuccess: true, expectFlag: 'talked_to_edmund_at_private_asylum' });
  s = step('Act6', s, 'examine patient records', {
    expectSuccess: true,
    expectFlag: 'visited_private_asylum',
    expectClue: 'clue_10_asylum_commitment',
    expectGameOver: true,
    expectEndingType: 'true_ending',
  });
}

// ── Scenario 2: Cold case — wrong deduction (Dr. Bond) ───────────────────────

function runColdCaseBond() {
  console.log('\n=== SCENARIO: cold-case-bond ===');

  const s = buildSnapshot({
    currentAct: 6,
    location: 'private_asylum',
    flags: { visited_private_asylum: true, asylum_unlocked: true },
    discoveredClueIds: [
      'clue_00_campaign_timeline',
      'clue_02_anatomical_knowledge',
      'clue_04_kidney_removal',
      'clue_05_from_hell_letter',
      'clue_06_prasarved_spelling',
    ],
  });

  const result = gameEngine.resolve(parseIntent('deduce Dr Bond is the Ripper'), s);
  // Wrong deduction: actionSuccess=false (theory wrong) but gameOver=true (cold case)
  !result.actionSuccess
    ? pass('ColdCaseBond → actionSuccess=false (wrong deduction — expected)')
    : fail('ColdCaseBond → wrong deduction should have actionSuccess=false');
  result.gameOver
    ? pass('ColdCaseBond → gameOver=true (cold case triggered)')
    : fail('ColdCaseBond → gameOver should be true for wrong deduction');
  result.endingType === 'cold_case'
    ? pass('ColdCaseBond → endingType=cold_case')
    : fail(`ColdCaseBond → expected endingType=cold_case, got ${result.endingType}`);
}

// ── Scenario 3: Cold case — Abberline ────────────────────────────────────────

function runColdCaseAbberline() {
  console.log('\n=== SCENARIO: cold-case-abberline ===');

  const s = buildSnapshot({
    currentAct: 6,
    location: 'private_asylum',
    flags: { visited_private_asylum: true, asylum_unlocked: true },
    discoveredClueIds: [
      'clue_00_campaign_timeline',
      'clue_02_anatomical_knowledge',
      'clue_04_kidney_removal',
      'clue_05_from_hell_letter',
      'clue_06_prasarved_spelling',
    ],
  });

  const result = gameEngine.resolve(parseIntent('deduce Inspector Abberline is the killer'), s);
  !result.actionSuccess
    ? pass('ColdCaseAbberline → actionSuccess=false (wrong deduction — expected)')
    : fail('ColdCaseAbberline → wrong deduction should have actionSuccess=false');
  result.gameOver
    ? pass('ColdCaseAbberline → gameOver=true (cold case triggered)')
    : fail('ColdCaseAbberline → gameOver should be true for wrong deduction');
  result.endingType === 'cold_case'
    ? pass('ColdCaseAbberline → endingType=cold_case')
    : fail(`ColdCaseAbberline → expected endingType=cold_case, got ${result.endingType}`);
}

// ── Scenario 4: Act gate boundary ────────────────────────────────────────────

function runActGateBoundary() {
  console.log('\n=== SCENARIO: act-gate-boundary ===');

  // Act 0: 2/3 flags — examine watson_armchair (no gate flag) should not advance
  const s0 = buildSnapshot({
    flags: {
      examined_baker_street_case_files_wall: true,
      examined_baker_street_telegrams_pile: true,
      // talked_to_holmes_at_baker_street missing
    },
  });
  const r0 = gameEngine.resolve(parseIntent('examine watson armchair'), s0);
  r0.newAct === undefined || r0.newAct <= 0
    ? pass('Act0 gate — held with 2/3 flags (expected)')
    : fail('Act0 gate — advanced with 2/3 flags (missing talk to holmes)');

  // Act 2: partial flags (mortuary + bucks_row only; missing phillips talk,
  // hanbury, tumblety, holmes) — examine at baker_street → gate holds
  const s2 = buildSnapshot({
    currentAct: 2,
    location: 'baker_street',
    flags: {
      examined_whitechapel_mortuary: true,
      examined_bucks_row: true,
    },
  });
  const r2 = gameEngine.resolve(parseIntent('examine case files wall'), s2);
  r2.newAct === undefined || r2.newAct <= 2
    ? pass('Act2 gate — held with 2/3 flags (expected)')
    : fail('Act2 gate — advanced with 2/3 flags (missing examined_hanbury_street)');

  // Act 3: 2/3 flags (dutfields_yard + mitre_square, missing working_mens_club)
  const s3 = buildSnapshot({
    currentAct: 3,
    location: 'baker_street',
    flags: {
      examined_dutfields_yard: true,
      examined_mitre_square: true,
    },
  });
  const r3 = gameEngine.resolve(parseIntent('examine watson armchair'), s3);
  r3.newAct === undefined || r3.newAct <= 3
    ? pass('Act3 gate — held with 2/3 flags (expected)')
    : fail('Act3 gate — advanced with 2/3 flags (missing examined_working_mens_club)');
}

// ── Scenario 5: Blocked actions ───────────────────────────────────────────────

function runBlockedActions() {
  console.log('\n=== SCENARIO: blocked-actions ===');

  const s = buildSnapshot({ location: 'baker_street' });

  // Move to non-adjacent location
  const r1 = gameEngine.resolve(parseIntent('go to mitre square'), s);
  !r1.actionSuccess
    ? pass('Blocked: non-adjacent move baker_street → mitre_square')
    : fail('Blocked: non-adjacent move should be blocked');

  // Examine a known object NOT at current location (burned_clothing is at millers_court)
  const r2 = gameEngine.resolve(parseIntent('examine burned clothing'), s);
  !r2.actionSuccess
    ? pass('Blocked: examine object absent from current location')
    : fail('Blocked: examining absent object should be blocked');

  // Move to act-gated location (dorset_street.act=1, currentAct=0)
  const r3 = gameEngine.resolve(parseIntent('go to dorset street'), s);
  !r3.actionSuccess
    ? pass('Blocked: move to act-1 location while at act 0')
    : fail('Blocked: act-gated location should be blocked at act 0');

  // Move to asylum without asylum_unlocked flag (bond_office → private_asylum)
  const sAct6 = buildSnapshot({
    currentAct: 6,
    location: 'bond_office',
    flags: { examined_bond_office: true },
  });
  const r4 = gameEngine.resolve(parseIntent('go to private asylum'), sAct6);
  !r4.actionSuccess
    ? pass('Blocked: asylum blocked without asylum_unlocked flag')
    : fail('Blocked: asylum should require asylum_unlocked flag');

  // Deduce with 0 clues
  const r5 = gameEngine.resolve(parseIntent('deduce Edmund Halward is the killer'), s);
  !r5.actionSuccess
    ? pass('Blocked: deduce with 0 clues blocked (below threshold of 5)')
    : fail('Blocked: deduce with 0 clues should be blocked');

  // Deduce with 3 clues (still below the new threshold of 4)
  const s3clues = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
    discoveredClueIds: [
      'clue_00_campaign_timeline',
      'clue_02_anatomical_knowledge',
      'clue_04_kidney_removal',
    ],
  });
  const r6 = gameEngine.resolve(parseIntent('deduce Edmund Halward is the killer'), s3clues);
  !r6.actionSuccess
    ? pass('Blocked: deduce with 3 clues blocked (below threshold of 4)')
    : fail('Blocked: deduce with 3/4 clues should still be blocked');

  // Deduce Edmund with 4 clues but WITHOUT clue_06 (smoking gun) — should be blocked
  const s4noGun = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
    discoveredClueIds: [
      'clue_00_campaign_timeline',
      'clue_02_anatomical_knowledge',
      'clue_04_kidney_removal',
      'clue_05_from_hell_letter',
      // clue_06_prasarved_spelling missing
    ],
  });
  const r7 = gameEngine.resolve(parseIntent('deduce Edmund Halward is the killer'), s4noGun);
  !r7.actionSuccess
    ? pass('Blocked: Edmund deduction blocked without smoking-gun clue_06')
    : fail('Blocked: Edmund deduction should require clue_06 (prasarved spelling)');
}

// ── Scenario 6: NPC alias integrity ──────────────────────────────────────────

function runNpcAliasIntegrity() {
  console.log('\n=== SCENARIO: npc-alias-integrity ===');

  // At mortuary, Edmund is present but NOT introduced — examining bonds_desk should NOT introduce him
  const s = buildSnapshot({
    currentAct: 2,
    location: 'whitechapel_mortuary',
  });
  const result = gameEngine.resolve(parseIntent('examine bonds desk'), s);
  const edIsIntroduced = Object.keys(result.introductionFlagsUpdate ?? {})
    .some(k => k.includes('edmund') && result.introductionFlagsUpdate![k]);
  !edIsIntroduced
    ? pass('NpcAlias: Edmund NOT introduced by examining bonds_desk (expected — introduction via forensic note only)')
    : fail('NpcAlias: Edmund introduced prematurely at bonds_desk — should only be via forensic note clue');

  // Examining edmund_forensic_note at bond_office SHOULD introduce Edmund
  const sNote = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
  });
  const r2 = gameEngine.resolve(parseIntent('examine edmund forensic note'), sNote);
  const edIntroducedNow = Object.keys(r2.introductionFlagsUpdate ?? {})
    .some(k => k.includes('edmund') && r2.introductionFlagsUpdate![k]);
  edIntroducedNow
    ? pass('NpcAlias: Edmund introduction flag fired after forensic note examine')
    : warn('NpcAlias: Edmund not marked as introduced after forensic note — verify introductionFlagsUpdate');
}

// ── Scenario 7: Premature asylum access ──────────────────────────────────────

function runPrematureAsylum() {
  console.log('\n=== SCENARIO: premature-asylum ===');

  // Without asylum_unlocked flag — should be blocked
  const sNoFlag = buildSnapshot({
    currentAct: 6,
    location: 'bond_office',
    flags: { examined_bond_office: true },
  });
  const r1 = gameEngine.resolve(parseIntent('go to private asylum'), sNoFlag);
  !r1.actionSuccess
    ? pass('PrematureAsylum: asylum blocked without asylum_unlocked flag')
    : fail('PrematureAsylum: asylum reachable without asylum_unlocked — requiresFlag gate broken');

  // With asylum_unlocked flag — should be accessible
  const sWithFlag = buildSnapshot({
    currentAct: 6,
    location: 'bond_office',
    flags: { examined_bond_office: true, asylum_unlocked: true },
    discoveredClueIds: [
      'clue_00_campaign_timeline',
      'clue_02_anatomical_knowledge',
      'clue_04_kidney_removal',
      'clue_05_from_hell_letter',
      'clue_06_prasarved_spelling',
    ],
  });
  const r2 = gameEngine.resolve(parseIntent('go to private asylum'), sWithFlag);
  r2.actionSuccess
    ? pass('PrematureAsylum: asylum accessible with asylum_unlocked flag')
    : fail('PrematureAsylum: asylum blocked even with asylum_unlocked flag', r2.blockedReason);
}

// ── Scenario 8: Clue deduplication ───────────────────────────────────────────

function runClueDedupe() {
  console.log('\n=== SCENARIO: clue-deduplication ===');

  const s = buildSnapshot({ currentAct: 1, location: 'millers_court' });
  const r1 = gameEngine.resolve(parseIntent('examine burned clothing'), s);
  const s2 = applyResult(s, r1);

  // Re-examine same object
  const r2 = gameEngine.resolve(parseIntent('examine burned clothing'), s2);
  const dupClues = (r2.discoveredClueIds ?? []).filter(id => s2.discoveredClueIds.includes(id));
  dupClues.length === 0
    ? pass('ClueDedupe: re-examining same object does not re-add already-discovered clues')
    : fail('ClueDedupe: duplicate clue(s) added on re-examine', JSON.stringify(dupClues));
}

// ── Scenario 9: Exact clue threshold boundary ─────────────────────────────────

function runDeductionThreshold() {
  console.log('\n=== SCENARIO: deduction-threshold ===');

  // Threshold is now 4. Must also include clue_06 for Edmund deduction.
  const fourCluesWithGun = [
    'clue_02_anatomical_knowledge',
    'clue_04_kidney_removal',
    'clue_05_from_hell_letter',
    'clue_06_prasarved_spelling', // smoking gun — required for Edmund
  ];

  const s = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
    discoveredClueIds: fourCluesWithGun,
  });
  const result = gameEngine.resolve(parseIntent('deduce Edmund Halward is the killer'), s);
  result.actionSuccess
    ? pass('DeductionThreshold: deduce succeeds at exactly 4 clues (including clue_06)')
    : fail('DeductionThreshold: deduce should succeed at exactly 4 clues with clue_06', result.blockedReason);

  // Confirm 3 clues still blocked
  const threeClues = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
    discoveredClueIds: fourCluesWithGun.slice(0, 3),
  });
  const r2 = gameEngine.resolve(parseIntent('deduce Edmund Halward is the killer'), threeClues);
  !r2.actionSuccess
    ? pass('DeductionThreshold: 3 clues correctly blocked (below threshold of 4)')
    : fail('DeductionThreshold: 3 clues should be blocked');
}

// ── Scenario 10: SHOW item TO npc ────────────────────────────────────────────

function runShowMechanic() {
  console.log('\n=== SCENARIO: show-mechanic ===');

  // SHOW forensic note TO holmes (authored interaction → clue_06 alternate path)
  // Holmes is canonical at bond_office in act 5, but INITIAL_NPC_STATES hardcodes baker_street.
  // Override his currentLocation to match act 5 canonical.
  const sWithNote = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
    inventory: ["Assistant's Forensic Note (copy)", 'Pocket Watch'],
    introducedNpcs: [...INITIAL_INTRODUCED_NPCS, 'holmes', 'edmund'],
    npcStates: {
      ...INITIAL_NPC_STATES,
      holmes: { npcId: 'holmes', currentLocation: 'bond_office', disposition: 50, status: 'alive', memory: [] },
    },
  });
  const r1 = gameEngine.resolve(parseIntent('show forensic note to holmes'), sWithNote);
  r1.actionSuccess
    ? pass('Show: show forensic note to holmes → actionSuccess=true')
    : fail('Show: show forensic note to holmes failed', r1.blockedReason);
  // REWEAVE: showing the note to Holmes must NOT grant clue_06 — he redirects
  // to Baker Street ("bring it home"); the convergence belongs to the player.
  !(r1.discoveredClueIds ?? []).includes('clue_06_prasarved_spelling')
    ? pass('Show: Holmes redirects without granting clue_06 (convergence preserved)')
    : fail('Show: clue_06 leaked via show forensic note to holmes — bypasses the Baker Street convergence');

  // SHOW item not in inventory → blocked
  const sNoItem = buildSnapshot({ currentAct: 2, location: 'whitechapel_mortuary' });
  const r2 = gameEngine.resolve(parseIntent('show forensic note to bond'), sNoItem);
  !r2.actionSuccess
    ? pass('Show: blocked when item not in inventory')
    : fail('Show: should be blocked when item not carried');

  // SHOW item to NPC not present → blocked
  const sWrongLoc = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
    inventory: ["Assistant's Forensic Note (copy)"],
  });
  const r3 = gameEngine.resolve(parseIntent('show forensic note to abberline'), sWrongLoc);
  // Abberline is not at bond_office in act 5 — should be blocked or succeed with generic response
  // (authored interaction exists, but NPC presence check matters)
  if (!r3.actionSuccess) {
    pass('Show: blocked when NPC not at current location');
  } else {
    warn('Show: NPC presence check may be lenient — verify Abberline is actually at bond_office in act 5');
  }
}

// ── Scenario 11: READ document ────────────────────────────────────────────────

function runReadMechanic() {
  console.log('\n=== SCENARIO: read-mechanic ===');

  // READ from hell letter at lusk_office (in location)
  const sAtLusk = buildSnapshot({ currentAct: 5, location: 'lusk_office' });
  const r1 = gameEngine.resolve(parseIntent('read from hell letter'), sAtLusk);
  r1.actionSuccess
    ? pass('Read: read from hell letter at lusk_office → actionSuccess=true')
    : fail('Read: reading from hell letter at its location failed', r1.blockedReason);

  // READ letter from inventory
  const sWithLetter = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
    inventory: ['From Hell Letter (transcript)', 'Pocket Watch'],
  });
  const r2 = gameEngine.resolve(parseIntent('read the letter'), sWithLetter);
  r2.actionSuccess
    ? pass('Read: read from hell letter from inventory → actionSuccess=true')
    : fail('Read: reading from inventory failed', r2.blockedReason);

  // READ object with no document text → falls back to examine (actionSuccess=true)
  const sExamine = buildSnapshot({ currentAct: 1, location: 'millers_court' });
  const r3 = gameEngine.resolve(parseIntent('read the bed'), sExamine);
  r3.actionSuccess
    ? pass('Read: non-document read falls back to examine → actionSuccess=true')
    : fail('Read: non-document read fallback unexpectedly blocked');
}

// ── Scenario 12: USE X WITH Y ─────────────────────────────────────────────────

function runUseWithMechanic() {
  console.log('\n=== SCENARIO: use-with-mechanic ===');

  // The convergence combo is LOCATION-LOCKED to baker_street (the Act 5 bookend).
  // Attempting it at bond_office must be blocked…
  const sWrongPlace = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
    inventory: ["Assistant's Forensic Note (copy)", 'From Hell Letter (transcript)', 'Pocket Watch'],
  });
  const rLock = gameEngine.resolve(parseIntent('use forensic note with from hell letter'), sWrongPlace);
  !rLock.actionSuccess
    ? pass('UseWith: convergence combo BLOCKED at bond_office (location-locked to baker_street)')
    : fail('UseWith: combo should be blocked away from baker_street');

  // …and succeed at Baker Street with both documents in hand.
  const sBothItems = buildSnapshot({
    currentAct: 5,
    location: 'baker_street',
    inventory: ["Assistant's Forensic Note (copy)", 'From Hell Letter (transcript)', 'Pocket Watch'],
  });
  const r1 = gameEngine.resolve(parseIntent('use forensic note with from hell letter'), sBothItems);
  r1.actionSuccess
    ? pass('UseWith: convergence combo succeeds at baker_street')
    : fail('UseWith: combination failed at baker_street', r1.blockedReason);
  (r1.discoveredClueIds ?? []).includes('clue_06_prasarved_spelling')
    ? pass('UseWith: clue_06 discovered via the Baker Street convergence')
    : fail('UseWith: clue_06 not discovered from combination');

  // USE combination with item not in inventory → blocked
  const sNoNote = buildSnapshot({
    currentAct: 5,
    location: 'baker_street',
    inventory: ['From Hell Letter (transcript)'],
    // forensic note NOT in inventory
  });
  const r2 = gameEngine.resolve(parseIntent('use forensic note with from hell letter'), sNoNote);
  !r2.actionSuccess
    ? pass('UseWith: blocked when first item not in inventory')
    : fail('UseWith: should be blocked when item not carried');

  // USE unknown combination → blocked with appropriate message
  const r3 = gameEngine.resolve(parseIntent('use letter with kidney parcel'), sBothItems);
  !r3.actionSuccess
    ? pass('UseWith: unknown combination returns actionSuccess=false')
    : fail('UseWith: unknown combination should be blocked');
}

// ── Scenario 13: DROP item ────────────────────────────────────────────────────

function runDropMechanic() {
  console.log('\n=== SCENARIO: drop-mechanic ===');

  const s = buildSnapshot({
    currentAct: 4,
    location: 'lusk_office',
    inventory: ['From Hell Letter (transcript)', 'Pocket Watch'],
  });

  // DROP the letter
  const result = gameEngine.resolve(parseIntent('drop from hell letter'), s);
  result.actionSuccess
    ? pass('Drop: drop from hell letter → actionSuccess=true')
    : fail('Drop: dropping carried item failed', result.blockedReason);

  const next = applyResult(s, result);
  !next.inventory.includes('From Hell Letter (transcript)')
    ? pass('Drop: item removed from inventory after drop')
    : fail('Drop: item still in inventory after drop');

  // DROP item not in inventory → blocked
  const r2 = gameEngine.resolve(parseIntent('drop forensic note'), s);
  !r2.actionSuccess
    ? pass('Drop: blocked when item not carried')
    : fail('Drop: should be blocked when item not in inventory');
}

// ── Scenario 14: Talk-gated act advance + anchor auto-move + follower carry ──

function runTalkGatedAdvance() {
  console.log('\n=== SCENARIO: talk-gated-advance ===');

  // Act 0 with all other gate flags already set — the TALK is the last gate
  // action. Pre-fix this soft-locked (talk never fired act progression).
  const s = buildSnapshot({
    flags: {
      examined_baker_street_case_files_wall: true,
      examined_baker_street_telegrams_pile: true,
      showed_newspaper_pile_to_holmes: true,
    },
  });
  const result = gameEngine.resolve(parseIntent('talk to holmes'), s);

  result.newAct === 1
    ? pass('TalkGated: act advances when a TALK completes the gate')
    : fail(`TalkGated: expected newAct=1, got ${result.newAct} — talk progression fix broken`);

  result.newLocation === 'dorset_street'
    ? pass('TalkGated: anchor auto-move fired (baker_street → dorset_street)')
    : fail(`TalkGated: expected newLocation=dorset_street, got ${result.newLocation}`);

  const holmesMoved = result.npcUpdates?.['holmes']?.currentLocation === 'dorset_street';
  holmesMoved
    ? pass('TalkGated: Holmes (follows_watson) carried to the anchor')
    : fail(`TalkGated: Holmes not carried — npcUpdates.holmes=${JSON.stringify(result.npcUpdates?.['holmes'])}`);
}

// ── Scenario 15: Notebook — Persons of Interest ───────────────────────────────

function runNotebookPoi() {
  console.log('\n=== SCENARIO: notebook-poi ===');

  // Before any POI requiresFlag is set → no Persons of Interest section
  const sFresh = buildSnapshot();
  const r1 = gameEngine.resolve(parseIntent('notebook'), sFresh);
  !r1.aiContext.actionResultNote.includes('PERSONS OF INTEREST')
    ? pass('NotebookPoi: no POI section before any person is encountered')
    : fail('NotebookPoi: POI section leaked before requiresFlag set');

  // After the mortuary examine → Bond appears as a person of interest
  const sMet = buildSnapshot({
    currentAct: 2,
    flags: { examined_whitechapel_mortuary: true },
  });
  const r2 = gameEngine.resolve(parseIntent('notebook'), sMet);
  r2.aiContext.actionResultNote.includes('PERSONS OF INTEREST') &&
  r2.aiContext.actionResultNote.includes('Dr. Thomas Bond')
    ? pass('NotebookPoi: Bond listed once requiresFlag is set')
    : fail('NotebookPoi: Bond missing from POI section');

  // Edmund must never appear in the ledger (design rule)
  !r2.aiContext.actionResultNote.toLowerCase().includes('edmund')
    ? pass('NotebookPoi: Edmund never listed (ambient-invisibility rule)')
    : fail('NotebookPoi: Edmund leaked into the POI ledger');
}

// ── Scenario 16: Intent parser — verb typo correction ─────────────────────────

function runTypoCorrection() {
  console.log('\n=== SCENARIO: typo-correction ===');

  const cases: Array<{ input: string; type: string; targetId?: string; label: string }> = [
    { input: 'exmaine the case files wall', type: 'examine', targetId: 'case_files_wall', label: 'transposed examine resolves target' },
    { input: 'spek to holmes', type: 'talk', targetId: 'holmes', label: 'misspelled speak → talk' },
    { input: 'shwo letter to holmes', type: 'show', targetId: 'from_hell_letter', label: 'transposed show keeps show intent (not implicit examine)' },
    { input: 'dorp letter', type: 'drop', targetId: 'from_hell_letter', label: 'transposed drop keeps drop intent' },
    { input: 'raed letter', type: 'read', targetId: 'from_hell_letter', label: 'transposed read keeps read intent' },
  ];
  for (const c of cases) {
    const r = parseIntent(c.input);
    r.type === c.type && r.targetId === c.targetId
      ? pass(`Typo: ${c.label}`)
      : fail(`Typo: ${c.label}`, `got type=${r.type} targetId=${r.targetId}`);
  }

  // Raw input is preserved for the AI context
  const rRaw = parseIntent('exmaine the case files wall');
  rRaw.raw === 'exmaine the case files wall'
    ? pass('Typo: original raw input preserved after correction')
    : fail('Typo: raw input was rewritten', rRaw.raw);

  // No false positives: legitimate inputs and gibberish are untouched
  const rLegit = parseIntent('take the lantern');
  rLegit.type === 'take'
    ? pass('Typo: legitimate verb unaffected')
    : fail('Typo: legitimate verb misparsed', rLegit.type);
  const rNoise = parseIntent('blorptastic nonsense');
  rNoise.type === 'other'
    ? pass('Typo: gibberish still falls through to other')
    : fail('Typo: gibberish incorrectly matched a verb', rNoise.type);
}

// ── Scenario 17: USE combination act gate (spoiler containment) ───────────────

function runUseCombinationActGate() {
  console.log('\n=== SCENARIO: use-combination-act-gate ===');

  // kidney_parcel + autopsy_ledger grants clue_08 (asylum-reveal content) and
  // must be blocked before Act 6 even with both documents in hand.
  const inv = ['Kidney Examination Notes', 'Autopsy Ledger Notes'];
  const sAct4 = buildSnapshot({ currentAct: 4, location: 'lusk_office', inventory: inv });
  const r1 = gameEngine.resolve(parseIntent('use kidney parcel with autopsy ledger'), sAct4);
  !r1.actionSuccess && r1.discoveredClueIds.length === 0
    ? pass('ActGate: kidney/ledger combination blocked in Act 4')
    : fail('ActGate: clue_08 grantable before Act 6', JSON.stringify(r1.discoveredClueIds));
  !r1.aiContext.actionResultNote.toLowerCase().includes('edmund') &&
  !r1.aiContext.actionResultNote.toLowerCase().includes('asylum')
    ? pass('ActGate: blocked note leaks neither Edmund nor the asylum')
    : fail('ActGate: blocked note contains spoiler content');

  const sAct6 = buildSnapshot({ currentAct: 6, location: 'private_asylum', inventory: inv });
  const r2 = gameEngine.resolve(parseIntent('use kidney parcel with autopsy ledger'), sAct6);
  r2.actionSuccess && r2.discoveredClueIds.includes('clue_08_preserved_kidney')
    ? pass('ActGate: combination grants clue_08 in Act 6')
    : fail('ActGate: combination broken in Act 6', JSON.stringify(r2.discoveredClueIds));
}

// ── Scenario 18: itemsGained in narration context ─────────────────────────────

function runItemsGained() {
  console.log('\n=== SCENARIO: items-gained ===');

  // Examine-grant: newspaper_pile yields the Dear Boss clipping (Act 0)
  const s = buildSnapshot();
  const r1 = gameEngine.resolve(parseIntent('examine the newspaper pile'), s);
  r1.aiContext.itemsGained?.some(i => i.includes('Dear Boss'))
    ? pass('ItemsGained: examine-grant surfaces item in aiContext')
    : fail('ItemsGained: examine-grant missing from aiContext', JSON.stringify(r1.aiContext.itemsGained));

  // Already-owned: re-examining must NOT report a gain
  const sOwned = buildSnapshot({
    inventory: ['Newspaper Clipping (the "Dear Boss" letter)'],
    flags: { examined_baker_street_newspaper_pile: true },
  });
  const r2 = gameEngine.resolve(parseIntent('examine the newspaper pile'), sOwned);
  !r2.aiContext.itemsGained
    ? pass('ItemsGained: no phantom gain on re-examine')
    : fail('ItemsGained: phantom gain reported', JSON.stringify(r2.aiContext.itemsGained));

  // Explicit take
  const sTake = buildSnapshot();
  const r3 = gameEngine.resolve(parseIntent('take the newspaper pile'), sTake);
  r3.aiContext.itemsGained?.some(i => i.includes('Dear Boss'))
    ? pass('ItemsGained: take surfaces item in aiContext')
    : fail('ItemsGained: take missing from aiContext', JSON.stringify(r3.aiContext.itemsGained));
}

// ── Scenario 19: Inventory item awareness ─────────────────────────────────────

function runInventoryAwareness() {
  console.log('\n=== SCENARIO: inventory-awareness ===');

  // Alias precedence: "dear boss letter" must resolve to newspaper_pile,
  // not from_hell_letter (the shorter 'letter' alias).
  const r1 = parseIntent('examine dear boss letter');
  r1.targetId === 'newspaper_pile'
    ? pass('InvAware: "dear boss letter" resolves to newspaper_pile (longest alias wins)')
    : fail('InvAware: alias precedence broken', `got ${r1.targetId}`);
  const r2 = parseIntent('read the newspaper clipping about the dear boss letter');
  r2.targetId === 'newspaper_pile'
    ? pass('InvAware: "newspaper clipping..." resolves to newspaper_pile')
    : fail('InvAware: clipping alias broken', `got ${r2.targetId}`);
  // Bare "letter" still resolves to the From Hell letter
  const r3 = parseIntent('examine the letter');
  r3.targetId === 'from_hell_letter'
    ? pass('InvAware: bare "letter" still resolves to from_hell_letter')
    : fail('InvAware: bare letter alias regressed', `got ${r3.targetId}`);

  // Carried copy: examining an object not present at the location but whose
  // takeable item is in inventory must succeed, never "not present here".
  const sCarrying = buildSnapshot({
    currentAct: 4,
    location: 'lusk_office',
    inventory: ['Newspaper Clipping (the "Dear Boss" letter)'],
  });
  const r4 = gameEngine.resolve(parseIntent('examine the newspaper clipping'), sCarrying);
  r4.actionSuccess && r4.aiContext.actionResultNote.includes('medical bag')
    ? pass('InvAware: carried item examinable away from its source location')
    : fail('InvAware: carried item blocked', r4.aiContext.actionResultNote.slice(0, 120));

  // Not carried and not present → still correctly blocked
  const sEmpty = buildSnapshot({ currentAct: 4, location: 'lusk_office' });
  const r5 = gameEngine.resolve(parseIntent('examine the newspaper clipping'), sEmpty);
  !r5.actionSuccess
    ? pass('InvAware: absent + not carried still blocked')
    : fail('InvAware: phantom examine of absent object');
}

// ── Scenario 20: Living world (vignettes, weather drift, idle, deduce hint) ───

function runLivingWorld() {
  console.log('\n=== SCENARIO: living-world ===');

  // Vignette fires once on full-mode narration, then never again
  const s1 = buildSnapshot({ currentAct: 1, location: 'dorset_street' });
  const r1 = gameEngine.resolve(parseIntent('look'), s1);
  const v1 = r1.aiContext.vignette;
  const vFlag = Object.keys(r1.flagsUpdate ?? {}).find(k => k.startsWith('vignette_dorset_street_'));
  v1 && vFlag
    ? pass('LivingWorld: vignette fires on full-mode with once-only flag')
    : fail('LivingWorld: vignette missing', JSON.stringify({ v1: !!v1, vFlag }));
  // With ALL vignette flags set, none fires
  const allVignetteFlags: Record<string, boolean> = {};
  for (let i = 0; i < 5; i++) allVignetteFlags[`vignette_dorset_street_${i}`] = true;
  const s2 = buildSnapshot({ currentAct: 1, location: 'dorset_street', flags: allVignetteFlags });
  const r2 = gameEngine.resolve(parseIntent('look'), s2);
  !r2.aiContext.vignette
    ? pass('LivingWorld: spent vignettes never refire')
    : fail('LivingWorld: vignette refired after flag set');

  // Weather drift: Act 0 shifts to fog after 120 elapsed minutes
  const sEarly = buildSnapshot({ elapsedMinutes: 30 });
  const sLate  = buildSnapshot({ elapsedMinutes: 130 });
  const wEarly = gameEngine.resolve(parseIntent('look'), sEarly).aiContext.weather;
  const wLate  = gameEngine.resolve(parseIntent('look'), sLate).aiContext.weather;
  wEarly.condition === 'clear-night' && wLate.condition === 'foggy'
    ? pass('LivingWorld: intra-act weather drift (clear-night → foggy after 120min)')
    : fail('LivingWorld: weather drift broken', JSON.stringify({ wEarly, wLate }));

  // Idle behavior rotates with turnCount and never targets the interviewed NPC
  const idleAt = (tc: number) => {
    const s = buildSnapshot({ turnCount: tc });
    const r = gameEngine.resolve(parseIntent('examine the whitechapel map'), s);
    return (r.aiContext.npcScriptedLines ?? []).find(l =>
      l.npcId === 'holmes' && l.instruction.startsWith('Background only'))?.instruction;
  };
  const i0 = idleAt(0), i1 = idleAt(1);
  i0 && i1 && i0 !== i1
    ? pass('LivingWorld: Holmes idle behavior present and rotates by turn')
    : fail('LivingWorld: idle rotation broken', JSON.stringify({ i0, i1 }));
  const sTalk = buildSnapshot({ turnCount: 0 });
  const rTalk = gameEngine.resolve(parseIntent('talk to holmes'), sTalk);
  !(rTalk.aiContext.npcScriptedLines ?? []).some(l => l.instruction.startsWith('Background only') && l.npcId === 'holmes')
    ? pass('LivingWorld: no idle line for the NPC being interviewed')
    : fail('LivingWorld: idle line injected during interview');

  // Blocked deduction names accessible ground not yet covered (spoiler-safe)
  const sDeduce = buildSnapshot({ currentAct: 2, location: 'whitechapel_mortuary', discoveredClueIds: ['clue_00_case_overview'] });
  const rD = gameEngine.resolve(parseIntent('deduce Dr Bond is the killer'), sDeduce);
  const note = rD.aiContext.actionResultNote;
  !rD.actionSuccess && /ground not yet covered/.test(note)
    ? pass('LivingWorld: low-clue deduction points at uncovered locations')
    : fail('LivingWorld: deduce hint missing', note.slice(0, 140));
  !/prasarved|edmund|halward|asylum/i.test(note)
    ? pass('LivingWorld: deduce hint is spoiler-safe')
    : fail('LivingWorld: deduce hint leaks clue content');
}

// ── Scenario 21: Show dative form + single-NPC default ────────────────────────

function runShowDative() {
  console.log('\n=== SCENARIO: show-dative ===');

  // "show holmes the newspaper clipping" must keep BOTH npc and item
  const r1 = parseIntent('Show holmes the newspaper clipping');
  r1.type === 'show' && r1.targetId === 'newspaper_pile' && r1.showTargetNpcId === 'holmes'
    ? pass('ShowDative: "show holmes the clipping" resolves npc + item')
    : fail('ShowDative: dative parse broken', JSON.stringify({ t: r1.targetId, n: r1.showTargetNpcId }));
  // Classic "show X to Y" unchanged
  const r2 = parseIntent('show the newspaper clipping to holmes');
  r2.showTargetNpcId === 'holmes' && r2.targetId === 'newspaper_pile'
    ? pass('ShowDative: classic "show X to Y" unchanged')
    : fail('ShowDative: classic form regressed');

  // Engine: "show clipping" with only Holmes present defaults to Holmes and
  // sets the Act 0 gate flag (this was the prologue softlock).
  const s = buildSnapshot({
    inventory: [...INITIAL_INVENTORY, 'Newspaper Clipping (the "Dear Boss" letter)'],
    flags: { examined_baker_street_newspaper_pile: true },
  });
  const r3 = gameEngine.resolve(parseIntent('show the newspaper clipping'), s);
  r3.actionSuccess && r3.flagsUpdate?.['showed_newspaper_pile_to_holmes']
    ? pass('ShowDative: single-NPC default sets showed_..._to_holmes gate flag')
    : fail('ShowDative: single-NPC default broken', JSON.stringify(r3.flagsUpdate));

  // Full dative phrasing also satisfies the gate
  const r4 = gameEngine.resolve(parseIntent('Show holmes the newspaper clipping'), s);
  r4.actionSuccess && r4.flagsUpdate?.['showed_newspaper_pile_to_holmes']
    ? pass('ShowDative: dative phrasing satisfies the Act 0 gate')
    : fail('ShowDative: dative phrasing fails the gate', JSON.stringify(r4.flagsUpdate));

  // Re-examining the pile with the clipping held must instruct the AI not to re-take
  const r5 = gameEngine.resolve(parseIntent('examine the newspaper pile'), s);
  r5.aiContext.actionResultNote.includes('do NOT narrate him taking')
    ? pass('ShowDative: re-examine carries do-not-retake instruction')
    : fail('ShowDative: re-take guard missing', r5.aiContext.actionResultNote.slice(0, 140));
}
// ── Scenario 16: Partial object matching ──────────────────────────────────────

function runPartialObjectMatching() {
  console.log('\n=== SCENARIO: partial-object-matching ===');

  // "examine case wall" should resolve to case_files_wall (2 words match "Case Files Wall")
  const s = buildSnapshot();
  const r1 = gameEngine.resolve(parseIntent('examine case wall'), s);
  r1.aiContext.actionResultNote.includes('SUCCESS') && r1.actionSuccess
    ? pass('PartialMatch: "examine case wall" resolves to case_files_wall')
    : fail(`PartialMatch: "examine case wall" did not resolve — actionSuccess=${r1.actionSuccess} note=${r1.aiContext.actionResultNote.slice(0, 80)}`);

  // "examine the case files wall" (full name) should still work
  const r2 = gameEngine.resolve(parseIntent('examine the case files wall'), s);
  r2.actionSuccess
    ? pass('PartialMatch: full name "examine the case files wall" still resolves')
    : fail('PartialMatch: full name broke after partial matching change');

  // Words that don't match any object's word set should not resolve to an object
  const r3 = parseIntent('examine ghostly vapours');
  r3.targetId === undefined
    ? pass('PartialMatch: non-matching words do not false-positive to an object')
    : fail(`PartialMatch: "examine ghostly vapours" false-matched targetId=${r3.targetId}`);
}

// ── Scenario 17: Unresolved target narration ─────────────────────────────────

function runUnresolvedTargetNarration() {
  console.log('\n=== SCENARIO: unresolved-target-narration ===');

  const s = buildSnapshot(); // baker_street, act 0

  // An object-like but unrecognisable target ("case archives" shares "case"
  // with known objects) should become type 'unresolved_target'
  const intent = parseIntent('examine the case archives');
  intent.type === 'unresolved_target'
    ? pass('UnresolvedTarget: object-like unrecognised examine → type is unresolved_target')
    : fail(`UnresolvedTarget: expected type=unresolved_target, got ${intent.type}`);

  const r = gameEngine.resolve(intent, s);
  !r.actionSuccess
    ? pass('UnresolvedTarget: actionSuccess is false')
    : fail('UnresolvedTarget: should not succeed');

  r.aiContext.actionResultNote.includes('UNRESOLVED TARGET')
    ? pass('UnresolvedTarget: actionResultNote includes UNRESOLVED TARGET prompt')
    : fail(`UnresolvedTarget: missing UNRESOLVED TARGET in note: ${r.aiContext.actionResultNote.slice(0, 120)}`);

  // Note should include the raw target phrase so Watson can quote it
  r.aiContext.actionResultNote.includes('case archives')
    ? pass('UnresolvedTarget: raw target phrase quoted in actionResultNote')
    : fail('UnresolvedTarget: raw target phrase missing from actionResultNote');

  // Note should list available objects at the current location
  r.aiContext.actionResultNote.includes('Case Files Wall')
    ? pass('UnresolvedTarget: available objects listed in actionResultNote')
    : fail('UnresolvedTarget: available objects not listed in actionResultNote');

  // Atmospheric/world phrase ("examine the fog") shares no object word →
  // falls back to a world query rather than unresolved_target
  const atmospheric = parseIntent('examine the fog');
  atmospheric.type === 'query'
    ? pass('UnresolvedTarget: atmospheric "examine the fog" falls back to query')
    : fail(`UnresolvedTarget: expected query fallback, got ${atmospheric.type}`);
}

// ── Fact graph: deriveKnowledgeEnvelope ──────────────────────────────────────

function runFactGraphDerivation() {
  console.log('\n=== SCENARIO: fact-graph-derivation ===');

  const testFacts: StoryFact[] = [
    { id: 'f_shared', statement: 'shared fact', knownBy: ['a', 'b'], visibleFromAct: 0 },
    { id: 'f_a_only', statement: 'a-only fact', knownBy: ['a'],      visibleFromAct: 0 },
    { id: 'f_late',   statement: 'late fact',   knownBy: ['a'],      visibleFromAct: 4 },
  ];

  const actual = deriveKnowledgeEnvelope(testFacts, 'a', 2);
  JSON.stringify(actual) === JSON.stringify(['shared fact', 'a-only fact'])
    ? pass('deriveKnowledgeEnvelope filters by knownBy and act gate, preserves order')
    : fail('deriveKnowledgeEnvelope wrong result', JSON.stringify(actual));

  const late = deriveKnowledgeEnvelope(testFacts, 'a', 4);
  late.length === 3 && late[2] === 'late fact'
    ? pass('deriveKnowledgeEnvelope admits act-gated facts once the act arrives')
    : fail('act-gated fact not admitted at its act', JSON.stringify(late));

  const other = deriveKnowledgeEnvelope(testFacts, 'c', 6);
  other.length === 0
    ? pass('deriveKnowledgeEnvelope returns empty for an NPC with no facts')
    : fail('expected empty envelope for unknown npc', JSON.stringify(other));
}

// ── Phase 4a: schedule parity ────────────────────────────────────────────────
// The scheduleByAct migration is parity-first: with no byPeriod overrides
// authored, npcLocationAt must equal the legacy canonicalLocationByAct for
// every NPC × act × period. This table is the pre-migration data, verbatim.
function testScheduleParity() {
  const LEGACY_CANONICAL: Record<string, Record<number, string>> = {
    holmes:         { 0: 'baker_street', 1: 'dorset_street', 2: 'whitechapel_mortuary', 3: 'dutfields_yard', 4: 'lusk_office', 5: 'bond_office', 6: 'private_asylum' },
    abberline:      { 0: 'h_division_station', 1: 'dorset_street', 2: 'h_division_station', 3: 'working_mens_club', 4: 'lusk_office', 5: 'bond_office', 6: 'private_asylum' },
    bond:           { 0: 'whitechapel_mortuary', 1: 'millers_court', 2: 'whitechapel_mortuary', 3: 'whitechapel_mortuary', 4: 'lusk_office', 5: 'bond_office', 6: 'bond_office' },
    edmund:         { 0: 'whitechapel_mortuary', 1: 'millers_court', 2: 'whitechapel_mortuary', 3: 'whitechapel_mortuary', 4: 'lusk_office', 5: 'bond_office', 6: 'private_asylum' },
    lusk:           { 4: 'lusk_office', 5: 'lusk_office', 6: 'lusk_office' },
    diemschutz:     { 0: 'working_mens_club', 1: 'working_mens_club', 2: 'working_mens_club', 3: 'working_mens_club', 4: 'working_mens_club', 5: 'working_mens_club', 6: 'working_mens_club' },
    hutchinson:     { 1: 'dorset_street', 2: 'whitechapel_pub', 3: 'whitechapel_pub' },
    phillips:       { 2: 'whitechapel_mortuary', 3: 'whitechapel_mortuary' },
    tumblety:       { 2: 'h_division_station', 3: 'h_division_station' },
    pizer:          { 3: 'working_mens_club' },
    superintendent: { 0: 'private_asylum', 1: 'private_asylum', 2: 'private_asylum', 3: 'private_asylum', 4: 'private_asylum', 5: 'private_asylum', 6: 'private_asylum' },
  };

  let mismatches = 0;
  for (const npcId of Object.keys(NPCS)) {
    for (let act = 0; act <= 6; act++) {
      const expected = LEGACY_CANONICAL[npcId]?.[act] ?? 'offstage';
      for (const period of PERIOD_ORDER) {
        const got = npcLocationAt(NPCS, npcId, act, period, {});
        if (got !== expected) {
          fail(`schedule parity: ${npcId} act ${act} ${period}`, `expected ${expected}, got ${got}`);
          mismatches++;
        }
      }
    }
  }
  if (mismatches === 0) pass('schedule parity: npcLocationAt === legacy canonicalLocationByAct for all NPCs × acts × periods');

  // Follower precedence: a stored currentLocation must still win for an
  // active follower (Holmes), and the schedule must win for a
  // location_based NPC even when a stale currentLocation is stored.
  if (npcLocationAt(NPCS, 'holmes', 1, 'morning', { holmes: { npcId: 'holmes', disposition: 50, status: 'alive', currentLocation: 'millers_court' } as any }) === 'millers_court') {
    pass('schedule precedence: follower stored currentLocation wins');
  } else {
    fail('schedule precedence: follower stored currentLocation wins');
  }
  if (npcLocationAt(NPCS, 'abberline', 2, 'morning', { abberline: { npcId: 'abberline', disposition: 50, status: 'alive', currentLocation: 'dorset_street' } as any }) === 'h_division_station') {
    pass('schedule precedence: schedule beats stale stored location for location_based NPC');
  } else {
    fail('schedule precedence: schedule beats stale stored location for location_based NPC');
  }

  // timePeriodFor: act 2 starts 9:00 AM (540) — morning; +180 → afternoon.
  if (timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, 2, 0) === 'morning' &&
      timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, 2, 180) === 'afternoon') {
    pass('timePeriodFor anchors to act canonical start');
  } else {
    fail('timePeriodFor anchors to act canonical start');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

try {
  runWinningPath();
  runColdCaseBond();
  runColdCaseAbberline();
  runActGateBoundary();
  runBlockedActions();
  runNpcAliasIntegrity();
  runPrematureAsylum();
  runClueDedupe();
  runDeductionThreshold();
  runShowMechanic();
  runReadMechanic();
  runUseWithMechanic();
  runDropMechanic();
  runTalkGatedAdvance();
  runNotebookPoi();
  runTypoCorrection();
  runUseCombinationActGate();
  runItemsGained();
  runInventoryAwareness();
  runLivingWorld();
  runShowDative();
  runPartialObjectMatching();
  runUnresolvedTargetNarration();
  runFactGraphDerivation();
  testScheduleParity();
} catch (err) {
  console.error('\n[FATAL] Uncaught exception in test harness:', err);
  process.exit(1);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passes} passed · ${fails} failed · ${warns} warnings`);
console.log('─'.repeat(60));

if (fails > 0) {
  console.error(`\n✗ ${fails} test(s) FAILED — these are real bugs`);
  process.exit(1);
} else {
  console.log(`\n✓ All tests passed${warns > 0 ? ` (${warns} warnings — review recommended)` : ''}`);
}
