# packages/schema

The contracts of the rebuilt engine (plan: `docs/engine-rebuild-plan.md`, vocabulary: `GLOSSARY.md`). Pure Zod schemas plus a validator; nothing here imports the old `engine/`, React, Supabase or an AI SDK.

| File | Holds |
|---|---|
| `common.ts` | Ids, TimePeriod, Weather, Disposition, Verb, Lock, Placement, Conditions |
| `story.ts` | Story and its collections: Act, Location/Exit, Object, Person/Schedule, Fact, Clue, Ending, Opening |
| `rule.ts` | Rule = Trigger (9 kinds) + Effects (18 kinds). Closed unions; see ADR-0004 |
| `event.ts` | The Event log union and Observation (ADR-0001, ADR-0002) |
| `candidates.ts` | Candidate Set and Selection (ADR-0003), and `inCandidateSet`, the membership check every consumer shares (ADR-0005) |
| `narration.ts` | NarrationContext and NarrationResult |
| `validate.ts` | `validateStory(raw)`: shape, referential integrity, flags, progression, spoiler scan. The reachability prover is Phase 1 and lands here |
| `load.ts` | Node-only: `loadStoryDir(dir)` merges `story.json` + one JSON file per collection |
| `fixtures/` | `toy` (passes; uses every Trigger kind), `empty` (must fail), `broken` (toy with three authored faults) |

Choices a later phase should not undo without reading the plan:

- **Flags are implicit strings.** A flag exists because an Effect sets it. The validator fails any flag that is read but never set, and warns on the reverse.
- **`once` is required on every Rule.** A puzzle left repeating by accident is the default failure mode; the author states it.
- **Objects have one identity.** Carried or on a table, the same id. `placement.kind === 'inventory'` is the inventory; there is no separate item list.
- **A Fact's `visibleFromAct` gates speech, not learning** (ADR-0005). No person tells the player the Fact before that act. A document or a Rule may still teach it earlier: the validator warns on a `grantFact` to the player that can fire earlier, and the prover lists each such path it finds as EARLY. `spoilerTerms` extend the gate to prose beats, where a leak fails validation.
- **The Selection check is here.** `inCandidateSet` (`candidates.ts`) is the one rule the selection adapters, the turn endpoint and the prover all apply, so the prover proves only what a player can select.
- **`quietWeight`** (optional integer >= 1, on the Story) is "nothing happens" in an idle Tick's draw: it takes the last share beside the eligible tick Rules' weights, and a draw landing there fires no Rule (`TickResolved.rule` null). The explicit `wait` verb draws the same way, and the prover branches over the quiet outcome as it does over each Rule. Absent, a Rule fires whenever one is eligible.
- **Ambience is data, not client code.** `ambience` (a sound id) on a Location and on a WeatherState, and on an Act a map of location id → sound id overriding that location's bed for the act (validated: its keys are locations). `playerView` resolves them into `PlayerView.ambience { bed, weather }`; the client maps ids to files and plays nothing for an id it does not know.
- **Verbs are closed.** A Story adds behaviour with Rules, never verbs.
