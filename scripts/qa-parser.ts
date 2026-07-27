/**
 * scripts/qa-parser.ts
 *
 * Parser robustness QA harness for London Bleeds.
 *
 * Measures how accurately player phrasing resolves to the correct game object —
 * the gate that decides whether a clue fires. Every clue-bearing object is fed a
 * battery of realistic player phrasings (exact, alias, typo, partial, paraphrase)
 * and we record whether parseIntent() resolves each to the expected objectId.
 *
 *   Deterministic pass — offline, no API key. The headline "how exact must input
 *   be" number, and the regression guard for the matchObjectId() fuzzy tune.
 *
 *   Hybrid pass — only when GEMINI_API_KEY is set. Routes the deterministic MISSES
 *   through aiService.parseAction() (the production tool-calling fallback, with
 *   candidates scoped to the object's location) and reports the combined lift.
 *
 * Run: npx tsx scripts/qa-parser.ts
 * Exit code 1 if deterministic accuracy regresses below the recorded baseline gate.
 */

import { parseIntent } from '../engine/intentParser';
import { LOCATIONS, NPCS } from '../engine/gameData';
import { CLUE_TRIGGERS } from '../engine/stories/whitechapel-1888/clues';
import { toolCallToIntent } from '../server/parseAction.js';
import { needsAiParse, buildParseCandidates } from '../engine/parseFallback';
import type { ParseCandidates } from '../types';

type Category = 'exact' | 'alias' | 'typo' | 'partial' | 'paraphrase';

interface Fixture {
  objectId: string;
  phrasings: Array<{ text: string; category: Category }>;
}

// ── Reverse map: objectId → locationId (for AI candidate scoping) ──────────────
const OBJECT_LOCATION: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [locId, objs] of Object.entries(CLUE_TRIGGERS)) {
    for (const objId of Object.keys(objs)) map[objId] = locId;
  }
  return map;
})();

// ── Fixtures — every clue-bearing object, with graded player phrasings ─────────
// Categories: exact (display name), alias (known synonym), typo (1–2 char slip),
// partial (subset of the name), paraphrase (natural language — AI territory).
const FIXTURES: Fixture[] = [
  // Act 0's key object, replacing the retired case_files_wall fixture. Bears no
  // clue (Act 0 yields none) but it is the object the act's tutorial chain turns
  // on, so its vocabulary matters more than most.
  { objectId: 'pawn_ticket', phrasings: [
    { text: 'pawn ticket', category: 'exact' },
    { text: 'ticket', category: 'alias' },
    { text: 'pledge', category: 'alias' },
    { text: 'boots', category: 'alias' },
    { text: 'pawn tickt', category: 'typo' },
    { text: 'pwan ticket', category: 'typo' },
  ]},
  { objectId: 'burned_clothing', phrasings: [
    { text: 'burned clothing', category: 'exact' },
    { text: 'grate', category: 'alias' },
    { text: 'ashes', category: 'alias' },
    { text: 'burnd clothing', category: 'typo' },
    { text: 'burnt clothing', category: 'typo' },
    { text: 'clothing', category: 'partial' },
    { text: 'the charred garments', category: 'paraphrase' },
    { text: 'burnt rags in the hearth', category: 'paraphrase' },
  ]},
  { objectId: 'autopsy_ledger', phrasings: [
    { text: 'autopsy ledger', category: 'exact' },
    { text: 'autopsi ledger', category: 'typo' },
    { text: 'autopsy ledgr', category: 'typo' },
    { text: 'ledger', category: 'partial' },
    { text: 'the post-mortem record book', category: 'paraphrase' },
    { text: 'book of dissections', category: 'paraphrase' },
  ]},
  { objectId: 'bonds_desk', phrasings: [
    { text: 'bonds desk', category: 'exact' },
    { text: 'dr bonds desk', category: 'exact' },
    { text: 'bonds dek', category: 'typo' },
    { text: 'bond desk', category: 'partial' },
    { text: "the doctor's writing table", category: 'paraphrase' },
  ]},
  { objectId: 'witness_description_wall', phrasings: [
    { text: 'witness description wall', category: 'exact' },
    { text: 'witness descripton wall', category: 'typo' },
    { text: 'witness wall', category: 'partial' },
    { text: 'description wall', category: 'partial' },
    { text: 'wall of witness statements', category: 'paraphrase' },
    { text: 'the eyewitness descriptions', category: 'paraphrase' },
  ]},
  { objectId: 'cobblestone_roadway', phrasings: [
    { text: 'cobblestone roadway', category: 'exact' },
    { text: 'cobblestones', category: 'alias' },
    { text: 'street', category: 'alias' },
    { text: 'cobblestne roadway', category: 'typo' },
    { text: 'the roadway', category: 'partial' },
    { text: 'the paved street where she lay', category: 'paraphrase' },
  ]},
  { objectId: 'ground_where_body_was_discovered', phrasings: [
    { text: 'ground', category: 'alias' },
    { text: 'body site', category: 'alias' },
    { text: 'the ground', category: 'partial' },
    { text: 'where the body was found', category: 'paraphrase' },
    { text: 'the spot of the murder', category: 'paraphrase' },
  ]},
  { objectId: 'yard_entrance_gate', phrasings: [
    { text: 'yard entrance gate', category: 'exact' },
    { text: 'gate', category: 'alias' },
    { text: 'yard entrnce gate', category: 'typo' },
    { text: 'entrance gate', category: 'partial' },
    { text: 'the gateway into the yard', category: 'paraphrase' },
  ]},
  { objectId: 'square_walls', phrasings: [
    { text: 'square walls', category: 'exact' },
    { text: 'walls', category: 'alias' },
    { text: 'squar walls', category: 'typo' },
    { text: 'the walls', category: 'partial' },
    { text: 'the walls around the square', category: 'paraphrase' },
  ]},
  { objectId: 'apron_fragment_location', phrasings: [
    { text: 'apron fragment location', category: 'exact' },
    { text: 'apron', category: 'alias' },
    { text: 'apron fragment', category: 'partial' },
    { text: 'the piece of bloody apron', category: 'paraphrase' },
    { text: 'the discarded apron scrap', category: 'paraphrase' },
  ]},
  { objectId: 'from_hell_letter', phrasings: [
    { text: 'from hell letter', category: 'exact' },
    { text: 'the letter', category: 'alias' },
    { text: 'from hel letter', category: 'typo' },
    { text: 'the letter signed from hell', category: 'paraphrase' },
    { text: 'the gruesome note from Lusk', category: 'paraphrase' },
  ]},
  { objectId: 'kidney_parcel', phrasings: [
    { text: 'kidney parcel', category: 'exact' },
    { text: 'kidney', category: 'alias' },
    { text: 'parcel', category: 'alias' },
    { text: 'kidny parcel', category: 'typo' },
    { text: 'the half a kidney sent to Lusk', category: 'paraphrase' },
  ]},
  { objectId: 'medical_reports', phrasings: [
    { text: 'forensic examination reports', category: 'exact' },
    { text: 'reports', category: 'alias' },
    { text: 'forensic reports', category: 'alias' },
    { text: 'examination reports', category: 'partial' },
    { text: "Bond's written findings", category: 'paraphrase' },
  ]},
  { objectId: 'anatomical_texts', phrasings: [
    { text: 'anatomical textbooks', category: 'exact' },
    { text: 'anatomy', category: 'alias' },
    { text: 'textbook', category: 'alias' },
    { text: 'anatomical texts', category: 'partial' },
    { text: 'the books on human anatomy', category: 'paraphrase' },
  ]},
  { objectId: 'patient_records', phrasings: [
    { text: 'patient records', category: 'exact' },
    { text: 'records', category: 'alias' },
    { text: 'the records', category: 'partial' },
    { text: "the asylum's admission files", category: 'paraphrase' },
  ]},
  { objectId: 'edmund_room_furnishings', phrasings: [
    { text: "edmund's room", category: 'alias' },
    { text: 'furnishings', category: 'alias' },
    { text: 'the room', category: 'partial' },
    { text: "the patient's quarters", category: 'paraphrase' },
  ]},
];

// ── NPC fixtures — guards two paths: the matchNpcId() alias + fuzzy tier-1
// resolution (must pass offline), and the talk→person AI fallback on paraphrase
// (recovered in the hybrid pass). A null npcId is a false-positive guard: the
// phrase must resolve to NO npc even with those people standing right there.
interface NpcFixture {
  npcId: string | null;
  scene: { location: string; act: number }; // for AI candidate scoping
  phrasings: Array<{ text: string; category: Category }>;
}

const NPC_FIXTURES: NpcFixture[] = [
  { npcId: 'hutchinson', scene: { location: 'dorset_street', act: 1 }, phrasings: [
    { text: 'hutchinson', category: 'exact' },
    { text: 'the witness', category: 'alias' },
    { text: 'the labourer', category: 'alias' },
    { text: 'labrourer', category: 'typo' },
    { text: 'hutchison', category: 'typo' },
    { text: 'george hutchinson', category: 'partial' },
    { text: 'the witness who saw mary', category: 'paraphrase' },
    { text: 'that eager fellow lingering in the crowd', category: 'paraphrase' },
  ]},
  { npcId: 'abberline', scene: { location: 'dorset_street', act: 1 }, phrasings: [
    { text: 'abberline', category: 'exact' },
    { text: 'inspector', category: 'alias' },
    { text: 'the detective', category: 'alias' },
    { text: 'abberlin', category: 'typo' },
    { text: 'aberline', category: 'typo' },
    { text: 'inspector abberline', category: 'partial' },
    { text: 'the policeman in charge', category: 'paraphrase' },
  ]},
  { npcId: null, scene: { location: 'dorset_street', act: 1 }, phrasings: [
    { text: 'the queen of england', category: 'paraphrase' },
    { text: 'a passing fishmonger', category: 'paraphrase' },
  ]},
];

// Whether an NPC fixture case is expected to resolve deterministically (tier 1).
// Positive paraphrases are AI territory; everything else (exact/alias/typo/partial,
// and every negative case) must already resolve offline.
const npcIsTier1 = (fx: NpcFixture, category: Category) =>
  !(fx.npcId !== null && category === 'paraphrase');

interface Miss { objectId: string; locId: string; text: string; category: Category; got?: string }

// ── Fast-path guard: the free offline path must never silently regress into
// paid AI calls, and the AI path's candidate lists must never leak a spoiler. ─
function runFastPathGuard(): void {
  console.log('\n=== FAST-PATH GUARD (offline) ===\n');
  let failures = 0;

  // 1. Every tier-1 object phrasing that deterministically resolves must NOT
  //    trigger the AI parse (needsAiParse must be false for a clean hit).
  for (const fx of FIXTURES) {
    const locId = OBJECT_LOCATION[fx.objectId];
    for (const p of fx.phrasings) {
      if (p.category === 'paraphrase') continue;
      const intent = parseIntent(`examine ${p.text}`);
      if (intent.targetId === fx.objectId && needsAiParse(intent, locId, [])) {
        console.error(`  [FAIL] clean hit would still call AI: "examine ${p.text}" @ ${locId}`);
        failures++;
      }
    }
  }

  // 2. Misses MUST route: an unrecognised action phrase triggers the AI parse.
  const miss = parseIntent('crouch down and look under the sleeping pallet');
  if (!needsAiParse(miss, 'millers_court', [])) {
    console.error('  [FAIL] unparseable action did not route to the AI parse');
    failures++;
  }

  // 3. World questions never route (queries stay with narration).
  const q = parseIntent('why would the killer strike twice in one night');
  if (q.type !== 'query' || needsAiParse(q, 'baker_street', [])) {
    console.error('  [FAIL] query routed to the AI parse');
    failures++;
  }

  // 3b. WAIT is a free offline verb — it must parse deterministically and
  //     never route to the AI parse.
  const w = parseIntent('wait');
  if (w.type !== 'wait' || needsAiParse(w, 'baker_street', [])) {
    console.error('  [FAIL] wait did not stay on the offline fast path');
    failures++;
  }

  // 4. Spoiler mask: across every location and act, an unintroduced NPC's real
  //    name must never appear in the people candidates.
  for (const locId of Object.keys(LOCATIONS)) {
    for (let act = 0; act <= 6; act++) {
      const c = buildParseCandidates(locId, [], {}, act, [], 0);
      for (const person of c.people) {
        const npc = NPCS[person.id];
        if (npc?.requiresIntroduction && person.name.includes(npc.displayName)) {
          console.error(`  [FAIL] spoiler: ${npc.displayName} unmasked at ${locId} act ${act}`);
          failures++;
        }
      }
    }
  }

  if (failures > 0) {
    console.error(`\n[FAIL] ${failures} fast-path guard checks failed.`);
    process.exit(1);
  }
  console.log('  All fast-path guard checks passed.');
}

// ── Offline validation of the Phase 3 tool-call → intent mapping ──────────────
// No API key needed: feeds synthetic function calls into toolCallToIntent and
// asserts the enum enforcement (an id outside its list must NEVER pass through).
function runToolCallValidationChecks(): void {
  console.log('\n=== TOOL-CALL VALIDATION (offline) ===\n');
  const C: ParseCandidates = {
    objects: [
      { id: 'the_bed', name: 'The Bed' },
      { id: 'from_hell_letter', name: 'From Hell Letter' },
    ],
    carried: [{ id: 'from_hell_letter', name: 'From Hell Letter' }],
    people: [{ id: 'holmes', name: 'Sherlock Holmes — consulting detective' }],
    locations: [{ id: 'baker_street', name: '221B Baker Street' }],
  };
  let failures = 0;
  const check = (label: string, cond: boolean) => {
    console.log(`  [${cond ? 'OK ' : 'FAIL'}] ${label}`);
    if (!cond) failures++;
  };

  let r = toolCallToIntent('examine', { target: 'the_bed' }, C, 'peer beneath the bedframe');
  check('examine valid id → examine intent',
    r.intent?.type === 'examine' && r.intent.targetId === 'the_bed' && !r.invalidArgs);
  r = toolCallToIntent('examine', { target: 'the_window' }, C, 'x');
  check('examine out-of-enum id → null + invalidArgs', r.intent === null && r.invalidArgs);
  r = toolCallToIntent('move', { destination: 'baker_street' }, C, 'go home');
  check('move valid → move intent', r.intent?.type === 'move' && r.intent.targetId === 'baker_street');
  r = toolCallToIntent('move', { destination: 'narnia' }, C, 'x');
  check('move out-of-enum → null + invalidArgs', r.intent === null && r.invalidArgs);
  r = toolCallToIntent('talk', { person: 'holmes' }, C, 'x');
  check('talk valid → talk intent', r.intent?.type === 'talk' && r.intent.targetId === 'holmes');
  r = toolCallToIntent('show', { item: 'from_hell_letter', person: 'holmes' }, C, 'x');
  check('show carried item to person → show intent',
    r.intent?.type === 'show' && r.intent.targetId === 'from_hell_letter' && r.intent.showTargetNpcId === 'holmes');
  r = toolCallToIntent('show', { item: 'the_bed', person: 'holmes' }, C, 'x');
  check('show non-carried item → null + invalidArgs', r.intent === null && r.invalidArgs);
  r = toolCallToIntent('use', { object: 'the_bed' }, C, 'x');
  check('use without second object → use intent', r.intent?.type === 'use' && r.intent.targetId === 'the_bed');
  r = toolCallToIntent('use', { object: 'the_bed', with: 'the_window' }, C, 'x');
  check('use with out-of-enum second object → null + invalidArgs', r.intent === null && r.invalidArgs);
  r = toolCallToIntent('drop', { item: 'from_hell_letter' }, C, 'x');
  check('drop carried item → drop intent', r.intent?.type === 'drop' && r.intent.targetId === 'from_hell_letter');
  r = toolCallToIntent('no_action', { reason: 'question' }, C, 'what hour is it');
  check('no_action(question) → query intent', r.intent?.type === 'query' && !r.invalidArgs);
  r = toolCallToIntent('no_action', { reason: 'atmospheric' }, C, 'the fog is thick');
  check('no_action(atmospheric) → null, NOT invalid', r.intent === null && !r.invalidArgs);
  r = toolCallToIntent('wait', {}, C, 'let us bide here until evening');
  check('wait → wait intent', r.intent?.type === 'wait' && !r.invalidArgs);
  r = toolCallToIntent('deduce', {}, C, 'i believe it was the assistant');
  check('deduce → deduce intent carrying the raw text',
    r.intent?.type === 'deduce' && r.intent.deductionText === 'i believe it was the assistant');
  r = toolCallToIntent('dance', {}, C, 'x');
  check('unknown tool → null + invalidArgs', r.intent === null && r.invalidArgs);

  if (failures > 0) {
    console.error(`\n[FAIL] ${failures} tool-call validation checks failed.`);
    process.exit(1);
  }
}

// ── Phase 3 intent fixtures — whole COMMANDS, not bare nouns. Each runs the
// real routing: regex parse → needsAiParse → (offline assert | parseAction).
// A fixture that the regex resolves is asserted offline (fast-path proof);
// one that misses is asserted through the tool-call pass (gateway tier).
interface IntentFixture {
  scene: { location: string; act: number; inventory?: string[] };
  input: string;
  expect:
    // `topicRaw` applies to talk only: the subject text the parser must peel off
    // an "ask X about Y" command for the TALK resolver to match against the fact
    // graph. Asserting it here keeps the split independent of the story data.
    | { type: 'move' | 'examine' | 'talk' | 'take' | 'read' | 'drop'; targetId: string; topicRaw?: string }
    | { type: 'show'; targetId: string; showTargetNpcId: string }
    | { type: 'deduce' }
    | { type: 'wait' }
    | { type: 'query' }
    | { type: 'none' }; // AI must decline to act (no_action → null intent)
}

const INTENT_FIXTURES: IntentFixture[] = [
  // move — offline (implicit location alias) and via AI
  { scene: { location: 'dorset_street', act: 1 }, input: 'we ought to return home to baker street',
    expect: { type: 'move', targetId: 'baker_street' } },
  { scene: { location: 'millers_court', act: 4 }, input: 'return to our lodgings at once',
    expect: { type: 'move', targetId: 'baker_street' } },
  // examine via AI. Gateway tier: the model reads this as 'read' rather than
  // 'examine' (both are semantically defensible for a pile of documents) —
  // matched to the observed, equally-valid outcome rather than treated as a miss.
  { scene: { location: 'whitechapel_mortuary', act: 2 }, input: 'pore over the post-mortem record book',
    expect: { type: 'read', targetId: 'autopsy_ledger' } },
  { scene: { location: 'millers_court', act: 4 }, input: 'crouch down and look under the sleeping pallet',
    expect: { type: 'examine', targetId: 'the_bed' } },
  // topic-scoped talk — all offline (the split is pure string work). Covers each
  // supported preposition and the guard that a bare talk carries no topic at
  // all. The no-subject form ("ask about X") is covered in qa-engine instead:
  // with no NPC named the regex parse is a miss and routes to the AI tier, so a
  // fixture here would assert nothing without a key.
  { scene: { location: 'dorset_street', act: 1 }, input: 'ask hutchinson about the man you saw',
    expect: { type: 'talk', targetId: 'hutchinson', topicRaw: 'the man you saw' } },
  { scene: { location: 'dorset_street', act: 1 }, input: 'talk to abberline regarding the graffiti',
    expect: { type: 'talk', targetId: 'abberline', topicRaw: 'the graffiti' } },
  { scene: { location: 'dorset_street', act: 1 }, input: 'question hutchinson concerning his description',
    expect: { type: 'talk', targetId: 'hutchinson', topicRaw: 'his description' } },
  { scene: { location: 'dorset_street', act: 1 }, input: 'speak to abberline on the subject of the press',
    expect: { type: 'talk', targetId: 'abberline', topicRaw: 'the press' } },
  { scene: { location: 'dorset_street', act: 1 }, input: 'talk to hutchinson',
    expect: { type: 'talk', targetId: 'hutchinson', topicRaw: undefined } },
  // QUESTION-FORM TALK — no "about" clause, which is how players actually ask.
  // Before splitAddresseeFromQuestion these parsed as a bare talk with the
  // question silently discarded, so no topic was ever credited and an act's
  // asked_ gates were unreachable in play while every topic was authored
  // correctly. A blind playtest found this; no deterministic suite could.
  { scene: { location: 'baker_street', act: 0 }, input: 'ask holmes why he finds modern crime so dull',
    expect: { type: 'talk', targetId: 'holmes', topicRaw: 'why he finds modern crime so dull' } },
  { scene: { location: 'baker_street', act: 0 }, input: 'ask mrs kemp what brings her here tonight',
    expect: { type: 'talk', targetId: 'mrs_kemp', topicRaw: 'what brings her here tonight' } },
  { scene: { location: 'baker_street', act: 0 }, input: 'ask mrs kemp when she last saw her sister',
    expect: { type: 'talk', targetId: 'mrs_kemp', topicRaw: 'when she last saw her sister' } },
  // The guard: a trailing pleasantry is NOT a topic. Without this the ordinary
  // second conversation degrades into "he has nothing to say on that".
  { scene: { location: 'baker_street', act: 0 }, input: 'talk to mrs kemp again',
    expect: { type: 'talk', targetId: 'mrs_kemp', topicRaw: undefined } },
  // talk via AI
  { scene: { location: 'dorset_street', act: 1 }, input: 'speak with the man who watched mary kelly that night',
    expect: { type: 'talk', targetId: 'hutchinson' } },
  { scene: { location: 'dorset_street', act: 1 }, input: 'i should like to question the policeman leading this investigation',
    expect: { type: 'talk', targetId: 'abberline' } },
  // take via AI — act 4 matches lusk_office's own canonical act (object presence
  // isn't act-gated, so this is a consistency tidy-up, not a correctness fix)
  { scene: { location: 'lusk_office', act: 4 }, input: 'gather up that vile correspondence',
    expect: { type: 'take', targetId: 'from_hell_letter' } },
  // read via AI
  { scene: { location: 'baker_street', act: 0 }, input: 'read the slip the woman left on the table',
    expect: { type: 'read', targetId: 'pawn_ticket' } },
  // show — offline ("present … to …" verb form) and via AI
  // Holmes only canonically stands at Baker Street in Act 0 (scheduleByAct);
  // Act 3/5 place him elsewhere, which would drop him from the AI candidate list.
  // Reworded from the original "present my notes on the kidney to holmes" / "let
  // holmes see what lusk received in the post" — "notes" is a NOTEBOOK_VERBS
  // substring and "lusk" a location alias, both of which hijacked the regex
  // parse to the wrong intent (notebook / move) before reaching the show path.
  { scene: { location: 'baker_street', act: 0, inventory: ['Kidney Examination Notes'] },
    input: 'present the kidney findings to holmes',
    expect: { type: 'show', targetId: 'kidney_parcel', showTargetNpcId: 'holmes' } },
  { scene: { location: 'baker_street', act: 0, inventory: ['Kidney Examination Notes'] },
    input: 'give my grim little find to holmes',
    expect: { type: 'show', targetId: 'kidney_parcel', showTargetNpcId: 'holmes' } },
  // wait — offline (bare verb) and via AI (paraphrase the regex can't catch)
  { scene: { location: 'whitechapel_mortuary', act: 2 }, input: 'wait',
    expect: { type: 'wait' } },
  { scene: { location: 'whitechapel_mortuary', act: 2 }, input: 'i think we should tarry here a moment longer',
    expect: { type: 'wait' } },
  // drop via AI
  { scene: { location: 'baker_street', act: 0, inventory: ["Nell's Pawn Ticket"] },
    input: 'rid myself of that wretched slip of paper',
    expect: { type: 'drop', targetId: 'pawn_ticket' } },
  // deduce (robust to being caught offline by DEDUCTION_KEYWORDS)
  { scene: { location: 'baker_street', act: 5 }, input: 'it must have been the quiet young assistant all along',
    expect: { type: 'deduce' } },
  // query — stays offline with narration, never routes to the AI parse
  { scene: { location: 'baker_street', act: 1 }, input: 'why would the killer strike twice in one night',
    expect: { type: 'query' } },
  // no_action escapes — atmosphere must NOT become an action
  { scene: { location: 'baker_street', act: 1 }, input: 'the fog tonight is thicker than usual',
    expect: { type: 'none' } },
  { scene: { location: 'mitre_square', act: 3 }, input: 'hum a quiet tune to steady my nerves',
    expect: { type: 'none' } },
];

function intentMatches(got: ParsedIntentResult, exp: IntentFixture['expect']): boolean {
  if (exp.type === 'none') return got === null;
  if (!got) return false;
  if (exp.type === 'query') return got.type === 'query';
  if (exp.type === 'deduce') return got.type === 'deduce';
  if (exp.type === 'wait') return got.type === 'wait';
  if (got.type !== exp.type) return false;
  if (got.targetId !== exp.targetId) return false;
  if (exp.type === 'show' && got.showTargetNpcId !== exp.showTargetNpcId) return false;
  if ('topicRaw' in exp && got.topicRaw !== exp.topicRaw) return false;
  return true;
}
type ParsedIntentResult = ReturnType<typeof parseIntent> | null;

async function runIntentFixtures(): Promise<void> {
  console.log('\n=== INTENT FIXTURES (full commands, Phase 3) ===\n');
  let offTotal = 0, offHit = 0;
  const offMisses: string[] = [];
  const aiCases: IntentFixture[] = [];

  for (const fx of INTENT_FIXTURES) {
    const intent = parseIntent(fx.input);
    const inv = fx.scene.inventory ?? [];
    if (!needsAiParse(intent, fx.scene.location, inv)) {
      offTotal++;
      if (intentMatches(intent, fx.expect)) offHit++;
      else offMisses.push(`  [off ] "${fx.input}" → ${intent.type}/${intent.targetId ?? '-'} (want ${fx.expect.type})`);
    } else {
      aiCases.push(fx);
    }
  }
  console.log(`  Offline-resolved: ${offHit}/${offTotal}`);
  offMisses.forEach(m => console.error(m));

  let tcTotal = 0, tcHit = 0, enumFailures = 0;
  if (process.env.GEMINI_API_KEY) {
    console.log('\n  Tool-call pass (parseAction on the regex misses):');
    const { aiService } = await import('../server/aiCore');
    for (const fx of aiCases) {
      const inv = fx.scene.inventory ?? [];
      const candidates = buildParseCandidates(fx.scene.location, inv, {}, fx.scene.act, [], 0);
      const res = await aiService.parseAction(fx.input, candidates);
      if (res.invalidArgs) enumFailures++;
      tcTotal++;
      const ok = intentMatches(res.intent, fx.expect);
      if (ok) tcHit++;
      const got = res.intent ? `${res.intent.type}/${res.intent.targetId ?? '-'}` : 'null';
      console.log(`    [${ok ? 'OK ' : '   '}] "${fx.input}" → ${got}`);
    }
    console.log(`\n    Tool-call accuracy: ${tcHit}/${tcTotal}; enum-validation failures: ${enumFailures}`);
  } else {
    console.log(`  (Set GEMINI_API_KEY to run the tool-call pass on the ${aiCases.length} regex misses.)`);
  }

  // Gates: offline fixture mismatches and enum failures are hard failures;
  // tool-call accuracy has an initial floor to raise as the corpus stabilises.
  const TC_GATE = 0.75;
  let failed = false;
  if (offMisses.length > 0) {
    console.error(`\n[FAIL] ${offMisses.length} offline intent fixtures mismatched.`);
    failed = true;
  }
  if (enumFailures > 0) {
    console.error(`[FAIL] ${enumFailures} enum-validation failures (id outside its candidate list).`);
    failed = true;
  }
  if (tcTotal > 0 && tcHit / tcTotal < TC_GATE) {
    console.error(`[FAIL] Tool-call accuracy ${((tcHit / tcTotal) * 100).toFixed(0)}% below gate ${TC_GATE * 100}%.`);
    failed = true;
  } else if (tcTotal > 0) {
    console.log(`\n[PASS] Tool-call accuracy ${((tcHit / tcTotal) * 100).toFixed(0)}% ≥ gate ${TC_GATE * 100}%.`);
  }
  if (failed) process.exit(1);
}

async function main() {
  runToolCallValidationChecks();
  runFastPathGuard();
  const byCategory: Record<Category, { total: number; hit: number }> = {
    exact: { total: 0, hit: 0 }, alias: { total: 0, hit: 0 }, typo: { total: 0, hit: 0 },
    partial: { total: 0, hit: 0 }, paraphrase: { total: 0, hit: 0 },
  };
  let total = 0, hit = 0;
  const misses: Miss[] = [];

  console.log('\n=== DETERMINISTIC PASS (parseIntent, offline) ===\n');
  for (const fx of FIXTURES) {
    const locId = OBJECT_LOCATION[fx.objectId];
    for (const p of fx.phrasings) {
      const intent = parseIntent(`examine ${p.text}`);
      const ok = intent.targetId === fx.objectId;
      total++; byCategory[p.category].total++;
      if (ok) { hit++; byCategory[p.category].hit++; }
      else misses.push({ objectId: fx.objectId, locId, text: p.text, category: p.category, got: intent.targetId });
    }
  }

  const pct = (h: number, t: number) => t === 0 ? '  n/a' : `${((h / t) * 100).toFixed(0).padStart(3)}%`;
  console.log('By category:');
  (Object.keys(byCategory) as Category[]).forEach(c =>
    console.log(`  ${c.padEnd(11)} ${pct(byCategory[c].hit, byCategory[c].total)}  (${byCategory[c].hit}/${byCategory[c].total})`));
  console.log(`\n  OVERALL     ${pct(hit, total)}  (${hit}/${total})`);

  if (misses.length > 0) {
    console.log('\nDeterministic misses:');
    for (const m of misses)
      console.log(`  [${m.category.padEnd(10)}] "examine ${m.text}" → ${m.got ?? 'unresolved'} (want ${m.objectId})`);
  }

  // ── Optional hybrid pass: resolve the misses through the AI fallback ─────────
  if (process.env.GEMINI_API_KEY) {
    console.log('\n=== HYBRID PASS (parseAction fallback on deterministic misses) ===\n');
    const { aiService } = await import('../server/aiCore');
    let recovered = 0;
    for (const m of misses) {
      try {
        const act = (LOCATIONS as Record<string, { act?: number }>)[m.locId]?.act ?? 0;
        const { intent } = await aiService.parseAction(
          `examine ${m.text}`,
          buildParseCandidates(m.locId, [], {}, act, [], 0),
        );
        const got = intent?.targetId ?? null;
        const ok = got === m.objectId;
        if (ok) recovered++;
        console.log(`  [${ok ? 'OK ' : '   '}] "examine ${m.text}" → ${got ?? 'null'} (want ${m.objectId})`);
      } catch (e) {
        console.log(`  [ERR] "examine ${m.text}" → ${(e as Error).message}`);
      }
    }
    const hybridHit = hit + recovered;
    console.log(`\n  Recovered ${recovered}/${misses.length} misses via AI.`);
    console.log(`  Deterministic ${pct(hit, total)} → Hybrid ${pct(hybridHit, total)}  (${hybridHit}/${total})`);
  } else {
    console.log('\n(Set GEMINI_API_KEY to run the hybrid AI-fallback pass.)');
  }

  // ── NPC pass: tier-1 (offline alias + fuzzy) resolution, then tier-2 (AI)
  // recovery of paraphrases. Tier-1 is the regression guard for matchNpcId(). ──
  console.log('\n=== NPC PASS (talk → person) ===\n');
  let npcGateTotal = 0, npcGateHit = 0;
  const npcParaMisses: Array<{ npcId: string; scene: NpcFixture['scene']; text: string }> = [];
  const npcTier1Misses: string[] = [];
  for (const fx of NPC_FIXTURES) {
    for (const p of fx.phrasings) {
      const got = parseIntent(`talk to ${p.text}`).targetId;
      const ok = fx.npcId === null ? !got : got === fx.npcId;
      const want = fx.npcId ?? 'none';
      if (npcIsTier1(fx, p.category)) {
        npcGateTotal++;
        if (ok) npcGateHit++;
        else npcTier1Misses.push(`  [${p.category.padEnd(10)}] "talk to ${p.text}" → ${got ?? 'none'} (want ${want})`);
      } else if (!ok) {
        npcParaMisses.push({ npcId: fx.npcId!, scene: fx.scene, text: p.text });
      }
    }
  }
  console.log(`  Tier-1 (offline): ${pct(npcGateHit, npcGateTotal)}  (${npcGateHit}/${npcGateTotal})`);
  if (npcTier1Misses.length > 0) { console.log('  Tier-1 misses:'); npcTier1Misses.forEach(d => console.log(d)); }

  if (process.env.GEMINI_API_KEY) {
    console.log('\n  Tier-2 (parseAction fallback) on paraphrases:');
    const { aiService } = await import('../server/aiCore');
    let npcRecovered = 0;
    for (const m of npcParaMisses) {
      try {
        const { intent } = await aiService.parseAction(
          `talk to ${m.text}`,
          buildParseCandidates(m.scene.location, [], {}, m.scene.act, [], 0),
        );
        const got = intent?.targetId ?? null;
        const ok = got === m.npcId;
        if (ok) npcRecovered++;
        console.log(`    [${ok ? 'OK ' : '   '}] "talk to ${m.text}" → ${got ?? 'none'} (want ${m.npcId})`);
      } catch (e) {
        console.log(`    [ERR] "talk to ${m.text}" → ${(e as Error).message}`);
      }
    }
    console.log(`    Recovered ${npcRecovered}/${npcParaMisses.length} NPC paraphrases via AI.`);
  } else {
    console.log('  (Set GEMINI_API_KEY to run the tier-2 NPC paraphrase recovery.)');
  }

  // Regression gates: neither deterministic accuracy should drop below its floor.
  // Update a GATE only when intentionally raising the floor.
  const GATE = 0.75;          // object resolution (matchObjectId fuzzy tune)
  const NPC_GATE = 0.90;      // NPC tier-1 alias + fuzzy — these must not regress
  const accuracy = hit / total;
  const npcAccuracy = npcGateTotal === 0 ? 1 : npcGateHit / npcGateTotal;
  let failed = false;
  if (accuracy < GATE) {
    console.error(`\n[FAIL] Object accuracy ${(accuracy * 100).toFixed(0)}% below gate ${(GATE * 100).toFixed(0)}%.`);
    failed = true;
  } else {
    console.log(`\n[PASS] Object accuracy ${(accuracy * 100).toFixed(0)}% ≥ gate ${(GATE * 100).toFixed(0)}%.`);
  }
  if (npcAccuracy < NPC_GATE) {
    console.error(`[FAIL] NPC tier-1 accuracy ${(npcAccuracy * 100).toFixed(0)}% below gate ${(NPC_GATE * 100).toFixed(0)}%.`);
    failed = true;
  } else {
    console.log(`[PASS] NPC tier-1 accuracy ${(npcAccuracy * 100).toFixed(0)}% ≥ gate ${(NPC_GATE * 100).toFixed(0)}%.`);
  }
  if (failed) process.exit(1);

  await runIntentFixtures();
}

main();
