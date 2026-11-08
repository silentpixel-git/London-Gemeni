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
import { canTell, currentPeriod, exitLock, inventory, lockOpen, personsPresent, visibleObjects, type State } from './state';

export interface Intent {
  verb: Verb;
  target?: Id;
  secondary?: Id;
  person?: Id;
  topic?: Id;
  exit?: Id;
  facts?: Id[];
}

export function resolveVerb(story: Story, s: State, intent: Intent): EventPayload[] {
  const reject = (reason: string): EventPayload[] => [{ kind: 'IntentRejected', reason }];
  const NO_THING = 'there is no such thing here';
  const NO_ONE = 'there is no one like that here';
  const here = visibleObjects(s, s.location);
  const carried = inventory(s);
  const reach = (id?: Id): id is Id => !!id && (here.includes(id) || carried.includes(id));
  const obj = (id: Id) => story.objects.find(o => o.id === id);
  const presentPersons = personsPresent(story, s);
  const isHere = (p?: Id): p is Id => !!p && presentPersons.includes(p);
  const { target: t, secondary: sec, person: p } = intent;

  switch (intent.verb) {
    case 'look': return [{ kind: 'Looked' }];
    case 'inventory': return [{ kind: 'InventoryChecked' }];
    case 'wait': return [];
    case 'examine':
      if (reach(t) || isHere(t)) return [{ kind: 'Examined', object: t }];
      return reject(NO_THING);
    case 'read': {
      if (!reach(t)) return reject(NO_THING);
      const fact = obj(t)?.fact;
      return [{ kind: 'Read', object: t }, ...(fact && !s.knows.player[fact] ? [{ kind: 'FactLearned', person: 'player', fact } as EventPayload] : [])];
    }
    case 'take':
      if (!t || !here.includes(t) || carried.includes(t)) return reject(NO_THING);
      return obj(t)?.item ? [{ kind: 'Taken', object: t }] : reject('it cannot be carried');
    case 'drop':
      return t && carried.includes(t) ? [{ kind: 'Dropped', object: t }] : reject('you are not carrying that');
    case 'open': case 'close': {
      if (!reach(t)) return reject(NO_THING);
      const c = s.objects[t].container;
      if (!c) return reject('it does not open');
      if (intent.verb === 'close') return c.state === 'open' ? [{ kind: 'Closed', object: t }] : reject('it is not open');
      if (c.state === 'open') return reject('it is already open');
      if (c.state === 'locked' && !lockOpen(s, c.lock ?? null)) return [{ kind: 'OpenBlocked', object: t, lock: c.lock! }];
      return [{ kind: 'Opened', object: t }];
    }
    case 'use':
      if (!reach(t)) return reject(NO_THING);
      if (sec && !reach(sec) && !isHere(sec)) return reject(NO_THING);
      return [{ kind: 'Used', object: t, ...(sec ? { on: sec } : {}) }];
    case 'combine':
      if (!reach(t) || !reach(sec)) return reject(NO_THING);
      return t === sec ? reject('it cannot be combined with itself') : [{ kind: 'Combined', items: [t, sec] }];
    case 'show': case 'give': {
      if (!t || !carried.includes(t)) return reject('you are not carrying that');
      if (!isHere(p)) return reject(NO_ONE);
      const fact = obj(t)?.fact;
      const disclose: EventPayload[] = fact && s.knows.player[fact] && !s.knows[p]?.[fact]
        ? [{ kind: 'FactDisclosed', from: 'player', to: p, fact }] : [];
      return [intent.verb === 'show' ? { kind: 'Shown', object: t, person: p } : { kind: 'Given', object: t, person: p }, ...disclose];
    }
    case 'talk':
      return isHere(p) ? [{ kind: 'Spoke', person: p }] : reject(NO_ONE);
    case 'ask': {
      if (!isHere(p)) return reject(NO_ONE);
      const fact = intent.topic;
      if (fact && story.facts.some(f => f.id === fact)) {
        if (canTell(story, s, p, fact)) return [{ kind: 'Spoke', person: p, fact }, { kind: 'FactDisclosed', from: p, to: 'player', fact }];
        if (s.knows.player[fact] && !s.knows[p]?.[fact]) return [{ kind: 'Spoke', person: p, fact }, { kind: 'FactDisclosed', from: 'player', to: p, fact }];
      }
      return [{ kind: 'Spoke', person: p }];
    }
    case 'deduce': {
      const facts = intent.facts ?? [];
      if (!facts.every(f => s.knows.player[f])) return reject('you do not yet know enough to say that');
      if (p && !story.persons.some(x => x.id === p)) return reject(NO_ONE);
      return [{ kind: 'Deduced', facts, ...(p ? { suspect: p } : {}) }];
    }
    case 'move': {
      const loc = story.locations.find(l => l.id === s.location)!;
      const exit = loc.exits.find(x => x.id === intent.exit);
      if (!exit) return reject('there is no way that direction');
      const dest = story.locations.find(l => l.id === exit.to);
      if (dest?.openPeriods && !dest.openPeriods.includes(currentPeriod(story, s))) return [{ kind: 'MoveBlocked', exit: exit.id, reason: 'closed', lock: null }];
      const lock = exitLock(story, s, loc.id, exit.id);
      if (!lockOpen(s, lock)) return [{ kind: 'MoveBlocked', exit: exit.id, reason: 'locked', lock }];
      return [{ kind: 'Moved', from: loc.id, to: exit.to, exit: exit.id }];
    }
  }
}
