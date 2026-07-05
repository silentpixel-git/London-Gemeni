# Phase 4b — Rumor Propagation (Design)

**Date:** 2026-07-05
**Backlog item:** M1 (rumor/knowledge propagation), the second half of Phase 4 of
the strangler-fig rebuild, split out from 4a (H5) the way 2b was split from 2a.
**Decisions made during brainstorm:** triggers are engine-visible acts only (no
AI-parsed free-form "telling"); payoff is envelope + a one-shot "recently heard"
narration nudge; diffusion is TimePeriod-delayed, backed by a small new
rumor-event log in the save (the first deliberate departure from 4a's
zero-new-state rule); mechanism is a fully-authored rumor table (Approach A) —
no social-edge graph; content ships as machinery + a curated set of ~4-8
authored rumors in a separate data-only commit.

## Goal

When Watson shows something to an NPC (or trips another engine-visible reveal),
that knowledge spreads: the fact enters other NPCs' knowledge envelopes after an
authored in-game delay, worded as hearsay, and the first conversation with an
NPC who has heard it gets a nudge so they raise it unprompted. NPCs reacting to
what Watson did yesterday is the cheapest way to make Whitechapel feel alive —
and it is pure engine logic on top of the Phase 2a fact machinery.

## Why Approach A (authored rumor table), not a social graph

The 2a dedupe audit found that **zero** facts qualified for cross-NPC statement
sharing — every overlapping fact had been deliberately reworded per NPC voice.
A graph that auto-spreads one statement text to every reachable NPC recreates
exactly the pattern that audit rejected, and turns the spoiler surface into a
reachability closure. An authored spread list gives every hop its own
hearsay-worded statement — which is simultaneously the literary-voice guarantee
and the spoiler guarantee — and keeps the validator's job a static list check.
Multi-hop texture ("Lusk hears what the pub heard") is authored as a second,
later, vaguer spread entry; no BFS needed for an 11-NPC cast.

## Architecture: derived spread over one small event log

"Which NPCs have heard rumor R by time T" is a pure function of story data plus
one new piece of session state:

- **Rumor-event log** — `Record<rumorId, { act: number; atMinutes: number }>`:
  when each rumor's trigger flag first fired. Flags are booleans and cannot
  carry time, so this log is the minimal state that makes "over in-game time"
  derivable. Everything downstream — maturity, envelope contents, nudges —
  derives from it per turn, in the 2a/4a derive-per-turn pattern.
- Old saves have no log → treated as `{}`; zero behavioral change until a
  trigger fires. No backfill, no migration of existing rows' data.
- Once-only "heard" nudges use the existing boolean flags channel
  (`rumor_ack_<rumorId>_<npcId>`), the vignette/world-event pattern.
- Failure posture: no AI call anywhere in the mechanism. The AI only narrates
  already-resolved outcomes, per the engine-resolves/AI-narrates contract.

## Data model (story layer only, consumed via the manifest)

New story file `engine/stories/whitechapel-1888/rumors.ts`, with the interface
in `engine/stories/types.ts` and exposure on the manifest as `rumors`:

```ts
export interface RumorDefinition {
  id: string;                 // unique snake_case; key in the rumor-event log
  triggerFlag: string;        // engine-set flag, e.g. 'showed_kidney_letter_to_abberline'
  spread: Array<{
    npcId: string;            // recipient
    delayPeriods: number;     // TimePeriod boundaries after the trigger (0 = same period)
    statement: string;        // hearsay-worded line, authored per recipient
  }>;
}
```

Every hop is fully authored: recipient, delay, and its own statement written as
hearsay in that recipient's register ("Word from the committee men is that
Baker Street doctor has been showing Lusk's letter about"). A `delayPeriods: 0`
entry may target the direct recipient of the show itself, giving them durable
knowledge of the encounter beyond the short NPC-memory window — an authoring
choice per rumor, not a rule.

## Engine behavior

### Recording the trigger

In `resolve()`, when this turn's merged `flagsUpdate` newly sets a rumor's
`triggerFlag` and the log has no entry for that rumor id, the engine emits a
new optional `EngineResult.rumorEventsUpdate: Record<string, { act, atMinutes }>`
with `atMinutes` = the turn's `totalMinutes` (canonical act start +
elapsed, the same clock world events use). The hook lifts it into session state
and persistence exactly like `flagsUpdate`. A trigger records at most once per
playthrough; re-showing does not reset the clock.

### Maturity

A spread entry `(npcId, delayPeriods)` of a recorded rumor has **matured** when:

- current act > the trigger's act — act transitions span days, so everything
  matures across an act boundary; or
- same act, and the number of TimePeriod boundaries crossed between the
  trigger's `atMinutes` and the current turn's `totalMinutes` ≥ `delayPeriods`.

Boundary counting reuses the Phase 4a clock helpers (mod-1440 wrap included),
so a rumor started `lateNight` matures into `dawn` correctly. `delayPeriods: 0`
means the same period — heard immediately.

### Envelope integration

`deriveKnowledgeEnvelope` (or a thin wrapper at its one call site,
`GameEngine.buildContext`) gains the matured hearsay statements for the target
NPC, **prepended** to the static envelope: aiCore's 8-item cap prefers the head
of the list, and fresh hearsay should win over background knowledge.

### One-shot "recently heard" nudge

On the first TALK with an NPC after one of their spread entries matures,
narration context gains `recentlyHeard: string[]` (that rumor's statement for
this NPC) and the engine sets `rumor_ack_<rumorId>_<npcId>` so it fires once.
The narration prompt instructs the AI to have the NPC raise what they heard
unprompted, in character, as gossip/news — not as an interrogation answer.
Multiple newly-matured rumors on the same first talk all ride the array.
After the nudge, the statement remains in the envelope permanently (they still
know it; they just stop leading with it).

## Persistence

- **Local saves:** `GameState.rumorEvents?: Record<string, { act, atMinutes }>`,
  optional for back-compat. (Known pre-existing quirk: local saves reset
  `elapsedMinutes`; a same-act resume may briefly under-mature in-flight
  rumors. Accepted — consistent with how the clock already behaves on local
  resume, and cross-act maturity is unaffected.)
- **Supabase:** additive `rumor_events` jsonb column on `investigations`
  (default `'{}'`), read with the established graceful-fallback pattern in
  `GameRepository.mapInvestigation`, written alongside `global_flags` in the
  turn-update path.

## Spoiler safety + qa:validate

Because every (statement, recipient, delay) triple is authored and static, the
whole spoiler surface is checkable at validate time. New rules:

1. Rumor ids unique; every `spread.npcId` resolves to a real NPC.
2. `triggerFlag` must match a flag the engine can actually set, validated
   against the derivable corpus: `showed_<objectId>_to_<npcId>` pairs from
   `showInteractions`, plus gate/`talked_to_*` flags from ACT_PROGRESSION and
   other statically-enumerable flag families. An unknown trigger pattern is a
   hard FAIL (a typo here would silently kill the rumor forever).
3. Every `statement` passes the existing killer-name / smoking-gun spoiler
   guard, per recipient — same hard-FAIL machinery as the 2a envelope guard.
4. `delayPeriods` within sane bounds (0–8) — beyond a day of period boundaries
   the cross-act rule dominates anyway.

## Authored content (curated set, separate data-only commit)

Machinery lands first with 1–2 rumors as test fixtures; the curated set
(~4–8 rumors) is its own reviewable commit with the historian skill loaded.
Candidate reveals, chosen at authoring time: showing the kidney letter
(Lusk↔Abberline↔committee circles), the Tumblety custody conversations
spreading through the Yard and the press, key documents shown to Bond/Phillips
(the medical circle talks to itself), Watson's asylum inquiry reaching the
superintendent's professional circle. Every statement is hearsay-voiced for its
recipient and spoiler-guarded by the validator.

## Testing

1. **qa:validate (data, no key):** the four rules above.
2. **Engine correctness (qa-engine suite, no key):**
   - Trigger appends the log exactly once; re-trigger does not reset it.
   - Maturity math: same-period (`delayPeriods: 0`), N-boundary within act,
     lateNight→dawn wrap, cross-act instant maturity.
   - Envelope contains matured statements only, prepended; un-matured entries
     absent.
   - Nudge fires exactly once per (rumor, npc); multiple matured rumors batch
     on one talk; `rumor_ack_*` flags set.
   - Old save shape (no `rumorEvents`) loads and behaves identically until a
     trigger fires.
3. **No-regression gate:** existing walkthrough suites pass unchanged with the
   machinery in and zero rumors authored (empty `RUMORS` array parity).

## Out of scope

- Mechanical effects of rumors (disposition shifts, flag gates, access changes).
- AI-parsed free-form "telling" (the engine never sees free-form dialogue).
- Rumor decay, mutation, or NPC-to-NPC emergent spread (no social graph).
- Watson *receiving* rumors as a mechanic (world events already cover
  broadcast-to-Watson texture).
