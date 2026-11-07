// Read models over State for the narrator (Phase 3 fills the prompt side).
//
// CONTRACT (Phase 1): buildNarrationContext(story, s, turnEvents, mode)
//   act/clock/location   from State and the Story
//   personsPresent       label = introduced ? name : alias ?? name; beats = person.beats
//   objectsVisible       visibleObjects(here) + inventory, by name
//   events               turnEvents verbatim
//   beats                flattened from s.beats (BeatQueued this turn), plus Location.beats on Moved/Looked,
//                        Object.beats on Examined, Object.document on Read, Ending.beats on GameEnded
//   facts                Facts disclosed or learned by the player THIS turn (from turnEvents), with the
//                        speaker's voice where a FactDisclosed came from a person who has one
//   observations         s.observations whose subject is the location, a present person, or a visible/carried object
//   ledger               for each present person: told/heard statements
//   transcript           for each present person: s.transcript[person] ?? []
//   wordBudget           mode opening 220, full 160, compact 90, flavour 70
import type { EventPayload, NarrationContext, NarrationMode, Story } from '../schema';
import type { State } from './state';

export function buildNarrationContext(_story: Story, _s: State, _turnEvents: EventPayload[], _mode: NarrationMode): NarrationContext {
  throw new Error('buildNarrationContext not implemented');
}
