// The turn: the one entry point the server, the QA scripts and the prover
// all drive. Deterministic given (story, state, input, rng); every random
// draw lands in an Event.
import type { EventPayload, Selection, Story, Verb } from '../schema';
import { candidates } from './candidates';
import { turnRng, type Rng } from './rng';
import { cascade, chooseByWeight, clueEvents, eligibleTickRules, fireRule, firingsFrom, type Firing } from './rules';
import { apply, personsPresent, type State } from './state';
import { resolveVerb, type Intent } from './verbs';

export { candidates };
export type { Intent };

/** In-world minutes each verb costs. wait is the player's explicit Tick. */
export const MINUTES: Record<Verb, number> = {
  look: 2, examine: 3, read: 5, take: 1, drop: 1, open: 1, close: 1, use: 3, combine: 3,
  show: 3, give: 2, talk: 5, ask: 5, deduce: 10, move: 10, wait: 30, inventory: 0,
};
/** Minutes an idle Tick advances the clock. */
export const TICK_MINUTES = 15;

export interface TurnInput { text: string; selection: Selection }
export interface TurnResult { events: EventPayload[]; state: State }

export function resolveTurn(story: Story, state: State, input: TurnInput, rng: Rng = turnRng(state.seed, state.turn + 1)): TurnResult {
  const t = new Emitter(story, state);
  t.emit({ kind: 'TurnReceived', text: input.text });
  if (state.ended) { t.emit({ kind: 'IntentRejected', reason: 'the investigation has ended' }); return t.result(); }

  switch (input.selection.kind) {
    case 'none':
      t.emit({ kind: 'IntentRejected', reason: input.selection.reason ?? 'nothing in reach matched' });
      return t.result();
    case 'flavour':
      t.emit({ kind: 'FlavourRequested', subject: input.selection.subject });
      advanceClock(t, MINUTES.look);
      return t.result();
    case 'intent': {
      const { kind: _k, ...intent } = input.selection;
      t.emit({ kind: 'IntentSelected', ...intent });
      if (intent.verb === 'wait') { tickInto(t, MINUTES.wait, rng); return t.result(); }

      // Proximity is a start-of-turn fact: its Rules see the world before the verb moves anything.
      t.absorb(cascade(story, t.state, proximityFirings(story, t.state)));
      if (t.state.ended) return t.result();
      const verbEvents = resolveVerb(story, t.state, intent);
      for (const e of verbEvents) {
        t.emit(e);
        for (const c of clueEvents(story, t.state, e)) t.emit(c);
      }
      const rejected = verbEvents.some(e => e.kind === 'IntentRejected');
      // A blocked attempt (locked door, locked chest) is not the action: its trigger does not fire, but trying still costs time.
      const blocked = rejected || verbEvents.some(e => e.kind === 'MoveBlocked' || e.kind === 'OpenBlocked');
      const firings: Firing[] = [
        ...(blocked ? [] : [{ kind: 'action', verb: intent.verb, target: intent.target, secondary: intent.secondary, person: intent.person } as Firing]),
        ...firingsFrom(story, verbEvents),
      ];
      t.absorb(cascade(story, t.state, firings));
      // Entering an act sets the clock to that act's start; the verb's own minutes would skew it.
      if (!rejected && !t.events.some(e => e.kind === 'ActEntered')) advanceClock(t, MINUTES[intent.verb]);
      return t.result();
    }
  }
}

/** An idle Tick: the world moves without the player. */
export function tick(story: Story, state: State, minutes: number = TICK_MINUTES, rng: Rng = turnRng(state.seed, state.turn + 1)): TurnResult {
  const t = new Emitter(story, state);
  if (state.ended) return t.result();
  tickInto(t, minutes, rng);
  return t.result();
}

function tickInto(t: Emitter, minutes: number, rng: Rng) {
  t.absorb(cascade(t.story, t.state, proximityFirings(t.story, t.state)));
  if (t.state.ended) return;
  const eligible = eligibleTickRules(t.story, t.state);
  const draw = rng.next();
  const chosen = chooseByWeight(eligible, draw);
  t.emit({ kind: 'TickResolved', minutes, draw, rule: chosen?.id ?? null });
  const fired = chosen ? t.absorb(fireRule(t.story, t.state, chosen)) : [];
  t.absorb(cascade(t.story, t.state, firingsFrom(t.story, fired)));
  advanceClock(t, minutes);
}

function proximityFirings(story: Story, s: State): Firing[] {
  return personsPresent(story, s).map(person => ({ kind: 'proximity', person }));
}

/** Move the clock, mature scheduled grants, and fire clock Rules the move passed. */
function advanceClock(t: Emitter, minutes: number) {
  if (t.state.ended || minutes <= 0) return;
  const from = t.state.clock;
  const before = t.state;
  t.emit({ kind: 'ClockAdvanced', minutes });
  const to = t.state.clock;
  const matured = before.pendingGrants.filter(g => g.maturesAtBoundary <= t.state.boundaries);
  for (const g of matured) {
    if (t.state.knows[g.person]?.[g.fact]) continue;
    const e: EventPayload = { kind: 'FactLearned', person: g.person, fact: g.fact };
    t.emit(e);
    for (const c of clueEvents(t.story, t.state, e)) t.emit(c);
  }
  t.absorb(cascade(t.story, t.state, [{ kind: 'clock', from, to }]));
}

/** Collects Events and keeps State in step with them. */
class Emitter {
  events: EventPayload[] = [];
  constructor(public story: Story, public state: State) {}
  emit(e: EventPayload) { this.events.push(e); this.state = apply(this.story, this.state, e); }
  absorb(c: { events: EventPayload[]; state: State }) { this.events.push(...c.events); this.state = c.state; return c.events; }
  result(): TurnResult { return { events: this.events, state: this.state }; }
}
