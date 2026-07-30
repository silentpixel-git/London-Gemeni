/**
 * diaryActs.ts — authored act-closing diary entries.
 *
 * Act-closing reflections are AI-written by default (see diary.ts, kind 'act').
 * An act with an entry here overrides that with authored prose, optionally
 * inflected by a player choice. Act 0's closing entry is authored because the
 * prologue's last words are the one paragraph worth hand-writing.
 */

export interface ActDiaryEntry {
  /** The shared body. `{choice}` is replaced by the matching variant. */
  body: string;
  /** First matching entry wins; the last should be the catch-all. */
  variants: Array<{ whenFlag?: string; text: string }>;
}

export const ACT_DIARY: Record<number, ActDiaryEntry> = {
  0: {
    body: "{choice} It was still very warm. Somebody two streets off was singing, badly and with great confidence, and further away somebody else was laughing at him. I got the window up as high as it would go and left it so, and we sat a while without saying anything, and I remember thinking that it had been a pleasant enough evening, taken all round.",
    variants: [
      { whenFlag: 'showed_charity_card_to_mrs_kemp', text: "I gave her the card before she reached the door. She will have the charity's own ledger by Wednesday, and whatever comes of that will not be mine to answer for. I told myself this was mercy. I am not entirely sure I believe it." },
      { whenFlag: 'asked_mrs_kemp_about_kemp_why_she_hid', text: "I asked her, before she left, whether she knew why her sister had hidden herself from her. She did not answer me, and I did not ask again. I have turned the question over more than she did, I think, and got no further with it than she did either." },
      { text: "I said nothing, and the card stayed in my pocket. Nell bought herself five months of silence at a shilling a week, and I judged, that evening, that it was not mine to spend for her. I have wondered since whether that was principle or only convenience." },
    ],
  },
};

export function resolveActDiary(act: number, flags: Record<string, boolean>): string | null {
  const entry = ACT_DIARY[act];
  if (!entry) return null;
  const variant = entry.variants.find(v => !v.whenFlag || flags[v.whenFlag] === true);
  return entry.body.replace('{choice}', variant?.text ?? '');
}
