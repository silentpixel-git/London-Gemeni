// The membership checks at the seam: a Selection against its Candidate Set, and
// Observations against the narration context. The adapters apply them (README:
// a Selection naming an id outside the set becomes none) and the turn endpoint
// applies the Selection check again. The Selection rule itself lives in the
// schema (inCandidateSet), so the prover reads the same one.
import { inCandidateSet, type CandidateSet, type NarrationContext, type NarrationResult, type Selection } from '../schema/index.js';

export { inCandidateSet };

/** The Selection, or none when it names something the set does not hold. */
export function confineSelection(sel: Selection, set: CandidateSet): Selection {
  return inCandidateSet(sel, set) ? sel : { kind: 'none', reason: 'selection outside the candidate set' };
}

/** Drop Observations whose subject is not the location, a present person or a visible object. */
export function confineObservations(result: NarrationResult, ctx: NarrationContext): NarrationResult {
  const subjects = new Set<string>([ctx.location.id, ...ctx.personsPresent.map(p => p.id), ...ctx.objectsVisible.map(o => o.id)]);
  return { ...result, observations: result.observations.filter(o => subjects.has(o.subject)) };
}
