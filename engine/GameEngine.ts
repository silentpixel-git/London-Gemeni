/**
 * engine/GameEngine.ts
 *
 * The deterministic rule enforcer for London Bleeds.
 *
 * Resolves player actions against canonical world data.
 * Returns an EngineResult with all state changes decided.
 * The AI receives this result and only writes narrative prose.
 *
 * The engine NEVER hallucinate — it only knows what's in gameData.ts.
 */

import { EngineResult, NarrationContext, RumorEvents } from '../types';
import { ParsedIntent } from './intentParser';
import type { StoryManifest } from './stories/types';
import { WHITECHAPEL_MANIFEST } from './stories/whitechapel-1888/manifest';
import { computeTimePeriod, PERIOD_ORDER, minutesToNextPeriodBoundary, periodBoundariesCrossed, nextOpenPeriod, timePeriodFor } from './time';
import { npcLocationAt, returnsPeriodFor, getPresentNpcIds, maturedSpreadsFor } from './presence';
import type { SessionSnapshot } from './session';
import { checkActProgression, computeActEntry } from './resolvers/support';
import { resolveMove } from './resolvers/move';
import { resolveExamine, resolveRead } from './resolvers/examine';
import { resolveTalk, resolveShow } from './resolvers/npc';
import { resolveTake, resolveUse, resolveDrop, resolveInventory } from './resolvers/items';
import { resolveDeduce, resolveNotebook } from './resolvers/deduce';
import { resolveWait, resolveHelp, resolveQuery, resolveUnresolvedTarget, resolveOther } from './resolvers/meta';
import { selectApproach } from './approaches';

// Re-export for existing consumers (useGameState, parseFallback, qa scripts).
export { computeTimePeriod, PERIOD_ORDER, minutesToNextPeriodBoundary, periodBoundariesCrossed, nextOpenPeriod, timePeriodFor };
export { npcLocationAt, returnsPeriodFor, getPresentNpcIds, maturedSpreadsFor };
export type { SessionSnapshot };

// ============================================================
// Main Engine Class
// ============================================================

export class GameEngine {
  constructor(private readonly story: StoryManifest) {}

  /**
   * Main entry point. Takes the player's parsed intent and current session
   * snapshot and returns a fully resolved EngineResult.
   */
  resolve(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    let result: EngineResult;
    switch (intent.type) {
      case 'move':      result = resolveMove(this.story, intent, session); break;
      case 'examine':   result = resolveExamine(this.story, intent, session); break;
      case 'talk':      result = resolveTalk(this.story, intent, session); break;
      case 'take':      result = resolveTake(this.story, intent, session); break;
      case 'use':       result = resolveUse(this.story, intent, session); break;
      case 'show':      result = resolveShow(this.story, intent, session); break;
      case 'read':      result = resolveRead(this.story, intent, session); break;
      case 'drop':      result = resolveDrop(this.story, intent, session); break;
      case 'inventory': result = resolveInventory(this.story, intent, session); break;
      case 'notebook':  result = resolveNotebook(this.story, intent, session); break;
      case 'deduce':    result = resolveDeduce(this.story, intent, session); break;
      case 'wait':      result = resolveWait(this.story, intent, session); break;
      case 'help':      result = resolveHelp(this.story, intent, session); break;
      case 'query':              result = resolveQuery(this.story, intent, session); break;
      case 'unresolved_target':  result = resolveUnresolvedTarget(this.story, intent, session); break;
      case 'other':
      default:                   result = resolveOther(this.story, intent, session); break;
    }

    // Act progression for talk/show — these resolvers set gate flags
    // (talked_to_*, showed_*) but do not run their own progression check.
    if (
      (result.actionType === 'talk' || result.actionType === 'show') &&
      result.actionSuccess &&
      result.newAct === undefined
    ) {
      const mergedFlags = { ...session.flags, ...(result.flagsUpdate ?? {}) };
      const actCheck = checkActProgression(this.story, session, mergedFlags);
      if (actCheck.newAct !== undefined) {
        result.newAct = actCheck.newAct;
        result.flagsUpdate = { ...result.flagsUpdate, ...actCheck.flagsUpdate };
        result.gameOver = result.gameOver || actCheck.gameOver;
      }
    }

    // Act-anchor auto-move (the hard cut): entering a new act teleports Watson
    // to the act's anchor location and carries follows_watson / follows_bond
    // NPCs along, so Holmes is never left a location behind.
    if (result.newAct !== undefined && !result.gameOver) {
      const { anchor, npcUpdates } = this.computeActEntry(result.newAct, session);
      if (anchor && anchor !== (result.newLocation ?? session.location)) {
        result.newLocation = anchor;
        result.npcUpdates = { ...result.npcUpdates, ...npcUpdates };
      }
    }

    // Ending classification — every gameOver carries its ending type.
    if (result.gameOver) {
      result.endingType =
        result.actionType === 'deduce' && !result.actionSuccess
          ? 'cold_case'
          : 'true_ending';
    }

    // Proactive Watson hint — fires once per location when the player is stuck.
    if (this.shouldFireHolmesNudge(session, result)) {
      result.aiContext.watsonHint = this.story.selectHint(session);
      result.flagsUpdate = {
        ...result.flagsUpdate,
        [`holmes_nudged_at_${session.location}`]: true,
      };
    }

    // Lift NPC introduction flags off the narration context onto the result
    // proper, so the AI context that leaves the engine carries verified facts only.
    const ctxWithIntro = result.aiContext as NarrationContext & {
      _introductionFlagsUpdate?: Record<string, boolean>;
      _vignetteFlagsUpdate?: Record<string, boolean>;
      _worldEventFlagsUpdate?: Record<string, boolean>;
      _rumorAckFlagsUpdate?: Record<string, boolean>;
    };
    if (ctxWithIntro._introductionFlagsUpdate) {
      result.introductionFlagsUpdate = ctxWithIntro._introductionFlagsUpdate;
      delete ctxWithIntro._introductionFlagsUpdate;
    }
    // Vignette once-only flags ride the normal flags pipeline (persisted with the turn)
    if (ctxWithIntro._vignetteFlagsUpdate) {
      result.flagsUpdate = { ...result.flagsUpdate, ...ctxWithIntro._vignetteFlagsUpdate };
      delete ctxWithIntro._vignetteFlagsUpdate;
    }
    // World-event once-only flags ride the normal flags pipeline (persisted with the turn)
    if (ctxWithIntro._worldEventFlagsUpdate) {
      result.flagsUpdate = { ...result.flagsUpdate, ...ctxWithIntro._worldEventFlagsUpdate };
      delete ctxWithIntro._worldEventFlagsUpdate;
    }
    // Rumor-ack once-only flags ride the normal flags pipeline (persisted with the turn)
    if (ctxWithIntro._rumorAckFlagsUpdate) {
      result.flagsUpdate = { ...result.flagsUpdate, ...ctxWithIntro._rumorAckFlagsUpdate };
      delete ctxWithIntro._rumorAckFlagsUpdate;
    }

    // NPC approach (see engine/approaches.ts) — after all outcome handling,
    // so suppression rules can see the whole turn.
    const approach = selectApproach(this.story, session, result);
    if (approach) {
      result.aiContext.npcApproach = approach.npcApproach;
      result.flagsUpdate = { ...result.flagsUpdate, ...approach.flagsUpdate };
      if (approach.introductionFlagsUpdate) {
        result.introductionFlagsUpdate = {
          ...result.introductionFlagsUpdate,
          ...approach.introductionFlagsUpdate,
        };
      }
      result.approachAtMinutes = approach.atMinutes;
    }

    // Rumor trigger recording (Phase 4b): the first turn a rumor's trigger
    // flag is true (whether set this turn or inherited from a pre-4b save)
    // with no log entry starts that rumor's clock. Runs AFTER buildContext,
    // so a delayPeriods-0 hop can never nudge on the very turn it fires.
    const mergedForRumors = { ...session.flags, ...(result.flagsUpdate ?? {}) };
    let rumorEventsUpdate: RumorEvents | undefined;
    for (const rumor of this.story.rumors) {
      if (mergedForRumors[rumor.triggerFlag] && !session.rumorEvents[rumor.id]) {
        const cfg = this.story.actTimeConfig[session.currentAct] ?? this.story.actTimeConfig[1];
        (rumorEventsUpdate ??= {})[rumor.id] = {
          act: session.currentAct,
          atMinutes: cfg.canonicalMinutes + session.elapsedMinutes,
        };
      }
    }
    if (rumorEventsUpdate) result.rumorEventsUpdate = rumorEventsUpdate;

    return result;
  }

  private shouldFireHolmesNudge(session: SessionSnapshot, result: EngineResult): boolean {
    if (result.newLocation) return false;   // player is moving
    if (result.newAct) return false;         // act just advanced — progress made
    if (result.gameOver) return false;
    if (session.flags[`holmes_nudged_at_${session.location}`]) return false; // already nudged here
    if (result.discoveredClueIds && result.discoveredClueIds.length > 0) return false; // clue found
    return session.turnsAtLocationWithoutProgress >= 4;
  }

  /** See resolvers/support.computeActEntry — kept as a method for existing callers. */
  public computeActEntry(toAct: number, session: SessionSnapshot) {
    return computeActEntry(this.story, toAct, session);
  }
}


// Singleton export — the one place the active story is bound to the engine.
export const gameEngine = new GameEngine(WHITECHAPEL_MANIFEST);
