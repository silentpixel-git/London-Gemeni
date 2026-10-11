# Diary — Watson's journal with margin notes

Design note for porting the prototype diary (`docs/act0-prototype.html`) into the game. Nothing in `components/` or `engine/` has changed yet. It replaces an earlier "open questions" experiment, which read too much like a to-do list.

## The idea
The diary is what Watson keeps: short, dated entries in his voice, oldest first, one page per act. It is not a summary or a task list.

- **Entry:** a time stamp from the in-game clock, then one or two sentences, authored.
- **Margin note:** the entries that mattered carry a short handwritten aside in the margin ("observe, then infer", "should have looked"). These notes *are* the leads. There are no chips, dots, counts or "open" items.
- **Nothing is written for what hasn't happened or was missed.** A missed opportunity shows only in how Watson writes what did happen ("Greasepaint, and I saw the coat and stopped looking").
- **Closing:** the act ends with one italic line, signed "— J.W.", in a variant per branch.
- **Type:** body text in Lato, notes in **Patrick Hand**. The game already loads Patrick Hand in `index.html` and never uses it.
- **Feedback in play:** an amber badge on the header diary button counting new entries, and a brief "Noted in my diary" message. In the diary, new entries carry an italic "new" under the time, as the current diary already does.

## Entry record (proposal for `engine/stories/types.ts`)
```ts
interface DiaryEntryDef<F extends string = string> {
  id: string;
  act: number;
  when: F[];                                            // all set → written, stamped with the clock
  text: string | Array<{ if: F[]; text: string }>;      // first matching variant wins
  note?: string | Array<{ if: F[]; note: string }>;     // margin note; presence = "this was a lead"
  closing?: boolean;                                    // the signed last line of the act
}
```
`ACT_PROGRESSION` gates stay exactly as they are. A lead is now simply "an entry with a margin note", and `qa:validate` can check that every required gate flag has one.

## What this replaces in `components/DiaryModal.tsx`
| Today | Becomes |
|---|---|
| Journal / Evidence / Persons / Documents tabs | One journal column per act. Papers and persons can return later as pasted-in items if an act needs them |
| Lead dots plus LEAD chips (which can disagree) | Margin notes |
| AI fill-in lead entries (`detectSilentLeadFlags`, the lead prompt in `server/aiCore.ts`) | Removed. Every entry is authored |
| Arrival entries for each location, and clue text shown twice | Removed |
| "Watson's reflections" (AI journal text) | The signed closing line |

## Act 0 entries (as in the prototype)
| id | When | Entry | Margin note |
|---|---|---|---|
| demo | demonstration | Holmes at the window, reading the holiday like print. A man from Hampstead, by the dust on his boots. | observe, then infer |
| wager | wager | I called it a parlour trick, and so found myself in a wager: two strangers to read, the violin against his monograph. | — |
| glass | glass taken | Took Holmes's opera glass from the mantel. He said nothing, which is his way of saying something. | — |
| soldier | soldier read | The old soldier by the cab rank: infantry, India, a thigh healed short. I knew that walk from Peshawar. | one to me / ribbon, faded white (glass used on him) |
| clergy | clergyman read | win: …Greasepaint at the hairline, a script in his hand. / lose: …Greasepaint, and I saw the coat and stopped looking. / guess: I said "actor" before I could say why. Holmes took the point, and fairly. | the glass! / should have looked / a guess is not a reading |
| unseen | closing | Holmes asked me to describe one other face from the street. I could not. | who is never looked at? |
| close | closing | Won: Two strangers read and the violin quiet till midnight. / Lost: One stranger read, one misread (guess: guessed), and a monograph on tobacco ash for my trouble. | signed — J.W. |
