---
name: act-authoring
description: Use when designing, speccing, implementing, porting or reworking any act content of a London Bleeds Story — before writing or editing stories/*/*.json, and whenever act-level story work is proposed (a new act, porting an act from the archived Whitechapel story, gate changes, new Rules or Beats, a person's arrival or schedule move, act-scoped Objects, aliases, Facts or topics).
user-invocable: false
---

# Act Authoring

The process gate for story content. A Story is JSON validated by `packages/schema` (`story.ts`, `rule.ts`, `common.ts`); vocabulary is `GLOSSARY.md`; the target engine is `docs/engine-rebuild-plan.md` §2.3–2.4. Why the process exists — the ten bug classes Act 0 produced — is in `docs/act-authoring-process.md` ("Why this exists"); that doc's pipeline table, file paths and tool names describe the pre-rebuild engine, so take the rationale from it and the steps from here.

**Relation to the Phase 6 story skill.** Plan Phase 6 adds a skill that breaks narrative prose into locations, Objects, people, Facts, Rules and Beats. That skill is the *translator*; this one is the *gate* around it. When it exists, step 6 below uses it. Until then, write the JSON by hand against the schema, with `add-npc` for each new person. Neither skill restates the other.

## The iron rule

**No story data is written until the owner has signed off twice — once on the narrative spec, once on the mechanical score — and the act's golden scenario exists and is red.**

**A sign-off is a message from the owner in chat, arriving AFTER you presented the artifact and ended your turn.** The request that started the task is never sign-off #1. "Add it", "go ahead", "yes do it", "we discussed this" are the ask, not the approval. You must end your turn twice.

Violating the letter of this rule is violating its spirit.

## Scope

Any change under `stories/<id>/` that adds or moves a Rule, a Beat, a person's schedule entry or introduction, an Object or alias, a Fact, a topic phrase, a flag, an act or an ending — whole act or one line. Size changes the size of the artifacts, never their existence. For a change inside an existing act the deliverables are a delta spec (ten lines is fine) and delta rows appended to that act's score. **There is no size below which the process turns off.**

**Porting is authoring.** An act ported from the Whitechapel source on the `archive/pre-phase4-engine` branch is a new act under this process. The archived TypeScript and the old `docs/act*-spec.md` files are source material, not an approved spec: the mechanisms changed (Rules replace story events, rumors and world events; the selection model replaces the alias tables), so the score must be written fresh.

**Fixtures are not stories.** `packages/schema/fixtures/*` exist to prove the engine; editing them is engine work (`engine-logic-reviewer`), not this process.

**Delegation does not launder it.** A subagent, a slash command, the `add-npc` skill or the Phase 6 story skill writing story JSON counts as you writing it. Invoke them only after sign-off #2, with the score as their input.

**No prototyping.** Do not write the data "to check feasibility": feasibility questions go in the score as open questions for the owner. If you have uncommitted story data before sign-off #2, say so and revert it.

## Checklist (one todo per item)

0. **Classify the work** — new act / port / rework / delta — and say so. All run the same phases; a delta runs them small.
1. **Narrative spec** → `story-integrity-reviewer` + `historian` pass → **stop, ask for sign-off #1**. An existing doc is the spec only if the owner approved it *for this change*; cite which document and which approval, or write the spec.
2. **Mechanical score**, one row per beat (the template is the table below), plus: the act's gate (which Rule's `advanceAct`, and every condition it needs), each choice branch with every downstream read of its flags, one schedule row per person on stage (act × period → `at` / `follows` / `offstage`), and the act's anchor location, `startClockMinutes`, `dateLabel` and weather.
3. **Pre-checks** (below), all mechanical.
4. **Stop, ask for sign-off #2.** The score is frozen; later deviations go back to it first.
5. **Golden scenario, red.** Transcribe the score into a scripted scenario that drives `resolveTurn` / `tick` with explicit Selections, the way `scripts/qa-stress.ts` does for the stress fixture, asserting **negatives** (not present before, not askable before, examine does not satisfy open) as well as positives. Put it in `scripts/qa-<story>.ts` and add that script to `qa:all`. It must fail because the content is absent — not because it does not compile. Also record which prover goals the act adds; they must be UNREACHABLE now.
6. **Implement** the JSON until `npm run qa:story`, the golden, the prover (every act, Clue and ending REACHABLE, search not capped) and `npm run qa:all` are green. Then `narrative-consistency-reviewer` on the changed files.
7. **Playtest**: blind (`game-reviewer`) and owner, against the score, plus `qa-playthrough` for live narration. Triage each finding as **spec violation** (fix the score, then the golden assertion, then the data, in that order) or **taste** (one budgeted polish cycle per act).

Prover command for a Story directory (`npm run qa:prove` covers only the fixtures until a Story lands in `stories/`):

```bash
npx tsx -e "import { Story } from './packages/schema/index.ts'; import { loadStoryDir } from './packages/schema/load.ts'; import { prove, formatProof } from './packages/engine/prover.ts'; console.log(formatProof(prove(Story.parse(loadStoryDir(process.argv[1])))))" stories/<id>
```

## The score row

| Column | Pins down |
|---|---|
| **Trigger** — the Rule's trigger kind and its fields (`action` with every verb a player might reach for — "answer the door" may be `use` or `open`; `enter`, `flag`, `clock`, `proximity`, `disclosed`, `combine`, `deduction`, `tick` with weight), `once`, and the Effects it fires | timing; phrasing gaps |
| **Turn window** — the `when` conditions (act, location, period, flagsAll / flagsNone, hasItems, personsPresent, factsKnown) | timing |
| **Narration** — which mode the turn lands in (`opening` 220 words, `full` 160, `compact` 90, `flavour` 70, set in `packages/engine/projections.ts`) and whether every `playBeat` line fits it | dropped reveals |
| **People on stage** — schedule entries or `summonPerson` / `movePerson`; what the sidebar's `persons` will show (alias until introduced) | surface disagreement |
| **Objects** — `name` and `aliases`, placement, `hidden` until which `revealObject`; every other Object that can share the Candidate Set | name collisions |
| **Facts newly askable** — id, `knownBy`, `visibleFromAct`, every `topics` phrase, `voices`, `spoilerTerms` | timing; topic collisions |
| **Subjects made askable** — every proper noun or specific thing this beat says aloud, and the Fact whose topics cover it (or "deflects, intended") | silence on a named thing |
| **Identity anchors** — how this beat's own text, or the person's `beats`, establishes who each not-yet-named person is (sex, standing, manner) | identity loss across turns |
| **Quantities** — every number stated, or `none`; never a vague measure that invites a precise answer the invention gate will then reject | fabricated specifics |
| **Diary** — the Clue (name, summary, connections) or document this beat puts in the diary | chronology drift |

## Pre-checks (before sign-off #2)

- **Schema fit.** Every row expressible with the existing Trigger, Effect and Condition unions. If one is not, that is an open question for the owner — "what general mechanism is missing?" — and engine work with its own review, never a story-shaped workaround.
- **Name collisions.** Each new Object or person name and alias against every Object and person that can share a Candidate Set with it. The selection model answers `none` when two fit equally.
- **Topic collisions.** No phrase shared between Facts (`qa:story` fails exact duplicates) and no near-synonym or containment between Facts the same person knows.
- **Flags.** Every flag read is set by some Effect and every flag set is read (`qa:story` enforces both); flag names describe the world state, not the beat (`study_door_unlocked`, not `beat_7_done`).
- **Presence.** Every person a beat needs has a schedule entry for that act (and period), or arrives by an Effect, and the score says which.
- **Chronology.** Every date, time and duration stated once, in a canonical block in the score; beats cite it rather than restating it.
- **Spoilers.** Each Fact visible after the act's start lists `spoilerTerms`, and the score's beats avoid them.

## Pressure

When the owner pushes for speed, the answer is a smaller process, not no process. Offer a ten-line delta spec plus two score rows in one message, and say you will implement the moment they reply. Say it once; do not relitigate.

## Red flags — stop if you catch yourself thinking

| Thought | Reality |
|---|---|
| "The narrative spec covers timing" | Act 0's approved spec did not; ~20 fix commits landed in unpinned dimensions. |
| "I'll write the golden after the data" | A test written after encodes today's bugs as expectations. So does a score written after. |
| "It's one Rule, not an act" | Deltas run the same phases, smaller. |
| "It's a port; the old act was already approved" | Different mechanisms, different failure modes. Port means new score. |
| "The owner said 'add it' — that's sign-off #1" | The ask is not the approval. Present, end your turn, wait. |
| "I'll do spec + score + golden + implement in one turn" | Two of those phases end with you ending your turn. |
| "The prover says REACHABLE, so the act works" | The prover proves a path exists, not that a player would find it or that it lands at the right moment. |
| "The selection model will understand any phrasing" | It chooses among candidates. Two similar names, or a trigger on the wrong verb, still leave the scene dead. |
| "The mechanism doesn't exist, so I'll approximate it with flags" | A missing mechanism is a score line and an owner decision. |
| "The name is obviously fine" | `box` and `letter` were already taken in Act 0. Check the Candidate Set. |

If you are arguing with this table rather than reading it, that is the signal. Write one paragraph naming which phase you want to skip and why, put it to the owner, and wait.
