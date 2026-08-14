# Turn Failure Screen — Design

**Date:** 2026-08-14
**Status:** Design approved; pending spec review

## Problem

When a turn fails, the catch block in `hooks/useGameState.ts` overwrites the
trailing assistant history entry with:

```
> *The connection to the investigation archives was momentarily lost. Please try again.*

> *(Debug: AI gateway error (500))*
```

Three things are wrong with this, and only the third is cosmetic.

**1. "Please try again" is unsafe advice.** The message names no distinction
between a turn that resolved and a turn that did not. In the common case the
engine already ran: `handleAction` applies state optimistically at STEP 4
(`location`, `flags`, `inventory`, clock, clue discoveries) and the Supabase
write at STEP 5 has committed. The failure is at STEP 7, the AI narration
stream. Re-typing the command therefore re-runs the engine against mutated
state: a second `MOVE` moves again, the clock advances twice, an act gate can
fire twice. The player is being told to do the one thing that corrupts the run.

**2. The turn's autosave is skipped.** The single per-turn save sits at
`useGameState.ts:870`, inside the `try`, after the narration stream merges
continuity. When narration throws, that call never happens. Local storage
still holds the *previous* turn while React state has advanced, and for a
signed-in player the cloud write at STEP 5 already landed. Local and cloud
disagree after every failure.

**3. Developer output sits inside story prose.** `(Debug: …)` renders as
italic in-fiction text in the narrative feed, and the surrounding scene block
still describes the pre-action room, so the screen reads as stale.

## Goal

A blocking failure screen that halts play, states truthfully whether the turn
resolved, offers a retry that is safe for that specific failure, and lets the
player save up to the point of failure.

The game is not expected to function without the AI. Degrading to
deterministic prose was considered and rejected: narration is the product.

## Decisions

| Question | Decision |
|---|---|
| What raises the screen | Any failed turn: AI gateway, network, or an engine throw |
| Side calls (Holmes hint, act journal, diary-lead prose) | Keep failing silently as they do now. Bonus content must not halt play |
| What Retry does | Re-requests narration for the already-resolved turn. Never re-runs the engine |
| What Save captures | The resolved turn, matching what cloud committed at STEP 5 |
| Rollback | Not implemented. Contradicts the STEP 5 write and adds a path with no other consumer |

## Design

### 1. Failure state, in its own hook

Per the decomposition pattern established under `hooks/gameState/`, a new
`hooks/gameState/useTurnFailure.ts` owns one piece of state:

```ts
export type TurnFailureCause = 'ai' | 'network' | 'engine';

export interface TurnFailure {
  cause: TurnFailureCause;
  /** Raw error text. Shown in the screen's debug footer, never in the feed. */
  debug: string;
  /** 'narration' re-requests prose only; 'turn' re-runs the whole action. */
  retryKind: 'narration' | 'turn';
  retry: () => Promise<void>;
  /** Post-engine values for the skipped autosave. Null when nothing resolved. */
  saveOverrides: SaveGameOverrides | null;
  attempts: number;
}
```

`useGameState` exposes `turnFailure` and its setter. No existing state shape
changes.

`cause` is derived, not guessed: a rejected `fetch` (no response) is
`'network'`, a non-ok response from `/api/ai` is `'ai'`, and anything thrown
before STEP 4 is `'engine'`. `cause` drives only the eyebrow copy and the
connection dot; `retryKind` is what governs behaviour.

### 2. Two retry kinds, and why the distinction is the safety property

An **engine throw** happens at STEP 3, before STEP 4 applies anything. Nothing
is mutated, nothing is persisted, so re-running the whole action is safe:
`retryKind: 'turn'`.

An **AI failure** happens at STEP 7, after state is applied and the cloud write
committed. The only safe retry re-requests narration for the turn that already
resolved: `retryKind: 'narration'`.

To make the narration-only retry possible, STEP 7's stream-and-persist block
becomes a local closure defined after `aiContext` is built, capturing the
already-computed `newLocation` / `newFlags` / `newInventory` / `newNpcStates`
rather than re-reading React state. The catch stashes that closure as `retry`.

A retry that fails again re-arms the screen and increments `attempts`. Copy at
`attempts >= 2` steers toward saving rather than repeated retries.

On success the screen unmounts and the narration streams into the same trailing
history entry that held the break-off line, replacing it. The player sees the
turn complete normally, with no duplicate entry.

**Act-advance turns.** When `advancingAct` is true the autosave at
`useGameState.ts:869` is deliberately skipped, because sidebar state is held
back until the player clicks "Begin Act N". A failure on such a turn therefore
carries `saveOverrides: null`, and Save persists current (pre-advance) React
state. This is consistent: the DB is already committed to the new act by STEP 5,
so a reload resumes in the new act exactly as the existing mid-curtain reload
path does.

### 3. Save closes the local/cloud gap

The screen's Save calls `handleSaveGame(false, saveOverrides)` with the same
override object built at `useGameState.ts:870`, which is the save that
currently gets skipped. For an engine throw `saveOverrides` is `null`, so the
save uses current state, which is already correct because nothing was applied.

**Ordering matters.** `handleSaveGame` serialises `history`, so the authored
break-off line must be written into history *before* the failure state is set.
The saved feed then reads coherently on reload.

### 4. What the feed shows

The catch stops writing developer output into story prose. The trailing
assistant entry becomes a single authored line marking where the record breaks
off. No "please try again", no `(Debug: …)`.

### 5. The screen

`components/TurnFailureScreen.tsx`, mounted from `App.tsx` inside the existing
`AnimatePresence`, at `z-[70]` so it sits above the act curtain's `z-[60]`.
Follows `ActBreakCurtain`: `fixed inset-0`, solid `--lb-bg`, `EASE_OUT` /
`DUR_PANEL`, `useReducedMotion`.

Approved mockup: `.superpowers/turn-failure-mockup.html` (gitignored).

Copy per state, all four written to avoid em dashes per house voice:

| State | Eyebrow | Flavour | Functional note |
|---|---|---|---|
| AI failure | The archive did not answer | The case moved. The pen did not. | Action resolved and recorded; only the written account failed to arrive. Retry asks for the account again, it will not repeat the action |
| Retry failed | The archive did not answer | The case moved. The pen did not. | Asked twice, nothing back. The action still stands, so nothing is lost by waiting |
| Engine throw | The page would not turn | The case did not move. | Action never resolved, nothing changed. Retry will attempt the action again |
| After save | The archive did not answer | The case moved. The pen did not. | Saved as it stands, up to and including the last action |

Controls: **Retry**, **Save and wait**, and a connection re-check wired to the
existing `retryConnections` from `useConnections.ts:36`, so the player can see
whether Gemini is back before retrying. On an engine throw the connection dot
reads green, which is the useful tell that the fault is local.

Debug footer keeps the raw error string in a de-emphasised monospace line. The
owner is the only player and the only developer; a silent screen costs
diagnosis. It is visually subordinate and clearly out of fiction, unlike the
current italic prose treatment.

### 6. Accessibility constraints (binding, not aspirational)

`--lb-muted` measures 2.57:1 (light), 3.29:1 (dark), 3.17:1 (evening) and
3.45:1 (night) against `--lb-bg`. **It is not a text colour on any theme.**
Body copy uses `--lb-primary` at 85%, quiet text at 75%. Verified ratios:

| Element | Light | Dark | Evening | Night |
|---|---|---|---|---|
| Body copy | 7.51 | 9.75 | 6.82 | 9.70 |
| Eyebrow, debug footer | 5.54 | 7.87 | 5.14 | 7.83 |
| Buttons, headings | 11.88 | 13.19 | 10.29 | 13.12 |

Two related findings this surfaced, both inherited from existing components:

- `GameOverScreen`'s `hover:bg-lb-accent` with background-coloured text is
  **3.12:1** on light and **3.31:1** on evening. The new screen keeps its dark
  fill on hover and signals with an accent ring instead. **The existing
  `GameOverScreen` is left unchanged**; fixing it is out of scope here and is
  noted for a separate pass.
- Accent-as-text passes only on the dark themes (6.69 / 6.70) and fails on
  light and evening. The screen uses accent for borders, ornament, and focus
  rings only.

Also required: `role="alertdialog"` with `aria-labelledby` / `aria-describedby`,
`:focus-visible` rings, status conveyed in words as well as dot colour, and a
`prefers-reduced-motion` guard on the pulsing check indicator.

Uppercase is limited to a single element (the eyebrow), retaining the
`tracking-[0.3em]` treatment `ActBreakCurtain` established.

Lato is retained deliberately for legibility. The design-hook waiver is
recorded in `.impeccable/config.json`.

### 7. Input lockout

`CommandInput`'s `isLoading` gains `|| gs.turnFailure !== null`, so the player
cannot type into a halted turn.

## Files

| File | Change |
|---|---|
| `hooks/gameState/useTurnFailure.ts` | New. Owns `TurnFailure` state |
| `hooks/useGameState.ts` | Extract STEP 7 into a retryable closure; rewrite the catch; expose `turnFailure` |
| `components/TurnFailureScreen.tsx` | New |
| `App.tsx` | Mount the screen; extend the input lockout |

## Non-goals

- Rolling back a resolved turn.
- Deterministic prose fallback so play continues without AI.
- Fixing `GameOverScreen`'s button contrast.
- Raising the screen for side calls that currently fail silently.
- A narration kill switch equivalent to `VITE_AI_PARSER='off'`.

## Verification

`npm run lint` and `npm run qa:all` must stay green. No QA harness covers this
path, so they are a regression net, not proof.

There is no browser test framework in this repo, so behaviour is verified
manually by temporarily forcing a throw in `AIService.stream`, then exercising:

1. AI failure raises the screen; the feed shows the authored line, no debug prose.
2. Retry succeeds; narration lands for the already-resolved turn; the engine did not re-run (clock advanced once, location moved once).
3. Retry fails again; `attempts` increments and copy shifts.
4. Save, reload; the resumed state includes the failed turn and matches cloud.
5. Engine throw raises the screen with `retryKind: 'turn'`; retry re-runs the action cleanly.
6. Command input is locked while the screen is up.

The stub is reverted before the work is considered done.

Contrast claims are verified by computation, not by eye. The checker lives at
`.superpowers/contrast-check.mjs` (gitignored, beside the mockup) and exits
non-zero on any AA violation. Re-run it if `index.css` token values change:

```bash
node .superpowers/contrast-check.mjs
```
