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
  // Act 0 tutorial beat — Watson reads the ticket the caller has left on the
  // table. Nell is never found and never named again: this line must not
  // promise a payoff the game deliberately withholds.
  read_pawn_ticket: {
    flag: 'examined_baker_street_pawn_ticket',
    name: 'The Pawn Ticket',
    diaryNote: "The ticket she left on the table is for a pair of boots, pledged in July for two shillings and never redeemed. I have known women in that quarter to pawn a great deal before they would pawn what they walk in.",
  },
  // Act 0 tutorial choice — Watson lays the ticket before Holmes, and Holmes
  // declines. The refusal is the act, and Watson keeps the ticket regardless.
  showed_pawn_ticket_to_holmes: {
    flag: 'showed_pawn_ticket_to_holmes',
    name: 'The Refusal',
    diaryNote: "I put the ticket into Holmes's hand and he gave it back inside of a minute. No case, he said; not even a crime. He was very likely right, and I find I have kept the ticket all the same.",
  },
};

/** Flag → decision id, for fast lookup when applying flag updates. */
export const DECISION_BY_FLAG: Record<string, string> = Object.fromEntries(
  Object.entries(DECISION_DIARY).map(([id, d]) => [d.flag, id]),
);
