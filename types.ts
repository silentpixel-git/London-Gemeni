
export type TimePeriod = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'lateNight';

// Phase 4b — session rumor-event log: when each rumor's trigger flag first
// fired. atMinutes is the act's canonical start + elapsed minutes (may exceed
// 1440 on next-day clocks). Old saves lack this — default {} at every reader.
export type RumorEvents = Record<string, { act: number; atMinutes: number }>;

// Player's appearance choice. 'auto' hands the palette to the in-game clock
// (evening/night), replacing the old separate dark-mode + time-of-day toggles —
// so a manual dark choice can never be silently overridden by atmospheric colours.
export type ThemeMode = 'light' | 'dark' | 'auto';

export interface GameHistoryItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
  type?: 'journal'; // marks act-closing diary entries in the narrative feed
}

export interface PendingActTransition {
  fromAct: number;
  toAct: number;
  newLocation: string;
  npcUpdates: Record<string, Partial<NPCState>>;
}

export interface DispositionStats {
  trust: number;
  annoyance: number;
}

export interface GameDispositions {
  holmes: DispositionStats;
  abberline: DispositionStats;
  bond: DispositionStats;
  edmund: DispositionStats;
  lusk: DispositionStats;
}

// --- Granular World Entities ---

export type InvestigationStatus = 'active' | 'cold_case' | 'solved' | 'archived';

export interface STIMEntry {
  summary: string;       // 10-15 word sensory description established this session
  turnCreated: number;
  scope: 'npc' | 'object' | 'environment';
}

export interface Investigation {
  id: string;
  ownerId: string;
  status: InvestigationStatus;
  currentLocation: string;
  globalFlags: Record<string, boolean>;
  medicalPoints: number;
  moralPoints: number;
  journalNotes: string;
  stim?: Record<string, STIMEntry>;
  saveSlot?: number;
  elapsedMinutes?: number;
  // Where Watson hailed the current cab from — undefined when not aboard a
  // cab. See engine/session.ts SessionSnapshot.cabBoardedFrom.
  cabBoardedFrom?: string;
  rumorEvents?: RumorEvents; // Phase 4b — rumor-event log (see RumorEvents)
  createdAt: string;
  updatedAt: string;
}

export interface LocationState {
  locationId: string;
  isCrimeScene?: boolean;
  isLocked?: boolean;
  mutations?: Record<string, any>;
  updatedAt: string;
}

export interface NPCState {
  npcId: string;
  disposition: number; // 0-100
  currentLocation?: string;
  status: string; // 'alive', 'deceased', 'missing', 'hostile'
  lastInteraction?: string;
  memory?: string[]; // Short-term memory of last 3-5 interactions
}

export interface Clue {
  clueId: string;
  name: string;
  description: string;
  discoveredAt: string;
  locationFound?: string;
  connections?: string[];
}

export type LogEntryType = 'narration' | 'action' | 'dialogue' | 'system';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: LogEntryType;
  content: string;
  speaker?: string;
}

// --- Legacy / UI State ---

export interface GameState {
  history: GameHistoryItem[];
  location: string;
  inventory: string[];
  medicalPoints: number;
  moralPoints: number;
  npcStates?: Record<string, NPCState>;
  flags: Record<string, boolean>;
  journalNotes: string;
  diaryEntries?: DiaryEntry[];
  timestamp: string;
  // NPC introduction tracking — IDs of NPCs whose real names Watson now knows
  introducedNpcs: string[];
  // Current act. Optional for back-compat with older local saves (which derived
  // the act from the location — ambiguous for shared anchors like bond_office).
  currentAct?: number;
  // Phase 4b — rumor-event log. Optional for back-compat with older saves.
  rumorEvents?: RumorEvents;
}

export interface WorldLocation {
  name: string;
  shortName?: string;
  act: number;
  atmosphere: string;
  description: string;
  exits: string[];
  interactables: string[];
}

export interface GameResponse {
  thoughtProcess?: string;
  markdownOutput: string;
  newLocationId?: string;
  inventoryUpdate?: {
    add?: string[];
    remove?: string[];
  };
  dispositionUpdate?: {
    [key in keyof GameDispositions]?: Partial<DispositionStats>;
  };
  flagsUpdate?: Record<string, boolean>;
  // Phase 4b — rumor-event log entries recorded this turn (merge into the
  // session log; a rumor records at most once per playthrough).
  rumorEventsUpdate?: RumorEvents;
  sanityUpdate?: number;
  medicalPointsUpdate?: number;
  moralPointsUpdate?: number;
  locationMutations?: {
    [locationId: string]: Partial<LocationState>;
  };
  npcMutations?: {
    [npcId: string]: Partial<NPCState>;
  };
  npcMemoryUpdate?: {
    [npcId: string]: string; // A 10-word summary of the interaction
  };
  discoveredClues?: Clue[];
  gameOver?: boolean;
}

// ============================================================
// ENGINE TYPES — added for database-first architecture
// ============================================================

/** The type of action the player is attempting */
export type IntentType = 'move' | 'examine' | 'talk' | 'take' | 'use' | 'show' | 'read' | 'drop' | 'inventory' | 'deduce' | 'wait' | 'help' | 'query' | 'notebook' | 'other' | 'unresolved_target';

// Phase 3 — candidate lists for the constrained tool-calling parse fallback.
// Built client-side (spoiler-safe: unintroduced NPCs are alias-masked) and
// enforced server-side: parseAction may only return ids from these lists.
export interface ParseCandidateEntry { id: string; name: string }
export interface ParseCandidates {
  objects: ParseCandidateEntry[];    // present interactables + carried copies (object ids)
  carried: ParseCandidateEntry[];    // subset of objects the player carries (show/drop enums)
  people: ParseCandidateEntry[];     // NPCs present this act, alias-masked if unintroduced
  locations: ParseCandidateEntry[];  // all locations (names are public)
}

/**
 * The result of the GameEngine resolving a player action.
 * All state changes are decided here BEFORE the AI is consulted.
 * The AI only narrates what the engine has already determined.
 */
export interface EngineResult {
  // Was the action valid and successful?
  actionSuccess: boolean;
  actionType: IntentType;

  // If blocked, why?
  blockedReason?: string;

  // Deterministic state changes (applied to DB before AI call)
  newLocation?: string;
  inventoryAdd?: string[];
  inventoryRemove?: string[];
  npcUpdates?: Record<string, Partial<NPCState>>;
  flagsUpdate?: Record<string, boolean>;
  // Phase 4b — rumor-event log entries recorded this turn (merge into the
  // session log; a rumor records at most once per playthrough).
  rumorEventsUpdate?: RumorEvents;
  medicalPointsDelta?: number;
  moralPointsDelta?: number;
  discoveredClueIds?: string[];
  // Minutes this action consumed when it isn't the fixed per-verb cost —
  // set by WAIT (time to the next period boundary). The hook prefers this
  // over its ACTION_TIME_MINUTES table.
  minutesAdvanced?: number;
  // Hansom-cab boarding point: a string when Watson boards (the location he
  // hailed from), null when he alights, undefined = unchanged.
  cabBoardedFromUpdate?: string | null;
  newAct?: number;
  gameOver?: boolean;
  // Which ending fired (set by the engine whenever gameOver is true):
  //   'cold_case'   — wrong deduction; the case closes unsolved
  //   'true_ending' — correct path completed; the scripted coda follows
  endingType?: 'cold_case' | 'true_ending';

  // NPC alias-system flags (npc_introduced_*) for the hook to apply.
  introductionFlagsUpdate?: Record<string, boolean>;

  // Context passed to AIService for narration (verified facts only)
  aiContext: NarrationContext;
}

export type HintVerb = 'examine' | 'talk' | 'show' | 'use' | 'deduce' | 'reflect' | 'travel';

/** The chosen next-step target the engine hands to the AI to phrase in Watson's voice. */
export interface HintTarget {
  verb: HintVerb;
  /** Neutral, player-facing noun phrase. Never contains clue findings/spoilers.
   *  Empty for 'travel' (location not yet visited) and 'reflect' targets. */
  subject: string;
  /** Display name of the location the step happens at ('' for the reflect fallback). */
  locationName: string;
  /** True when that location is where Watson currently stands. */
  isCurrentLocation: boolean;
  /** True when Watson has been to the target location (currently there or previously
   *  visited). When false the hint may only direct him toward the location — never name
   *  what is inside it, since Watson cannot yet know its contents. */
  locationKnown: boolean;
}

/**
 * Verified, authoritative context passed to the AI for narration.
 * The AI must not contradict or extend this context.
 */
export interface NarrationContext {
  locationName: string;
  locationAtmosphere: string;
  locationDescription: string;
  // How many times Watson has visited this location (1 = first visit)
  locationVisitCount: number;
  // Temporal framing — drives Watson's emotional register in narration
  // 'present'        — Watson is here now (November 1888, live investigation)
  // 'reconstruction' — Watson is revisiting a past crime scene weeks/months later
  locationTimeframe: 'present' | 'reconstruction';
  // Only set when timeframe === 'reconstruction'. Explains how Watson is visiting.
  locationReconstitutionNote?: string;
  act: number;
  actName: string;
  // Each NPC entry carries its display label (alias if not yet introduced, real name if introduced)
  // plus a flag so the AI knows whether to use the real name in prose.
  npcsPresent: Array<{
    label: string;        // What the AI should call this NPC (alias OR displayName)
    npcId: string;
    isIntroduced: boolean;
  }>;
  availableObjects: string[];     // Display names of interactable objects
  availableExits: string[];       // Display names of accessible exits
  inventory: string[];
  watsonStats: {
    medicalPoints: number;
    moralPoints: number;
  };
  // What just happened (for AI to narrate)
  actionType: IntentType;
  actionSuccess: boolean;
  actionDescription: string;       // e.g. "Watson examined the burned clothing"
  actionResultNote: string;        // e.g. "SUCCESS — found evidence of killer's confidence" or "BLOCKED — ..."
  newCluesDiscovered: Array<{      // Newly triggered clues for this action
    name: string;
    description: string;
    holmesDeduction: string;
  }>;
  // Atmospheric fallback note for the examined object (if no clue triggered)
  atmosphericNote?: string;
  // Items Watson gained this turn (verified) — the AI must narrate the acquisition
  itemsGained?: string[];
  // First sentences of the last few narrations — anti-repetition memory
  recentOpenings?: string[];
  // One-line clock event when the turn crosses an hour boundary (hook-computed)
  clockEvent?: string;
  // Prose-only background figure for this location (engine-rotated, non-interactive)
  ambientExtra?: string;
  // One-shot authored vignette — replaces the random blockquote seed this turn
  vignette?: string;
  // World-event broadcasts fired this turn (verified, authored) — each rendered
  // as its own blockquote wherever Watson stands
  worldEvents?: string[];
  // Recent NPC memory for present NPCs (max 2 entries each)
  npcRecentMemory?: Record<string, string[]>;
  // Session observations (STIM) — injected by useGameState before AI call
  stim?: Record<string, STIMEntry>;
  // Cross-clue Holmes synthesis — injected by useGameState after consultHolmesMultiClue()
  holmesSynthesis?: string;
  // Dynamic Witness Interrogation — populated by engine when action type is 'talk'
  targetNpcInterview?: {
    npcId: string;
    label: string;        // Alias or displayName depending on introduction state
    isIntroduced: boolean;
    introducingThisTurn?: boolean; // true on the single turn the NPC first gives their name
    realName?: string;             // the name to reveal in-fiction (set only when introducingThisTurn)
    role: string;
    speakingStyle: string;
    personality: string[];
    knowledgeEnvelope: string[]; // derived from the story fact graph — AI hard ceiling
    // Phase 4b — hearsay that reached this NPC since Watson last spoke to
    // them (one-shot: acked via rumor_ack_* flags). The AI has them raise it
    // unprompted, in character.
    recentlyHeard?: string[];
    playerQuestion: string;      // intent.raw
  };
  // Proactive hint woven into the turn when the player is stuck — chosen by the
  // engine's selectHint, phrased by the AI in Watson's voice.
  watsonHint?: HintTarget;
  // Scripted NPC presence moments — directorial instructions for the AI.
  // Populated by engine when a present NPC has a scriptedLine that matches
  // the current location (and optional trigger flag).
  npcScriptedLines?: Array<{
    npcId: string;
    label: string;       // Alias or displayName depending on introduction state
    instruction: string; // What the AI should naturally work into the narration
  }>;
  // Controls how much the AI writes:
  //   'full'    — move or look: Act header + location prose + atmosphere + exits/objects/NPCs
  //   'compact' — examine/talk/take/etc: short observation + NPC response, no header or location listing
  //   'opening' — game start only: 2 tight paragraphs, max 130 words, hook only
  narrationMode: 'full' | 'compact' | 'opening';
  // Current in-game time — anchored to canonical act start, advances per action type
  timeLabel: string;      // e.g. "10:45 AM — Friday, 9 November 1888"
  timePeriod: TimePeriod; // e.g. 'morning'
  // Canonical weather for the current act. Watson's prose must be consistent
  // with this; the condition also gates fog-specific atmospheric seeds.
  weather: { condition: string; label: string };
  // Tells the AI what kind of blockquote to use this turn (or none):
  //   'world_event'   — sensory micro-event from the world (always in full mode)
  //   'inner_thought' — Watson's fleeting thought/memory triggered by the action (compact ~50%)
  //   'none'          — omit blockquote this turn (compact ~50%)
  blockquoteHint: 'world_event' | 'inner_thought' | 'none';
}

/** Summary passed to AIService.generateJournalEntry() when an act closes */
export interface ActJournalSummary {
  actNumber: number;
  actName: string;
  cluesFound: Array<{ name: string; description: string }>;
}

/**
 * Watson's auto-captured casebook. An append-only record of important events the
 * engine already tracks (clue discoveries, act milestones, major decisions). For
 * hand-authored 'clue'/'decision' entries we store only a refId — the displayed
 * Watson line is looked up from authored story data at render time. 'act' entries,
 * and AI-generated 'decision' entries with no hand-authored match, carry their
 * prose verbatim in `text` so they stay re-readable in the diary.
 */
export type DiaryEntryKind = 'clue' | 'act' | 'decision' | 'revelation' | 'location';

export interface DiaryEntry {
  id: string;            // uuid — also the dedupe key for persistence
  kind: DiaryEntryKind;
  refId: string;         // clueId, decision id (or flag, for AI-generated leads), beat id, or actNumber-as-string
  actNumber: number;     // which act this was captured in (drives grouping)
  sequence: number;      // monotonic order within the game
  text?: string;         // 'act' entries; AI-generated 'decision' entries store "title\nbody" here
  timeLabel?: string;    // in-game clock when logged (e.g. "10:41 PM"); absent on pre-006 entries
  isLead?: boolean;      // true when this entry corresponds to an ACT_PROGRESSION gate flag
}

/** Simplified AI response schema — narration only, no state mutations */
export interface NarrationResponse {
  markdownOutput: string;
  npcMemoryUpdate?: Record<string, string>; // Optional: short summaries keyed by npcId
  stimUpdate?: Record<string, STIMEntry>;   // New sensory observations to store in STIM
}
