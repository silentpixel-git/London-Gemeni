# Diary — Journal + Kept

Design note for porting the prototype diary (`docs/act0-prototype.html`) into the game. Nothing in `components/` or `engine/` has changed yet. This is the third attempt. "Open questions" read as a to-do list, and "margin notes" didn't land. This version comes from two Mobbin references the owner picked:

- [5 Minute Journal](https://mobbin.com/screens/59059226-c8cc-4e04-a48f-f32331a83c20): a date/time block, a tiny uppercase label, then one serif line.
- [Medium "Highlighted"](https://mobbin.com/screens/d029d138-2f1e-4517-be89-1e6a85390df6) and [Pocket](https://mobbin.com/screens/6e005a16-1328-4178-b388-8ad0eaa34e85): verbatim passages in a soft highlight, with a source line underneath.

## Shape
The diary stays close to today's but lighter: **two tabs instead of four**, and no icons, chips, pips, pills or AI-written text.

- **Journal:** one line per thing that happened, oldest first, grouped by act and day.
  - Each entry is a time tile, a one-word label (Encounter / Clue / Decision / Reflection) and one serif sentence in Watson's voice.
  - The act's closing line is the last entry, labelled "Reflection", in italic.
- **Kept:** the exact words from a scene that Watson chose to keep. Each is a highlighted quote with a source line: "— Holmes, at the window · 7:35".
  - **The kept quotes are the leads.** What Watson kept is what mattered. Nothing is counted, and nothing is shown for what hasn't happened.
  - Kept replaces both Evidence and Documents. Picked-up papers can later join it as kept text.
- **Feedback:** an amber badge on the diary button for new items, the brief "Noted in my diary" message, a small amber dot on new items, and a count of new items on the Kept tab.

## Records (proposal for `engine/stories/types.ts`)
```ts
interface JournalEntryDef<F extends string = string> {
  id: string; act: number;
  when: F[];                                         // all set → written, stamped with the clock
  label: 'Encounter' | 'Clue' | 'Decision' | 'Reflection';
  text: string | Array<{ if: F[]; text: string }>;   // first matching variant wins
}
interface KeptQuoteDef<F extends string = string> {
  id: string; act: number;
  when: F[];
  quote: string | Array<{ if: F[]; quote: string }>; // MUST appear verbatim in the authored beat text
  source: string | Array<{ if: F[]; source: string }>;
}
```
The game narrates with AI, so a kept quote must be fixed text that the narration is required to contain. Otherwise the "verbatim" promise breaks. That means kept lines come from authored story-event beats, delivered word for word. The prototype test suite checks every quote against the narration, and `qa:validate` should do the same against the beat text.

## What this replaces in `components/DiaryModal.tsx`
| Today | Becomes |
|---|---|
| Journal / Evidence / Persons / Documents | Journal / Kept |
| Icons, LEAD chips, lead pips, "New" pills, act "✓ Complete" pills | A time tile and a one-word label; a small amber dot for new items |
| AI lead fill-ins (`detectSilentLeadFlags`, the `server/aiCore.ts` lead prompt) | Removed. Journal lines are authored |
| Clue text shown twice (Journal and Evidence) | Once, as a journal line, with the exact words optionally kept |
| Location arrival entries | Removed |
| "Watson's reflections" (AI journal text) | The authored "Reflection" closing line |

## Act 0 content
**Journal:** demo (Encounter), wager (Decision), glass (Clue), soldier (Clue), clergy (Clue; win/lose/guess variants), unseen (Encounter), close (Reflection; won/lost/guessed variants).

**Kept:**
| id | when | quote | source |
|---|---|---|---|
| boots | demonstration | I observe that his boots are white to the ankle with the dust of the Heath road. That is a fact. I infer that he walked, which is not… | Holmes, at the window |
| peshawar | soldier read | I watched men learn that walk in the hospital at Peshawar. | My own reading, the old soldier |
| coat | clergyman read | win: That is greasepaint at his hairline, and he is learning a part, not a lesson. / lose: You saw a black coat and a white tie, and you stopped looking, because you had your answer. / guess: A guess is not a reading. | win: My own reading, the clergyman / else: Holmes, on the clergyman |
| asks | closing | We see what asks to be seen. | Holmes, at the window |
