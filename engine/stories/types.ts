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
