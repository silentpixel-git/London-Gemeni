// The Rule cascade. A turn's Events raise Firings; for each Firing, in the
// order raised, eligible Rules fire in authored order; their Effects become
// Events, which may raise further Firings. Proximity is raised by arrival: a
// person who was not with the player when the cascade began, and now is.
// Depth is bounded so a Story cannot loop the engine. Semantics: ADR-0005.
import type { Conditions, Effect, EventPayload, Id, PersonOrPlayer, Rule, Story, Trigger, Verb } from '../schema/index.js';
import { apply, currentAct, currentPeriod, inventory, personsPresent, type State } from './state.js';
import { clockTimePassed } from './time.js';

export type Firing =
  | { kind: 'action'; verb: Verb; target?: Id; secondary?: Id; person?: Id }
  | { kind: 'flag'; flag: Id }
  | { kind: 'enter'; location: Id }
  | { kind: 'leave'; location: Id }
  | { kind: 'clock'; from: number; to: number }
  | { kind: 'tick' }
  | { kind: 'combine'; items: Id[] }
  | { kind: 'disclosed'; fact: Id; from: PersonOrPlayer; to: PersonOrPlayer }
  | { kind: 'proximity'; person: Id }
  | { kind: 'deduction'; facts: Id[]; suspect?: Id };

const MAX_CASCADE_DEPTH = 8;

/** Firings a batch of Events raises. The action Firing comes from the intent, not from here. */
export function firingsFrom(story: Story, events: EventPayload[]): Firing[] {
  const out: Firing[] = [];
  for (const e of events) {
    switch (e.kind) {
      case 'Moved': out.push({ kind: 'leave', location: e.from }, { kind: 'enter', location: e.to }); break;
      /** The opening counts as entering the opening location, as entering any later act counts as entering its anchor. */
      case 'InvestigationStarted': out.push({ kind: 'enter', location: story.opening.location }); break;
      /** Entering an act puts the player at its anchor; that counts as entering the location. */
      case 'ActEntered': out.push({ kind: 'enter', location: story.acts.find(a => a.id === e.act)!.anchorLocation }); break;
      case 'FlagSet': out.push({ kind: 'flag', flag: e.flag }); break;
      case 'Combined': out.push({ kind: 'combine', items: e.items }); break;
      case 'FactDisclosed': out.push({ kind: 'disclosed', fact: e.fact, from: e.from, to: e.to }); break;
      case 'Deduced': out.push({ kind: 'deduction', facts: e.facts, suspect: e.suspect }); break;
      default: break;
    }
  }
  return out;
}

export function triggerMatches(t: Trigger, f: Firing, s: State): boolean {
  if (t.kind !== f.kind) return false;
  switch (t.kind) {
    case 'action': {
      const g = f as Extract<Firing, { kind: 'action' }>;
      if (!t.verb.includes(g.verb)) return false;
      if (t.target?.length && !(g.target && t.target.includes(g.target))) return false;
      if (t.secondary?.length && !(g.secondary && t.secondary.includes(g.secondary))) return false;
      if (t.person?.length && !(g.person && t.person.includes(g.person))) return false;
      return true;
    }
    case 'flag': return t.flag === (f as Extract<Firing, { kind: 'flag' }>).flag;
    case 'enter': case 'leave': return t.location === (f as Extract<Firing, { kind: 'enter' }>).location;
    case 'clock': {
      const g = f as Extract<Firing, { kind: 'clock' }>;
      if (t.act && !t.act.includes(s.act)) return false;
      return clockTimePassed(g.from, g.to, t.atMinutes);
    }
    case 'tick': return true;
    case 'combine': {
      const g = f as Extract<Firing, { kind: 'combine' }>;
      const a = [...t.items].sort().join('|'), b = [...g.items].sort().join('|');
      return a === b;
    }
    case 'disclosed': {
      const g = f as Extract<Firing, { kind: 'disclosed' }>;
      return (!t.fact || t.fact === g.fact) && (!t.from || t.from === g.from) && (!t.to || t.to === g.to);
    }
    case 'proximity': return t.person === (f as Extract<Firing, { kind: 'proximity' }>).person;
    case 'deduction': {
      const g = f as Extract<Firing, { kind: 'deduction' }>;
      if (t.facts && !t.facts.every(x => g.facts.includes(x))) return false;
      if (t.suspect && t.suspect !== g.suspect) return false;
      return true;
    }
  }
}

export function conditionsHold(story: Story, s: State, w: Conditions | undefined): boolean {
  if (!w) return true;
  if (w.act && !w.act.includes(s.act)) return false;
  if (w.location && !w.location.includes(s.location)) return false;
  if (w.period && !w.period.includes(currentPeriod(story, s))) return false;
  if (w.weather && !w.weather.includes(currentAct(story, s).weather)) return false;
  if (w.flagsAll && !w.flagsAll.every(f => s.flags[f])) return false;
  if (w.flagsNone && w.flagsNone.some(f => s.flags[f])) return false;
  if (w.hasItems) { const inv = inventory(s); if (!w.hasItems.every(i => inv.includes(i))) return false; }
  if (w.personsPresent) { const here = personsPresent(story, s); if (!w.personsPresent.every(p => here.includes(p))) return false; }
  if (w.factsKnown && !w.factsKnown.every(f => s.knows.player?.[f])) return false;
  return true;
}

export function ruleEligible(story: Story, s: State, r: Rule, f: Firing): boolean {
  if (r.once && (s.firedRules[r.id] ?? 0) > 0) return false;
  if (!triggerMatches(r.trigger, f, s)) return false;
  // A leave Rule judges its conditions from the room being left: the world as it is now, with the player still there.
  return conditionsHold(story, f.kind === 'leave' ? { ...s, location: f.location } : s, r.when);
}

/** Tick Rules that could fire now, in authored order. The engine draws one by weight. */
export function eligibleTickRules(story: Story, s: State): Rule[] {
  return story.rules.filter(r => r.trigger.kind === 'tick' && ruleEligible(story, s, r, { kind: 'tick' }));
}

/** Weighted choice; the draw in [0,1) is what the Event records. Returns null for an empty list. */
export function chooseByWeight(rules: Rule[], draw: number): Rule | null {
  const total = rules.reduce((n, r) => n + (r.weight ?? 1), 0);
  if (total === 0) return null;
  let acc = 0;
  for (const r of rules) { acc += (r.weight ?? 1) / total; if (draw < acc) return r; }
  return rules[rules.length - 1] ?? null;
}

/** Translate one Effect into Events against the current State. */
export function effectEvents(story: Story, s: State, e: Effect, ruleId: Id): EventPayload[] {
  switch (e.kind) {
    case 'setFlag': return s.flags[e.flag] ? [] : [{ kind: 'FlagSet', flag: e.flag }];
    case 'revealObject': return [{ kind: 'ObjectPlaced', object: e.object, placement: s.objects[e.object].placement, hidden: false }];
    case 'hideObject': return [{ kind: 'ObjectPlaced', object: e.object, placement: s.objects[e.object].placement, hidden: true }];
    case 'moveObject': return [{ kind: 'ObjectPlaced', object: e.object, placement: e.placement }];
    case 'giveItem': return [{ kind: 'ObjectPlaced', object: e.object, placement: { kind: 'inventory' }, hidden: false }];
    case 'takeItem': return [{ kind: 'ObjectPlaced', object: e.object, placement: { kind: 'nowhere' } }];
    case 'lockExit': return [{ kind: 'ExitLockChanged', location: e.location, exit: e.exit, lock: e.lock }];
    case 'unlockExit': return [{ kind: 'ExitLockChanged', location: e.location, exit: e.exit, lock: null }];
    case 'movePerson': return [{ kind: 'PersonMoved', person: e.person, location: e.location }];
    case 'summonPerson': return [{ kind: 'PersonMoved', person: e.person, location: s.location }];
    case 'dismissPerson': return [{ kind: 'PersonMoved', person: e.person, location: null }];
    case 'grantFact':
      if (s.knows[e.person]?.[e.fact]) return [];
      return e.delayPeriods
        ? [{ kind: 'GrantScheduled', person: e.person, fact: e.fact, maturesAtBoundary: s.boundaries + e.delayPeriods }]
        : [{ kind: 'FactLearned', person: e.person, fact: e.fact }];
    case 'setDisposition': return [{ kind: 'DispositionChanged', person: e.person, disposition: e.disposition }];
    case 'playBeat': return [{ kind: 'BeatQueued', rule: ruleId, beats: e.beats, asQuote: e.asQuote ?? false }];
    case 'cue': return [{ kind: 'CuePlayed', sound: e.sound }];
    case 'advanceAct': {
      if (s.act === e.act) return [];
      // Entering an act delivers every delayed grant still in flight (ADR-0005).
      const due = new Map<string, EventPayload>();
      for (const g of s.pendingGrants) {
        if (!s.knows[g.person]?.[g.fact]) due.set(`${g.person}/${g.fact}`, { kind: 'FactLearned', person: g.person, fact: g.fact });
      }
      return [{ kind: 'ActEntered', act: e.act }, ...due.values()];
    }
    case 'endGame': return s.ended ? [] : [{ kind: 'GameEnded', ending: e.ending }];
  }
}

export interface Cascade { events: EventPayload[]; state: State }

/**
 * Fire every eligible Rule for the given Firings, apply their Effects, and
 * follow the Firings those Effects raise, to a bounded depth. Clue discovery
 * is folded in: whenever the player comes to know a Fact, its Clue is found.
 * Stops as soon as the game ends.
 *
 * `presentBefore` is who was with the player before whatever this cascade
 * follows (a move, a Tick, the clock); anyone with the player now who was not
 * then has arrived, and raises a proximity Firing after the given ones. It
 * defaults to whoever is present in `state`, i.e. no arrivals.
 */
export function cascade(story: Story, state: State, firings: Firing[], presentBefore?: Id[]): Cascade {
  const out: EventPayload[] = [];
  let s = state;
  let pending = firings;
  let seen = presentBefore ?? personsPresent(story, s);
  for (let depth = 0; depth < MAX_CASCADE_DEPTH && !s.ended; depth++) {
    const now = personsPresent(story, s);
    pending = [...pending, ...now.filter(p => !seen.includes(p)).map(person => ({ kind: 'proximity', person }) as Firing)];
    seen = now;
    if (pending.length === 0) break;
    const produced: EventPayload[] = [];
    for (const f of pending) {
      if (s.ended) break;
      for (const r of story.rules) {
        if (s.ended) break;
        if (!ruleEligible(story, s, r, f)) continue;
        const res = fireRule(story, s, r);
        produced.push(...res.events); s = res.state;
      }
    }
    out.push(...produced);
    pending = firingsFrom(story, produced);
  }
  return { events: out, state: s };
}

export function fireRule(story: Story, s: State, r: Rule): Cascade {
  const events: EventPayload[] = [{ kind: 'RuleFired', rule: r.id }];
  s = apply(story, s, events[0]);
  for (const e of r.effects) {
    if (s.ended) break;
    for (const ev of effectEvents(story, s, e, r.id)) {
      events.push(ev); s = apply(story, s, ev);
      for (const c of clueEvents(story, s, ev)) { events.push(c); s = apply(story, s, c); }
    }
  }
  return { events, state: s };
}

/** When the player learns a Fact by any route, the Clue for it is discovered. */
export function clueEvents(story: Story, s: State, e: EventPayload): EventPayload[] {
  const fact = e.kind === 'FactLearned' && e.person === 'player' ? e.fact
    : e.kind === 'FactDisclosed' && e.to === 'player' ? e.fact : null;
  if (!fact) return [];
  return story.clues.filter(c => c.fact === fact && !s.clues.includes(c.id)).map(c => ({ kind: 'ClueDiscovered' as const, clue: c.id }));
}
