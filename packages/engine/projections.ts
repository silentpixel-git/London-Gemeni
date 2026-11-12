// Read models over State for the narrator (Phase 3 fills the prompt side).
//
// CONTRACT (Phase 1): buildNarrationContext(story, s, turnEvents, mode)
//   act/clock/location   from State and the Story
//   personsPresent       label = introduced ? name : alias ?? name; beats = person.beats
//   objectsVisible       visibleObjects(here) + inventory, by name
//   personsNamed         persons a turnEvent names (person, suspect, from, to) who are not present, labelled as above
//   placesNamed          the destinations of this location's exits, and Moved.from, by name (not the location itself)
//   events               turnEvents the player witnessed (see `witnessed`), not the engine's bookkeeping
//   beats                in order: Location.beats on Moved/Looked, Object.beats on Examined, Object.document on
//                        Read; then s.beats (BeatQueued this turn); then Ending.beats on GameEnded
//   facts                Facts disclosed or learned by the player THIS turn (from turnEvents), with the
//                        speaker's voice where a FactDisclosed came from a person who has one
//   observations         s.observations whose subject is the location, a present person, or a visible/carried object
//   ledger               for each present person: told/heard statements
//   transcript           for each present person: s.transcript[person] ?? []
//   wordBudget           mode opening 220, full 160, compact 90, flavour 70
import type { EventPayload, Id, NarrationContext, NarrationMode, Story } from '../schema/index.js';
import { currentAct, currentPeriod, inventory, personsPresent, visibleObjects, type State } from './state.js';

const BUDGET: Record<NarrationMode, number> = { opening: 220, full: 160, compact: 90, flavour: 70 };

export function buildNarrationContext(story: Story, s: State, turnEvents: EventPayload[], mode: NarrationMode): NarrationContext {
  const act = currentAct(story, s);
  const loc = story.locations.find(l => l.id === s.location)!;
  const obj = (id: Id) => story.objects.find(o => o.id === id);
  const fact = (id: Id) => story.facts.find(f => f.id === id);
  const present = personsPresent(story, s);
  const visible = [...visibleObjects(s, s.location), ...inventory(s)];

  // In the order things happen: the opening; what a leave Rule says on the way out; what the player's
  // own action shows (a room arrived in, looked at, an Object examined or read); what the other Rules
  // it set off add; and an ending last.
  const beats: string[] = [];
  if (mode === 'opening') beats.push(...story.opening.beats);
  const queued = turnEvents.filter((e): e is Extract<EventPayload, { kind: 'BeatQueued' }> => e.kind === 'BeatQueued');
  const onLeave = (e: { rule: Id }) => story.rules.find(r => r.id === e.rule)?.trigger.kind === 'leave';
  for (const q of queued) if (onLeave(q)) beats.push(...q.beats);
  for (const e of turnEvents) {
    if (e.kind === 'Moved') beats.push(...(story.locations.find(l => l.id === e.to)?.beats ?? []));
    else if (e.kind === 'Looked') beats.push(...loc.beats);
    else if (e.kind === 'Examined') beats.push(...(obj(e.object)?.beats ?? []));
    else if (e.kind === 'Read') { const d = obj(e.object)?.document; if (d) beats.push(d); }
  }
  for (const q of queued) if (!onLeave(q)) beats.push(...q.beats);
  for (const e of turnEvents) {
    if (e.kind === 'GameEnded') beats.push(...(story.endings.find(x => x.id === e.ending)?.beats ?? []));
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

  const label = (id: Id) => { const p = story.persons.find(x => x.id === id)!; return s.persons[id].introduced ? p.name : p.alias ?? p.name; };
  // Without a label, an absent person reaches the narrator as a bare id, which is often their real name.
  const named = new Set<Id>();
  for (const e of turnEvents) {
    const ids = 'person' in e ? [e.person] : e.kind === 'Deduced' ? [e.suspect] : e.kind === 'FactDisclosed' ? [e.from, e.to] : [];
    for (const id of ids) if (id && story.persons.some(p => p.id === id) && !present.includes(id)) named.add(id);
  }

  const places = new Set<Id>(loc.exits.map(x => x.to));
  for (const e of turnEvents) if (e.kind === 'Moved') places.add(e.from);
  places.delete(loc.id);

  const stmts = (ids: Id[]) => ids.map(id => fact(id)?.statement).filter((x): x is string => !!x);
  const subjects = new Set<Id>([s.location, ...present, ...visible]);
  return {
    mode,
    ...(story.narrator ? { narrator: { name: story.narrator.name, aliases: story.narrator.aliases ?? [], voice: story.narrator.voice } } : {}),
    lexicon: story.lexicon ?? [],
    act: { id: act.id, name: act.name, dateLabel: act.dateLabel },
    clock: { minutes: s.clock, period: currentPeriod(story, s), weather: story.weathers.find(w => w.id === act.weather)?.name ?? act.weather },
    location: { id: loc.id, name: loc.name, beats: loc.beats },
    personsPresent: present.map(id => ({ id, label: label(id), disposition: s.persons[id].disposition, beats: story.persons.find(x => x.id === id)!.beats })),
    objectsVisible: visible.map(id => ({ id, name: obj(id)!.name, ...(s.objects[id].placement.kind === 'inventory' ? { carried: true as const } : {}) })),
    personsNamed: story.persons.filter(p => named.has(p.id)).map(p => ({ id: p.id, label: label(p.id) })),
    placesNamed: story.locations.filter(l => places.has(l.id)).map(l => ({ id: l.id, name: l.name })),
    events: witnessed(turnEvents),
    beats,
    facts,
    observations: s.observations.filter(o => subjects.has(o.subject)),
    ledger: present.map(person => ({ person, told: stmts(s.ledger[person]?.told ?? []), heard: stmts(s.ledger[person]?.heard ?? []) })),
    transcript: present.map(person => ({ person, lines: s.transcript[person] ?? [] })),
    wordBudget: BUDGET[mode],
  };
}

/**
 * The turn's Events as the narrator may see them: what the player witnessed.
 * The engine's own bookkeeping is left out because its ids can name what the
 * player has not learned (a Rule called after its outcome, a Fact granted to
 * someone else, a flag): Rules fired, flags set, cues, a Fact learned by
 * anyone but the player, a grant still in flight. Queued Beats are already in
 * `beats`. A Tick keeps its minutes but not the Rule it drew.
 */
function witnessed(events: EventPayload[]): EventPayload[] {
  return events.flatMap((e): EventPayload[] => {
    switch (e.kind) {
      case 'RuleFired': case 'FlagSet': case 'CuePlayed': case 'GrantScheduled': case 'BeatQueued': return [];
      case 'FactLearned': return e.person === 'player' ? [e] : [];
      case 'TickResolved': return [{ ...e, rule: null }];
      default: return [e];
    }
  });
}
