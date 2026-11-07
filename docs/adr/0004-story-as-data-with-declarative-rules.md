---
status: accepted
---

# Story as data files with declarative Rules, not code

Story content is currently TypeScript compiled into the app, with three separate event mechanisms (clock broadcasts, action-triggered story events, rumor hops) and hardcoded verbs. Nothing can fire on "flag became true", "entered location", "items combined" or a Tick, and no tool can see or prove the wiring. We decided that a Story is a set of schema-validated data files in the repository, and that every puzzle, scripted scene, scheduled happening and piece of ambient life is a **Rule**: one Trigger paired with Effects, both drawn from closed, typed unions. Because Rules are data, a prover can walk them and show every act gate, clue and ending reachable, and an editor can display them.

## Considered options

- **Scripted hooks in code per story.** Rejected: unlimited flexibility, but nothing can be validated or displayed, and puzzles become code bugs instead of content bugs.
- **Story in Supabase with a hosted admin UI.** Rejected: two sources of truth, harder to diff and review, and the agent-driven authoring flow would need database access.
- **Stay in TypeScript, extend StoryEvents.** Rejected: no clock, Tick or enter triggers and no effects beyond flags and inventory.

## Consequences

- When a hard case does not fit the Trigger or Effect unions, the union is extended and the prover taught about it; a JavaScript escape hatch is not added.
- The validator is build-blocking: a Story with a dangling id, a leaked spoiler or an unreachable gate does not build.
- A second Story needs no engine change.
