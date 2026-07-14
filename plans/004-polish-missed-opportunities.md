# Plan 004 — Missed opportunities: additive motion (MO1–MO4)

Commit at time of writing: `f97684a`
Repo root: `/Users/t923375/Dropbox (Personal)/Claude Projects/LondonBleeds-Claude`
**Depends on: Plan 001** (tailwindcss-animate installed, reduced-motion CSS in place) **and Plan 002 Step 0** (`components/motionTokens.ts`).

## Context for the executor (you have no other context)

React 19 + Vite + Tailwind 3.4 SPA — a moody, candlelit Victorian text-adventure. These four changes ADD motion where a jarring cut currently undercuts the atmosphere. Restraint is the bar: short fades and small settles, never bounces. `npm run lint` = tsc --noEmit. Dev server: `.claude/launch.json` config `London Bleeds — Dev Server`. Reduced-motion users are already covered: the `animate-in` utilities used below are disabled globally by the `@media (prefers-reduced-motion: reduce)` block Plan 001 added to `index.css`.

---

## Step 1 (MO1): Diary unread badge — announce the new lead

`components/Header.tsx:158-160` (inside the shared `diaryButton` JSX):
```jsx
{hasNewDiaryEntries && (
  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-lb-accent text-white text-[10px] font-bold leading-none">
    {diaryUnreadCount > 9 ? '9+' : diaryUnreadCount}
  </span>
)}
```
Two changes:
1. Add `key={diaryUnreadCount}` to the `<span>` so the entrance re-plays each time the count changes (not just on first mount).
2. Append `animate-in zoom-in-50 fade-in duration-300 ease-out` to the className.
The badge now pops in with a small scale-up whenever a new lead is recorded — the game's key discovery signal.

## Step 2 (MO2): Sidebar room contents — fade on location change

`components/Sidebar.tsx:82` opens the scrollable content area:
```jsx
<div className={`flex-1 overflow-y-auto p-8 w-80 ${isSidebarOpen ? 'opacity-100 transition-opacity duration-300 delay-75' : 'opacity-0'}`}>
```
(the `duration-300 delay-75` values reflect Plan 002 Step 3; if Plan 002 hasn't run they read `duration-500 delay-100` — either way, leave that div alone).

INSIDE it, wrap everything from the "Current location" block down through the exits list in a new div keyed by the location:
```jsx
<div key={location} className="animate-in fade-in duration-300">
  ...existing children...
</div>
```
`location` is already a prop of `Sidebar` (see the component signature; it's used at line 66 via `LOCATIONS[location]`). Keying forces a remount when the player moves rooms, so the room's NPCs/objects/exits fade in together instead of snapping. Indent the moved children one level; change nothing else about them.

## Step 3 (MO3): Diary accordion — animate expand/collapse

`components/DiaryModal.tsx:216-218` currently hard-toggles the entry list:
```jsx
{expanded && (
  <div className="space-y-5 pt-1 pb-6">
```
Replace the conditional render with the CSS grid-rows technique (height animation without measuring):
```jsx
<div
  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
  }`}
>
  <div className="overflow-hidden">
    <div className="space-y-5 pt-1 pb-6">
      ...existing children (the actEntries.map)...
    </div>
  </div>
</div>
```
Remove the `{expanded && (...)}` wrapper (the content now always renders; the 0fr row collapses it). Find the matching closing `)}` and adjust. The chevron rotation at line 211 already animates and needs no change. Note: keeping collapsed entries mounted is acceptable here — the diary renders a bounded list of act entries.

## Step 4 (MO4): Scene header — give arrival a settle

In `components/NarrativeFeed.tsx`, the `SceneHeader` function (lines 37-56) renders the act heading + MapPin/location line with no motion, while the player's own command gets a rise — the drama is inverted. Convert its outer div to a `motion.div` with a quiet rise:
```jsx
import { EASE_OUT, DUR_PANEL } from './motionTokens'; // extend existing imports

function SceneHeader({ actHeading, location }: { actHeading?: string; location?: string }) {
  if (!actHeading && !location) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR_PANEL, ease: EASE_OUT }}
      className="mb-4 space-y-8"
    >
      ...existing children unchanged...
    </motion.div>
  );
}
```
`motion` is already imported in this file (line 11). Because history items keep stable keys, existing headers do not re-animate on later turns — only a newly arriving scene header plays the rise, which is the intent.

## Scope boundaries

- Only the four sites above. No engine/, server/, services/, story-data edits.
- No stagger systems, no springs, no durations above 300ms — restraint is the point.
- Do not add reduced-motion branches for the `motion.div` in Step 4 beyond what exists; a small 8px opacity-led rise is acceptable, but if `useReducedMotion` is already imported in the file (Plan 001 Step 3.3 adds it), reuse it: `initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}` — note `SceneHeader` is a separate component, so call `useReducedMotion()` inside it.

## Verification

1. `npm run lint` passes.
2. Dev server feel-checks:
   - Trigger a diary lead (play until one lands, or temporarily bump `diaryUnreadCount` — revert scaffolding): the amber badge scales in; a second lead re-plays the pop.
   - Move rooms: sidebar contents crossfade to the new room rather than snapping.
   - Open the Diary and toggle an act's entries: the list glides open/closed in ~300ms; the chevron and list move together.
   - Enter a new location: the MapPin + location name settle up 8px as the prose begins typing beneath.
3. Reduced-motion emulation: badge/sidebar fades are gone (CSS covers `animate-in`); scene header appears without the rise if the `useReducedMotion` branch was added.
4. The complete tier-4 pass should make discovery moments feel *noticed* without ever drawing attention to the animation itself — if any step feels showy at 50% playback speed, shorten it, don't enlarge it.
