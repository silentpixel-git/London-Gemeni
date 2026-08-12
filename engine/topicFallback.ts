/**
 * engine/topicFallback.ts
 *
 * Pure policy for the TALK-topic AI fallback: WHEN a typed subject needs the
 * model (needsTopicAiParse) and WHAT it may choose from (buildTopicCandidates).
 * The gateway op itself lives in server/parseTopic.ts + server/aiCore.ts.
 *
 * Why this exists: objects, NPCs, locations and items all get an AI recovery
 * tier when the deterministic parse misses (see parseFallback.ts). TALK topics
 * had none — matchTopic is pure string containment, so a miss went straight to
 * "this character has nothing to offer on that", which reads as the character
 * denying knowledge of something they may have just said aloud. Playtests hit
 * this repeatedly ("her visit", "why she has come") because authored topic
 * lists cannot enumerate every natural phrasing, and the failure is worse than
 * an object miss: a shrug about a prop is forgettable, a confident denial from
 * Holmes breaks the world.
 *
 * Contract: this tier SELECTS an authored topic phrase, never invents one. The
 * engine stays pure — the hook layer rewrites intent.topicRaw to the selected
 * authored phrase, after which matchTopic resolves it exactly as if the player
 * had typed it. No new answer is ever synthesised.
 */

import type { ParsedIntent } from './intentParser';
import type { StoryFact } from './stories/types';
import { askableFacts, matchTopic } from './stories/knowledge';

/** One selectable subject: the authored phrase, plus the fact it raises. */
export interface TopicCandidate {
  /** The authored topic phrase, verbatim — what gets written back to topicRaw. */
  phrase: string;
  /** Fact id, for logging and for the QA harness to assert against. */
  factId: string;
}

/**
 * Should this TALK be routed through the topic AI parse?
 *
 * Only when the player named a subject that deterministic matching could not
 * resolve. A bare `talk to X` (no subject) is not a miss — it is an opening
 * exchange the story owns, and story events match on `topicAbsent`.
 */
export function needsTopicAiParse(
  facts: StoryFact[],
  intent: ParsedIntent,
  npcId: string | undefined,
  currentAct: number,
  flags: Record<string, boolean>,
): boolean {
  if (intent.type !== 'talk' || !npcId) return false;
  const topicRaw = intent.topicRaw?.trim();
  if (!topicRaw) return false;
  // Already resolved deterministically — nothing to recover.
  if (matchTopic(facts, npcId, currentAct, topicRaw, flags)) return false;
  // Nothing this NPC can be asked about right now: a miss is the honest answer,
  // and calling the model would only invite it to force a bad fit.
  return buildTopicCandidates(facts, npcId, currentAct, flags).length > 0;
}

/**
 * Every subject this NPC can be asked about at this exact moment — the closed
 * set the model must choose from. Derived from the same askableFacts() the
 * deterministic matcher uses, so the AI tier can never reach a fact that
 * spoiler gating (visibleFromAct / requireFlags) has sealed.
 */
export function buildTopicCandidates(
  facts: StoryFact[],
  npcId: string,
  currentAct: number,
  flags: Record<string, boolean>,
): TopicCandidate[] {
  const out: TopicCandidate[] = [];
  const seen = new Set<string>();
  for (const fact of askableFacts(facts, npcId, currentAct, flags)) {
    for (const phrase of fact.topics!) {
      // Two facts can legitimately author the same phrase in different acts;
      // first wins, matching matchTopic's own precedence.
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      out.push({ phrase, factId: fact.id });
    }
  }
  return out;
}
