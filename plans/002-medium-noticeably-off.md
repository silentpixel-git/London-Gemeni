# Plan 002 — MEDIUM: noticeably-off animation fixes (M1–M8)

Commit at time of writing: `f97684a`
Repo root: `/Users/t923375/Dropbox (Personal)/Claude Projects/LondonBleeds-Claude`
**Depends on: Plan 001** (Step 1 installed `tailwindcss-animate`; several steps below use its `animate-in` utilities).

## Context for the executor (you have no other context)

React 19 + Vite + Tailwind 3.4 SPA — a moody Victorian text-adventure. Motion should feel composed and literary. `npm run lint` = tsc --noEmit (the only lint step). Dev server: `.claude/launch.json` config named `London Bleeds — Dev Server`.

Do the steps in order — Step 0 creates the motion vocabulary the later steps reference.

---

## Step 0 (M5): Establish the motion vocabulary (tokens)

Today the app uses 150/200/300/500/1000ms across four uncoordinated easings in CSS, plus 0.5/0.6/0.7s and one spring in the `motion` library. Anchor both systems:

1. **`tailwind.config.js`** — inside `theme.extend`, after the `fontFamily` block, add:
   ```js
   // Motion vocabulary — see plans/002 for the full rationale.
   //   hover/controls: duration-150 ease-out
   //   dropdowns/toasts/chips: duration-200 ease-out
   //   panels/modals/sheets: duration-300 ease-out (slides may use ease-out-expo)
   //   dramatic/scene moments only: duration-500..700
   transitionTimingFunction: {
     'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
   },
   ```
   (Tailwind's built-in `ease-out` = `cubic-bezier(0, 0, 0.2, 1)` is the default choice; `ease-out-expo` is for larger panel/sheet slides.)
2. **Create `components/motionTokens.ts`** — the single source of truth for the `motion` (Framer) side:
   ```ts
   /**
    * components/motionTokens.ts
    *
    * Motion vocabulary for `motion/react` components, mirroring the Tailwind
    * side (see tailwind.config.js): controls 0.15s, small UI 0.2s, panels 0.3s,
    * dramatic scene moments 0.5–0.7s. All UI movement eases OUT.
    */
   export const EASE_OUT: [number, number, number, number] = [0, 0, 0.2, 1];
   export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
   export const DUR_CONTROL = 0.15;
   export const DUR_SMALL = 0.2;
   export const DUR_PANEL = 0.3;
   export const DUR_DRAMATIC = 0.6;
   ```
3. Migrate the existing `motion` configs to the tokens (values stay dramatic where the surface is dramatic — this is consolidation, not flattening):
   - `components/ActBreakCurtain.tsx:22` — `transition={{ duration: 0.6 }}` → `transition={{ duration: DUR_DRAMATIC, ease: EASE_OUT }}`
   - `components/ActBreakCurtain.tsx:29` — `transition={{ delay: 0.3, duration: 0.7 }}` → `transition={{ delay: 0.3, duration: DUR_DRAMATIC, ease: EASE_OUT }}`
   - `components/NarrativeFeed.tsx:137` — `transition={{ duration: 0.6 }}` → `transition={{ duration: DUR_DRAMATIC, ease: EASE_OUT }}` (act-closing journal; dramatic is correct)
   - The user-command transition was already set by Plan 001 Step 2 to `{ duration: 0.25, ease: 'easeOut' }` — change it to `{ duration: 0.25, ease: EASE_OUT }` for consistency (keep the Plan 001 reduced-motion branch).
   - Add the imports to both files: `import { EASE_OUT, DUR_DRAMATIC } from './motionTokens';` (adjust the named list per file).

## Step 1 (M1): Header dropdowns — grow from the trigger instead of teleporting

`components/Header.tsx` has two dropdown menus (guest ~line 253-265, profile ~line 341-353). Each renders:
```jsx
<div
  ref={guestMenuRef}   /* or profileMenuRef */
  className={`absolute right-0 w-56 bg-lb-paper border border-lb-border rounded-lg shadow-xl z-20 max-h-[80vh] overflow-y-auto ${
    guestMenuPositionAbove ? 'bottom-full mb-2' : 'top-full mt-2'
  }`}
>
```
Change the template-literal so the entrance animates from the trigger corner (entrance only — instant close on dismiss is deliberate):
```jsx
className={`absolute right-0 w-56 bg-lb-paper border border-lb-border rounded-lg shadow-xl z-20 max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 ease-out ${
  guestMenuPositionAbove ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right'
}`}
```
Apply the identical change to both menus (swap `guestMenuPositionAbove` / `profileMenuPositionAbove`).

## Step 2 (M2): Give the four static modals the same entrance as the rest

Four modals appear instantly; DiaryModal (fade + sheet slide) and ErrorBoundary (`animate-in zoom-in-95`, live since Plan 001) define the house style. Unify on: **root overlay fades 200ms, card zooms from 95% + fades 200ms.**

For each file below, add `animate-in fade-in duration-200` to the ROOT fixed-inset container's className, and `animate-in fade-in zoom-in-95 duration-200 ease-out` to the CARD div:

- `components/AuthModal.tsx` — root at line ~182 (`fixed inset-0 z-[200] flex items-center justify-center p-4`, has an inline backgroundColor style — leave the style); card at line ~189 (`relative w-full max-w-md bg-lb-bg border border-lb-border rounded-xl shadow-2xl overflow-hidden`).
- `components/EditProfileModal.tsx` — card at line 108 (`relative w-full max-w-sm bg-lb-paper ...`); root is the enclosing `fixed inset-0` div a few lines above.
- `components/ResetPasswordModal.tsx` — card at line 87 (`relative w-full max-w-md bg-lb-bg ...`); root likewise above.
- `components/SaveSlotsModal.tsx` — card at line 79 (`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-lb-paper ...`); root likewise above.

Do NOT touch `components/DiaryModal.tsx` (already correct) or `components/ErrorBoundary.tsx` (already uses the idiom).

## Step 3 (M3): Sidebar — property-scope the slide, fix easing, tighten the content fade

`components/Sidebar.tsx:72`:
```
fixed lg:relative z-50 h-full border-r border-lb-border transition-all duration-300 ease-in-out flex flex-col bg-lb-bg flex-shrink-0 overflow-hidden w-80
```
Replace `transition-all duration-300 ease-in-out` with `transition-[width,transform,opacity] duration-300 ease-out-expo` (the `ease-out-expo` token from Step 0). Known tradeoff, do not "fix": the `w-80 ↔ lg:w-0` width tween is how the main column reflows on desktop; a transform-only FLIP refactor is out of scope.

`components/Sidebar.tsx:82`:
```
flex-1 overflow-y-auto p-8 w-80 ${isSidebarOpen ? 'opacity-100 transition-opacity duration-500 delay-100' : 'opacity-0'}
```
Change `duration-500 delay-100` to `duration-300 delay-75` so the content lands with the container instead of trailing it.

`App.tsx:190` — the main column `<div className="flex-1 flex flex-col h-full relative w-full transition-all duration-300">`: replace `transition-all duration-300` with `transition-[width] duration-300 ease-out-expo` (it only needs to follow the sidebar's width change; `transition-all` also fought the global theme rule).

## Step 4 (M4): Remove `transition-all` from the streaming narration path

`components/StoryRenderer.tsx` re-renders on every typewriter tick (~12ms):
- Line 58: delete `transition-all duration-200` from the container className (lines 52-59, the multi-line string).
- Line 98: change `` className={`${spacingClass} p-0 transition-all duration-300`} `` to `` className={`${spacingClass} p-0`} ``.
No replacement classes — these elements should not transition at all.

## Step 5 (M6): Loading icons — pulse, don't bounce

`components/CommandInput.tsx` lines 101, 106, 111: change `className="animate-bounce"` to `className="animate-pulse"` on all three icons (`Feather`, `BookOpen`, `loadingVariant.icon`). A soft pulse fits the candlelit register; the parabolic bounce doesn't. (Plan 001 Step 3's reduced-motion CSS already covers `animate-pulse`.)

## Step 6 (M7): TwoPageDropdown easing

`components/Header.tsx:76-77` (the `TwoPageDropdown` return):
```jsx
<div ref={viewportRef} className="overflow-hidden transition-[height] duration-300 ease-in-out">
  <div className={`flex w-[200%] items-start transition-transform duration-300 ease-in-out ${showPage2 ? '-translate-x-1/2' : ''}`}>
```
Change both `ease-in-out` to `ease-out`. Nothing else — the imperative height sync (useLayoutEffect + ResizeObserver above it) is recent, deliberate, and working; leave it.

## Step 7 (M8): Notification exit animation

`components/Notification.tsx` (30-line file, read it fully). Today a `setTimeout(onClose, 3000)` unmounts the toast instantly. Give it a graceful exit:
```tsx
export const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), 2700);
    const closeTimer = setTimeout(onClose, 3000);
    return () => { clearTimeout(leaveTimer); clearTimeout(closeTimer); };
  }, [onClose]);

  return (
    <div className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-[100]
      flex items-center gap-3 px-6 py-3 rounded-full shadow-xl
      animate-in fade-in slide-in-from-top-4 duration-300
      transition-[opacity,transform] duration-300 ease-out
      ${leaving ? 'opacity-0 -translate-y-2' : ''}
      ${type === 'error' ? 'bg-red-900 text-white' : 'bg-lb-primary text-lb-bg'}
    `}>
   ```
   Keep the icon/message JSX unchanged. Add `useState` to the React import. Note: `-translate-y-2` composes with the base `-translate-x-1/2` (Tailwind translate utilities are per-axis) — do not remove the centering class.

## Scope boundaries

- Do NOT touch: engine/, server/, services/, story data, DiaryModal, ErrorBoundary.
- No exit animations for the header dropdowns (deliberate — user-dismissed surfaces may close instantly).
- Do not consolidate the modals into a shared component; class-level unification only.

## Verification

1. `npm run lint` passes.
2. Dev server feel-checks:
   - Header profile/guest menu grows from the avatar corner in ~200ms; open it near the bottom (if reachable) and confirm it grows from the bottom-right corner instead.
   - Open each of the four modals (Sign In, Edit Profile, Reset Password, Load from Cloud) — card zooms in from 95%, backdrop fades.
   - Toggle the sidebar — panel slides with a crisp start (expo settle), content no longer lags half a second behind.
   - Send a command — loading icon pulses (no bounce).
   - Trigger a notification — it slides in, and at ~2.7s drifts up and fades before unmounting.
3. Slow the animations to 10% in DevTools → Animations to confirm the dropdown/modal zooms originate from the correct corner/center.
4. Reduced-motion (DevTools emulation): dropdown/modal entrances are gone (H3 CSS covers `animate-in`), toast still appears and disappears without motion.
