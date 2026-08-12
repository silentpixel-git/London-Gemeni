/**
 * engine/resolvers/support.ts
 *
 * Shared engine machinery used by the per-action resolvers and the
 * GameEngine façade: current-period lookup, clue triggering, act
 * progression, and NPC movement on player travel. Extracted verbatim from
 * GameEngine.ts (backlog #8 god-file split) — each function takes the
 * StoryManifest explicitly instead of reading it off `this`.
 */

import { NPCState, TimePeriod } from '../../types';
import type { StoryManifest, ClueDefinition } from '../stories/types';
import { timePeriodFor } from '../time';
import type { SessionSnapshot } from '../session';

/** The current TimePeriod for this session's act + elapsed clock. */
export function periodOf(story: StoryManifest, session: SessionSnapshot, extraMinutes = 0): TimePeriod {
  return timePeriodFor(story.actTimeConfig, session.currentAct, session.elapsedMinutes + extraMinutes, session.flags);
}

/**
 * Look up clues triggered by examining objectId at locationId.
 * Filters out clues already discovered or suppressed by alreadyExamined.
 * Returns the clue list plus pre-calculated point deltas.
 */
export function triggerClues(
  story: StoryManifest,
  locationId: string,
  objectId: string,
  alreadyExamined: boolean,
  discoveredClueIds: string[]
): { newClueIds: string[]; newClueDefs: ClueDefinition[]; medicalDelta: number; moralDelta: number } {
  const candidates = story.clueTriggers[locationId]?.[objectId] ?? [];
  const newClueIds = alreadyExamined
    ? []
    : candidates.filter(id => !discoveredClueIds.includes(id));
  const newClueDefs = newClueIds.map(id => story.clueDefinitions[id]).filter(Boolean) as ClueDefinition[];
  return {
    newClueIds,
    newClueDefs,
    medicalDelta: newClueDefs.reduce((sum, c) => sum + c.medicalPoints, 0),
    moralDelta: newClueDefs.reduce((sum, c) => sum + c.moralPoints, 0),
  };
}

/**
 * Compute the state Watson enters a new act with: the anchor location and the
 * NPC movements for that act. Used both by resolve() on a live act-advance and
 * by the UI when committing a deferred act transition (e.g. after reload).
 */
export function computeActEntry(
  story: StoryManifest,
  toAct: number,
  session: SessionSnapshot
): { anchor: string; npcUpdates: Record<string, Partial<NPCState>> } {
  const anchor = story.actAnchors[toAct];
  const npcUpdates = computeNpcMovements(story, anchor, { ...session, currentAct: toAct });
  return { anchor, npcUpdates };
}

/**
 * The act-epilogue hard cut: when every gate flag of the current act is set
 * EXCEPT the one authored last, Watson is cut to the act's epilogue location for
 * the fireside summation, instead of being made to walk home to trigger it.
 *
 * Mirror of computeActEntry — same anchor-plus-follower-carry shape — but fired
 * on the act's field work completing rather than on entering a new act. The act
 * then advances normally when the player has the closing conversation there, so
 * this adds a cut, never a state change the gate did not already require.
 *
 * The LAST entry of `requireFlags` is the closing beat by convention; every
 * other entry is field work. Returns null when the act has no authored epilogue,
 * when the field work is incomplete, when the closing flag is already set, or
 * when the cut has already fired (`act_<n>_epilogue_cut`).
 */
export function computeActEpilogue(
  story: StoryManifest,
  session: SessionSnapshot,
  currentFlags: Record<string, boolean>,
): { location: string; npcUpdates: Record<string, Partial<NPCState>>; flagsUpdate: Record<string, boolean> } | null {
  const location = story.actEpilogues?.[session.currentAct];
  if (!location || !story.locations[location]) return null;

  const cutFlag = `act_${session.currentAct}_epilogue_cut`;
  if (currentFlags[cutFlag]) return null;

  const condition = story.actProgression[session.currentAct];
  if (!condition || condition.requireFlags.length < 2) return null;

  const closingFlag = condition.requireFlags[condition.requireFlags.length - 1];
  if (currentFlags[closingFlag]) return null;

  const fieldWork = condition.requireFlags.slice(0, -1);
  if (!fieldWork.every(f => currentFlags[f] === true)) return null;

  // Already standing in the right room: the beat plays where Watson is, and the
  // cut is marked spent so it cannot fire again if he wanders off and back.
  if (session.location === location) {
    return { location, npcUpdates: {}, flagsUpdate: { [cutFlag]: true } };
  }

  return {
    location,
    npcUpdates: computeNpcMovements(story, location, session),
    flagsUpdate: { [cutFlag]: true },
  };
}

/**
 * When Watson moves, compute which NPCs follow.
 * Behaviour is driven entirely by NPCDefinition fields:
 *   followsNpcId === 'watson'  → shadow the player destination
 *   followsNpcId === <npcId>   → shadow that NPC's resolved location
 *   location_based / fixed     → snap to the schedule for the current act + period
 */
export function computeNpcMovements(
  story: StoryManifest,
  newLocationId: string,
  session: SessionSnapshot
): Record<string, Partial<NPCState>> {
  const updates: Record<string, Partial<NPCState>> = {};
  const period = periodOf(story, session);

  // First pass: location-based and fixed NPCs (establish canonical positions).
  // An NPC with NO canonical entry for the current act is OFFSTAGE — e.g.
  // Tumblety after he flees in Act 4. The 'offstage' sentinel never matches
  // a real location id, so the NPC simply does not appear anywhere.
  for (const [npcId, npc] of Object.entries(story.npcs)) {
    if (npc.followingRule === 'location_based' || npc.followingRule === 'fixed') {
      if (npc.presenceRequiresFlag && session.flags[npc.presenceRequiresFlag] !== true) continue;
      const canonical = npc.scheduleByAct[session.currentAct] ? (npc.scheduleByAct[session.currentAct].byPeriod?.[period] ?? npc.scheduleByAct[session.currentAct].default) : 'offstage';
      if (canonical !== session.npcStates[npcId]?.currentLocation) {
        updates[npcId] = { currentLocation: canonical };
      }
    }
  }

  // Second pass: NPCs that shadow another entity
  for (const [npcId, npc] of Object.entries(story.npcs)) {
    if (!npc.followsNpcId) continue;

    // Once an NPC stops following (e.g. Edmund committed in Act 6), it
    // reverts to its canonical location for the current act.
    if (npc.followsUntilAct !== undefined && session.currentAct > npc.followsUntilAct) {
      const canonical = npc.scheduleByAct[session.currentAct]?.byPeriod?.[period] ?? npc.scheduleByAct[session.currentAct]?.default;
      if (canonical && canonical !== session.npcStates[npcId]?.currentLocation) {
        updates[npcId] = { currentLocation: canonical };
      }
      continue;
    }

    let destination: string | undefined;
    if (npc.followsNpcId === 'watson') {
      destination = newLocationId;
    } else {
      // Resolve the followed NPC's location from this turn's updates, then session, then canonical
      destination =
        (updates[npc.followsNpcId]?.currentLocation as string | undefined) ??
        session.npcStates[npc.followsNpcId]?.currentLocation ??
        story.npcs[npc.followsNpcId]?.scheduleByAct[session.currentAct]?.default;
    }

    if (destination && destination !== session.npcStates[npcId]?.currentLocation) {
      updates[npcId] = { currentLocation: destination };
    }
  }

  return updates;
}

/**
 * Check if the current flags satisfy any act progression condition.
 * Returns the new act number and any flags to set if advancing.
 */
export function checkActProgression(
  story: StoryManifest,
  session: SessionSnapshot,
  currentFlags: Record<string, boolean>
): { newAct?: number; flagsUpdate?: Record<string, boolean>; gameOver?: boolean } {
  const condition = story.actProgression[session.currentAct];
  if (!condition) return {};

  const allMet = condition.requireFlags.every(flag => currentFlags[flag] === true);
  if (!allMet) return {};

  // All conditions met — advance act
  const advanceTo = condition.advanceTo;
  if (advanceTo <= session.currentAct) return {}; // Prevent regression

  // Advancing past the final playable act (no further progression defined)
  // concludes the game — e.g. visiting the Private Asylum in Act VI.
  const isFinalAct = !story.actProgression[advanceTo];

  // Sync NPC locations for new act
  return {
    newAct: advanceTo,
    flagsUpdate: { [`act_${advanceTo}_started`]: true },
    gameOver: isFinalAct || undefined,
  };
}
