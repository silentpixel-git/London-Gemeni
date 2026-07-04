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
