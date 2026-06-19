/**
 * diaryDecisions.ts — authored Watson diary lines for MAJOR player decisions.
 *
 * Keyed by a decision id (the same refId stored on a DiaryEntry{kind:'decision'}).
 * Captured in hooks/useGameState.ts when the corresponding engine flag is set.
 * Scope is an explicit allowlist of genuine choices — not every flag.
 */

export interface DecisionDiaryEntry {
  /** Engine flag whose first appearance triggers this diary entry. */
  flag: string;
  /** Diary entry title (shown in the casebook). */
  name: string;
  /** Watson's first-person line for the decision. */
  diaryNote: string;
}

export const DECISION_DIARY: Record<string, DecisionDiaryEntry> = {
  // The prologue tutorial choice — Watson lays the press hoax before Holmes.
  showed_dear_boss_to_holmes: {
    flag: 'showed_newspaper_pile_to_holmes',
    name: 'The Press Hoax',
    diaryNote: "I showed Holmes the published letter. He dismissed it at once as a journalist's invention — a name coined to sell papers, not to sign crimes. The case, he warned, is littered with such noise.",
  },
};

/** Flag → decision id, for fast lookup when applying flag updates. */
export const DECISION_BY_FLAG: Record<string, string> = Object.fromEntries(
  Object.entries(DECISION_DIARY).map(([id, d]) => [d.flag, id]),
);
