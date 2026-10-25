/**
 * hooks/gameState/sceneView.ts
 *
 * What Watson can see right now — the people present, the objects of
 * interest (containers with their revealed contents), the exits open in this
 * act — plus the command each one stands for. The sidebar renders it (a click
 * puts the command in the input) and suggestionsFor() picks the "Try" chips
 * from it, so both always agree with each other and with the engine's own
 * visibility rules.
 */

import { LOCATIONS, NPCS, NPC_ALIASES, OBJECT_DISPLAY_NAMES, OBJECT_VISIBILITY, CONTAINER_CONTENTS } from '../../engine/gameData';
import { INITIAL_NPC_STATES, NPC_DISPLAY_NAMES } from '../../constants';
import type { NPCState } from '../../types';

export interface SceneItem {
  id: string;
  label: string;
  /** The command a click on this item puts in the input. */
  command: string;
}

export interface SceneObject extends SceneItem {
  /** A container with nothing revealed inside it yet. */
  closed: boolean;
  children: SceneItem[];
}

export interface SceneView {
  people: SceneItem[];
  objects: SceneObject[];
  exits: SceneItem[];
  bag: SceneItem[];
}

export interface SceneInput {
  location: string;
  currentAct: number;
  inventory: string[];
  npcStates: Record<string, NPCState>;
  introducedNpcs: string[];
  flags: Record<string, boolean>;
}

/** "The Open Window" → "the open window", "Pocket Watch" → "the pocket watch", "Watson's Diary" → "watson's diary". */
const objectPhrase = (name: string) => {
  const n = name.toLowerCase();
  return /^the\s/.test(n) || /^\S+'s\s/.test(n) ? n : `the ${n}`;
};

export function sceneView({ location, currentAct, inventory, npcStates, introducedNpcs, flags }: SceneInput): SceneView {
  const people = Object.values(npcStates)
    .filter(s => {
      const npc = NPCS[s.npcId];
      // Mirrors npcLocationAt's gate check in engine/presence.ts — keep in sync.
      if (npc?.presenceRequiresFlag && flags[npc.presenceRequiresFlag] !== true) return false;
      if (npc?.presenceForbidFlag && flags[npc.presenceForbidFlag] === true) return false;
      const npcLoc = s.currentLocation || (INITIAL_NPC_STATES[s.npcId]?.currentLocation);
      return npcLoc === location && s.status !== 'deceased';
    })
    .map(s => {
      // Mirror the engine's label resolution: the real name only once Watson
      // has been introduced; otherwise the alias.
      const npc = NPCS[s.npcId];
      const introduced = !npc?.requiresIntroduction || introducedNpcs.includes(s.npcId);
      const display = NPC_DISPLAY_NAMES[s.npcId as keyof typeof NPC_DISPLAY_NAMES] || npc?.displayName || s.npcId;
      const label = introduced ? display : (npc?.alias ?? NPC_ALIASES[s.npcId] ?? display);
      return { id: s.npcId, label, command: `talk to ${label.toLowerCase()}` };
    });

  const exits = (LOCATIONS[location]?.exits || [])
    .filter(id => LOCATIONS[id] && LOCATIONS[id].act <= currentAct)
    .map(id => {
      const label = LOCATIONS[id]?.shortName || id;
      return { id, label, command: `go to ${label.toLowerCase()}` };
    });

  // Objects of interest — the same visibility rule the engine uses, so nothing
  // listed here is something the parser will not resolve.
  const visibleIds = (LOCATIONS[location]?.interactables || []).filter(id => {
    // Mirrors visibleInteractables' gate check in engine/visibility.ts — keep in sync.
    const gate = OBJECT_VISIBILITY[id];
    return !gate || flags[gate] === true;
  });
  const contained = new Set(
    Object.entries(CONTAINER_CONTENTS)
      .filter(([containerId]) => visibleIds.includes(containerId))
      .flatMap(([, contents]) => contents),
  );
  const item = (id: string): SceneItem => {
    const label = OBJECT_DISPLAY_NAMES[id] || id;
    return { id, label, command: `examine ${objectPhrase(label)}` };
  };
  const objects = visibleIds
    .filter(id => !contained.has(id))
    .map(id => {
      const children = (CONTAINER_CONTENTS[id] || []).filter(c => visibleIds.includes(c)).map(item);
      return { ...item(id), closed: !!CONTAINER_CONTENTS[id] && children.length === 0, children };
    });

  const bag = inventory.map(name => ({ id: name, label: name, command: `examine ${objectPhrase(name)}` }));

  return { people, objects, exits, bag };
}

/**
 * The "Try" chips: up to four things here that Watson has not tried yet — an
 * object not yet examined, someone not yet spoken to here, a place not yet
 * visited. Never chosen from the act's progression or the hint system, so a
 * chip never says which of them matters.
 */
export function suggestionsFor(
  view: SceneView,
  location: string,
  flags: Record<string, boolean>,
  locationVisitCounts: Record<string, number>,
): string[] {
  const objects = view.objects
    .flatMap(o => [o, ...o.children])
    .filter(o => !flags[`examined_${location}_${o.id}`]);
  const people = view.people.filter(p => !flags[`talked_to_${p.id}_at_${location}`]);
  const exits = view.exits.filter(e => !locationVisitCounts[e.id]);
  return [...objects, ...people, ...exits].slice(0, 4).map(i => i.command);
}
