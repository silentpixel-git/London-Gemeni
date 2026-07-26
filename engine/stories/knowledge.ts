// Generic fact-graph helpers shared by all stories. No Whitechapel imports.
import type { StoryFact } from './types';

/**
 * Derive an NPC's knowledge envelope from the fact graph: every fact this NPC
 * knows whose act gate has passed, in fact-file order (author order matters —
 * aiCore's 8-item cap falls back to the head of this list).
 */
export function deriveKnowledgeEnvelope(
  facts: StoryFact[],
  npcId: string,
  currentAct: number,
): string[] {
  return facts
    .filter(f => f.knownBy.includes(npcId) && f.visibleFromAct <= currentAct)
    .map(f => f.statement);
}

/**
 * The facts this NPC can be ASKED about right now: known by them, act-gated
 * open, and carrying at least one topic phrase. Same filter as the knowledge
 * envelope, narrowed to what a player can name — so spoiler gating stays
 * mechanical and a fact can never be requested before its act.
 */
export function askableFacts(
  facts: StoryFact[],
  npcId: string,
  currentAct: number,
): StoryFact[] {
  return facts.filter(f =>
    f.knownBy.includes(npcId) &&
    f.visibleFromAct <= currentAct &&
    !!f.topics?.length);
}

/**
 * Up to `limit` subjects for a bare TALK's opening exchange to let surface,
 * preferring what Watson has not already raised with this NPC so a second
 * conversation does not offer the same three things back.
 *
 * Labels are each fact's first topic phrase — authored as the noun phrase a
 * player would plausibly type, so what the reply mentions is also what the
 * parser will accept.
 */
export function suggestTopics(
  facts: StoryFact[],
  npcId: string,
  currentAct: number,
  flags: Record<string, boolean>,
  limit = 3,
): string[] | undefined {
  const askable = askableFacts(facts, npcId, currentAct);
  const unasked = askable.filter(f => !flags[`asked_${npcId}_about_${f.id}`]);
  // Everything already covered: the opening exchange offers nothing rather than
  // repeating spent subjects.
  const pool = unasked.length > 0 ? unasked : [];
  return pool.length > 0 ? pool.slice(0, limit).map(f => f.topics![0]) : undefined;
}

/**
 * Resolve what the player typed after "about" to one askable fact.
 *
 * Matching is deliberately generous — the player is typing free text at a
 * person, not selecting from a menu — but never ambiguous: an exact topic hit
 * always beats a partial one, and among partials the longest matched topic
 * wins, so "the letter" and "the from hell letter" resolve to different facts
 * rather than whichever was authored first.
 *
 * Returns undefined when nothing matches, which the resolver renders as the NPC
 * having nothing to say on the subject — never as a parse failure.
 */
export function matchTopic(
  facts: StoryFact[],
  npcId: string,
  currentAct: number,
  topicRaw: string,
): StoryFact | undefined {
  const q = topicRaw.toLowerCase().replace(/^(the|a|an|his|her|their|that|this)\s+/, '').trim();
  if (!q) return undefined;
  const candidates = askableFacts(facts, npcId, currentAct);

  let exact: StoryFact | undefined;
  let partial: { fact: StoryFact; len: number } | undefined;

  for (const f of candidates) {
    for (const raw of f.topics!) {
      const t = raw.toLowerCase().replace(/^(the|a|an)\s+/, '').trim();
      if (!t) continue;
      if (t === q) { exact ??= f; continue; }
      // Either direction: the player may type less than the authored topic
      // ("graffiti" for "the goulston street graffiti") or more of a sentence
      // than it ("that business with the graffiti").
      if (t.includes(q) || q.includes(t)) {
        if (!partial || t.length > partial.len) partial = { fact: f, len: t.length };
      }
    }
  }
  return exact ?? partial?.fact;
}
