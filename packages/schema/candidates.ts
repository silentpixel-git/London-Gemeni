// The Candidate Set and the Selection: the contract between the engine and
// the selection model (ADR-0003). The model may only name members of the set.
import { z } from 'zod';
import { Id, Verb } from './common.js';

export const CandidateSet = z.object({
  verbs: z.array(Verb).min(1),
  objects: z.array(z.object({
    id: Id,
    name: z.string(),
    where: z.enum(['here', 'carried', 'inContainer', 'onPerson']),
  })),
  persons: z.array(z.object({ id: Id, name: z.string() })),
  exits: z.array(z.object({ id: Id, names: z.array(z.string()).min(1) })),
  /** Facts a present person can speak to, or the player can tell them, by phrase. */
  topics: z.array(z.object({ person: Id, fact: Id, phrase: z.string(), direction: z.enum(['ask', 'tell']) })),
  /** Facts the player knows and may name in a deduction. */
  knownFacts: z.array(z.object({ id: Id, statement: z.string() })),
  /** Everyone the player has met, by the label the player knows them by: who a deduction may accuse (ADR-0005). */
  suspects: z.array(z.object({ id: Id, name: z.string() })),
}).strict();
export type CandidateSet = z.infer<typeof CandidateSet>;

export const Selection = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('intent'),
    verb: Verb,
    target: Id.optional(),
    secondary: Id.optional(),
    person: Id.optional(),
    topic: Id.optional(),
    exit: Id.optional(),
    /** deduce only: the Facts named. The suspect, if any, is `person`, drawn from `suspects`. */
    facts: z.array(Id).optional(),
  }).strict(),
  /** The player described something plausible that is not in the set: narrate Flavour only. */
  z.object({ kind: z.literal('flavour'), subject: z.string().min(1) }).strict(),
  /** Nothing in the set fits and nothing can be described. */
  z.object({ kind: z.literal('none'), reason: z.string().optional() }).strict(),
]);
export type Selection = z.infer<typeof Selection>;

/**
 * Whether a Selection names only members of its Candidate Set: the one rule the
 * selection adapters, the turn endpoint and the prover all apply, so the prover
 * proves exactly what a player can select (ADR-0005).
 *   target     an object here or carried; for examine, also a person present
 *   secondary  an object here or carried; for use, also a person present
 *   person     a person present; for deduce, anyone in `suspects`
 *   topic      a Fact offered for the named person (or for anyone present when none is named)
 */
export function inCandidateSet(sel: Selection, set: CandidateSet): boolean {
  if (sel.kind !== 'intent') return true;
  const objects = new Set(set.objects.map(o => o.id));
  const persons = new Set(set.persons.map(p => p.id));
  if (!set.verbs.includes(sel.verb)) return false;
  if (sel.target !== undefined && !objects.has(sel.target) && !(sel.verb === 'examine' && persons.has(sel.target))) return false;
  if (sel.secondary !== undefined && !objects.has(sel.secondary) && !(sel.verb === 'use' && persons.has(sel.secondary))) return false;
  if (sel.person !== undefined) {
    const pool = sel.verb === 'deduce' ? set.suspects.map(p => p.id) : [...persons];
    if (!pool.includes(sel.person)) return false;
  }
  if (sel.exit !== undefined && !set.exits.some(x => x.id === sel.exit)) return false;
  if (sel.topic !== undefined && !set.topics.some(t => t.fact === sel.topic && (sel.person === undefined || t.person === sel.person))) return false;
  if (sel.facts?.some(f => !set.knownFacts.some(k => k.id === f))) return false;
  return true;
}
