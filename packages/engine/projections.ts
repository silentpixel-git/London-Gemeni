// Read models over State for the narrator (Phase 3 fills the prompt side).
//
// CONTRACT (Phase 1): buildNarrationContext(story, s, turnEvents, mode)
//   act/clock/location   from State and the Story
//   personsPresent       label = introduced ? name : alias ?? name; beats = person.beats
//   objectsVisible       visibleObjects(here) + inventory, by name
//   personsNamed         persons a turnEvent names (person, suspect, from, to) who are not present, labelled as above
//   events               turnEvents verbatim
//   beats                flattened from s.beats (BeatQueued this turn), plus Location.beats on Moved/Looked,
//                        Object.beats on Examined, Object.document on Read, Ending.beats on GameEnded
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

  const label = (id: Id) => { const p = story.persons.find(x => x.id === id)!; return s.persons[id].introduced ? p.name : p.alias ?? p.name; };
  // Without a label, an absent person reaches the narrator as a bare id, which is often their real name.
  const named = new Set<Id>();
  for (const e of turnEvents) {
    const ids = 'person' in e ? [e.person] : e.kind === 'Deduced' ? [e.suspect] : e.kind === 'FactDisclosed' ? [e.from, e.to] : [];
    for (const id of ids) if (id && story.persons.some(p => p.id === id) && !present.includes(id)) named.add(id);
  }

  const stmts = (ids: Id[]) => ids.map(id => fact(id)?.statement).filter((x): x is string => !!x);
  const subjects = new Set<Id>([s.location, ...present, ...visible]);
  return {
    mode,
    storyTitle: story.title,
    ...(story.narrator ? { narrator: { name: story.narrator.name, aliases: story.narrator.aliases ?? [], voice: story.narrator.voice } } : {}),
    lexicon: story.lexicon ?? [],
    act: { id: act.id, name: act.name, dateLabel: act.dateLabel },
    clock: { minutes: s.clock, period: currentPeriod(story, s), weather: story.weathers.find(w => w.id === act.weather)?.name ?? act.weather },
    location: { id: loc.id, name: loc.name, beats: loc.beats },
    personsPresent: present.map(id => ({ id, label: label(id), disposition: s.persons[id].disposition, beats: story.persons.find(x => x.id === id)!.beats })),
    objectsVisible: visible.map(id => ({ id, name: obj(id)!.name })),
    personsNamed: story.persons.filter(p => named.has(p.id)).map(p => ({ id: p.id, label: label(p.id) })),
    events: turnEvents,
    beats,
    facts,
    observations: s.observations.filter(o => subjects.has(o.subject)),
    ledger: present.map(person => ({ person, told: stmts(s.ledger[person]?.told ?? []), heard: stmts(s.ledger[person]?.heard ?? []) })),
    transcript: present.map(person => ({ person, lines: s.transcript[person] ?? [] })),
    wordBudget: BUDGET[mode],
  };
}

/**
 * The prose a turn falls back to when narration cannot be had: its authored
 * Beats first, then one plain second-person line per Event of substance. Only
 * names the player already holds (Object and location names, the context's
 * person labels, never a real name before introduction) and generic verbs, so
 * it would pass the invention gate. A quiet Tick has no such Event: empty.
 */
export function fallbackProse(story: Story, ctx: NarrationContext): string {
  const obj = (id: Id) => `the ${story.objects.find(o => o.id === id)?.name ?? 'thing'}`;
  const label = (id: Id) => [...ctx.personsPresent, ...ctx.personsNamed].find(p => p.id === id)?.label;
  const who = (id: Id) => label(id) ?? 'someone';
  /** An examine target or a use secondary may be a person. */
  const thing = (id: Id) => label(id) ?? obj(id);
  // Only the engine's own reasons are in-world; a Selection that named nothing gives the model's or the seam's.
  const selected = ctx.events.some(e => e.kind === 'IntentSelected');
  const sentence = (s: string) => { const t = s.trim(); return t ? `${t[0].toUpperCase()}${t.slice(1)}${/[.!?]["”]?$/.test(t) ? '' : '.'}` : ''; };
  const lines: string[] = [];
  for (const e of ctx.events) {
    switch (e.kind) {
      case 'Taken': lines.push(`You take ${obj(e.object)}.`); break;
      case 'Dropped': lines.push(`You drop ${obj(e.object)}.`); break;
      case 'Opened': lines.push(`You open ${obj(e.object)}.`); break;
      case 'Closed': lines.push(`You close ${obj(e.object)}.`); break;
      case 'Examined': lines.push(`You examine ${thing(e.object)}.`); break;
      case 'Read': lines.push(`You read ${obj(e.object)}.`); break;
      case 'Given': lines.push(`You give ${obj(e.object)} to ${who(e.person)}.`); break;
      case 'Shown': lines.push(`You show ${obj(e.object)} to ${who(e.person)}.`); break;
      case 'Used': lines.push(`You use ${obj(e.object)}${e.on ? ` on ${thing(e.on)}` : ''}.`); break;
      case 'Combined': lines.push(`You combine ${obj(e.items[0])} and ${obj(e.items[1])}.`); break;
      case 'Moved': lines.push(`You go to ${(story.locations.find(l => l.id === e.to)?.name ?? 'the next place').replace(/^The /, 'the ')}.`); break;
      case 'MoveBlocked': lines.push(`It is ${e.reason}.`); break;
      case 'OpenBlocked': lines.push('It is locked.'); break;
      case 'Spoke': if (!e.fact) lines.push(sentence(`${who(e.person)} has nothing to add.`)); break;
      // What a person told the player is the substance of an ask; the context already holds it.
      case 'FactDisclosed': {
        const f = e.to === 'player' && e.from !== 'player' ? ctx.facts.find(x => x.id === e.fact) : undefined;
        if (f) lines.push(sentence(`${who(e.from)} tells you: "${f.voice ?? f.statement}"`));
        break;
      }
      case 'IntentRejected': lines.push(selected ? sentence(e.reason) : 'There is nothing of the kind to hand.'); break;
      case 'Looked': lines.push('You look around.'); break;
      case 'InventoryChecked': lines.push('You check what you are carrying.'); break;
      case 'Deduced': lines.push(`You lay out your reasoning${e.suspect ? `, naming ${who(e.suspect)}` : ''}.`); break;
      case 'FlavourRequested': lines.push(`You look more closely at ${e.subject}.`); break;
    }
  }
  return [...ctx.beats, ...lines].join(' ');
}
