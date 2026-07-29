/**
 * flags.ts — compile-time vocabulary for authored story flags.
 *
 * Flags follow naming conventions (`examined_<loc>`, `talked_to_<npc>_at_<loc>`,
 * …) that were previously enforced by nothing: a typo in acts.ts or hints.ts
 * produced a gate that silently never opened. StoryFlag encodes each convention
 * as a template-literal type over the ID unions derived from the story tables,
 * so a misspelled flag is now a compile error at the authoring site.
 *
 * Scope: AUTHORED flags only — the ones written by hand in story data files.
 * The runtime flag store (GameSession.flags) stays Record<string, boolean>
 * because the engine also sets dynamic families (`rumor_ack_*`,
 * `vignette_<loc>_<idx>`, `world_event_<id>`, `npc_introduced_<npc>`) that are
 * constructed, not authored. One exception: `world_event_<id>` IS included in
 * StoryFlag (as WorldEventFlag, below) — the flag is still engine-constructed,
 * not authored, but authored data may legitimately *read* it (e.g. an
 * approach's requireFlags gating on a world event having already broadcast),
 * so it belongs in the vocabulary of flags authored data can reference.
 */

import type { LocationId, ObjectId } from './locations';
import type { NpcId } from './npcs';

/** Examined a location as a whole, or a specific object at a location. */
type ExaminedFlag =
  | `examined_${LocationId}`
  | `examined_${LocationId}_${ObjectId}`;

/**
 * Spoke to an NPC at a specific location. Records that a conversation happened
 * — it is NOT an interview. Act progression hangs on AskedAboutFlag instead, so
 * that walking up to a witness and saying nothing in particular cannot satisfy
 * a gate. Still read by hints and rumor acks.
 */
type TalkedToFlag = `talked_to_${NpcId}_at_${LocationId}`;

/**
 * Asked an NPC about a specific subject and got the answer: `ask bond about the
 * mutilations` resolved to a fact in the graph (see engine/stories/knowledge.ts
 * matchTopic). The suffix is the StoryFact id, loosely typed because fact ids
 * aren't preserved as literals in facts.ts — qa:validate's
 * flagUnreachableReason cross-checks the npc/fact pair against FACTS, including
 * that the NPC actually knows the fact and that it carries topics to match on.
 */
type AskedAboutFlag = `asked_${NpcId}_about_${string}`;

/** Showed an inventory item/object to an NPC. */
type ShowedFlag = `showed_${ObjectId}_to_${NpcId}`;

/** Took an object into inventory from a location. */
type TookFlag = `took_${LocationId}_${ObjectId}`;

/** Used one item with another (USE combination). */
type UsedFlag = `used_${ObjectId}_with_${ObjectId}`;

/** First visit to a location. */
type VisitedFlag = `visited_${LocationId}`;

/**
 * A world event has broadcast (see events.ts / engine/narrationContext.ts,
 * flag set once as `world_event_<id>`). The flag itself is engine-constructed,
 * not authored — but authored data (an approach's requireFlags, say) may
 * legitimately *read* it to gate content on "has this happening already
 * broadcast", so it belongs in the readable vocabulary. Loosely typed
 * (event ids aren't preserved as literals in events.ts); qa:validate's
 * flagUnreachableReason cross-checks the suffix against WORLD_EVENTS at
 * the data-integrity layer instead.
 */
type WorldEventFlag = `world_event_${string}`;

/** The act-epilogue cut has fired for an act (see computeActEpilogue). */
type EpilogueCutFlag = `act_${number}_epilogue_cut`;

/**
 * One-off story flags that don't follow a template convention.
 * Add here deliberately — anything else is treated as a typo.
 */
type LiteralFlag =
  | 'asylum_unlocked'    // set on correct deduction; gates travel to the asylum
  | 'deduction_correct'  // set via Edmund's successFlags; read by the Act 6 hint objective
  | 'true_ending'        // deduction outcome recorded by the endings flow
  | '__advance_via_correct_deduction_only__'; // Act 5 sentinel (excluded from lead pips)

/** Every flag name that may legally appear in authored story data. */
export type StoryFlag =
  | ExaminedFlag
  | EpilogueCutFlag
  | TalkedToFlag
  | AskedAboutFlag
  | ShowedFlag
  | TookFlag
  | UsedFlag
  | VisitedFlag
  | WorldEventFlag
  | LiteralFlag;

// NOTE: locations.ts and npcs.ts author a handful of flags of their own
// (locationExaminedFlag, requiresFlag, scriptedLines triggerFlag). Those can't
// be compile-checked here — StoryFlag derives from their keys, so a satisfies
// check is circular, and satisfies widens value literals regardless. They are
// covered by qa:validate's flag-grammar reachability pass instead.
