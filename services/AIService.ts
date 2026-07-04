/**
 * services/AIService.ts
 *
 * Narrative-only AI service for London Bleeds — CLIENT gateway wrapper.
 *
 * Contract (unchanged):
 * - Receives a NarrationContext (verified facts from the game engine)
 * - Returns atmospheric Watson-voice prose (markdownOutput only)
 * - NEVER returns state mutations (no newLocationId, inventoryUpdate, npcMutations, etc.)
 * - Optionally returns npcMemoryUpdate (short summaries for memory bank)
 *
 * The AI cannot hallucinate exits, NPCs, or items because it is not asked to track them.
 *
 * Implementation note: all prompts, schemas, and Gemini calls live server-side
 * in server/aiCore.ts, reached through the /api/ai gateway (api/ai.ts). This
 * class is a thin fetch client with the same public API as before, so the
 * GEMINI_API_KEY never ships in the client bundle.
 */

import { NarrationContext, NarrationResponse, ActJournalSummary, HintTarget, HintVerb } from '../types';

const GATEWAY_URL = '/api/ai';

async function postJson<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`AI gateway error (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export class AIService {
  /**
   * Stream Watson's narration for the given context.
   * Yields partial narrative text as it arrives, then the full parsed response.
   * (fullJson is a legacy field — the raw Gemini JSON stays server-side.)
   */
  async *stream(ctx: NarrationContext): AsyncGenerator<{
    narrative: string;
    fullJson: string;
    isComplete: boolean;
    parsed?: NarrationResponse;
  }> {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'narrate', ctx }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`AI gateway error (${res.status})`);
    }

    // NDJSON: one JSON update per line.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const update = JSON.parse(line) as {
          narrative?: string;
          isComplete?: boolean;
          parsed?: NarrationResponse;
          error?: string;
        };
        if (update.error) throw new Error(update.error);
        yield {
          narrative: update.narrative ?? '',
          fullJson: '',
          isComplete: update.isComplete ?? false,
          parsed: update.parsed,
        };
      }
    }
  }

  /**
   * Connectivity check — verifies the gateway, key, and model are live.
   */
  async ping(): Promise<string> {
    const { text } = await postJson<{ text: string }>({ op: 'ping' });
    return text;
  }

  /**
   * Cross-case Holmesian synthesis over ALL discovered clues.
   */
  async consultHolmesMultiClue(
    allDiscoveredClues: Array<{ name: string; description: string; holmesDeduction: string }>,
    newlyFoundNames: string[],
    currentAct: number,
  ): Promise<string> {
    const { text } = await postJson<{ text: string }>({
      op: 'holmes',
      allDiscoveredClues,
      newlyFoundNames,
      currentAct,
    });
    return text;
  }

  /**
   * Watson-voiced hint for an engine-chosen target.
   */
  async getWatsonHint(target: HintTarget): Promise<string> {
    const { text } = await postJson<{ text: string }>({ op: 'hint', target });
    return text;
  }

  /**
   * Watson diary entry when an act closes.
   */
  async generateJournalEntry(summary: ActJournalSummary): Promise<string> {
    const { text } = await postJson<{ text: string }>({ op: 'journal', summary });
    return text;
  }

  /**
   * Diary entry for a progression-gate flag with no hand-authored text.
   * Never throws into the turn loop — falls back to empty strings.
   */
  async generateLeadDiaryEntry(context: {
    actName: string;
    verb: HintVerb;
    subject: string;
    narrationText: string;
  }): Promise<{ title: string; body: string }> {
    try {
      return await postJson<{ title: string; body: string }>({ op: 'leadDiary', context });
    } catch {
      return { title: '', body: '' };
    }
  }

  /**
   * Constrained target resolver (NOT narration) — maps a player's noun to one
   * id from the supplied candidate list. Never throws into the turn loop.
   */
  async resolveTargetObject(
    rawInput: string,
    intentType: string,
    candidates: Array<{ id: string; name: string }>,
    entityNoun: 'object' | 'person' = 'object',
  ): Promise<{ objectId: string | null }> {
    if (candidates.length === 0) return { objectId: null };
    try {
      return await postJson<{ objectId: string | null }>({
        op: 'resolveTarget',
        rawInput,
        intentType,
        candidates,
        entityNoun,
      });
    } catch {
      return { objectId: null };
    }
  }
}

// Singleton export
export const aiService = new AIService();
