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
  read_pawn_ticket: {
    flag: 'examined_baker_street_pawn_ticket',
    name: 'The Pawn Ticket',
    diaryNote: "The ticket on the table is for a pair of boots, pledged a week ago at a shop in Pentonville and redeemed, by her own hand, this very morning, before she had any cause yet to think her sister missing. I do not know what to make of the timing of it.",
  },
  the_reconstruction: {
    flag: 'showed_charity_card_to_holmes',
    name: 'The Reconstruction',
    diaryNote: "He took the whole of it apart in front of me: the mud, the postmarks, the shillings, and had an answer before I had finished laying the last piece on the table. A woman's whole secret life, and it came to him as easily as a sum. I do not think I shall ever get used to watching him do that.",
  },
  opened_workbox: {
    flag: 'opened_baker_street_nells_workbox',
    name: 'The Workbox',
    diaryNote: "I opened a stranger's box in front of her sister because Holmes wanted it open, and she said neither yes nor no. It was her private property and I went through it regardless. I did not care for the feeling, and I do not think I am meant to.",
  },
};

/** Flag → decision id, for fast lookup when applying flag updates. */
export const DECISION_BY_FLAG: Record<string, string> = Object.fromEntries(
  Object.entries(DECISION_DIARY).map(([id, d]) => [d.flag, id]),
);
