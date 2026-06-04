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

import { gameEngine, SessionSnapshot } from '../engine/GameEngine';
import { parseIntent } from '../engine/intentParser';
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
  return next;
}

// ── Scenario 1: Winning path ──────────────────────────────────────────────────

function runWinningPath() {
  console.log('\n=== SCENARIO: winning-path ===');

  // Act 0 — Baker Street
  // IMPORTANT: resolveTalk does not call checkActProgression.
  // Make the LAST gate-completing action an examine so checkActProgression fires.
  let s = buildSnapshot();
  s = step('Act0', s, 'talk to holmes',          { expectSuccess: true, expectFlag: 'talked_to_holmes_at_baker_street' });
  s = step('Act0', s, 'examine case files wall', { expectSuccess: true, expectFlag: 'examined_baker_street_case_files_wall', expectClue: 'clue_00_campaign_timeline' });
  // Telegrams pile is the 3rd and final flag — examine triggers checkActProgression → act advances
  s = step('Act0', s, 'examine telegrams pile',  { expectSuccess: true, expectFlag: 'examined_baker_street_telegrams_pile', expectAct: 1 });

  // Act 1 — Miller's Court
  // dorset_street.act=1, so now accessible
  s = step('Act1', s, 'go to dorset street',     { expectSuccess: true, expectLocation: 'dorset_street' });
  s = step('Act1', s, 'go to millers court',     { expectSuccess: true, expectLocation: 'millers_court' });
  // Act 1 now requires BOTH burned_clothing AND the_bed (2-of-4 specific examines)
  // burned_clothing sets examined_millers_court_burned_clothing (first gate flag)
  s = step('Act1', s, 'examine burned clothing', { expectSuccess: true, expectFlag: 'examined_millers_court_burned_clothing', expectClue: 'clue_01_killer_confidence' });
  // the_bed sets examined_millers_court_the_bed (second + last gate flag → act advances)
  s = step('Act1', s, 'examine the bed',         { expectSuccess: true, expectFlag: 'examined_millers_court_the_bed', expectAct: 2 });

  // Act 2 — Mortuary + Buck's Row + Hanbury Street
  // Path: millers_court → dorset_street → h_division_station → whitechapel_pub → bucks_row
  s = step('Act2', s, 'go to dorset street',        { expectSuccess: true });
  s = step('Act2', s, 'go to h division station',   { expectSuccess: true, expectLocation: 'h_division_station' });
  s = step('Act2', s, 'go to whitechapel pub',      { expectSuccess: true, expectLocation: 'whitechapel_pub' });
  s = step('Act2', s, 'go to bucks row',            { expectSuccess: true, expectLocation: 'bucks_row' });
  s = step('Act2', s, 'examine cobblestone roadway', { expectSuccess: true, expectFlag: 'examined_bucks_row', expectClue: 'clue_01_respectable_approach' });
  s = step('Act2', s, 'go to whitechapel mortuary', { expectSuccess: true, expectLocation: 'whitechapel_mortuary' });
  s = step('Act2', s, 'examine bonds desk',          { expectSuccess: true, expectFlag: 'examined_whitechapel_mortuary', expectClue: 'clue_02c_small_hands' });
  s = step('Act2', s, 'go to bucks row',             { expectSuccess: true });
  s = step('Act2', s, 'go to hanbury street',        { expectSuccess: true, expectLocation: 'hanbury_street' });
  // Last Act 2 flag: examined_hanbury_street → act advances to 3
  s = step('Act2', s, 'examine ground where body was discovered', {
    expectSuccess: true,
    expectFlag: 'examined_hanbury_street',
    expectClue: 'clue_02_anatomical_knowledge',
    expectAct: 3,
  });

  // Act 3 — Double Event: dutfields_yard, mitre_square, working_mens_club
  s = step('Act3', s, 'go to dutfields yard',    { expectSuccess: true, expectLocation: 'dutfields_yard' });
  s = step('Act3', s, 'examine yard entrance gate', { expectSuccess: true, expectFlag: 'examined_dutfields_yard', expectClue: 'clue_03_interrupted_ritual' });
  s = step('Act3', s, 'go to mitre square',      { expectSuccess: true, expectLocation: 'mitre_square' });
  s = step('Act3', s, 'examine square walls',    { expectSuccess: true, expectFlag: 'examined_mitre_square', expectClue: 'clue_04_kidney_removal' });
  s = step('Act3', s, 'go to dutfields yard',    { expectSuccess: true });
  s = step('Act3', s, 'go to working mens club', { expectSuccess: true, expectLocation: 'working_mens_club' });
  // Last Act 3 flag: examined_working_mens_club → act advances to 4
  s = step('Act3', s, 'examine club members', { expectSuccess: true, expectFlag: 'examined_working_mens_club', expectAct: 4 });

  // Act 4 — Lusk's office (working_mens_club → dutfields_yard → mitre_square → goulston_street → lusk_office)
  s = step('Act4', s, 'go to dutfields yard',    { expectSuccess: true });
  s = step('Act4', s, 'go to mitre square',      { expectSuccess: true });
  s = step('Act4', s, 'go to goulston street',   { expectSuccess: true, expectLocation: 'goulston_street' });
  s = step('Act4', s, 'go to lusk office',       { expectSuccess: true, expectLocation: 'lusk_office' });
  // Last Act 4 flag: examined_lusk_office → act advances to 5
  s = step('Act4', s, 'examine from hell letter', {
    expectSuccess: true,
    expectFlag: 'examined_lusk_office',
    expectClue: 'clue_05_from_hell_letter',
    expectAct: 5,
  });

  // Act 5 — Bond's office (lusk_office → bond_office)
  s = step('Act5', s, 'go to bond office', { expectSuccess: true, expectLocation: 'bond_office' });
  // Last Act 5 flag: examined_bond_office → act advances to 6
  s = step('Act5', s, 'examine edmund forensic note', {
    expectSuccess: true,
    expectFlag: 'examined_bond_office',
    expectClue: 'clue_06_prasarved_spelling',
    expectAct: 6,
  });

  // Act 6 — Correct deduction requires clue_06 (prasarved spelling) as smoking gun.
  // It is now in discoveredClueIds from the bond_office examine above.
  s = step('Act6', s, 'deduce Edmund Halward is the killer', {
    expectSuccess: true,
    expectFlag: 'asylum_unlocked',
    expectGameOver: false, // gameOver fires when examined at asylum, not on deduction itself
  });
  s = step('Act6', s, 'go to private asylum', {
    expectSuccess: true,
    expectLocation: 'private_asylum',
  });
  // Examining patient_records sets visited_private_asylum → last Act 6 gate flag → gameOver=true
  s = step('Act6', s, 'examine patient records', {
    expectSuccess: true,
    expectFlag: 'visited_private_asylum',
    expectGameOver: true,
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

  // Act 2: 2/3 flags (mortuary + bucks_row, missing hanbury_street)
  // Examine something at baker_street — doesn't set hanbury flag → gate holds
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
      holmes: { npcId: 'holmes', currentLocation: 'bond_office', status: 'alive', memory: [] },
    },
  });
  const r1 = gameEngine.resolve(parseIntent('show forensic note to holmes'), sWithNote);
  r1.actionSuccess
    ? pass('Show: show forensic note to holmes → actionSuccess=true')
    : fail('Show: show forensic note to holmes failed', r1.blockedReason);
  (r1.discoveredClueIds ?? []).includes('clue_06_prasarved_spelling')
    ? pass('Show: clue_06 discovered via show (alternate path)')
    : fail('Show: clue_06 not discovered from show forensic note to holmes');

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

  // USE forensic note WITH from hell letter → alternate clue_06 path
  const sBothItems = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
    inventory: ["Assistant's Forensic Note (copy)", 'From Hell Letter (transcript)', 'Pocket Watch'],
  });
  const r1 = gameEngine.resolve(parseIntent('use forensic note with from hell letter'), sBothItems);
  r1.actionSuccess
    ? pass('UseWith: forensic note with from hell letter → actionSuccess=true')
    : fail('UseWith: combination failed', r1.blockedReason);
  (r1.discoveredClueIds ?? []).includes('clue_06_prasarved_spelling')
    ? pass('UseWith: clue_06 discovered via use-with combination')
    : fail('UseWith: clue_06 not discovered from combination');

  // USE combination with item not in inventory → blocked
  const sNoNote = buildSnapshot({
    currentAct: 5,
    location: 'bond_office',
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
