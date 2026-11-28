// The Candidate Set: everything the player could mean right now. The
// selection model may only name members of it (ADR-0003).
//
// CONTRACT (Phase 1):
//   verbs      all Verbs (the set is fixed; the model chooses)
//   location   this location's name; description = its beats, then its Observations
//   objects    visibleObjects(here) as 'here' (an object inside an open visible container is still 'here'),
//              inventory as 'carried'. Never hidden objects. name = story name; description = its beats,
//              then its Observations.
//   persons    personsPresent, name = introduced ? name : alias ?? name; description = their beats, then
//              their Observations.
//              Descriptions are what the narrator describes from plus the Flavour it has already made
//              canon, so whatever the prose has said is on a thing or a person can be resolved to it.
//              The Candidate Set never reaches the client.
//   exits      this location's exits (locked ones included: trying them is a valid intent); key = the
//              Object that opens a key lock on it now
//   topics     for each present person P and each Fact F:
//                canTell(P,F) and P did not hear F from the player → one entry per topic phrase, direction 'ask'
//                  (a person does not repeat to the player what the player told them)
//                else player knows F and P does not → one entry per phrase, direction 'tell', with F's statement
//                  (the player's own answer: the selector judges a told answer against it, ADR-0005 §11)
//   knownFacts facts the player knows (for deduce), with statements
//   suspects   every person the player has met (state.met), by label, in Story order (for deduce)
import { Verb, type CandidateSet, type Id, type Story } from '../schema/index.js';
import { canTell, exitLock, inventory, personsPresent, visibleObjects, type State } from './state.js';

export function candidates(story: Story, s: State): CandidateSet {
  const objName = (id: Id) => story.objects.find(o => o.id === id)!.name;
  /** Authored beats, then the Observations recorded about it: everything the prose has said of it. */
  const describe = (id: Id, beats: string[]) => [...beats, ...s.observations.filter(o => o.subject === id).map(o => o.text)];
  const objBeats = (id: Id) => describe(id, story.objects.find(o => o.id === id)!.beats);
  const carried = inventory(s);
  const persons = personsPresent(story, s);
  const loc = story.locations.find(l => l.id === s.location)!;
  const topics: CandidateSet['topics'] = [];
  for (const person of persons) {
    for (const f of story.facts) {
      const heardFromPlayer = s.ledger[person]?.heard.includes(f.id) ?? false;
      const direction = canTell(story, s, person, f.id) && !heardFromPlayer ? 'ask' : s.knows.player[f.id] && !s.knows[person]?.[f.id] ? 'tell' : null;
      if (direction) for (const phrase of f.topics) topics.push({ person, fact: f.id, phrase, direction, ...(direction === 'tell' ? { statement: f.statement } : {}) });
    }
  }
  const label = (id: Id) => {
    const p = story.persons.find(x => x.id === id)!;
    return s.persons[id].introduced ? p.name : p.alias ?? p.name;
  };
  return {
    verbs: [...Verb.options],
    location: { name: loc.name, description: describe(loc.id, loc.beats) },
    objects: [
      ...visibleObjects(s, s.location).map(id => ({ id, name: objName(id), where: 'here' as const, description: objBeats(id) })),
      ...carried.map(id => ({ id, name: objName(id), where: 'carried' as const, description: objBeats(id) })),
    ],
    persons: persons.map(id => ({ id, name: label(id), description: describe(id, story.persons.find(x => x.id === id)!.beats) })),
    exits: loc.exits.map(x => {
      const lock = exitLock(story, s, loc.id, x.id);
      return { id: x.id, names: x.names, ...(lock?.kind === 'key' ? { key: lock.object } : {}) };
    }),
    topics,
    knownFacts: story.facts.filter(f => s.knows.player[f.id]).map(f => ({ id: f.id, statement: f.statement })),
    suspects: story.persons.filter(p => s.met[p.id]).map(p => ({ id: p.id, name: label(p.id) })),
  };
}
