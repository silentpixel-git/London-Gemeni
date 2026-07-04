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
 *   through aiService.resolveTargetObject() (constrained to the object's location)
 *   and reports the combined lift.
 *
 * Run: npx tsx scripts/qa-parser.ts
 * Exit code 1 if deterministic accuracy regresses below the recorded baseline gate.
 */

import { parseIntent } from '../engine/intentParser';
import { LOCATIONS, OBJECT_DISPLAY_NAMES, NPCS } from '../engine/gameData';
import { getPresentNpcIds } from '../engine/GameEngine';
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';
import { CLUE_TRIGGERS } from '../engine/stories/whitechapel-1888/clues';

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
  { objectId: 'case_files_wall', phrasings: [
    { text: 'case files wall', category: 'exact' },
    { text: 'case wall', category: 'partial' },
    { text: 'case fles wall', category: 'typo' },
    { text: 'case files wal', category: 'typo' },
    { text: 'wall of case papers', category: 'paraphrase' },
    { text: "Holmes's board of cases", category: 'paraphrase' },
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

// Present people at a scene, as alias-aware AI candidates (mirrors the hook so an
// unintroduced NPC's real name never enters the prompt). Nobody introduced yet.
function npcCandidatesFor(scene: { location: string; act: number }): Array<{ id: string; name: string }> {
  return getPresentNpcIds(WHITECHAPEL_MANIFEST.npcs, scene.location, {}, scene.act).map(id => {
    const npc = NPCS[id];
    const introduced = !npc.requiresIntroduction;
    const name = introduced
      ? `${npc.displayName} — ${npc.role}`
      : `${npc.alias ?? 'a stranger'} — ${npc.aliasDescription ?? npc.role}`;
    return { id, name };
  });
}

// ── Build location candidate lists (id + display name) for the AI pass ─────────
function candidatesFor(locId: string): Array<{ id: string; name: string }> {
  const loc = (LOCATIONS as Record<string, { interactables?: string[] }>)[locId];
  const ids = loc?.interactables ?? Object.keys(CLUE_TRIGGERS[locId] ?? {});
  return ids.map(id => ({ id, name: OBJECT_DISPLAY_NAMES[id] ?? id }));
}

interface Miss { objectId: string; locId: string; text: string; category: Category; got?: string }

async function main() {
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
    console.log('\n=== HYBRID PASS (AI fallback on deterministic misses) ===\n');
    const { aiService } = await import('../server/aiCore');
    let recovered = 0;
    for (const m of misses) {
      try {
        const { objectId } = await aiService.resolveTargetObject(m.text, 'examine', candidatesFor(m.locId));
        const ok = objectId === m.objectId;
        if (ok) recovered++;
        console.log(`  [${ok ? 'OK ' : '   '}] "examine ${m.text}" → ${objectId ?? 'null'} (want ${m.objectId})`);
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
    console.log('\n  Tier-2 (AI fallback) on paraphrases:');
    const { aiService } = await import('../server/aiCore');
    let npcRecovered = 0;
    for (const m of npcParaMisses) {
      try {
        const { objectId } = await aiService.resolveTargetObject(m.text, 'talk', npcCandidatesFor(m.scene), 'person');
        const ok = objectId === m.npcId;
        if (ok) npcRecovered++;
        console.log(`    [${ok ? 'OK ' : '   '}] "talk to ${m.text}" → ${objectId ?? 'none'} (want ${m.npcId})`);
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
}

main();
