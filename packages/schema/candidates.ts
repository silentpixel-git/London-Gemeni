// The Candidate Set and the Selection: the contract between the engine and
// the selection model (ADR-0003). The model may only name members of the set.
import { z } from 'zod';
import { Id, Verb } from './common';

export const CandidateSet = z.object({
  verbs: z.array(Verb).min(1),
  objects: z.array(z.object({
    id: Id,
    name: z.string(),
    where: z.enum(['here', 'carried', 'inContainer', 'onPerson']),
  })),
  persons: z.array(z.object({ id: Id, name: z.string() })),
  exits: z.array(z.object({ id: Id, names: z.array(z.string()).min(1) })),
  /** Facts the addressed person can speak to, by phrase. */
  topics: z.array(z.object({ person: Id, fact: Id, phrase: z.string() })),
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
  }).strict(),
  /** The player described something plausible that is not in the set: narrate Flavour only. */
  z.object({ kind: z.literal('flavour'), subject: z.string().min(1) }).strict(),
  /** Nothing in the set fits and nothing can be described. */
  z.object({ kind: z.literal('none'), reason: z.string().optional() }).strict(),
]);
export type Selection = z.infer<typeof Selection>;
