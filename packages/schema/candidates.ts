// The Candidate Set and the Selection: the contract between the engine and
// the selection model (ADR-0003). The model may only name members of the set.
import { z } from 'zod';
import { Id, Verb } from './common.js';

export const CandidateSet = z.object({
  verbs: z.array(Verb).min(1),
  /** Where the player is, with the beats the narrator describes it from: what "the scene" holds. */
  location: z.object({ name: z.string(), description: z.array(z.string()) }),
  /**
   * `description` is the beats the narrator describes it from, so a part or
   * feature the prose mentions (a latch, a lid) resolves to the thing it is on.
   */
  objects: z.array(z.object({
    id: Id,
    name: z.string(),
    where: z.enum(['here', 'carried', 'inContainer', 'onPerson']),
    description: z.array(z.string()),
  })),
  /** `description` as for objects, so a role the prose gives ("the cook") resolves to the person. */
  persons: z.array(z.object({ id: Id, name: z.string(), description: z.array(z.string()) })),
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

type IntentField = Exclude<keyof Extract<Selection, { kind: 'intent' }>, 'kind' | 'verb'>;

/** The fields each Verb reads (packages/engine/verbs.ts); any other field on an intent means nothing to the engine. */
export const VERB_FIELDS: Record<Verb, readonly IntentField[]> = {
  look: [], inventory: [], wait: [],
  examine: ['target'], read: ['target'], take: ['target'], drop: ['target'], open: ['target'], close: ['target'],
  use: ['target', 'secondary'], combine: ['target', 'secondary'],
  show: ['target', 'person'], give: ['target', 'person'],
  talk: ['person'], ask: ['person', 'topic'], deduce: ['facts', 'person'], move: ['exit'],
};

/**
 * The Selection with each field in the slot its verb reads. A model filling the
 * reply schema sometimes puts a value in a slot the verb does not read:
 *   - a stray word from the line ("break the latch" → open the chest, secondary
 *     "latch"), which names nothing in the set: dropped;
 *   - a real id in the wrong slot ("try the store door" → move, target the exit;
 *     "talk to the cook" → talk, target the cook): moved to the one empty slot of
 *     the verb that takes it. Where no slot or several would, it stays put and
 *     inCandidateSet answers none, never a weaker intent the engine would accept;
 *   - an ask's topic that names nothing: dropped, since ask with no topic is the
 *     designed answer to a subject the person has nothing on (an honest deflection).
 * Other fields the verb reads are left for inCandidateSet to judge. The prover offers
 * only read fields holding ids from the set, so this never changes what it proves.
 */
export function trimSelection(sel: Selection, set: CandidateSet): Selection {
  if (sel.kind !== 'intent') return sel;
  const reads: readonly string[] = VERB_FIELDS[sel.verb];
  const ids = new Set<string>([
    ...set.objects.map(o => o.id), ...set.persons.map(p => p.id), ...set.suspects.map(p => p.id),
    ...set.exits.map(x => x.id), ...set.topics.map(t => t.fact), ...set.knownFacts.map(f => f.id),
  ]);
  const names = (v: unknown) => (Array.isArray(v) ? v : [v]).some(x => typeof x === 'string' && ids.has(x));
  const out: Record<string, unknown> = { kind: 'intent', verb: sel.verb };
  for (const [k, v] of Object.entries(sel)) if (reads.includes(k) && !(k === 'topic' && !names(v))) out[k] = v;
  const fits = (slot: string, v: unknown) =>
    Array.isArray(v) === (slot === 'facts') && inCandidateSet({ kind: 'intent', verb: sel.verb, [slot]: v } as Selection, set);
  for (const [k, v] of Object.entries(sel)) {
    if (k === 'kind' || k === 'verb' || reads.includes(k) || v === undefined || !names(v)) continue;
    const slots = reads.filter(slot => out[slot] === undefined && fits(slot, v));
    out[slots.length === 1 ? slots[0] : k] = v;
  }
  return out as Selection;
}

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
