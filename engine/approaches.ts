/**
 * engine/approaches.ts
 *
 * NPC approach selection — the world initiating contact. Runs in
 * GameEngine.resolve() AFTER act/anchor/ending handling so it can see the
 * whole turn's outcome, and never fires on a dramatic turn. Deterministic:
 * first eligible approach in authored order, at most one per turn.
 */

import type { EngineResult, NarrationContext } from '../types';
import type { StoryManifest } from './stories/types';
import type { SessionSnapshot } from './session';
import { npcLocationAt, maturedSpreadsFor } from './presence';
import { computeTimePeriod } from './time';

export const APPROACH_COOLDOWN_MINUTES = 30;

export interface SelectedApproach {
  npcApproach: NonNullable<NarrationContext['npcApproach']>;
  flagsUpdate: Record<string, boolean>;
  introductionFlagsUpdate?: Record<string, boolean>;
  atMinutes: number;
}

/**
 * Returns the first eligible approach for this turn, or null if none fires —
 * either because every authored approach is ineligible/exhausted, or because
 * the turn itself is suppressed (failed action, act transition, ending, clue
 * discovery, deduction, non-full narration, vignette turn, cooldown).
 */
export function selectApproach(
  story: StoryManifest,
  session: SessionSnapshot,
  result: EngineResult,
): SelectedApproach | null {
  // Dramatic-turn suppression (spec): failed actions, act transitions,
  // endings, clue discoveries, deductions, non-full narration, vignette turns.
  if (!result.actionSuccess) return null;
  if (result.newAct !== undefined || result.gameOver) return null;
  if (result.discoveredClueIds && result.discoveredClueIds.length > 0) return null;
  if (result.actionType === 'deduce') return null;
  if (result.aiContext.narrationMode !== 'full') return null;
  if (result.aiContext.vignette) return null;

  const locationId = result.newLocation ?? session.location;
  if (!story.locations[locationId]) return null;

  const cfg = story.actTimeConfig[session.currentAct] ?? story.actTimeConfig[1];
  const now = cfg.canonicalMinutes + session.elapsedMinutes + (result.minutesAdvanced ?? 0);
  if (session.lastApproachAtMinutes !== undefined &&
      now - session.lastApproachAtMinutes < APPROACH_COOLDOWN_MINUTES) return null;
  const period = computeTimePeriod(now);

  for (const a of story.approaches) {
    if (session.flags[`approach_${a.id}`]) continue;
    if (a.locationId !== 'any' && a.locationId !== locationId) continue;
    if (a.acts && !a.acts.includes(session.currentAct)) continue;
    if (a.timePeriods && !a.timePeriods.includes(period)) continue;
    if (a.requireFlags?.some(f => !session.flags[f])) continue;
    if (a.forbidFlags?.some(f => session.flags[f])) continue;

    const npc = story.npcs[a.npcId];
    if (!npc) continue;
    if (session.npcStates[a.npcId]?.status === 'deceased') continue;
    if (npcLocationAt(story.npcs, a.npcId, session.currentAct, period, session.npcStates) !== locationId) continue;

    let rumorStatement: string | undefined;
    if (a.kind === 'rumor') {
      const matured = maturedSpreadsFor(story.rumors, session.rumorEvents, a.npcId, session.currentAct, now);
      const match = matured.find(m => m.rumorId === a.rumorId);
      if (!match) continue;
      rumorStatement = match.statement;
    }

    // Introduction: an approach counts as a first TALK. Self-introduction
    // NPCs reveal their name in-beat; document-gated NPCs stay alias-masked
    // (the document gate is spoiler-critical — never bypassed here).
    const isIntroduced = !npc.requiresIntroduction || session.introducedNpcs.includes(a.npcId);
    const introType = npc.introduction ?? { type: 'self' };
    const introducesSelf = !isIntroduced && introType.type === 'self';
    const label = isIntroduced
      ? npc.displayName
      : (npc.alias ?? story.npcAliases[a.npcId] ?? npc.displayName);

    return {
      npcApproach: {
        npcId: a.npcId,
        label,
        isIntroduced,
        introducesSelf,
        realName: introducesSelf ? npc.displayName : undefined,
        kind: a.kind,
        text: a.text,
        statement: rumorStatement,
      },
      flagsUpdate: {
        [`approach_${a.id}`]: true,
        // De-dup against the ordinary TALK-based rumor delivery (see
        // engine/narrationContext.ts) — this beat already delivered the
        // matured statement, so it must not surface a second time on the
        // next TALK as though newly heard.
        ...(a.kind === 'rumor' ? { [`rumor_ack_${a.rumorId}_${a.npcId}`]: true } : {}),
      },
      introductionFlagsUpdate: introducesSelf
        ? { [`npc_introduced_${a.npcId}`]: true }
        : undefined,
      atMinutes: now,
    };
  }
  return null;
}
