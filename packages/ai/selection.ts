// The membership checks at the seam: a Selection against its Candidate Set, and
// Observations against the narration context. The adapters apply them (README:
// a Selection naming an id outside the set becomes none) and the turn endpoint
// applies the Selection check again. The Selection rule itself lives in the
// schema (inCandidateSet), so the prover reads the same one.
import { inCandidateSet, trimSelection, type CandidateSet, type NarrationContext, type NarrationResult, type Selection } from '../schema/index.js';

export { inCandidateSet };

/**
 * The Selection without stray words (trimSelection), or none when it names something the set
 * does not hold. Given the player's line, an ask keeps its topic only when the line shares a word
 * with one of that topic's authored phrases: a question about something else is an ask with no
 * topic (the designed deflection), never a Fact handed out unasked. The mirror of the invention
 * gate, on the selector instead of the narrator.
 */
export function confineSelection(sel: Selection, set: CandidateSet, text?: string): Selection {
  const trimmed = trimSelection(sel, set);
  if (!inCandidateSet(trimmed, set)) return { kind: 'none', reason: 'selection outside the candidate set' };
  if (text !== undefined && trimmed.kind === 'intent' && trimmed.verb === 'ask' && trimmed.topic) {
    const phrases = set.topics.filter(t => t.fact === trimmed.topic && (!trimmed.person || t.person === trimmed.person)).map(t => t.phrase);
    if (!sharesAWord(text, phrases)) { const { topic: _t, ...rest } = trimmed; return rest; }
  }
  return trimmed;
}

/** Words that say nothing about a subject. */
const STOP = new Set(('the and about what who whom whose which with her his him she they them their you your for from that this these those ' +
  'ask tell how long has have had been there here was were did does know any anything something more why when where said say says ' +
  'into onto over not but are can could would should will its it is of to in on at by me my we our us').split(' '));
const words = (s: string): string[] => (s.toLowerCase().match(/[a-z]+/g) ?? ([] as string[])).filter(w => w.length >= 3 && !STOP.has(w));
/** A shared word, or two words sharing their first four letters ("barrel" and "barrels", "ferry" and "ferried"). */
function sharesAWord(text: string, phrases: string[]): boolean {
  const said = words(text);
  return phrases.flatMap(words).some(p => said.some(w => w === p || (w.length >= 4 && p.length >= 4 && w.slice(0, 4) === p.slice(0, 4))));
}

/** Drop Observations whose subject is not the location, a present person or a visible object. */
export function confineObservations(result: NarrationResult, ctx: NarrationContext): NarrationResult {
  const subjects = new Set<string>([ctx.location.id, ...ctx.personsPresent.map(p => p.id), ...ctx.objectsVisible.map(o => o.id)]);
  return { ...result, observations: result.observations.filter(o => subjects.has(o.subject)) };
}
