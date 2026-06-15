# Act-break curtain — design

**Date:** 2026-06-15
**Status:** Approved, pending implementation plan

## Problem

When an act advances, the game has no sense of an ending. The triggering action's
narration streams, Watson's journal summary appends below it, and then the game
**silently slides into the next act** — the next command the player types is already
in Act II. There is no pause, no punctuation, no "curtain."

Worse, the sidebar (location, time, date, weather, people present) **flips to the
new act's state immediately** — while the player is still reading the Act I
narration and journal. The act transition has already mutated game state before
the player has acknowledged the act ended.

## Root cause

On an act-advancing turn the engine returns a single `result` that commits
everything at once:

- `engine/GameEngine.ts` (~line 117–147): when a `talk`/`show` gate flag fires,
  `checkActProgression` sets `result.newAct`, and the **act-anchor auto-move**
  sets `result.newLocation = ACT_ANCHORS[newAct]` and computes the new act's NPC
  movements into `result.npcUpdates`.
- The narration (`result.aiContext`) is built **inside the resolver from the old
  session**, so it correctly reflects Act I's location/act — the narration itself
  is not the problem.
- `hooks/useGameState.ts` (~line 693–753) commits the result optimistically:
  `setLocation`, `setCurrentAct`, `setNpcStates`, and `setElapsedMinutes(0)`
  (reset to the new act's canonical start) all fire on the same turn.

The sidebar (`App.tsx` ~line 95–108) reads `gs.location`, `gs.currentAct`,
`gs.npcStates`, `gs.displayTime`, `gs.displayDate`, `gs.weather`. The last three
are **derived** from `currentAct` + `elapsedMinutes`. So the four state setters
above are the *only* things that move the sidebar — defer them and the sidebar
holds at Act I.

## Solution overview

Insert an explicit, **player-paced** act break between the journal entry and the
new-act commit. The diary entry types out in the feed as the natural close of the
act; only after the player has read it and clicked **Begin Act II** does the
new-act state commit, a cinematic curtain play, and an arrival scene generate.

The curtain **never appears on its own** — it must not slide up over a diary entry
the player has not finished reading. The read-acknowledgment is a single in-feed
gesture, gated on the diary's typewriter completing.

### New player-facing sequence

1. **Act I narration** types out (typewriter, unchanged).
2. **Watson's journal types out in the feed** — same diary chrome (the
   *Watson's Journal* label + italic serif styling), but now driven by the
   typewriter effect instead of a static fade. The feed auto-scrolls to keep it in
   view (today it can land below the fold). Command input stays locked.
3. **When the diary finishes typing**, a single quiet **[Begin Act II]** button
   fades in beneath it, in the feed. Nothing covers the diary; the player reads at
   their own pace and clicks when ready.
4. Player clicks **Begin Act II**:
   - A brief **cinematic curtain** plays as a full-screen overlay —
     `End of Act I` → ornament → `Act II · The Double Event` — with no button of
     its own (the gesture already happened in step 3).
   - Behind the overlay, the deferred state commits → sidebar is now Act II.
   - The curtain lifts and the **arrival scene** auto-generates and streams
     (Watson surveys the new location, hour, weather, who is present).
   - A slim permanent `⸻ Act II ⸻` divider is left in the feed as a
     scroll-back landmark.

## Components

### 1. Deferred commit (`hooks/useGameState.ts`)

When `result.newAct && !result.gameOver`:

- **Commit now** (Act I's action belongs to the turn just taken): inventory,
  medical/moral points, `flags` (the gate flags that fired the act are invisible
  to the sidebar), the streamed narration, and the journal entry.
- **Stash, do not commit** into a new `pendingActTransition` object:
  - `newAct`
  - `newLocation` (the `ACT_ANCHORS[newAct]` anchor) + its visit-count bump
  - the act-movement `npcUpdates`
  - the `elapsedMinutes` reset (to 0)
- These four are the only sidebar-visible state. Holding them keeps the sidebar
  in Act I until Begin.

A new `commitActTransition()` — called when the player clicks the in-feed
**Begin Act II** button — plays the cinematic curtain, applies the four stashed
setters, persists to Supabase, clears `pendingActTransition`, then streams the
arrival scene.

`pendingActTransition` carries the data the act break needs:
`{ fromAct, toAct, ...stashed setters }`. Its presence drives the read-gate (the
in-feed Begin button), the cinematic curtain, and the command-input lock.

### 2. Diary typewriter (`components/NarrativeFeed.tsx`, `TypewriterBlock.tsx`)

Today journal entries render statically: `NarrativeFeed`'s typewriter branch is
gated on `!isJournal` (~line 103), so the act-closing diary skips the typewriter
and fades in via `StoryRenderer`. The diary "styling" is just the surrounding
chrome (the `Feather` icon + *Watson's Journal* label + the italic serif,
muted-color container); the text itself already goes through `StoryRenderer`,
which is what `TypewriterBlock` types into.

Change: when a journal entry is the latest message, render the diary chrome and run
its inner text through the typewriter (keep the chrome, swap the static
`StoryRenderer` for the typing one). `TypewriterBlock` currently hardcodes
`StoryRenderer` and an accent cursor — give it an optional `renderer` /
`className` prop (or add a thin journal-typing variant) so the typed text inherits
the diary's italic-serif, muted styling and an unobtrusive cursor. On completion
it fires `onComplete`, which the hook uses to reveal the **Begin Act II** button.
The feed auto-scrolls (existing scroll behavior) so the diary stays in view.

### 3. Read-gate: in-feed Begin button

Once the diary's typewriter completes (its `onComplete`), a single quiet
**Begin Act II** button fades into the feed beneath the diary entry — only while
`pendingActTransition` is set and the diary has finished typing. This is the entire
read-acknowledgment: the player reads at their own pace, then clicks it, which
calls `commitActTransition()`. Nothing covers the diary before this point.

### 4. Arrival scene (`hooks/useGameState.ts`)

Reuses the existing `generateOpeningScene` pattern (~line 306–352): build a
`SessionSnapshot` at the new act's anchor (`location: ACT_ANCHORS[newAct]`,
`currentAct: newAct`, `elapsedMinutes: 0`, current inventory/flags/npc states),
run `gameEngine.resolve(parseIntent('look'), snapshot)`, and stream the result
in `full` narration mode. Append the streamed prose to history as a normal
assistant message. Runs as the tail of `commitActTransition()`.

### 5. Cinematic curtain (`components/ActBreakCurtain.tsx` — new)

A full-viewport overlay that plays as a **non-interactive transition** — it appears
only after the player clicks Begin (step 3), so it never covers an unread diary. It
has no button of its own. Themed in the real palette (ink `#15181f` bg, ivory text,
brass `#CD7B00` accents).

- Top line: `End of Act {ACT_ROMAN[fromAct]}` — for `fromAct === 0`, read
  `End of Prologue`.
- Ornamental rule.
- Next-act title: `Act {ACT_ROMAN[toAct]}` + `{ACT_NAMES[toAct]}`.
- Fade-in on mount, hold a beat, then lift/fade-out — during which the deferred
  state commits behind the overlay (sidebar hidden), so on lift everything is
  Act II and the arrival scene begins streaming.

`ACT_ROMAN` currently lives privately in `services/AIService.ts` (line 107). Lift
it to a shared module (e.g. `engine/gameData.ts` export, or `constants.ts`) so the
curtain and AIService share one source. `ACT_NAMES` and `ACT_ANCHORS` are already
exported from `engine/gameData.ts`.

Wired in `App.tsx` alongside the existing `GameOverScreen` overlay.

### 6. Input lock

`CommandInput` is disabled for the whole act-break window — from the act-advancing
turn, through the diary typewriter and read-gate, until the arrival scene finishes
streaming (`pendingActTransition` set, or arrival in progress), mirroring how it is
disabled during `isLoading` / `isGameOver`. The cinematic overlay also visually
covers the input while it plays.

## Edge cases

- **Game over** (`result.gameOver`): no curtain. The true-ending coda
  (`TRUE_ENDING_CODA`, appended as `type: 'journal'`) and cold-case epilogue paths
  are untouched.
- **Prologue → Act I** (act 0 → 1): same flow, curtain top line reads
  `End of Prologue`.
- **Journal generation fails / empty:** the diary is bonus content and may fail to
  generate (existing behavior swallows the error). The read-gate must not softlock —
  if there is no diary entry to type out, reveal the **Begin Act II** button
  immediately rather than waiting on a typewriter that will never fire.
- **Reload mid-break (IN for v1):** the vulnerable window is after the diary appends
  but before Begin is clicked (the gate flags are already spent, so the trigger
  cannot re-fire). Persist the `pendingActTransition` marker; saved game state stays
  Act I plus this marker. On load, if the marker is present, restore the diary entry
  (already persisted as a log entry) in its read state and re-show the in-feed
  **Begin Act II** button, rather than resuming play or stranding the player.

## Non-goals

- No change to how act *triggers* are detected (`checkActProgression` is untouched).
- No change to the Act I narration or journal content.
- No new authored per-act text (the arrival scene is AI-generated, consistent with
  the existing opening scene).

## Success criteria

1. On act advance, the sidebar's location/time/date/weather/people remain at Act I
   values until **Begin Act {N}** is clicked.
2. The act-closing diary entry types out with the typewriter effect while keeping
   its diary styling, and stays in view (auto-scroll) rather than landing below the
   fold.
3. The **Begin Act II** button appears only after the diary finishes typing; nothing
   covers the diary before the player clicks it. Input is locked throughout the
   break.
4. Clicking Begin plays the cinematic curtain, commits the new-act state, streams an
   arrival scene, and leaves a permanent act divider in the feed.
5. Game-over transitions show no curtain (endings unchanged).
6. Reloading during the break (diary shown, Begin not yet clicked) restores the
   diary and re-shows the Begin button.
