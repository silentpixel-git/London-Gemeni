// Built-in verb resolution: an Intent against the current State becomes the
// Events the verb itself causes. Rules add everything else (see rules.ts).
//
// CONTRACT (Phase 1). resolveVerb never mutates, never reads the clock, never
// fires Rules, never discovers Clues (the engine does that from FactLearned /
// FactDisclosed). A target that is not in the Candidate Set yields a single
// IntentRejected with a short in-world reason and nothing else.
//
//   look        → Looked
//   inventory   → InventoryChecked
//   examine T   → Examined{T}; T must be visible here or carried; a person may be examined (Examined{person id})
//   read T      → Read{T}; T visible or carried; if T.fact and the player does not know it → FactLearned{player, fact}
//   take T      → Taken{T}; T an item, visible here (incl. inside an open visible container), not carried
//   drop T      → Dropped{T}; T carried
//   open T      → T a container visible here or carried: closed → Opened; locked → lockOpen(lock) ? Opened : OpenBlocked{lock}; open → IntentRejected
//   close T     → T an open container visible or carried → Closed
//   use T [on S]→ Used{T, on?}; T carried or visible; S if given must be visible, carried, or a present person
//   combine T S → Combined{[T,S]}; both carried or visible here; no self-combine
//   show T to P → Shown{T,P}; T carried; P present; then if T.fact and the player knows it and P does not already → FactDisclosed{player→P}
//   give T to P → Given{T,P}; same conditions; same disclosure
//   talk P      → Spoke{P}; P present
//   ask P topic → P present; topic a fact id:
//                 canTell(P, fact) → Spoke{P, fact}, FactDisclosed{P→player}
//                 else player knows fact and P does not → Spoke{P, fact}, FactDisclosed{player→P}
//                 else → Spoke{P} (an honest deflection; no fact)
//   deduce      → Deduced{facts, suspect?}; every named fact must be known by the player; suspect must be a person id
//   move exit   → exit in this location by id: location.openPeriods excludes now → MoveBlocked{closed, null};
//                 !lockOpen(exitLock) → MoveBlocked{locked, lock}; else Moved{from, to, exit}
//   wait        → never reaches here (the engine ticks)
//
// Inventory is the set of Objects whose placement.kind === 'inventory'. There is no other list.
import type { EventPayload, Id, Story, Verb } from '../schema';
import type { State } from './state';

export interface Intent {
  verb: Verb;
  target?: Id;
  secondary?: Id;
  person?: Id;
  topic?: Id;
  exit?: Id;
  facts?: Id[];
}

export function resolveVerb(_story: Story, _s: State, intent: Intent): EventPayload[] {
  throw new Error(`resolveVerb not implemented (verb ${intent.verb})`);
}
