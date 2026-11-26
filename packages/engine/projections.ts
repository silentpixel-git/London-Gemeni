// Read models over State for the narrator (Phase 3 fills the prompt side).
//
// CONTRACT (Phase 1): buildNarrationContext(story, s, turnEvents, mode)
//   act/clock/location   from State and the Story
//   personsPresent       label = introduced ? name : alias ?? name; beats = person.beats
//   objectsVisible       visibleObjects(here) + inventory, by name
//   personsNamed         persons a turnEvent names (person, suspect, from, to) who are not present, labelled as above
//   events               turnEvents verbatim
//   beats                flattened from s.beats (BeatQueued this turn), plus Location.beats on Moved/Looked,
//                        Object.beats on Examined and OpenBlocked, Exit.lockedBeat or the destination's
//                        closedBeat on MoveBlocked, Object.document on Read (after Object.beats when the player
//                        examined it: examining a document reads it), Ending.beats on GameEnded
//   mentions             what turnEvents refer to by id, in words: the place left, a person's destination,
//                        a way's names, a deduction's Fact statements (never the ids)
//   facts                Facts disclosed or learned by the player THIS turn (from turnEvents), with the
//                        speaker's voice where a FactDisclosed came from a person who has one
//   observations         s.observations whose subject is the location, a present person, or a visible/carried object
//   ledger               for each present person: told/heard statements
//   transcript           for each present person: s.transcript[person] ?? []
//   wordBudget           mode opening 220, full 160, compact 90, flavour 70
import type { EventPayload, Id, NarrationContext, NarrationMode, Story } from '../schema/index.js';
import { currentAct, currentPeriod, inventory, personsPresent, visibleObjects, type State } from './state.js';

const BUDGET: Record<NarrationMode, number> = { opening: 220, full: 160, compact: 90, flavour: 70 };

/**
 * The words of the names of people the player has not been introduced to (an alias stands in for
 * them), for the invention gate: the narrator never sees them, and the gate refuses them anywhere
 * unless the player typed them. Titles ("Mrs.", "Dr") are not names.
 */
export function unintroducedNames(story: Story, s: State): string[] {
  const TITLES = new Set(['mr', 'mrs', 'miss', 'ms', 'dr', 'sir', 'lady', 'lord', 'rev', 'inspector', 'sergeant', 'constable']);
  return story.persons
    .filter(p => p.alias && !s.persons[p.id]?.introduced)
    .flatMap(p => p.name.split(/[\s-]+/).map(w => w.replace(/[^A-Za-z']/g, '')))
    .filter(w => w.length >= 3 && !TITLES.has(w.toLowerCase()));
}

/** `from`: where the player stood before the turn, so an act that brings them somewhere new reads as an arrival. */
export function buildNarrationContext(story: Story, s: State, turnEvents: EventPayload[], mode: NarrationMode, from?: Id): NarrationContext {
  const act = currentAct(story, s);
  const loc = story.locations.find(l => l.id === s.location)!;
  const obj = (id: Id) => story.objects.find(o => o.id === id);
  const fact = (id: Id) => story.facts.find(f => f.id === id);
  const present = personsPresent(story, s);
  const visible = [...visibleObjects(s, s.location), ...inventory(s)];

  const beats: string[] = [];
  const examining = turnEvents.some(e => e.kind === 'IntentSelected' && e.verb === 'examine');
  if (mode === 'opening') beats.push(...story.opening.beats);
  for (const b of s.beats) beats.push(...b.beats);
  for (const e of turnEvents) {
    if (e.kind === 'Moved') beats.push(...(story.locations.find(l => l.id === e.to)?.beats ?? []));
    // An act that brings the player somewhere new is an arrival there (no Moved: the act places them).
    else if (e.kind === 'ActEntered' && from !== undefined && from !== s.location && !turnEvents.some(x => x.kind === 'Moved')) beats.push(...loc.beats);
    else if (e.kind === 'Looked') beats.push(...loc.beats);
    else if (e.kind === 'Examined') beats.push(...(obj(e.object)?.beats ?? story.persons.find(p => p.id === e.object)?.beats ?? []));
    // A blocked way or lid reads as the Story wrote it: the exit's lockedBeat, the closed
    // place's closedBeat, the locked container's own beats.
    else if (e.kind === 'MoveBlocked') {
      const exit = loc.exits.find(x => x.id === e.exit);
      const line = e.reason === 'locked' ? exit?.lockedBeat : story.locations.find(l => l.id === exit?.to)?.closedBeat;
      if (line) beats.push(line);
    }
    else if (e.kind === 'OpenBlocked') beats.push(...(obj(e.object)?.beats ?? []));
    else if (e.kind === 'Read') { const o = obj(e.object); if (examining) beats.push(...(o?.beats ?? [])); if (o?.document) beats.push(o.document); }
    else if (e.kind === 'GameEnded') beats.push(...(story.endings.find(x => x.id === e.ending)?.beats ?? []));
  }

  // What the turn's Events refer to by id, in words: the narrator may say these, never the ids.
  const placeName = (id: Id | null) => (id ? story.locations.find(l => l.id === id)?.name : undefined);
  const exitNames = (locId: Id, exitId: Id) => story.locations.find(l => l.id === locId)?.exits.find(x => x.id === exitId)?.names ?? [];
  // MoveBlocked names its exit by id only, on the room the turn began in; an act change may have moved the player since.
  const relocated = turnEvents.some(e => e.kind === 'ActEntered');
  const mentions = [...new Set(turnEvents.flatMap(e => {
    switch (e.kind) {
      case 'Moved': return [placeName(e.from)];
      case 'MoveBlocked': return relocated ? [] : exitNames(s.location, e.exit);
      case 'PersonMoved': return [placeName(e.location)];
      case 'ExitLockChanged': return [placeName(e.location), ...exitNames(e.location, e.exit)];
      case 'Deduced': return e.facts.map(id => fact(id)?.statement);
      default: return [];
    }
  }).filter((x): x is string => !!x))];

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
    mentions,
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
      case 'Spoke':
        // A greeting invites a question only when nothing this turn gave them something to say.
        if (e.greeting) { if (!ctx.beats.length && !ctx.facts.length) lines.push(sentence(`${who(e.person)} waits for you to ask something in particular.`)); }
        else if (!e.fact) lines.push(sentence(`${who(e.person)} has nothing to add.`));
        break;
      // What a person told the player is the substance of an ask; the context already holds it.
      case 'FactDisclosed': {
        const f = e.to === 'player' && e.from !== 'player' ? ctx.facts.find(x => x.id === e.fact) : undefined;
        if (f) lines.push(sentence(`${who(e.from)} tells you: "${f.voice ?? f.statement}"`));
        break;
      }
      // A miss never denies that something exists: the player may be acting on a thing the prose described.
      case 'IntentRejected': lines.push(selected ? sentence(e.reason) : 'Nothing comes of it.'); break;
      case 'Looked': lines.push('You look around.'); break;
      case 'InventoryChecked': lines.push('You check what you are carrying.'); break;
      case 'Deduced': lines.push(`You lay out your reasoning${e.suspect ? `, naming ${who(e.suspect)}` : ''}.`); break;
      // The subject is the parser model's words, not the Story's: never echoed ungated.
      case 'FlavourRequested': lines.push('You take a closer look.'); break;
    }
  }
  return [...ctx.beats, ...lines].join(' ');
}
