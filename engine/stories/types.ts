// Shared type definitions for all story manifests.
// Each story's data files import from here.

export interface LocationDefinition {
  id: string;
  name: string;
  shortName: string;
  act: number;                     // Minimum act required to access this location
  atmosphere: string;
  description: string;
  exits: string[];                 // Location IDs. Engine validates these.
  interactables: string[];         // Object IDs present here
  keyClues: string[];              // Hint text for critical path
  criticalPathLead: string;
  locationExaminedFlag: string;    // Flag set when player examines anything here
  // Temporal framing — drives AI narration register
  timeframe: 'present' | 'reconstruction';
  // Used by AI when timeframe === 'reconstruction'. Explains to the AI exactly
  // how Watson is visiting this past crime scene (from reports, from memory, etc.)
  reconstitutionNote?: string;
}

export interface NPCDefinition {
  id: string;
  displayName: string;
  role: string;
  description: string;
  speakingStyle: string;
  personality: string[];
  publicKnowledge: string[];  // Facts/topics this NPC knows and can discuss
  followingRule: 'follows_watson' | 'follows_bond' | 'location_based' | 'fixed';
  followsNpcId?: string;       // For follows_watson/'follows_bond': the entity ID to shadow ('watson' = player)
  canonicalLocationByAct: Record<number, string>;  // Act number → location ID
  // NPC introduction system — hides identity until Watson learns their name
  alias?: string;                  // e.g. "Bond's assistant", "a police inspector"
  aliasDescription?: string;       // Brief sensory description shown before introduction
  requiresIntroduction?: boolean;  // If true, shown as alias until introduced via flag
  // Scripted presence moments — directorial instructions injected into AI context
  // when this NPC is present at the specified location (and optional flag is satisfied).
  // The AI works them in naturally; they are spirit-of-the-moment guidance, not fixed lines.
  scriptedLines?: Array<{
    locationId: string;    // Only fire at this location
    triggerFlag?: string;  // Optional: only fire if session.flags[triggerFlag] is true
    instruction: string;   // Directorial instruction for the AI
  }>;
}

export interface ClueDefinition {
  id: string;
  name: string;
  description: string;           // What Watson records
  holmesDeduction: string;       // What Holmes concludes
  locationFound: string;         // Location ID where this clue is found
  triggerObject: string;         // Object ID that triggers this clue
  connections: string[];         // Related clue IDs
  clueGroup: number;             // Numeric group from story design
  medicalPoints: number;         // Points awarded (medical path)
  moralPoints: number;           // Points awarded (moral path)
}

export interface ActCondition {
  name: string;
  requireFlags: string[];        // All must be set to auto-advance
  advanceTo: number;
}

export interface SuspectProfile {
  npcId: string;
  aliases: string[];           // lowercase name variants the player might type
  isGuilty: boolean;
  successFlags: Record<string, boolean>;
  successAct: number;
  successVisitFlag: string;    // if this flag is already set, the game ends on correct deduction
}
