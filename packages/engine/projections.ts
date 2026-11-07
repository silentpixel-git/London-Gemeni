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
import type { EventPayload, Id, NarrationContext, NarrationMode, Story } from '../schema';
import { currentAct, currentPeriod, inventory, personsPresent, visibleObjects, type State } from './state';

const BUDGET: Record<NarrationMode, number> = { opening: 220, full: 160, compact: 90, flavour: 70 };

export function buildNarrationContext(story: Story, s: State, turnEvents: EventPayload[], mode: NarrationMode): NarrationContext {
  const act = currentAct(story, s);
  const loc = story.locations.find(l => l.id === s.location)!;
  const obj = (id: Id) => story.objects.find(o => o.id === id);
  const fact = (id: Id) => story.facts.find(f => f.id === id);
  const present = personsPresent(story, s);
  const visible = [...visibleObjects(s, s.location), ...inventory(s)];

  const beats: string[] = [];
  if (mode === 'opening') beats.push(...story.opening.beats);
  for (const b of s.beats) beats.push(...b.beats);
  for (const e of turnEvents) {
    if (e.kind === 'Moved') beats.push(...(story.locations.find(l => l.id === e.to)?.beats ?? []));
    else if (e.kind === 'Looked') beats.push(...loc.beats);
    else if (e.kind === 'Examined') beats.push(...(obj(e.object)?.beats ?? []));
    else if (e.kind === 'Read') { const d = obj(e.object)?.document; if (d) beats.push(d); }
    else if (e.kind === 'GameEnded') beats.push(...(story.endings.find(x => x.id === e.ending)?.beats ?? []));
  }

  const facts: NarrationContext['facts'] = [];
  const add = (id: Id, speaker?: Id) => {
    const f = fact(id);
    if (!f || facts.some(x => x.id === id)) return;
    const voice = speaker ? f.voices?.[speaker] : undefined;
    facts.push({ id, statement: f.statement, ...(voice ? { voice } : {}) });
  };
  for (const e of turnEvents) {
    if (e.kind === 'FactLearned' && e.person === 'player') add(e.fact);
    else if (e.kind === 'FactDisclosed' && e.to === 'player') add(e.fact, e.from === 'player' ? undefined : e.from);
  }

  const stmts = (ids: Id[]) => ids.map(id => fact(id)?.statement).filter((x): x is string => !!x);
  const subjects = new Set<Id>([s.location, ...present, ...visible]);
  return {
    mode,
    storyTitle: story.title,
    act: { id: act.id, name: act.name, dateLabel: act.dateLabel },
    clock: { minutes: s.clock, period: currentPeriod(s), weather: act.weather },
    location: { id: loc.id, name: loc.name, beats: loc.beats },
    personsPresent: present.map(id => {
      const p = story.persons.find(x => x.id === id)!;
      return { id, label: s.persons[id].introduced ? p.name : p.alias ?? p.name, disposition: s.persons[id].disposition, beats: p.beats };
    }),
    objectsVisible: visible.map(id => ({ id, name: obj(id)!.name })),
    events: turnEvents,
    beats,
    facts,
    observations: s.observations.filter(o => subjects.has(o.subject)),
    ledger: present.map(person => ({ person, told: stmts(s.ledger[person]?.told ?? []), heard: stmts(s.ledger[person]?.heard ?? []) })),
    transcript: present.map(person => ({ person, lines: s.transcript[person] ?? [] })),
    wordBudget: BUDGET[mode],
  };
}
