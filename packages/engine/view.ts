// The player's screen as projections of the log (types: packages/schema/view.ts).
// Server side only: these read the Story so the client never has to.
//
// feedOf groups the log by its closing rows: a turn's group runs to its
// Narrated (Observations follow it and belong to the same turn). Groups not
// yet closed are left out, as is a Narrated with no text (a quiet Tick).
import type { Diary, EventPayload, FeedItem, Id, PlayerView, Story } from '../schema/index.js';
import { apply, currentAct, currentPeriod, initialState, inventory, personsPresent, visibleObjects, type State } from './state.js';

export function feedOf(story: Story, events: EventPayload[]): FeedItem[] {
  const feed: FeedItem[] = [];
  let s = initialState(story, 0);
  let group: EventPayload[] = [];
  for (const e of events) {
    s = apply(story, s, e);
    if (e.kind === 'ObservationRecorded') continue;
    if (e.kind !== 'Narrated') { group.push(e); continue; }
    const has = (k: EventPayload['kind']) => group.some(g => g.kind === k);
    const said = group.find(g => g.kind === 'TurnReceived');
    if (said?.kind === 'TurnReceived') feed.push({ kind: 'player', text: said.text });
    if (e.text.trim()) {
      const act = currentAct(story, s);
      const entry = has('InvestigationStarted') || has('ActEntered');
      const scene = entry || has('Moved') || has('Looked');
      feed.push({
        kind: 'prose',
        text: e.text,
        ...(scene ? { location: story.locations.find(l => l.id === s.location)!.name } : {}),
        ...(entry ? { actHeading: `${act.name} · ${act.dateLabel}` } : {}),
      });
    }
    const ended = group.find(g => g.kind === 'GameEnded');
    if (ended?.kind === 'GameEnded') feed.push({ kind: 'ending', name: story.endings.find(x => x.id === ended.ending)!.name });
    group = [];
  }
  return feed;
}

export function playerView(story: Story, events: EventPayload[]): PlayerView {
  const diary: Diary = { acts: [], clues: [], persons: [], documents: [] };
  // What the player has tried, for the client's "Try" chips: examined or read Objects,
  // people spoken to (per location, as "person@location"), locations visited.
  const examined = new Set<Id>();
  const spoken = new Set<string>();
  const visited = new Set<Id>();
  let s = initialState(story, 0);
  const enterAct = (st: State) => {
    const a = currentAct(story, st);
    if (!diary.acts.some(x => x.id === a.id)) diary.acts.push({ id: a.id, name: a.name, dateLabel: a.dateLabel });
  };
  for (const e of events) {
    s = apply(story, s, e);
    if (e.kind === 'InvestigationStarted' || e.kind === 'ActEntered' || e.kind === 'Moved') visited.add(s.location);
    if (e.kind === 'Examined' || e.kind === 'Read') examined.add(e.object);
    if (e.kind === 'Spoke') spoken.add(`${e.person}@${s.location}`);
    if (e.kind === 'InvestigationStarted' || e.kind === 'ActEntered') enterAct(s);
    else if (e.kind === 'ClueDiscovered' && !diary.clues.some(c => c.id === e.clue)) {
      const c = story.clues.find(x => x.id === e.clue)!;
      diary.clues.push({ id: c.id, name: c.name, summary: c.summary, act: s.act, clock: s.clock });
    } else if (e.kind === 'Read' && !diary.documents.some(d => d.id === e.object)) {
      const o = story.objects.find(x => x.id === e.object)!;
      if (o.document) diary.documents.push({ id: o.id, name: o.name, text: o.document });
    }
  }

  const label = (id: Id) => {
    const p = story.persons.find(x => x.id === id)!;
    return s.persons[id].introduced ? p.name : p.alias ?? p.name;
  };
  const statement = (id: Id) => story.facts.find(f => f.id === id)!.statement;
  // The people met are exactly the suspects a deduction may name (state.met, ADR-0005).
  diary.persons = Object.keys(s.met).map(id => ({ id, name: label(id), told: (s.ledger[id]?.told ?? []).map(statement) }));

  const objName = (id: Id) => story.objects.find(o => o.id === id)!.name;
  const loc = story.locations.find(l => l.id === s.location)!;
  const act = currentAct(story, s);
  const period = currentPeriod(story, s);
  const ending = s.ended ? story.endings.find(x => x.id === s.ended)! : null;
  return {
    storyTitle: story.title,
    narrator: story.narrator?.name ?? null,
    act: { id: act.id, name: act.name, dateLabel: act.dateLabel },
    clock: s.clock,
    period: { id: period, name: story.periods.find(p => p.id === period)!.name },
    weather: { id: act.weather, name: story.weathers.find(w => w.id === act.weather)?.name ?? act.weather },
    location: { id: loc.id, name: loc.name },
    inventory: inventory(s).map(id => ({ id, name: objName(id) })),
    persons: personsPresent(story, s).map(id => ({ id, name: label(id), ...(spoken.has(`${id}@${s.location}`) ? { spokenTo: true as const } : {}) })),
    objects: visibleObjects(s, s.location).map(id => {
      const o = s.objects[id];
      return {
        id,
        name: objName(id),
        ...(o.container && o.container.state !== 'open' ? { closed: true as const } : {}),
        ...(o.placement.kind === 'container' ? { inside: o.placement.container } : {}),
        ...(examined.has(id) ? { examined: true as const } : {}),
      };
    }),
    exits: loc.exits.map(x => ({ id: x.id, name: x.names[0], to: story.locations.find(l => l.id === x.to)!.name, ...(visited.has(x.to) ? { visited: true as const } : {}) })),
    ended: ending ? { id: ending.id, name: ending.name } : null,
    diary,
  };
}
