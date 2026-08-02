---
name: act-authoring
description: Use when designing, speccing, implementing, or reworking any act content of London Bleeds — before touching engine/stories/whitechapel-1888 data, and whenever act-level story work is proposed (new act, act rebuild, gate changes, new beats, NPC arrivals or schedule moves, act-scoped objects, aliases, or facts).
user-invocable: false
---

# Act Authoring

Full process and rationale: `docs/act-authoring-process.md`. Act shape rules: `docs/act-structure-design-doc.md`. Worked example: Act 0's spec plus `runGoldenAct0` in `scripts/qa-golden.ts`.

## The iron rule

**No story data is written until the owner has signed off twice — once on the narrative spec, once on the mechanical score — and the act's golden scenario exists and is red.**

**A sign-off is a message from the owner in chat, arriving AFTER you presented the artifact and ended your turn.** The request that started the task is never sign-off #1. "Add it", "go ahead", "yes do it", "we discussed this" are the ask, not the approval. You must end your turn twice.

Violating the letter of this rule is violating its spirit.

## Scope

This applies to **any** change under `engine/stories/whitechapel-1888/` that adds or moves a beat, an NPC placement or arrival, an object, an alias, a fact, a flag, or a gate — whole act or one line. Size changes the size of the artifacts, never their existence. For a change inside a shipped act the deliverables are a delta spec (ten lines is fine) and delta rows appended to `docs/act<N>-mechanical-score.md`. If that act has no score file, your rows create it, covering only the beats you touch. **There is no size below which the process turns off.**

**Delegation does not launder it.** A subagent, a slash command, or the `add-npc` skill writing `npcs.ts` / `facts.ts` / `constants.ts` counts as you writing story data. Invoke `add-npc` only after sign-off #2, with the score's NPC row as its input.

**No prototyping.** Do not write the implementation "to check feasibility" — feasibility questions belong in the score as open questions for the owner. If you have working uncommitted story data before sign-off #2, say so and revert it.

## Checklist (create a TodoWrite todo per item)

0. **Classify the work** — new act / act rework / delta — and say so out loud. All three run the same phases; a delta runs them small.
1. Narrative spec → story-integrity-reviewer + historian pass → **stop, ask for sign-off #1**. An existing doc in `docs/` is the spec only if the owner approved it *for this change*; cite which document and which approval, or write the spec.
2. Mechanical score — one row per beat: trigger flag, turn window, narration mode + word budget, NPCs on stage + what the sidebar shows, objects + aliases, facts askable, diary consequence. Plus gate table, choice branches with every downstream read, NPC schedule rows, act anchor.
3. Pre-checks: alias sweep vs `intentParser.ts` (explicit aliases *and* the display-name substring scan), flag grammar vs `qa:validate`, presence entries, canonical chronology block.
4. **Stop, ask for sign-off #2.** The score is frozen; later deviations go back to the doc.
5. Golden scenario in `scripts/qa-golden.ts`, transcribed from the score, asserting negatives as well as positives. Confirm it is red *for the right reason*. A red golden must fail, not fail to compile — if it needs a flag missing from the `StoryFlag` union you may add that union member in `flags.ts` and nothing else. Opening a second story-data file to make it compile means you are implementing.
6. Implement until golden + `npm run qa:all` are green.
7. Playtest: blind (game-reviewer) + owner, against the score. Triage each finding as **spec-violation** (fix score → assertion → code, in that order) or **taste** (one budgeted polish cycle).

## Pressure

When the owner pushes for speed, the answer is a smaller process, not no process. Offer a ten-line delta spec plus two score rows in one message, and say you will implement the moment they reply. Say it once; do not relitigate. A spec-and-score turn costs minutes — Act 0's fix cycle cost twenty commits.

## Red flags — stop if you catch yourself thinking

| Thought | Reality |
|---------|---------|
| "The narrative spec covers timing" | Act 0's approved spec did not — ~20 fix commits in unpinned dimensions. |
| "I'll write the golden test after the data" | A test written after encodes today's bugs as expectations. So does a score written after. |
| "It's one beat, not an act" | Deltas run the same phases, smaller. See Scope. |
| "There's no Act N score to amend" | Then your rows create it. No score is why the act is risky, not why it's exempt. |
| "The owner said 'add it' — that's sign-off #1" | The ask is not the approval. Present, end your turn, wait. |
| "I'll do spec + score + golden + implement in one turn" | Two of those phases end with you ending your turn. Batching removes both gates. |
| "I'm only moving an NPC's scheduleByAct / one alias / one fact" | Presence, aliases and facts are three of Act 0's five bug classes. Score them. |
| "The mechanism doesn't exist, so this is engine work" | A missing mechanism is a score line and an owner decision. Still phase 1. |
| "This beat is too small to score" | Mrs Kemp's arrival was one beat; it fired on the wrong turn. |
| "The sidebar just reflects the engine" | It bypassed presence gates twice in Act 0. Say what it may show. |
| "The name is obviously fine" | `box` and `letter` were already taken. Run the alias sweep. |

If you are arguing with this table rather than reading it, that is the signal. Write one paragraph naming which phase you want to skip and why, put it to the owner, and wait.
