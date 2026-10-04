/**
 * components/sceneView.ts
 *
 * What Watson can see right now, derived from engine data: who is present,
 * which objects catch the eye, and which avenues are open. Shared by the case
 * rail (Sidebar) and the suggestion chips (CommandInput) so the two can never
 * disagree about what is in the scene.
 */

import { LOCATIONS, NPCS, NPC_ALIASES, OBJECT_DISPLAY_NAMES, OBJECT_VISIBILITY, CONTAINER_CONTENTS, TAKEABLE_OBJECTS, DOCUMENT_TEXT } from '../engine/gameData';
import { INITIAL_NPC_STATES, NPC_DISPLAY_NAMES } from '../constants';
import type { NPCState } from '../types';

/**
 * A verb offered on a rail row. `run` submits `command` as if typed; `fill`
 * drops `command` into the input, unfinished, for the player to complete —
 * used by every verb that needs a second noun or a topic.
 */
export interface RailAction { key: string; label: string; command: string; mode: 'run' | 'fill'; primary?: boolean }
export interface SceneItem { id: string; name: string; actions: RailAction[] }
export interface SceneNpc { npcId: string; displayName: string; actions: RailAction[] }
export interface SceneObject extends SceneItem { closed: boolean; children: SceneItem[] }
export interface SceneExit { id: string; name: string }
export interface SceneView { npcs: SceneNpc[]; objects: SceneObject[]; exits: SceneExit[] }

// Verbs depend only on what a thing IS (person, document, container, carried
// item) — never on whether it matters to a puzzle, so the menu cannot hint.
const hasDocumentText = (id: string): boolean =>
  DOCUMENT_TEXT[id] !== undefined || Object.keys(DOCUMENT_TEXT).some(k => k.startsWith(`${id}@`));

const npcActions = (name: string): RailAction[] => [
  { key: 'talk', label: 'Talk', command: `Talk to ${name}`, mode: 'run', primary: true },
  { key: 'ask', label: 'Ask about…', command: `Ask ${name} about `, mode: 'fill' },
  { key: 'show', label: 'Show…', command: `Show ${name} the `, mode: 'fill' },
];

const objectActions = (id: string, name: string, closed: boolean): RailAction[] => [
  { key: 'examine', label: 'Examine', command: `Examine ${name}`, mode: 'run', primary: true },
  ...(hasDocumentText(id) ? [{ key: 'read', label: 'Read', command: `Read ${name}`, mode: 'run' as const }] : []),
  ...(closed ? [{ key: 'open', label: 'Open', command: `Open ${name}`, mode: 'run' as const }] : []),
  { key: 'use', label: 'Use…', command: `Use ${name} with `, mode: 'fill' },
];

const carriedActions = (id: string, name: string): RailAction[] => [
  { key: 'examine', label: 'Examine', command: `Examine ${name}`, mode: 'run', primary: true },
  ...(hasDocumentText(id) ? [{ key: 'read', label: 'Read', command: `Read ${name}`, mode: 'run' as const }] : []),
  { key: 'use', label: 'Use with…', command: `Use ${name} with `, mode: 'fill' },
  { key: 'showto', label: 'Show to…', command: `Show ${name} to `, mode: 'fill' },
];

/**
 * Bag entries are inventory display names ("From Hell Letter (transcript)");
 * the parser speaks object names, so map back through TAKEABLE_OBJECTS and fall
 * back to the entry itself when it is not a takeable object.
 */
export function deriveInventory(items: string[]): SceneItem[] {
  const idByName = Object.fromEntries(Object.entries(TAKEABLE_OBJECTS).map(([id, n]) => [n, id]));
  const idByDisplay = Object.fromEntries(Object.entries(OBJECT_DISPLAY_NAMES).map(([id, n]) => [n, id]));
  return items.map(item => {
    const id = idByName[item] ?? idByDisplay[item];
    // Not an object (the pocket watch is a clock, not a thing to examine): a
    // plain row, because a verb the engine cannot resolve is a button that lies.
    if (!id || !OBJECT_DISPLAY_NAMES[id]) return { id: item, name: item, actions: [] };
    return { id: item, name: item, actions: carriedActions(id, OBJECT_DISPLAY_NAMES[id]) };
  });
}

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
      // An NPC still shown by alias ("a police surgeon") cannot be addressed by
      // that alias, and the real name must not leak early — so no verbs yet.
      return { npcId: s.npcId, displayName, actions: isIntroduced ? npcActions(displayName) : [] };
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
    .map(id => {
      const name = OBJECT_DISPLAY_NAMES[id] || id;
      // A container with no revealed contents is annotated as closed; one with
      // children needs no marker, since the indentation already says it is open.
      const closed = !!CONTAINER_CONTENTS[id] && !visibleIds.some(c => CONTAINER_CONTENTS[id].includes(c));
      const children = (CONTAINER_CONTENTS[id] || [])
        .filter(c => visibleIds.includes(c))
        .map(c => {
          const childName = OBJECT_DISPLAY_NAMES[c] || c;
          return { id: c, name: childName, actions: objectActions(c, childName, false) };
        });
      return { id, name, closed, children, actions: objectActions(id, name, closed) };
    });

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
