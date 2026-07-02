/**
 * scripts/qa-diary-leads.ts
 * Deterministic QA for Watson's diary lead-marking / gap-filling. No AI, no
 * browser, no Supabase.
 * Run: npx tsx scripts/qa-diary-leads.ts   (exit code 1 on any FAIL)
 */
import { resolveDiaryEntry } from '../engine/stories/whitechapel-1888/diary';

let passes = 0, fails = 0;
function pass(l: string) { console.log(`[PASS] ${l}`); passes++; }
function fail(l: string, d?: string) { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; }

// 1) resolveDiaryEntry: hand-authored DECISION_DIARY entry still resolves as before.
{
  const authored = resolveDiaryEntry({ kind: 'decision', refId: 'showed_dear_boss_to_holmes' });
  authored?.title === 'The Press Hoax'
    ? pass('resolveDiaryEntry: hand-authored decision entry resolves via DECISION_DIARY')
    : fail('resolveDiaryEntry broke the hand-authored decision path', JSON.stringify(authored));
}

// 2) resolveDiaryEntry: AI-generated decision entry (no DECISION_DIARY match) parses
//    title/body from entry.text ("title\nbody").
{
  const generated = resolveDiaryEntry({
    kind: 'decision',
    refId: 'talked_to_holmes_at_baker_street',
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

console.log(`\n${passes} passed, ${fails} failed`);
if (fails > 0) process.exit(1);
