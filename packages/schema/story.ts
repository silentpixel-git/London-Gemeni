// The Story: everything authored for one game, as data. The engine knows no
// particular Story (ADR-0004).
import { z } from 'zod';
import { ClockMinutes, Disposition, Id, Lock, Placement, TimePeriod, Weather } from './common';
import { Rule } from './rule';

const Beats = z.array(z.string().min(1));

export const Exit = z.object({
  id: Id,
  /** What the player may call it: "north", "the yard door". */
  names: z.array(z.string().min(1)).min(1),
  to: Id,
  lock: Lock.optional(),
  /** Narrated when the player tries a locked exit. */
  lockedBeat: z.string().optional(),
}).strict();
export type Exit = z.infer<typeof Exit>;

export const Location = z.object({
  id: Id,
  name: z.string().min(1),
  beats: Beats.min(1),
  exits: z.array(Exit),
  /** Closed outside these periods; absent means always open. */
  openPeriods: z.array(TimePeriod).min(1).optional(),
  closedBeat: z.string().optional(),
}).strict();
export type Location = z.infer<typeof Location>;

export const Container = z.object({
  state: z.enum(['open', 'closed', 'locked']),
  lock: Lock.optional(),
}).strict();

export const StoryObject = z.object({
  id: Id,
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  beats: Beats.min(1),
  placement: Placement,
  /** Can be carried. The inventory is the set of Items whose placement is inventory. */
  item: z.boolean(),
  /** Placed but not yet visible; a revealObject Effect shows it. */
  hidden: z.boolean().optional(),
  /** READ shows this text verbatim. */
  document: z.string().optional(),
  /** Reading this Object teaches the player this Fact; showing it tells the Fact to the person shown. */
  fact: Id.optional(),
  container: Container.optional(),
}).strict();
export type StoryObject = z.infer<typeof StoryObject>;

export const Place = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('at'), location: Id }),
  z.object({ kind: z.literal('follows'), person: Id }),
  z.object({ kind: z.literal('offstage') }),
]);
export type Place = z.infer<typeof Place>;

export const ScheduleEntry = z.object({
  default: Place,
  byPeriod: z.partialRecord(TimePeriod, Place).optional(),
}).strict();

export const Introduction = z.discriminatedUnion('kind', [
  /** Introduces themself on first talk. */
  z.object({ kind: z.literal('self') }),
  /** Named once this document Object is read. */
  z.object({ kind: z.literal('document'), object: Id }),
]);

export const Person = z.object({
  id: Id,
  name: z.string().min(1),
  /** Shown instead of the name until the introduction condition is met. */
  alias: z.string().min(1).optional(),
  introduction: Introduction.optional(),
  /** Keys are act ids as strings. An act with no entry means offstage. */
  schedule: z.record(z.string().regex(/^\d+$/), ScheduleEntry),
  disposition: Disposition,
  /** Demeanor and voice notes for the narrator. */
  beats: Beats.min(1),
}).strict();
export type Person = z.infer<typeof Person>;

export const Fact = z.object({
  id: Id,
  statement: z.string().min(1),
  knownBy: z.array(Id),
  /** Earliest act in which any person may surface this Fact. */
  visibleFromAct: z.number().int().min(0),
  /** Phrases the player might use to ask about it. */
  topics: z.array(z.string().min(1)).min(1),
  /** How a given person phrases it, when the plain statement would not do. */
  voices: z.record(Id, z.string().min(1)).optional(),
  /** Words that would leak this Fact if they appeared in a beat visible earlier. */
  spoilerTerms: z.array(z.string().min(1)).optional(),
}).strict();
export type Fact = z.infer<typeof Fact>;

export const Clue = z.object({
  id: Id,
  name: z.string().min(1),
  fact: Id,
  /** The diary line. */
  summary: z.string().min(1),
  connections: z.array(Id).optional(),
}).strict();
export type Clue = z.infer<typeof Clue>;

export const Act = z.object({
  id: z.number().int().min(0),
  name: z.string().min(1),
  anchorLocation: Id,
  startClockMinutes: ClockMinutes,
  /** Free text shown in the sidebar, e.g. "9 November 1888". */
  dateLabel: z.string().min(1),
  weather: Weather,
}).strict();
export type Act = z.infer<typeof Act>;

export const Ending = z.object({
  id: Id,
  name: z.string().min(1),
  beats: Beats.min(1),
}).strict();
export type Ending = z.infer<typeof Ending>;

export const Opening = z.object({
  act: z.number().int().min(0),
  location: Id,
  beats: Beats.min(1),
}).strict();

export const Story = z.object({
  id: Id,
  title: z.string().min(1),
  acts: z.array(Act).min(1),
  opening: Opening,
  locations: z.array(Location).min(1),
  objects: z.array(StoryObject),
  persons: z.array(Person),
  facts: z.array(Fact),
  clues: z.array(Clue),
  rules: z.array(Rule),
  endings: z.array(Ending).min(1),
}).strict();
export type Story = z.infer<typeof Story>;
