// The membership checks at the seam: a Selection against its Candidate Set, and
// Observations against the narration context. The adapters apply them (README:
// a Selection naming an id outside the set becomes none) and the turn endpoint
// applies the Selection check again. The Selection rule itself lives in the
// schema (inCandidateSet), so the prover reads the same one.
import type { Ai } from './types.js';
import { Verb, inCandidateSet, sharesTopicWord, topicWords, trimSelection, type CandidateSet, type NarrationContext, type NarrationResult, type Selection } from '../schema/index.js';

/**
 * The Selection without stray words (trimSelection), or none when it names something the set
 * does not hold. Given the player's line, an ask keeps its topic only when the line shares a word
 * with one of that topic's authored phrases: a question about something else is an ask with no
 * topic (the designed deflection), never a Fact handed out unasked. The mirror of the invention
 * gate, on the selector instead of the narrator.
 */
export function confineSelection(sel: Selection, set: CandidateSet, text?: string): Selection {
  // The selector sees each tell topic's answer; the free text it writes (a flavour subject, a none reason) reaches the
  // player, so a word of an answer the player did not write themselves turns it into a plain miss.
  if (sel.kind !== 'intent' && leaks(sel.kind === 'flavour' ? sel.subject : sel.reason ?? '', set, text)) return { kind: 'none' };
  const trimmed = trimSelection(sel, set);
  if (!inCandidateSet(trimmed, set)) return { kind: 'none', reason: 'selection outside the candidate set' };
  // A line put as a question never tells, whatever the selector made of it: a question cannot commit an answer.
  if (trimmed.kind === 'intent' && trimmed.verb === 'ask' && trimmed.telling && text !== undefined && isQuestion(text)) {
    const { telling: _t, agrees: _a, ...rest } = trimmed; return confineSelection(rest, set, text);
  }
  if (trimmed.kind === 'intent' && trimmed.verb === 'ask') {
    // A judgement means something only on a line that tells.
    if (!trimmed.telling && trimmed.agrees !== undefined) { const { agrees: _a, ...rest } = trimmed; return confineSelection(rest, set, text); }
    // A topic offered only as "tell" is the player telling: a question about that subject is an ask with no topic.
    const offered = trimmed.topic ? set.topics.filter(t => t.fact === trimmed.topic && (!trimmed.person || t.person === trimmed.person)) : [];
    const tellOnly = offered.length > 0 && offered.every(t => t.direction === 'tell');
    if (tellOnly && !trimmed.telling) { const { topic: _t, agrees: _a, ...rest } = trimmed; return rest; }
    // A told answer need not name its subject ("it was the gardener" told of the letter): it is on the subject if it
    // shares a word with the subject's phrases or with its answer. A line about nothing of the kind keeps no topic,
    // so it cannot use an answer up.
    if (tellOnly) {
      if (text === undefined || sharesTopicWord(text, offered.flatMap(t => [t.phrase, ...(t.answer ? [t.answer] : [])]))) return trimmed;
      const { topic: _t, agrees: _a, ...rest } = trimmed; return rest;
    }
  }
  if (text !== undefined && trimmed.kind === 'intent' && trimmed.verb === 'ask' && trimmed.topic) {
    const phrases = set.topics.filter(t => t.fact === trimmed.topic && (!trimmed.person || t.person === trimmed.person)).map(t => t.phrase);
    if (!sharesTopicWord(text, phrases)) { const { topic: _t, ...rest } = trimmed; return rest; }
  }
  return trimmed;
}

/**
 * The tell subject a line names first, by the words of its phrases that belong to that subject alone (a word shared by
 * two subjects' phrases, "man", names neither). Undefined when the line names none of them.
 */
function firstSubjectNamed(text: string, tells: CandidateSet['topics']): string | undefined {
  const owners = new Map<string, Set<string>>();
  for (const t of tells) for (const w of topicWords(t.phrase)) owners.set(w, (owners.get(w) ?? new Set()).add(t.fact));
  for (const w of topicWords(text)) {
    const facts = owners.get(w);
    if (facts?.size === 1) return [...facts][0];
  }
  return undefined;
}

/** A selector's reply with its own words for a none dropped: they may echo a verdict, and they would reach the narrator. */
export function fromSelector(sel: Selection): Selection {
  return sel.kind === 'none' && sel.reason !== undefined ? { kind: 'none' } : sel;
}

/**
 * A line put as a question: with its quotation marks, brackets and closing punctuation set aside, it ends in a
 * question mark (perhaps with a speech tag after it), or (after any form of address, "Mrs Hale, …") it opens with an
 * auxiliary verb ("is it…", "did he…") or "I wonder".
 * Words like what, when or whether often open a statement ("What a fool I was. It was the gardener."), so they count
 * only with the question mark.
 */
function isQuestion(text: string): boolean {
  const t = text.trim();
  // A question mark with nothing after it but closing quotes or brackets and at most a short speech tag ("I ask.").
  const q = t.lastIndexOf('?');
  if (q >= 0) {
    const after = t.slice(q + 1).replace(/["'”’)\]]/g, '').replace(/[.!]+$/, '').trim().toLowerCase();
    if (after === '' || /^(i|he|she|we|they|you)\s+(ask|asked|say|said|wonder|wondered|enquire|enquired)$/.test(after)) return true;
  }
  // An auxiliary verb opening the first clause, after any quotation mark or form of address ("Mrs Hale, was it…").
  const clause = t.toLowerCase().replace(/^["'“‘(\[]+/, '').replace(/^[a-z][a-z.' ]{0,30},\s*/, '');
  if (/^i wonder\b/.test(clause)) return true;
  return /^(is|are|was|were|did|does|has|have|had|can|could|would|should|shall|will|might|may)\s/.test(clause) && !/^\w+\s+not\b/.test(clause);
}

/**
 * The endpoint's last step before the engine (ADR-0005 §11). A told answer on a topic offered only as "tell" is
 * judged by the AI's judge when it has one; an answer that cannot be judged (no judge and no judgement already on the
 * Selection, a failed judge, or a line the judge finds is about some other subject) commits nothing and is a miss that
 * says so, so the player knows to say it again.
 */
export async function settleAnswer(sel: Selection, set: CandidateSet, text: string, recentTexts: string[], ai: Ai): Promise<Selection> {
  if (sel.kind !== 'intent' || sel.verb !== 'ask' || !sel.topic || !sel.telling) return sel;
  const intent = sel;
  const chosen = set.topics.filter(t => t.fact === intent.topic && (!intent.person || t.person === intent.person));
  if (!chosen.length || !chosen.every(t => t.direction === 'tell')) return sel;
  const person = chosen[0].person;
  // The answer is about the first subject the line names, whichever the selector chose (it can be swayed by what the
  // line claims): "the old fellow is an actor" is an answer about the old fellow.
  const topic = firstSubjectNamed(text, set.topics.filter(t => t.direction === 'tell' && t.person === person)) ?? intent.topic;
  const offered = set.topics.filter(t => t.fact === topic && t.person === person);
  // Said to the narrator as an in-character miss, so the player knows the answer did not land and may give it again.
  const unjudged = (): Selection => ({ kind: 'none', reason: 'the answer did not carry; it may be given again' });
  if (!ai.judge) return intent.agrees === undefined ? unjudged() : { ...intent, topic };
  const verdict = await ai.judge({ text, recentTexts, subject: offered.map(t => t.phrase).join(', '), answer: offered[0].answer ?? '' }).catch((err: unknown) => {
    console.warn('judge failed:', err instanceof Error ? err.message : err);
    return null;
  });
  return verdict === null ? unjudged() : { ...intent, topic, agrees: verdict };
}

/** Whether free text carries a word of a tell topic's answer that is neither in the player's line nor in the topic's phrases. */
function leaks(free: string, set: CandidateSet, text?: string): boolean {
  const own = new Set(topicWords(`${text ?? ''} ${set.topics.map(t => t.phrase).join(' ')}`));
  const hidden = new Set(set.topics.flatMap(t => (t.answer ? topicWords(t.answer) : [])).filter(w => !own.has(w)));
  return topicWords(free).some(w => hidden.has(w));
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
