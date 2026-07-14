# Plan 001 — HIGH: feel-breaking animation fixes (H1–H5)

Commit at time of writing: `f97684a`
Repo root: `/Users/t923375/Dropbox (Personal)/Claude Projects/LondonBleeds-Claude`

## Context for the executor (you have no other context)

React 19 + Vite + Tailwind 3.4 SPA — a moody Victorian text-adventure. Motion should feel composed and literary, never bouncy-SaaS. Verify with `npm run lint` (tsc --noEmit; the repo's only lint step). The dev server is started via the `.claude/launch.json` config named `London Bleeds — Dev Server` (do not run vite via plain shell if a preview tool is available).

Five findings from an animation audit. Do them in order. Touch ONLY what each step names.

---

## Step 1 (H1): Install `tailwindcss-animate` — the `animate-in` classes are dead code

The codebase uses `animate-in fade-in ...` utility classes in five components, but the `tailwindcss-animate` plugin that defines them was never installed. Those entrances have never rendered.

1. `npm install -D tailwindcss-animate`
2. In `tailwind.config.js`, change the last line of the config from:
   ```js
   plugins: [],
   ```
   to:
   ```js
   plugins: [require('tailwindcss-animate')],
   ```
3. Per-site adjustments now that the classes go live:
   - **`components/StoryRenderer.tsx:24-30`** — DELETE this branch entirely (a 500ms fade per word chunk must NOT activate; the typewriter is already the reveal):
     ```jsx
     if (animate && part.trim().length > 0) {
       return (
         <span key={j} className="animate-in fade-in duration-500 fill-mode-forwards">
           {part}
         </span>
       );
     }
     ```
     Both paths then return the plain `<span key={j}>{part}</span>`. Keep the `animate` parameter in the function signature (callers pass it); do not refactor callers.
   - **`components/GameOverScreen.tsx:12`** — change `duration-1000` to `duration-700` (dramatic surface; 700ms is enough).
   - **`components/CommandInput.tsx:98`** — change `duration-300` to `duration-200` (appears on every command; keep it quick).
   - **`components/Notification.tsx:20`** and **`components/ErrorBoundary.tsx:46`** — leave as-is; their authored values are correct once live.

## Step 2 (H2): Tame the per-turn command spring

`components/NarrativeFeed.tsx:113-115` currently:
```jsx
initial={isLatestUser ? { y: 300, opacity: 0 } : { opacity: 1 }}
animate={{ y: 0, opacity: 1 }}
transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.8 }}
```
The player's just-typed command flies in 300px on a spring on every turn. Replace with a short, fast settle:
```jsx
initial={isLatestUser ? { y: 12, opacity: 0 } : { opacity: 1 }}
animate={{ y: 0, opacity: 1 }}
transition={{ duration: 0.25, ease: 'easeOut' }}
```
Do not touch the `ref`, `key`, or `className` (the `scroll-mt-[120px]` is load-bearing for scroll anchoring).

## Step 3 (H3): Reduced-motion pass (currently zero handling repo-wide)

1. **`index.css`** — append at the end of the file:
   ```css
   /* Reduced motion: stop decorative continuous motion and entrance movement.
      animate-spin is kept — spinners communicate essential loading state. */
   @media (prefers-reduced-motion: reduce) {
     .animate-pulse,
     .animate-bounce,
     .animate-in {
       animation: none !important;
     }
   }
   ```
2. **`components/TypewriterBlock.tsx`** — reduced-motion users get the text instantly. Add above the component:
   ```tsx
   const prefersReducedMotion = () =>
     typeof window !== 'undefined' &&
     window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   ```
   Then as the FIRST statement inside the existing `useEffect` at line 23 (before the completion check):
   ```tsx
   if (prefersReducedMotion()) {
     if (displayedText !== text) setDisplayedText(text);
     return;
   }
   ```
   (The existing effect re-runs on `text` change, so streamed text still appears — just without the character reveal. The completion check on the next run handles `onComplete`.)
   Wait — with the early return, when `displayedText === text` the effect must still run the completion block. Place the guard AFTER the `displayedText.length === text.length` completion check instead, i.e. between line 28 (`}`) and line 30 (`setIsTyping(true)`).
3. **`components/NarrativeFeed.tsx`** — import `useReducedMotion` from `'motion/react'` (extend the existing import at line 11). At the top of the `NarrativeFeed` function body add `const reducedMotion = useReducedMotion();`. On the user-command `motion.div` from Step 2, change the transition line to:
   ```jsx
   transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
   ```
   Leave the other `motion.div`s (opacity-only fades) alone — opacity fades are acceptable under reduced motion.
4. **`components/ActBreakCurtain.tsx`** — import `useReducedMotion` from `'motion/react'`. Inside the component add `const reducedMotion = useReducedMotion();`. Change the outer `motion.div`'s exit (line 21) to `exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -40 }}` and the inner `motion.div` (lines 27-29) to use `initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}`.

## Step 4 (H4): Scope the global `*` theme transition

`index.css:57-66` currently:
```css
/* Smooth theme transition on all elements */
*, *::before, *::after {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 200ms;
  transition-timing-function: ease;
}

/* Preserve animation-only transitions from being overridden */
.animate-in, .animate-pulse, .animate-spin, .animate-bounce {
  transition: none;
}
```
This makes every DOM node a transition candidate — including the narration subtree that re-renders every ~12ms while the typewriter streams. Replace BOTH rules with a class-scoped version:
```css
/* Smooth theme transition — applied only while a theme switch is in flight
   (the .theme-transition class is toggled by useAppearance). Keeping this off
   the steady-state DOM avoids per-node transition style resolution during
   typewriter streaming. */
html.theme-transition *,
html.theme-transition *::before,
html.theme-transition *::after {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 200ms;
  transition-timing-function: ease;
}
```
Then in **`hooks/gameState/useAppearance.ts`** find the effect that applies the theme (line 47: `document.documentElement.dataset.theme = theme;`) and wrap the assignment so the class is present only around the switch, skipping the initial mount (no transition on first paint):
```ts
const isFirstTheme = document.documentElement.dataset.theme === undefined;
if (!isFirstTheme) {
  document.documentElement.classList.add('theme-transition');
  window.setTimeout(() => {
    document.documentElement.classList.remove('theme-transition');
  }, 250);
}
document.documentElement.dataset.theme = theme;
```
Match the file's existing style; if the effect already has cleanup logic, integrate rather than duplicate. Note: the old `.animate-pulse { transition: none }` opt-out also silently nullified a dead `transition-opacity` on the typewriter caret — that leftover is removed separately in Plan 003 (L2); nothing to do here.

## Step 5 (H5): Typewriter skip + early-`onComplete` guard

`components/TypewriterBlock.tsx` (full file is ~54 lines; read it first).

1. **Skip on click** — the reveal cannot be fast-forwarded today. On the wrapper `div` (line 49), add a click handler that completes the reveal, but not when the user is selecting text:
   ```tsx
   const handleSkip = () => {
     if (!window.getSelection()?.isCollapsed) return; // don't kill text selection
     setDisplayedText(text);
   };
   ```
   and `<div className={className} onClick={handleSkip}>`.
2. **Early-fire guard** — `onComplete` currently fires whenever `displayedText.length === text.length` (line 24), which can be true mid-stream while `text` is still growing, firing completion side-effects (e.g. `onJournalDone` → `NarrativeFeed.tsx:148`) early. Add a prop `isComplete?: boolean` (default `true`) to `TypewriterBlockProps` and guard the callback:
   ```tsx
   if (displayedText.length === text.length) {
     setIsTyping(false);
     if (isComplete) onComplete?.();
     return;
   }
   ```
   Also add `isComplete` to the effect dependency comment if the file lists deps (it uses an eslint-disable; keep that pattern).
3. **Wiring** — trace where the journal `TypewriterBlock` gets its text: `components/NarrativeFeed.tsx:145-151`. Determine whether journal messages stream incrementally or are appended complete (check `hooks/gameState/useSceneStreams.ts` and `hooks/gameState/narration.ts`). If they stream, thread a streaming flag: `App.tsx` has `gs.isLoading`; pass `isStreaming={gs.isLoading}` into `NarrativeFeed` (add to `NarrativeFeedProps`) and set `isComplete={!isStreaming}` on the journal `TypewriterBlock` (line 146). If journal text is provably appended complete, the default `true` already preserves behavior — add the prop anyway (it documents the contract) and note the finding in the PR/commit message.

## Scope boundaries

- Do NOT touch: engine/, server/, services/, any story data.
- Do NOT restyle anything; class changes are limited to the exact strings quoted.
- Do NOT add motion tokens here (that's Plan 002).

## Verification

1. `npm run lint` passes.
2. Start the dev server, play 2-3 turns:
   - Your typed command settles in quickly from ~12px below (no 300px flight).
   - Clicking on typing narration completes it instantly; selecting text does not.
   - Loading hint chip above the input fades/zooms in (was: snap).
3. Toast: trigger a save/notification — it should now slide in from the top.
4. Theme: switch Light↔Dark in Settings — colors still cross-fade smoothly (the scoped rule works); typing narration while switching doesn't glitch.
5. DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce": typewriter renders instantly, pulses/bounces stop, command line appears without movement, curtain fades without vertical drift.
6. Performance sanity: record a Performance trace during a long narration stream before/after — style/recalc time during streaming should drop (H4).
7. Feel-check at 50% playback (DevTools → Animations panel): the command settle should read as a quiet confirmation, not a bounce.
