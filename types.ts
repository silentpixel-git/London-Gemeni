
export interface GameHistoryItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
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
  sanity: number;
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
  sanity: number;
  medicalPoints: number;
  moralPoints: number;
  npcStates?: Record<string, NPCState>;
  flags: Record<string, boolean>;
  journalNotes: string;
  timestamp: string;
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
export type IntentType = 'move' | 'examine' | 'talk' | 'take' | 'use' | 'inventory' | 'deduce' | 'help' | 'other';

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
  sanityDelta?: number;
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
  act: number;
  actName: string;
  npcsPresent: string[];          // Display names of NPCs in this location
  npcIds: string[];               // Raw NPC IDs — used by AIService to look up profiles
  availableObjects: string[];     // Display names of interactable objects
  availableExits: string[];       // Display names of accessible exits
  inventory: string[];
  watsonStats: {
    sanity: number;
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
  // Recent NPC memory for present NPCs (max 2 entries each)
  npcRecentMemory?: Record<string, string[]>;
  // Session observations (STIM) — injected by useGameState before AI call
  stim?: Record<string, STIMEntry>;
  // Controls how much the AI writes:
  //   'full'    — move or look: Act header + location prose + atmosphere + exits/objects/NPCs
  //   'compact' — examine/talk/take/etc: short observation + NPC response, no header or location listing
  narrationMode: 'full' | 'compact';
}

/** Simplified AI response schema — narration only, no state mutations */
export interface NarrationResponse {
  markdownOutput: string;
  npcMemoryUpdate?: Record<string, string>; // Optional: short summaries keyed by npcId
  stimUpdate?: Record<string, STIMEntry>;   // New sensory observations to store in STIM
}
