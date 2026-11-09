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
- **Verbs are closed.** A Story adds behaviour with Rules, never verbs.
