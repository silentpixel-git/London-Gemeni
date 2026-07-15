// Shared type definitions for all story manifests.
// Each story's data files import from here.

import type { HintTarget, HintVerb, TimePeriod } from '../../types';

// Flag-bearing interfaces take an optional flag-name type parameter (default
// string). The engine consumes them un-parameterized; story data files
// instantiate F with their authored flag union (e.g. whitechapel's StoryFlag)
// so flag typos become compile errors at the authoring site.
export interface LocationDefinition<F extends string = string> {
  id: string;
  name: string;
  shortName: string;
  act: number;                     // Minimum act required to access this location
  requiresFlag?: F;                // If set, this flag must be true to enter (e.g. asylum requires a correct deduction)
  atmosphere: string;
  description: string;
  exits: string[];                 // Location IDs. Engine validates these.
  interactables: string[];         // Object IDs present here
  locationExaminedFlag: F;         // Flag set when player examines anything here
  // Temporal framing — drives AI narration register
  timeframe: 'present' | 'reconstruction';
  // Used by AI when timeframe === 'reconstruction'. Explains to the AI exactly
  // how Watson is visiting this past crime scene (from reports, from memory, etc.)
  reconstitutionNote?: string;
  // Time of day for this location — drives UI colour theming (CSS deferred to user design pass)
  // Reconstruction locations use the original crime's time, not Watson's visit time.
  timeOfDay: 'morning' | 'midday' | 'afternoon' | 'night';
  // Prose-only background figures (never interactable, no dialogue with Watson).
  // One is rotated into full-mode narration to make streets feel populated.
  extras?: string[];
  // One-shot authored micro-scenes. Each fires at most once per playthrough
  // (flag vignette_<locId>_<idx>), replacing the random blockquote seed.
  vignettes?: Array<{ text: string; act?: number }>;
  // Opening hours (Phase 4a). Absent = always open. When set, arriving in a
  // period not listed is blocked with the authored lockedNote; qa:validate
  // requires lockedNote whenever openPeriods is set.
  openPeriods?: TimePeriod[];
  lockedNote?: {
    text: string;             // authored locked-door beat, diegetic
    keyholderNpcId?: string;  // whereabouts derived from their schedule, never hand-written
  };
}

export interface NPCDefinition<F extends string = string> {
  id: string;
  displayName: string;
  role: string;
  description: string;
  speakingStyle: string;
  personality: string[];
  followingRule: 'follows_watson' | 'follows_bond' | 'location_based' | 'fixed';
  followsNpcId?: string;       // For follows_watson/'follows_bond': the entity ID to shadow ('watson' = player)
  followsUntilAct?: number;    // After this act, the NPC stops following and reverts to its canonical location (e.g. Edmund committed in Act 6)
  // NPC placement — derived per turn from (act, timePeriod). `default` is the
  // act's anchor spot (the old canonicalLocationByAct value); byPeriod entries
  // move the NPC by time of day (e.g. evening at the pub). An act with NO
  // entry means OFFSTAGE for that act (e.g. Tumblety after he flees).
  scheduleByAct: Record<number, {
    default: string;
    byPeriod?: Partial<Record<TimePeriod, string>>;
  }>;
  // NPC introduction system — hides identity until Watson learns their name
  alias?: string;                  // e.g. "Bond's assistant", "a police inspector"
  aliasDescription?: string;       // Brief sensory description shown before introduction
  requiresIntroduction?: boolean;  // If true, shown as alias until introduced via flag
  // How the real name is learned. Absent = self (first TALK). 'document' NPCs
  // are introduced when the player examines the named object instead.
  introduction?: NPCIntroduction;
  // Scripted presence moments — directorial instructions injected into AI context
  // when this NPC is present at the specified location (and optional flag is satisfied).
  // The AI works them in naturally; they are spirit-of-the-moment guidance, not fixed lines.
  scriptedLines?: Array<{
    locationId: string;    // Only fire at this location
    triggerFlag?: F;       // Optional: only fire if session.flags[triggerFlag] is true
    act?: number;          // Optional: only fire during this act (omit = any act)
    instruction: string;   // Directorial instruction for the AI
  }>;
  // Rotating idle beats — flat ambient texture for a present NPC. The engine
  // injects at most ONE beat per turn across ALL present NPCs (round-robin by
  // turn count), never for the interview target, and none on a turn where a
  // scripted moment or safety net fires. locationId scopes a beat to a prop
  // that lives at one location (Holmes's violin at Baker Street); omit it for
  // a portable personality quirk. Keep flat and unemphasized (recession rule
  // for Edmund). For requiresIntroduction NPCs write alias-safe text ("the
  // surgeon", "he") — a beat can fire before Watson learns the name.
  idleBeats?: Array<{
    text: string;          // Directorial beat, no narrative weight
    locationId?: string;   // Only fire at this location (omit = anywhere)
    act?: number;          // Only fire during this act (omit = any act)
  }>;
}

export interface ClueDefinition {
  id: string;
  name: string;
  description: string;           // What Watson records
  diaryNote: string;             // Watson's first-person diary line for this clue (auto-captured casebook)
  holmesDeduction: string;       // What Holmes concludes
  locationFound: string;         // Location ID where this clue is found
  triggerObject: string;         // Object ID that triggers this clue
  connections: string[];         // Related clue IDs
  clueGroup: number;             // Numeric group from story design
  medicalPoints: number;         // Points awarded (medical path)
  moralPoints: number;           // Points awarded (moral path)
}

export interface ActCondition<F extends string = string> {
  name: string;
  requireFlags: F[];             // All must be set to auto-advance
  advanceTo: number;
}

// ── Fact graph (Phase 2a) ────────────────────────────────────────────────────
// World knowledge as atomic facts. NPC knowledge envelopes are DERIVED views:
// facts where knownBy includes the NPC and the act gate passes. One edit
// updates every NPC consistently; spoiler gating is mechanical.
export interface StoryFact {
  id: string;             // unique, snake_case
  statement: string;      // the prose line rendered into the AI prompt (the hard knowledge ceiling)
  knownBy: string[];      // NPC ids that can voice this fact
  visibleFromAct: number; // earliest act (0-6) this fact may surface; 0 = always
  relatedClues?: string[]; // clue ids this fact supports (validator-checked)
}

// ── World events (Phase 4a) ──────────────────────────────────────────────────
// Authored broadcasts that land in the narration as blockquotes wherever
// Watson is, once the clock passes their fire time. Narration-only — no
// world effects. Delivered-once via flag `world_event_<id>`.
export interface WorldEventDefinition {
  id: string;              // unique, snake_case
  act: number;             // only fires during this act
  atClockMinutes: number;  // clock-of-day (0-1439), e.g. 840 = 2:00 PM. A value
                           // EARLIER than the act's canonical start means the
                           // NEXT day (e.g. dawn during the act-0 night vigil).
  text: string;            // the beat itself — spoiler-guarded by qa:validate
}

// ── Rumor propagation (Phase 4b) ─────────────────────────────────────────────
// Fully-authored knowledge spread: when triggerFlag first fires, each spread
// entry's statement enters that NPC's knowledge envelope after delayPeriods
// TimePeriod boundaries (0 = same period; any act transition matures all).
// Every hop is authored — recipient, delay, and hearsay wording — so the
// spoiler surface stays a static list (see the 2a dedupe finding: shared
// statement text across NPC voices does not work in this story).
export interface RumorDefinition<F extends string = string> {
  id: string;                 // unique, snake_case; key in the session rumor-event log
  triggerFlag: F;             // engine-set flag, e.g. 'showed_from_hell_letter_to_bond'
  spread: Array<{
    npcId: string;            // recipient
    delayPeriods: number;     // TimePeriod boundaries after the trigger (integer 0–8)
    statement: string;        // hearsay-worded line, authored per recipient
  }>;
}

// ── NPC approaches ───────────────────────────────────────────────────────────
// The world initiates contact: authored one-shot beats where a present NPC
// steps up to Watson unprompted — mundane texture, or a matured rumor
// delivered. Fired once via flag `approach_<id>`; at most one per turn,
// first-eligible in file order; the engine suppresses them on dramatic
// turns (see engine/approaches.ts). An approach counts as a first TALK for
// introduction purposes: self-introduction NPCs reveal their name in-beat,
// document-gated NPCs stay alias-masked.
export interface ApproachDefinition<F extends string = string> {
  id: string;                      // unique, snake_case
  npcId: string;
  locationId: string | 'any';      // 'any' = wherever the NPC's schedule has them
  acts?: number[];                 // omit = any act the NPC is onstage
  timePeriods?: TimePeriod[];      // omit = any period
  requireFlags?: F[];
  forbidFlags?: F[];
  kind: 'mundane' | 'rumor';
  // The authored beat — the canonical content spine. For 'rumor', the
  // delivery framing around the matured statement.
  text: string;
  rumorId?: string;                // required iff kind === 'rumor'
}

export interface SuspectProfile<F extends string = string> {
  npcId: string;
  aliases: string[];           // lowercase name variants the player might type
  isGuilty: boolean;
  successFlags?: Partial<Record<F, boolean>>;
  successAct?: number;
  successVisitFlag?: F;        // if this flag is already set, the game ends on correct deduction
  wrongDeductionNote?: string; // for isGuilty:false red herrings — tailored cold-case narration instruction
}

export interface ActTimeConfig {
  canonicalMinutes: number; // Minutes from midnight at act start
  dayOfWeek: string;
  displayDate: string;      // e.g. "9 November 1888"
}

export type WeatherCondition =
  | 'foggy' | 'drizzle' | 'pouring' | 'overcast' | 'clear-night' | 'clear-cold';

export interface ActWeather {
  condition: WeatherCondition;
  label: string; // Short sidebar label, e.g. "Foggy"
  // Intra-act weather drift: once elapsedMinutes passes afterMinutes, the act's
  // weather shifts (e.g. a clear evening surrendering to fog). Derived in
  // buildContext — no persistence required.
  lateShift?: { afterMinutes: number; condition: WeatherCondition; label: string };
}

export interface ShowInteraction {
  clueId?: string;       // Clue unlocked by this show action (optional)
  resultNote: string;    // Passed to AI as actionResultNote
}

export interface UseCombination {
  clueId?: string;
  resultNote: string;
  // Optional: the combination only works at this location (e.g. the document
  // comparison that must happen at Baker Street, against the casefiles).
  requiresLocation?: string;
  // Optional: the combination only works from this act onward (spoiler gate —
  // e.g. the kidney cross-reference grants asylum-reveal content).
  requiresAct?: number;
}

export interface PersonOfInterest<F extends string = string> {
  id: string;            // stable key
  label: string;         // e.g. "The Mad Doctor (Francis Tumblety)"
  detail: string;        // one-line motive/means note shown in the notebook
  requiresFlag?: F;      // only listed once this flag is set
  clearedByFlag?: F;     // annotated as cleared once this flag is set
  clearedNote?: string;  // e.g. "alibied and released" — shown when cleared
}

/** Narrow, read-only slice of session state the selector needs. */
export interface HintState {
  currentAct: number;
  location: string;
  flags: Record<string, boolean>;
  inventory: string[];
  npcStates: Record<string, { currentLocation?: string; status?: string }>;
  /** Visit count per location id. Used to decide whether Watson may know a
   *  location's contents (a hint must not name objects he has never seen). */
  locationVisitCounts: Record<string, number>;
}

export interface HintObjective<F extends string = string> {
  id: string;
  act: number;
  locationId: string;
  verb: HintVerb;
  /** Neutral, player-facing noun phrase. MUST NOT reveal clue content. */
  subject: string;
  /** The exact ACT_PROGRESSION gate flag this objective's `done` tracks, when
   *  it maps 1:1 onto one (most do). Absent for prerequisite-only steps (e.g.
   *  examining the newspaper pile before it can be shown) and for objectives
   *  whose `done` isn't a single-flag check (Act 5's inventory-based steps). */
  flag?: F;
  done: (s: HintState) => boolean;
  available: (s: HintState) => boolean;
}

export interface LeadContext {
  verb: HintVerb;
  subject: string;
}

// ── Story manifest (Phase 2b) ────────────────────────────────────────────────
// One object aggregating everything the engine layer consumes from a story.
// tsc is the schema; predicates are plain functions over a narrow SessionView.

/** Read-only slice of SessionSnapshot that manifest predicates may inspect. */
export interface SessionView {
  currentAct: number;
  location: string;
  flags: Record<string, boolean>;
  inventory: string[];
  discoveredClueIds: string[];
  turnCount: number;
}

/** How an NPC's real name is learned. Absent = 'self' (introduces on first TALK). */
export type NPCIntroduction =
  | { type: 'self' }
  | { type: 'document'; objectId: string };

/** Case-state demeanor for a companion NPC — first matching variant wins. */
export interface CompanionDemeanor {
  npcId: string;
  variants: Array<{ when: (s: SessionView) => boolean; text: string }>;
}

/** Directorial nudge injected when an act's failure-path condition holds. */
export interface ActSafetyNet {
  act: number;
  requiresNpcPresent: string;
  when: (s: SessionView) => boolean;
  instruction: string;
}

export interface DiaryLeadHelpers {
  isRequiredFlag(actNumber: number, flag: string): boolean;
  clueGateFlag(def: ClueDefinition): string;
  leadContextFor(actNumber: number, flag: string): LeadContext | null;
  detectSilentLeadFlags(params: {
    actNumber: number;
    flagsUpdate: Record<string, boolean>;
    priorFlags: Record<string, boolean>;
    discoveredClueIds: string[];
  }): string[];
}

export interface StoryManifest {
  id: string;

  // World data tables (same objects the story files already export)
  locations: Record<string, LocationDefinition>;
  npcs: Record<string, NPCDefinition>;
  npcAliases: Record<string, string>;
  npcDisplayNames: Record<string, string>;
  objectDisplayNames: Record<string, string>;
  clueDefinitions: Record<string, ClueDefinition>;
  clueTriggers: Record<string, Record<string, string[]>>;
  atmosphericNotes: Record<string, Record<string, string>>;
  takeableObjects: Record<string, string>;
  useInteractions: Record<string, Record<string, string>>;
  showInteractions: Record<string, Record<string, ShowInteraction>>;
  useCombinations: Record<string, Record<string, UseCombination>>;
  documentText: Record<string, string>;

  // Act structure
  actNames: Record<number, string>;
  actProgression: Record<number, ActCondition>;
  actAnchors: Record<number, string>;
  actTimeConfig: Record<number, ActTimeConfig>;
  actWeather: Record<number, ActWeather>;

  // Deduction
  deductionThreshold: number;
  suspectProfiles: SuspectProfile[];
  personsOfInterest: PersonOfInterest[];

  // Hint + diary-lead systems. selectHint/diaryLeads are consumed today;
  // hintObjectives is unused by the engine so far — scaffolding for future phases.
  selectHint: (s: HintState) => HintTarget;
  hintObjectives: HintObjective[];
  diaryLeads: DiaryLeadHelpers;

  // Fact graph (Phase 2a)
  facts: StoryFact[];

  // World events (Phase 4a)
  worldEvents: WorldEventDefinition[];

  // Rumor propagation (Phase 4b)
  rumors: RumorDefinition[];

  // NPC approaches
  approaches: ApproachDefinition[];

  // Story constants previously inlined in GameEngine. smokingGunClueId is
  // consumed by GameEngine today; convergenceFlag and playerNpcId are unused
  // so far — scaffolding for future phases (Phase 3 did not need them).
  smokingGunClueId: string;
  convergenceFlag: string;
  playerNpcId: string;

  // Declarative behavior hooks (replace NPC-id-keyed engine blocks)
  companionDemeanors: CompanionDemeanor[];
  actSafetyNets: ActSafetyNet[];
}
