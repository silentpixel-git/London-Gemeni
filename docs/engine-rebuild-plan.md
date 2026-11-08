# Engine Rebuild Plan

Decided 2026-11-07 in a grilling session. Vocabulary is in [`GLOSSARY.md`](../GLOSSARY.md); the four load-bearing decisions are recorded in [`docs/adr/`](./adr/). This plan supersedes Parts 2 and 4 of *London Bleeds — Rebuild-from-Scratch Brainstorm & Improvement Backlog* (most of whose HIGH items have since shipped; what remains is the rest of this document).

**Verdict first.** The engine's founding idea is right and stays: a deterministic engine decides, the AI narrates. Six structural choices around that idea are wrong for the stated goals, and each one maps directly onto a bug class the owner has had to find by playtesting. They cannot be fixed incrementally because they are the shape of the engine, not defects in it. The engine is rebuilt as a new package in this repository; the React UI, Supabase auth and audio are kept.

---

## 1. Assessment of the current engine

### 1.1 What is right and is carried forward

| Kept | Where it lives today | Becomes |
|---|---|---|
| Engine decides, AI narrates | `engine/`, `server/aiCore.ts` | The same contract, with a precise Fact/Flavour boundary (ADR-0002) |
| Fact graph with per-person knowledge derived mechanically | `facts.ts`, `stories/knowledge.ts` | The Fact model, unchanged in spirit |
| Per-act, per-period schedules for people | `scheduleByAct`, `presence.ts` | Schedules driven by the clock and Ticks |
| Authored rumor hops | `rumors.ts` | Rules with a "fact disclosed" Trigger and a delayed "grant fact" Effect |
| Prompt discipline: no invented specifics, context-is-the-world, invention detector | `aiCore.ts` rules 12–13, `qa-invention.ts` | The server-side invention gate on every narration |
| STIM observations | `stimUpdate` | Observations (now Events, so they replay) |
| Scripted QA harness culture, no browser needed | `scripts/qa-*.ts` | Same culture; the harness replays Investigations |
| The UI, the Act 0 prototype as its source of truth, the audio layer | `components/`, `docs/act0-prototype.html` | Kept; the feed renders from the Event stream |

### 1.2 What is wrong, and which reported bug each causes

| # | Structural choice | Reported symptom | Root cause (verified in code) |
|---|---|---|---|
| 1 | **Regex parser first, AI as fallback** | "Parser didn't understand"; carried objects not found when examined | `intentParser.ts` (963 lines) resolves targets against the location's interactables. Inventory is `string[]` of display names (`TAKEABLE_OBJECTS: Record<objectId, displayName>`), so a carried thing is not an Object with an identity; `examine.ts` has a special-case branch for it that only works if the parser already guessed the source object id. |
| 2 | **NPC memory written by the narrator model** | Characters deny what they just said | `npcMemoryUpdate` is a ~10-word summary the narration model writes about itself; 5 kept, 2 injected (`narrationContext.ts:257`). What the person actually disclosed is never recorded as data, so no prompt can make it reliable. |
| 3 | **Mutable snapshot state, flag bag of strings** | Resume fidelity bugs; gates failing silently; bugs that cannot be reproduced | `session.ts` is a snapshot; `flags.ts` is a 116-line hand-maintained union; a bug report is a prose description, not a replayable log. |
| 4 | **Three event systems, all action- or clock-triggered** | A passive world; no puzzles | `WorldEventDefinition` (clock, narration-only), `StoryEventDefinition` (intent-on-target, sets flags and inventory strings), `RumorDefinition` (flag-triggered knowledge). Nothing fires on entering a location, a flag becoming true, combining Items, a Tick or proximity. No Effect can move a person, unlock an exit or reveal an Object. |
| 5 | **Story compiled as TypeScript** | Story hard to modify; content bugs found only in play | 13 data files, cross-referenced by magic strings. `qa:validate` catches dangling ids but cannot prove an act reachable. No tool can display a location's wiring. |
| 6 | **Engine in the browser** | Two round-trips per AI-assisted turn; state truth in the browser between saves | `useGameState.ts` (1129 lines) is the only place engine and AI meet; parse fallback and narration are separate server calls. |

### 1.3 Why not fix in place

Items 1, 3 and 6 are each a different answer to "where does a turn happen and what is the state". Items 2, 4 and 5 are each a different answer to "what is the story made of". Changing any one of them touches the same files as the others. The brainstorm's strangler-fig plan was right when the UI and server gateway still had to be built; those are done, and what remains is the core. There is no live audience, so there is nothing to protect.

---

## 2. Target architecture

**Governing principle: the engine is story-agnostic.** The current Whitechapel content is incomplete and is not an input to engine decisions. Anything a story could reasonably want to vary is declared in the Story, never fixed in the engine: the day's periods and their boundaries, the weather states, the people, the facts, the rules. The engine owns only what every text adventure shares: verbs, placement, locks, time passing, rules firing, and the event log. When a piece of content does not fit, the question is "what general mechanism is missing?", never "how do we special-case this story?".

### 2.1 Packages

```
packages/
  schema/        Zod schemas: Story, Rule, Event, Candidate Set, Selection, Narration
  engine/        Pure TypeScript. No React, no Supabase, no AI SDK. Reducer, verbs, Rules, Ticks, prover
  ai/            The select/narrate interface and provider adapters (Gemini first)
stories/
  whitechapel-1888/   Data files (YAML or JSON) validated by packages/schema
server/
  turn.ts        One endpoint: text in, Events + narration stream out
tools/
  editor/        Local-only web editor over stories/*, with live validation and scene preview
components/, hooks/   The existing UI, re-pointed at the Event stream
```

`packages/engine` has one public function per concern and imports nothing outside `packages/schema`.

### 2.2 The turn

```
player text (or idle timer / WAIT)
   │
   ▼
Candidate Set  ← engine.candidates(state)          Objects here + carried, people present, exits,
   │                                                 topics the addressed person can speak to, verbs
   ▼
select(text, candidates) → Selection | none         cheap model; exact commands bypass it
   │                                                 Selection is validated against the set; anything
   ▼                                                 outside it is rejected before resolution
engine.resolve(state, intent, rng) → Event[]        deterministic; built-in verbs + Rules + Ticks
   │
   ▼
append Events to the Investigation log              one writer, server side
   │
   ▼
narrate(ctx) → prose stream + Observation[]         strong model; ctx = this turn's Events, Beats,
   │                                                 allowed Facts, relevant Observations, Ledger,
   ▼                                                 Transcript window, scene
invention gate → accept, or regenerate once          proper nouns / numbers not in ctx are rejected
   │
   ▼
Observations appended as Events; stream to client
```

Target latency budget per turn: select ≤ 700 ms, first narration token ≤ 1.5 s after input. The feed shows the typed line immediately and the typewriter hides the rest.

### 2.3 World model (the Story)

- **Location**: name, description beats, exits. An **Exit** has a destination and an optional lock (flag or key Item).
- **Object**: one identity wherever it is. `placement` is one of `location`, `container`, `inventory`, `person`, `nowhere`. Optional `document` text (readable), `container` (holds Objects, open/closed/locked), `item: true` (carriable). Examine, read, take, open, use, combine, show and give all target Objects by id.
- **Person**: display name, alias and introduction condition, schedule (act × period → location, or `follows: personId`), disposition, knowledge (Fact ids), demeanor beats.
- **Fact**: statement, `knownBy`, `visibleFromAct`, spoiler tier, topic phrases. A topic is the set of phrases that resolve to a Fact; a person can speak to a Fact if they know it and the act allows it.
- **Clue**: a Fact the player can discover, with connections to other Clues and the act gate it serves.
- **Period** and **Weather**: declared by the Story (a list of named day divisions with start times; a list of named weather states). Schedules, conditions and acts refer to them by id.
- **Act**: name, anchor location, canonical start time, weather, entry Rule.
- **Rule**: `{ id, trigger, conditions, effects, weight?, once? }`.
- **Beat**: authored lines a Rule or verb hands to the narrator.

The entire whitechapel-specific vocabulary (`follows_bond`, hint selectors, approaches) is expressed as data or deleted. The engine contains no story name.

### 2.4 Rules

Triggers (closed union):

| Trigger | Fires when |
|---|---|
| `action` | A built-in verb resolves on a target (examine, read, take, open, use, combine, show, give, talk, deduce) |
| `flag` | A flag becomes true |
| `enter` / `leave` | The player enters or leaves a location |
| `clock` | The Investigation clock passes a time of day during an act |
| `tick` | An idle or WAIT turn, subject to conditions and weight |
| `combine` | Two named Items are used together |
| `disclosed` | A Fact is told by or to a person |
| `proximity` | The player and a person are in the same location at the start of a turn |
| `deduction` | The player names a set of Facts or a suspect |

Effects (closed union): `setFlag`, `revealObject`, `hideObject`, `moveObject`, `giveItem`, `takeItem`, `lockExit`, `unlockExit`, `movePerson`, `summonPerson`, `dismissPerson`, `grantFact(person, fact, delay?)`, `setDisposition`, `playBeat`, `cue(audio)`, `advanceAct`, `endGame(ending)`.

Conditions: act, location, time period, weather, flags required and forbidden, Items held, people present, facts known by the player.

Selection on a Tick: all eligible `tick` Rules are weighted; one is chosen with a random number drawn from the Investigation's seeded generator, and the draw is recorded in the `TickResolved` Event so replay is exact. No Rule eligible means a quiet Tick (clock advances, schedules move people, nothing narrates unless a scheduled move is visible).

This single mechanism covers all four puzzle kinds decided on: deduction (`deduction` trigger → `unlockExit`/`advanceAct`), social (`disclosed`/`action: show` → `setDisposition`/`grantFact`), object and mechanism (`combine`/`action: open` with locks → `revealObject`), timing and place (`clock`/`proximity`/`tick` → `summonPerson`/`playBeat`).

### 2.5 State: the Event log

An **Investigation** is an ordered list of Events. The reducer folds them into `State`; every projection (Candidate Set, feed, diary, Ledger, Transcript, narration context) is a function of `State` or of the log. Event types, closed union:

`InvestigationStarted(story, seed)`, `TurnReceived(text)`, `IntentSelected(intent)`, `IntentRejected(reason)`, `Moved`, `Examined`, `Read`, `Taken`, `Dropped`, `Opened`, `Used`, `Combined`, `Shown`, `Given`, `Spoke(person, topicFact?)`, `FactDisclosed(from, to, fact)`, `ClueDiscovered`, `FlagSet`, `ObjectPlaced`, `ExitLockChanged`, `PersonMoved`, `DispositionChanged`, `RuleFired(rule, draw?)`, `TickResolved(minutes, draw)`, `ClockAdvanced`, `ActEntered`, `Narrated(text, beats)`, `ObservationRecorded`, `GameEnded(ending)`.

The **Disclosure Ledger** is the projection of `FactDisclosed` per person. The **Transcript** is the projection of `Spoke` + `Narrated` per person, windowed. Neither is ever written by a model.

Persistence: two tables, `investigations (id, owner_id nullable for guests, story_id, name, created_at, last_event_seq)` and `events (investigation_id, seq, type, payload jsonb, created_at)`. A guest's investigations carry the Supabase anonymous user id; signing in links them. Replay cost is bounded by caching a snapshot every N Events, which is an implementation detail and never the source of truth.

### 2.6 Narration and the Fact/Flavour boundary

`narrate(ctx)` returns `{ prose, observations: Observation[] }` where an Observation is `{ key, subject: objectId | personId | locationId, text }`. The invention gate (today's `findInventions`, run server side) rejects prose containing a proper noun or numeric specific present in neither `ctx` nor the Investigation's Observations; one regeneration is attempted, then the engine falls back to the Beats alone. An unknown target that the selection model answered `none` for is resolved as a `Flavour` intent: the narrator may describe it, subject to the gate, and the result is an Observation, never an Object.

### 2.7 Validator and prover (build-blocking)

Integrity: every id resolves; every Object has exactly one initial placement; every exit destination exists; every person has a schedule entry for every act they appear in; every flag an Effect sets is read somewhere and every flag a condition reads is set somewhere; every Fact's spoiler tier is not below its `visibleFromAct`; every Beat's text passes the spoiler scan.

Reachability: an abstract interpreter over `(act, location, flags, inventory, facts known, time bucket)` applies built-in verbs and Rules breadth-first from the opening state and reports, for every act gate, Clue and ending, the shortest action path or **UNREACHABLE** with the last satisfiable condition. The output doubles as the walkthrough. Clock is bucketed by time period to keep the state space finite; `tick` Rules are treated as always available.

Both run on `npm run build` and on save in the editor.

### 2.8 Editor

A Vite route served only by the dev server (`/editor`), file-backed through a dev middleware exactly as `/api/ai` is today. Views: location graph with exits and locks; Object placement per location; person schedule grid (act × period); Fact table with knownBy and spoiler tier; Rule list with the prover's verdict per Rule; scene preview that runs one `narrate` on a chosen location and turn. Every save re-runs the validator and shows errors inline. No hosting, no auth, no database.

### 2.9 AI interface

```ts
interface Ai {
  select(input: string, candidates: CandidateSet): Promise<Selection | { none: true }>;
  narrate(ctx: NarrationContext): AsyncIterable<NarrationChunk>;
}
```

Each capability is configured by environment (`AI_SELECT_MODEL`, `AI_NARRATE_MODEL`, provider per job). Gemini is the first adapter. Nothing in `packages/engine` imports `packages/ai`.

---

## 3. How each reported problem is eliminated, mechanically

| Problem | Mechanism in the target | Why it cannot recur |
|---|---|---|
| Characters do not remember what they said | Disclosure Ledger from `FactDisclosed` Events, Transcript window, both injected as hard facts | Written by the reducer, not by a model; replays with the log |
| Carried objects not found | Objects have one identity; `placement: inventory` is in the Candidate Set every turn | There is no separate inventory string to miss |
| Parser does not understand natural phrasing | Selection model over the full Candidate Set, every turn | Aliases and typo tables no longer exist to be incomplete |
| Content bugs found only by playtesting | Build-blocking integrity + reachability prover; editor shows verdicts on save | An unsolvable or dangling Story does not build |
| Passive world | Ticks, `clock`/`proximity`/`tick` Rules, schedules driven by the clock | Life is authored data the prover and editor can see |
| No puzzles | One Rule system with nine Trigger kinds and locks, containers, combine, deduction | Puzzles are content, not engine special cases |
| Story hard to modify | Data files + editor + skill | Editing a Story never touches TypeScript |
| Saves and accounts | Named Investigations, exact replay, guest claim | Resume is replay; there is no snapshot to drift |
| Narrator invents names and figures | Server-side invention gate on every narration | Rejected before the player sees it |

---

## 4. Phased path

Each phase ends with a check that can be run without a human. The old engine keeps running untouched until Phase 4 flips the UI; nothing from it is imported into `packages/`.

| Phase | Builds | Done when |
|---|---|---|
| **0 — Contracts** | `packages/schema` (Story, Rule, Event, Candidate Set, Selection, Narration), validator skeleton, this plan, glossary, ADRs | `npm run build` fails on an empty Story and passes on a 3-room toy Story committed as a fixture |
| **1 — Core engine** | `packages/engine`: reducer, Candidate Set, built-in verbs, Rule evaluator, Ticks with seeded draws, Ledger and Transcript projections, prover | `qa:engine` drives the toy Story through every verb and Trigger kind; prover proves the toy ending reachable and flags a deliberately broken copy UNREACHABLE; a recorded log replays to an identical State |
| **2 — Stress fixture** | A second, story-neutral fixture authored from scratch to stress what the toy cannot: several acts, a companion who follows, a key found elsewhere than its lock, a rumor that travels between people with delay, a location open only in some periods, a timing puzzle, a social puzzle. No current-story content: the engine is proven against invented content so that no existing beat can bend it (see the governing principle in §2) | Validator and prover green on the fixture with every act, Clue and ending REACHABLE; `qa:stress` asserts the behaviours the toy cannot reach (companion moves with the player, closed-period exit, delayed rumor arrives, rule-unlocked path) |
| **3 — Server turn + AI** | `packages/ai` (interface, Gemini adapters), `server/turn.ts`, invention gate, Observations, Supabase `investigations` + `events` tables with anonymous auth | A scripted playthrough of Acts 0–I through the endpoint with recorded `select` fixtures passes; narration fixtures reviewed via the existing `qa-narration` flow |
| **4 — UI cut-over** | Feed, sidebar, diary render from the Event stream; idle timer emits Ticks; investigations list replaces slots; guest-then-claim | Acts 0–I played in the browser; the same Investigation resumed in a second browser renders identically; old `engine/`, `hooks/useGameState.ts` and `server/aiCore.ts` deleted |
| **5 — Editor** | `tools/editor` with the six views and live validation | A location, a person, a Rule and a Fact can each be created, saved and proven from the editor without touching a file by hand |
| **6 — Story skill + the Whitechapel story** | A Claude skill that breaks narrative prose into locations, Objects, people, Facts, Rules and Beats in the Story schema; the Whitechapel story authored with it for this engine, all acts, puzzles designed per 2.4 | Prover proves all endings reachable; `game-reviewer` blind playthrough finds no dead ends |

Phases 0–2 have no UI and no AI and can be verified entirely by scripts. Phase 2 is where a missing Trigger or Effect shows up: if an invented puzzle cannot be expressed as Rules, the unions are incomplete, and that is cheaper to learn on a fixture than on real content. The current story is ported only in Phase 6, through the skill, and only once the engine has been proven without it.

---

## 5. Risks and implementer notes

- **Prover state explosion.** Bucket the clock by time period and treat Items as a set; cap breadth-first depth per act and report the cap as a warning, not a pass.
- **Selection latency.** Exact-command fast path; keep the Candidate Set compact (ids plus one display name each, no descriptions); cache the Story portion of the prompt.
- **Fact/Flavour leakage.** The gate catches proper nouns and numbers. It does not catch an improvised "a bloodstain on the sill" that a player reads as a clue. Beats for clue-bearing Objects must state what is there, and Observations are tagged `flavour` in the feed's data so a QA script can list them for review.
- **Pull of existing content.** When Phase 6 ports the current story, some beats will not fit. The answer is a general mechanism added to the unions with prover support, or dropping the beat; never a story-shaped special case in the engine.
- **Guest claim.** Supabase anonymous sign-in plus `linkIdentity` on magic-link; Investigations are re-owned by one update. Keep RLS on `owner_id`.
- **Cost.** One cheap selection call and one narration call per player turn; Ticks that resolve to nothing narrate nothing and cost nothing.

## 6. Explicitly unchanged

- The six-act, authored-mystery structure; dynamism goes into texture, never plot generation.
- The UI restraint principles in `docs/game-design.md` and the `game-direction` skill: no minimaps, no progress bars, no system voice.
- Pure text. Audio stays cue-driven; cues become Rule Effects so they are data.
- Supabase for auth and storage; Vercel for hosting.
