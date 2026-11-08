// Events: the only thing an Investigation stores. State is the replay of its
// Events (ADR-0001). The union is closed; adding a kind means teaching the
// reducer and every projection about it.
import { z } from 'zod';
import { Disposition, Id, Lock, PersonOrPlayer, Placement, Verb } from './common.js';

export const Observation = z.object({
  /** Stable key so the same detail is reproduced, e.g. "clock_face_crack". */
  key: Id,
  /** The Object, person or location the detail belongs to. */
  subject: Id,
  text: z.string().min(1),
}).strict();
export type Observation = z.infer<typeof Observation>;

export const EventPayload = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('InvestigationStarted'), story: Id, seed: z.number().int() }),
  z.object({ kind: z.literal('TurnReceived'), text: z.string() }),
  z.object({ kind: z.literal('IntentSelected'), verb: Verb, target: Id.optional(), secondary: Id.optional(), person: Id.optional(), topic: Id.optional(), exit: Id.optional(), facts: z.array(Id).optional() }),
  z.object({ kind: z.literal('IntentRejected'), reason: z.string() }),
  z.object({ kind: z.literal('FlavourRequested'), subject: z.string() }),
  z.object({ kind: z.literal('Moved'), from: Id, to: Id, exit: Id }),
  z.object({ kind: z.literal('MoveBlocked'), exit: Id, reason: z.enum(['locked', 'closed']), lock: Lock.nullable() }),
  z.object({ kind: z.literal('Looked') }),
  z.object({ kind: z.literal('InventoryChecked') }),
  z.object({ kind: z.literal('OpenBlocked'), object: Id, lock: Lock }),
  /** The player named Facts and/or a suspect. */
  z.object({ kind: z.literal('Deduced'), facts: z.array(Id), suspect: Id.optional() }),
  z.object({ kind: z.literal('Examined'), object: Id }),
  z.object({ kind: z.literal('Read'), object: Id }),
  z.object({ kind: z.literal('Taken'), object: Id }),
  z.object({ kind: z.literal('Dropped'), object: Id }),
  z.object({ kind: z.literal('Opened'), object: Id }),
  z.object({ kind: z.literal('Closed'), object: Id }),
  z.object({ kind: z.literal('Used'), object: Id, on: Id.optional() }),
  z.object({ kind: z.literal('Combined'), items: z.array(Id).length(2) }),
  z.object({ kind: z.literal('Shown'), object: Id, person: Id }),
  z.object({ kind: z.literal('Given'), object: Id, person: Id }),
  z.object({ kind: z.literal('Spoke'), person: Id, fact: Id.optional() }),
  /** A Fact passed in conversation: the only Event the Disclosure Ledger reads. */
  z.object({ kind: z.literal('FactDisclosed'), from: PersonOrPlayer, to: PersonOrPlayer, fact: Id }),
  /** Someone now knows a Fact by any other route: reading, a Rule, a matured rumor. */
  z.object({ kind: z.literal('FactLearned'), person: PersonOrPlayer, fact: Id }),
  z.object({ kind: z.literal('ClueDiscovered'), clue: Id }),
  z.object({ kind: z.literal('FlagSet'), flag: Id }),
  z.object({ kind: z.literal('ObjectPlaced'), object: Id, placement: Placement, hidden: z.boolean().optional() }),
  z.object({ kind: z.literal('ExitLockChanged'), location: Id, exit: Id, lock: Lock.nullable() }),
  z.object({ kind: z.literal('PersonMoved'), person: Id, location: Id.nullable() }),
  z.object({ kind: z.literal('DispositionChanged'), person: Id, disposition: Disposition }),
  z.object({ kind: z.literal('RuleFired'), rule: Id }),
  /** A grantFact with a delay: matures once this many period boundaries have been crossed in total. */
  z.object({ kind: z.literal('GrantScheduled'), person: PersonOrPlayer, fact: Id, maturesAtBoundary: z.number().int().min(0) }),
  /** Authored lines the narrator must carry this turn. */
  z.object({ kind: z.literal('BeatQueued'), rule: Id, beats: z.array(z.string()), asQuote: z.boolean() }),
  z.object({ kind: z.literal('CuePlayed'), sound: Id }),
  /** draw is the recorded random number in [0,1) that chose among eligible Rules. */
  z.object({ kind: z.literal('TickResolved'), minutes: z.number().int().min(1), draw: z.number().min(0).lt(1), rule: Id.nullable() }),
  z.object({ kind: z.literal('ClockAdvanced'), minutes: z.number().int().min(1) }),
  z.object({ kind: z.literal('ActEntered'), act: z.number().int().min(0) }),
  z.object({ kind: z.literal('Narrated'), text: z.string(), beats: z.array(z.string()) }),
  z.object({ kind: z.literal('ObservationRecorded'), observation: Observation }),
  z.object({ kind: z.literal('GameEnded'), ending: Id }),
]);
export type EventPayload = z.infer<typeof EventPayload>;
export type EventKind = EventPayload['kind'];

/** One row of an Investigation's log. */
export const LogEvent = z.object({
  seq: z.number().int().min(0),
  turn: z.number().int().min(0),
  payload: EventPayload,
}).strict();
export type LogEvent = z.infer<typeof LogEvent>;
