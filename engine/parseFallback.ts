/**
 * engine/parseFallback.ts
 *
 * Phase 3 client-side helpers for the tool-calling parse fallback.
 * Pure functions — no fetch, no AI client. Decides WHEN the AI parse fires
 * (needsAiParse) and WHAT it may choose from (buildParseCandidates).
 * The gateway op itself lives in server/parseAction.ts + server/aiCore.ts.
 */

import type { ParsedIntent } from './intentParser';
import type { ParseCandidates, NPCState } from '../types';
import { LOCATIONS, NPCS, OBJECT_DISPLAY_NAMES, TAKEABLE_OBJECTS } from './gameData';
import { getPresentNpcIds, timePeriodFor } from './GameEngine';
import { WHITECHAPEL_MANIFEST } from './stories/whitechapel-1888/manifest';
import { visibleInteractables } from './visibility';

// Verb intents that carry a target phrase; a non-empty phrase with no resolved
// id is a miss the AI parse can recover.
const VERBS_NEEDING_TARGET = new Set<ParsedIntent['type']>([
  'move', 'talk', 'take', 'examine', 'use', 'show', 'read', 'drop',
]);

/**
 * Should this regex-parse result be routed through the AI parse?
 * Misses are: 'other', 'unresolved_target', verb-with-unresolved-target,
 * and the soft miss (resolved examine target that is neither here nor
 * carried).
 * Queries never route — world questions belong to narration.
 */
export function needsAiParse(intent: ParsedIntent, location: string, inventory: string[], flags: Record<string, boolean>): boolean {
  if (intent.type === 'other' || intent.type === 'unresolved_target') return true;
  if (
    VERBS_NEEDING_TARGET.has(intent.type) &&
    (intent.targetRaw ?? '').trim() !== '' &&
    !intent.targetId
  ) return true;
  if (intent.type === 'examine' && intent.targetId) {
    const present = visibleInteractables(WHITECHAPEL_MANIFEST, location, flags);
    const t = intent.targetId;
    if (
      OBJECT_DISPLAY_NAMES[t] &&
      !present.includes(t) &&
      !(TAKEABLE_OBJECTS[t] && inventory.includes(TAKEABLE_OBJECTS[t]))
    ) return true;
  }
  return false;
}

/**
 * Candidate lists for the parseAction op. Spoiler-safe: an unintroduced NPC
 * appears under their alias, never their real name.
 */
export function buildParseCandidates(
  location: string,
  inventory: string[],
  npcStates: Record<string, NPCState>,
  currentAct: number,
  introducedNpcs: string[],
  elapsedMinutes: number,
  flags: Record<string, boolean>,
): ParseCandidates {
  const present = visibleInteractables(WHITECHAPEL_MANIFEST, location, flags);
  const carriedIds = Object.entries(TAKEABLE_OBJECTS)
    .filter(([, itemName]) => inventory.includes(itemName))
    .map(([objId]) => objId);
  const objectIds = [...new Set([...present, ...carriedIds])];
  const asEntry = (id: string) => ({ id, name: OBJECT_DISPLAY_NAMES[id] ?? id.replace(/_/g, ' ') });

  const period = timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, currentAct, elapsedMinutes);
  const people = getPresentNpcIds(WHITECHAPEL_MANIFEST.npcs, location, npcStates, currentAct, period)
    .map(id => {
      const npc = NPCS[id];
      const introduced = !npc.requiresIntroduction || introducedNpcs.includes(id);
      const name = introduced
        ? `${npc.displayName} — ${npc.role}`
        : `${npc.alias ?? 'a stranger'} — ${npc.aliasDescription ?? npc.role}`;
      return { id, name };
    });

  return {
    objects: objectIds.map(asEntry),
    carried: carriedIds.map(asEntry),
    people,
    locations: Object.entries(LOCATIONS).map(([id, loc]) => ({ id, name: loc.name })),
  };
}
