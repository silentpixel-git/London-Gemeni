/**
 * scripts/qa-topics.ts
 *
 * TALK-topic phrasing accuracy — the missing twin of qa-parser.ts.
 *
 * qa:parser asks "if a player types a reasonable phrase for an OBJECT, does the
 * engine find it?" Nothing asked the same question of TALK subjects, and that
 * is exactly where the content bugs clustered: a player types "her visit" or
 * "if she went to the constables", matchTopic's string containment misses, and
 * the NPC answers by denying knowledge of something the story owns.
 *
 * Golden tests cannot catch this class. They drive the phrasings the author
 * chose, so they pass while the game is broken for anyone who words it
 * differently — qa-golden asks "answer the door" and never noticed that
 * "answer door" was dead.
 *
 * Tier 1 (deterministic, offline, no key): authored phrases and light variants
 * must resolve to their own fact. This is the regression gate.
 * Tier 2 (needs GEMINI_API_KEY): true paraphrases — the ones no author would
 * think to enumerate — routed through the same parseTopic fallback the live
 * game uses. Reported, and gated separately.
 *
 * Run: npx tsx scripts/qa-topics.ts
 */

import { matchTopic } from '../engine/stories/knowledge';
import { buildTopicCandidates, needsTopicAiParse } from '../engine/topicFallback';
import { parseIntent } from '../engine/intentParser';
import { WHITECHAPEL_MANIFEST as M } from '../engine/stories/whitechapel-1888/manifest';
import type { StoryFact } from '../engine/stories/types';

// Every requireFlags-gated fact simultaneously open: the widest window a real
// playthrough reaches, and the one where topic collisions actually bite.
const MAXIMAL_FLAGS: Record<string, boolean> = {};
for (const f of M.facts) for (const flag of f.requireFlags ?? []) MAXIMAL_FLAGS[flag] = true;

let hit = 0, total = 0;
const failures: string[] = [];

function check(npcId: string, act: number, phrase: string, wantFactId: string, kind: string) {
  total++;
  const got = matchTopic(M.facts, npcId, act, phrase, MAXIMAL_FLAGS);
  if (got?.id === wantFactId) { hit++; return; }
  failures.push(`  [${kind}] ${npcId} a${act}: "${phrase}" -> ${got?.id ?? 'MISS'} (want ${wantFactId})`);
}

/**
 * Light mechanical variants of an authored phrase — the shapes a player
 * produces without meaning anything different. Deliberately NOT paraphrase:
 * these must work with no AI tier at all.
 */
function variantsOf(phrase: string): Array<{ text: string; kind: string }> {
  const out: Array<{ text: string; kind: string }> = [];
  const stripped = phrase.replace(/^(the|a|an|your|her|his|their)\s+/, '');
  if (stripped !== phrase) out.push({ text: stripped, kind: 'no-article' });
  if (!/^(the)\s/.test(phrase)) out.push({ text: `the ${stripped}`, kind: 'the-prefixed' });
  return out;
}

function main(): boolean {
  console.log('=== TIER 1: deterministic topic resolution (offline) ===\n');

  const npcIds = [...new Set(M.facts.flatMap(f => f.knownBy))];
  for (const npcId of npcIds) {
    for (const fact of M.facts) {
      if (!fact.knownBy.includes(npcId) || !fact.topics?.length) continue;
      const act = fact.visibleFromAct ?? 0;
      for (const phrase of fact.topics) {
        // The authored phrase itself must reach its own fact. This is the
        // partial-match-theft guard from qa:validate, re-asserted here at the
        // phrasing layer so a topic edit can't silently orphan a fact.
        check(npcId, act, phrase, fact.id, 'authored');
        for (const v of variantsOf(phrase)) check(npcId, act, v.text, fact.id, v.kind);
      }
    }
  }

  const accuracy = total === 0 ? 1 : hit / total;
  console.log(`Resolved ${hit}/${total} (${(accuracy * 100).toFixed(1)}%)`);
  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    for (const f of failures.slice(0, 40)) console.log(f);
    if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
  }

  // Coverage: a fact reachable by only one or two phrasings is a playtest bug
  // waiting to happen. Reported as a warning, not a gate — the AI tier now
  // covers the tail, and forcing synonym-padding on every fact is busywork.
  const thin = M.facts.filter(f => (f.topics?.length ?? 0) <= 2);
  console.log(`\n[INFO] ${thin.length}/${M.facts.length} facts have <= 2 authored phrasings.`);

  const GATE = 1.0; // authored phrases must always reach their own fact
  let failed = false;
  if (accuracy < GATE) {
    console.error(`\n[FAIL] Topic accuracy ${(accuracy * 100).toFixed(1)}% below gate ${(GATE * 100).toFixed(0)}%.`);
    failed = true;
  } else {
    console.log(`\n[PASS] Topic accuracy ${(accuracy * 100).toFixed(1)}% >= gate ${(GATE * 100).toFixed(0)}%.`);
  }
  return failed;
}

// ── TIER 2: paraphrase recovery through the live fallback ───────────────────
// The phrasings no author enumerates. Hand-written per fact rather than
// generated, so a regression here means the fallback changed, not that a
// generator drifted. Each entry is a subject a player might plausibly type,
// paired with the fact it must reach — plus decoys that must reach NOTHING,
// because a confident wrong answer is worse than an honest miss.
const PARAPHRASES: Array<{ npc: string; npcLabel: string; act: number; phrase: string; want: string | null }> = [
  // Regression guard for MIN_QUERY_COVERAGE. 'nell' is a substring of this
  // question, and before the specificity gate matchTopic claimed it outright —
  // answering "Nell is missing" to a question about where she lived, with the
  // AI tier never consulted. The gate now treats a 4-char topic inside a
  // 21-char query as an incidental mention and defers. If this regresses to
  // kemp_sister_missing, the gate has been weakened or bypassed.
  { npc: 'mrs_kemp', npcLabel: 'Mrs. Kemp', act: 0, phrase: 'where nell was lodging', want: 'kemp_landlady' },
  { npc: 'mrs_kemp', npcLabel: 'Mrs. Kemp', act: 0, phrase: 'if she went to the constables', want: 'kemp_police_wont_look' },
  { npc: 'mrs_kemp', npcLabel: 'Mrs. Kemp', act: 0, phrase: 'what she pawned', want: 'kemp_pawn_ticket' },
  { npc: 'mrs_kemp', npcLabel: 'Mrs. Kemp', act: 0, phrase: 'the omnibus fare', want: null },
  { npc: 'mrs_kemp', npcLabel: 'Mrs. Kemp', act: 0, phrase: 'jack the ripper', want: null },
  { npc: 'holmes', npcLabel: 'Sherlock Holmes', act: 0, phrase: 'why he said hampstead', want: 'holmes_heath_road_dust' },
  { npc: 'holmes', npcLabel: 'Sherlock Holmes', act: 0, phrase: 'the tanyards', want: 'holmes_boots_bermondsey' },
  { npc: 'holmes', npcLabel: 'Sherlock Holmes', act: 0, phrase: 'the price of coal', want: null },
];

async function runParaphrasePass(): Promise<boolean> {
  if (!process.env.GEMINI_API_KEY) {
    console.log('\n=== TIER 2: paraphrase recovery ===');
    console.log('  (Set GEMINI_API_KEY to exercise the parseTopic fallback.)');
    return false;
  }
  const { aiService } = await import('../server/aiCore');
  console.log('\n=== TIER 2: paraphrase recovery via parseTopic ===\n');

  let recovered = 0, correctlyRefused = 0, wrong = 0;
  for (const p of PARAPHRASES) {
    const intent = parseIntent(`ask x about ${p.phrase}`);
    const needsAi = needsTopicAiParse(M.facts, { ...intent, targetId: p.npc }, p.npc, p.act, MAXIMAL_FLAGS);
    let gotId: string | null = null;
    if (!needsAi) {
      gotId = matchTopic(M.facts, p.npc, p.act, p.phrase, MAXIMAL_FLAGS)?.id ?? null;
    } else {
      const cands = buildTopicCandidates(M.facts, p.npc, p.act, MAXIMAL_FLAGS);
      gotId = (await aiService.parseTopic(p.phrase, p.npcLabel, cands))?.factId ?? null;
    }
    const ok = gotId === p.want;
    if (ok) { p.want === null ? correctlyRefused++ : recovered++; }
    else wrong++;
    const tag = ok ? 'OK  ' : 'BAD ';
    console.log(`${tag} ${p.npc} "${p.phrase}" -> ${gotId ?? 'none'}${ok ? '' : `  (want ${p.want ?? 'none'})`}`);
  }

  const wanted = PARAPHRASES.filter(p => p.want !== null).length;
  const decoys = PARAPHRASES.length - wanted;
  console.log(`\nRecovered ${recovered}/${wanted} paraphrases; correctly refused ${correctlyRefused}/${decoys} decoys.`);

  // Decoys are the hard gate: a wrong confident answer is the failure mode this
  // whole tier exists to prevent. Recovery rate is reported, not gated — it is
  // model-dependent and a miss there degrades to an honest in-character deflect.
  if (correctlyRefused < decoys) {
    console.error(`[FAIL] ${decoys - correctlyRefused} decoy(s) got a confident wrong answer.`);
    return true;
  }
  console.log('[PASS] No decoy received a confident wrong answer.');
  return false;
}

(async () => {
  const tier1Failed = main();
  const tier2Failed = await runParaphrasePass();
  if (tier1Failed || tier2Failed) process.exit(1);
})();
