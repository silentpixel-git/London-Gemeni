// The Candidate Set: everything the player could mean right now. The
// selection model may only name members of it (ADR-0003).
//
// CONTRACT (Phase 1):
//   verbs      all Verbs (the set is fixed; the model chooses)
//   objects    visibleObjects(here) as 'here' (an object inside an open visible container is still 'here'),
//              inventory as 'carried'. Never hidden objects. name = story name.
//   persons    personsPresent, name = introduced ? name : alias ?? name
//   exits      this location's exits (locked ones included: trying them is a valid intent)
//   topics     for each present person P and each Fact F:
//                canTell(P,F) → one entry per topic phrase, direction 'ask'
//                else player knows F and P does not → one entry per phrase, direction 'tell'
//   knownFacts facts the player knows (for deduce), with statements
import type { CandidateSet, Story } from '../schema';
import type { State } from './state';

export function candidates(_story: Story, _s: State): CandidateSet {
  throw new Error('candidates not implemented');
}
