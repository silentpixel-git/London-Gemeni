// The one membership check for a Selection against its Candidate Set, and for
// Observations against the narration context. The adapters apply them (README:
// a Selection naming an id outside the set becomes none) and the turn endpoint
// applies the Selection check again, so both read the same rule.
import type { CandidateSet, NarrationContext, NarrationResult, Selection } from '../schema/index.js';

export function inCandidateSet(sel: Selection, set: CandidateSet): boolean {
  if (sel.kind !== 'intent') return true;
  const objects = new Set(set.objects.map(o => o.id));
  const persons = new Set(set.persons.map(p => p.id));
  if (!set.verbs.includes(sel.verb)) return false;
  if (sel.target !== undefined && !objects.has(sel.target)) return false;
  if (sel.secondary !== undefined && !objects.has(sel.secondary)) return false;
  if (sel.person !== undefined && !persons.has(sel.person)) return false;
  if (sel.exit !== undefined && !set.exits.some(x => x.id === sel.exit)) return false;
  // A topic is a Fact id offered for the named person (or for anyone present when none is named).
  if (sel.topic !== undefined && !set.topics.some(t => t.fact === sel.topic && (sel.person === undefined || t.person === sel.person))) return false;
  if (sel.facts?.some(f => !set.knownFacts.some(k => k.id === f))) return false;
  return true;
}

/** The Selection, or none when it names something the set does not hold. */
export function confineSelection(sel: Selection, set: CandidateSet): Selection {
  return inCandidateSet(sel, set) ? sel : { kind: 'none', reason: 'selection outside the candidate set' };
}

/** Drop Observations whose subject is not the location, a present person or a visible object. */
export function confineObservations(result: NarrationResult, ctx: NarrationContext): NarrationResult {
  const subjects = new Set<string>([ctx.location.id, ...ctx.personsPresent.map(p => p.id), ...ctx.objectsVisible.map(o => o.id)]);
  return { ...result, observations: result.observations.filter(o => subjects.has(o.subject)) };
}
