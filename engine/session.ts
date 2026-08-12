/**
 * engine/session.ts
 *
 * The SessionSnapshot the UI hands the engine each turn — the engine's
 * complete, read-only view of current game state. Extracted from
 * GameEngine.ts (backlog #8 god-file split) so resolver modules can import
 * it without a cycle through the GameEngine façade.
 */

import { NPCState, RumorEvents } from '../types';

// ============================================================
// Current session state snapshot passed to the engine
// ============================================================

export interface SessionSnapshot {
  location: string;
  inventory: string[];
  flags: Record<string, boolean>;
  npcStates: Record<string, NPCState>;
  currentAct: number;
  medicalPoints: number;
  moralPoints: number;
  discoveredClueIds: string[];
  investigationId?: string;
  turnsAtLocationWithoutProgress: number; // for proactive Holmes nudge
  elapsedMinutes: number;                 // minutes elapsed since act's canonical start
  // NPC IDs whose real names Watson now knows (alias system)
  introducedNpcs: string[];
  // How many times Watson has visited each location (keyed by locationId)
  locationVisitCounts: Record<string, number>;
  // Total turns this session — used to rotate idle behaviors / ambient extras
  turnCount: number;
  // Phase 4b — when each rumor's trigger flag first fired (see RumorEvents)
  rumorEvents: RumorEvents;
  // In-game clock value (act canonical start + elapsed) of the last NPC
  // approach — drives the 30-minute cooldown. Optional: absent on old saves.
  lastApproachAtMinutes?: number;
  // Who was present at the end of the previous turn, so this turn can report
  // who has since arrived or gone. Undefined means "no prior turn to compare
  // against" (opening scene, resumed save) — which correctly reports nothing
  // rather than announcing the whole room as having just arrived.
  previousNpcIds?: string[];
  // Note: sanity has been removed. Watson's prose register is now fixed
  // at the professional-composure baseline defined in the AI system prompt.
}
