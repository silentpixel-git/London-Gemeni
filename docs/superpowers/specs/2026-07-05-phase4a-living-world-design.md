# Phase 4a — Living World: Schedules, WAIT, and World Events (Design)

**Date:** 2026-07-05
**Backlog item:** H5 (NPC schedules + simulation tick + scripted events), Phase 4 of the strangler-fig rebuild. M1 (rumor propagation) is explicitly split out as Phase 4b with its own spec, mirroring the 2a/2b split.
**Decisions made during brainstorm:** derived world (Approach A, no simulation state); TimePeriod-bucket granularity; diegetic redirects (never a dead end); WAIT advances to the next period boundary; events are narration broadcasts only (no world effects in 4a); location opening hours are in scope.

## Goal

The in-game clock already advances per action; let it drive the world. NPCs
keep time-of-day schedules, WAIT becomes a meaningful verb, locations can be
closed at night, and authored world events land in the narration whether or
not Watson is "on time." Deterministic and silent — texture, not plot
(dynamic ≠ procedural; the six-act structure is untouched).

## Architecture: derived world, no new state

The world at time T is a **pure function** of story data + the existing
session snapshot — the same derive-per-turn pattern as the Phase 2a knowledge
envelopes. No simulation tick mutates state, no save migration:

- NPC placement derives from `(act, timePeriod)` via a schedule lookup.
- Location openness derives from `(timePeriod)` via optional `openPeriods`.
- Event delivery derives from the clock, with once-only tracking on the
  existing flags channel (the vignette pattern: `world_event_<id>`).
- `elapsedMinutes` already persists; nothing else needs to.

The rejected alternative (a stateful per-turn tick writing into
`npcStates.currentLocation`) would create two sources of truth for NPC
position and fight the authored-override channel story moves already use.

## Data model (story layer only, consumed via the manifest)

### NPC schedules

`NPCDefinition.canonicalLocationByAct: Record<number, string>` becomes:

```ts
scheduleByAct: Record<number, {
  default: string;                                  // today's canonical location
  byPeriod?: Partial<Record<TimePeriod, string>>;   // e.g. { evening: 'ten_bells' }
}>
```

**Parity-first migration** (the 2a playbook): step 1 is a mechanical rewrite
of all 11 NPCs with `default` = the current canonical location and no
`byPeriod` entries — provably byte-identical behavior, gated by a parity
test. Authoring real evening/night overrides is a separate, reviewable
data-only commit afterward.

Precedence (highest first): `npcState.currentLocation` (authored story
moves, deceased handling) → `byPeriod[timePeriod]` → `default`. One engine
helper owns the lookup:

```ts
npcLocationAt(npcId, act, timePeriod, npcStates): string
```

### Location opening hours

`LocationDefinition` gains two optional fields:

- `openPeriods?: TimePeriod[]` — absent means always open, so zero locations
  change behavior until authored.
- `lockedNote?: { text: string; keyholderNpcId?: string }` — the authored
  locked-door beat. Required by qa:validate whenever `openPeriods` is set.
  If `keyholderNpcId` is set, the redirect derives that NPC's current
  whereabouts from their schedule — never hand-duplicated.

### World events

New story file `engine/stories/whitechapel-1888/events.ts`:

```ts
export interface WorldEventDefinition {
  id: string;               // unique; flag key is world_event_<id>
  act: number;              // only fires during this act
  atClockMinutes: number;   // clock-of-day, e.g. 840 = 14:00
  text: string;             // the blockquote Watson gets, wherever he is
}
```

Fires on the first turn in its act where clock-of-day ≥ `atClockMinutes`;
marked delivered via flag. If the act begins already past `atClockMinutes`,
it is marked delivered without firing (no stale morning papers at midnight).
Multiple events pending after a long WAIT all fire that turn, in
`atClockMinutes` order, as separate blockquotes. Exposed on the manifest as
`worldEvents: WorldEventDefinition[]`.

## Engine behavior

### Presence

`getPresentNpcIds` gains a `timePeriod` parameter and routes through
`npcLocationAt`. All call sites follow (GameEngine internal sites plus the
Phase 3 parse-candidate builder), so candidate lists, presence prose, and
talk-target resolution cannot disagree.

### Diegetic redirect — never a dead end

TALK targeting an NPC scheduled elsewhere returns a failed-talk outcome whose
narration context carries structured whereabouts:

```ts
absentNpc: { name: string; whereaboutsLocationName: string; returnsPeriod: TimePeriod | null }
```

The AI narrates it in-fiction ("The attendant says Dr Phillips left for the
Britannia; he'll return come morning"). `returnsPeriod` is the next period in
which the NPC's schedule puts them back at this location (`null` if never
this act). MOVE into a closed location is the same shape: no location change,
`lockedNote.text` plus the computed next open period in context. The player
can always follow, or WAIT.

Spoiler safety: redirects only arise for NPCs the player can already target,
and targeting of unintroduced NPCs is alias-masked upstream (Phase 3 logic) —
schedules add no new spoiler surface.

### WAIT

New `IntentType 'wait'` (no target). The engine computes minutes from
`actTimeConfig.canonicalMinutes + session.elapsedMinutes` to the **next**
TimePeriod boundary (a turn starting exactly on a boundary advances to the
one after — never a 0-minute no-op; the lateNight→dawn wrap is free because
`computeTimePeriod` is mod-1440). Returned as a new optional
`EngineResult.minutesAdvanced`; the hook uses
`result.minutesAdvanced ?? ACTION_TIME_MINUTES[actionType] ?? 2`, keeping a
single clock authority. Narration context gets a passage-of-time beat
(fromPeriod → toPeriod). WAIT never advances an act — acts advance on gates,
as today.

### Critical-path guard rail

New `qa:validate` rule: every NPC whose conversation gates an act
(`talked_to_*` flags in ACT_PROGRESSION requirements) must be at their
schedule `default` during that act's canonical-start period. A player who
follows a hint straight to the canonical location always finds the gate NPC;
schedule authoring cannot silently break the critical path.

## Parser and narration surface

- **Regex parser:** `wait` + a few synonyms ("pass the time", "linger",
  "rest a while") → `{ type: 'wait' }`. No target, no alias-table growth.
- **Phase 3 tool-call fallback:** the `parseAction` verb enum gains `wait`
  (no id argument); one or two fixtures join the qa:parser intent corpus.
- **Narration:** event blockquotes ride the narration-context object as a new
  optional `worldEvents: string[]`, prompted like vignettes. The hour-bell
  `clockEvent` mechanism is untouched. The header already shows
  `timeLabel`/`timePeriod`; no new UI.

## Error handling / edge cases

- Authored `currentLocation` overrides always beat schedules (deceased and
  story-moved NPCs unaffected).
- Keyholder/returns-period lines are derived from schedules, never duplicated
  in prose data.
- Saves: zero migration. Old saves derive placement from parity schedules;
  event flags simply start empty.
- Failure posture: everything here is deterministic engine/data logic — there
  is no AI call to fail. The AI only ever narrates already-resolved outcomes,
  per the engine-resolves/AI-narrates contract.

## Testing

1. **qa:validate (data, no key):** all schedule/`lockedNote`/event ids
   resolve; `openPeriods` ⇒ `lockedNote`; event ids unique; event text passes
   the existing spoiler guard; gate-NPC canonical-period rule above.
2. **Engine correctness (qa:playthrough suite, no key):**
   - Parity proof: `npcLocationAt` === old `canonicalLocationByAct` for all
     NPCs × acts × periods on the pre-override data (the 2a derived===old gate).
   - WAIT boundary math incl. midnight wrap; never 0 minutes.
   - Locked MOVE: no location change, lockedNote in context.
   - Absent TALK: redirect context populated, correct `returnsPeriod`.
   - Events: fire exactly once; ordered when batched; skipped when the act
     starts late.
3. **qa:parser fixtures** for `wait` (live Gemini, existing harness).
4. **No-regression gate:** existing walkthrough suites pass unchanged against
   the parity data before any real schedule overrides land.

## Out of scope (4b and later)

- M1 rumor propagation (facts diffusing along social edges over in-game
  time) — Phase 4b, own spec, written after 4a merges.
- Events with world effects (moving NPCs to an inquest, toggling access).
- Wait-for-target ("wait for Phillips") parser sugar.
- The Phase 3 cutover (flipping `VITE_AI_PARSER` on in prod, deleting
  `resolveTargetWithAI`) — independent follow-up, not blocked by 4a.
