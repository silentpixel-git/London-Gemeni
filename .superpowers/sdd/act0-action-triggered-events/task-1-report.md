# Task 1 report: deterministic story events and Act 0

Status: complete

Implementation commit: `4f81b5f35de0cc1650d5aea888ec08253d776e64`

## What changed

- Added typed `StoryEventDefinition`, `StoryEventTrigger`, fallback, and payload contracts plus a post-resolution `applyStoryEvents` runtime.
- Matches resolved action type, target, NPC, topic, raw phrase, location, and flag state; selects at most one main event and permits an explicitly authored trigger to replace a blocked base action.
- Added `EngineResult.resolvedTopicId`, one-shot event flags, persisted fallback counters, a separate presentation-only follow-up payload, NPC presence-forbid support, merged-state narration-context refresh, and pivotal-turn suppression of optional narration furniture.
- Replaced the Act 0 turn-indexed `scriptedBeats` manifest data with ten action-triggered events covering caller, bell, door, Kemp's business/fallback, boots, reconstruction, three choices, departure, ticket take, and closing.
- Reworked Act 0 progression around semantic milestones while preserving the existing diary branch flags used by downstream consumers.
- Kept ticket examination/read separate from physical transfer, gated ticket take on the resolved Kemp choice, removed the Act 0 workbox nudge and invisible-crowd approach, and made workbox contents visible in opening context.
- Updated Act 0 facts, clues, hints, locations, NPC placement, parser behavior, and QA fixtures without changing later-act story behavior.

## TDD evidence

- Initial event-runtime/Act 0 RED run: `qa:engine` reported 394 passed, 7 intended failures, 2 existing warnings.
- Parser RED run: three new withhold fixtures failed before phrase ownership moved from generic parser constants into story-event data.
- Engine specialist review produced RED coverage for reading the ticket bypassing transfer rules and `pocket the card` parsing as TAKE; both were fixed.
- Narrative specialist review produced regressions for door-arrival fallback counting, early closing-thesis leakage, and the closing fact becoming available too early; all were fixed.
- Final narrative recheck found substring choice matching in addressed questions. New tests failed 432 passed / 2 failed, then passed after adding scoped exact matching for withhold commands.

## Verification

- `npm run qa:all` — PASS
  - `npm run lint` — PASS
  - `npm run qa:engine` — 434 passed, 0 failed, 2 pre-existing warnings
  - `npm run qa:golden` — 114 passed, 0 failed
  - `npm run qa:parser` — deterministic/parser regression gates passed, including 14/14 NPC and 26/26 intent fixtures
  - `npm run qa:hints` — 38 passed, 0 failed
  - `npm run qa:diary-leads` — 39 passed, 0 failed
  - `npm run qa:validate` — 107 passed, 0 failed, 26 known warnings
- `git diff --check` and staged diff check — PASS
- `engine-logic-reviewer` final recheck — no remaining engine/parser findings
- `narrative-consistency-reviewer` final recheck — no remaining story consistency finding after the exact-choice fix

## Coordination note

Task 1 defines and populates `NarrationContext.storyEvent` and the separate follow-up context, but intentionally does not implement Task 2's server prompt or hook/feed sequencing. The legacy optional `NarrationContext.scriptedBeat` presentation field remains temporarily so this engine-only commit compiles against the still-unmigrated Task 2 server/hook code; the engine and manifest no longer produce or contain scripted beats.
