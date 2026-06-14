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

Insert an explicit **act-break curtain** between the journal entry and the
new-act commit. The curtain is a full-screen overlay (theatrical interstitial)
that gates the transition: the new-act state commits, and an arrival scene
generates, only when the player clicks **Begin Act II**.

### New player-facing sequence

1. **Act I narration** streams — consequence of the triggering action (unchanged).
2. **Watson's journal** appends below it (unchanged).
3. **Curtain rises** — full-viewport overlay:
   `End of Act I` → ornament → `Act II · The Double Event` → **[Begin Act II]**.
   Command input is locked while the curtain is up.
4. Player clicks **Begin Act II**:
   - Deferred state commits → sidebar flips to Act II.
   - **Arrival scene** auto-generates and streams (Watson surveys the new
     location, hour, weather, who is present).
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

A new `commitActTransition()` applies the four stashed setters, persists to
Supabase, clears `pendingActTransition`, then triggers the arrival scene.

`pendingActTransition` (truthy) is also the signal that drives the curtain UI and
locks command input.

### 2. Arrival scene (`hooks/useGameState.ts`)

Reuses the existing `generateOpeningScene` pattern (~line 306–352): build a
`SessionSnapshot` at the new act's anchor (`location: ACT_ANCHORS[newAct]`,
`currentAct: newAct`, `elapsedMinutes: 0`, current inventory/flags/npc states),
run `gameEngine.resolve(parseIntent('look'), snapshot)`, and stream the result
in `full` narration mode. Append the streamed prose to history as a normal
assistant message. Runs as the tail of `commitActTransition()`.

### 3. Curtain overlay (`components/ActBreakCurtain.tsx` — new)

Full-viewport overlay, shown when `pendingActTransition` is set. Themed in the
real palette (ink `#15181f` bg, ivory text, brass `#CD7B00` accents).

- Top line: `End of Act {ACT_ROMAN[fromAct]}` — for `fromAct === 0`, read
  `End of Prologue`.
- Ornamental rule.
- Next-act title: `Act {ACT_ROMAN[toAct]}` + `{ACT_NAMES[toAct]}`.
- **[Begin Act {ACT_ROMAN[toAct]}]** button → calls `commitActTransition()`.
- Fade-in on mount; fade/lift-out on Begin.

`ACT_ROMAN` currently lives privately in `services/AIService.ts` (line 107). Lift
it to a shared module (e.g. `engine/gameData.ts` export, or `constants.ts`) so the
curtain and AIService share one source. `ACT_NAMES` and `ACT_ANCHORS` are already
exported from `engine/gameData.ts`.

Wired in `App.tsx` alongside the existing `GameOverScreen` overlay.

### 4. Input lock

`CommandInput` is disabled while `pendingActTransition` is set, the same way it is
during `isLoading` / `isGameOver`. The full-screen overlay also visually covers the
input.

## Edge cases

- **Game over** (`result.gameOver`): no curtain. The true-ending coda
  (`TRUE_ENDING_CODA`, appended as `type: 'journal'`) and cold-case epilogue paths
  are untouched.
- **Prologue → Act I** (act 0 → 1): same curtain, top line reads `End of Prologue`.
- **Reload mid-curtain (IN for v1):** persist the `pendingActTransition` marker so
  a reload re-shows the curtain. Without it, a reload would strand the player at
  end-of-Act-I with the gate flags already spent (the trigger cannot re-fire),
  which is a genuinely broken state — so this is correctness, not polish. Saved
  game state stays Act I plus a "transition pending" marker; on load, if the marker
  is present, re-show the curtain instead of resuming play.

## Non-goals

- No change to how act *triggers* are detected (`checkActProgression` is untouched).
- No change to the Act I narration or journal content.
- No new authored per-act text (the arrival scene is AI-generated, consistent with
  the existing opening scene).

## Success criteria

1. On act advance, the sidebar's location/time/date/weather/people remain at Act I
   values until **Begin Act {N}** is clicked.
2. A full-screen curtain appears after the journal entry and locks input until
   dismissed.
3. Clicking Begin commits the new-act state, streams an arrival scene, and leaves a
   permanent act divider in the feed.
4. Game-over transitions show no curtain (endings unchanged).
5. Reloading while the curtain is showing re-shows the curtain.
