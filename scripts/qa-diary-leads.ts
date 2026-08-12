/**
 * scripts/qa-diary-leads.ts
 * Deterministic QA for Watson's diary lead-marking / gap-filling. No AI, no
 * browser, no Supabase.
 * Run: npx tsx scripts/qa-diary-leads.ts   (exit code 1 on any FAIL)
 */
import { resolveDiaryEntry } from '../engine/stories/whitechapel-1888/diary';
import { ACT_PROGRESSION } from '../engine/stories/whitechapel-1888/acts';
import { CLUE_DEFINITIONS } from '../engine/stories/whitechapel-1888/clues';
import { DECISION_BY_FLAG } from '../engine/stories/whitechapel-1888/diaryDecisions';
import {
  isRequiredFlag,
  clueGateFlag,
  leadContextFor,
  detectSilentLeadFlags,
} from '../engine/stories/whitechapel-1888/diaryLeads';

let passes = 0, fails = 0;
function pass(l: string) { console.log(`[PASS] ${l}`); passes++; }
function fail(l: string, d?: string) { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; }

// 1) resolveDiaryEntry: hand-authored DECISION_DIARY entry still resolves as before.
{
  const authored = resolveDiaryEntry({ kind: 'decision', refId: 'read_pawn_ticket' });
  authored?.title === 'The Pawn Ticket'
    ? pass('resolveDiaryEntry: hand-authored decision entry resolves via DECISION_DIARY')
    : fail('resolveDiaryEntry broke the hand-authored decision path', JSON.stringify(authored));
}

// 2) resolveDiaryEntry: AI-generated decision entry (no DECISION_DIARY match) parses
//    title/body from entry.text ("title\nbody").
{
  const generated = resolveDiaryEntry({
    kind: 'decision',
    refId: 'asked_holmes_about_holmes_man_no_one_remembers',
    text: 'A Word with Holmes\nHe would not be drawn beyond what the wall already told us.',
  });
  (generated?.title === 'A Word with Holmes'
    && generated?.body === 'He would not be drawn beyond what the wall already told us.')
    ? pass('resolveDiaryEntry: AI-generated decision entry parses title/body from text')
    : fail('resolveDiaryEntry did not parse the AI-generated entry correctly', JSON.stringify(generated));
}

// 3) resolveDiaryEntry: a decision entry with neither a DECISION_DIARY match nor
//    stored text returns null (matches every other "can't resolve" case).
{
  const empty = resolveDiaryEntry({ kind: 'decision', refId: 'no_such_flag' });
  empty === null
    ? pass('resolveDiaryEntry: unresolvable decision entry returns null')
    : fail('resolveDiaryEntry should return null with no match and no text', JSON.stringify(empty));
}

const SENTINEL = '__advance_via_correct_deduction_only__';

// 4) Drift guard: every real gate flag either has existing diary coverage
//    (a clue trigger or a DECISION_DIARY entry) or has hint-objective context
//    available for AI generation — nothing falls through with no way to
//    describe itself.
for (const [actStr, cond] of Object.entries(ACT_PROGRESSION)) {
  const act = Number(actStr);
  for (const f of cond.requireFlags) {
    if (f === SENTINEL) continue;
    const hasDecision = Boolean(DECISION_BY_FLAG[f]);
    const hasClue = Object.values(CLUE_DEFINITIONS).some(def => clueGateFlag(def) === f);
    const hasHintContext = leadContextFor(act, f) !== null;
    (hasDecision || hasClue || hasHintContext)
      ? pass(`gate has a diary path: act ${act} ${f}`)
      : fail('gate has NO diary coverage and NO hint context for AI generation', `act ${act} ${f}`);
  }
}

// 5) isRequiredFlag: true only for real gate flags of the given act; excludes
//    the Act 5 sentinel and flags belonging to other acts.
{
  isRequiredFlag(0, 'act0_closing_complete')
    ? pass('isRequiredFlag: true for a real Act 0 gate flag')
    : fail('isRequiredFlag should be true for a real Act 0 gate flag');
  isRequiredFlag(5, SENTINEL)
    ? fail('isRequiredFlag should exclude the Act 5 sentinel')
    : pass('isRequiredFlag: sentinel excluded');
  isRequiredFlag(0, 'talked_to_hutchinson_at_dorset_street')
    ? fail('isRequiredFlag should not match a flag belonging to a different act')
    : pass('isRequiredFlag: cross-act flag correctly excluded');
}

// 6) clueGateFlag: derives a clue's examine flag from its location + trigger.
//    (Was clue_00_campaign_timeline, retired with Act 0's case-files wall.)
{
  const def = CLUE_DEFINITIONS['clue_01_killer_confidence'];
  clueGateFlag(def) === 'examined_millers_court_burned_clothing'
    ? pass('clueGateFlag: clue_01_killer_confidence maps to its real gate flag')
    : fail('clueGateFlag mismatch', clueGateFlag(def));
}

// 7) detectSilentLeadFlags: reconstruction has an authored decision entry,
//    while the caller and closing semantic gates need generated lead entries.
{
  const silent = detectSilentLeadFlags({
    actNumber: 0,
    flagsUpdate: {
      act0_caller_noticed: true,
      examined_baker_street_pawn_ticket: true,
      act0_reconstruction_complete: true,
      act0_closing_complete: true,
    },
    priorFlags: {},
    discoveredClueIds: [],
  });
  const set = new Set(silent);
  (set.size === 2
    && set.has('act0_caller_noticed')
    && set.has('act0_closing_complete'))
    ? pass('detectSilentLeadFlags: Act 0 turn returns exactly the 2 uncovered leads')
    : fail('detectSilentLeadFlags returned the wrong set', silent.join(','));
}

// 8) detectSilentLeadFlags: a flag already true before this turn is never re-queued.
{
  const silent = detectSilentLeadFlags({
    actNumber: 0,
    flagsUpdate: { act0_closing_complete: true },
    priorFlags: { act0_closing_complete: true },
    discoveredClueIds: [],
  });
  silent.length === 0
    ? pass('detectSilentLeadFlags: already-true flags are not re-queued')
    : fail('detectSilentLeadFlags re-queued an already-true flag', silent.join(','));
}

// 9) detectSilentLeadFlags: a non-gate flag (not in requireFlags) is ignored.
{
  const silent = detectSilentLeadFlags({
    actNumber: 0,
    flagsUpdate: { examined_baker_street_violin_case: true },
    priorFlags: {},
    discoveredClueIds: [],
  });
  silent.length === 0
    ? pass('detectSilentLeadFlags: non-gate flags are ignored')
    : fail('detectSilentLeadFlags picked up a non-gate flag', silent.join(','));
}

// 10) leadContextFor: Act 6's location-level examine gate (visited_private_asylum)
//     resolves to hint context — it is that location's locationExaminedFlag, the
//     same mechanism as examined_baker_street, not an arrival flag.
{
  leadContextFor(6, 'visited_private_asylum') !== null
    ? pass('leadContextFor: Act 6 location-examine gate resolves to hint context')
    : fail('leadContextFor: visited_private_asylum should resolve (examine gate, not arrival)');
}

console.log(`\n${passes} passed, ${fails} failed`);
if (fails > 0) process.exit(1);
