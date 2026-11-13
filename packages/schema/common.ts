// Shared primitives for every schema in this package. Nothing here knows a
// particular Story; see GLOSSARY.md for the vocabulary.
import { z } from 'zod';

/** snake_case identifier. Every authored thing is referenced by one of these. */
export const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are snake_case: [a-z][a-z0-9_]*');
export type Id = z.infer<typeof Id>;

/** 'player' may stand where a person id is expected (facts told to or by the player). */
export const PersonOrPlayer = z.union([Id, z.literal('player')]);
export type PersonOrPlayer = z.infer<typeof PersonOrPlayer>;

/** Clock of day in minutes, 0..1439. */
export const ClockMinutes = z.number().int().min(0).max(1439);

/**
 * A named stretch of the day. The Story declares its own list (dawn, morning,
 * …, or watches, or bells); the engine only needs each one's start time.
 */
export const Period = z.object({ id: Id, name: z.string().min(1), startMinutes: ClockMinutes }).strict();
export type Period = z.infer<typeof Period>;

/** A named weather state the Story declares; acts and conditions refer to it by id. */
export const WeatherState = z.object({
  id: Id,
  name: z.string().min(1),
  /** Sound id of the weather layer the client plays; the client's table decides what, if anything, that is. */
  ambience: Id.optional(),
}).strict();
export type WeatherState = z.infer<typeof WeatherState>;

export const Disposition = z.enum(['hostile', 'wary', 'neutral', 'warm', 'trusting']);
export type Disposition = z.infer<typeof Disposition>;

/** The built-in verbs. A Story adds behaviour with Rules, never new verbs. */
export const Verb = z.enum([
  'look', 'examine', 'read', 'take', 'drop', 'open', 'close', 'use', 'combine',
  'show', 'give', 'talk', 'ask', 'deduce', 'move', 'wait', 'inventory',
]);
export type Verb = z.infer<typeof Verb>;

/** A lock on an exit or a container: opened by a flag or by carrying a key Item. */
export const Lock = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('flag'), flag: Id }),
  z.object({ kind: z.literal('key'), object: Id }),
]);
export type Lock = z.infer<typeof Lock>;

/** Where an Object is. One identity whether it lies in a room or in the bag. */
export const Placement = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('location'), location: Id }),
  z.object({ kind: z.literal('container'), container: Id }),
  z.object({ kind: z.literal('inventory') }),
  z.object({ kind: z.literal('person'), person: Id }),
  z.object({ kind: z.literal('nowhere') }),
]);
export type Placement = z.infer<typeof Placement>;

/**
 * Conditions a Rule needs before it may fire. Every field is optional and
 * all present fields must hold. Flags are plain strings; the validator
 * checks each one is set by some Effect.
 */
export const Conditions = z.object({
  act: z.array(z.number().int().min(0)).min(1).optional(),
  location: z.array(Id).min(1).optional(),
  period: z.array(Id).min(1).optional(),
  weather: z.array(Id).min(1).optional(),
  flagsAll: z.array(Id).min(1).optional(),
  flagsNone: z.array(Id).min(1).optional(),
  hasItems: z.array(Id).min(1).optional(),
  personsPresent: z.array(Id).min(1).optional(),
  factsKnown: z.array(Id).min(1).optional(),
}).strict();
export type Conditions = z.infer<typeof Conditions>;
