# Phase 4a — Living World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NPC time-of-day schedules, a meaningful WAIT verb, location opening hours, and narration-broadcast world events — all derived from the existing in-game clock with zero new persisted state.

**Architecture:** The world at time T is a pure function of story data + the existing `SessionSnapshot` (the Phase 2a derive-per-turn pattern). `canonicalLocationByAct` becomes `scheduleByAct` (parity-first: step 1 changes nothing provably). Events fire once via the existing flags channel (the vignette pattern). WAIT advances the clock through a new `EngineResult.minutesAdvanced` field consumed by the hook's existing clock code.

**Tech Stack:** TypeScript, Vite + React (client), tsx QA scripts (`npm run qa:*`), Gemini via `/api/ai` gateway (only Task 6's live fixtures touch it).

**Spec:** `docs/superpowers/specs/2026-07-05-phase4a-living-world-design.md`

## Global Constraints

- **Parity-first:** Tasks 1–6 must not change any player-visible behavior on the shipped story data. Only Task 7 (authoring) changes behavior, gated by validators.
- **Engine resolves, AI narrates:** no new AI calls anywhere in this plan except the Task 6 live fixtures. All new logic is deterministic.
- **Verification commands:** `npx tsc --noEmit`, `npm run qa:validate`, `npm run qa:engine`, `npm run qa:hints`, `npm run qa:diary-leads` all run offline (no API key) and must stay green after every task. `npm run qa:parser` needs `GEMINI_API_KEY` for its live tier; its offline tiers must stay green.
- **Server ESM rule:** any file in the `/api/ai` import graph needs explicit `.js` on relative imports (`server/aiCore.ts`, `server/parseAction.ts`, `engine/gameData.ts`). Story files under `engine/stories/` are NOT in that graph (only type-erased or barrel-`.js` imports reach them) — new imports inside `engine/stories/whitechapel-1888/` follow the existing extensionless style there. This plan adds no new imports to server files.
- **Spoiler safety:** no engine-generated text may contain an unintroduced NPC's `displayName`; use `alias` (the same rule `buildContext` applies).
- **Match existing style:** qa scripts use the `pass()/fail()/warn()/section()` helpers; engine code uses the existing comment voice.

---

### Task 1: Schedule core — `scheduleByAct`, `npcLocationAt`, parity cutover

The single mechanical-rename task. After it, the engine derives every NPC position from `(act, timePeriod)` and `canonicalLocationByAct` no longer exists — with provably identical behavior (no `byPeriod` entries exist yet).

**Files:**
- Modify: `engine/stories/types.ts` (NPCDefinition)
- Modify: `engine/stories/whitechapel-1888/npcs.ts` (all 11 NPCs)
- Modify: `engine/GameEngine.ts` (helpers + all `canonicalLocationByAct` uses: lines ~72–83, 298, 429, 682, 735, 1203, 1504–1547)
- Modify: `engine/parseFallback.ts:53-83`, `hooks/useGameState.ts:54-88,1150-1153`, `scripts/qa-parser.ts:214-215`, `engine/stories/whitechapel-1888/hints.ts:29`, `scripts/qa-validate.ts:105-121,260-280`
- Test: `scripts/qa-engine.ts` (new section)

**Interfaces:**
- Consumes: existing `computeTimePeriod(totalMinutes)` (GameEngine.ts:21), `TimePeriod` (types.ts:2), `ActTimeConfig` (stories/types.ts:108).
- Produces (later tasks rely on these exact signatures):
  - `NPCDefinition.scheduleByAct: Record<number, { default: string; byPeriod?: Partial<Record<TimePeriod, string>> }>`
  - `export function timePeriodFor(actTimeConfig: Record<number, ActTimeConfig>, act: number, elapsedMinutes: number): TimePeriod` (GameEngine.ts)
  - `export function npcLocationAt(npcs: Record<string, NPCDefinition>, npcId: string, act: number, timePeriod: TimePeriod, npcStates: Record<string, NPCState>): string` (GameEngine.ts; returns `'offstage'` when nowhere)
  - `export function getPresentNpcIds(npcs, locationId, npcStates, currentAct, timePeriod)` — existing function, new 5th param
  - `export const PERIOD_ORDER: TimePeriod[]` (GameEngine.ts) — chronological day order

- [ ] **Step 1: Write the failing parity test**

Append a new section to `scripts/qa-engine.ts` (before the final summary/exit block; follow the file's existing section style). The legacy table below is the **verbatim** current data — do not regenerate it:

```ts
// ── Phase 4a: schedule parity ────────────────────────────────────────────────
// The scheduleByAct migration is parity-first: with no byPeriod overrides
// authored, npcLocationAt must equal the legacy canonicalLocationByAct for
// every NPC × act × period. This table is the pre-migration data, verbatim.
import { npcLocationAt, timePeriodFor, PERIOD_ORDER } from '../engine/GameEngine';
import { NPCS } from '../engine/stories/whitechapel-1888/npcs';

function testScheduleParity() {
  const LEGACY_CANONICAL: Record<string, Record<number, string>> = {
    holmes:         { 0: 'baker_street', 1: 'dorset_street', 2: 'whitechapel_mortuary', 3: 'dutfields_yard', 4: 'lusk_office', 5: 'bond_office', 6: 'private_asylum' },
    abberline:      { 0: 'h_division_station', 1: 'dorset_street', 2: 'h_division_station', 3: 'working_mens_club', 4: 'lusk_office', 5: 'bond_office', 6: 'private_asylum' },
    bond:           { 0: 'whitechapel_mortuary', 1: 'millers_court', 2: 'whitechapel_mortuary', 3: 'whitechapel_mortuary', 4: 'lusk_office', 5: 'bond_office', 6: 'bond_office' },
    edmund:         { 0: 'whitechapel_mortuary', 1: 'millers_court', 2: 'whitechapel_mortuary', 3: 'whitechapel_mortuary', 4: 'lusk_office', 5: 'bond_office', 6: 'private_asylum' },
    lusk:           { 4: 'lusk_office', 5: 'lusk_office', 6: 'lusk_office' },
    diemschutz:     { 0: 'working_mens_club', 1: 'working_mens_club', 2: 'working_mens_club', 3: 'working_mens_club', 4: 'working_mens_club', 5: 'working_mens_club', 6: 'working_mens_club' },
    hutchinson:     { 1: 'dorset_street', 2: 'whitechapel_pub', 3: 'whitechapel_pub' },
    phillips:       { 2: 'whitechapel_mortuary', 3: 'whitechapel_mortuary' },
    tumblety:       { 2: 'h_division_station', 3: 'h_division_station' },
    pizer:          { 3: 'working_mens_club' },
    superintendent: { 0: 'private_asylum', 1: 'private_asylum', 2: 'private_asylum', 3: 'private_asylum', 4: 'private_asylum', 5: 'private_asylum', 6: 'private_asylum' },
  };

  let mismatches = 0;
  for (const npcId of Object.keys(NPCS)) {
    for (let act = 0; act <= 6; act++) {
      const expected = LEGACY_CANONICAL[npcId]?.[act] ?? 'offstage';
      for (const period of PERIOD_ORDER) {
        const got = npcLocationAt(NPCS, npcId, act, period, {});
        if (got !== expected) {
          fail(`schedule parity: ${npcId} act ${act} ${period}`, `expected ${expected}, got ${got}`);
          mismatches++;
        }
      }
    }
  }
  if (mismatches === 0) pass('schedule parity: npcLocationAt === legacy canonicalLocationByAct for all NPCs × acts × periods');

  // Follower precedence: a stored currentLocation must still win for an
  // active follower (Holmes), and the schedule must win for a
  // location_based NPC even when a stale currentLocation is stored.
  if (npcLocationAt(NPCS, 'holmes', 1, 'morning', { holmes: { npcId: 'holmes', disposition: 50, status: 'alive', currentLocation: 'millers_court' } as any }) === 'millers_court') {
    pass('schedule precedence: follower stored currentLocation wins');
  } else {
    fail('schedule precedence: follower stored currentLocation wins');
  }
  if (npcLocationAt(NPCS, 'abberline', 2, 'morning', { abberline: { npcId: 'abberline', disposition: 50, status: 'alive', currentLocation: 'dorset_street' } as any }) === 'h_division_station') {
    pass('schedule precedence: schedule beats stale stored location for location_based NPC');
  } else {
    fail('schedule precedence: schedule beats stale stored location for location_based NPC');
  }
}
testScheduleParity();
```

Also add `timePeriodFor` sanity checks in the same function:

```ts
  // timePeriodFor: act 2 starts 9:00 AM (540) — morning; +180 → afternoon.
  if (timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, 2, 0) === 'morning' &&
      timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, 2, 180) === 'afternoon') {
    pass('timePeriodFor anchors to act canonical start');
  } else {
    fail('timePeriodFor anchors to act canonical start');
  }
```

(`WHITECHAPEL_MANIFEST` — add `import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';` if qa-engine.ts does not already import it.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsc --noEmit ; npm run qa:engine`
Expected: tsc FAILS with `npcLocationAt`/`timePeriodFor`/`PERIOD_ORDER` not exported and `scheduleByAct` not existing. That compile failure IS the red state.

- [ ] **Step 3: Change the type**

In `engine/stories/types.ts`, add `TimePeriod` to the existing type-import from `../../types` (line 4), and replace the `canonicalLocationByAct` field (line 43) with:

```ts
  // NPC placement — derived per turn from (act, timePeriod). `default` is the
  // act's anchor spot (the old canonicalLocationByAct value); byPeriod entries
  // move the NPC by time of day (e.g. evening at the pub). An act with NO
  // entry means OFFSTAGE for that act (e.g. Tumblety after he flees).
  scheduleByAct: Record<number, {
    default: string;
    byPeriod?: Partial<Record<TimePeriod, string>>;
  }>;
```

- [ ] **Step 4: Parity-rewrite npcs.ts**

Mechanical rewrite of every NPC in `engine/stories/whitechapel-1888/npcs.ts` — the acts and location ids must match the legacy table in Step 1 exactly. Pattern (Holmes shown; repeat for all 11):

```ts
    scheduleByAct: {
      0: { default: 'baker_street' },
      1: { default: 'dorset_street' },
      2: { default: 'whitechapel_mortuary' },
      3: { default: 'dutfields_yard' },
      4: { default: 'lusk_office' },
      5: { default: 'bond_office' },
      6: { default: 'private_asylum' },
    },
```

No `byPeriod` entries anywhere in this task.

- [ ] **Step 5: Engine helpers + presence cutover**

In `engine/GameEngine.ts`:

(a) Below `computeTimePeriod`, add:

```ts
// Chronological day order of the six periods — shared by WAIT boundary math,
// "next open period" computations, and schedule iteration.
export const PERIOD_ORDER: TimePeriod[] = ['dawn', 'morning', 'afternoon', 'evening', 'night', 'lateNight'];

/** The TimePeriod at a given act + minutes elapsed since its canonical start. */
export function timePeriodFor(
  actTimeConfig: Record<number, ActTimeConfig>,
  act: number,
  elapsedMinutes: number,
): TimePeriod {
  const cfg = actTimeConfig[act] ?? actTimeConfig[1];
  return computeTimePeriod(cfg.canonicalMinutes + elapsedMinutes);
}

/**
 * Where an NPC is right now — the single source of truth for NPC placement.
 * Active followers (follows_watson / follows_bond, until followsUntilAct)
 * keep their stored currentLocation; everyone else derives from the schedule,
 * so stored positions can never mask a time-of-day move. 'offstage' never
 * matches a real location id.
 */
export function npcLocationAt(
  npcs: Record<string, NPCDefinition>,
  npcId: string,
  act: number,
  timePeriod: TimePeriod,
  npcStates: Record<string, NPCState>,
): string {
  const npc = npcs[npcId];
  if (!npc) return 'offstage';
  const sched = npc.scheduleByAct[act];
  const scheduled = sched ? (sched.byPeriod?.[timePeriod] ?? sched.default) : undefined;
  const stored = npcStates[npcId]?.currentLocation;
  const isActiveFollower =
    !!npc.followsNpcId && (npc.followsUntilAct === undefined || act <= npc.followsUntilAct);
  if (isActiveFollower) return stored ?? scheduled ?? 'offstage';
  return scheduled ?? stored ?? 'offstage';
}
```

Import `ActTimeConfig` into the existing `stories/types` type-import on line 15.

(b) Rewrite `getPresentNpcIds` (lines 72–83) to take and use the period:

```ts
export function getPresentNpcIds(
  npcs: Record<string, NPCDefinition>,
  locationId: string,
  npcStates: Record<string, NPCState>,
  currentAct: number,
  timePeriod: TimePeriod,
): string[] {
  return Object.keys(npcs).filter(npcId =>
    npcLocationAt(npcs, npcId, currentAct, timePeriod, npcStates) === locationId &&
    npcStates[npcId]?.status !== 'deceased');
}
```

(c) Add a private convenience on the class:

```ts
  /** The current TimePeriod for this session's act + elapsed clock. */
  private periodOf(session: SessionSnapshot, extraMinutes = 0): TimePeriod {
    return timePeriodFor(this.story.actTimeConfig, session.currentAct, session.elapsedMinutes + extraMinutes);
  }
```

(d) Replace the four inline `npcState?.currentLocation ?? …canonicalLocationByAct[…]` lookups (lines 298, 429, 682) and the inline present-NPC filter in `resolveShow` (lines 733–737) with the helpers:

```ts
    const npcLoc = npcLocationAt(this.story.npcs, targetId, session.currentAct, this.periodOf(session), session.npcStates);
```

and in `resolveShow`:

```ts
    const presentNpcIds = getPresentNpcIds(this.story.npcs, session.location, session.npcStates, session.currentAct, this.periodOf(session));
```

(line 682 uses `npcId` instead of `targetId`.)

(e) In `buildContext` (line 1203), pass the period — computed with the outcome's extra minutes so later tasks (WAIT) stay consistent. For now add the parameter only:

```ts
    const presentNPCEntries = getPresentNpcIds(this.story.npcs, locationId, resolvedNpcStates, session.currentAct, this.periodOf(session))
```

(f) In `computeNpcMovements` (lines 1506–1556): compute `const period = this.periodOf(session);` at the top, then replace the three canonical lookups:

- line 1518: `const canonical = npc.scheduleByAct[session.currentAct] ? (npc.scheduleByAct[session.currentAct].byPeriod?.[period] ?? npc.scheduleByAct[session.currentAct].default) : 'offstage';`
- line 1532: `const canonical = npc.scheduleByAct[session.currentAct]?.byPeriod?.[period] ?? npc.scheduleByAct[session.currentAct]?.default;`
- line 1547: `this.story.npcs[npc.followsNpcId]?.scheduleByAct[session.currentAct]?.default;` (a followed NPC's fallback anchor stays the default — followers track people, not timetables)

Also update the doc comment at line 1504 (`location_based / fixed → snap to the schedule for the current act + period`).

(g) Callers outside the engine:

- `engine/parseFallback.ts`: `buildParseCandidates` gains a 6th param `elapsedMinutes: number`; compute `const period = timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, currentAct, elapsedMinutes);` and pass to `getPresentNpcIds`. Import `timePeriodFor` from `./GameEngine`.
- `hooks/useGameState.ts`: both `resolveTargetWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs)` (line 54) and `resolveIntentWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs)` (line 138) gain a trailing `elapsedMinutes: number` parameter, used to compute the period wherever each calls `getPresentNpcIds`/`buildParseCandidates` (import `timePeriodFor`; the file already imports `computeTimePeriod` — keep both). Update the two call sites at lines 1151-1153 to pass `elapsedMinutes` (already in scope there as hook state) as the 7th argument to whichever function `AI_PARSER_ENABLED` selects.
- `scripts/qa-parser.ts:215`: `getPresentNpcIds(WHITECHAPEL_MANIFEST.npcs, scene.location, {}, scene.act, timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, scene.act, 0))` — canonical-start period; import `timePeriodFor`. Also update the `buildParseCandidates(locId, [], {}, act, [])` call in `runFastPathGuard` (line ~272) to pass the new final arg `0`.
- `engine/stories/whitechapel-1888/hints.ts:29`: replace `(NPCS[npcId] as any)?.canonicalLocationByAct?.[s.currentAct]` with `(NPCS[npcId] as any)?.scheduleByAct?.[s.currentAct]?.default` (hints have no clock — the act anchor is the correct, behavior-preserving read).

(h) `scripts/qa-validate.ts`:

- line 112: `const canonicallyThere = Object.values(npc.scheduleByAct).some(s => s.default === locId || Object.values(s.byPeriod ?? {}).includes(locId));`
- lines 266–274: iterate the new shape —

```ts
    for (const [act, sched] of Object.entries(npc.scheduleByAct)) {
      if (!locationIds.has(sched.default)) {
        fail(`npc ${npcId}: scheduleByAct[${act}].default "${sched.default}" does not resolve`);
      }
      for (const [period, locId] of Object.entries(sched.byPeriod ?? {})) {
        if (!locationIds.has(locId as string)) {
          fail(`npc ${npcId}: scheduleByAct[${act}].byPeriod.${period} "${locId}" does not resolve`);
        }
      }
    }
    const coveredActs = Object.keys(npc.scheduleByAct).map(Number);
```

(keep the surrounding pass/warn lines as they are, renaming message text from `canonicalLocationByAct` to `scheduleByAct`).

- [ ] **Step 6: Verify everything is green**

Run: `npx tsc --noEmit && npm run qa:validate && npm run qa:engine && npm run qa:hints && npm run qa:diary-leads`
Expected: all PASS, including the new `schedule parity` lines. Also run the offline parser tiers: `npm run qa:parser` (without `GEMINI_API_KEY` it must still run its offline tiers green — check the script's no-key behavior and confirm no regression).

- [ ] **Step 7: Grep for stragglers**

Run: `grep -rn "canonicalLocationByAct" --include="*.ts" --include="*.tsx" . | grep -v node_modules`
Expected: only comments (update any that describe behavior, e.g. `qa-parser.ts:389`, `GameEngine.ts` header comments). Zero code references.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: scheduleByAct + npcLocationAt — parity-first schedule core (Phase 4a)"
```

---

### Task 2: WAIT verb — parser, engine, hook clock

**Files:**
- Modify: `types.ts:160` (IntentType), `types.ts:178-207` (EngineResult)
- Modify: `engine/intentParser.ts` (WAIT_VERBS + parse branch)
- Modify: `engine/GameEngine.ts` (resolveWait, buildContext extraMinutes, boundary helper)
- Modify: `hooks/useGameState.ts:1259-1266` (minutesAdvanced)
- Test: `scripts/qa-engine.ts`

**Interfaces:**
- Consumes: `PERIOD_ORDER`, `computeTimePeriod`, `timePeriodFor`, `periodOf` from Task 1.
- Produces:
  - `IntentType` gains `'wait'`; `EngineResult.minutesAdvanced?: number`
  - `export function minutesToNextPeriodBoundary(totalMinutes: number): number` (GameEngine.ts)
  - `buildContext` outcome gains `extraMinutes?: number` — Tasks 3–5 rely on `buildContext` evaluating time-derived context at `elapsedMinutes + extraMinutes`.

- [ ] **Step 1: Write failing tests**

Append to `scripts/qa-engine.ts`:

```ts
// ── Phase 4a: WAIT ───────────────────────────────────────────────────────────
import { minutesToNextPeriodBoundary } from '../engine/GameEngine';

function testWait() {
  // Parser: bare and phrasal forms.
  for (const input of ['wait', 'wait here', 'pass the time', 'linger a while']) {
    const it = parseIntent(input);
    if (it.type === 'wait') pass(`parse "${input}" → wait`);
    else fail(`parse "${input}" → wait`, `got ${it.type}`);
  }

  // Boundary math. Act 2 starts 540 (morning); next boundary 720.
  if (minutesToNextPeriodBoundary(540) === 180) pass('wait math: 9:00 AM → noon = 180');
  else fail('wait math: 9:00 AM → noon = 180', String(minutesToNextPeriodBoundary(540)));
  // Exactly on a boundary advances to the NEXT one — never 0.
  if (minutesToNextPeriodBoundary(720) === 300) pass('wait math: boundary minute advances to next boundary');
  else fail('wait math: boundary minute advances to next boundary', String(minutesToNextPeriodBoundary(720)));
  // lateNight wraps past midnight to dawn (05:00 next day).
  if (minutesToNextPeriodBoundary(1390) === 350) pass('wait math: lateNight wraps to dawn');
  else fail('wait math: lateNight wraps to dawn', String(minutesToNextPeriodBoundary(1390)));

  // Engine: resolveWait in act 2 (9:00 AM) advances 180 min into the afternoon.
  const session: SessionSnapshot = {
    location: 'whitechapel_mortuary', inventory: [], flags: { act_2_started: true },
    npcStates: {}, currentAct: 2, medicalPoints: 0, moralPoints: 0,
    discoveredClueIds: [], turnsAtLocationWithoutProgress: 0, elapsedMinutes: 0,
    introducedNpcs: [], locationVisitCounts: {}, turnCount: 10,
  };
  const r = gameEngine.resolve(parseIntent('wait'), session);
  if (r.actionType === 'wait' && r.actionSuccess && r.minutesAdvanced === 180) {
    pass('resolveWait: act 2 morning → 180 minutes to afternoon');
  } else {
    fail('resolveWait: act 2 morning → 180 minutes to afternoon', JSON.stringify({ type: r.actionType, min: r.minutesAdvanced }));
  }
  if (r.aiContext.timePeriod === 'afternoon') pass('resolveWait: narration context shows the post-wait period');
  else fail('resolveWait: narration context shows the post-wait period', r.aiContext.timePeriod);
  if (r.newAct === undefined && r.newLocation === undefined) pass('resolveWait: never moves or advances the act');
  else fail('resolveWait: never moves or advances the act');
}
testWait();
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsc --noEmit`
Expected: FAIL — `minutesToNextPeriodBoundary` not exported, `'wait'` not in IntentType.

- [ ] **Step 3: Implement**

(a) `types.ts:160` — add `'wait'` to the union after `'deduce'`:

```ts
export type IntentType = 'move' | 'examine' | 'talk' | 'take' | 'use' | 'show' | 'read' | 'drop' | 'inventory' | 'deduce' | 'wait' | 'help' | 'query' | 'notebook' | 'other' | 'unresolved_target';
```

(b) `types.ts` EngineResult — after `discoveredClueIds?` add:

```ts
  // Minutes this action consumed when it isn't the fixed per-verb cost —
  // set by WAIT (time to the next period boundary). The hook prefers this
  // over its ACTION_TIME_MINUTES table.
  minutesAdvanced?: number;
```

(c) `engine/intentParser.ts` — below `DROP_VERBS` add:

```ts
// Wait / pass time (Phase 4a — advances the clock to the next time period)
const WAIT_VERBS = [
  'wait', 'pass the time', 'linger', 'rest a while', 'bide',
];
```

and in `parseIntent`, after the notebook check (step "3. Notebook") and before "3. Movement":

```ts
  // 3b. Wait — whole-verb match ("wait", "wait here", "wait for the doctor"
  // all advance to the next period; wait-for-target is out of scope).
  for (const verb of WAIT_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm === verb || norm.startsWith(verb + ' ')) {
      return { type: 'wait', raw: rawInput };
    }
  }
```

(Note: `'leave'` is a MOVE/DROP verb and `'rest'` alone is intentionally not matched — too collision-prone.)

(d) `engine/GameEngine.ts` — export the boundary helper next to `PERIOD_ORDER`:

```ts
/**
 * Minutes from a clock value to the NEXT TimePeriod boundary. A turn starting
 * exactly on a boundary advances to the one after — never 0. lateNight wraps
 * past midnight to dawn (05:00).
 */
export function minutesToNextPeriodBoundary(totalMinutes: number): number {
  const BOUNDARIES = [300, 420, 720, 1020, 1200, 1380]; // computeTimePeriod's edges
  const m = totalMinutes % 1440;
  for (const b of BOUNDARIES) if (b > m) return b - m;
  return (1440 - m) + 300; // past 23:00 → dawn next day
}
```

Add `case 'wait': result = this.resolveWait(intent, session); break;` to `resolve()` (after `'deduce'`), and the resolver (place near `resolveHelp`):

```ts
  // --------------------------------------------------------
  // WAIT (Phase 4a: advances the clock to the next time period)
  // --------------------------------------------------------

  private resolveWait(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const cfg = this.story.actTimeConfig[session.currentAct] ?? this.story.actTimeConfig[1];
    const total = cfg.canonicalMinutes + session.elapsedMinutes;
    const from = computeTimePeriod(total);
    const minutesAdvanced = minutesToNextPeriodBoundary(total);
    const to = computeTimePeriod(total + minutesAdvanced);
    const hours = Math.round((minutesAdvanced / 60) * 10) / 10;

    return {
      actionSuccess: true,
      actionType: 'wait',
      minutesAdvanced,
      discoveredClueIds: [],
      aiContext: this.buildContext(intent, session, {
        success: true,
        actionDescription: `Watson deliberately waited at ${this.story.locations[session.location].name} as ${from} gave way to ${to}.`,
        actionResultNote:
          `SUCCESS — TIME PASSES. Watson chose to wait; roughly ${hours} hour(s) pass and ${from} becomes ${to}. ` +
          `Narrate the passage of time as ONE compressed beat (light changing, street sounds shifting, Watson's thoughts turning over the case) — ` +
          `not a minute-by-minute account. Do not invent events, arrivals, or discoveries beyond any listed above.`,
        newClueDefs: [],
        extraMinutes: minutesAdvanced,
      }),
    };
  }
```

(e) `buildContext` — add `extraMinutes?: number;` to the outcome parameter type (after `deductionCorrect?`), and use it wherever time is derived:

```ts
    const totalMinutes = actTimeCfg.canonicalMinutes + session.elapsedMinutes + (outcome.extraMinutes ?? 0);
```

(line ~1375; `timePeriod`/`timeLabel` lines below it are unchanged), the weather check becomes `session.elapsedMinutes + (outcome.extraMinutes ?? 0) >= baseWeather.lateShift.afterMinutes`, and the Task 1 presence call becomes `this.periodOf(session, outcome.extraMinutes ?? 0)`.

(f) `hooks/useGameState.ts:1265`:

```ts
      const actionMinutes = result.minutesAdvanced ?? ACTION_TIME_MINUTES[result.actionType] ?? 2;
```

(no `wait` entry in the table — `minutesAdvanced` always covers it).

(g) `engine/parseFallback.ts` — no change needed: `'wait'` is not in `VERBS_NEEDING_TARGET` and is neither `'other'` nor `'unresolved_target'`, so it never routes to the AI parse. Add the qa-parser guard in Task 6.

- [ ] **Step 4: Verify green**

Run: `npx tsc --noEmit && npm run qa:engine && npm run qa:validate`
Expected: all PASS including the new WAIT section.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: WAIT verb — clock advances to the next time period (Phase 4a)"
```

---

### Task 3: Location opening hours

**Files:**
- Modify: `engine/stories/types.ts` (LocationDefinition), `engine/GameEngine.ts` (resolveMove gate + `nextOpenPeriod`), `scripts/qa-validate.ts` (new rules)
- Test: `scripts/qa-engine.ts`

**Interfaces:**
- Consumes: `PERIOD_ORDER`, `periodOf`, `npcLocationAt`, `blocked()`.
- Produces: `LocationDefinition.openPeriods?: TimePeriod[]`, `LocationDefinition.lockedNote?: { text: string; keyholderNpcId?: string }`, `export function nextOpenPeriod(openPeriods: TimePeriod[], from: TimePeriod): TimePeriod | null` (GameEngine.ts). Task 4 reuses the alias-masking pattern introduced here.

- [ ] **Step 1: Write failing tests**

Append to `scripts/qa-engine.ts`. No shipped location has `openPeriods` yet, so build a test engine over patched story data (the `GameEngine` class and manifest are both exported):

```ts
// ── Phase 4a: location opening hours ─────────────────────────────────────────
import { GameEngine, nextOpenPeriod } from '../engine/GameEngine';
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';

function testOpeningHours() {
  if (nextOpenPeriod(['morning', 'afternoon'], 'night') === 'morning') pass('nextOpenPeriod cycles past midnight');
  else fail('nextOpenPeriod cycles past midnight');
  if (nextOpenPeriod(['evening'], 'evening') === 'evening') pass('nextOpenPeriod: currently-open period returns itself when cycling');
  else fail('nextOpenPeriod: currently-open period returns itself when cycling');

  const testEngine = new GameEngine({
    ...WHITECHAPEL_MANIFEST,
    locations: {
      ...WHITECHAPEL_MANIFEST.locations,
      whitechapel_mortuary: {
        ...WHITECHAPEL_MANIFEST.locations.whitechapel_mortuary,
        openPeriods: ['morning', 'afternoon'] as const,
        lockedNote: { text: 'The mortuary door is bolted; a card gives the visiting hours.', keyholderNpcId: 'phillips' },
      } as any,
    },
  });

  // Act 2 starts 9:00 AM (morning) — open: the move succeeds as today.
  const base: SessionSnapshot = {
    location: 'dorset_street', inventory: [], flags: { act_2_started: true },
    npcStates: {}, currentAct: 2, medicalPoints: 0, moralPoints: 0,
    discoveredClueIds: [], turnsAtLocationWithoutProgress: 0, elapsedMinutes: 0,
    introducedNpcs: [], locationVisitCounts: {}, turnCount: 10,
  };
  const open = testEngine.resolve(parseIntent('go to the mortuary'), base);
  if (open.actionSuccess && open.newLocation === 'whitechapel_mortuary') pass('open hours: morning visit proceeds');
  else fail('open hours: morning visit proceeds', JSON.stringify({ ok: open.actionSuccess, loc: open.newLocation }));

  // 9:00 AM + 660 min = 8:00 PM (evening) — closed: blocked, no location change.
  const night = testEngine.resolve(parseIntent('go to the mortuary'), { ...base, elapsedMinutes: 660 });
  if (!night.actionSuccess && night.newLocation === undefined) pass('locked hours: evening visit blocked without moving');
  else fail('locked hours: evening visit blocked without moving');
  if (night.aiContext.actionResultNote.includes('bolted') && night.aiContext.actionResultNote.includes('morning')) {
    pass('locked hours: note carries authored text + reopening period');
  } else {
    fail('locked hours: note carries authored text + reopening period', night.aiContext.actionResultNote);
  }
}
testOpeningHours();
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsc --noEmit`
Expected: FAIL — `nextOpenPeriod` not exported, `openPeriods` not on LocationDefinition.

- [ ] **Step 3: Implement**

(a) `engine/stories/types.ts` — after `vignettes?` in LocationDefinition:

```ts
  // Opening hours (Phase 4a). Absent = always open. When set, arriving in a
  // period not listed is blocked with the authored lockedNote; qa:validate
  // requires lockedNote whenever openPeriods is set.
  openPeriods?: TimePeriod[];
  lockedNote?: {
    text: string;             // authored locked-door beat, diegetic
    keyholderNpcId?: string;  // whereabouts derived from their schedule, never hand-written
  };
```

(b) `engine/GameEngine.ts` — export next to the other period helpers:

```ts
/** First open period at or after `from` (exclusive of `from`, wrapping the day). */
export function nextOpenPeriod(openPeriods: TimePeriod[], from: TimePeriod): TimePeriod | null {
  const start = PERIOD_ORDER.indexOf(from);
  for (let i = 1; i <= PERIOD_ORDER.length; i++) {
    const p = PERIOD_ORDER[(start + i) % PERIOD_ORDER.length];
    if (openPeriods.includes(p)) return p;
  }
  return null;
}
```

(c) In `resolveMove`, after the `requiresFlag` gate (line ~238) and before the success block:

```ts
    // Opening hours (Phase 4a) — arriving outside openPeriods is a locked
    // door, never a dead end: the note says when it opens and where the
    // keyholder is, and WAIT gets Watson in.
    const period = this.periodOf(session);
    if (targetLoc.openPeriods && !targetLoc.openPeriods.includes(period)) {
      const reopens = nextOpenPeriod(targetLoc.openPeriods, period);
      const keyholderId = targetLoc.lockedNote?.keyholderNpcId;
      let keyholderNote = '';
      if (keyholderId) {
        const kh = this.story.npcs[keyholderId];
        const introduced = !kh?.requiresIntroduction || session.introducedNpcs.includes(keyholderId);
        const label = introduced ? (this.story.npcDisplayNames[keyholderId] ?? keyholderId) : (kh?.alias ?? 'the keeper');
        const whereId = npcLocationAt(this.story.npcs, keyholderId, session.currentAct, period, session.npcStates);
        const where = this.story.locations[whereId];
        if (where) keyholderNote = ` ${label} is presently at ${where.name}.`;
      }
      return this.blocked(
        intent,
        session,
        targetLoc.lockedNote?.text ?? `${targetLoc.name} is closed at this hour.`,
        `BLOCKED — ${targetLoc.name} is closed (it is ${period}). ${targetLoc.lockedNote?.text ?? ''}` +
        (reopens ? ` It opens come ${reopens}.` : '') + keyholderNote +
        ` Convey this diegetically (a bolted door, a card of visiting hours, a caretaker's word). ` +
        `Watson is NOT stuck: make clear he may wait for it to open or turn his attention elsewhere. He does not enter.`
      );
    }
```

(d) `scripts/qa-validate.ts` — new section (follow the file's `section()` style):

```ts
section('Location opening hours (Phase 4a)');
for (const [locId, loc] of Object.entries(LOCATIONS)) {
  if (!loc.openPeriods) continue;
  if (loc.openPeriods.length === 0) fail(`location ${locId}: openPeriods is empty (always closed)`);
  if (!loc.lockedNote?.text) fail(`location ${locId}: openPeriods set but no lockedNote`);
  const kh = loc.lockedNote?.keyholderNpcId;
  if (kh && !npcIds.has(kh)) fail(`location ${locId}: lockedNote.keyholderNpcId "${kh}" does not resolve`);
}
pass('opening-hours integrity checked');
```

- [ ] **Step 4: Verify green**

Run: `npx tsc --noEmit && npm run qa:engine && npm run qa:validate`
Expected: all PASS (shipped data has no openPeriods; the test engine exercises the gate).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: location opening hours with diegetic locked-door redirect (Phase 4a)"
```

---

### Task 4: Diegetic redirect for absent NPCs

**Files:**
- Modify: `engine/GameEngine.ts` (shared `absentNpcBlocked` helper; use in resolveTalk:431-439, resolveShow:685-690, examine-NPC:301-308)
- Test: `scripts/qa-engine.ts`

**Interfaces:**
- Consumes: `npcLocationAt`, `PERIOD_ORDER`, `periodOf`, `blocked()`, alias-masking pattern from Task 3.
- Produces: `private absentNpcBlocked(intent, session, npcId, attemptedVerb: string): EngineResult`; `export function returnsPeriodFor(npc: NPCDefinition, act: number, locationId: string, from: TimePeriod): TimePeriod | null` (GameEngine.ts).

- [ ] **Step 1: Write failing tests**

Append to `scripts/qa-engine.ts` (reuse the patched-engine pattern; give Bond a byPeriod override so the redirect has real whereabouts):

```ts
// ── Phase 4a: absent-NPC diegetic redirect ───────────────────────────────────
import { returnsPeriodFor } from '../engine/GameEngine';

function testAbsentRedirect() {
  const patchedNpcs = {
    ...WHITECHAPEL_MANIFEST.npcs,
    bond: {
      ...WHITECHAPEL_MANIFEST.npcs.bond,
      scheduleByAct: {
        ...WHITECHAPEL_MANIFEST.npcs.bond.scheduleByAct,
        2: { default: 'whitechapel_mortuary', byPeriod: { evening: 'whitechapel_pub' } },
      },
    },
  };
  const eng = new GameEngine({ ...WHITECHAPEL_MANIFEST, npcs: patchedNpcs as any });

  // returnsPeriodFor: from evening at the mortuary, Bond is back come night —
  // the first period after evening with no byPeriod override falls to default.
  const rp = returnsPeriodFor(patchedNpcs.bond as any, 2, 'whitechapel_mortuary', 'evening');
  if (rp === 'night') pass('returnsPeriodFor: first period the schedule puts the NPC back here');
  else fail('returnsPeriodFor: first period the schedule puts the NPC back here', String(rp));

  // Act 2, evening (elapsed 660 → 8:00 PM), Watson at the mortuary: Bond is at the pub.
  const s: SessionSnapshot = {
    location: 'whitechapel_mortuary', inventory: [], flags: { act_2_started: true },
    npcStates: {}, currentAct: 2, medicalPoints: 0, moralPoints: 0,
    discoveredClueIds: [], turnsAtLocationWithoutProgress: 0, elapsedMinutes: 660,
    introducedNpcs: ['bond'], locationVisitCounts: {}, turnCount: 10,
  };
  const r = eng.resolve(parseIntent('talk to bond'), s);
  if (!r.actionSuccess && r.aiContext.actionResultNote.includes('ABSENT PERSON')) pass('absent talk: blocked with redirect note');
  else fail('absent talk: blocked with redirect note', r.aiContext.actionResultNote);
  if (r.aiContext.actionResultNote.includes('Ten Bells') || r.aiContext.actionResultNote.includes(WHITECHAPEL_MANIFEST.locations.whitechapel_pub.name)) {
    pass('absent talk: names the whereabouts location');
  } else {
    fail('absent talk: names the whereabouts location', r.aiContext.actionResultNote);
  }
  if (r.aiContext.actionResultNote.includes('night')) pass('absent talk: names the return period');
  else fail('absent talk: names the return period', r.aiContext.actionResultNote);

  // Spoiler mask: an unintroduced NPC's redirect uses the alias, never the real name.
  const s0: SessionSnapshot = { ...s, location: 'baker_street', currentAct: 0, elapsedMinutes: 0, flags: {}, introducedNpcs: [] };
  const r0 = gameEngine.resolve(parseIntent('talk to abberline'), s0);
  if (!r0.actionSuccess && !r0.aiContext.actionResultNote.includes('Abberline') && !(r0.blockedReason ?? '').includes('Abberline')) {
    pass('absent talk: unintroduced NPC stays alias-masked');
  } else {
    fail('absent talk: unintroduced NPC stays alias-masked', r0.aiContext.actionResultNote);
  }
}
testAbsentRedirect();
```

(Adjust the whereabouts-name assertion to the actual `whitechapel_pub` display name — the manifest lookup form shown is the safe one.)

- [ ] **Step 2: Run to verify failure**

Run: `npx tsc --noEmit`
Expected: FAIL — `returnsPeriodFor` not exported. (The alias-mask case would also fail today: the current message uses `npcDisplayNames`.)

- [ ] **Step 3: Implement**

(a) Export next to the other helpers in `engine/GameEngine.ts`:

```ts
/**
 * The next period (cycling the day from `from`, exclusive) in which this
 * NPC's schedule puts them at `locationId` — null if the schedule never
 * brings them back here this act.
 */
export function returnsPeriodFor(
  npc: NPCDefinition,
  act: number,
  locationId: string,
  from: TimePeriod,
): TimePeriod | null {
  const sched = npc.scheduleByAct[act];
  if (!sched) return null;
  const start = PERIOD_ORDER.indexOf(from);
  for (let i = 1; i <= PERIOD_ORDER.length; i++) {
    const p = PERIOD_ORDER[(start + i) % PERIOD_ORDER.length];
    if ((sched.byPeriod?.[p] ?? sched.default) === locationId) return p;
  }
  return null;
}
```

(b) Private helper on the class:

```ts
  /**
   * Blocked result for addressing an NPC who is scheduled elsewhere right now.
   * Diegetic redirect — never a dead end: the note carries where they are and
   * when the schedule brings them back, alias-masked until introduced.
   */
  private absentNpcBlocked(
    intent: ParsedIntent,
    session: SessionSnapshot,
    npcId: string,
    attemptedVerb: string,
  ): EngineResult {
    const npc = this.story.npcs[npcId];
    const period = this.periodOf(session);
    const introduced = !npc.requiresIntroduction || session.introducedNpcs.includes(npcId);
    const label = introduced ? (this.story.npcDisplayNames[npcId] ?? npcId) : (npc.alias ?? 'that person');
    const whereId = npcLocationAt(this.story.npcs, npcId, session.currentAct, period, session.npcStates);
    const where = this.story.locations[whereId];
    const returns = returnsPeriodFor(npc, session.currentAct, session.location, period);
    const currentLocName = this.story.locations[session.location].name;

    return this.blocked(
      intent,
      session,
      `${label} is not here at the moment.`,
      `ABSENT PERSON — Watson tried to ${attemptedVerb} ${label}, but they are not at ${currentLocName} right now. ` +
      (where ? `They are presently at ${where.name}. ` : `They are nowhere to be found in Whitechapel at present. `) +
      (returns ? `They are expected back here come ${returns}. ` : '') +
      `Convey this diegetically (an attendant's word, a note on a door, the empty room itself) in 1–2 sentences. ` +
      `Watson is NOT stuck: he may follow them there, wait, or turn to something else. Do not invent dialogue with the absent person.`
    );
  }
```

(c) Replace the three "not here" blocks with calls:

- `resolveTalk` (lines 431–439): `if (npcLoc !== session.location) { return this.absentNpcBlocked(intent, session, targetId, 'speak with'); }`
- examine-NPC branch (lines 301–308): `return this.absentNpcBlocked(intent, session, targetId, 'examine');`
- `resolveShow` (lines 685–690): `return this.absentNpcBlocked(intent, session, npcId, 'show something to');`

- [ ] **Step 4: Verify green**

Run: `npx tsc --noEmit && npm run qa:engine && npm run qa:validate && npm run qa:hints`
Expected: all PASS. (qa:hints exercises talk flows — confirm no hint test asserted the old "is not here at the moment" note verbatim; if one did, update it to the new note.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: diegetic whereabouts redirect for absent NPCs (Phase 4a)"
```

---

### Task 5: World events — data, engine firing, narration

**Files:**
- Create: `engine/stories/whitechapel-1888/events.ts`
- Modify: `engine/stories/types.ts` (WorldEventDefinition + StoryManifest), `engine/stories/whitechapel-1888/manifest.ts`, `types.ts` (NarrationContext), `engine/GameEngine.ts` (firing in buildContext + flag lift in resolve), `server/aiCore.ts` (prompt section), `scripts/qa-validate.ts`
- Test: `scripts/qa-engine.ts`

**Interfaces:**
- Consumes: `buildContext` `extraMinutes` (Task 2), the `_vignetteFlagsUpdate` lift pattern (GameEngine.ts:171-175).
- Produces:
  - `WorldEventDefinition { id: string; act: number; atClockMinutes: number; text: string }` (stories/types.ts); `StoryManifest.worldEvents: WorldEventDefinition[]`
  - `NarrationContext.worldEvents?: string[]` (types.ts)
  - Fired-once flags named `world_event_<id>` riding `EngineResult.flagsUpdate`.

- [ ] **Step 1: Write failing tests**

Append to `scripts/qa-engine.ts`:

```ts
// ── Phase 4a: world events ───────────────────────────────────────────────────
function testWorldEvents() {
  const eng = new GameEngine({
    ...WHITECHAPEL_MANIFEST,
    worldEvents: [
      { id: 'test_noon_gun', act: 2, atClockMinutes: 720, text: 'A noon gun sounds over the river.' },
      { id: 'test_dawn_cry', act: 0, atClockMinutes: 300, text: 'The first newsboys cry the morning edition.' },
    ],
  });
  const base: SessionSnapshot = {
    location: 'whitechapel_mortuary', inventory: [], flags: { act_2_started: true },
    npcStates: {}, currentAct: 2, medicalPoints: 0, moralPoints: 0,
    discoveredClueIds: [], turnsAtLocationWithoutProgress: 0, elapsedMinutes: 0,
    introducedNpcs: [], locationVisitCounts: {}, turnCount: 10,
  };

  // 9:00 AM — before the noon gun: nothing fires.
  const before = eng.resolve(parseIntent('look'), base);
  if (!before.aiContext.worldEvents?.length && !before.flagsUpdate?.world_event_test_noon_gun) {
    pass('world events: nothing fires before its time');
  } else {
    fail('world events: nothing fires before its time');
  }

  // Past noon (elapsed 200 → 12:20): fires once, sets its flag.
  const at = eng.resolve(parseIntent('look'), { ...base, elapsedMinutes: 200 });
  if (at.aiContext.worldEvents?.includes('A noon gun sounds over the river.') &&
      at.flagsUpdate?.world_event_test_noon_gun === true) {
    pass('world events: fires with flag once the clock passes atClockMinutes');
  } else {
    fail('world events: fires with flag once the clock passes atClockMinutes', JSON.stringify(at.aiContext.worldEvents));
  }

  // Already delivered: never again.
  const again = eng.resolve(parseIntent('look'), { ...base, elapsedMinutes: 220, flags: { ...base.flags, world_event_test_noon_gun: true } });
  if (!again.aiContext.worldEvents?.length) pass('world events: delivered event never refires');
  else fail('world events: delivered event never refires');

  // WAIT delivers events its span crosses (11:00 AM + wait→noon boundary crosses 720).
  const viaWait = eng.resolve(parseIntent('wait'), { ...base, elapsedMinutes: 120 });
  if (viaWait.aiContext.worldEvents?.includes('A noon gun sounds over the river.')) {
    pass('world events: a WAIT that crosses the fire time delivers the event');
  } else {
    fail('world events: a WAIT that crosses the fire time delivers the event', JSON.stringify(viaWait.aiContext.worldEvents));
  }

  // Cross-midnight: act 0 starts 8:00 PM; the dawn event (300 < 1200) means
  // dawn NEXT DAY — it must not fire at act start, and must fire after midnight.
  const act0: SessionSnapshot = { ...base, location: 'baker_street', currentAct: 0, flags: {}, elapsedMinutes: 0 };
  const eveningTurn = eng.resolve(parseIntent('look'), act0);
  if (!eveningTurn.aiContext.worldEvents?.length) pass('world events: earlier-clock event does not fire at act start (next-day rule)');
  else fail('world events: earlier-clock event does not fire at act start (next-day rule)');
  const pastDawn = eng.resolve(parseIntent('look'), { ...act0, elapsedMinutes: 560 }); // 8PM + 9h20 = 5:20 AM
  if (pastDawn.aiContext.worldEvents?.includes('The first newsboys cry the morning edition.')) {
    pass('world events: cross-midnight event fires the next day');
  } else {
    fail('world events: cross-midnight event fires the next day', JSON.stringify(pastDawn.aiContext.worldEvents));
  }

  // Wrong act: act-2 event never fires in act 3.
  const wrongAct = eng.resolve(parseIntent('look'), { ...base, currentAct: 3, flags: { act_3_started: true }, location: 'dutfields_yard', elapsedMinutes: 300 });
  if (!wrongAct.aiContext.worldEvents?.some(t => t.includes('noon gun'))) pass('world events: act-scoped');
  else fail('world events: act-scoped');
}
testWorldEvents();
```

- [ ] **Step 2: Run to verify failure**

Run: `npx tsc --noEmit`
Expected: FAIL — `worldEvents` not on StoryManifest / NarrationContext.

- [ ] **Step 3: Implement**

(a) `engine/stories/types.ts`:

```ts
// ── World events (Phase 4a) ──────────────────────────────────────────────────
// Authored broadcasts that land in the narration as blockquotes wherever
// Watson is, once the clock passes their fire time. Narration-only — no
// world effects. Delivered-once via flag `world_event_<id>`.
export interface WorldEventDefinition {
  id: string;              // unique, snake_case
  act: number;             // only fires during this act
  atClockMinutes: number;  // clock-of-day (0-1439), e.g. 840 = 2:00 PM. A value
                           // EARLIER than the act's canonical start means the
                           // NEXT day (e.g. dawn during the act-0 night vigil).
  text: string;            // the beat itself — spoiler-guarded by qa:validate
}
```

and add to `StoryManifest` (after `facts`):

```ts
  // World events (Phase 4a)
  worldEvents: WorldEventDefinition[];
```

(b) Create `engine/stories/whitechapel-1888/events.ts`:

```ts
import type { WorldEventDefinition } from '../types';

// Authored world events — the city moving whether or not Watson is "on time".
// Narration broadcasts only (no state changes). Historical texture: 9 November
// 1888 was Lord Mayor's Day; news of the Miller's Court murder broke into the
// procession crowds. Load the historian skill before adding entries here.
export const WORLD_EVENTS: WorldEventDefinition[] = [
  {
    id: 'act1_lord_mayors_show',
    act: 1,
    atClockMinutes: 720, // noon, 9 Nov — the procession is in the City while Whitechapel mourns
    text: 'Away west, faint under the grey sky, a brass band — the Lord Mayor\'s procession winding through the City, all gilt and cheering, while this street holds its breath.',
  },
  {
    id: 'act0_midnight_bells',
    act: 0,
    atClockMinutes: 0, // midnight of the vigil — earlier than the 8:00 PM start, so it fires past midnight
    text: 'Midnight comes over London in a slow relay of church bells, each parish a half-beat behind the last, until the count dies away east over Whitechapel.',
  },
];
```

(c) `engine/stories/whitechapel-1888/manifest.ts` — `import { WORLD_EVENTS } from './events';` (extensionless, matching the file's style) and add `worldEvents: WORLD_EVENTS,` to the manifest object (after `facts: FACTS,`).

(d) `types.ts` NarrationContext — after `vignette?`:

```ts
  // World-event broadcasts fired this turn (verified, authored) — each rendered
  // as its own blockquote wherever Watson stands
  worldEvents?: string[];
```

(e) `engine/GameEngine.ts` — in `buildContext`, after the vignette block (~line 1400):

```ts
    // World events (Phase 4a) — authored broadcasts whose fire time the clock
    // has passed this act. atClockMinutes earlier than the act's start means
    // the next day (the vigil's midnight, the following dawn). Delivered
    // once via world_event_* flags, lifted onto flagsUpdate in resolve().
    const worldEventFlagsUpdate: Record<string, boolean> = {};
    const clockNow = totalMinutes; // already includes extraMinutes (WAIT spans deliver what they cross)
    const firedEvents = this.story.worldEvents
      .filter(e => e.act === act && !session.flags[`world_event_${e.id}`])
      .map(e => ({ e, fireAt: e.atClockMinutes >= actTimeCfg.canonicalMinutes ? e.atClockMinutes : e.atClockMinutes + 1440 }))
      .filter(({ fireAt }) => clockNow >= fireAt)
      .sort((a, b) => a.fireAt - b.fireAt);
    for (const { e } of firedEvents) worldEventFlagsUpdate[`world_event_${e.id}`] = true;
    const worldEvents = firedEvents.length > 0 ? firedEvents.map(({ e }) => e.text) : undefined;
```

Add `worldEvents,` to the returned context object. Stow the flags exactly like vignettes do today (GameEngine.ts:1444-1454): the return object is cast `as NarrationContext & { _introductionFlagsUpdate?: ...; _vignetteFlagsUpdate?: ...; }`. Add a third field to both the object literal and that cast type:

```ts
      // World-event once-only flags — lifted onto result.flagsUpdate in resolve()
      _worldEventFlagsUpdate: Object.keys(worldEventFlagsUpdate).length > 0
        ? worldEventFlagsUpdate
        : undefined,
    } as NarrationContext & {
      _introductionFlagsUpdate?: Record<string, boolean>;
      _vignetteFlagsUpdate?: Record<string, boolean>;
      _worldEventFlagsUpdate?: Record<string, boolean>;
    };
```

Then in `resolve()`, right after the existing `_vignetteFlagsUpdate` block (GameEngine.ts:172-175), add the matching lift — and add `_worldEventFlagsUpdate?: Record<string, boolean>;` to that block's own local cast type (line 165, alongside `_introductionFlagsUpdate`/`_vignetteFlagsUpdate`):

```ts
    if (ctxWithIntro._worldEventFlagsUpdate) {
      result.flagsUpdate = { ...result.flagsUpdate, ...ctxWithIntro._worldEventFlagsUpdate };
      delete ctxWithIntro._worldEventFlagsUpdate;
    }
```

(f) `server/aiCore.ts` — next to `clockEventSection` (line 213):

```ts
  // World-event broadcasts — authored, verified; each is its own blockquote
  const worldEventsSection = ctx.worldEvents && ctx.worldEvents.length > 0
    ? `\nWORLD EVENTS (verified — happening in the city right now; render EACH as its own Markdown blockquote line formatted "> *…*", light polish only, keep content intact; they reach Watson as sound, news, or commotion wherever he stands):\n${ctx.worldEvents.map(t => `• ${t}`).join('\n')}\n`
    : '';
```

and append `${worldEventsSection}` into BOTH template interpolation lines (294 and 314), directly after `${clockEventSection}`.

(g) `scripts/qa-validate.ts` — new section:

```ts
import { WORLD_EVENTS } from '../engine/stories/whitechapel-1888/events';
import { ACT_TIME_CONFIG } from '../engine/stories/whitechapel-1888/acts';

section('World events (Phase 4a)');
{
  const seen = new Set<string>();
  for (const ev of WORLD_EVENTS) {
    if (seen.has(ev.id)) fail(`world event "${ev.id}": duplicate id`);
    seen.add(ev.id);
    if (!ACT_TIME_CONFIG[ev.act]) fail(`world event "${ev.id}": act ${ev.act} has no time config`);
    if (ev.atClockMinutes < 0 || ev.atClockMinutes > 1439) fail(`world event "${ev.id}": atClockMinutes ${ev.atClockMinutes} out of range`);
    if (!ev.text.trim()) fail(`world event "${ev.id}": empty text`);
  }
  pass(`${WORLD_EVENTS.length} world events structurally valid`);
}
```

Then locate the existing spoiler-guard section (search `qa-validate.ts` for the killer-name / `prasarved` checks used on fact statements) and run each `ev.text` through the same forbidden-terms check, FAILing on a hit.

- [ ] **Step 4: Verify green**

Run: `npx tsc --noEmit && npm run qa:engine && npm run qa:validate`
Expected: all PASS, including the new world-events section and the spoiler guard over the two authored events.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: world-event broadcasts — authored city beats on the clock (Phase 4a)"
```

---

### Task 6: `wait` in the tool-call parser + qa:parser fixtures

**Files:**
- Modify: `server/parseAction.ts` (buildParseTools + toolCallToIntent)
- Modify: `scripts/qa-parser.ts` (fast-path guard + intent fixtures)

**Interfaces:**
- Consumes: `IntentType 'wait'` (Task 2).
- Produces: `wait` tool (no parameters) in the parseAction function declarations; `toolCallToIntent('wait', …) → { type: 'wait' }`.

- [ ] **Step 1: Write failing offline checks**

In `scripts/qa-parser.ts`:

(a) In `runFastPathGuard()`, after check 3:

```ts
  // 3b. WAIT is a free offline verb — it must parse deterministically and
  //     never route to the AI parse.
  const w = parseIntent('wait');
  if (w.type !== 'wait' || needsAiParse(w, 'baker_street', [])) {
    console.error('  [FAIL] wait did not stay on the offline fast path');
    failures++;
  }
```

(b) In `runToolCallValidationChecks()`, add a synthetic call using the function's existing `check()` helper, next to the `deduce` check (line ~336):

```ts
  r = toolCallToIntent('wait', {}, C, 'let us bide here until evening');
  check('wait → wait intent', r.intent?.type === 'wait' && !r.invalidArgs);
```

(c) In `INTENT_FIXTURES`, add two whole-command fixtures:

```ts
  // wait — offline (bare verb) and via AI (paraphrase the regex can't catch)
  { scene: { location: 'whitechapel_mortuary', act: 2 }, input: 'wait',
    expect: { type: 'wait' } },
  { scene: { location: 'whitechapel_mortuary', act: 2 }, input: 'we shall cool our heels until the doctor returns',
    expect: { type: 'wait' } },
```

Check `intentMatches` (qa-parser.ts:418) handles an `expect` with no `targetId` — if it requires one, extend it to treat a missing `expect.targetId` as "don't care".

- [ ] **Step 2: Run offline tiers to verify the red state**

Run: `npm run qa:parser` (no key)
Expected: the new fast-path check PASSES already (Task 2 shipped the parser verb) but the tool-call validation FAILS (`wait` is an unknown tool → `invalidArgs`). That failure is the red state.

- [ ] **Step 3: Implement**

(a) `server/parseAction.ts` — in `buildParseTools`, before the `deduce` declaration:

```ts
  decls.push({
    name: 'wait',
    description: 'Wait, linger, or pass the time until things change (the next part of the day).',
    parameters: { type: Type.OBJECT, properties: {} },
  });
```

(b) In `toolCallToIntent`, before `case 'deduce'`:

```ts
    case 'wait':
      return ok({ type: 'wait', raw: rawInput });
```

- [ ] **Step 4: Verify — offline then live**

Run: `npm run qa:parser` (offline tiers) — expected: all green.
Run with the key (ask the user for it if not in the environment): `GEMINI_API_KEY=… npm run qa:parser` — expected: the two new intent fixtures pass in the live tier (the paraphrase one via the AI path), zero enum failures. If the paraphrase fixture proves flaky against live Gemini, apply the corpus's existing convention (see the act-bump/reclassification notes in its comments): reword or reclassify with a comment — do not delete it silently.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: wait verb in the tool-call parse path + qa:parser fixtures (Phase 4a)"
```

---

### Task 7: Gate guard-rail validator + authored schedules, hours, and events

The behavior-changing data commit — everything before this shipped machinery with parity data.

**Files:**
- Modify: `scripts/qa-validate.ts` (gate-NPC rule)
- Modify: `engine/stories/whitechapel-1888/npcs.ts` (byPeriod overrides), `locations.ts` (openPeriods + lockedNotes), `events.ts` (more events)

**Interfaces:**
- Consumes: everything above. No new interfaces produced.

- [ ] **Step 1: Write the guard-rail validator FIRST**

Append to `scripts/qa-validate.ts` (import `computeTimePeriod` from `../engine/GameEngine`):

```ts
section('Schedule guard rail: gate NPCs findable at act start (Phase 4a)');
{
  // Every NPC whose conversation gates an act must be at their schedule
  // default during that act's canonical-start period — a player following a
  // hint straight there always finds them. Followers are exempt (they are
  // wherever Watson is).
  let checked = 0;
  for (const [actStr, cond] of Object.entries(ACT_PROGRESSION)) {
    const act = Number(actStr);
    const startPeriod = computeTimePeriod(ACT_TIME_CONFIG[act].canonicalMinutes);
    for (const flag of cond.requireFlags) {
      if (!flag.startsWith('talked_to_')) continue;
      // Disambiguate npc id vs location id by prefix-matching known npc ids.
      const npcId = [...npcIds].find(id => flag.startsWith(`talked_to_${id}_at_`));
      if (!npcId) continue; // unreachable-flag check already covers this
      const locId = flag.slice(`talked_to_${npcId}_at_`.length);
      const npc = NPCS[npcId];
      if (npc.followsNpcId) continue;
      const sched = npc.scheduleByAct[act];
      const atStart = sched ? (sched.byPeriod?.[startPeriod] ?? sched.default) : undefined;
      checked++;
      if (atStart !== locId) {
        fail(`gate NPC ${npcId} (act ${act}): scheduled at "${atStart}" during the act's start period (${startPeriod}), but the gate needs them at "${locId}"`);
      }
    }
  }
  pass(`${checked} act-gate NPC placements verified against schedules`);
}
```

Run: `npm run qa:validate` — expected: PASS on parity data (defaults already equal the gate locations). This rule now gates every authored override below.

- [ ] **Step 2: Author the living-world data**

**Load the `historian` and `game-direction` skills before writing any of this content** (both are auto-load skills for exactly this work). Constraints, which the validators enforce:

- `byPeriod` overrides only move NPCs during periods AWAY from the act's canonical-start period (the guard rail fails otherwise for gate NPCs).
- Every `openPeriods` needs a `lockedNote` with in-period prose; `keyholderNpcId` must resolve.
- Event text: no killer identity, no 'prasarved', nothing post-dated (spoiler guard + historian accuracy).

Authoring slate (adjust prose freely; structure is fixed). NPCs:

```ts
// abberline — a policeman's day ends at the pub across from the station
// (acts 0 and 2, where his default is h_division_station):
scheduleByAct: {
  0: { default: 'h_division_station', byPeriod: { night: 'whitechapel_pub', lateNight: 'whitechapel_pub' } },
  1: { default: 'dorset_street' },
  2: { default: 'h_division_station', byPeriod: { evening: 'whitechapel_pub' } },
  ...
},
// bond — the mortuary keeps visiting hours; evenings he is at his office:
2: { default: 'whitechapel_mortuary', byPeriod: { evening: 'bond_office', night: 'bond_office', lateNight: 'bond_office' } },
3: { default: 'whitechapel_mortuary', byPeriod: { evening: 'bond_office', night: 'bond_office', lateNight: 'bond_office' } },
// phillips — same pattern as bond for acts 2-3 (police surgeon, day shifts):
2: { default: 'whitechapel_mortuary', byPeriod: { night: 'whitechapel_pub', lateNight: 'whitechapel_pub' } },
// hutchinson — a night-lodger: daytime at the pub, evenings on Dorset Street (act 2-3 default whitechapel_pub stays; act 1 default dorset_street stays for the gate).
```

Leave `holmes` (follower), `lusk`, `diemschutz`, `superintendent`, `tumblety` (cell), `pizer`, `edmund` (follower/act-6 asylum) without overrides — their fixed presence is characterful. Locations:

```ts
whitechapel_mortuary: {
  ...,
  openPeriods: ['morning', 'afternoon'],
  lockedNote: {
    text: 'The mortuary door is bolted fast; a smudged card behind the glass gives the visiting hours as morning and afternoon.',
    keyholderNpcId: 'phillips',
  },
},
h_division_station stays open (a police station never closes).
bond_office: openPeriods ['morning', 'afternoon', 'evening'], lockedNote text about the surgery's brass plate and drawn curtains, keyholderNpcId 'bond'.
```

**Cross-check before committing:** the shortest-path walkthrough (`docs/walkthrough-shortest-path.md`) must remain playable without ever hitting a locked door or absent gate NPC — each act starts morning/afternoon (act 0 evening, act 6 afternoon: verify none of its gate locations get openPeriods excluding those). Do NOT give `private_asylum`, `lusk_office`, or any act-anchor location opening hours.

Events — add 3–5 more with the historian skill, e.g.:

```ts
{ id: 'act2_church_bells', act: 2, atClockMinutes: 660, text: '…Sunday service lets out…' },   // 11 Nov was a Sunday
{ id: 'act4_newsboys_tumblety', act: 4, atClockMinutes: 780, text: '…an afternoon edition cries the American doctor\'s flight…' }, // 17 Nov: Tumblety jumped bail mid-Nov
{ id: 'act5_lamplighters', act: 5, atClockMinutes: 1020, text: '…the lamplighters working up the street as the fog thickens…' },
```

- [ ] **Step 3: Verify green + play a schedule beat**

Run: `npx tsc --noEmit && npm run qa:validate && npm run qa:engine && npm run qa:hints && npm run qa:diary-leads`
Expected: all PASS — especially the guard rail and spoiler guard over the new data.

Then add one integration test to `scripts/qa-engine.ts` pinning a real authored beat (adjust to the data actually authored):

```ts
// Authored schedule smoke: in act 2, Bond leaves the mortuary come evening.
function testAuthoredSchedules() {
  const morning = npcLocationAt(NPCS, 'bond', 2, 'morning', {});
  const evening = npcLocationAt(NPCS, 'bond', 2, 'evening', {});
  if (morning === 'whitechapel_mortuary' && evening === 'bond_office') {
    pass('authored schedule: Bond keeps mortuary hours in act 2');
  } else {
    fail('authored schedule: Bond keeps mortuary hours in act 2', `${morning} / ${evening}`);
  }
}
testAuthoredSchedules();
```

Run: `npm run qa:engine` — expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: authored schedules, opening hours, and world events + gate guard rail (Phase 4a)"
```

---

### Task 8: Full regression sweep + roadmap note

**Files:**
- Modify: memory `rebuild-roadmap.md` (progress note)

- [ ] **Step 1: Full offline suite**

Run: `npx tsc --noEmit && npm run qa:validate && npm run qa:engine && npm run qa:hints && npm run qa:diary-leads && npm run qa:parser`
Expected: everything green (qa:parser offline tiers; run the live tier too if the key is available).

- [ ] **Step 2: Reviewer pass**

Dispatch the `engine-logic-reviewer` agent (engine/ changed heavily) and the `narrative-consistency-reviewer` agent (npcs.ts / locations.ts / events.ts changed). Address Critical/Important findings.

- [ ] **Step 3: Update the roadmap memory**

Append a Phase 4a progress paragraph to the user-memory file `rebuild-roadmap.md` (branch, PR, what shipped, cutover notes), converting relative dates to absolute.

- [ ] **Step 4: Finish the branch**

Use the superpowers:finishing-a-development-branch skill (merge/PR decision belongs to the user).

---

## Self-Review Notes (already applied)

- **Spec coverage:** schedules (T1), WAIT (T2), opening hours (T3), diegetic redirects (T4), world events (T5), parser surface (T2+T6), guard rail + authoring (T7), no-regression gate (every task + T8). The spec's "skip when the act starts late" rule is implemented as the strictly-better next-day rule (an `atClockMinutes` before the act's start means the following day — covers the act-0 vigil's midnight/dawn correctly); T5's tests pin it.
- **Type consistency:** `scheduleByAct` / `npcLocationAt(npcs, npcId, act, timePeriod, npcStates)` / `timePeriodFor(actTimeConfig, act, elapsedMinutes)` / `minutesAdvanced` / `extraMinutes` / `worldEvents` are used with identical shapes across tasks.
- **Known judgment call (surfaced in design, restated for implementers):** for non-follower NPCs the schedule now beats a stored `npcStates.currentLocation`; `computeNpcMovements` keeps writing schedule positions so hook-side consumers stay roughly synced, but presence never reads the stale value. Follower NPCs keep stored-wins (Holmes must stay with Watson).
