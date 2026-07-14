# Plan 003 — LOW: polish fixes (L1–L5)

Commit at time of writing: `f97684a`
Repo root: `/Users/t923375/Dropbox (Personal)/Claude Projects/LondonBleeds-Claude`
**Depends on: Plan 002 Step 0** (L5 uses `components/motionTokens.ts`).

## Context for the executor (you have no other context)

React 19 + Vite + Tailwind 3.4 SPA — a moody Victorian text-adventure. `npm run lint` = tsc --noEmit. Dev server: `.claude/launch.json` config `London Bleeds — Dev Server`. Small, surgical edits only.

---

## Step 1 (L1): GameOverScreen hover — 150ms, transform only

`components/GameOverScreen.tsx:29`, the restart button currently:
```
className="group flex items-center gap-3 px-10 py-4 bg-lb-primary text-lb-bg rounded-full font-sans text-xs tracking-[0.2em] uppercase hover:bg-lb-accent transition-all duration-500 shadow-xl hover:shadow-2xl hover:-translate-y-1"
```
Replace `transition-all duration-500 shadow-xl hover:shadow-2xl` with `transition-[transform,background-color] duration-150 ease-out shadow-xl` (i.e. drop the animated shadow, keep the static `shadow-xl`, keep `hover:-translate-y-1` and `hover:bg-lb-accent`). Hover feedback at 500ms feels unresponsive; box-shadow tweens are paint-expensive for no perceptible gain here.

## Step 2 (L2): Remove the dead caret transition

`components/TypewriterBlock.tsx:18`, the default `cursorClassName` contains both `animate-pulse` and `transition-opacity duration-300`. The transition never did anything (the old `index.css` `.animate-pulse { transition: none }` rule nullified it, and that rule was removed in Plan 001 Step 4 — leaving it now would make the caret's opacity transition fight `animate-pulse`). Delete `transition-opacity duration-300` from the string; also check `components/NarrativeFeed.tsx:150` — its journal `cursorClassName` should not contain a `transition-opacity` either (at audit time it didn't; verify).

## Step 3 (L3): Stop fading a backdrop-blur

`components/DiaryModal.tsx:128`, the overlay:
```
fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 transition-opacity duration-200 ${entered ? 'opacity-100' : 'opacity-0'}
```
Remove `backdrop-blur-sm`. Fading an element with backdrop-filter forces a full re-blur every frame; the `bg-black/60` tint carries the dimming on its own. The static `backdrop-blur-sm` on the sticky header (`Header.tsx:167`) and on the modals' non-transitioning backdrops is accepted — leave those.

## Step 4 (L4): Act curtain — documented as by-design, NO change

The audit flagged that `components/ActBreakCurtain.tsx` blocks the command input (`App.tsx:167-175` folds `isCurtainPlaying` into `isLoading`) with no skip. It is rare (~6×/playthrough) and deliberately cinematic. **Decision: keep as-is.** This step exists only so the finding has a recorded disposition. If the user later wants a skip, the shape would be an `onClick` on the curtain that flips `isCurtainPlaying` early in `hooks/gameState/useActBreak.ts` — do not build it now.

## Step 5 (L5): "Begin Act" button onto the shared tokens

`components/NarrativeFeed.tsx:196-201`:
```jsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
  className="my-10 flex justify-center"
>
```
Change the transition to `transition={{ duration: DUR_PANEL, ease: EASE_OUT }}` using the tokens from `components/motionTokens.ts` (created in Plan 002 Step 0); extend the existing import in this file. 0.3s ease-out brings this plain control into the same band as its Tailwind siblings.

## Scope boundaries

- Only the five locations above. No engine/, server/, services/, story-data edits.
- Do not restructure any component.

## Verification

1. `npm run lint` passes.
2. Dev server feel-checks:
   - Hover the "Begin a New Diary" button on a finished game (or temporarily render `<GameOverScreen />` to check — revert any scaffolding): lift responds within ~150ms; shadow no longer tweens.
   - Open the Diary — the overlay fade should look identical minus the blur; scrub frame-by-frame if unsure.
   - The typewriter caret still blinks (pulse) — no behavior change expected from Step 2.
   - Reach an act break — the "Begin Act" button rises in 300ms, matching nearby UI.
