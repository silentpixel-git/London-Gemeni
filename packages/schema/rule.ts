// Rules: the only way a Story changes the world beyond the built-in verbs.
// Trigger and Effect are closed unions on purpose (ADR-0004): the prover and
// the editor can only reason about what they can enumerate.
import { z } from 'zod';
import { Conditions, Disposition, Id, Lock, PersonOrPlayer, Placement, Verb, ClockMinutes } from './common.js';

export const Trigger = z.discriminatedUnion('kind', [
  /** A built-in verb resolved on a target. Empty arrays mean "any". */
  z.object({
    kind: z.literal('action'),
    verb: z.array(Verb).min(1),
    target: z.array(Id).optional(),
    secondary: z.array(Id).optional(),
    person: z.array(Id).optional(),
  }).strict(),
  z.object({ kind: z.literal('flag'), flag: Id }).strict(),
  /** The player arrives in the location: by moving, by entering an act whose anchor it is, or at the opening. */
  z.object({ kind: z.literal('enter'), location: Id }).strict(),
  /** The player moves out of the location. The Rule's `when` is judged from the room being left. */
  z.object({ kind: z.literal('leave'), location: Id }).strict(),
  /** The Investigation clock passes a time of day during the given act(s). */
  z.object({ kind: z.literal('clock'), atMinutes: ClockMinutes, act: z.array(z.number().int().min(0)).min(1).optional() }).strict(),
  /** An idle or WAIT turn. Selected by weight among eligible tick Rules. */
  z.object({ kind: z.literal('tick') }).strict(),
  z.object({ kind: z.literal('combine'), items: z.array(Id).length(2) }).strict(),
  /** A Fact was told. Omitted fields match anything. */
  z.object({ kind: z.literal('disclosed'), fact: Id.optional(), from: PersonOrPlayer.optional(), to: PersonOrPlayer.optional() }).strict(),
  /**
   * The player and the person come to share a location: the player arrives where
   * the person is, the person arrives where the player is (a Rule, a schedule,
   * an act entry), or the game opens with them together. Fires once per arrival,
   * not on every turn they stay together (ADR-0005).
   */
  z.object({ kind: z.literal('proximity'), person: Id }).strict(),
  /** The player names Facts and/or a suspect. All listed facts must be named. */
  z.object({ kind: z.literal('deduction'), facts: z.array(Id).min(1).optional(), suspect: Id.optional() }).strict(),
]);
export type Trigger = z.infer<typeof Trigger>;

export const Effect = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('setFlag'), flag: Id }).strict(),
  z.object({ kind: z.literal('revealObject'), object: Id }).strict(),
  z.object({ kind: z.literal('hideObject'), object: Id }).strict(),
  z.object({ kind: z.literal('moveObject'), object: Id, placement: Placement }).strict(),
  z.object({ kind: z.literal('giveItem'), object: Id }).strict(),
  z.object({ kind: z.literal('takeItem'), object: Id }).strict(),
  z.object({ kind: z.literal('lockExit'), location: Id, exit: Id, lock: Lock }).strict(),
  z.object({ kind: z.literal('unlockExit'), location: Id, exit: Id }).strict(),
  z.object({ kind: z.literal('movePerson'), person: Id, location: Id }).strict(),
  /** Brings the person to wherever the player is. */
  z.object({ kind: z.literal('summonPerson'), person: Id }).strict(),
  z.object({ kind: z.literal('dismissPerson'), person: Id }).strict(),
  /** The person learns the Fact, optionally after N time-period boundaries; entering any act delivers it at once. */
  z.object({ kind: z.literal('grantFact'), person: PersonOrPlayer, fact: Id, delayPeriods: z.number().int().min(0).optional() }).strict(),
  z.object({ kind: z.literal('setDisposition'), person: Id, disposition: Disposition }).strict(),
  /** Authored lines the narrator must carry this turn. asQuote renders as a world blockquote. */
  z.object({ kind: z.literal('playBeat'), beats: z.array(z.string().min(1)).min(1), asQuote: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal('cue'), sound: Id }).strict(),
  z.object({ kind: z.literal('advanceAct'), act: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal('endGame'), ending: Id }).strict(),
]);
export type Effect = z.infer<typeof Effect>;

export const Rule = z.object({
  id: Id,
  trigger: Trigger,
  when: Conditions.optional(),
  effects: z.array(Effect).min(1),
  /** Required so a puzzle that should fire once is never left repeating by accident. */
  once: z.boolean(),
  /** Relative chance among eligible tick Rules. Only meaningful on tick triggers. */
  weight: z.number().int().min(1).optional(),
}).strict();
export type Rule = z.infer<typeof Rule>;
