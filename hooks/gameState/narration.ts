import type {
  EngineResult,
  GameHistoryItem,
  NarrationContext,
  NarrationResponse,
  NPCState,
  STIMEntry,
} from '../../types';

// Shown only when the opening narration call fails (no key, network error), so
// it must stand on its own as a playable first screen. Re-dressed for the
// chronological rework: Act 0 is the August Bank Holiday, three weeks before the
// first murder. Nothing here may reference a case, a victim, or the autumn.
export const OPENING_FALLBACK_NARRATIVE =
  "> *221B Baker Street. August 1888. Both windows stand open, and the holiday shows no sign of going home.*\n\nHolmes stands at the window with his back to the room, watching the crowds move along the pavement below. There is no case. There has not been one worth the name in some weeks, and he has remarked on it twice already this evening.\n\nA woman waits in the chair by the door, holding her gloves in her lap.\n\n**Sherlock Holmes** and **Mrs. Kemp** are here.\n**Objects of interest:** Nell's Pawn Ticket, The Concluded Case, Holmes' Chemistry Table, The Violin Case.\n**Possible exits:** None tonight.";

// Extract the first prose sentence of a narration (skipping act headers and
// blockquotes) — used as anti-repetition memory for the AI.
export function extractOpeningSentence(markdown: string): string | null {
  const line = markdown
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('**'));
  if (!line) return null;
  const sentence = line.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? line;
  return sentence.length > 90 ? sentence.slice(0, 90) + '…' : sentence;
}

export interface NarrationContinuitySnapshot {
  npcStates: Record<string, NPCState>;
  stim: Record<string, STIMEntry>;
}

/** Both narration writes must land before cloud continuity is considered safe. */
export function narrationCloudPersisted(
  npcContinuityPersisted: boolean,
  fullStatePersisted: boolean,
): boolean {
  return npcContinuityPersisted && fullStatePersisted;
}

/** Fold every required write into one deduped failure-streak transition. */
export function cloudPersistOutcome(
  previouslyFailed: boolean,
  writeResults: boolean[],
  turnCompleted = true,
): { failed: boolean; shouldNotify: boolean } {
  const failed = !turnCompleted || writeResults.some(result => !result);
  return { failed, shouldNotify: failed && !previouslyFailed };
}

/** Merge one completed response into the ordered, turn-local continuity state. */
export function mergeNarrationContinuity(
  current: NarrationContinuitySnapshot,
  response: NarrationResponse,
  turnCount: number,
): NarrationContinuitySnapshot {
  const npcStates = { ...current.npcStates };
  for (const [npcId, summary] of Object.entries(response.npcMemoryUpdate ?? {})) {
    const existing = npcStates[npcId]?.memory ?? [];
    npcStates[npcId] = {
      ...(npcStates[npcId] ?? { npcId, disposition: 50, status: 'alive' }),
      memory: [summary, ...existing].slice(0, 5),
    } as NPCState;
  }

  const stim = { ...current.stim };
  for (const [id, entry] of Object.entries(response.stimUpdate ?? {})) {
    if (!stim[id]) stim[id] = { ...entry, turnCreated: turnCount };
  }

  return {
    npcStates,
    stim: Object.fromEntries(
      (Object.entries(stim) as [string, STIMEntry][])
        .sort(([, a], [, b]) => b.turnCreated - a.turnCreated)
        .slice(0, 15),
    ),
  };
}

type NarrationStream = (ctx: NarrationContext) => AsyncIterable<{
  narrative: string;
  fullJson: string;
  isComplete: boolean;
  parsed?: NarrationResponse;
}>;

type HistoryUpdater = (update: (previous: GameHistoryItem[]) => GameHistoryItem[]) => void;

/** Stream an engine-scheduled follow-up into its own assistant feed item. */
export async function streamFollowUpNarration(
  followUp: NonNullable<EngineResult['followUpEvent']>,
  stream: NarrationStream,
  updateHistory: HistoryUpdater,
): Promise<NarrationResponse | undefined> {
  updateHistory(previous => [...previous, { role: 'assistant', text: '' }]);

  let completed: NarrationResponse | undefined;
  for await (const update of stream(followUp.aiContext)) {
    if (update.narrative) {
      updateHistory(previous => {
        const next = [...previous];
        next[next.length - 1] = { ...next[next.length - 1], text: update.narrative };
        return next;
      });
    }
    if (update.isComplete && update.parsed) completed = update.parsed;
  }
  if (!completed) {
    throw new Error('Follow-up narration stream ended before a complete response.');
  }
  return completed;
}
