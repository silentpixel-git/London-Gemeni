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

## Fix round 1/5

### Findings resolved

- Changed non-exact event phrase matching from unrestricted substrings to normalized token/phrase boundaries, so `her` no longer matches inside `weather`.
- Removed the broad `kemp_pawn_ticket` topic-id trigger from the boots event; TALK now requires boots-specific language to perform the oak-bark/lime/silt analysis.
- Added declarative story-event inventory additions and made the withhold branch add the subscriber's card only when Watson does not already carry it. ASK reconstruction followed by silence now matches the authored pocket action in deterministic state and narration context.
- Replaced fallback context spreading with an explicit compact follow-up context containing scene state and the Kemp event, but no main-action interview, question, clues, atmospheric note, item gains, optional vignette, hint, scripted lines, or approach.
- Cleared the private `_vignetteFlagsUpdate` when a pivotal event suppresses its vignette, updated all stale pawn-ticket/takeable-gate comments, and added a complete positive ASK-reconstruction golden route through the Act 1 transition.
- Moved document filing behind story-event application so declarative event inventory uses the same permanent Documents contract as resolver inventory; the ASK/withhold route now sets `filed_charity_card` before Act 1 spends the physical card.

### Regression coverage and RED evidence

- `scripts/qa-engine.ts` covers the unrelated weather question, ticket-versus-boots topic, ASK reconstruction plus withhold inventory, TALK-Holmes fallback sanitization, and suppressed-vignette flag retention.
  - Weather boundary RED: `npm run qa:engine` -> 434 passed, 1 failed, 2 existing warnings.
  - Ticket/boots RED: `npm run qa:engine` -> 435 passed, 1 failed, 2 existing warnings.
  - ASK/withhold inventory RED: `npm run qa:engine` -> 436 passed, 1 failed, 2 existing warnings.
  - Follow-up sanitization RED: `npm run qa:engine` -> 437 passed, 1 failed, 2 existing warnings.
  - Vignette flag RED: `npm run qa:engine` -> 438 passed, 1 failed, 2 existing warnings.
- `scripts/qa-golden.ts` covers the full ASK reconstruction route without pre-taking the card, silence adding it, explicit ticket take, and closing into Act 1.
  - Golden-route RED: `npm run qa:golden` -> 136 passed, 1 failed.
  - Reviewer-driven filing RED: `npm run qa:golden` -> 137 passed, 1 failed.

### Verification commands and summaries

- `npm run lint` -> PASS (`tsc --noEmit`).
- `npm run qa:engine` -> 439 passed, 0 failed, 2 pre-existing warnings.
- `npm run qa:golden` -> 138 passed, 0 failed.
- `npm run qa:all` -> PASS: lint plus engine, golden, parser, hints, diary-leads, and validation suites.
  - Parser regression gates passed.
  - Hints: 38 passed, 0 failed.
  - Diary leads: 39 passed, 0 failed.
  - Story validation: 107 passed, 0 failed, 26 known warnings.
- `git diff --check` -> PASS before report/commit staging.
- `engine-logic-reviewer` recheck -> no remaining actionable engine/parser or regression findings.
- `narrative-consistency-reviewer` recheck -> no remaining actionable findings.
