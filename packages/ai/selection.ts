// The membership checks at the seam: a Selection against its Candidate Set, and
// Observations against the narration context. The adapters apply them (README:
// a Selection naming an id outside the set becomes none) and the turn endpoint
// applies the Selection check again. The Selection rule itself lives in the
// schema (inCandidateSet), so the prover reads the same one.
import { Verb, inCandidateSet, sharesTopicWord, trimSelection, type CandidateSet, type NarrationContext, type NarrationResult, type Selection } from '../schema/index.js';

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
  if (trimmed.kind === 'intent' && trimmed.verb === 'ask') {
    // A judgement means something only on a line that tells.
    if (!trimmed.telling && trimmed.agrees !== undefined) { const { agrees: _a, ...rest } = trimmed; return confineSelection(rest, set, text); }
    // A topic offered only as "tell" is the player telling: a question about that subject is an ask with no topic.
    const offered = trimmed.topic ? set.topics.filter(t => t.fact === trimmed.topic && (!trimmed.person || t.person === trimmed.person)) : [];
    const tellOnly = offered.length > 0 && offered.every(t => t.direction === 'tell');
    if (tellOnly && !trimmed.telling) { const { topic: _t, agrees: _a, ...rest } = trimmed; return rest; }
    // A told answer need not name its subject ("he is an actor, Holmes"): the shared-word check below guards against a
    // Fact handed out unasked, which telling cannot do.
    if (tellOnly) return trimmed;
  }
  if (text !== undefined && trimmed.kind === 'intent' && trimmed.verb === 'ask' && trimmed.topic) {
    const phrases = set.topics.filter(t => t.fact === trimmed.topic && (!trimmed.person || t.person === trimmed.person)).map(t => t.phrase);
    if (!sharesTopicWord(text, phrases)) { const { topic: _t, ...rest } = trimmed; return rest; }
  }
  return trimmed;
}

/**
 * A selector reply as the Selection schema reads it. Models sometimes put the verb in "kind"
 * ({"kind":"ask", ...}); that is the intent it names, not an unparseable reply.
 */
export function repairSelectionReply(reply: unknown): unknown {
  if (!reply || typeof reply !== 'object') return reply;
  const r = reply as Record<string, unknown>;
  if (typeof r.kind === 'string' && (Verb.options as readonly string[]).includes(r.kind)) {
    const { kind, ...rest } = r;
    return { kind: 'intent', verb: rest.verb ?? kind, ...rest };
  }
  return reply;
}

/** Drop Observations whose subject is not the location, a present person or a visible object. */
export function confineObservations(result: NarrationResult, ctx: NarrationContext): NarrationResult {
  const subjects = new Set<string>([ctx.location.id, ...ctx.personsPresent.map(p => p.id), ...ctx.objectsVisible.map(o => o.id)]);
  return { ...result, observations: result.observations.filter(o => subjects.has(o.subject)) };
}
