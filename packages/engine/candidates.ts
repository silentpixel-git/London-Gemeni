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
//   suspects   every person the player has met (state.met), by label, in Story order (for deduce)
import { Verb, type CandidateSet, type Id, type Story } from '../schema/index.js';
import { canTell, inventory, personsPresent, visibleObjects, type State } from './state.js';

export function candidates(story: Story, s: State): CandidateSet {
  const objName = (id: Id) => story.objects.find(o => o.id === id)!.name;
  const carried = inventory(s);
  const persons = personsPresent(story, s);
  const loc = story.locations.find(l => l.id === s.location)!;
  const topics: CandidateSet['topics'] = [];
  for (const person of persons) {
    for (const f of story.facts) {
      const direction = canTell(story, s, person, f.id) ? 'ask' : s.knows.player[f.id] && !s.knows[person]?.[f.id] ? 'tell' : null;
      if (direction) for (const phrase of f.topics) topics.push({ person, fact: f.id, phrase, direction });
    }
  }
  const label = (id: Id) => {
    const p = story.persons.find(x => x.id === id)!;
    return s.persons[id].introduced ? p.name : p.alias ?? p.name;
  };
  return {
    verbs: [...Verb.options],
    objects: [
      ...visibleObjects(s, s.location).map(id => ({ id, name: objName(id), where: 'here' as const })),
      ...carried.map(id => ({ id, name: objName(id), where: 'carried' as const })),
    ],
    persons: persons.map(id => ({ id, name: label(id) })),
    exits: loc.exits.map(x => ({ id: x.id, names: x.names })),
    topics,
    knownFacts: story.facts.filter(f => s.knows.player[f.id]).map(f => ({ id: f.id, statement: f.statement })),
    suspects: story.persons.filter(p => s.met[p.id]).map(p => ({ id: p.id, name: label(p.id) })),
  };
}
