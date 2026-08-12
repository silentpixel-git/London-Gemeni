/**
 * scripts/qa-invention.ts
 *
 * Per-turn invention detector for narration output.
 *
 * Two live playtest bugs motivated this, both of which the prompt rules already
 * forbade and the model produced anyway:
 *   - "Billy" — Holmes's page-boy from the wider Conan Doyle canon, who does not
 *     exist in this story's data at all.
 *   - "nine days" — a rain duration no context field ever supplied.
 *
 * The earlier attempt compared output against the WHOLE manifest and produced
 * ~90 hits, nearly all false positives (sentence-initial verbs, ambient names).
 * The fix is the comparison set: check each output only against THAT TURN's own
 * context — the objects, NPCs, location, exits, inventory, beats, result note
 * and fact statements the model was actually given. A proper noun or numeric
 * specific absent from all of them was invented, by definition.
 *
 * Exported so qa-narration.ts can reuse it per fixture; runnable standalone to
 * measure the false-positive rate against the real Act 0 story events.
 */

import type { NarrationContext } from '../types';
import { buildAct0NarrationContexts } from './qa-narration-fixtures';

/**
 * Words that are never "inventions" regardless of context: the narrator, the
 * fixed cast of the frame, and calendar/temporal vocabulary the clock supplies.
 * Deliberately short — every entry here is a hole in the check, so it holds
 * only things that genuinely cannot be story-specific.
 */
const AMBIENT = new Set([
  'watson', 'holmes', 'sherlock', 'john', 'baker', 'street', 'london',
  'mrs', 'mr', 'dr', 'doctor', 'madam', 'sir', 'hudson',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  'god', 'christ', 'heaven', 'english', 'england', 'british',
]);

/** Number words the model may use for ordinary counting, not as a claimed fact. */
const SMALL_COUNTS = new Set(['one', 'two', 'a', 'an', 'single', 'both', 'half']);

/** Everything the model was told this turn, flattened into one haystack. */
export function contextHaystack(ctx: NarrationContext): string {
  const parts: string[] = [
    ctx.locationName, ctx.locationAtmosphere ?? '', ctx.locationDescription ?? '',
    ctx.actName ?? '', ctx.actionDescription, ctx.actionResultNote,
    ctx.playerInput ?? '', ctx.timeLabel, ctx.weather?.label ?? '',
    ...(ctx.availableObjects ?? []),
    ...(ctx.availableExits ?? []),
    ...(ctx.inventory ?? []),
    ...(ctx.npcsPresent ?? []).map(n => n.label),
    ...(ctx.storyEvent?.beats ?? []),
    ctx.storyEvent?.notice ?? '',
    ...(ctx.newCluesDiscovered ?? []).flatMap(c => [c.name, c.description, c.holmesDeduction]),
    ctx.holmesSynthesis ?? '',
    ctx.targetNpcInterview?.topic?.statement ?? '',
    ...(ctx.targetNpcInterview?.knowledgeEnvelope ?? []),
    ...(ctx.npcScriptedLines ?? []).map(l => l.instruction),
    ctx.atmosphericNote ?? '',
    // Character sheets are part of the prompt too. Omitting them flagged
    // "Bethnal Green" — Mrs Kemp's home, stated in her own role line — as an
    // invention. Both shapes carry role/style/personality; both are context.
    ctx.targetNpcInterview?.role ?? '',
    ctx.targetNpcInterview?.speakingStyle ?? '',
    ...(ctx.targetNpcInterview?.personality ?? []),
    ctx.storyEventCharacter?.role ?? '',
    ctx.storyEventCharacter?.speakingStyle ?? '',
    ...(ctx.storyEventCharacter?.personality ?? []),
  ];
  return parts.join(' \n ').toLowerCase();
}

export interface Invention { kind: 'name' | 'number'; token: string; }

/**
 * Proper nouns and numeric specifics in `output` that appear nowhere in the
 * turn's context. Sentence-initial words are skipped: capitalisation there is
 * grammar, not a proper noun, and that was the dominant false positive before.
 */
export function findInventions(output: string, ctx: NarrationContext): Invention[] {
  const hay = contextHaystack(ctx);
  const found = new Map<string, Invention>();

  // Strip markdown emphasis/headings so "**Mrs. Kemp**" reads as plain text.
  const prose = output.replace(/[*_#>]/g, ' ');

  for (const sentence of prose.split(/(?<=[.!?"])\s+/)) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    // Drop the first word of each sentence — capitalised by position, not kind.
    const body = trimmed.replace(/^[^\s]+\s*/, '');

    for (const m of body.matchAll(/\b([A-Z][a-z]{2,})\b/g)) {
      const token = m[1];
      const lower = token.toLowerCase();
      if (AMBIENT.has(lower) || hay.includes(lower)) continue;
      found.set('name:' + lower, { kind: 'name', token });
    }
  }

  // Numeric specifics: digits, or spelled-out numbers used as a quantity.
  for (const m of prose.matchAll(/\b(\d+)\b/g)) {
    if (!hay.includes(m[1])) found.set('num:' + m[1], { kind: 'number', token: m[1] });
  }
  const SPELLED = /\b(three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand)\b/gi;
  for (const m of prose.matchAll(SPELLED)) {
    const lower = m[1].toLowerCase();
    if (SMALL_COUNTS.has(lower) || hay.includes(lower)) continue;
    found.set('num:' + lower, { kind: 'number', token: m[1] });
  }

  return [...found.values()];
}

// ── Standalone: measure the false-positive rate on real fixtures ─────────────

function selfTest() {
  console.log('=== Detector self-test against the two live bugs ===\n');
  const ctx = buildAct0NarrationContexts().find(e => e.id === 'act0_bell_rang')!.ctx;

  const bugs = [
    ['"Billy" (wider-canon name, in no context field)',
     'The bell rang. "She may yet take flight before Billy reaches the door," Holmes remarked.'],
    ['"nine days" (numeric specific never supplied)',
     'Holmes glanced up. "As we have had no rain for nine days, we may exclude the street."'],
  ];
  let caught = 0;
  for (const [label, sample] of bugs) {
    const hits = findInventions(sample, ctx);
    const ok = hits.length > 0;
    if (ok) caught++;
    console.log(`  ${ok ? 'CAUGHT ' : 'MISSED '} ${label}`);
    if (hits.length) console.log(`           -> ${hits.map(h => `${h.kind}:${h.token}`).join(', ')}`);
  }
  console.log(`\n  ${caught}/${bugs.length} known bugs detected.`);

  // Clean control: the authored beats themselves must not trip the detector.
  console.log('\n=== False-positive control (authored beats as output) ===\n');
  let fp = 0, checked = 0;
  for (const { id, ctx: c } of buildAct0NarrationContexts()) {
    const asOutput = (c.storyEvent?.beats ?? []).join(' ');
    if (!asOutput) continue;
    checked++;
    const hits = findInventions(asOutput, c);
    if (hits.length) {
      fp++;
      console.log(`  [FP] ${id}: ${hits.map(h => `${h.kind}:${h.token}`).join(', ')}`);
    }
  }
  console.log(`\n  ${fp}/${checked} authored-beat samples produced a false positive.`);
  console.log('\n(Authored beats are BY DEFINITION in context, so any hit here is a detector bug.)');
}

// Only when run directly — qa-narration.ts imports findInventions and must not
// trigger the self-test (and its fixture build) as a side effect of importing.
// Matched on the invoked path rather than import.meta.url: tsx does not
// populate import.meta.url in every entry mode, which silently disabled this.
if (process.argv.some(a => a.endsWith('qa-invention.ts'))) selfTest();
