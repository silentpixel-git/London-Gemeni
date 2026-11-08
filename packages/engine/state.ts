// State is nothing but the fold of an Investigation's Events (ADR-0001).
// `apply` is the only writer; everything else derives.
import type {
  Disposition, EventPayload, Id, Lock, Observation, PersonOrPlayer, Placement, Story,
} from '../schema';
import { boundariesCrossed, periodOf } from './time';

export interface ObjectState {
  placement: Placement;
  hidden: boolean;
  container?: { state: 'open' | 'closed' | 'locked'; lock?: Lock };
}

export interface PersonState {
  /** undefined = follow the schedule; null = offstage; an id = pinned there until the act changes. */
  override: Id | null | undefined;
  disposition: Disposition;
  introduced: boolean;
}

export interface TranscriptLine { speaker: 'player' | 'person'; text: string }

export interface State {
  story: Id;
  seed: number;
  turn: number;
  act: number;
  location: Id;
  /** Absolute minutes: the act's startClockMinutes plus elapsed; may exceed 1439 across midnight. */
  clock: number;
  /** Total period boundaries crossed since the Investigation began (scheduled grants mature on it). */
  boundaries: number;
  flags: Record<string, true>;
  objects: Record<Id, ObjectState>;
  /** Overrides of authored exit locks, keyed "location/exit". null = unlocked. */
  exitLocks: Record<string, Lock | null>;
  persons: Record<Id, PersonState>;
  knows: Record<PersonOrPlayer, Record<Id, true>>;
  ledger: Record<Id, { told: Id[]; heard: Id[] }>;
  transcript: Record<Id, TranscriptLine[]>;
  clues: Id[];
  firedRules: Record<Id, number>;
  pendingGrants: Array<{ person: PersonOrPlayer; fact: Id; maturesAtBoundary: number }>;
  examined: Record<Id, true>;
  observations: Observation[];
  ended: Id | null;
  /** The text of the current turn, so Spoke can log the player's line. */
  turnText: string;
  /** Queued beats this turn, consumed by the narration context. Cleared on TurnReceived/TickResolved. */
  beats: Array<{ beats: string[]; asQuote: boolean }>;
}

export function initialState(story: Story, seed: number): State {
  const act = story.acts.find(a => a.id === story.opening.act)!;
  return {
    story: story.id,
    seed,
    turn: 0,
    act: act.id,
    location: story.opening.location,
    clock: act.startClockMinutes,
    boundaries: 0,
    flags: {},
    objects: Object.fromEntries(story.objects.map(o => [o.id, {
      placement: o.placement,
      hidden: o.hidden ?? false,
      ...(o.container ? { container: { state: o.container.state, lock: o.container.lock } } : {}),
    }])),
    exitLocks: {},
    persons: Object.fromEntries(story.persons.map(p => [p.id, {
      override: undefined,
      disposition: p.disposition,
      introduced: !p.alias,
    }])),
    knows: {
      player: {},
      ...Object.fromEntries(story.persons.map(p => [p.id, Object.fromEntries(
        story.facts.filter(f => f.knownBy.includes(p.id)).map(f => [f.id, true as const]),
      )])),
    },
    ledger: {},
    transcript: {},
    clues: [],
    firedRules: {},
    pendingGrants: [],
    examined: {},
    observations: [],
    ended: null,
    turnText: '',
    beats: [],
  };
}

const TRANSCRIPT_WINDOW = 12;

/** The reducer. Pure: returns a new State and never mutates the argument. */
export function apply(story: Story, s: State, e: EventPayload): State {
  switch (e.kind) {
    case 'InvestigationStarted': return initialState(story, e.seed);
    case 'TurnReceived': return { ...s, turn: s.turn + 1, turnText: e.text, beats: [] };
    case 'TickResolved': return { ...s, turn: s.turn + 1, turnText: '', beats: [] };
    case 'IntentSelected': case 'IntentRejected': case 'FlavourRequested':
    case 'Looked': case 'InventoryChecked': case 'MoveBlocked': case 'OpenBlocked':
    case 'Used': case 'Combined': case 'Shown': case 'Deduced': case 'CuePlayed':
      return s;
    case 'RuleFired': return { ...s, firedRules: { ...s.firedRules, [e.rule]: (s.firedRules[e.rule] ?? 0) + 1 } };
    case 'Moved': return { ...s, location: e.to };
    case 'Examined': return { ...s, examined: { ...s.examined, [e.object]: true } };
    case 'Read': {
      // A 'document' introduction names the person once their document is read.
      const persons = { ...s.persons };
      for (const p of story.persons) {
        if (p.introduction?.kind === 'document' && p.introduction.object === e.object && !persons[p.id].introduced) {
          persons[p.id] = { ...persons[p.id], introduced: true };
        }
      }
      return { ...s, persons, examined: { ...s.examined, [e.object]: true } };
    }
    case 'Taken': return place(s, e.object, { kind: 'inventory' });
    case 'Dropped': return place(s, e.object, { kind: 'location', location: s.location });
    case 'Given': return place(s, e.object, { kind: 'person', person: e.person });
    case 'Opened': return container(s, e.object, 'open');
    case 'Closed': return container(s, e.object, 'closed');
    case 'ObjectPlaced': {
      const cur = s.objects[e.object];
      return { ...s, objects: { ...s.objects, [e.object]: { ...cur, placement: e.placement, hidden: e.hidden ?? cur.hidden } } };
    }
    case 'ExitLockChanged': return { ...s, exitLocks: { ...s.exitLocks, [`${e.location}/${e.exit}`]: e.lock } };
    case 'PersonMoved': return { ...s, persons: { ...s.persons, [e.person]: { ...s.persons[e.person], override: e.location } } };
    case 'DispositionChanged': return { ...s, persons: { ...s.persons, [e.person]: { ...s.persons[e.person], disposition: e.disposition } } };
    case 'Spoke': {
      const p = story.persons.find(x => x.id === e.person);
      const introduced = s.persons[e.person].introduced || p?.introduction?.kind === 'self';
      const lines = [...(s.transcript[e.person] ?? []), { speaker: 'player' as const, text: s.turnText }].slice(-TRANSCRIPT_WINDOW);
      return {
        ...s,
        persons: { ...s.persons, [e.person]: { ...s.persons[e.person], introduced } },
        transcript: { ...s.transcript, [e.person]: lines },
      };
    }
    case 'FactDisclosed': {
      const knows = learn(s.knows, e.to, e.fact);
      const person = e.from === 'player' ? e.to : e.from;
      if (person === 'player') return { ...s, knows };
      const entry = s.ledger[person] ?? { told: [], heard: [] };
      const next = e.from === 'player'
        ? { ...entry, heard: entry.heard.includes(e.fact) ? entry.heard : [...entry.heard, e.fact] }
        : { ...entry, told: entry.told.includes(e.fact) ? entry.told : [...entry.told, e.fact] };
      return { ...s, knows, ledger: { ...s.ledger, [person]: next } };
    }
    case 'FactLearned': return { ...s, knows: learn(s.knows, e.person, e.fact) };
    case 'GrantScheduled': return { ...s, pendingGrants: [...s.pendingGrants, { person: e.person, fact: e.fact, maturesAtBoundary: e.maturesAtBoundary }] };
    case 'ClueDiscovered': return s.clues.includes(e.clue) ? s : { ...s, clues: [...s.clues, e.clue] };
    case 'FlagSet': return { ...s, flags: { ...s.flags, [e.flag]: true } };
    case 'ClockAdvanced': {
      const clock = s.clock + e.minutes;
      const boundaries = s.boundaries + boundariesCrossed(story, s.clock, clock);
      // Matured grants are emitted as FactLearned by the engine; here they only leave the queue.
      return { ...s, clock, boundaries, pendingGrants: s.pendingGrants.filter(g => g.maturesAtBoundary > boundaries) };
    }
    case 'ActEntered': {
      const act = story.acts.find(a => a.id === e.act)!;
      const persons = Object.fromEntries(Object.entries(s.persons).map(([id, p]) => [id, { ...p, override: undefined }]));
      return { ...s, act: act.id, location: act.anchorLocation, clock: act.startClockMinutes, persons };
    }
    case 'BeatQueued': return { ...s, beats: [...s.beats, { beats: e.beats, asQuote: e.asQuote }] };
    case 'Narrated': {
      const transcript = { ...s.transcript };
      for (const id of personsPresent(story, s)) {
        transcript[id] = [...(transcript[id] ?? []), { speaker: 'person' as const, text: e.text }].slice(-TRANSCRIPT_WINDOW);
      }
      return { ...s, transcript };
    }
    case 'ObservationRecorded': {
      const rest = s.observations.filter(o => o.key !== e.observation.key);
      return { ...s, observations: [...rest, e.observation] };
    }
    case 'GameEnded': return { ...s, ended: e.ending };
  }
}

function place(s: State, object: Id, placement: Placement): State {
  return { ...s, objects: { ...s.objects, [object]: { ...s.objects[object], placement, hidden: false } } };
}
function container(s: State, object: Id, state: 'open' | 'closed'): State {
  const cur = s.objects[object];
  if (!cur.container) return s;
  return { ...s, objects: { ...s.objects, [object]: { ...cur, container: { ...cur.container, state } } } };
}
function learn(knows: State['knows'], who: PersonOrPlayer, fact: Id): State['knows'] {
  return { ...knows, [who]: { ...(knows[who] ?? {}), [fact]: true } };
}

/** Fold a whole log. Replay is this and nothing else. */
export function replay(story: Story, events: EventPayload[], seed = 0): State {
  return events.reduce((s, e) => apply(story, s, e), initialState(story, seed));
}

// ── Derived views used by the engine and the projections ─────────────────────

export function currentPeriod(story: Story, s: State): Id { return periodOf(story, s.clock); }

export function currentAct(story: Story, s: State) { return story.acts.find(a => a.id === s.act)!; }

/** Where a person is now: the override if any, else the schedule for this act and period. */
export function personLocation(story: Story, s: State, personId: Id, depth = 0): Id | null {
  const ps = s.persons[personId];
  if (!ps || depth > story.persons.length) return null;
  if (ps.override !== undefined) return ps.override;
  const person = story.persons.find(p => p.id === personId)!;
  const entry = person.schedule[String(s.act)];
  if (!entry) return null;
  const place = entry.byPeriod?.[currentPeriod(story, s)] ?? entry.default;
  switch (place.kind) {
    case 'at': return place.location;
    case 'offstage': return null;
    case 'follows': return place.person === 'player' ? s.location : personLocation(story, s, place.person, depth + 1);
  }
}

export function personsPresent(story: Story, s: State): Id[] {
  return story.persons.filter(p => personLocation(story, s, p.id) === s.location).map(p => p.id);
}

/** The lock currently on an exit: the override if any, else the authored one. */
export function exitLock(story: Story, s: State, location: Id, exitId: Id): Lock | null {
  const key = `${location}/${exitId}`;
  if (key in s.exitLocks) return s.exitLocks[key];
  return story.locations.find(l => l.id === location)?.exits.find(x => x.id === exitId)?.lock ?? null;
}

/** A lock yields to a set flag or a carried key. */
export function lockOpen(s: State, lock: Lock | null): boolean {
  if (!lock) return true;
  if (lock.kind === 'flag') return s.flags[lock.flag] === true;
  return s.objects[lock.object]?.placement.kind === 'inventory';
}

export function inventory(s: State): Id[] {
  return Object.entries(s.objects).filter(([, o]) => o.placement.kind === 'inventory').map(([id]) => id);
}

/**
 * Objects the player can target here: not hidden, lying in this location, or
 * inside an open container that is itself visible here. Carried Items are
 * reported separately by `inventory`.
 */
export function visibleObjects(s: State, location: Id): Id[] {
  const here = new Set<Id>();
  for (const [id, o] of Object.entries(s.objects)) {
    if (!o.hidden && o.placement.kind === 'location' && o.placement.location === location) here.add(id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const [id, o] of Object.entries(s.objects)) {
      if (here.has(id) || o.hidden || o.placement.kind !== 'container') continue;
      const c = s.objects[o.placement.container];
      if (here.has(o.placement.container) && c.container?.state === 'open') { here.add(id); grew = true; }
    }
  }
  return [...here];
}

/** Whether a person may say a Fact now: they know it and the act allows it. */
export function canTell(story: Story, s: State, personId: Id, factId: Id): boolean {
  const f = story.facts.find(x => x.id === factId);
  return !!f && s.knows[personId]?.[factId] === true && f.visibleFromAct <= s.act;
}
