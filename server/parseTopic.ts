/**
 * server/parseTopic.ts
 *
 * Pure logic for the TALK-topic fallback: the response schema built from the
 * candidate list, the selection prompt, and validation of the model's answer
 * back into an authored topic phrase. No Gemini client is constructed here, so
 * QA scripts can import the validator offline; the model call itself lives in
 * server/aiCore.ts (parseTopic()).
 *
 * Contract: validateTopicChoice returns a SELECTION — a phrase that came
 * verbatim from the supplied candidate list — or null. Anything outside the
 * list is rejected rather than coerced, so the model can never invent a
 * subject, reach a spoiler-gated fact, or answer a question the story has not
 * authored. Null is a normal outcome and falls through to the in-character
 * deflection the engine already produces.
 */

import { Type } from '@google/genai';
import type { TopicCandidate } from '../engine/topicFallback.js';

/** Sentinel the model returns when nothing in the list genuinely fits. */
export const NO_TOPIC_MATCH = 'none';

export function buildTopicSchema(candidates: TopicCandidate[]) {
  return {
    type: Type.OBJECT,
    properties: {
      topic: {
        type: Type.STRING,
        enum: [...candidates.map(c => c.phrase), NO_TOPIC_MATCH],
        description:
          `The authored subject the player is asking about, chosen verbatim from the list, ` +
          `or "${NO_TOPIC_MATCH}" if none of them is what they actually asked.`,
      },
    },
    required: ['topic'],
  };
}

export function buildTopicPrompt(
  playerPhrase: string,
  npcLabel: string,
  candidates: TopicCandidate[],
): string {
  return `A player is directing a question to ${npcLabel} in a Victorian detective game.

They asked about: "${playerPhrase}"

${npcLabel} can currently be asked about exactly these subjects, and no others:
${candidates.map(c => `- ${c.phrase}`).join('\n')}

Choose the ONE subject above that the player is actually asking about, matching on meaning rather than wording — a player may phrase a subject entirely differently from how it is listed ("her visit" for "why you have come"; "what he does for a living" for "his trade").

Answer "${NO_TOPIC_MATCH}" if the player is asking about something genuinely not in the list. A wrong match is worse than no match: it makes the character answer a question nobody asked. Do not stretch to fill the gap, and do not pick the merely nearest item when the player's subject is simply absent.`;
}

/**
 * Validate the model's answer. Returns the authored phrase to write back into
 * intent.topicRaw, or null for "no confident match" (including the sentinel,
 * a malformed answer, or any phrase not in the candidate list).
 */
export function validateTopicChoice(
  answer: unknown,
  candidates: TopicCandidate[],
): { phrase: string; factId: string } | null {
  if (typeof answer !== 'string') return null;
  const choice = answer.trim();
  if (!choice || choice === NO_TOPIC_MATCH) return null;
  const hit = candidates.find(c => c.phrase === choice);
  return hit ? { phrase: hit.phrase, factId: hit.factId } : null;
}
