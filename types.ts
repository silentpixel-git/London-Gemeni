
export interface GameHistoryItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
  type?: 'journal'; // marks act-closing journal entries in the narrative feed
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
  globalFlags: Record<string, any>;
  medicalPoints: number;
  moralPoints: number;
  journalNotes: string;
  stim?: Record<string, STIMEntry>;
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
  timestamp: string;
  // NPC introduction tracking — IDs of NPCs whose real names Watson now knows
  introducedNpcs: string[];
}

export interface WorldLocation {
  name: string;
  shortName?: string;
  act: number;
  atmosphere: string;
  description: string;
  exits: string[];
  interactables: string[];
  keyClues: string[];
  criticalPathLead: string;
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
export type IntentType = 'move' | 'examine' | 'talk' | 'take' | 'use' | 'inventory' | 'deduce' | 'help' | 'query' | 'notebook' | 'other';

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
  medicalPointsDelta?: number;
  moralPointsDelta?: number;
  discoveredClueIds?: string[];
  newAct?: number;
  gameOver?: boolean;

  // Context passed to AIService for narration (verified facts only)
  aiContext: NarrationContext;
}

/**
 * Verified, authoritative context passed to the AI for narration.
 * The AI must not contradict or extend this context.
 */
export interface NarrationContext {
  locationName: string;
  locationAtmosphere: string;
  locationDescription: string;
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
    role: string;
    speakingStyle: string;
    personality: string[];
    knowledgeEnvelope: string[]; // publicKnowledge — AI hard ceiling
    playerQuestion: string;      // intent.raw
  };
  // Proactive Holmes Nudge — populated by engine when player is stuck
  holmesNudge?: {
    locationKeyClues: string[];
    turnsStuck: number;
    // Set when all interactables at current location are already examined —
    // redirects Watson to another accessible location instead of repeating local hints
    crossLocationTarget?: {
      locationName: string;
      locationId: string;
    };
  };
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

/** Simplified AI response schema — narration only, no state mutations */
export interface NarrationResponse {
  markdownOutput: string;
  npcMemoryUpdate?: Record<string, string>; // Optional: short summaries keyed by npcId
  stimUpdate?: Record<string, STIMEntry>;   // New sensory observations to store in STIM
}
