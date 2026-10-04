/**
 * components/sceneView.ts
 *
 * What Watson can see right now, derived from engine data: who is present,
 * which objects catch the eye, and which avenues are open. Shared by the case
 * rail (Sidebar) and the suggestion chips (CommandInput) so the two can never
 * disagree about what is in the scene.
 */

import { LOCATIONS, NPCS, NPC_ALIASES, OBJECT_DISPLAY_NAMES, OBJECT_VISIBILITY, CONTAINER_CONTENTS } from '../engine/gameData';
import { INITIAL_NPC_STATES, NPC_DISPLAY_NAMES } from '../constants';
import type { NPCState } from '../types';

export interface SceneNpc { npcId: string; displayName: string }
export interface SceneObject { id: string; name: string; closed: boolean; children: string[] }
export interface SceneExit { id: string; name: string }
export interface SceneView { npcs: SceneNpc[]; objects: SceneObject[]; exits: SceneExit[] }

export interface SceneInput {
  location: string;
  currentAct: number;
  npcStates: Record<string, NPCState>;
  introducedNpcs: string[];
  flags: Record<string, boolean>;
}

export function deriveScene({ location, currentAct, npcStates, introducedNpcs, flags }: SceneInput): SceneView {
  const npcs = Object.values(npcStates)
    .filter(s => {
      const npc = NPCS[s.npcId];
      // Mirrors npcLocationAt's gate check in engine/presence.ts — keep in sync.
      if (npc?.presenceRequiresFlag && flags[npc.presenceRequiresFlag] !== true) return false;
      if (npc?.presenceForbidFlag && flags[npc.presenceForbidFlag] === true) return false;
      const npcLoc = s.currentLocation || (INITIAL_NPC_STATES[s.npcId]?.currentLocation);
      return npcLoc === location && s.status !== 'deceased';
    })
    .map(s => {
      // Mirror the engine's label resolution (GameEngine.ts): show the real name
      // only once Watson has been introduced; otherwise the alias.
      const npc = NPCS[s.npcId];
      const isIntroduced = !npc?.requiresIntroduction || introducedNpcs.includes(s.npcId);
      const displayName = isIntroduced
        ? (NPC_DISPLAY_NAMES[s.npcId as keyof typeof NPC_DISPLAY_NAMES] || npc?.displayName || s.npcId)
        : (npc?.alias ?? NPC_ALIASES[s.npcId] ?? NPC_DISPLAY_NAMES[s.npcId as keyof typeof NPC_DISPLAY_NAMES] ?? s.npcId);
      return { npcId: s.npcId, displayName };
    });

  const exits = (LOCATIONS[location]?.exits || [])
    .filter(exitId => {
      const exitData = LOCATIONS[exitId];
      return exitData && exitData.act <= currentAct;
    })
    .map(id => ({ id, name: LOCATIONS[id]?.shortName || id }));

  // Objects of interest — the same visibility rule the engine uses, so the rail
  // can never list something the parser will not resolve. Containers render
  // their revealed contents as children.
  const visibleIds = (LOCATIONS[location]?.interactables || [])
    .filter(id => {
      // Mirrors visibleInteractables' gate check in engine/visibility.ts — keep in sync.
      const gate = OBJECT_VISIBILITY[id];
      return !gate || flags[gate] === true;
    });
  const containedIds = new Set(
    Object.entries(CONTAINER_CONTENTS)
      .filter(([containerId]) => visibleIds.includes(containerId))
      .flatMap(([, contents]) => contents)
  );
  const objects = visibleIds
    .filter(id => !containedIds.has(id))
    .map(id => ({
      id,
      name: OBJECT_DISPLAY_NAMES[id] || id,
      // A container with no revealed contents is annotated as closed; one with
      // children needs no marker, since the indentation already says it is open.
      closed: !!CONTAINER_CONTENTS[id] && !visibleIds.some(c => CONTAINER_CONTENTS[id].includes(c)),
      children: (CONTAINER_CONTENTS[id] || [])
        .filter(c => visibleIds.includes(c))
        .map(c => OBJECT_DISPLAY_NAMES[c] || c),
    }));

  return { npcs, objects, exits };
}

export interface SceneChip { label: string; command: string; kind: 'object' | 'npc' | 'exit' }

const MAX_OBJECT_CHIPS = 2;
const MAX_NPC_CHIPS = 1;
const MAX_EXIT_CHIPS = 2;

/**
 * Suggestion chips drawn only from what the case rail already lists, so a chip
 * can never point at something the player has not been shown. Each command is a
 * plain sentence the parser resolves exactly as if it had been typed
 * (scripts/qa-chips.ts enforces that for every location).
 */
export function buildChips(scene: SceneView): SceneChip[] {
  return [
    ...scene.objects.slice(0, MAX_OBJECT_CHIPS).map(o => ({ kind: 'object' as const, label: o.name, command: `Examine ${o.name}` })),
    ...scene.npcs.slice(0, MAX_NPC_CHIPS).map(n => ({ kind: 'npc' as const, label: n.displayName, command: `Talk to ${n.displayName}` })),
    ...scene.exits.slice(0, MAX_EXIT_CHIPS).map(e => ({ kind: 'exit' as const, label: e.name, command: `Go to ${e.name}` })),
  ];
}
