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
   * feature the prose mentions (a clasp, a hasp) resolves to the thing it is on.
   */
  objects: z.array(z.object({
    id: Id,
    name: z.string(),
    where: z.enum(['here', 'carried', 'inContainer', 'onPerson']),
    description: z.array(z.string()),
  })),
  /** `description` as for objects, so a role the prose gives ("the landlady") resolves to the person. */
  persons: z.array(z.object({ id: Id, name: z.string(), description: z.array(z.string()) })),
  /** `key`: the Object that opens this exit's lock now, when it is a key lock. */
  exits: z.array(z.object({ id: Id, names: z.array(z.string()).min(1), key: Id.optional() })),
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
    /** ask only: the line tells the person (a claim, an answer, the player's own view), rather than asking them. A topic offered as "tell" needs it. */
    telling: z.boolean().optional(),
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
  talk: ['person'], ask: ['person', 'topic', 'telling'], deduce: ['facts', 'person'], move: ['exit'],
};

/**
 * The Selection with each field in the slot its verb reads. A model filling the
 * reply schema sometimes puts a value in a slot the verb does not read:
 *   - a stray word from the line ("snap the clasp" → open the casket, secondary
 *     "clasp"), which names nothing in the set: dropped;
 *   - a real id in the wrong slot ("try the cellar door" → move, target the exit;
 *     "talk to the landlady" → talk, target the landlady): moved to the one empty slot of
 *     the verb that takes it. Where no slot or several would, it stays put and
 *     inCandidateSet answers none, never a weaker intent the engine would accept;
 *   - an ask's topic that is not one of the set's topics (names nothing, or names an Object or a
 *     person): dropped, since ask with no topic is the designed answer to a subject the person has
 *     nothing on (an honest deflection);
 *   - examine or read with an object as secondary ("look at the clergyman through the glass"):
 *     using that object on the target;
 *   - a value that is exactly one candidate's name rather than its id ("bar" for the
 *     exit named "bar"): that candidate's id;
 *   - open or use on an exit itself ("open the cellar door", "lift the bar"), or the
 *     exit's own key used on it ("unlock the door with the key"): a move through
 *     that exit, the one action the engine has on a way, so a locked one answers
 *     with its lockedBeat and the key opens it. Anything else used on a way stays
 *     none: it is not an attempt to go through.
 * Other fields the verb reads are left for inCandidateSet to judge. The prover offers
 * only read fields holding ids from the set, so this never changes what it proves.
 */
export function trimSelection(sel: Selection, set: CandidateSet): Selection {
  if (sel.kind !== 'intent') return sel;
  const norm = (n: string) => n.trim().toLowerCase().replace(/^the /, '');
  const named = (v: string | undefined) => {
    if (v === undefined || [...set.objects, ...set.exits, ...set.persons].some(c => c.id === v)) return v;
    const hits = new Set([
      ...set.exits.filter(x => x.names.some(n => norm(n) === norm(v))).map(x => x.id),
      ...set.objects.filter(o => norm(o.name) === norm(v)).map(o => o.id),
      ...set.persons.filter(p => norm(p.name) === norm(v)).map(p => p.id),
    ]);
    return hits.size === 1 ? [...hits][0] : v;
  };
  sel = { ...sel, ...(sel.target ? { target: named(sel.target) } : {}), ...(sel.secondary ? { secondary: named(sel.secondary) } : {}) };
  // "Look at X through Y", "read X by Y": examining or reading something with an object at hand is using that object on it.
  const lens = sel.secondary;
  if ((sel.verb === 'examine' || sel.verb === 'read') && sel.target && lens && lens !== sel.target && set.objects.some(o => o.id === lens)) {
    return trimSelection({ kind: 'intent', verb: 'use', target: lens, secondary: sel.target }, set);
  }
  // "Use the glass" with the glass in both slots means the plain use: the engine refuses a thing used on itself.
  if (sel.verb === 'use' && sel.secondary !== undefined && sel.secondary === sel.target) { const { secondary: _same, ...plain } = sel; sel = plain; }
  const exitOf = (v?: string) => (v && !set.objects.some(o => o.id === v) && !set.persons.some(p => p.id === v) ? set.exits.find(x => x.id === v) : undefined);
  if (sel.verb === 'open' || sel.verb === 'use') {
    const slotted = exitOf(sel.exit);
    const targetWay = exitOf(sel.target);
    const onWay = exitOf(sel.secondary) ?? (sel.target && !targetWay ? slotted : undefined);
    if (targetWay && !sel.secondary) return { kind: 'intent', verb: 'move', exit: targetWay.id };
    if (slotted && !sel.target) return { kind: 'intent', verb: 'move', exit: slotted.id };
    if (onWay && sel.verb === 'use') {
      if (onWay.key && sel.target === onWay.key) return { kind: 'intent', verb: 'move', exit: onWay.id };
      return { kind: 'none', reason: 'that does nothing to the way' };
    }
  }
  const reads: readonly string[] = VERB_FIELDS[sel.verb];
  const ids = new Set<string>([
    ...set.objects.map(o => o.id), ...set.persons.map(p => p.id), ...set.suspects.map(p => p.id),
    ...set.exits.map(x => x.id), ...set.topics.map(t => t.fact), ...set.knownFacts.map(f => f.id),
  ]);
  const names = (v: unknown) => (Array.isArray(v) ? v : [v]).some(x => typeof x === 'string' && ids.has(x));
  const out: Record<string, unknown> = { kind: 'intent', verb: sel.verb };
  // A topic must be a topic: anything else named there (an Object, a person) leaves the ask with no topic, the designed deflection.
  for (const [k, v] of Object.entries(sel)) if (reads.includes(k) && !(k === 'topic' && !set.topics.some(t => t.fact === v))) out[k] = v;
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

/** Words that say nothing about a subject. */
const STOP = new Set(('the and about what who whom whose which with her his him she they them their you your for from that this these those ' +
  'ask tell how long has have had been there here was were did does know any anything something more why when where said say says ' +
  'into onto over not but are can could would should will its it is of to in on at by me my we our us').split(' '));

/** The words of a phrase or a line that can carry a subject: three letters or more, not a stop word. */
export function topicWords(s: string): string[] {
  return (s.toLowerCase().match(/[a-z]+/g) ?? ([] as string[])).filter(w => w.length >= 3 && !STOP.has(w));
}

/**
 * Whether a player's line shares a word with any of a topic's phrases: the same word, one word
 * starting the other ("key" and "keys", "oil" and "oily"), or two words sharing their first four
 * letters ("ferry" and "ferried"). An ask keeps its topic only when it does (confineSelection).
 */
export function sharesTopicWord(text: string, phrases: string[]): boolean {
  const said = topicWords(text);
  const near = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a) || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));
  return phrases.flatMap(topicWords).some(p => said.some(w => near(w, p)));
}
