# Diary — the game's frame, lighter content

Design note for porting the prototype diary (`docs/act0-prototype.html`) into the game. Nothing in `components/` or `engine/` has changed yet.

It went through four attempts:
1. Open questions read as a to-do list.
2. Margin notes didn't land.
3. Journal + Kept (from Mobbin references) felt like a player's notebook rather than Watson's private diary.
4. **This version**, a hybrid that keeps the frame of the diary already in the game (`components/DiaryModal.tsx`) and carries the lighter content from attempt 3.

## Frame (kept from the game)
- **Spine:** "Watson's Diary", then **Private / *J. H. Watson, M.D.*** to set the guarded tone, then a vertical tab list.
- **Tabs:** each shows an uppercase label, a count line ("7 entries", "4 noted", "2 recorded", "none yet") and an amber dot when it has something new.
  - The active tab is marked by a 3 px accent bar that slides between tabs.
  - It scales: a new category is one more tab and one more panel.
- **Fixed size:** desktop is about 780 × `min(640px, 86vh)`; mobile is a bottom sheet at 86vh. Switching tabs never resizes the modal.
- **Mobile tab ribbon:** the spine becomes a title row and a horizontal tab ribbon with a sliding underline. All four tabs fit at 390 px.

## Tabs
| Tab | Content | Source of the pattern |
|---|---|---|
| **Journal** | The act heading and date line. Then one entry per event: time tile, one-word label (Encounter / Clue / Decision) and one or two serif sentences. Entries that produced a quick note get a quill button that jumps to that note. The act ends with a **Reflection** (italic, left rule, signed "— J. H. W.") | Today's journal + [5 Minute Journal](https://mobbin.com/screens/59059226-c8cc-4e04-a48f-f32331a83c20) |
| **Quick notes** | Exact words from the scene, **always whole sentences**, in a soft highlight with a source line. **These are the leads.** Replaces Evidence | [Medium](https://mobbin.com/screens/d029d138-2f1e-4517-be89-1e6a85390df6) / [Pocket](https://mobbin.com/screens/6e005a16-1328-4178-b388-8ad0eaa34e85) |
| **Persons** | Today's ledger: name, a line, a source. A misread person's name is struck through ("~~The clergyman~~ — An actor between performances…") | Today's Persons tab |
| **Documents** | Filed papers. Empty in Act 0 ("No papers filed yet.") | Today's Documents tab |

No icons, LEAD chips, pips, "✓ Complete" pills or AI-written diary text.

## Motion
All motion falls back to a plain fade under `prefers-reduced-motion`.
- **Tab change:** the panels share one grid cell. The outgoing panel fades and moves 14 px toward the old tab; the incoming one comes from the other side. This takes about 260 ms with the game's expo ease-out. The direction follows tab order: vertical on desktop, horizontal on mobile. Each panel keeps its own scroll position.
- **Open and close:** on desktop the card rises in and sinks out; on mobile the sheet slides up and down. The backdrop fades both ways.
- **Mobile swipe:** a horizontal swipe on the content (more than 50 px, mostly horizontal) moves to the next or previous tab.
- **Keyboard:** the ARIA tabs pattern (arrow keys, Home/End). Focus goes to the dialog on open and returns to the diary button on close.

## Records (proposal for `engine/stories/types.ts`)
```ts
interface JournalEntryDef<F extends string = string> {
  id: string; act: number; when: F[];
  label: 'Encounter' | 'Clue' | 'Decision';
  text: string | Array<{ if: F[]; text: string }>;
  note?: string;                                      // id of the QuickNoteDef it produced
}
interface QuickNoteDef<F extends string = string> {
  id: string; act: number; when: F[];
  quote: string | Array<{ if: F[]; quote: string }>; // whole sentences, verbatim in authored beat text
  source: string | Array<{ if: F[]; source: string }>;
}
interface PersonDef<F extends string = string> {
  id: string; act: number; when: F[];
  name: string; struck?: boolean;                     // struck = first reading was wrong / cleared
  text: string | Array<{ if: F[]; text: string }>;
  source: string | Array<{ if: F[]; source: string }>;
}
// plus one authored Reflection per act ending: Array<{ if: F[]; text: string }>
```
The game narrates with AI, so quick notes must come from fixed beat text that the narration is required to deliver word for word. `qa:validate` should check each quote against its beat. The prototype checks it against the narration.

## What changes in `components/DiaryModal.tsx`
| Today | Becomes |
|---|---|
| Evidence tab (clue text repeated from the Journal) | Quick notes (verbatim lines, no repetition) |
| Entry icons, LEAD chips, lead pips, "New" pills, "✓ Complete" | Time tile + label; an amber dot for new; quill link to the note |
| AI lead fill-ins and AI "Watson's reflections" | Authored entries and an authored Reflection |
| Location arrival entries | Removed |
| Stacked tab headings ("The Casebook / Documents / 2 filed") | The count line on the tab only |
| The tab switches instantly | Animated, direction-aware switch with a fixed card size |
