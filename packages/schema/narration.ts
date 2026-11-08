// What the narrator receives and what it may return (ADR-0002). The context
// is the whole world for that turn; the result is prose plus Observations,
// never a Fact.
import { z } from 'zod';
import { Disposition, Id } from './common.js';
import { EventPayload, Observation } from './event.js';

export const NarrationMode = z.enum(['opening', 'full', 'compact', 'flavour']);
export type NarrationMode = z.infer<typeof NarrationMode>;

export const NarrationContext = z.object({
  mode: NarrationMode,
  storyTitle: z.string(),
  narrator: z.object({ name: z.string(), aliases: z.array(z.string()), voice: z.array(z.string()) }).optional(),
  lexicon: z.array(z.string()),
  act: z.object({ id: z.number().int(), name: z.string(), dateLabel: z.string() }),
  clock: z.object({ minutes: z.number().int(), period: z.string(), weather: z.string() }),
  location: z.object({ id: Id, name: z.string(), beats: z.array(z.string()) }),
  personsPresent: z.array(z.object({
    id: Id,
    /** Alias until introduced. */
    label: z.string(),
    disposition: Disposition,
    beats: z.array(z.string()),
  })),
  objectsVisible: z.array(z.object({ id: Id, name: z.string() })),
  /** What the engine resolved this turn; the narration describes exactly this. */
  events: z.array(EventPayload),
  /** Authored lines that must appear in substance this turn. */
  beats: z.array(z.string()),
  /** Facts that may be stated this turn, verbatim or in voice. */
  facts: z.array(z.object({ id: Id, statement: z.string(), voice: z.string().optional() })),
  /** Flavour already canon for the subjects in scope. */
  observations: z.array(Observation),
  /** Per present person: what they have told the player and heard from them. */
  ledger: z.array(z.object({
    person: Id,
    told: z.array(z.string()),
    heard: z.array(z.string()),
  })),
  transcript: z.array(z.object({
    person: Id,
    lines: z.array(z.object({ speaker: z.enum(['player', 'person']), text: z.string() })),
  })),
  wordBudget: z.number().int().min(20),
}).strict();
export type NarrationContext = z.infer<typeof NarrationContext>;

export const NarrationResult = z.object({
  prose: z.string().min(1),
  observations: z.array(Observation),
}).strict();
export type NarrationResult = z.infer<typeof NarrationResult>;
