# Phase 4b — Rumor Propagation (M1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an engine-visible reveal fires (e.g. `showed_from_hell_letter_to_bond`), the knowledge spreads to other NPCs after an authored TimePeriod delay as hearsay-worded envelope statements, and the first TALK with an NPC who has heard it gets a one-shot narration nudge so they raise it unprompted.

**Architecture:** Fully-authored rumor table (`rumors.ts`) — no social graph. One new piece of session state: a rumor-event log `Record<rumorId, {act, atMinutes}>` recording when each trigger flag first fired; everything downstream (maturity, envelopes, nudges) is derived per turn. Once-only nudges use boolean `rumor_ack_<rumorId>_<npcId>` flags on the existing flags channel. No AI call anywhere in the mechanism.

**Tech Stack:** TypeScript (Vite client + tsx QA scripts), Supabase (one additive jsonb column), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-05-phase4b-rumor-propagation-design.md`

## Global Constraints

- `npm run lint` (tsc --noEmit), `npm run qa:validate`, and `npm run qa:engine` must pass after every task. All are offline — no API key needed.
- No new npm dependencies.
- Engine resolves / AI narrates: the mechanism makes zero AI calls; the AI only receives already-derived statements.
- The killer's name is "Halward" — it must NEVER appear in any rumor statement (validator hard-FAIL, same as facts/world-events).
- The smoking-gun misspelling "prasarved" must never be introduced into rumor statements either (it would trip the AI into leaking the letter's key detail as hearsay).
- Flag naming: ack flags are `rumor_ack_<rumorId>_<npcId>`. Log keys are the rumor `id`.
- Old-save compatibility: the rumor-event log defaults to `{}` at every read site (React state init, local-save load, cloud load, Supabase mapper). No data backfill.
- ESM note: story files under `engine/stories/whitechapel-1888/` use extensionless relative imports (they are NOT in the AI gateway's server import graph — `manifest.ts` already value-imports `./events` extensionless). Match that style. Do NOT add imports of story data into `api/*.ts` or `server/*.ts`.
- Commit messages: conventional-commit style with the phase suffix, e.g. `feat: rumor table + validator rules (Phase 4b)`.
- Time model facts (from GameEngine.ts): `computeTimePeriod` boundaries are `[300, 420, 720, 1020, 1200, 1380]` minutes; `totalMinutes = actTimeConfig[act].canonicalMinutes + elapsedMinutes` and may exceed 1440 (next day); `PERIOD_ORDER = ['dawn','morning','afternoon','evening','night','lateNight']`.

---

### Task 1: RumorDefinition type, fixture data, manifest field, validator rules

**Files:**
- Modify: `engine/stories/types.ts` (add `RumorDefinition` after `WorldEventDefinition` ~line 124; add `rumors` to `StoryManifest` after `worldEvents` ~line 300)
- Create: `engine/stories/whitechapel-1888/rumors.ts`
- Modify: `engine/stories/whitechapel-1888/manifest.ts` (import + wire `rumors`)
- Test: `scripts/qa-validate.ts` (new section after the Phase 4a sections, ~line 515)

**Interfaces:**
- Produces: `RumorDefinition { id: string; triggerFlag: string; spread: Array<{ npcId: string; delayPeriods: number; statement: string }> }` exported from `engine/stories/types.ts`; `StoryManifest.rumors: RumorDefinition[]`; `RUMORS: RumorDefinition[]` exported from `engine/stories/whitechapel-1888/rumors.ts` containing exactly two fixture rumors with ids `bond_saw_the_letter` and `abberline_saw_the_letter`.

- [ ] **Step 1: Write the failing validator section**

In `scripts/qa-validate.ts`, after the `section('Schedule guard rail: ...')` block (~line 516 onward, before the final summary), add:

```ts
// ── Rumors (Phase 4b) ────────────────────────────────────────────────────────

section('Rumors (Phase 4b)');
{
  // The corpus of trigger flags the engine can actually set. A typo'd trigger
  // silently kills the rumor forever, so unknown patterns are a hard FAIL.
  const settableFlags = new Set<string>();
  for (const [objId, byNpc] of Object.entries(SHOW_INTERACTIONS)) {
    for (const npcId of Object.keys(byNpc)) settableFlags.add(`showed_${objId}_to_${npcId}`);
  }
  for (const cond of Object.values(ACT_PROGRESSION)) {
    for (const f of cond.requireFlags) settableFlags.add(f);
  }
  const talkFlagRe = /^talked_to_([a-z_]+?)_at_([a-z_]+)$/;

  const seenIds = new Set<string>();
  for (const r of RUMORS) {
    if (seenIds.has(r.id)) fail(`rumor id "${r.id}" is duplicated`);
    seenIds.add(r.id);

    // Trigger must be a flag the engine can set.
    const talkMatch = r.triggerFlag.match(talkFlagRe);
    const talkOk = talkMatch && npcIds.has(talkMatch[1]) && locationIds.has(talkMatch[2]);
    if (!settableFlags.has(r.triggerFlag) && !talkOk) {
      fail(`rumor "${r.id}" trigger "${r.triggerFlag}" matches no settable flag`,
        'must be a showed_<objectId>_to_<npcId> pair from SHOW_INTERACTIONS, an ACT_PROGRESSION requireFlag, or talked_to_<npcId>_at_<locationId> with both ids resolving');
    }

    if (r.spread.length === 0) fail(`rumor "${r.id}" has an empty spread list`);
    for (const s of r.spread) {
      if (!npcIds.has(s.npcId)) fail(`rumor "${r.id}" spreads to unknown NPC "${s.npcId}"`);
      if (!Number.isInteger(s.delayPeriods) || s.delayPeriods < 0 || s.delayPeriods > 8) {
        fail(`rumor "${r.id}" → ${s.npcId} has delayPeriods ${s.delayPeriods}`, 'must be an integer 0–8');
      }
      if (/halward/i.test(s.statement)) {
        fail(`rumor "${r.id}" → ${s.npcId} statement names Halward`, 'rumor statements enter envelopes unconditionally once matured — the killer\'s name can never ride one');
      }
      if (/prasarved/i.test(s.statement)) {
        fail(`rumor "${r.id}" → ${s.npcId} statement contains "prasarved"`, 'the smoking-gun detail must never spread as hearsay');
      }
    }
  }
  if (fails === 0) pass(`${RUMORS.length} rumors: ids unique, triggers settable, recipients resolve, statements spoiler-clean`);
}
```

Note: `npcIds`, `locationIds`, `SHOW_INTERACTIONS`, `ACT_PROGRESSION`, `section`, `pass`, `fail` all already exist in this file. Guard the final `pass` line the same way neighboring sections do if `fails` was already nonzero before this section — simplest correct form: capture `const failsBefore = fails;` at the top of the block and emit `pass(...)` when `fails === failsBefore`. Use that form.

Add the import at the top with the other whitechapel imports:

```ts
import { RUMORS } from '../engine/stories/whitechapel-1888/rumors';
```

- [ ] **Step 2: Run validator to verify it fails**

Run: `npm run qa:validate`
Expected: FAIL to even start — `Cannot find module '../engine/stories/whitechapel-1888/rumors'` (tsx module-resolution error).

- [ ] **Step 3: Add the type, the fixture data, and the manifest field**

In `engine/stories/types.ts`, directly after the `WorldEventDefinition` interface (~line 124):

```ts
// ── Rumor propagation (Phase 4b) ─────────────────────────────────────────────
// Fully-authored knowledge spread: when triggerFlag first fires, each spread
// entry's statement enters that NPC's knowledge envelope after delayPeriods
// TimePeriod boundaries (0 = same period; any act transition matures all).
// Every hop is authored — recipient, delay, and hearsay wording — so the
// spoiler surface stays a static list (see the 2a dedupe finding: shared
// statement text across NPC voices does not work in this story).
export interface RumorDefinition {
  id: string;                 // unique, snake_case; key in the session rumor-event log
  triggerFlag: string;        // engine-set flag, e.g. 'showed_from_hell_letter_to_bond'
  spread: Array<{
    npcId: string;            // recipient
    delayPeriods: number;     // TimePeriod boundaries after the trigger (integer 0–8)
    statement: string;        // hearsay-worded line, authored per recipient
  }>;
}
```

In `StoryManifest` (same file), after `worldEvents: WorldEventDefinition[];`:

```ts
  // Rumor propagation (Phase 4b)
  rumors: RumorDefinition[];
```

Create `engine/stories/whitechapel-1888/rumors.ts`:

```ts
import type { RumorDefinition } from '../types';

// Authored rumor spread — Phase 4b. Every hop is hand-written hearsay in the
// recipient's register; nothing auto-propagates. Trigger flags must be
// engine-settable (qa:validate enforces the corpus). Load the historian and
// narration-voice-check skills before authoring new entries.
export const RUMORS: RumorDefinition[] = [
  // Fixture pair for the engine test suite — real triggers, modest content.
  // The curated Phase 4b set extends/reworks these in a data-only commit.
  {
    id: 'bond_saw_the_letter',
    triggerFlag: 'showed_from_hell_letter_to_bond',
    spread: [
      {
        npcId: 'phillips',
        delayPeriods: 1,
        statement: 'Has heard through the mortuary men that Dr. Bond was shown the Lusk letter itself by the doctor from Baker Street — and that Bond went very quiet over one passage of it',
      },
    ],
  },
  {
    id: 'abberline_saw_the_letter',
    triggerFlag: 'showed_from_hell_letter_to_abberline',
    spread: [
      {
        npcId: 'lusk',
        delayPeriods: 0,
        statement: 'Committee men at the station say Dr. Watson carries a full transcript of the From Hell letter and has been putting it in front of the police',
      },
    ],
  },
];
```

In `engine/stories/whitechapel-1888/manifest.ts`: add `import { RUMORS } from './rumors';` next to the `WORLD_EVENTS` import, and in the `WHITECHAPEL_MANIFEST` object literal add `rumors: RUMORS,` directly after `worldEvents: WORLD_EVENTS,`.

- [ ] **Step 4: Run validator and lint to verify green**

Run: `npm run qa:validate && npm run lint`
Expected: new section prints `[PASS] 2 rumors: ids unique, triggers settable, recipients resolve, statements spoiler-clean`; exit 0 on both.

Also sanity-check the validator catches breakage: temporarily change `'phillips'` to `'phillipss'` in rumors.ts, run `npm run qa:validate`, expect `[FAIL] rumor "bond_saw_the_letter" spreads to unknown NPC "phillipss"` and exit 1. Revert.

- [ ] **Step 5: Commit**

```bash
git add engine/stories/types.ts engine/stories/whitechapel-1888/rumors.ts engine/stories/whitechapel-1888/manifest.ts scripts/qa-validate.ts
git commit -m "feat: rumor table, manifest field, and validator rules (Phase 4b)"
```

---

### Task 2: Maturity math — `periodBoundariesCrossed` + `maturedSpreadsFor`

**Files:**
- Modify: `types.ts` (root — add `RumorEvents` near `TimePeriod`, ~line 2)
- Modify: `engine/GameEngine.ts` (time-helpers section, after `minutesToNextPeriodBoundary` ~line 45)
- Test: `scripts/qa-engine.ts` (new section at the end, before the summary/exit block)

**Interfaces:**
- Consumes: `RumorDefinition` from Task 1.
- Produces (all exported):
  - `types.ts`: `export type RumorEvents = Record<string, { act: number; atMinutes: number }>;`
  - `GameEngine.ts`: `export function periodBoundariesCrossed(fromMinutes: number, toMinutes: number): number` — boundaries strictly after `fromMinutes` up to and including `toMinutes`, day-wrap aware; returns 0 when `toMinutes <= fromMinutes`.
  - `GameEngine.ts`: `export function maturedSpreadsFor(rumors: RumorDefinition[], rumorEvents: RumorEvents, npcId: string, act: number, totalMinutes: number): Array<{ rumorId: string; statement: string }>` — matured spread entries for this NPC, in rumor-file order.

- [ ] **Step 1: Write the failing tests**

At the end of `scripts/qa-engine.ts` (before the final summary block that prints totals and exits), add — and extend the GameEngine import line at the top with `periodBoundariesCrossed, maturedSpreadsFor`, plus `import type { RumorDefinition } from '../engine/stories/types';` and `import type { RumorEvents } from '../types';`:

```ts
// ── Phase 4b: rumor maturity math ────────────────────────────────────────────

console.log('\n── Phase 4b: rumor maturity math ──────────────────────────────');
{
  // Boundaries are [300, 420, 720, 1020, 1200, 1380].
  periodBoundariesCrossed(600, 600) === 0
    ? pass('boundaries: zero span crosses nothing')
    : fail('boundaries: zero span', String(periodBoundariesCrossed(600, 600)));
  periodBoundariesCrossed(600, 700) === 0
    ? pass('boundaries: within one period crosses nothing')
    : fail('boundaries: within period', String(periodBoundariesCrossed(600, 700)));
  periodBoundariesCrossed(600, 720) === 1
    ? pass('boundaries: landing exactly on a boundary counts it')
    : fail('boundaries: exact landing', String(periodBoundariesCrossed(600, 720)));
  periodBoundariesCrossed(600, 1250) === 3   // 720, 1020, 1200
    ? pass('boundaries: multi-period span counts each edge')
    : fail('boundaries: multi-period', String(periodBoundariesCrossed(600, 1250)));
  periodBoundariesCrossed(1390, 1750) === 1  // only 300+1440=1740 (dawn next day)
    ? pass('boundaries: lateNight→dawn wraps midnight correctly')
    : fail('boundaries: midnight wrap', String(periodBoundariesCrossed(1390, 1750)));
  periodBoundariesCrossed(600, 600 + 1440) === 6
    ? pass('boundaries: a full day crosses all six')
    : fail('boundaries: full day', String(periodBoundariesCrossed(600, 2040)));

  const TEST_RUMORS: RumorDefinition[] = [
    { id: 'r1', triggerFlag: 'f1', spread: [
      { npcId: 'phillips', delayPeriods: 1, statement: 'S-PHILLIPS' },
      { npcId: 'lusk',     delayPeriods: 0, statement: 'S-LUSK' },
    ]},
    { id: 'r2', triggerFlag: 'f2', spread: [
      { npcId: 'phillips', delayPeriods: 3, statement: 'S-PHILLIPS-2' },
    ]},
  ];
  const events: RumorEvents = { r1: { act: 2, atMinutes: 600 }, r2: { act: 2, atMinutes: 600 } };

  const none = maturedSpreadsFor(TEST_RUMORS, {}, 'phillips', 2, 9999);
  none.length === 0
    ? pass('maturity: no recorded event → nothing matured')
    : fail('maturity: empty log', JSON.stringify(none));

  const samePeriod = maturedSpreadsFor(TEST_RUMORS, events, 'lusk', 2, 610);
  samePeriod.length === 1 && samePeriod[0].statement === 'S-LUSK'
    ? pass('maturity: delayPeriods 0 matures within the same period')
    : fail('maturity: delay 0', JSON.stringify(samePeriod));

  const tooSoon = maturedSpreadsFor(TEST_RUMORS, events, 'phillips', 2, 700);
  tooSoon.length === 0
    ? pass('maturity: delayPeriods 1 not yet matured before the boundary')
    : fail('maturity: too soon', JSON.stringify(tooSoon));

  const after1 = maturedSpreadsFor(TEST_RUMORS, events, 'phillips', 2, 730);
  after1.length === 1 && after1[0].rumorId === 'r1'
    ? pass('maturity: delayPeriods 1 matures after one boundary; delay 3 still pending')
    : fail('maturity: after one boundary', JSON.stringify(after1));

  const crossAct = maturedSpreadsFor(TEST_RUMORS, events, 'phillips', 3, 0);
  crossAct.length === 2
    ? pass('maturity: act transition matures everything regardless of clock')
    : fail('maturity: cross-act', JSON.stringify(crossAct));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run qa:engine`
Expected: tsx type/module error — `periodBoundariesCrossed` and `maturedSpreadsFor` are not exported from `../engine/GameEngine`.

- [ ] **Step 3: Implement the helpers**

In root `types.ts`, after the `TimePeriod` type (~line 2):

```ts
// Phase 4b — session rumor-event log: when each rumor's trigger flag first
// fired. atMinutes is the act's canonical start + elapsed minutes (may exceed
// 1440 on next-day clocks). Old saves lack this — default {} at every reader.
export type RumorEvents = Record<string, { act: number; atMinutes: number }>;
```

In `engine/GameEngine.ts`, add `RumorEvents` to the existing `../types` import and `RumorDefinition` to the existing `./stories/types` type import. Then, after `minutesToNextPeriodBoundary` (~line 45):

```ts
/**
 * How many TimePeriod boundaries lie strictly after `fromMinutes`, up to and
 * including `toMinutes`. Day-wrap aware (minutes may exceed 1440). 0 when the
 * span is empty or negative.
 */
export function periodBoundariesCrossed(fromMinutes: number, toMinutes: number): number {
  const BOUNDARIES = [300, 420, 720, 1020, 1200, 1380];
  if (toMinutes <= fromMinutes) return 0;
  const span = toMinutes - fromMinutes;
  let count = Math.floor(span / 1440) * BOUNDARIES.length;
  const fromM = fromMinutes % 1440;
  const toM = fromM + (span % 1440);
  for (const b of BOUNDARIES) {
    if (b > fromM && b <= toM) count++;
    if (b + 1440 > fromM && b + 1440 <= toM) count++;
  }
  return count;
}

/**
 * Matured rumor-spread entries for one NPC (Phase 4b): every authored spread
 * hop whose rumor has fired and whose delay has elapsed. An act transition
 * matures everything (act gaps span days); within the trigger's act, maturity
 * is delayPeriods TimePeriod boundaries after the recorded trigger time.
 * Rumor-file order — callers prepend these to the knowledge envelope.
 */
export function maturedSpreadsFor(
  rumors: RumorDefinition[],
  rumorEvents: RumorEvents,
  npcId: string,
  act: number,
  totalMinutes: number,
): Array<{ rumorId: string; statement: string }> {
  const out: Array<{ rumorId: string; statement: string }> = [];
  for (const r of rumors) {
    const ev = rumorEvents[r.id];
    if (!ev || act < ev.act) continue;
    for (const s of r.spread) {
      if (s.npcId !== npcId) continue;
      const matured =
        act > ev.act ||
        periodBoundariesCrossed(ev.atMinutes, totalMinutes) >= s.delayPeriods;
      if (matured) out.push({ rumorId: r.id, statement: s.statement });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run qa:engine && npm run lint`
Expected: all new `Phase 4b: rumor maturity math` labels PASS; zero FAIL overall; lint clean.

- [ ] **Step 5: Commit**

```bash
git add types.ts engine/GameEngine.ts scripts/qa-engine.ts
git commit -m "feat: rumor maturity derivation helpers + boundary math (Phase 4b)"
```

---

### Task 3: Trigger recording — session log in, `rumorEventsUpdate` out

**Files:**
- Modify: `engine/GameEngine.ts` (`SessionSnapshot` ~line 126; `resolve()` tail ~line 268, after the `_worldEventFlagsUpdate` lift)
- Modify: `types.ts` (root — `EngineResult`, after `flagsUpdate` ~line 193)
- Test: `scripts/qa-engine.ts` (`buildSnapshot` helper + new section)

**Interfaces:**
- Consumes: `RumorEvents` (Task 2), `StoryManifest.rumors` (Task 1).
- Produces: `SessionSnapshot.rumorEvents: RumorEvents` (required field — QA scripts and the hook construct snapshots); `EngineResult.rumorEventsUpdate?: RumorEvents` (entries to MERGE into the session log; only newly-recorded rumors appear).

- [ ] **Step 1: Write the failing tests**

In `scripts/qa-engine.ts`: add `rumorEvents: {},` to the object literal in `buildSnapshot` (this fixes the compile break the moment the field lands), and in the `applyResult` helper add the merge line `rumorEvents: { ...snap.rumorEvents, ...(result.rumorEventsUpdate ?? {}) },` next to its `flags` merge — so walkthrough-style tests carry the log forward the way the hook does. Then append a new section:

```ts
// ── Phase 4b: rumor trigger recording ────────────────────────────────────────

console.log('\n── Phase 4b: rumor trigger recording ──────────────────────────');
{
  // Real fixture rumor: showing the From Hell letter to Bond (act 5, Bond at
  // bond_office per his schedule default) must record bond_saw_the_letter.
  const period5 = timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, 5, 0);
  const bondLoc = npcLocationAt(NPCS, 'bond', 5, period5, { ...INITIAL_NPC_STATES });
  const showIntent = {
    type: 'show' as const,
    targetId: 'from_hell_letter',
    showTargetNpcId: 'bond',
    targetRaw: 'letter',
    raw: 'show the letter to bond',
  };
  const snap = buildSnapshot({
    currentAct: 5,
    location: bondLoc,
    inventory: ['From Hell Letter (transcript)'],
  });
  const r = gameEngine.resolve(showIntent, snap);
  const ev = r.rumorEventsUpdate?.['bond_saw_the_letter'];
  ev && ev.act === 5 && ev.atMinutes === WHITECHAPEL_MANIFEST.actTimeConfig[5].canonicalMinutes
    ? pass('trigger: show-to-bond records the rumor event at the current clock')
    : fail('trigger: recording', JSON.stringify(r.rumorEventsUpdate));

  // Already recorded → never re-recorded (re-show does not reset the clock).
  const snap2 = buildSnapshot({
    currentAct: 5,
    location: bondLoc,
    inventory: ['From Hell Letter (transcript)'],
    flags: { showed_from_hell_letter_to_bond: true },
    rumorEvents: { bond_saw_the_letter: { act: 5, atMinutes: 600 } },
  });
  const r2 = gameEngine.resolve(showIntent, snap2);
  r2.rumorEventsUpdate === undefined
    ? pass('trigger: an already-recorded rumor is never re-recorded')
    : fail('trigger: re-record guard', JSON.stringify(r2.rumorEventsUpdate));

  // Self-healing for old saves: flag already true but log empty → records now.
  const snap3 = buildSnapshot({
    currentAct: 5,
    location: bondLoc,
    flags: { showed_from_hell_letter_to_bond: true },
  });
  const look = parseIntent('look around');
  const r3 = gameEngine.resolve(look, snap3);
  r3.rumorEventsUpdate?.['bond_saw_the_letter']
    ? pass('trigger: pre-4b save with the flag set records on the next turn')
    : fail('trigger: self-healing', JSON.stringify(r3.rumorEventsUpdate));

  // Unrelated turns stay silent.
  const r4 = gameEngine.resolve(look, buildSnapshot({}));
  r4.rumorEventsUpdate === undefined
    ? pass('trigger: unrelated turn emits no rumorEventsUpdate')
    : fail('trigger: silence', JSON.stringify(r4.rumorEventsUpdate));
}
```

Note: `timePeriodFor`, `npcLocationAt`, `NPCS`, `WHITECHAPEL_MANIFEST`, `INITIAL_NPC_STATES`, `parseIntent`, `buildSnapshot` are all already imported/defined in this file. The inventory string `'From Hell Letter (transcript)'` is `TAKEABLE_OBJECTS['from_hell_letter']` verbatim.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run qa:engine`
Expected: compile error — `rumorEvents` does not exist on `SessionSnapshot` / `rumorEventsUpdate` does not exist on `EngineResult`.

- [ ] **Step 3: Implement**

Root `types.ts`, inside `EngineResult` after `flagsUpdate?: Record<string, boolean>;`:

```ts
  // Phase 4b — rumor-event log entries recorded this turn (merge into the
  // session log; a rumor records at most once per playthrough).
  rumorEventsUpdate?: RumorEvents;
```

`engine/GameEngine.ts`, `SessionSnapshot` (after `locationVisitCounts`):

```ts
  // Phase 4b — when each rumor's trigger flag first fired (see RumorEvents)
  rumorEvents: RumorEvents;
```

`engine/GameEngine.ts`, in `resolve()` directly after the `_worldEventFlagsUpdate` lift block (~line 268) and before `return result;`:

```ts
    // Rumor trigger recording (Phase 4b): the first turn a rumor's trigger
    // flag is true (whether set this turn or inherited from a pre-4b save)
    // with no log entry starts that rumor's clock. Runs AFTER buildContext,
    // so a delayPeriods-0 hop can never nudge on the very turn it fires.
    const mergedForRumors = { ...session.flags, ...(result.flagsUpdate ?? {}) };
    let rumorEventsUpdate: RumorEvents | undefined;
    for (const rumor of this.story.rumors) {
      if (mergedForRumors[rumor.triggerFlag] && !session.rumorEvents[rumor.id]) {
        const cfg = this.story.actTimeConfig[session.currentAct] ?? this.story.actTimeConfig[1];
        (rumorEventsUpdate ??= {})[rumor.id] = {
          act: session.currentAct,
          atMinutes: cfg.canonicalMinutes + session.elapsedMinutes,
        };
      }
    }
    if (rumorEventsUpdate) result.rumorEventsUpdate = rumorEventsUpdate;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run qa:engine && npm run lint && npm run qa:validate`
Expected: all four new `trigger:` labels PASS; zero FAIL; lint clean. (`hooks/useGameState.ts` does not compile-break yet — it builds `SessionSnapshot` in Task 6; if `npm run lint` flags the missing field there, add `rumorEvents: {},` to the snapshot literal at `hooks/useGameState.ts:1163` now as a stopgap and note it for Task 6.)

- [ ] **Step 5: Commit**

```bash
git add types.ts engine/GameEngine.ts scripts/qa-engine.ts hooks/useGameState.ts
git commit -m "feat: rumor trigger recording in resolve() (Phase 4b)"
```

---

### Task 4: Envelope prepend + one-shot "recently heard" nudge

**Files:**
- Modify: `engine/GameEngine.ts` (`buildContext` — hoist the time computation above the interview block; extend the `targetNpcInterview` construction ~line 1439-1466; add `_rumorAckFlagsUpdate` to the hidden-fields return ~line 1589-1604; lift it in `resolve()` ~line 264)
- Modify: `types.ts` (root — `NarrationContext.targetNpcInterview` gains `recentlyHeard?: string[]`)
- Test: `scripts/qa-engine.ts` (new section)

**Interfaces:**
- Consumes: `maturedSpreadsFor` (Task 2), `SessionSnapshot.rumorEvents` (Task 3).
- Produces: `NarrationContext.targetNpcInterview.recentlyHeard?: string[]` (only on successful TALK turns with newly-matured, un-acked spreads); `rumor_ack_<rumorId>_<npcId>` flags on `EngineResult.flagsUpdate`; matured statements prepended to `targetNpcInterview.knowledgeEnvelope`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/qa-engine.ts`:

```ts
// ── Phase 4b: rumor envelope + heard-nudge ───────────────────────────────────

console.log('\n── Phase 4b: rumor envelope + heard-nudge ─────────────────────');
{
  // Phillips is only scheduled in acts 2-3 (offstage otherwise) — test in
  // act 2. Act 2 canonical start is 540 (9:00 AM). Trigger recorded at 600;
  // clock at 540+190=730 has crossed the 720 boundary → delayPeriods 1 matured.
  // Engine tests construct state directly, so the letter's real act of
  // availability is irrelevant here.
  const phillipsAt = (elapsed: number) => npcLocationAt(
    NPCS, 'phillips', 2,
    timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, 2, elapsed),
    { ...INITIAL_NPC_STATES });
  const talk = {
    type: 'talk' as const,
    targetId: 'phillips',
    targetRaw: 'phillips',
    raw: 'ask phillips about the letter',
  };
  const base = {
    currentAct: 2,
    location: phillipsAt(190),
    elapsedMinutes: 190,
    rumorEvents: { bond_saw_the_letter: { act: 2, atMinutes: 600 } },
  };

  const r = gameEngine.resolve(talk, buildSnapshot(base));
  const iv = r.aiContext.targetNpcInterview;
  const stmt = 'Has heard through the mortuary men that Dr. Bond was shown the Lusk letter itself by the doctor from Baker Street — and that Bond went very quiet over one passage of it';

  iv && iv.knowledgeEnvelope[0] === stmt
    ? pass('envelope: matured hearsay is prepended (head of list)')
    : fail('envelope: prepend', JSON.stringify(iv?.knowledgeEnvelope.slice(0, 2)));
  iv && iv.recentlyHeard && iv.recentlyHeard.length === 1 && iv.recentlyHeard[0] === stmt
    ? pass('nudge: first talk after maturity carries recentlyHeard')
    : fail('nudge: first talk', JSON.stringify(iv?.recentlyHeard));
  r.flagsUpdate?.['rumor_ack_bond_saw_the_letter_phillips'] === true
    ? pass('nudge: ack flag set on the nudging turn')
    : fail('nudge: ack flag', JSON.stringify(r.flagsUpdate));

  // Second talk (ack flag set): statement stays in envelope, nudge gone.
  const r2 = gameEngine.resolve(talk, buildSnapshot({
    ...base,
    flags: { rumor_ack_bond_saw_the_letter_phillips: true },
  }));
  const iv2 = r2.aiContext.targetNpcInterview;
  iv2 && iv2.knowledgeEnvelope[0] === stmt && iv2.recentlyHeard === undefined
    ? pass('nudge: acked rumor keeps the envelope line but stops nudging')
    : fail('nudge: once-only', JSON.stringify({ head: iv2?.knowledgeEnvelope[0], rh: iv2?.recentlyHeard }));

  // Un-matured rumor: absent from both envelope and nudge (clock 540+120=660,
  // before the 720 boundary). Re-derive Phillips's location for this clock.
  const r3 = gameEngine.resolve(talk, buildSnapshot({
    ...base, elapsedMinutes: 120, location: phillipsAt(120),
  }));
  const iv3 = r3.aiContext.targetNpcInterview;
  iv3 && iv3.knowledgeEnvelope[0] !== stmt && iv3.recentlyHeard === undefined
    ? pass('envelope: un-matured spread is absent everywhere')
    : fail('envelope: un-matured', JSON.stringify({ head: iv3?.knowledgeEnvelope[0], rh: iv3?.recentlyHeard }));

  // Batching: two rumors matured for the same NPC nudge together on one talk.
  const BATCH_RUMORS: RumorDefinition[] = [
    { id: 'b1', triggerFlag: 'f1', spread: [{ npcId: 'phillips', delayPeriods: 0, statement: 'BATCH-ONE' }] },
    { id: 'b2', triggerFlag: 'f2', spread: [{ npcId: 'phillips', delayPeriods: 0, statement: 'BATCH-TWO' }] },
  ];
  const batchEngine = new GameEngine({ ...WHITECHAPEL_MANIFEST, rumors: BATCH_RUMORS });
  const rBatch = batchEngine.resolve(talk, buildSnapshot({
    ...base,
    rumorEvents: { b1: { act: 2, atMinutes: 600 }, b2: { act: 2, atMinutes: 600 } },
  }));
  const ivB = rBatch.aiContext.targetNpcInterview;
  ivB && ivB.recentlyHeard?.length === 2
      && rBatch.flagsUpdate?.['rumor_ack_b1_phillips'] === true
      && rBatch.flagsUpdate?.['rumor_ack_b2_phillips'] === true
    ? pass('nudge: multiple matured rumors batch on one talk with both acks')
    : fail('nudge: batching', JSON.stringify({ rh: ivB?.recentlyHeard, f: rBatch.flagsUpdate }));

  // Same-turn self-nudge guard: SHOWING the letter to Bond (which records the
  // rumor this very turn) must not nudge anyone this turn.
  const period5 = timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, 5, 0);
  const bondLoc = npcLocationAt(NPCS, 'bond', 5, period5, { ...INITIAL_NPC_STATES });
  const rShow = gameEngine.resolve(
    { type: 'show' as const, targetId: 'from_hell_letter', showTargetNpcId: 'bond', targetRaw: 'letter', raw: 'show the letter to bond' },
    buildSnapshot({ currentAct: 5, location: bondLoc, inventory: ['From Hell Letter (transcript)'] }),
  );
  rShow.aiContext.targetNpcInterview?.recentlyHeard === undefined
    ? pass('nudge: the triggering turn itself never self-nudges')
    : fail('nudge: same-turn guard', JSON.stringify(rShow.aiContext.targetNpcInterview?.recentlyHeard));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run qa:engine`
Expected: compile error on `recentlyHeard` (not on the type yet); after adding the type field only, the envelope/nudge assertions FAIL.

- [ ] **Step 3: Implement**

Root `types.ts`, inside `targetNpcInterview` after `knowledgeEnvelope: string[];`:

```ts
    // Phase 4b — hearsay that reached this NPC since Watson last spoke to
    // them (one-shot: acked via rumor_ack_* flags). The AI has them raise it
    // unprompted, in character.
    recentlyHeard?: string[];
```

`engine/GameEngine.ts`, in `buildContext`:

1. **Hoist the clock.** Move these three lines (currently ~1504-1506) to just BEFORE the `targetNpcInterview` block (~line 1439) — `act` is already declared below; move `const act = session.currentAct;` up with them:

```ts
    const act = session.currentAct;
    const actTimeCfg   = this.story.actTimeConfig[act] ?? this.story.actTimeConfig[1];
    const totalMinutes = actTimeCfg.canonicalMinutes + session.elapsedMinutes + (outcome.extraMinutes ?? 0);
```

Delete the now-duplicate declarations at their old position (keep `timePeriod`/`timeLabel` where they are — they can stay below, reading the hoisted values).

2. **Extend the interview block.** Inside `if (outcome.targetNpcId && this.story.npcs[outcome.targetNpcId]) { ... }`, before the `targetNpcInterview = { ... }` assignment:

```ts
      // Phase 4b — matured hearsay for this NPC, prepended to the envelope.
      // The nudge (recentlyHeard + ack flag) fires only on a successful TALK.
      const matured = maturedSpreadsFor(
        this.story.rumors, session.rumorEvents, outcome.targetNpcId, act, totalMinutes);
      let recentlyHeard: string[] | undefined;
      if (intent.type === 'talk' && outcome.success) {
        const unacked = matured.filter(
          m => !session.flags[`rumor_ack_${m.rumorId}_${outcome.targetNpcId}`]);
        if (unacked.length > 0) {
          recentlyHeard = unacked.map(m => m.statement);
          for (const m of unacked) {
            rumorAckFlagsUpdate[`rumor_ack_${m.rumorId}_${outcome.targetNpcId}`] = true;
          }
        }
      }
```

Declare `const rumorAckFlagsUpdate: Record<string, boolean> = {};` next to the existing `introductionFlagsUpdate` declaration pattern (i.e. just above the interview block). In the `targetNpcInterview = { ... }` literal, change the envelope line and add the nudge:

```ts
        knowledgeEnvelope: [
          ...matured.map(m => m.statement),
          ...deriveKnowledgeEnvelope(this.story.facts, outcome.targetNpcId, session.currentAct),
        ],
        recentlyHeard,
```

3. **Hidden field + lift.** In the return literal's hidden-fields tail (next to `_worldEventFlagsUpdate`):

```ts
      // Rumor-ack once-only flags — lifted onto result.flagsUpdate in resolve()
      _rumorAckFlagsUpdate: Object.keys(rumorAckFlagsUpdate).length > 0
        ? rumorAckFlagsUpdate
        : undefined,
```

Add `_rumorAckFlagsUpdate?: Record<string, boolean>;` to both `as NarrationContext & {...}` casts (the one in `buildContext`'s return and the `ctxWithIntro` cast in `resolve()`), and in `resolve()` next to the `_worldEventFlagsUpdate` lift:

```ts
    if (ctxWithIntro._rumorAckFlagsUpdate) {
      result.flagsUpdate = { ...result.flagsUpdate, ...ctxWithIntro._rumorAckFlagsUpdate };
      delete ctxWithIntro._rumorAckFlagsUpdate;
    }
```

(The Task 3 trigger-recording block already sits after these lifts; keep it last.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run qa:engine && npm run lint`
Expected: all six new `envelope:`/`nudge:` labels PASS; zero FAIL across the whole suite (the pre-existing sections prove no regression); lint clean.

- [ ] **Step 5: Commit**

```bash
git add types.ts engine/GameEngine.ts scripts/qa-engine.ts
git commit -m "feat: matured rumors enter envelopes + one-shot heard nudge (Phase 4b)"
```

---

### Task 5: Narration prompt — render `recentlyHeard`

**Files:**
- Modify: `server/aiCore.ts` (export `buildNarrationPrompt` ~line 155; extend the NPC INTERVIEW compact section ~line 322-360)
- Test: `scripts/qa-narration-inject.ts` (new deterministic section — this is the offline prompt-mechanics script)

**Interfaces:**
- Consumes: `NarrationContext.targetNpcInterview.recentlyHeard` (Task 4).
- Produces: `export function buildNarrationPrompt(ctx: NarrationContext): string` (was module-private; export it unchanged for testability); a `RECENTLY HEARD` block inside the NPC INTERVIEW prompt section.

- [ ] **Step 1: Write the failing test**

Append to `scripts/qa-narration-inject.ts` (before its summary/exit lines), with `import { buildNarrationPrompt } from '../server/aiCore';` and `import type { NarrationContext } from '../types';` added at the top:

```ts
// ── Phase 4b: recentlyHeard prompt section ───────────────────────────────────

const baseInterviewCtx: NarrationContext = {
  locationName: 'Test Room', locationAtmosphere: 'quiet', locationDescription: 'a room',
  locationVisitCount: 2, locationTimeframe: 'present',
  act: 5, actName: 'The Convergence', timeLabel: '10:00 AM — Tuesday, 20 November 1888',
  timePeriod: 'morning', weather: { condition: 'foggy', label: 'Foggy' },
  npcsPresent: [{ label: 'Dr. Phillips', npcId: 'phillips', isIntroduced: true }],
  availableObjects: [], availableExits: [], inventory: [],
  watsonStats: { medicalPoints: 0, moralPoints: 0 },
  actionType: 'talk', actionSuccess: true,
  actionDescription: 'Watson addressed Dr. Phillips.', actionResultNote: 'SUCCESS',
  newCluesDiscovered: [], narrationMode: 'compact', blockquoteHint: 'none',
  targetNpcInterview: {
    npcId: 'phillips', label: 'Dr. Phillips', isIntroduced: true,
    role: 'Divisional Surgeon', speakingStyle: 'measured', personality: ['precise'],
    knowledgeEnvelope: ['HEARSAY-LINE-XYZ', 'background fact'],
    playerQuestion: 'ask phillips about the letter',
    recentlyHeard: ['HEARSAY-LINE-XYZ'],
  },
} as NarrationContext;

{
  const prompt = buildNarrationPrompt(baseInterviewCtx);
  check('recentlyHeard: section renders when present',
    prompt.includes('RECENTLY HEARD') && prompt.includes('HEARSAY-LINE-XYZ'));
  check('recentlyHeard: instructs unprompted raising',
    /UNPROMPTED/i.test(prompt));

  const without = buildNarrationPrompt({
    ...baseInterviewCtx,
    targetNpcInterview: { ...baseInterviewCtx.targetNpcInterview!, recentlyHeard: undefined },
  } as NarrationContext);
  check('recentlyHeard: section absent when not set', !without.includes('RECENTLY HEARD'));
}
```

If `NarrationContext` has additional required fields the compiler demands, satisfy them with the same minimal-literal style (the `as NarrationContext` cast covers optional drift — prefer real fields over widening the cast).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run qa:narration-inject`
Expected: compile error — `buildNarrationPrompt` is not exported.

- [ ] **Step 3: Implement**

In `server/aiCore.ts`: change `function buildNarrationPrompt(` to `export function buildNarrationPrompt(` (~line 155).

In the compact-mode NPC INTERVIEW construction (~line 322, where `knowledgeEnvelope`/`playerQuestion` are destructured — add `recentlyHeard` to that destructuring), insert after the envelope-cap logic and include the new section in the interview template right after the envelope list is rendered:

```ts
    const recentlyHeardSection = recentlyHeard && recentlyHeard.length > 0
      ? `\nRECENTLY HEARD (hearsay that reached ${label} since Watson last spoke with them — have ${label} raise it UNPROMPTED near the start of the reply, in character, as gossip or news reaching them secondhand; hearsay register, hedged sourcing ("word is…", "they say…"), never as if witnessed firsthand):\n${recentlyHeard.map(s => `• ${s}`).join('\n')}\n`
      : '';
```

Splice `${recentlyHeardSection}` into the `=== NPC INTERVIEW ===` template string directly after the knowledge-envelope block it already renders.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run qa:narration-inject && npm run lint && npm run qa:engine`
Expected: three new `recentlyHeard:` checks pass; everything else green.

- [ ] **Step 5: Commit**

```bash
git add server/aiCore.ts scripts/qa-narration-inject.ts
git commit -m "feat: render recentlyHeard hearsay block in the interview prompt (Phase 4b)"
```

---

### Task 6: Persistence — hook state, repository, save shapes, migration

**Files:**
- Modify: `types.ts` (root — `GameState` gains `rumorEvents?`; `Investigation` gains `rumorEvents?`)
- Modify: `hooks/useGameState.ts` (state init ~line 288; snapshot ~line 1163; apply ~line 1211; persist call ~line 1331; local save ~line 748; local resume; cloud resume ~line 676; new-game resets ~lines 573/842)
- Modify: `services/GameRepository.ts` (`applyEngineResult` ~line 190; `updateInvestigation` field map ~line 279; `mapInvestigation` ~line 547)
- Create: `supabase/migrations/007_rumor_events.sql`
- Test: `npm run lint` + full offline QA suite (this task is wiring; the engine behavior is already covered — the deliverable test is compile + no-regression + the migration file)

**Interfaces:**
- Consumes: `RumorEvents`, `EngineResult.rumorEventsUpdate`, `SessionSnapshot.rumorEvents`.
- Produces: `GameState.rumorEvents?: RumorEvents`; `Investigation.rumorEvents?: RumorEvents`; `investigations.rumor_events` jsonb column; `applyEngineResult` currentState param gains `rumorEvents: RumorEvents`.

- [ ] **Step 1: Types**

Root `types.ts`: add to `Investigation` (after `elapsedMinutes?: number;`):

```ts
  rumorEvents?: RumorEvents; // Phase 4b — rumor-event log (see RumorEvents)
```

and to `GameState` (after `currentAct?: number;`):

```ts
  // Phase 4b — rumor-event log. Optional for back-compat with older saves.
  rumorEvents?: RumorEvents;
```

- [ ] **Step 2: Migration file**

Create `supabase/migrations/007_rumor_events.sql` (mirroring 004's idempotent style):

```sql
-- ============================================================
-- Migration 007: Rumor-event log (Phase 4b)
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- When each rumor's trigger flag first fired: { "<rumorId>": { "act": n,
-- "atMinutes": n } }. Read by the engine to derive which NPCs have heard
-- which hearsay. Old rows default to {} — no behavioral change until a
-- trigger fires.
--
-- IDEMPOTENT: Safe to run multiple times.
-- ============================================================

ALTER TABLE public.investigations
  ADD COLUMN IF NOT EXISTS rumor_events JSONB DEFAULT '{}'::jsonb NOT NULL;

COMMENT ON COLUMN public.investigations.rumor_events
  IS 'Phase 4b rumor-event log: rumorId -> {act, atMinutes} recording when each rumor trigger first fired.';

-- ============================================================
-- Done.
-- ============================================================
```

- [ ] **Step 3: GameRepository**

`applyEngineResult` (~line 190): add `rumorEvents: RumorEvents;` to the `currentState` parameter type, and inside the updates construction (next to the `global_flags` merge):

```ts
      if (result.rumorEventsUpdate && Object.keys(result.rumorEventsUpdate).length > 0) {
        updates.rumor_events = { ...currentState.rumorEvents, ...result.rumorEventsUpdate };
      }
```

`updateInvestigation` snake-case map (~line 279): add

```ts
      if (updates.rumorEvents !== undefined) snakeUpdates.rumor_events = updates.rumorEvents;
```

(and add `rumorEvents?: RumorEvents` to that method's updates parameter type, following how `globalFlags` is declared there).

`mapInvestigation` (~line 547), with the other graceful-fallback fields:

```ts
      rumorEvents: (data.rumor_events as RumorEvents) || {},
```

Import `RumorEvents` from `../types` in this file.

- [ ] **Step 4: useGameState wiring**

All in `hooks/useGameState.ts` (import `RumorEvents` from `../types`):

1. State (next to `elapsedMinutes`, ~line 288): `const [rumorEvents, setRumorEvents] = useState<RumorEvents>({});`
2. Snapshot (~line 1163): add `rumorEvents,` to the `SessionSnapshot` literal (replace the Task 3 stopgap `{}` if present).
3. Apply (after `const newFlags = ...` ~line 1211):

```ts
      const newRumorEvents = result.rumorEventsUpdate
        ? { ...rumorEvents, ...result.rumorEventsUpdate }
        : rumorEvents;
```

and next to `setFlags(newFlags);`: `if (result.rumorEventsUpdate) setRumorEvents(newRumorEvents);`
4. Persist (~line 1331): add `rumorEvents,` to the `currentState` object passed to `GameRepository.applyEngineResult` (the pre-merge value — the repository merges `result.rumorEventsUpdate` itself, mirroring how `flags` is passed).
5. Local save (`handleSaveGame`, ~line 748): add `rumorEvents,` to the `GameState` literal, and `rumorEvents,` to the `updateInvestigation` call below it.
6. Local resume (`resumeFromLocalSave`): `setRumorEvents(state.rumorEvents ?? {});`
7. Cloud resume (~line 676 area, next to `loadedElapsed`): `setRumorEvents((investigation as Investigation).rumorEvents ?? {});` — follow the exact access pattern used for `elapsedMinutes` there.
8. New-game resets (~lines 573 and 842, wherever `setElapsedMinutes(0)`/fresh-state initialization happens): `setRumorEvents({});`

Search the file for every `setElapsedMinutes(` call site and mirror a `setRumorEvents` alongside each (same lifecycle: new game → `{}`, resume → loaded value). Do NOT reset on act advance — the log persists across acts (cross-act maturity depends on it).

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run qa:validate && npm run qa:engine && npm run qa:narration-inject && npm run build`
Expected: all green, build succeeds.

- [ ] **Step 6: Apply the migration to Supabase**

Apply `007_rumor_events.sql` to the project's Supabase instance via the Supabase MCP `apply_migration` tool (name: `rumor_events`). **Confirm with the user before applying if this session hasn't already been green-lit for DB changes** — it is additive and idempotent, but it touches the production database.

Verify: `list_migrations` shows 007 (or `execute_sql`: `select column_name from information_schema.columns where table_name='investigations' and column_name='rumor_events';` returns one row).

- [ ] **Step 7: Commit**

```bash
git add types.ts hooks/useGameState.ts services/GameRepository.ts supabase/migrations/007_rumor_events.sql
git commit -m "feat: persist rumor-event log (hook state, repository, migration 007) (Phase 4b)"
```

---

### Task 7: Curated rumor set (data-only)

**Files:**
- Modify: `engine/stories/whitechapel-1888/rumors.ts` (extend/rework — the two fixtures may be reworded but their ids and triggers must stay, the engine tests depend on `bond_saw_the_letter`'s id, trigger, phillips/delayPeriods-1 hop and its exact statement string — if a statement is reworded, update the matching string in `scripts/qa-engine.ts` in the same commit)

**Interfaces:**
- Consumes: `RumorDefinition`; the validator corpus from Task 1 defines which triggers are legal.
- Produces: 4–8 total `RumorDefinition` entries.

- [ ] **Step 1: Load authoring context**

Load the `historian` and `narration-voice-check` skills (Skill tool) before writing any statement. Re-read the spoiler rules: no "Halward", no "prasarved", nothing that makes any NPC suspect Edmund, nothing revealing clue CONTENT the recipient couldn't plausibly have heard secondhand — rumors spread the fact that Watson did something, and gossip-grade color, not forensic detail.

- [ ] **Step 2: Author the set**

Target 4–8 rumors on the highest-value reveals. Verified-legal trigger flags to draw from (all in the Task 1 validator corpus):

| Trigger flag | Natural spread |
|---|---|
| `showed_from_hell_letter_to_bond` | phillips (medical circle) — fixture, keep |
| `showed_from_hell_letter_to_abberline` | lusk (station↔committee) — fixture, keep |
| `showed_kidney_parcel_to_bond` | phillips, edmund is FORBIDDEN as recipient (never author edmund reacting to evidence against him) |
| `showed_edmund_forensic_note_to_abberline` | holmes is a poor recipient (he's usually with Watson); consider lusk |
| `showed_newspaper_pile_to_holmes` | act-0 tutorial — probably skip (nobody meaningful to spread to that night) |
| `talked_to_tumblety_at_<his location>` | abberline (the Yard hears Watson visited the American) — verify the exact flag against Tumblety's schedule locations before using |
| `talked_to_superintendent_at_private_asylum` | none before act 6 — DO NOT author spread from asylum contact into earlier-act NPCs; safest to skip entirely |

Rules of thumb per entry: `delayPeriods` 1–2 for same-circle gossip, 2–4 for cross-circle; statements 15–35 words, third-person, present-tense envelope register matching `facts.ts` style ("Has heard…", "Word among the committee is…"); every statement names its sourcing hedge ("through the mortuary men", "from the constables").

- [ ] **Step 3: Validate**

Run: `npm run qa:validate && npm run qa:engine`
Expected: rumor section reports the new count, all PASS; engine suite untouched (or updated in lockstep if a fixture statement was reworded).

- [ ] **Step 4: Review pass**

Dispatch the `narrative-consistency-reviewer` agent over the final `rumors.ts` (cross-reference NPC voices, act timing, and spoiler posture). Address findings.

- [ ] **Step 5: Commit**

```bash
git add engine/stories/whitechapel-1888/rumors.ts scripts/qa-engine.ts
git commit -m "feat: curated rumor set for Whitechapel 1888 (Phase 4b, data-only)"
```

---

### Task 8: Full regression + final review round

**Files:**
- None expected (fix-forward only if findings emerge)

- [ ] **Step 1: Full offline suite**

Run: `npm run lint && npm run qa:validate && npm run qa:engine && npm run qa:narration-inject && npm run qa:hints && npm run qa:diary-leads && npm run build`
Expected: everything green. (`qa:parser` needs a live key — skip unless the session has `GEMINI_API_KEY`; this phase adds no parser surface.)

- [ ] **Step 2: Whole-branch reviews**

Dispatch `engine-logic-reviewer` (GameEngine.ts changes: hoisted clock, recording order, lift order) and `engineering-reviewer` (hook state lifecycle, GameRepository, migration) in parallel over the branch diff vs `main`. Fix Critical/Important findings, re-run the suite, commit fixes as `fix: ... (Phase 4b)`.

- [ ] **Step 3: Verify old-save behavior once by hand**

In the running app (`npm run dev` or preview tooling): resume any pre-4b cloud save; confirm no console errors and a normal first turn (the log reads `{}` via the mapper fallback). This is the one behavior the offline suites can't fully prove.
