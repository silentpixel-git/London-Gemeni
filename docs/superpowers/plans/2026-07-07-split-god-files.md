# Split the God Files (Backlog #8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `engine/GameEngine.ts` (1875 lines) resolvers into per-action modules and pull persistence + act-break choreography out of `hooks/useGameState.ts` (1709 lines) — with **zero behavior change**.

**Architecture:** Pure move-refactor in two phases. Phase A converts GameEngine's private resolver methods into free functions taking `story: StoryManifest` as their first parameter, in `engine/resolvers/*`; shared helpers (time, NPC presence, narration-context building, act progression) become small modules; the `GameEngine` class survives as a thin façade (dispatcher + post-processing) and re-exports every previously exported symbol so **no importer changes**. Phase B decomposes `useGameState` into sub-hooks under `hooks/gameState/`, each receiving an explicit deps object; all shared world-state atoms stay in the orchestrator hook so no ordering cycles exist.

**Tech Stack:** TypeScript + React 18 (Vite), Supabase, tsx-driven QA scripts (`scripts/qa-*.ts`).

## Global Constraints

- **Zero behavior change.** Every task is a code move + mechanical rename. If you find yourself "improving" logic, stop.
- **Public API stability:** `engine/GameEngine.ts` must keep exporting (directly or via re-export) everything it exports today: `computeTimePeriod`, `PERIOD_ORDER`, `minutesToNextPeriodBoundary`, `periodBoundariesCrossed`, `maturedSpreadsFor`, `nextOpenPeriod`, `returnsPeriodFor`, `timePeriodFor`, `npcLocationAt`, `SessionSnapshot`, `getPresentNpcIds`, `GameEngine`, `gameEngine`. The 4 importers (`hooks/useGameState.ts`, `engine/parseFallback.ts`, `scripts/qa-engine.ts`, `scripts/qa-validate.ts`) must not need edits in Phase A.
- `App.tsx` must not need edits in Phase B (it imports only `useGameState`).
- **Move comments with their code.** The block comments in both files are load-bearing design docs (curtain-hold semantics, rumor maturity rules, save-clobber warnings). They travel verbatim with the code they describe.
- **Preserve every `// eslint-disable-next-line react-hooks/exhaustive-deps` and its exact dependency array.** The dep arrays encode intentional staleness (e.g. `handleSaveGame` omitting `stim`); changing one is a behavior change.
- **Baseline (verified 2026-07-07):** `npx tsc --noEmit` → no output (clean). `npx tsx scripts/qa-engine.ts` → `Results: 256 passed · 0 failed · 1 warnings`. Every task must end at exactly this baseline.
- Verify command pair used throughout ("**VERIFY**" below means run both):
  - `npx tsc --noEmit` → expect no output
  - `npm run qa:engine` → expect `256 passed · 0 failed · 1 warnings`

---

## File Structure (end state)

```
engine/
  GameEngine.ts            (~280 lines: GameEngine class façade + re-exports + gameEngine singleton)
  time.ts                  clock math: computeTimePeriod, PERIOD_ORDER, boundary math, timePeriodFor, formatTimeLabel
  presence.ts              NPC placement + rumors: npcLocationAt, returnsPeriodFor, getPresentNpcIds, maturedSpreadsFor
  session.ts               SessionSnapshot interface
  narrationContext.ts      buildNarrationContext (ex buildContext) + blocked + absentNpcBlocked + introductionOf (private)
  resolvers/
    support.ts             periodOf, triggerClues, checkActProgression, computeNpcMovements, computeActEntry
    move.ts                resolveMove
    examine.ts             resolveExamine, resolveRead
    npc.ts                 resolveTalk, resolveShow
    items.ts               resolveTake, resolveUse, resolveDrop, resolveInventory
    deduce.ts              resolveDeduce, resolveNotebook
    meta.ts                resolveWait, resolveHelp, resolveQuery, resolveUnresolvedTarget, resolveOther

hooks/
  useGameState.ts          (~800 lines: world-state atoms, handleAction, handleConsultHolmes, scroll helpers, composition, return)
  gameState/
    aiParse.ts             AI_PARSER_ENABLED, parseActionCache, resolveIntentWithAI
    narration.ts           OPENING_FALLBACK_NARRATIVE, extractOpeningSentence
    useConnections.ts      connectionStatus state, pingSupabase, checkConnections, mount + 60s monitor effects
    useAppearance.ts       themeMode/soundEffects/ambientAudio state + persistence/apply effects
    useDiary.ts            diaryEntries state, diarySeqRef, loggedLocationsRef, captureDiaryEntries, captureLocationArrival
    useSceneStreams.ts     hasGeneratedOpening ref, commitVignetteFlags, generateOpeningScene, streamResumeScene, streamArrivalScene
    usePersistence.ts      isSaving + slots state, handleSaveGame(+Ref), loadInvestigationIntoState, handleLoadGame, slot handlers, realtime-sync effect
    useActBreak.ts         isAdvancingAct state, CURTAIN_HOLD_MS, beginNextAct, handleJournalTypewriterDone
```

**Ownership rule for Phase B:** a sub-hook owns a `useState` only if no other extracted unit writes it. Everything `handleAction`, persistence, AND act-break all touch (location, inventory, flags, npcStates, currentAct, elapsedMinutes, history, isLoading, pendingActTransition, isActBreakReady, isCurtainPlaying, etc.) **stays in `useGameState`** and is passed down via deps objects.

---

# Phase A — GameEngine.ts

### Task 1: Extract time helpers → `engine/time.ts`

**Files:**
- Create: `engine/time.ts`
- Modify: `engine/GameEngine.ts` (delete moved code, add re-export + imports)

**Interfaces:**
- Consumes: nothing new
- Produces: `computeTimePeriod(totalMinutes: number): TimePeriod`, `PERIOD_ORDER: TimePeriod[]`, `minutesToNextPeriodBoundary(totalMinutes: number): number`, `periodBoundariesCrossed(fromMinutes: number, toMinutes: number): number`, `nextOpenPeriod(openPeriods: TimePeriod[], from: TimePeriod): TimePeriod | null`, `timePeriodFor(actTimeConfig: Record<number, ActTimeConfig>, act: number, elapsedMinutes: number): TimePeriod`, `formatTimeLabel(totalMinutes: number, dayOfWeek: string, displayDate: string): string`

- [ ] **Step 1: Create `engine/time.ts`**

Header + imports:

```typescript
/**
 * engine/time.ts
 *
 * Pure clock math for London Bleeds: TimePeriod boundaries, day-wrap
 * arithmetic, and the in-game time label. Extracted verbatim from
 * GameEngine.ts (backlog #8 god-file split). No game state, no story data —
 * only minutes in, periods/labels out.
 */

import { TimePeriod } from '../types';
import type { ActTimeConfig } from './stories/types';
```

Then MOVE (cut from GameEngine.ts, paste verbatim, comments included) these declarations, in this order: `computeTimePeriod` (currently GameEngine.ts:21–29 incl. its doc comment block starting line 19), `PERIOD_ORDER` (31–33), `minutesToNextPeriodBoundary` (35–45), `periodBoundariesCrossed` (47–64), `nextOpenPeriod` (95–103), `timePeriodFor` (126–134), `formatTimeLabel` (161–168). Locate by symbol name, not line number, if lines have shifted. One change: `formatTimeLabel` gains an `export` keyword (it was module-private; `narrationContext.ts` will need it in Task 3).

- [ ] **Step 2: Update `engine/GameEngine.ts`**

At the top (after the existing imports), add:

```typescript
import { computeTimePeriod, PERIOD_ORDER, minutesToNextPeriodBoundary, periodBoundariesCrossed, nextOpenPeriod, timePeriodFor, formatTimeLabel } from './time';

// Re-export for existing consumers (useGameState, parseFallback, qa scripts).
export { computeTimePeriod, PERIOD_ORDER, minutesToNextPeriodBoundary, periodBoundariesCrossed, nextOpenPeriod, timePeriodFor };
```

Delete the moved declarations from GameEngine.ts. Remove `ActTimeConfig` from GameEngine.ts's `./stories/types` import **only if** nothing left in the file uses it (the `story.actTimeConfig` accesses don't need the named type; check with tsc). Keep `TimePeriod` in the types import (still used by `SessionSnapshot`/`periodOf`).

- [ ] **Step 3: VERIFY** — `npx tsc --noEmit` (no output), `npm run qa:engine` (`256 passed · 0 failed`).

- [ ] **Step 4: Commit**

```bash
git add engine/time.ts engine/GameEngine.ts
git commit -m "refactor(engine): extract time helpers into engine/time.ts (god-file split 1/6)"
```

---

### Task 2: Extract NPC presence + rumor maturity → `engine/presence.ts`, SessionSnapshot → `engine/session.ts`

**Files:**
- Create: `engine/presence.ts`
- Create: `engine/session.ts`
- Modify: `engine/GameEngine.ts`

**Interfaces:**
- Consumes: `PERIOD_ORDER`, `periodBoundariesCrossed` from `./time`
- Produces: `npcLocationAt(npcs, npcId, act, timePeriod, npcStates): string`, `returnsPeriodFor(npc, act, locationId, from): TimePeriod | null`, `getPresentNpcIds(npcs, locationId, npcStates, currentAct, timePeriod): string[]`, `maturedSpreadsFor(rumors, rumorEvents, npcId, act, totalMinutes): Array<{rumorId: string; statement: string}>` — all signatures identical to today. `SessionSnapshot` interface unchanged.

- [ ] **Step 1: Create `engine/presence.ts`**

```typescript
/**
 * engine/presence.ts
 *
 * Where NPCs are and what they have heard: schedule-derived placement,
 * follower resolution, and Phase 4b rumor-spread maturity. Extracted
 * verbatim from GameEngine.ts (backlog #8 god-file split).
 */

import { NPCState, TimePeriod, RumorEvents } from '../types';
import type { NPCDefinition, RumorDefinition } from './stories/types';
import { PERIOD_ORDER, periodBoundariesCrossed } from './time';
```

MOVE verbatim (with doc comments): `maturedSpreadsFor` (GameEngine.ts:66–93), `returnsPeriodFor` (105–124), `npcLocationAt` (136–159), `getPresentNpcIds` (198–214).

- [ ] **Step 2: Create `engine/session.ts`**

```typescript
/**
 * engine/session.ts
 *
 * The SessionSnapshot the UI hands the engine each turn — the engine's
 * complete, read-only view of current game state. Extracted from
 * GameEngine.ts (backlog #8 god-file split) so resolver modules can import
 * it without a cycle through the GameEngine façade.
 */

import { NPCState, RumorEvents } from '../types';
```

MOVE the `SessionSnapshot` interface verbatim (GameEngine.ts:170–196, including the `Current session state snapshot` banner comment and the sanity note).

- [ ] **Step 3: Update `engine/GameEngine.ts`**

Delete moved code; add imports + re-exports:

```typescript
import { npcLocationAt, returnsPeriodFor, getPresentNpcIds, maturedSpreadsFor } from './presence';
import type { SessionSnapshot } from './session';

export { npcLocationAt, returnsPeriodFor, getPresentNpcIds, maturedSpreadsFor };
export type { SessionSnapshot };
```

Drop now-unused imports from GameEngine.ts if tsc flags them (`RumorDefinition` likely; `NPCDefinition` is still used by `introductionOf` until Task 3).

- [ ] **Step 4: VERIFY** (tsc clean; qa:engine 256/0).

- [ ] **Step 5: Commit**

```bash
git add engine/presence.ts engine/session.ts engine/GameEngine.ts
git commit -m "refactor(engine): extract presence + SessionSnapshot modules (god-file split 2/6)"
```

---

### Task 3: Extract shared resolver support → `engine/resolvers/support.ts` and `engine/narrationContext.ts`

This is the pivotal task: it converts the class's private helper methods into free functions so resolvers can leave the class in A4/A5.

**Files:**
- Create: `engine/resolvers/support.ts`
- Create: `engine/narrationContext.ts`
- Modify: `engine/GameEngine.ts`

**Interfaces:**
- Consumes: `time.ts`, `presence.ts`, `session.ts`, `deriveKnowledgeEnvelope` from `./stories/knowledge`
- Produces (used by every resolver task):
  - `periodOf(story: StoryManifest, session: SessionSnapshot, extraMinutes?: number): TimePeriod`
  - `triggerClues(story: StoryManifest, locationId: string, objectId: string, alreadyExamined: boolean, discoveredClueIds: string[]): { newClueIds: string[]; newClueDefs: ClueDefinition[]; medicalDelta: number; moralDelta: number }`
  - `checkActProgression(story: StoryManifest, session: SessionSnapshot, currentFlags: Record<string, boolean>): { newAct?: number; flagsUpdate?: Record<string, boolean>; gameOver?: boolean }`
  - `computeNpcMovements(story: StoryManifest, newLocationId: string, session: SessionSnapshot): Record<string, Partial<NPCState>>`
  - `computeActEntry(story: StoryManifest, toAct: number, session: SessionSnapshot): { anchor: string; npcUpdates: Record<string, Partial<NPCState>> }`
  - `buildNarrationContext(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot, outcome: NarrationOutcome): NarrationContext` (+ exported `NarrationOutcome` interface — the current inline `outcome` object type of `buildContext`, verbatim)
  - `blocked(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot, blockedReason: string, actionResultNote: string): EngineResult`
  - `absentNpcBlocked(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot, npcId: string, attemptedVerb: string): EngineResult`

- [ ] **Step 1: Create `engine/resolvers/support.ts`**

```typescript
/**
 * engine/resolvers/support.ts
 *
 * Shared engine machinery used by the per-action resolvers and the
 * GameEngine façade: current-period lookup, clue triggering, act
 * progression, and NPC movement on player travel. Extracted verbatim from
 * GameEngine.ts (backlog #8 god-file split) — each function takes the
 * StoryManifest explicitly instead of reading it off `this`.
 */

import { NPCState, TimePeriod } from '../../types';
import type { StoryManifest, ClueDefinition } from '../stories/types';
import { timePeriodFor } from '../time';
import type { SessionSnapshot } from '../session';

/** The current TimePeriod for this session's act + elapsed clock. */
export function periodOf(story: StoryManifest, session: SessionSnapshot, extraMinutes = 0): TimePeriod {
  return timePeriodFor(story.actTimeConfig, session.currentAct, session.elapsedMinutes + extraMinutes);
}
```

Then MOVE these four method bodies out of the class, converting each to `export function <name>(story: StoryManifest, <original params>)` and applying rule `this.story → story` inside the body (no other body edits):
- `triggerClues` (GameEngine.ts:1354–1371)
- `computeActEntry` (1769–1781) — body becomes `const anchor = story.actAnchors[toAct]; const npcUpdates = computeNpcMovements(story, anchor, { ...session, currentAct: toAct }); return { anchor, npcUpdates };`
- `computeNpcMovements` (1783–1841) — also `this.periodOf(session)` → `periodOf(story, session)`
- `checkActProgression` (1843–1871)

- [ ] **Step 2: Create `engine/narrationContext.ts`**

```typescript
/**
 * engine/narrationContext.ts
 *
 * Builds the NarrationContext handed to the AI — every field derived from
 * verified world data, never invented — plus the two blocked-result
 * helpers that wrap it. Extracted verbatim from GameEngine.ts (backlog #8
 * god-file split).
 */

import { EngineResult, NarrationContext, NPCState } from '../types';
import { ParsedIntent } from './intentParser';
import type { StoryManifest, NPCDefinition } from './stories/types';
import { deriveKnowledgeEnvelope } from './stories/knowledge';
import { computeTimePeriod, formatTimeLabel } from './time';
import { getPresentNpcIds, maturedSpreadsFor, npcLocationAt, returnsPeriodFor } from './presence';
import type { SessionSnapshot } from './session';
import { periodOf } from './resolvers/support';

/** The verified outcome a resolver hands to buildNarrationContext. */
export interface NarrationOutcome {
  success: boolean;
  actionDescription: string;
  actionResultNote: string;
  newClueDefs: Array<{ name: string; description: string; holmesDeduction: string }>;
  itemsGained?: string[];         // Inventory items gained this turn (verified)
  targetLocationId?: string;      // For move actions, the destination
  targetNpcId?: string;
  newNpcUpdates?: Record<string, Partial<NPCState>>;
  isDeduction?: boolean;
  deductionCorrect?: boolean;
  extraMinutes?: number;
}
```

Then MOVE, converting to free functions with `story` as first param:
- `introductionOf` (GameEngine.ts:1707–1710) → `function introductionOf(npc: NPCDefinition)` — **not exported** (only buildNarrationContext uses it).
- `buildContext` (1373–1705) → `export function buildNarrationContext(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot, outcome: NarrationOutcome): NarrationContext`. Replace the inline outcome type annotation with `NarrationOutcome`. Body rules: `this.story → story`, `this.periodOf(session, …) → periodOf(story, session, …)`, `this.introductionOf( → introductionOf(`. Keep the `Math.random()` blockquote hint and the `as NarrationContext & {…}` cast exactly as-is.
- `blocked` (1712–1733) → `export function blocked(story, intent, session, blockedReason, actionResultNote): EngineResult` with `this.buildContext( → buildNarrationContext(story, `.
- `absentNpcBlocked` (1735–1767) → `export function absentNpcBlocked(story, intent, session, npcId, attemptedVerb): EngineResult` with `this.story → story`, `this.periodOf( → periodOf(story, `, `this.blocked( → blocked(story, `.

- [ ] **Step 3: Rewire `engine/GameEngine.ts`**

Add imports:

```typescript
import { periodOf, triggerClues, checkActProgression, computeNpcMovements, computeActEntry } from './resolvers/support';
import { buildNarrationContext, blocked, absentNpcBlocked } from './narrationContext';
```

Delete the nine moved methods from the class. In ALL remaining class code (the 16 resolvers + `resolve()` + `shouldFireHolmesNudge`), apply the mechanical rewrite rules:

| Old | New |
|---|---|
| `this.periodOf(` | `periodOf(this.story, ` |
| `this.triggerClues(` | `triggerClues(this.story, ` |
| `this.checkActProgression(` | `checkActProgression(this.story, ` |
| `this.computeNpcMovements(` | `computeNpcMovements(this.story, ` |
| `this.buildContext(` | `buildNarrationContext(this.story, ` |
| `this.blocked(` | `blocked(this.story, ` |
| `this.absentNpcBlocked(` | `absentNpcBlocked(this.story, ` |
| `this.introductionOf(` | (only existed inside buildContext — should be zero hits; if a hit remains, stop and re-check) |

Keep the public class method `computeActEntry` as a one-line delegate (external callers use it):

```typescript
  /** See resolvers/support.computeActEntry — kept as a method for existing callers. */
  public computeActEntry(toAct: number, session: SessionSnapshot) {
    return computeActEntry(this.story, toAct, session);
  }
```

`formatTimeLabel` (imported in A1 for the still-resident buildContext) is now unused in GameEngine.ts — remove it from the `./time` import (it was never re-exported).

- [ ] **Step 4: VERIFY** (tsc clean; qa:engine 256/0). Then `grep -c "this\.\(buildContext\|blocked\|absentNpcBlocked\|triggerClues\|periodOf\|checkActProgression\|computeNpcMovements\)" engine/GameEngine.ts` → expect `0` (grep exits 1).

- [ ] **Step 5: Commit**

```bash
git add engine/resolvers/support.ts engine/narrationContext.ts engine/GameEngine.ts
git commit -m "refactor(engine): extract narration-context + resolver support helpers (god-file split 3/6)"
```

---

### Task 4: Extract move/examine/npc resolvers → `engine/resolvers/{move,examine,npc}.ts`

**Files:**
- Create: `engine/resolvers/move.ts`, `engine/resolvers/examine.ts`, `engine/resolvers/npc.ts`
- Modify: `engine/GameEngine.ts`

**Interfaces:**
- Consumes: everything Task 3 produced, plus `nextOpenPeriod` from `../time`, `npcLocationAt` from `../presence`
- Produces: `resolveMove(story, intent, session): EngineResult` from `./move`; `resolveExamine(story, intent, session): EngineResult` and `resolveRead(story, intent, session): EngineResult` from `./examine`; `resolveTalk(story, intent, session): EngineResult` and `resolveShow(story, intent, session): EngineResult` from `./npc` — all `(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot)`.

- [ ] **Step 1: Create the three files**

Common import template (trim per file to what tsc actually needs):

```typescript
import { EngineResult } from '../../types';
import { ParsedIntent } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { periodOf, triggerClues, checkActProgression, computeNpcMovements } from './support';
import { buildNarrationContext, blocked, absentNpcBlocked } from '../narrationContext';
import { npcLocationAt } from '../presence';
import { nextOpenPeriod } from '../time';
```

MOVE verbatim, converting `private resolveX(intent, session)` → `export function resolveX(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult` and applying inside each body: `this.story → story` plus the Task 3 rewrite table with `this.story` replaced by `story` (e.g. `blocked(this.story, ` → `blocked(story, `):

- `move.ts` ← `resolveMove` (GameEngine.ts:359–457, plus its `// MOVE` banner comment)
- `examine.ts` ← `resolveExamine` (461–599) and `resolveRead` (923–968). In `resolveRead`, `this.resolveExamine(` → `resolveExamine(story, ` (same file, direct call).
- `npc.ts` ← `resolveTalk` (601–644) and `resolveShow` (837–921). In `resolveShow`, the single-NPC-default recursion `this.resolveShow(` → `resolveShow(story, `; the fallthrough `this.resolveExamine(` → `resolveExamine(story, ` with `import { resolveExamine } from './examine';`.

Each file keeps the original section banner comments (`// ── EXAMINE ──` etc.).

- [ ] **Step 2: Rewire the dispatcher in `GameEngine.ts`**

```typescript
import { resolveMove } from './resolvers/move';
import { resolveExamine, resolveRead } from './resolvers/examine';
import { resolveTalk, resolveShow } from './resolvers/npc';
```

In `resolve()`: `this.resolveMove(intent, session)` → `resolveMove(this.story, intent, session)`, same for examine/read/talk/show cases. Delete the five moved methods. **Note:** `resolveUse` (still in the class until A5) delegates to examine/show — rewrite its `this.resolveExamine(` → `resolveExamine(this.story, ` and `this.resolveShow(` → `resolveShow(this.story, ` now.

- [ ] **Step 3: VERIFY** (tsc clean; qa:engine 256/0).

- [ ] **Step 4: Commit**

```bash
git add engine/resolvers/ engine/GameEngine.ts
git commit -m "refactor(engine): move move/examine/read/talk/show resolvers to modules (god-file split 4/6)"
```

---

### Task 5: Extract remaining resolvers → `engine/resolvers/{items,deduce,meta}.ts`

**Files:**
- Create: `engine/resolvers/items.ts`, `engine/resolvers/deduce.ts`, `engine/resolvers/meta.ts`
- Modify: `engine/GameEngine.ts`

**Interfaces:**
- Consumes: same support/narrationContext/presence/time surface as A4, plus `resolveExamine` from `./examine`, `resolveShow` from `./npc`, and `minutesToNextPeriodBoundary`/`PERIOD_ORDER` from `../time` (used by `resolveWait`)
- Produces: `resolveTake`, `resolveUse`, `resolveDrop`, `resolveInventory` from `./items`; `resolveDeduce`, `resolveNotebook` from `./deduce`; `resolveWait`, `resolveHelp`, `resolveQuery`, `resolveUnresolvedTarget`, `resolveOther` from `./meta` — all `(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult`.

- [ ] **Step 1: Create the three files** (same import template + transformation rules as Task 4):

- `items.ts` ← `resolveTake` (646–707), `resolveUse` (709–835), `resolveDrop` (970–1004), `resolveInventory` (1006–1022). `resolveUse`'s delegations become `resolveExamine(story, …)` / `resolveShow(story, …)` via imports from `./examine` and `./npc`.
- `deduce.ts` ← `resolveDeduce` (1079–1212), `resolveNotebook` (1024–1077).
- `meta.ts` ← `resolveWait` (1214–1242), `resolveHelp` (1244–1271), `resolveQuery` (1273–1297), `resolveUnresolvedTarget` (1299–1324), `resolveOther` (1326–1352).

- [ ] **Step 2: Finish the `GameEngine.ts` façade**

Import the eleven functions; rewrite the remaining `switch` cases to `resolveX(this.story, intent, session)`; delete the moved methods. The class should now contain ONLY: the constructor, `resolve()` (dispatcher + the post-processing pipeline: talk/show act-progression check, act-anchor auto-move, ending classification, Holmes nudge, `_*FlagsUpdate` lifting, rumor-trigger recording), `shouldFireHolmesNudge`, and the `computeActEntry` delegate. Confirm the file is roughly 250–320 lines.

- [ ] **Step 3: VERIFY** (tsc clean; qa:engine 256/0). Also run the full deterministic suite once: `npm run qa:all` → expect every sub-suite green (parser/hints/diary-leads/validate use the re-exported symbols).

- [ ] **Step 4: Commit**

```bash
git add engine/resolvers/ engine/GameEngine.ts
git commit -m "refactor(engine): move remaining resolvers; GameEngine is now a facade (god-file split 5/6)"
```

---

### Task 6: Engine review checkpoint

- [ ] **Step 1:** Dispatch the `engine-logic-reviewer` agent on the Phase A diff (`git diff main...HEAD -- engine/`). Instruction to the agent: "This is a pure move-refactor of GameEngine.ts into modules; flag ANY semantic difference from the pre-refactor code (changed conditions, reordered side effects, dropped comments), not style."
- [ ] **Step 2:** Fix anything it confirms (moves/typos only — no logic changes), re-VERIFY, amend or add a fix commit.

---

# Phase B — useGameState.ts

Phase B has **no automated hook tests**; the safety net is `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus a final manual smoke pass (Task 14). Keep tasks small and commit each.

**Sub-hook pattern (used by B2–B7):** each sub-hook takes a single `deps` object, destructures it at the top, and keeps every `useCallback`/`useEffect` body AND dependency array byte-identical to today (referencing the destructured names). Example shape:

```typescript
export interface XxxDeps { /* exact fields listed per task */ }

export function useXxx(deps: XxxDeps) {
  const { user, setNotification /* … */ } = deps;
  // moved useState/useRef/useCallback/useEffect blocks, verbatim
  return { /* exact surface listed per task */ };
}
```

### Task 7: Extract module-level helpers → `hooks/gameState/{aiParse,narration}.ts`

**Files:**
- Create: `hooks/gameState/aiParse.ts` — MOVE verbatim from useGameState.ts: the `AI_PARSER_ENABLED` const + its comment block (42–50), `parseActionCache` (52–53), `resolveIntentWithAI` (55–79). Imports: `import { aiService } from '../../services/AIService'; import { needsAiParse, buildParseCandidates } from '../../engine/parseFallback'; import { type ParsedIntent } from '../../engine/intentParser'; import { NPCState } from '../../types';`. Export `AI_PARSER_ENABLED` and `resolveIntentWithAI`.
- Create: `hooks/gameState/narration.ts` — MOVE verbatim: `OPENING_FALLBACK_NARRATIVE` (157–158), `extractOpeningSentence` (160–170). Export both.
- Modify: `hooks/useGameState.ts` — delete moved code, add `import { AI_PARSER_ENABLED, resolveIntentWithAI } from './gameState/aiParse'; import { OPENING_FALLBACK_NARRATIVE, extractOpeningSentence } from './gameState/narration';`. (`CURTAIN_HOLD_MS` stays put until B7.)

**Interfaces:**
- Produces: `resolveIntentWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs, elapsedMinutes): Promise<ParsedIntent>`; `extractOpeningSentence(markdown: string): string | null`

- [ ] Step 1: Create both files; delete moved code; wire imports.
- [ ] Step 2: VERIFY-B: `npx tsc --noEmit` (clean), `npm run lint` (no new errors), `npm run build` (succeeds).
- [ ] Step 3: Commit — `git add hooks/ && git commit -m "refactor(hooks): extract aiParse + narration helpers from useGameState (god-file split 6a)"`

### Task 8: `hooks/gameState/useConnections.ts`

**Files:** Create `hooks/gameState/useConnections.ts`; modify `hooks/useGameState.ts`.

**Interfaces:**
- `ConnectionsDeps`: `{ isAuthReady: boolean; setNotification: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' } | null>> }`
- Returns: `{ connectionStatus: { gemini: boolean | null; supabase: boolean | null }; checkConnections: () => Promise<void> }`

- [ ] Step 1: MOVE into the sub-hook, verbatim: the `connectionStatus` useState (269–272), `pingSupabase` (309–325 with its comment block), `checkConnections` (327–343), the run-once effect (345–349), the 60s monitor effect (351–363). Module imports: `aiService`, `supabaseUrl`, `supabaseAnonKey`, `isSupabaseConfigured` from `../../supabase` / `../../services/AIService`.
- [ ] Step 2: In `useGameState`, replace with `const { connectionStatus, checkConnections } = useConnections({ isAuthReady, setNotification });` placed AFTER the `notification` useState. Return object keeps `connectionStatus` and `retryConnections: checkConnections` unchanged.
- [ ] Step 3: VERIFY-B. Commit: `refactor(hooks): extract useConnections (god-file split 6b)`

### Task 9: `hooks/gameState/useAppearance.ts`

**Files:** Create `hooks/gameState/useAppearance.ts`; modify `hooks/useGameState.ts`.

**Interfaces:**
- `AppearanceDeps`: `{ user: User | null; userProfile: UserProfile | null; currentTimePeriod: TimePeriod }`
- Returns: `{ themeMode, setThemeMode, soundEffects, setSoundEffects, ambientAudio, setAmbientAudio }` (types as in `GameStateReturn`)

- [ ] Step 1: MOVE verbatim: the three lazy-initializer useStates (`themeMode` 276–284, `soundEffects` 286–288, `ambientAudio` 289–291) and the five effects: data-theme apply (365–378), theme persist+cloud-sync (380–388), the two audio-toggle persists (390–396), cloud-preference load (398–405). Preserve both `eslint-disable-next-line` comments and the `[userProfile?.id]` dep array exactly.
- [ ] Step 2: Call it after `currentTimePeriod` is computed in `useGameState`; spread its six fields into the return object unchanged.
- [ ] Step 3: VERIFY-B. Commit: `refactor(hooks): extract useAppearance (god-file split 6c)`

### Task 10: `hooks/gameState/useDiary.ts`

**Files:** Create `hooks/gameState/useDiary.ts`; modify `hooks/useGameState.ts`.

**Interfaces:**
- `DiaryDeps`: `{ user: User | null; activeInvestigation: Investigation | null }`
- Returns: `{ diaryEntries: DiaryEntry[]; setDiaryEntries: React.Dispatch<React.SetStateAction<DiaryEntry[]>>; diarySeqRef: React.MutableRefObject<number>; loggedLocationsRef: React.MutableRefObject<Set<string>>; captureDiaryEntries: (items: Array<Omit<DiaryEntry, 'id' | 'sequence'>>) => void; captureLocationArrival: (locationId: string, actNumber: number, timeLabel: string) => void }`

The setters/refs must be returned: `loadInvestigationIntoState`, `resumeFromLocalSave`, `handleStartInSlot` (B6) and `handleAction` STEP 8 write them directly.

- [ ] Step 1: MOVE verbatim: `diaryEntries` useState + `diarySeqRef` + `loggedLocationsRef` (232–236), `captureDiaryEntries` (238–253), `captureLocationArrival` (255–264). Module imports: `GameRepository`, `LOCATION_DIARY` from `../../engine/gameData`, types.
- [ ] Step 2: Call after the `activeInvestigation` useState in `useGameState`; destructure all six returns.
- [ ] Step 3: VERIFY-B. Commit: `refactor(hooks): extract useDiary (god-file split 6d)`

### Task 11: `hooks/gameState/useSceneStreams.ts`

**Files:** Create `hooks/gameState/useSceneStreams.ts`; modify `hooks/useGameState.ts`.

**Interfaces:**
- `SceneStreamsDeps`:

```typescript
export interface SceneStreamsDeps {
  user: User | null;
  activeInvestigation: Investigation | null;
  // world values read by the arrival/resume snapshots
  inventory: string[];
  flags: Record<string, boolean>;
  npcStates: Record<string, NPCState>;
  medicalPoints: number;
  moralPoints: number;
  introducedNpcs: string[];
  locationVisitCounts: Record<string, number>;
  turnCount: number;
  // setters owned by the orchestrator
  setHistory: React.Dispatch<React.SetStateAction<GameHistoryItem[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAutoScrollLocked: React.Dispatch<React.SetStateAction<boolean>>;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  scrollRef: React.RefObject<HTMLDivElement>;
  captureLocationArrival: (locationId: string, actNumber: number, timeLabel: string) => void;
}
```

- Returns: `{ hasGeneratedOpening: React.MutableRefObject<boolean>; commitVignetteFlags: (flagsUpdate: Record<string, boolean> | undefined, baseFlags: Record<string, boolean>, investigationId?: string) => void; generateOpeningScene: () => Promise<void>; streamResumeScene: (resume: { location: string; act: number; inventory: string[]; flags: Record<string, boolean>; npcStates: Record<string, NPCState>; medicalPoints: number; moralPoints: number; introducedNpcs: string[]; elapsedMinutes: number; investigationId?: string }) => Promise<void>; streamArrivalScene: (toAct: number, anchor: string, npcUpdates: Record<string, Partial<NPCState>>) => Promise<void> }`

- [ ] Step 1: MOVE verbatim: `hasGeneratedOpening` ref (296), `commitVignetteFlags` (444–465 with its long comment), `generateOpeningScene` (467–514), `streamResumeScene` (518–579), `streamArrivalScene` (724–794). Keep each `useCallback` dep array identical (e.g. `streamArrivalScene`'s 10-entry array). Module imports: `gameEngine`, `SessionSnapshot` from `../../engine/GameEngine`, `parseIntent`, `aiService`, `injectAfterHeading`, `GameRepository`, `OPENING_FALLBACK_NARRATIVE` from `./narration`, constants (`INITIAL_*`), `ACT_NAMES`, `ACT_BRIDGES`, `ITEM_SPENT_AFTER_ACT`, `formatGameClock` from `../../engine/gameData`. NOTE: `generateOpeningScene` calls `captureLocationArrival` — now from deps.
- [ ] Step 2: Call in `useGameState` after `useDiary` (needs `captureLocationArrival`) and after the scroll refs; destructure all five returns.
- [ ] Step 3: VERIFY-B. Commit: `refactor(hooks): extract useSceneStreams (god-file split 6e)`

### Task 12: `hooks/gameState/usePersistence.ts`

**Files:** Create `hooks/gameState/usePersistence.ts`; modify `hooks/useGameState.ts`.

**Interfaces:**
- Owns state: `isSaving` (267), `slots` (194). `activeInvestigation` STAYS in the orchestrator (diary + scenes already consume it).
- `PersistenceDeps` — spell out every field; this is the honest map of the current entanglement:

```typescript
export interface PersistenceDeps {
  user: User | null;
  activeInvestigation: Investigation | null;
  setActiveInvestigation: React.Dispatch<React.SetStateAction<Investigation | null>>;
  // world values read by handleSaveGame
  history: GameHistoryItem[];
  location: string;
  inventory: string[];
  medicalPoints: number;
  moralPoints: number;
  npcStates: Record<string, NPCState>;
  flags: Record<string, boolean>;
  journalNotes: string;
  stim: Record<string, STIMEntry>;
  introducedNpcs: string[];
  currentAct: number;
  rumorEvents: RumorEvents;
  // world setters written by the loaders + realtime sync
  setLocation: React.Dispatch<React.SetStateAction<string>>;
  setInventory: React.Dispatch<React.SetStateAction<string[]>>;
  setMedicalPoints: React.Dispatch<React.SetStateAction<number>>;
  setMoralPoints: React.Dispatch<React.SetStateAction<number>>;
  setCurrentAct: React.Dispatch<React.SetStateAction<number>>;
  setElapsedMinutes: React.Dispatch<React.SetStateAction<number>>;
  setRumorEvents: React.Dispatch<React.SetStateAction<RumorEvents>>;
  setIsGameOver: React.Dispatch<React.SetStateAction<boolean>>;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setJournalNotes: React.Dispatch<React.SetStateAction<string>>;
  setIntroducedNpcs: React.Dispatch<React.SetStateAction<string[]>>;
  setNpcStates: React.Dispatch<React.SetStateAction<Record<string, NPCState>>>;
  setStim: React.Dispatch<React.SetStateAction<Record<string, STIMEntry>>>;
  setTurnCount: React.Dispatch<React.SetStateAction<number>>;
  setHistory: React.Dispatch<React.SetStateAction<GameHistoryItem[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setNotification: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' } | null>>;
  // act-break state cleared on load (owned by orchestrator)
  setPendingActTransition: React.Dispatch<React.SetStateAction<PendingActTransition | null>>;
  setIsActBreakReady: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCurtainPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  // diary (from useDiary)
  diaryEntries: DiaryEntry[];
  setDiaryEntries: React.Dispatch<React.SetStateAction<DiaryEntry[]>>;
  diarySeqRef: React.MutableRefObject<number>;
  loggedLocationsRef: React.MutableRefObject<Set<string>>;
  // scenes (from useSceneStreams)
  hasGeneratedOpening: React.MutableRefObject<boolean>;
  generateOpeningScene: () => Promise<void>;
  streamResumeScene: (resume: { location: string; act: number; inventory: string[]; flags: Record<string, boolean>; npcStates: Record<string, NPCState>; medicalPoints: number; moralPoints: number; introducedNpcs: string[]; elapsedMinutes: number; investigationId?: string }) => Promise<void>;
}
```

- Returns: `{ isSaving, slots, handleSaveGame, handleSaveGameRef, loadInvestigationIntoState, handleLoadGame, refreshSlots, handleSelectSlot, handleContinue, handleStartInSlot, handleDeleteSlot }` — signatures exactly as in `GameStateReturn`, plus `handleSaveGameRef: React.MutableRefObject<(silent?: boolean) => Promise<void>>` and `loadInvestigationIntoState: (investigation: Investigation) => Promise<void>`.

- [ ] Step 1: MOVE verbatim: `isSaving` + `slots` useStates, `loadInvestigationIntoState` (581–663), `handleSaveGame` (665–717) **with its exact dep array incl. the eslint-disable**, `handleSaveGameRef` + sync effect (719–722), `handleLoadGame` incl. inner `resumeFromLocalSave` (853–942), `refreshSlots`/`handleSelectSlot`/`handleContinue` (944–964), the realtime Supabase sync effect (973–1048 with the no-logs-INSERT NOTE comment), `handleStartInSlot` (1567–1630), `handleDeleteSlot` (1632–1643). Module imports: `GameRepository`, `supabase`, `gameData` constants (`LOCATIONS`, `INITIAL_*`, etc.), types. `history.length === 0` check in handleLoadGame reads `history` from deps.
- [ ] Step 2: In `useGameState`, call after `useSceneStreams`; delete moved code; destructure all returns; keep the return-object fields identical. The "fresh unauthenticated start" effect (967–971) STAYS in the orchestrator (it reads `history.length` and `generateOpeningScene`).
- [ ] Step 3: VERIFY-B. Commit: `refactor(hooks): extract usePersistence (god-file split 6f)`

### Task 13: `hooks/gameState/useActBreak.ts`

**Files:** Create `hooks/gameState/useActBreak.ts`; modify `hooks/useGameState.ts`.

**Interfaces:**
- Owns: `isAdvancingAct` useState + `CURTAIN_HOLD_MS` (only `beginNextAct` writes/reads them). `pendingActTransition`, `isActBreakReady`, `isCurtainPlaying` REMAIN in the orchestrator (written by `handleAction` and persistence loaders).
- `ActBreakDeps`: `{ pendingActTransition: PendingActTransition | null; isCurtainPlaying: boolean; setPendingActTransition; setIsActBreakReady; setIsCurtainPlaying; setCurrentAct; setLocation; setLocationVisitCounts; setElapsedMinutes; setNpcStates; setInventory; setIsLoading; captureLocationArrival; streamArrivalScene; handleSaveGameRef }` (React.Dispatch / function types as established above; `setLocationVisitCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>`)
- Returns: `{ isAdvancingAct: boolean; beginNextAct: () => Promise<void>; handleJournalTypewriterDone: () => void }`

- [ ] Step 1: MOVE verbatim: `CURTAIN_HOLD_MS` (155), `isAdvancingAct` useState (223 with comment), `beginNextAct` (796–851 with the curtain comments and `audioManager.playSfx('act-bell')` — import `audioManager` in the module), `handleJournalTypewriterDone` (1529–1536 with its do-not-scroll NOTE).
- [ ] Step 2: Call in `useGameState` after `usePersistence` (needs `handleSaveGameRef`); wire the three returns into the return object unchanged.
- [ ] Step 3: VERIFY-B. Check final sizes: `wc -l hooks/useGameState.ts` → expect ≈ 800 lines (down from 1709), `wc -l engine/GameEngine.ts` → expect ≈ 250–320.
- [ ] Step 4: Commit: `refactor(hooks): extract useActBreak; useGameState is now the orchestrator (god-file split 6g)`

### Task 14: Final verification + review checkpoint

- [ ] Step 1: Full suite: `npm run qa:all` → all green; `npx tsc --noEmit` → clean; `npm run build` → succeeds.
- [ ] Step 2: Manual smoke via the dev preview (importmap+Vite hybrid — use the existing launch config): start a new game (opening scene streams), `look`, `examine case files wall`, move to Dorset Street (arrival narration), save, reload the page, Continue/resume (fresh look streams at the saved location), toggle theme + sound. Confirm no console errors.
- [ ] Step 3: Dispatch the `engineering-reviewer` agent on the Phase B diff (`git diff main...HEAD -- hooks/`). Instruction: "Pure move-refactor of useGameState into sub-hooks. Verify (1) every useCallback/useEffect dependency array is byte-identical to the pre-refactor file, (2) no hook-order conditionality was introduced, (3) all eslint-disable comments survived, (4) the GameStateReturn surface is unchanged."
- [ ] Step 4: Fix confirmed findings (moves only), re-run Step 1, commit.

### Task 15 (OPTIONAL — only if the requester asks for it): extract `handleAction`

`handleAction` (~480 lines, the turn pipeline) is deliberately left in the orchestrator: it writes nearly every atom and is the game's core loop. If a further split is requested later, extract it as `hooks/gameState/useTurnHandler.ts` with the same deps-object pattern (it will need ~35 deps entries, incl. `resolveIntentWithAI`, `captureDiaryEntries`, `handleSaveGame`, and the STEP 5–9 collaborators). Do NOT do this as part of backlog #8 unless explicitly instructed.

---

## Execution notes for the implementing agent

1. Work top-to-bottom; tasks are ordered so imports always exist before use. Do not parallelize A-tasks (each edits GameEngine.ts).
2. When a plan step cites line numbers, they refer to the pre-refactor files at commit `a7303d6`-era state; locate by symbol name if drift has occurred. Cut whole methods/blocks including their leading comment banners.
3. If tsc or qa:engine fails after a move, diff the moved block against `git show HEAD:<file>` for transcription drift before touching logic. The correct fix is always "make the move faithful", never "adjust the logic".
4. The 1 qa:engine warning is pre-existing; 2 warnings or a changed pass count means you broke something.
