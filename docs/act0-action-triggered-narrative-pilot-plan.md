# Act 0 Action-Triggered Narrative Pilot

## Global Constraints

- Base behavior is `claude/notebooklm-access-bd7372`; work only on `codex/act0-action-events`.
- Preserve the invariant that the deterministic engine resolves state and Gemini only narrates verified outcomes.
- Replace all Act 0 `atTurn` scripted beats with player-triggered story events. Do not migrate timed world events, NPC ambience, approaches outside Act 0, or later acts.
- Pivotal narration is semantic and Gemini-integrated, not verbatim or mechanically appended.
- No legacy Act 0 save migration is required.
- Do not touch unrelated files or the main checkout.
- Follow strict TDD: add a behavior assertion, run it and confirm the expected failure, then implement the minimum production change and rerun.

## Task 1: Deterministic story-event runtime and complete Act 0 behavior

Implement the typed `StoryEventDefinition`/`StoryEventTrigger` manifest seam and a focused post-resolution matcher. Events match the resolved intent, target/NPC/topic and active state; one main event may fire per action. An event-declared trigger can authoritatively replace a base blocked result. Add `resolvedTopicId` to `EngineResult`, expose it from TALK, merge event effects before progression, and refresh narration context from the merged state. Add one-shot event flags, persisted boolean fallback counters, a separate follow-up event payload, optional NPC presence-forbid support, and suppression of optional vignettes/approaches/hints/scripted NPC lines on pivotal turns.

Replace `ScriptedBeat`/`scriptedBeats` with `storyEvents`, removing all five `atTurn` Act 0 beats. Implement these scenes and semantic flags:

1. Initial TALK Holmes or EXAMINE window/street/crowd -> Holmes reads the crowd and notices the hesitant woman; set `act0_caller_noticed`, no bell.
2. EXAMINE woman/caller/window/street or ASK Holmes about her -> set `act0_bell_rang` and the ringing notice. Unrelated actions do not advance.
3. ANSWER/OPEN/ATTEND TO/CHECK the door -> Mrs Hudson introduces Kemp; set `world_event_kemp_arrives`; evidence becomes visible; Kemp does not state her business.
4. TALK Kemp or ASK about business/why she came/Nell/sister/disappearance -> set `act0_kemp_business_heard`. Direct sister questions also keep the existing asked flag. If two eligible local actions occur first, schedule a distinct follow-up event that sets only the semantic heard flag. Eligible intents are successful examine/talk/take/use/show/read/open/drop/wait; meta, notebook, query, inventory, deduce, failed, blocked, and unrecognised input do not count.
5. EXAMINE/INSPECT/SMELL boots or ASK Kemp/Holmes about them -> set `act0_boots_analyzed` and require the oak bark/lime/river silt/Bermondsey choreography. It can occur before business and counts toward the fallback.
6. Ticket, workbox, letters and card remain explicit object actions. Remove the workbox nudge. Workbox contents are visible in narration context on the opening turn. Ticket examination must not transfer the ticket; taking it is blocked until Kemp's choice is resolved.
7. Full reconstruction is triggered by SHOW card to Holmes or ASK Holmes about it only after ticket examined, boots analysed, and letters examined. Early attempts are non-spoiling and do not set completion. Full event sets `act0_reconstruction_complete` and preserves `showed_charity_card_to_holmes` for existing consumers.
8. Preserve three explicit choices: give card, ask why Nell hid, or withhold. Move withhold phrases out of generic parser/engine constants into story event data. Exactly one branch sets `act0_kemp_choice_resolved`; Kemp departs and the ticket becomes takeable.
9. After choice resolution and ticket take, TALK Holmes or EXAMINE window/street/crowd -> integrated crowd/crime closing, set `act0_closing_complete`, and advance to Act 1 through the existing curtain.

Update Baker Street's opening description so Holmes studies the street silently, remove/gate the Act 0 Mrs Hudson vignette, remove the Kemp/workbox Act 0 safety nets and the separate invisible-crowd approach, and update Act 0 progression to require semantic milestones. Preserve Act 5's safety net and all existing diary branch flags. No Act 0 prose may foreshadow a murder or connect Nell to later crimes.

Add failing then passing deterministic coverage in the existing QA harnesses for canonical triggers, aliases, unrelated-action non-progression, indefinite bell/door waits, exact two-action fallback and exclusions, boots before business, no workbox nudge, reconstruction prerequisites, three choices/departure, both closing triggers, once-only flags, and no event overlap except the follow-up.

Run at minimum: `npm run lint`, `npm run qa:engine`, `npm run qa:golden`, `npm run qa:parser`, and `npm run qa:validate`. Commit the task.

## Task 2: Integrated Gemini narration, separate follow-up streaming, and authoring template

Replace `NarrationContext.scriptedBeat` with `storyEvent: { id, beats, maxWords, notice? }`. Add a numbered `REQUIRED STORY EVENT` section to `buildNarrationPrompt`; it must instruct Gemini to cover every semantic beat exactly once and in order within one Watson response, without mechanically appended prose. Use maximum lengths: crowd 230, bell 70, arrival 160, business 130, boots 180, reconstruction 300, each choice 100, closing 180.

Remove server-side scripted-beat appending. Pivotal turns may still render deterministic notices and verified pickup messages. Stream a due Kemp fallback as a second narration context and distinct feed item after the triggering action completes. Engine state remains committed before narration; on Gemini failure retain state and use the existing generic error with no retry or authored fallback.

Add failing then passing narration-seam QA demonstrating that event beats are present in the prompt, no authored passage is appended after generation, the event word limit governs the turn, and the fallback is represented as a separate context/feed item. Add Gemini narration fixtures for all pivotal Act 0 events, without requiring the API key for deterministic suites.

Create or update a concise story-event authoring guide documenting triggers, prerequisites, semantic effects, ordered narration beats, explicit fallback rationale, alias locality, one-event-per-action, and required positive/negative/golden tests. Do not prescribe this mechanism for timed world events or ambient texture.

Run `npm run qa:narration-inject`, `npm run qa:all`, and `npm run build`. If `GEMINI_API_KEY` is available, also run `npx tsx scripts/qa-narration.ts` and inspect ordered-beat coverage; otherwise report that live narration QA was skipped. Commit the task.
