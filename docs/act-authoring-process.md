# Act Authoring Process

How an act goes from idea to done. The companion skill (`.claude/skills/act-authoring/`) enforces this; this doc is the rationale and the reference.

**Start here:** copy `docs/act-spec-template.md` to `docs/act<N>-<slug>-spec.md` and fill it. This doc explains *why* each field exists; the template is what you actually fill in.

A Story is JSON under `stories/<id>/`, validated by `packages/schema` (`story.ts`, `rule.ts`, `common.ts`). The vocabulary (Rule, Trigger, Effect, Beat, Candidate Set, Disclosure Ledger, Observation) is `GLOSSARY.md`; the world model and the Rule unions are `docs/engine-rebuild-plan.md` §2.3–2.4. The pre-rebuild engine, and the Whitechapel act data written for it, are on the `archive/pre-phase4-engine` branch: source material for a port, never an approved spec.

## Why this exists

Act 0 had an approved 400-line narrative spec before a line of code was written, and still took roughly twenty fix commits. The spec specified the *story*; every fix landed in a dimension it never pinned down:

1. **Timing.** Content firing on the wrong turn (Mrs Kemp's arrival, facts askable before the puzzle that earns them, a branch skipping the reconstruction).
2. **Surface disagreement.** Sidebar and hints showing what the engine gates (presence-gate bypasses, container contents leaking across locations).
3. **Parser collision.** New object names shadowed by existing aliases (`box` → parcel_box, `letter` → from_hell_letter, apostrophe aliases unreachable).
4. **Cross-surface chronology.** One fact stated in several places drifting apart (the pawn ticket's timeline, fixed twice).
5. **Narration-mode interaction.** Reveals dropped by word budget; beats needing a full-mode turn that the minimal path never produces.

A narrative spec cannot catch these. A **mechanical score** and a **golden scenario** can. Both are cheap next to a playtest-fix cycle.

### The second generation (Act 0 polish, 2026-08-12)

The five classes above are all about **engine state**. A later polish pass produced a distinct family, all about **words**, and the score as originally specified caught none of them:

6. **Trigger phrasing gaps.** `answer the door` was authored; a player typed `answer door` and the scene was dead, falling through to the unrecognised-input handler (which then hallucinated a departure).
7. **Silence on a named thing.** Holmes says "Heath-road" aloud, the player asks about it, and he denies knowing it. Any proper noun the act's own prose introduces must be askable.
8. **Topic collision.** One fact's topic phrase silently stealing another's (`the boots`, `the work`). An exact-duplicate check could not see it; the theft was by *partial* match.
9. **Cross-turn identity loss.** Holmes called Mrs Kemp "a man" because that turn's beat named no gender and each narration call had no memory of prior turns.
10. **Fabricated specifics.** A beat reading "well over a week" became "no rain for nine days"; a page-boy called "Billy" arrived from the wider Doyle canon.

**Every one of these was found by playing, not by a harness**: `qa:all` was green throughout. Goldens verify the path the author chose to write; they cannot tell you a player would word it differently.

### What the rebuilt engine takes off the author, and what it does not

All ten classes were found on the pre-rebuild engine. The rebuild was designed partly against them (plan §1.2 and §3), so some are now closed by mechanism and some only narrowed. Read this table before deciding a score column is redundant: a "narrowed" class still needs its column.

| # | Class | Status | Mechanism | What authoring still owns |
|---|---|---|---|---|
| 1 | Timing | Authoring | Rules make timing explicit (`when` conditions, `once`); the prover shows a gate *can* be reached | That it is reached at the right moment and not before. The prover finds a path; only the golden's negatives pin the window |
| 2 | Surface disagreement | **Mitigated** | The sidebar (`playerView`), the Candidate Set and the narration context are all projections of one State through the same helpers (`personsPresent`, `visibleObjects`); hidden Objects are in none of them | Saying in the score which label a person carries (alias until introduced) and when an Object is `hidden` |
| 3 | Parser collision | **Narrowed** | The **selection model** chooses from the current Candidate Set only, so a name can no longer resolve to an Object in another act or room; there are no alias tables to shadow each other | Collisions *inside* one Candidate Set: two things here, or here and carried, that fit a phrase equally get `none`, and the scene goes dead |
| 4 | Chronology | Authoring | All prose lives in Story JSON (the engine knows no story), so there is no hook or component copy to drift | The canonical facts block; beats cite it rather than restate it |
| 5 | Narration mode | **Narrowed** | The turn endpoint picks the mode from the turn's Events: any queued Beat, Clue, Fact told to the player, move, act entry or ending makes it `full` | Fitting every Beat into that budget alongside whatever else the turn carries (see "Narration" below) |
| 6 | Trigger phrasing | **Narrowed** | The **selection model** maps free phrasing onto a verb plus Candidate Set ids, so `answer door` and `answer the door` reach the same Selection | The verb. "Answer the door" may be selected as `open` or `use`; a Rule that lists only one leaves the other phrasing dead |
| 7 | Silence on a named thing | **Narrowed** | The **Disclosure Ledger** records every Fact a person has told the player; the narrator is told never to deny anything in it, and a topic with no Fact deflects honestly instead of inventing | A proper noun spoken in a `playBeat` or a person's `beats` is not a Fact and is not in the Ledger. It is askable only if some Fact the speaker knows has a topic phrase covering it |
| 8 | Topic collision | **Narrowed** | No substring matcher any more: the selection model matches the subject against the topic phrases offered for that person. `qa:story` fails a phrase shared by two Facts | Near-synonyms between Facts the same person knows. The model may pick the wrong one, or answer `none` |
| 9 | Identity loss | **Narrowed** | Every present person's `beats` travel with them into every narration context, and the Transcript carries the recent exchange | Putting sex, standing and manner in the person's `beats` (or the alias), not only in the beat where they first appear |
| 10 | Fabricated specifics | **Mitigated** | The **invention gate** (`packages/ai/gate.ts`) runs on every narration server side: a proper noun or number in neither the context nor the Observations is rejected, regenerated once with the inventions named, then replaced by the Beats alone | Stating the numbers you want said, and writing Beats that still read as prose on their own, because that is what the player sees when the gate rejects twice. The gate does not catch an improvised detail that reads like a clue (plan §5) |

What remains is still most of the list. The engine stops the narrator *inventing*; it cannot make the author *specify*.

## The pipeline

Each phase gates the next. The owner signs off twice; no story JSON is written before sign-off #2.

| # | Phase | Output | Gate |
|---|---|---|---|
| 1 | **Narrative spec** | `docs/act<N>-<slug>-spec.md`: case, scene flow, facts, gate, choice | `story-integrity-reviewer` + `historian` → **owner sign-off #1** |
| 2 | **Mechanical score** | `docs/act<N>-mechanical-score.md`: the beat table (below), the gate, choice branches, schedule rows, act fields | pre-checks pass → **owner sign-off #2**. The score is then frozen; deviations go back to it first |
| 3 | **Golden scenario, red** | `scripts/qa-<story>.ts`, transcribed from the score and added to `qa:all`; the act's prover goals listed | it fails because the content is absent, not because it does not compile; the new prover goals are UNREACHABLE |
| 4 | **Implement** | Story JSON under `stories/<id>/` | `npm run qa:story`, the golden, the prover (every act, Clue and ending REACHABLE, search not capped) and `npm run qa:all` green; then `narrative-consistency-reviewer` |
| 5 | **Playtest** | blind run (`game-reviewer`), owner run against the score, `qa-playthrough` for live narration | findings triaged (below) |
| 6 | **Done** | | the golden stays in `qa:all` permanently |

Plan Phase 6 adds a story skill that turns narrative prose into locations, Objects, people, Facts, Rules and Beats. That skill is the translator for phase 4; this process is the gate around it. Until it exists, phase 4 is hand-written JSON, with the `add-npc` skill for each new person. Neither skill, nor a subagent, is invoked before sign-off #2.

## The mechanical score

One row per beat. Every column must be filled: a blank cell is an undesigned decision, and undesigned decisions are where Act 0's fix commits came from.

| Column | Pins down class |
|---|---|
| **Trigger**: the Rule's trigger kind and fields (`action` with *every* verb a player might reach for, `enter`, `flag`, `clock`, `proximity`, `disclosed`, `combine`, `deduction`, `tick` with weight), `once`, and the Effects it fires, in order | 1, 6 |
| **Turn window**: the `when` conditions (`act`, `location`, `period`, `weather`, `flagsAll` / `flagsNone`, `hasItems`, `personsPresent`, `factsKnown`) | 1 |
| **Narration**: the mode the turn lands in, its word budget, and whether every `playBeat` line fits next to what else the turn narrates | 5 |
| **People on stage**: schedule entries or `summonPerson` / `movePerson`; what the sidebar's persons list shows (alias until introduced) | 2 |
| **Objects**: `name` and `aliases`, placement, `hidden` until which `revealObject`; every other Object that can share the Candidate Set | 2, 3 |
| **Facts newly askable**: id, `knownBy`, `visibleFromAct`, every `topics` phrase, `voices`, `spoilerTerms` | 1, 8 |
| **Subjects made askable**: every proper noun or specific thing this beat says aloud, and the Fact whose topics cover it (or "deflects, intended") | 7 |
| **Identity anchors**: how this beat's own text, or the person's `beats`, establishes who each not-yet-named person is (sex, standing, manner) | 9 |
| **Quantities**: every number stated, or `none`; never a vague measure that invites a precise answer the invention gate will then reject | 10 |
| **Diary**: the Clue (name, summary, connections) or document this beat puts in the diary | 4 |

Plus, once per act:

- **The gate**: which Rule's `advanceAct` ends the act, and every condition it needs.
- **The choice**: each branch, the flag it sets, and every downstream Rule or condition that reads that flag.
- **Schedule rows**: one per person on stage, act × period → `at` / `follows` / `offstage`.
- **Act fields**: `anchorLocation`, `startClockMinutes`, `dateLabel`, `weather`. Entering the act moves the player to the anchor, which counts as entering that location for `enter` Rules and as an arrival for everyone there; sets the clock to `startClockMinutes`; delivers every delayed `grantFact` still in flight; and clears every person moved by an Effect back to the new act's schedule. The opening behaves the same way for the opening act and location (ADR-0005).

The worked example is Act 0's score (`docs/act0-mechanical-score.md`). Its columns name the pre-rebuild mechanisms (resolver flag grammar, story events); the dimensions it pins are the same ones this score pins, which is why the score survived the rebuild and the code did not.

## Pre-checks (mechanical, before sign-off #2)

- **Schema fit.** Every row is expressible with the existing Trigger, Effect and Condition unions in `packages/schema/rule.ts` and `common.ts`. If one is not, that is an open question for the owner ("what general mechanism is missing?") and engine work with its own review, never a story-shaped workaround with flags.
- **Name collisions.** Each new Object or person name and alias against every Object, person and exit name that can share a Candidate Set with it (here, carried, or present). This is the check that would have caught `open the box`; under the selection model the symptom is no longer the wrong Object but `none`. Note that today the Candidate Set carries each Object's `name` only (`packages/engine/candidates.ts`): `aliases` are recorded in the Story but the selection model never sees them, so a name the player cannot plausibly type is not rescued by an alias.
- **Verb coverage.** For each `action` Rule, every phrasing in the score mapped to the verb the selection prompt's glossary (`packages/ai/prompts.ts`) would choose for it, and every such verb listed in the trigger. This replaces the old phrasing probe through the regex parser. There is no offline harness for the model itself; with `GEMINI_API_KEY` set, a phrasing can be checked live against the Candidate Set at that beat the way `scripts/smoke-gemini.ts` does for one line.
- **Topic collisions.** No phrase shared between Facts (`qa:story` fails exact duplicates) and no near-synonym or containment between Facts the same person knows.
- **Flags.** Every flag read is set by some `setFlag` and every flag set is read (`qa:story` fails the first and warns on the second). Built-in verbs set no flags: a flag exists only because a Rule sets it. Name flags for the world state, not the beat (`study_door_unlocked`, not `beat_7_done`).
- **Presence.** Every person a beat needs has a schedule entry for that act (and period), or arrives by an Effect, and the score says which. `personsPresent` in a `when` makes the dependency explicit.
- **Chronology.** Every date, time and duration stated once, in a canonical block in the score; beats cite it rather than restating it.
- **Spoilers.** Each Fact visible after the act's start lists `spoilerTerms`, and the score's beats avoid them. `qa:story` fails a leak into the opening, or into a Rule that can fire before the Fact's act, and warns on location, Object and person beats. `visibleFromAct` gates who may *tell* the player a Fact, not when the player may learn it (ADR-0005): `qa:story` warns on a `grantFact` to the player that can fire earlier, and the prover lists every Fact the player can learn early, from a document or a Rule, as EARLY with its path. Each EARLY line is either a deliberate early clue, said so in the score, or a leak.

## The golden scenario

`scripts/qa-<story>.ts`, one scenario per act, added to `qa:all`. It drives the real engine the way `scripts/qa-stress.ts` drives the stress fixture: a `Run` holding State and the Event log, opened with `startInvestigation` (the opening turn, as the server plays it), turns issued with `resolveTurn` and explicit Selections, idle time with `tick`, randomness pinned with `fixedRng`. The selection model is not in the loop. A golden proves that a given Selection produces the scored world; whether a player's words produce that Selection is the verb-coverage pre-check and the playtest.

- Transcribe the score, don't improvise: each step asserts the flags, presence, visibility, askability (`candidates(...).topics`) and Rules fired that the score's row promises.
- Assert **negatives** too: not present before, not askable before, examine does not satisfy open, a `once` Rule does not fire twice, the other branch's flag is unset. The bug classes live in the negatives.
- Assert the **narration context** where the score pins it: `buildNarrationContext` for the beat's turn carries the Beats, the Fact statements and the persons' labels the score lists. That is the seam where a dropped reveal would show.
- Branches (the act's choice) get their own scenario, including the diary each branch produces.
- End each scenario with an exact replay check (`replay(story, log, seed)` equals the final State), as `qa-stress.ts` does.
- Goldens run in `qa:all` forever. A later engine change that breaks an act's timeline should fail loudly.

**The prover is the complement, not a substitute.** `packages/engine/prover.ts` searches the real engine breadth-first (clock bucketed by period, every eligible tick Rule branched) and reports every act, Clue and ending as REACHABLE with its shortest path, or UNREACHABLE. It tries only Selections the turn endpoint would accept against that moment's Candidate Set, starts from the opening turn, and can always wait to the next period: a step "wait until X" stands for as many waits as it takes. It proves a path exists; it does not prove a player would find it, or that a beat lands when the score says. Record the goals an act adds in the score, confirm they are UNREACHABLE before implementing, and REACHABLE with the search uncapped after. Until a Story under `stories/` is wired into `qa:prove` (which covers the fixtures today), run it directly:

```bash
npx tsx -e "import { Story } from './packages/schema/index.ts'; import { loadStoryDir } from './packages/schema/load.ts'; import { prove, formatProof } from './packages/engine/prover.ts'; console.log(formatProof(prove(Story.parse(loadStoryDir(process.argv[1])))))" stories/<id>
```

## Rules for scripted scenes

The pre-rebuild engine had three systems for things that happen: story events (action-triggered scenes), world events (clock broadcasts) and rumors (authored knowledge hops). All three are now Rules, and so is anything the old ambient-texture systems did:

| Old system | Now |
|---|---|
| Story event on a resolved action | `action` Rule (or `combine`, `deduction`) with `when` conditions and a `playBeat` among its Effects |
| World event at a clock time | `clock` Rule (`atMinutes`, optionally `act`) with `playBeat` and `asQuote: true` |
| Rumor hop | `disclosed` or `flag` Rule with `grantFact` and `delayPeriods`. It matures after that many period boundaries, or on entering any act, whichever comes first |
| Arrival or departure | `summonPerson` / `movePerson` / `dismissPerson` in the Rule that motivates it, or a schedule entry. A scene on meeting someone is a `proximity` Rule: it fires on the arrival, whoever moved |
| Ambient life | `tick` Rule with a `weight`; the engine draws one among the eligible and records the draw |

Author each Rule that carries a scene as a compact contract in the score:

```md
Rule id:
Trigger: kind + fields; for `action`, every verb the player might reach for, target ids, person
When: act / location / period / flagsAll / flagsNone / hasItems / personsPresent / factsKnown
once: true, or false and why it may repeat
Effects, in order: setFlag …, revealObject …, summonPerson …, playBeat [numbered beats]
Narration: the turn's mode and budget, and what else shares it (location beats on a move, the Object's beats on examine)
Read bare: the beats joined still read as prose (the gate's fallback)
```

How the engine runs them, which the contract must account for:

- **Every eligible Rule fires.** There is no "at most one main event per action": two Rules on the same action both fire unless their conditions exclude each other. Use `flagsNone` on a flag the first one sets.
- **Firing order** is the action, then `leave`, then `enter`, then arrivals (`proximity`), then the Firings those Rules' Effects raise, depth by depth. The order the Story lists Rules applies only among the Rules of one Firing (ADR-0005).
- **What each trigger's `when` sees.** Every trigger sees the world after the action: on `action: take x`, `hasItems: [x]` already holds; on `enter`, `location` is the room entered. The exception is `leave`, which is judged from the room being left, with the player still there, so `location` and `personsPresent` name that room.
- **`proximity` fires on arrival**, once per arrival: when the player walks in on someone, when a Rule, a schedule or an act entry brings someone to the player, or at the opening. It does not fire again on the turns they stay together, even with `once: false`. Ambient chatter while someone stays present is a `tick` Rule with `personsPresent`.
- **`clock` Rules** fire when the clock passes their time during their act. A time exactly at the act's start never fires on entry and fails `qa:story`; use an `enter` Rule on the anchor. A time earlier in the day than the act's start fires once the clock runs past midnight, which is right for an evening act's midnight bells and is warned on when it would mean a wait of more than twelve hours.
- **Rules cascade.** Effects become Events, and a `FlagSet`, `FactDisclosed`, move, act entry or combine can trigger further Rules in the same turn, to a depth of 8. A chain longer than that is cut silently; keep chains short and assert the last link in the golden.
- **`once` is required on every Rule**, so a puzzle that should fire once is never left repeating by accident.
- **A queued Beat makes the turn `full`** (160 words), or `opening` (220) on the first turn. Budgets are in `packages/engine/projections.ts`; the mode is chosen in `server/turn.ts`. The budget is shared: a Rule that fires on `enter` shares it with the location's beats, one that fires on `examine` with the Object's. A reveal that needs more than the budget has left must be cut down or moved to its own turn; the narrator treats the budget as a ceiling.
- **Beats are mandatory and in order.** The narrator must carry every Beat's substance in order. Beats describe meaning, not copy-ready prose, except where the beat is a quotation.
- **Beats are self-contained.** Each narration call sees this turn's context, the person's `beats`, the Ledger and a Transcript window, but not the prose of earlier turns. A beat that refers to someone established two turns ago restates who they are, or relies on that person's `beats` to do it.
- **Acknowledge the player.** If a beat overtakes the player's action ("Mrs Hudson beats him to the stairs"), the beat shows the attempt beginning first.
- **`asQuote`** is recorded on the `BeatQueued` Event; the feed does not yet render it differently from other prose.

Every scene Rule ships with three levels of proof, all in the golden:

- **Positive**: the Rule fires for each verb in its trigger, and its Effects land.
- **Negative**: premature, blocked, wrong-location, wrong-person and second attempts do not fire it, including the other side of every `flagsNone` exclusion and the boundary of every `clock` time.
- **Path**: the act's real turn order, asserting prerequisites, Effects, visibility, the narration context's Beats and the branch outcome.

## Playtest triage

Every playtest finding is one of two things:

- **Spec violation**: behaviour contradicts the score. Fix order: score first (was it wrong?), then the golden assertion, then the data. Never patch data against an unamended score.
- **Taste**: the score is honoured but the experience needs polish. Budget one deliberate polish cycle per act; this is normal, not churn.
