/**
 * engine/presence.ts
 *
 * Where NPCs are and what they have heard: schedule-derived placement,
 * follower resolution, and Phase 4b rumor-spread maturity. Extracted
 * verbatim from GameEngine.ts (backlog #8 god-file split).
 */

import { NPCState, TimePeriod, RumorEvents } from '../types';
import type { NPCDefinition, RumorDefinition } from './stories/types';
import { PERIOD_ORDER, periodBoundariesCrossed } from './time';

/**
 * Matured rumor-spread entries for one NPC (Phase 4b): every authored spread
 * hop whose rumor has fired and whose delay has elapsed. An act transition
 * matures everything (act gaps span days); within the trigger's act, maturity
 * is delayPeriods TimePeriod boundaries after the recorded trigger time.
 * Rumor-file order — callers prepend these to the knowledge envelope.
 */
export function maturedSpreadsFor(
  rumors: RumorDefinition[],
  rumorEvents: RumorEvents,
  npcId: string,
  act: number,
  totalMinutes: number,
): Array<{ rumorId: string; statement: string }> {
  const out: Array<{ rumorId: string; statement: string }> = [];
  for (const r of rumors) {
    const ev = rumorEvents[r.id];
    if (!ev || act < ev.act) continue;
    for (const s of r.spread) {
      if (s.npcId !== npcId) continue;
      const matured =
        act > ev.act ||
        periodBoundariesCrossed(ev.atMinutes, totalMinutes) >= s.delayPeriods;
      if (matured) out.push({ rumorId: r.id, statement: s.statement });
    }
  }
  return out;
}

/**
 * The next period (cycling the day from `from`, exclusive) in which this
 * NPC's schedule puts them at `locationId` — null if the schedule never
 * brings them back here this act.
 */
export function returnsPeriodFor(
  npc: NPCDefinition,
  act: number,
  locationId: string,
  from: TimePeriod,
): TimePeriod | null {
  const sched = npc.scheduleByAct[act];
  if (!sched) return null;
  const start = PERIOD_ORDER.indexOf(from);
  for (let i = 1; i <= PERIOD_ORDER.length; i++) {
    const p = PERIOD_ORDER[(start + i) % PERIOD_ORDER.length];
    if ((sched.byPeriod?.[p] ?? sched.default) === locationId) return p;
  }
  return null;
}

/**
 * Where an NPC is right now — the single source of truth for NPC placement.
 * Active followers (follows_watson / follows_bond, until followsUntilAct)
 * keep their stored currentLocation; everyone else derives from the schedule,
 * so stored positions can never mask a time-of-day move. 'offstage' never
 * matches a real location id.
 *
 * Note: components/Sidebar.tsx and engine/stories/whitechapel-1888/hints.ts
 * each duplicate this function's presenceRequiresFlag check locally, since
 * neither has a timePeriod value available to call this function directly.
 * If the gating logic here ever changes, update both.
 */
export function npcLocationAt(
  npcs: Record<string, NPCDefinition>,
  npcId: string,
  act: number,
  timePeriod: TimePeriod,
  npcStates: Record<string, NPCState>,
  flags: Record<string, boolean> = {},
): string {
  const npc = npcs[npcId];
  if (!npc) return 'offstage';
  // Not yet arrived: offstage no matter what the schedule says.
  if (npc.presenceRequiresFlag && flags[npc.presenceRequiresFlag] !== true) return 'offstage';
  // Already departed: offstage even if the act schedule still names the room.
  if (npc.presenceForbidFlag && flags[npc.presenceForbidFlag] === true) return 'offstage';
  const sched = npc.scheduleByAct[act];
  const scheduled = sched ? (sched.byPeriod?.[timePeriod] ?? sched.default) : undefined;
  const stored = npcStates[npcId]?.currentLocation;
  const isActiveFollower =
    !!npc.followsNpcId && (npc.followsUntilAct === undefined || act <= npc.followsUntilAct);
  if (isActiveFollower) return stored ?? scheduled ?? 'offstage';
  return scheduled ?? stored ?? 'offstage';
}

/**
 * The NPC IDs physically present at a location right now: those whose live
 * position (npcStates override, else the act's canonical spot) is here and who
 * are not deceased. Shared by the engine's narration build and the hook's AI
 * target fallback so both agree on who Watson can actually address.
 */
export function getPresentNpcIds(
  npcs: Record<string, NPCDefinition>,
  locationId: string,
  npcStates: Record<string, NPCState>,
  currentAct: number,
  timePeriod: TimePeriod,
  flags: Record<string, boolean> = {},
): string[] {
  return Object.keys(npcs).filter(npcId =>
    npcLocationAt(npcs, npcId, currentAct, timePeriod, npcStates, flags) === locationId &&
    npcStates[npcId]?.status !== 'deceased');
}
