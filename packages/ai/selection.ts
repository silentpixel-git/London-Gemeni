// The membership checks at the seam: a Selection against its Candidate Set, and
// Observations against the narration context. The adapters apply them (README:
// a Selection naming an id outside the set becomes none) and the turn endpoint
// applies the Selection check again. The Selection rule itself lives in the
// schema (inCandidateSet), so the prover reads the same one.
import { Verb, inCandidateSet, type CandidateSet, type NarrationContext, type NarrationResult, type Selection } from '../schema/index.js';

export { inCandidateSet };

const VERBS = new Set<string>(Verb.options);
const nonEmpty = (v: unknown) => (typeof v === 'string' && v.trim() !== '') || (Array.isArray(v) && v.length > 0);

/**
 * A model's reply, shaped as the flat reply schema (prompts.ts), mapped onto
 * the Selection union before Zod validates it: the fields that belong to its
 * kind and nothing else, empty values dropped, and a verb written into "kind"
 * read as an intent with that verb. Anything else is passed through for Zod to
 * reject.
 */
export function normaliseSelection(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const r = raw as Record<string, unknown>;
  let kind = r.kind;
  let verb = r.verb;
  if (typeof kind === 'string' && VERBS.has(kind)) { verb = nonEmpty(verb) ? verb : kind; kind = 'intent'; }
  const pick = (keys: string[]) => Object.fromEntries(keys.filter(k => nonEmpty(r[k])).map(k => [k, r[k]]));
  if (kind === 'intent') return { kind, ...(nonEmpty(verb) ? { verb } : {}), ...pick(['target', 'secondary', 'person', 'topic', 'exit', 'facts']) };
  if (kind === 'flavour') return { kind, ...pick(['subject']) };
  if (kind === 'none') return { kind, ...pick(['reason']) };
  return raw;
}

const bare = (t: string) => t.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * A flavour request whose subject names a candidate Object (by its name or an
 * alias) is that Object examined: "look out of the window" is the window, not
 * scenery. A model sometimes answers flavour for it although the prompt says
 * otherwise; this settles it deterministically. The longest matching name wins.
 */
export function resolveFlavour(sel: Selection, set: CandidateSet): Selection {
  if (sel.kind !== 'flavour') return sel;
  const subject = ` ${bare(sel.subject)} `;
  let best: { id: string; len: number } | null = null;
  for (const o of set.objects) {
    for (const n of [o.name, ...(o.aliases ?? [])].map(bare).filter(Boolean)) {
      if (subject.includes(` ${n} `) && (!best || n.length > best.len)) best = { id: o.id, len: n.length };
    }
  }
  return best && set.verbs.includes('examine') ? { kind: 'intent', verb: 'examine', target: best.id } : sel;
}

/**
 * An ask whose topic the player's words do not point to, while they name some
 * other candidate Object, is an ask with no topic: "ask Holmes about the
 * clergyman" is not his reading of another man because that is the only
 * reading he holds yet. The words point to the topic when they hold one of its
 * phrases, or name an Object one of whose names is one of its phrases. With no
 * Object named, the model's paraphrase stands.
 */
export function confineTopic(sel: Selection, set: CandidateSet, text: string): Selection {
  if (sel.kind !== 'intent' || sel.verb !== 'ask' || !sel.topic) return sel;
  const said = ` ${bare(text)} `;
  const phrases = new Set(set.topics.filter(t => t.fact === sel.topic && t.person === sel.person).map(t => bare(t.phrase)).filter(Boolean));
  if ([...phrases].some(p => said.includes(` ${p} `))) return sel;
  const named = set.objects.map(o => [o.name, ...(o.aliases ?? [])].map(bare).filter(Boolean)).filter(ns => ns.some(n => said.includes(` ${n} `)));
  if (named.length === 0 || named.some(ns => ns.some(n => phrases.has(n)))) return sel;
  const { topic: _topic, ...rest } = sel;
  return rest;
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
