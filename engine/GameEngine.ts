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

import { NPCState, EngineResult, NarrationContext, IntentType, TimePeriod, RumorEvents } from '../types';
import { ParsedIntent } from './intentParser';
import type { StoryManifest, NPCDefinition, ClueDefinition } from './stories/types';
import { WHITECHAPEL_MANIFEST } from './stories/whitechapel-1888/manifest';
import { deriveKnowledgeEnvelope } from './stories/knowledge';
import { computeTimePeriod, PERIOD_ORDER, minutesToNextPeriodBoundary, periodBoundariesCrossed, nextOpenPeriod, timePeriodFor } from './time';
import { npcLocationAt, returnsPeriodFor, getPresentNpcIds, maturedSpreadsFor } from './presence';
import type { SessionSnapshot } from './session';
import { periodOf, triggerClues, checkActProgression, computeNpcMovements, computeActEntry } from './resolvers/support';
import { buildNarrationContext, blocked, absentNpcBlocked } from './narrationContext';

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
      case 'move':      result = this.resolveMove(intent, session); break;
      case 'examine':   result = this.resolveExamine(intent, session); break;
      case 'talk':      result = this.resolveTalk(intent, session); break;
      case 'take':      result = this.resolveTake(intent, session); break;
      case 'use':       result = this.resolveUse(intent, session); break;
      case 'show':      result = this.resolveShow(intent, session); break;
      case 'read':      result = this.resolveRead(intent, session); break;
      case 'drop':      result = this.resolveDrop(intent, session); break;
      case 'inventory': result = this.resolveInventory(intent, session); break;
      case 'notebook':  result = this.resolveNotebook(intent, session); break;
      case 'deduce':    result = this.resolveDeduce(intent, session); break;
      case 'wait':      result = this.resolveWait(intent, session); break;
      case 'help':      result = this.resolveHelp(intent, session); break;
      case 'query':              result = this.resolveQuery(intent, session); break;
      case 'unresolved_target':  result = this.resolveUnresolvedTarget(intent, session); break;
      case 'other':
      default:                   result = this.resolveOther(intent, session); break;
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

  // --------------------------------------------------------
  // MOVE
  // --------------------------------------------------------

  private resolveMove(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = this.story.locations[session.location];
    const targetId = intent.targetId;

    if (!targetId) {
      return blocked(this.story,
        intent,
        session,
        `Watson cannot determine where to go. The fog of Whitechapel obscures that path.`,
        `Watson attempted to move but could not identify a destination: "${intent.targetRaw}".`
      );
    }

    // Check exit is valid from current location
    if (!currentLoc.exits.includes(targetId)) {
      const targetLoc = this.story.locations[targetId];
      const targetName = targetLoc?.name || intent.targetRaw;
      return blocked(this.story,
        intent,
        session,
        `There is no direct path from ${currentLoc.name} to ${targetName} from here.`,
        `Watson attempted to go to "${targetName}" but that exit is not available from ${currentLoc.name}.`
      );
    }

    // Check act gate — location requires a higher act
    const targetLoc = this.story.locations[targetId];
    if (targetLoc.act > session.currentAct) {
      return blocked(this.story,
        intent,
        session,
        `Holmes places a hand on Watson's arm. "Not yet, Watson. There is more to understand before we pursue that thread."`,
        `Watson attempted to travel to ${targetLoc.name} but it is not yet accessible (requires Act ${targetLoc.act}, currently Act ${session.currentAct}).`
      );
    }

    // Check flag gate — some locations open only after a specific milestone
    // (e.g. the asylum requires a correct deduction first).
    if (targetLoc.requiresFlag && session.flags[targetLoc.requiresFlag] !== true) {
      return blocked(this.story,
        intent,
        session,
        `Holmes shakes his head. "We cannot present ourselves there without a name, Watson. We must be certain first."`,
        `Watson attempted to travel to ${targetLoc.name} but it requires a correct deduction first (flag '${targetLoc.requiresFlag}' not set).`
      );
    }

    // Opening hours (Phase 4a) — arriving outside openPeriods is a locked
    // door, never a dead end: the note says when it opens and where the
    // keyholder is, and WAIT gets Watson in.
    const period = periodOf(this.story, session);
    if (targetLoc.openPeriods && !targetLoc.openPeriods.includes(period)) {
      const reopens = nextOpenPeriod(targetLoc.openPeriods, period);
      const keyholderId = targetLoc.lockedNote?.keyholderNpcId;
      let keyholderNote = '';
      if (keyholderId) {
        const kh = this.story.npcs[keyholderId];
        const introduced = !kh?.requiresIntroduction || session.introducedNpcs.includes(keyholderId);
        const label = introduced ? (this.story.npcDisplayNames[keyholderId] ?? keyholderId) : (kh?.alias ?? 'the keeper');
        const whereId = npcLocationAt(this.story.npcs, keyholderId, session.currentAct, period, session.npcStates);
        const where = this.story.locations[whereId];
        if (where && whereId !== targetId) keyholderNote = ` ${label} is presently at ${where.name}.`;
      }
      return blocked(this.story,
        intent,
        session,
        targetLoc.lockedNote?.text ?? `${targetLoc.name} is closed at this hour.`,
        `BLOCKED — ${targetLoc.name} is closed (it is ${period}). ${targetLoc.lockedNote?.text ?? ''}` +
        (reopens ? ` It opens come ${reopens}.` : '') + keyholderNote +
        ` Convey this diegetically (a bolted door, a card of visiting hours, a caretaker's word). ` +
        `Watson is NOT stuck: make clear he may wait for it to open or turn his attention elsewhere. He does not enter.`
      );
    }

    // Success — move to new location
    const newNpcUpdates = computeNpcMovements(this.story, targetId, session);
    const actCheck = checkActProgression(this.story, { ...session, location: targetId }, session.flags);

    return {
      actionSuccess: true,
      actionType: 'move',
      newLocation: targetId,
      npcUpdates: newNpcUpdates,
      flagsUpdate: actCheck.flagsUpdate,
      newAct: actCheck.newAct,
      gameOver: actCheck.gameOver,
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: `Watson travelled from ${currentLoc.name} to ${targetLoc.name}.`,
        actionResultNote: `SUCCESS — Watson has arrived at ${targetLoc.name}.`,
        newClueDefs: [],
        targetLocationId: targetId,
        newNpcUpdates,
      }),
    };
  }

  // --------------------------------------------------------
  // EXAMINE
  // --------------------------------------------------------

  private resolveExamine(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = this.story.locations[session.location];
    const targetId = intent.targetId;

    if (!targetId) {
      // General "look around" — always succeeds, no state changes
      const locationFlag = currentLoc.locationExaminedFlag;
      const flagsUpdate = locationFlag ? { [locationFlag]: true } : {};
      const actCheck = checkActProgression(this.story, session, { ...session.flags, ...flagsUpdate });
      return {
        actionSuccess: true,
        actionType: 'examine',
        flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
        newAct: actCheck.newAct,
        gameOver: actCheck.gameOver,
        discoveredClueIds: [],
        aiContext: buildNarrationContext(this.story, intent, session, {
          success: true,
          actionDescription: `Watson surveyed the surroundings of ${currentLoc.name}.`,
          actionResultNote: 'SUCCESS — Watson observes the environment.',
          newClueDefs: [],
        }),
      };
    }

    // Is the object actually in this location?
    if (!currentLoc.interactables.includes(targetId)) {
      // Check if it's an NPC — organic physical examination rather than talk redirect
      if (this.story.npcs[targetId]) {
        const npcLoc = npcLocationAt(this.story.npcs, targetId, session.currentAct, periodOf(this.story, session), session.npcStates);
        const npcName = this.story.npcDisplayNames[targetId] || targetId;

        if (npcLoc !== session.location) {
          return absentNpcBlocked(this.story, intent, session, targetId, 'examine');
        }

        // NPC is present — physical/sensory examination (not dialogue)
        // The AI uses CHARACTER PROFILES + STIM for a consistent, doctor-eye description
        const what = intent.targetRaw || npcName;
        return {
          actionSuccess: true,
          actionType: 'examine',
          discoveredClueIds: [],
          aiContext: buildNarrationContext(this.story, intent, session, {
            success: true,
            actionDescription: `Watson examined ${what} at ${currentLoc.name}.`,
            actionResultNote:
              `SUCCESS — ORGANIC PHYSICAL EXAMINATION of ${npcName}. ` +
              `Watson is looking at ${what} — this is a sensory observation by a trained surgeon, NOT a conversation. ` +
              `Do NOT write dialogue. Use the CHARACTER PROFILES section to inform physical details (build, manner, staining, wear). ` +
              `Check SESSION OBSERVATIONS (STIM) first — if this subject is already there, reproduce it exactly. ` +
              `If not in STIM, invent one vivid 10-15 word medical/forensic observation Watson would notice, ` +
              `then add it to stimUpdate as { key: stable snake_case id (e.g. "holmes_coat", "abberline_hands"), summary, scope: "npc" }.`,
            newClueDefs: [],
          }),
        };
      }
      // Carried copy: the object isn't here, but Watson holds its takeable
      // item (e.g. the Dear Boss clipping examined away from Baker Street).
      const carriedItem = this.story.takeableObjects[targetId];
      if (carriedItem && session.inventory.includes(carriedItem)) {
        return {
          actionSuccess: true,
          actionType: 'examine',
          discoveredClueIds: [],
          aiContext: buildNarrationContext(this.story, intent, session, {
            success: true,
            actionDescription: `Watson took ${carriedItem} from his bag and examined it again.`,
            actionResultNote: `SUCCESS — Watson re-reads the ${carriedItem} he carries. It is in his medical bag; narrate him producing and studying it. No new evidence emerges, but he may reflect on what it means.`,
            newClueDefs: [],
          }),
        };
      }

      const objectName = this.story.objectDisplayNames[targetId] || intent.targetRaw;
      return blocked(this.story,
        intent,
        session,
        `Watson does not see ${objectName} here.`,
        `Watson attempted to examine "${objectName}" but it is not present at ${currentLoc.name}.`
      );
    }

    // Check if already examined (prevent clue duplication)
    const alreadyExaminedFlag = `examined_${session.location}_${targetId}`;
    const alreadyExamined = session.flags[alreadyExaminedFlag] === true;

    const { newClueIds, newClueDefs, medicalDelta, moralDelta } =
      triggerClues(this.story, session.location, targetId, alreadyExamined, session.discoveredClueIds);

    // Set location-level "examined" flag for act progression
    const locationFlag = currentLoc.locationExaminedFlag;
    const flagsUpdate: Record<string, boolean> = {
      [alreadyExaminedFlag]: true,
      ...(locationFlag ? { [locationFlag]: true } : {}),
    };

    const allFlags = { ...session.flags, ...flagsUpdate };
    const actCheck = checkActProgression(this.story, session, allFlags);

    // Inventory: add evidence notes for takeable objects whenever Watson is at
    // the source and is not already carrying it. The inventory check is the only
    // dedup needed — gating on !alreadyExamined would strand a dropped item
    // (examined flag stays set, so re-examining could never re-add it), breaking
    // DROP's promise that "He can retrieve it if he returns".
    const inventoryAdd: string[] = [];
    if (this.story.takeableObjects[targetId] && !session.inventory.includes(this.story.takeableObjects[targetId])) {
      inventoryAdd.push(this.story.takeableObjects[targetId]);
    }

    const objectName = this.story.objectDisplayNames[targetId] || intent.targetRaw;

    return {
      actionSuccess: true,
      actionType: 'examine',
      flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
      newAct: actCheck.newAct,
      gameOver: actCheck.gameOver,
      discoveredClueIds: newClueIds,
      medicalPointsDelta: medicalDelta || undefined,
      moralPointsDelta: moralDelta || undefined,
      inventoryAdd: inventoryAdd.length > 0 ? inventoryAdd : undefined,
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: `Watson examined the ${objectName} at ${currentLoc.name}.`,
        actionResultNote: newClueIds.length > 0
          ? `SUCCESS — Watson discovered ${newClueIds.length} new clue(s).`
          : alreadyExamined
          ? `SUCCESS — Watson re-examined the ${objectName}. (Previously examined — no new clues.${this.story.takeableObjects[targetId] && session.inventory.includes(this.story.takeableObjects[targetId]) ? ` Watson already carries ${this.story.takeableObjects[targetId]} — do NOT narrate him taking or copying it again.` : ''})`
          : `SUCCESS — Watson examined the ${objectName}.`,
        newClueDefs,
        itemsGained: inventoryAdd,
      }),
    };
  }

  // --------------------------------------------------------
  // TALK
  // --------------------------------------------------------

  private resolveTalk(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = this.story.locations[session.location];
    const targetId = intent.targetId;

    if (!targetId || !this.story.npcs[targetId]) {
      return blocked(this.story,
        intent,
        session,
        `Watson is uncertain whom to address.`,
        `Watson attempted to speak with "${intent.targetRaw}" but could not identify this person.`
      );
    }

    // Check NPC is actually in this location
    const npcLoc = npcLocationAt(this.story.npcs, targetId, session.currentAct, periodOf(this.story, session), session.npcStates);

    if (npcLoc !== session.location) {
      return absentNpcBlocked(this.story, intent, session, targetId, 'speak with');
    }

    const npcName = this.story.npcDisplayNames[targetId] || targetId;

    // Set interaction flag
    const interactionFlag = `talked_to_${targetId}_at_${session.location}`;
    const flagsUpdate: Record<string, boolean> = { [interactionFlag]: true };

    return {
      actionSuccess: true,
      actionType: 'talk',
      flagsUpdate,
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: `Watson addressed ${npcName} at ${currentLoc.name}. Watson said: "${intent.raw}"`,
        actionResultNote: `SUCCESS — Watson engaged ${npcName} in conversation.`,
        newClueDefs: [],
        targetNpcId: targetId,
      }),
    };
  }

  // --------------------------------------------------------
  // TAKE
  // --------------------------------------------------------

  private resolveTake(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = this.story.locations[session.location];
    const targetId = intent.targetId;
    const objectName = targetId ? (this.story.objectDisplayNames[targetId] || intent.targetRaw) : intent.targetRaw;

    if (!targetId || !currentLoc.interactables.includes(targetId)) {
      return blocked(this.story,
        intent,
        session,
        `Watson cannot take ${objectName || 'that'} — it is not here, or cannot be removed.`,
        `Watson attempted to take "${objectName}" but it is not available at ${currentLoc.name}.`
      );
    }

    // Check if it's a takeable object
    const inventoryItem = this.story.takeableObjects[targetId];
    if (!inventoryItem) {
      return blocked(this.story,
        intent,
        session,
        `Watson notes the ${objectName} but cannot remove it from the scene. He makes a mental note instead.`,
        `Watson attempted to take "${objectName}" — object is not portable. Watson observes it instead.`
      );
    }

    if (session.inventory.includes(inventoryItem)) {
      return {
        actionSuccess: true,
        actionType: 'take',
        discoveredClueIds: [],
        aiContext: buildNarrationContext(this.story, intent, session, {
          success: true,
          actionDescription: `Watson checked his ${inventoryItem}.`,
          actionResultNote: `SUCCESS — Watson already has ${inventoryItem} in his possession.`,
          newClueDefs: [],
        }),
      };
    }

    const { newClueIds, newClueDefs, medicalDelta, moralDelta } =
      triggerClues(this.story, session.location, targetId, false, session.discoveredClueIds);

    return {
      actionSuccess: true,
      actionType: 'take',
      inventoryAdd: [inventoryItem],
      discoveredClueIds: newClueIds,
      medicalPointsDelta: medicalDelta || undefined,
      moralPointsDelta: moralDelta || undefined,
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: `Watson took (a copy of) the ${objectName} for his records.`,
        actionResultNote: `SUCCESS — ${inventoryItem} added to Watson's bag.`,
        newClueDefs,
        itemsGained: [inventoryItem],
      }),
    };
  }

  // --------------------------------------------------------
  // USE
  // --------------------------------------------------------

  private resolveUse(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = this.story.locations[session.location];
    const targetId = intent.targetId;

    // ── USE X WITH Y (Infocom-style combination) ──────────────────────────────
    if (intent.useWithTargetId && targetId) {
      const combination = this.story.useCombinations[targetId]?.[intent.useWithTargetId]
                       ?? this.story.useCombinations[intent.useWithTargetId]?.[targetId];

      if (combination) {
        // Act-locked combinations (spoiler gate — e.g. the kidney cross-reference
        // grants asylum-reveal content and must not fire before Act 6).
        if (combination.requiresAct !== undefined && session.currentAct < combination.requiresAct) {
          return blocked(this.story, intent, session,
            `Watson sets the two side by side, but the connection between them refuses to form. Something is still missing — the comparison is premature.`,
            `USE combination blocked: ${targetId} + ${intent.useWithTargetId} requires act ${combination.requiresAct} (currently act ${session.currentAct}). Narrate Watson sensing the documents are related but lacking the context to see how. Do NOT reveal what the connection is.`
          );
        }

        // Location-locked combinations (e.g. the document convergence that must
        // happen at Baker Street, against the casefiles).
        if (combination.requiresLocation && session.location !== combination.requiresLocation) {
          const placeName = this.story.locations[combination.requiresLocation]?.name ?? 'elsewhere';
          return blocked(this.story, intent, session,
            `Watson holds the two side by side, but this is not the place for careful comparison. Better done at ${placeName}, with room to think.`,
            `USE combination blocked: ${targetId} + ${intent.useWithTargetId} requires location '${combination.requiresLocation}' (currently '${session.location}'). Narrate Watson deciding to make the comparison properly at ${placeName}.`
          );
        }

        const hasItem = this.story.takeableObjects[targetId] !== undefined
          && session.inventory.includes(this.story.takeableObjects[targetId]);
        const item2InLocation = currentLoc.interactables.includes(intent.useWithTargetId);
        const item2InInventory = this.story.takeableObjects[intent.useWithTargetId] !== undefined
          && session.inventory.includes(this.story.takeableObjects[intent.useWithTargetId]);

        if (hasItem && (item2InLocation || item2InInventory)) {
          const { newClueIds, newClueDefs } = combination.clueId
            && !session.discoveredClueIds.includes(combination.clueId)
            ? { newClueIds: [combination.clueId], newClueDefs: [{ name: this.story.clueDefinitions[combination.clueId]?.name ?? combination.clueId, description: this.story.clueDefinitions[combination.clueId]?.description ?? '', holmesDeduction: this.story.clueDefinitions[combination.clueId]?.holmesDeduction ?? '' }] }
            : { newClueIds: [], newClueDefs: [] };

          const flagKey = `used_${targetId}_with_${intent.useWithTargetId}`;
          const allFlags = { ...session.flags, [flagKey]: true };
          const actCheck = checkActProgression(this.story, session, allFlags);

          return {
            actionSuccess: true,
            actionType: 'use',
            flagsUpdate: { [flagKey]: true, ...(actCheck.flagsUpdate || {}) },
            newAct: actCheck.newAct,
            discoveredClueIds: newClueIds,
            aiContext: buildNarrationContext(this.story, intent, session, {
              success: true,
              actionDescription: `Watson used ${this.story.objectDisplayNames[targetId] ?? targetId} with ${this.story.objectDisplayNames[intent.useWithTargetId] ?? intent.useWithTargetId}.`,
              actionResultNote: combination.resultNote,
              newClueDefs,
            }),
          };
        }

        // Items not accessible
        return blocked(this.story, intent, session,
          `Watson cannot combine those items here — one or both are not at hand.`,
          `USE combination blocked: ${targetId} + ${intent.useWithTargetId} — item(s) not in inventory or location.`
        );
      }

      // No authored combination
      return blocked(this.story, intent, session,
        `Watson considers it, but there is nothing useful to be learned from combining those two things.`,
        `No USE combination defined for ${targetId} + ${intent.useWithTargetId}.`
      );
    }

    // ── Standard USE at location ──────────────────────────────────────────────
    const useDesc = targetId ? this.story.useInteractions[session.location]?.[targetId] : undefined;

    if (useDesc && targetId) {
      // Verify the object is present (either in location or in inventory via a takeable mapping)
      const isInLocation = currentLoc.interactables.includes(targetId);
      const isInInventory =
        this.story.takeableObjects[targetId] !== undefined &&
        session.inventory.includes(this.story.takeableObjects[targetId]);

      if (isInLocation || isInInventory) {
        const objectName = this.story.objectDisplayNames[targetId] || intent.targetRaw;
        const alreadyExaminedFlag = `examined_${session.location}_${targetId}`;
        const alreadyExamined = session.flags[alreadyExaminedFlag] === true;

        const { newClueIds, newClueDefs, medicalDelta, moralDelta } =
          triggerClues(this.story, session.location, targetId, alreadyExamined, session.discoveredClueIds);

        const locationFlag = currentLoc.locationExaminedFlag;
        const flagsUpdate: Record<string, boolean> = {
          [alreadyExaminedFlag]: true,
          ...(locationFlag ? { [locationFlag]: true } : {}),
        };
        const allFlags = { ...session.flags, ...flagsUpdate };
        const actCheck = checkActProgression(this.story, session, allFlags);

        return {
          actionSuccess: true,
          actionType: 'use',
          flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
          newAct: actCheck.newAct,
          gameOver: actCheck.gameOver,
          discoveredClueIds: newClueIds,
          medicalPointsDelta: medicalDelta || undefined,
          moralPointsDelta: moralDelta || undefined,
          aiContext: buildNarrationContext(this.story, intent, session, {
            success: true,
            actionDescription: `Watson used/interacted with the ${objectName} at ${currentLoc.name}.`,
            actionResultNote: `SUCCESS — ${useDesc}`,
            newClueDefs,
          }),
        };
      }
    }

    // No specific use interaction — fall back to examine
    return this.resolveExamine({ ...intent, type: 'examine' }, session);
  }

  // --------------------------------------------------------
  // SHOW (Infocom: SHOW X TO Y)
  // Watson presents an inventory item to an NPC.
  // --------------------------------------------------------

  private resolveShow(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const targetId = intent.targetId;          // The item being shown
    const npcId    = intent.showTargetNpcId;   // The NPC receiving it

    if (!targetId) {
      return blocked(this.story, intent, session,
        `Watson is not sure what to show.`,
        `SHOW blocked: no item specified.`
      );
    }

    // Item must be in inventory
    const inventoryName = this.story.takeableObjects[targetId];
    const hasItem = inventoryName && session.inventory.includes(inventoryName);
    if (!hasItem) {
      const objectName = this.story.objectDisplayNames[targetId] ?? intent.targetRaw ?? targetId;
      return blocked(this.story, intent, session,
        `Watson does not have the ${objectName} to show.`,
        `SHOW blocked: ${targetId} not in inventory.`
      );
    }

    // NPC must be present
    if (npcId) {
      const npcLoc     = npcLocationAt(this.story.npcs, npcId, session.currentAct, periodOf(this.story, session), session.npcStates);
      const npcName    = this.story.npcDisplayNames[npcId] ?? npcId;

      if (npcLoc !== session.location) {
        return absentNpcBlocked(this.story, intent, session, npcId, 'show something to');
      }

      // Look up authored SHOW interaction
      const interaction = this.story.showInteractions[targetId]?.[npcId];
      if (interaction) {
        const { newClueIds, newClueDefs } = interaction.clueId
          && !session.discoveredClueIds.includes(interaction.clueId)
          ? { newClueIds: [interaction.clueId], newClueDefs: [{ name: this.story.clueDefinitions[interaction.clueId]?.name ?? '', description: this.story.clueDefinitions[interaction.clueId]?.description ?? '', holmesDeduction: this.story.clueDefinitions[interaction.clueId]?.holmesDeduction ?? '' }] }
          : { newClueIds: [], newClueDefs: [] };

        const flagKey = `showed_${targetId}_to_${npcId}`;
        return {
          actionSuccess: true,
          actionType: 'show',
          flagsUpdate: { [flagKey]: true },
          discoveredClueIds: newClueIds,
          aiContext: buildNarrationContext(this.story, intent, session, {
            success: true,
            actionDescription: `Watson showed ${inventoryName} to ${npcName}.`,
            actionResultNote: interaction.resultNote,
            newClueDefs,
            targetNpcId: npcId,
          }),
        };
      }

      // No authored interaction — NPC receives it but nothing specific happens
      return {
        actionSuccess: true,
        actionType: 'show',
        discoveredClueIds: [],
        aiContext: buildNarrationContext(this.story, intent, session, {
          success: true,
          actionDescription: `Watson showed ${inventoryName} to ${npcName}.`,
          actionResultNote: `SUCCESS — ${npcName} examines what Watson has shown. They have no specific reaction beyond polite acknowledgement.`,
          newClueDefs: [],
          targetNpcId: npcId,
        }),
      };
    }

    // No NPC specified — if exactly one NPC is present, Watson naturally shows
    // it to them ("show the clipping" with only Holmes in the room).
    const presentNpcIds = getPresentNpcIds(this.story.npcs, session.location, session.npcStates, session.currentAct, periodOf(this.story, session));
    if (presentNpcIds.length === 1) {
      return this.resolveShow({ ...intent, showTargetNpcId: presentNpcIds[0] }, session);
    }

    // Multiple/no NPCs — Watson examines the item himself
    return this.resolveExamine({ ...intent, type: 'examine' }, session);
  }

  // --------------------------------------------------------
  // READ (Infocom: READ X — shows literal document text)
  // Distinct from EXAMINE: reads words, not physical properties.
  // --------------------------------------------------------

  private resolveRead(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const targetId = intent.targetId;

    if (!targetId) {
      return blocked(this.story, intent, session,
        `Watson is not sure what to read.`,
        `READ blocked: no target specified.`
      );
    }

    // Check this.story.documentText for authored literal text.
    // Act-keyed override first ("<objectId>@<act>") — lets the same document
    // read differently by act (e.g. the casefiles wall before/after Kelly).
    const docText = this.story.documentText[`${targetId}@${session.currentAct}`] ?? this.story.documentText[targetId];
    if (docText) {
      // Item must be in inventory OR in the current location
      const currentLoc = this.story.locations[session.location];
      const inLocation = currentLoc.interactables.includes(targetId);
      const inInventory = this.story.takeableObjects[targetId] && session.inventory.includes(this.story.takeableObjects[targetId]);

      if (inLocation || inInventory) {
        const objectName = this.story.objectDisplayNames[targetId] ?? intent.targetRaw ?? targetId;
        const flagKey = `read_${targetId}`;
        return {
          actionSuccess: true,
          actionType: 'read',
          flagsUpdate: { [flagKey]: true },
          discoveredClueIds: [],
          aiContext: buildNarrationContext(this.story, intent, session, {
            success: true,
            actionDescription: `Watson reads the ${objectName}.`,
            actionResultNote: `SUCCESS — Watson reads the literal text of the document:\n\n${docText}\n\nNarrate Watson reading this, quoting or paraphrasing it in his voice. Note any details that stand out to a trained observer.`,
            newClueDefs: [],
          }),
        };
      }
    }

    // No authored text — fall back to examine
    return this.resolveExamine({ ...intent, type: 'examine' }, session);
  }

  // --------------------------------------------------------
  // DROP
  // Watson leaves an inventory item at the current location.
  // --------------------------------------------------------

  private resolveDrop(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const targetId = intent.targetId;
    const objectName = targetId
      ? (this.story.takeableObjects[targetId] ?? this.story.objectDisplayNames[targetId] ?? intent.targetRaw ?? targetId)
      : (intent.targetRaw ?? 'that item');

    // Find matching inventory item
    const inventoryItem = targetId
      ? session.inventory.find(i => i === this.story.takeableObjects[targetId])
      : undefined;

    if (!inventoryItem) {
      return blocked(this.story, intent, session,
        `Watson is not carrying ${objectName}.`,
        `DROP blocked: ${targetId ?? 'unknown'} not in inventory.`
      );
    }

    return {
      actionSuccess: true,
      actionType: 'drop',
      inventoryRemove: [inventoryItem],
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: `Watson set down the ${inventoryItem}.`,
        actionResultNote: `SUCCESS — Watson places the ${inventoryItem} aside. He can retrieve it if he returns.`,
        newClueDefs: [],
      }),
    };
  }

  // --------------------------------------------------------
  // INVENTORY
  // --------------------------------------------------------

  private resolveInventory(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    return {
      actionSuccess: true,
      actionType: 'inventory',
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: 'Watson checked the contents of his medical bag.',
        actionResultNote: `SUCCESS — Inventory: ${session.inventory.join(', ')}.`,
        newClueDefs: [],
      }),
    };
  }

  // --------------------------------------------------------
  // NOTEBOOK — review discovered clues and progress
  // --------------------------------------------------------

  private resolveNotebook(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const clueCount = session.discoveredClueIds.length;
    const foundClues = session.discoveredClueIds
      .map(id => this.story.clueDefinitions[id])
      .filter(Boolean);

    const clueLines = foundClues.length > 0
      ? foundClues.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n')
      : 'No evidence formally recorded yet.';

    const remaining = Math.max(0, this.story.deductionThreshold - clueCount);
    const readinessNote = clueCount >= this.story.deductionThreshold
      ? 'Watson has sufficient evidence to attempt a deduction. Type DEDUCE followed by your theory to name a suspect.'
      : `Watson needs ${remaining} more piece${remaining === 1 ? '' : 's'} of evidence before a deduction is viable.`;

    // Persons of Interest — the suspect ledger. Entries appear once their
    // requiresFlag is set; cleared entries are annotated (struck through, in
    // Watson's hand). Edmund is never listed pre-convergence by design.
    const poiVisible = this.story.personsOfInterest.filter(
      p => !p.requiresFlag || session.flags[p.requiresFlag]
    );
    const poiLines = poiVisible.length > 0
      ? poiVisible.map(p => {
          const cleared = p.clearedByFlag && session.flags[p.clearedByFlag];
          return cleared
            ? `• ${p.label} — struck through: ${p.clearedNote ?? 'cleared'}`
            : `• ${p.label} — ${p.detail}`;
        }).join('\n')
      : undefined;
    const poiSection = poiLines
      ? `\n\nPERSONS OF INTEREST (Watson's running ledger — cleared names are struck through):\n${poiLines}`
      : '';

    return {
      actionSuccess: true,
      actionType: 'notebook',
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: 'Watson consulted his investigative notebook.',
        actionResultNote:
          `NOTEBOOK — Watson reviews his accumulated evidence:\n${clueLines}${poiSection}\n\n${readinessNote}\n\n` +
          `Write Watson opening his notebook and reflecting on the evidence in his own voice. ` +
          `1–2 short paragraphs. Do not list clues mechanically — Watson draws brief connections between what he has found. ` +
          `If persons of interest are listed, weave Watson's current read of the standing suspects into the reflection. ` +
          `Close with the readiness note in Watson's voice, not as a system instruction.`,
        newClueDefs: [],
      }),
    };
  }

  // --------------------------------------------------------
  // DEDUCE
  // --------------------------------------------------------

  private resolveDeduce(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const theory = (intent.deductionText || intent.raw).toLowerCase();
    const clueCount = session.discoveredClueIds.length;

    // Check if player has enough clues
    if (clueCount < this.story.deductionThreshold) {
      // Spoiler-safe pointer: name locations (accessible this act) that still
      // hold untriggered clues — never the clue content itself.
      const uncoveredLocations = Object.entries(this.story.clueTriggers)
        .filter(([locId, objMap]) => {
          const loc = this.story.locations[locId];
          if (!loc || loc.act > session.currentAct) return false;
          return Object.values(objMap).some(clueIds =>
            clueIds.some(id => !session.discoveredClueIds.includes(id)));
        })
        .map(([locId]) => this.story.locations[locId].name)
        .slice(0, 2);
      const groundNote = uncoveredLocations.length > 0
        ? ` Holmes refuses the theory and — without explaining why — names ground not yet covered: ${uncoveredLocations.join(' and ')}. He says only that the evidence there has not been read, not what it contains.`
        : '';
      return {
        actionSuccess: false,
        actionType: 'deduce',
        blockedReason: `Insufficient evidence — only ${clueCount} of ${this.story.deductionThreshold} required clues discovered.`,
        discoveredClueIds: [],
        aiContext: buildNarrationContext(this.story, intent, session, {
          success: false,
          actionDescription: `Watson attempted to name the killer: "${intent.raw}"`,
          actionResultNote: `BLOCKED — Only ${clueCount} clues discovered. Holmes requires more evidence before committing to a theory.${groundNote}`,
          newClueDefs: [],
        }),
      };
    }

    // Check theory against all suspect profiles
    const matchedProfile = this.story.suspectProfiles.find(profile =>
      profile.aliases.some(alias => theory.includes(alias))
    );

    if (matchedProfile?.isGuilty) {
      // The smoking-gun clue (see the manifest's smokingGunClueId) must be
      // discovered before Holmes commits to a name. Without it, Watson has
      // only circumstantial evidence and Holmes will not commit to a name.
      if (!session.discoveredClueIds.includes(this.story.smokingGunClueId)) {
        return {
          actionSuccess: false,
          actionType: 'deduce',
          blockedReason: `Holmes taps his fingers together. "The connexion exists, Watson — I have seen the shadow of it. But I will not name a man without the thread that ties him to the letters. There is something we have not yet found."`,
          discoveredClueIds: [],
          aiContext: buildNarrationContext(this.story, intent, session, {
            success: false,
            actionDescription: `Watson proposed a theory: "${intent.raw}"`,
            actionResultNote: `BLOCKED — Holmes senses Watson is close but lacks the specific written evidence that links the suspect to the From Hell letter. The forensic connexion has not yet been established. Redirect Watson: the answer lies in written records, not witness accounts.`,
            newClueDefs: [],
          }),
        };
      }

      const isGameOver = matchedProfile.successVisitFlag
        ? session.flags[matchedProfile.successVisitFlag] === true
        : false;
      const npcName = this.story.npcs[matchedProfile.npcId]?.displayName ?? matchedProfile.npcId;

      return {
        actionSuccess: true,
        actionType: 'deduce',
        flagsUpdate: matchedProfile.successFlags,
        newAct: matchedProfile.successAct && session.currentAct < matchedProfile.successAct
          ? matchedProfile.successAct
          : undefined,
        gameOver: isGameOver,
        discoveredClueIds: [],
        aiContext: buildNarrationContext(this.story, intent, session, {
          success: true,
          actionDescription: `Watson named ${npcName} as the suspect: "${intent.raw}"`,
          actionResultNote: isGameOver
            ? 'DEDUCTION COMPLETE — Holmes agrees. The case is resolved, though without legal proof. Game concludes.'
            : 'SUCCESS — Holmes concurs with the theory. The Private Asylum must be visited to confirm.',
          newClueDefs: [],
          isDeduction: true,
          deductionCorrect: true,
        }),
      };
    }

    // No recognised suspect was named. The deduction parser keys on broad
    // phrases ("i believe", "theory", "the answer is…"), so an exploratory
    // line that happens to contain one — but names nobody — lands here. That
    // is not a deliberate accusation, so it must NOT close the case. Ask
    // Watson to name a specific person instead of ending the game.
    if (!matchedProfile) {
      return {
        actionSuccess: false,
        actionType: 'deduce',
        blockedReason: `Holmes raises an eyebrow. "If you mean to accuse a man, Watson, then name him plainly — give me the person, not a feeling."`,
        discoveredClueIds: [],
        aiContext: buildNarrationContext(this.story, intent, session, {
          success: false,
          actionDescription: `Watson reached toward a conclusion without naming anyone: "${intent.raw}"`,
          actionResultNote: `BLOCKED — Watson did not name a specific suspect. The case is NOT closed and this is NOT a failed deduction. Holmes presses him to state plainly whom he accuses; invite Watson to name a person directly.`,
          newClueDefs: [],
        }),
      };
    }

    // Wrong suspect — cold case ending.
    // The case goes unsolved; Watson closes his diary without a resolution.
    // A named red herring (isGuilty:false profile) gets a tailored rebuttal.
    const coldCaseNote = matchedProfile.wrongDeductionNote ??
      `COLD CASE — Watson's theory cannot be supported by the evidence. Holmes gently but firmly disagrees. ` +
      `The Whitechapel murders will go unsolved. Write a 150-word final diary entry: Watson reflects on the ` +
      `failure, the unanswered questions, and the shadow this case casts over London. Tone: sombre and resigned. ` +
      `End with Watson closing his diary.`;

    return {
      actionSuccess: false,
      actionType: 'deduce',
      gameOver: true,
      flagsUpdate: { 'deduction_attempted': true, 'deduction_incorrect': true, 'cold_case': true },
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: false,
        actionDescription: `Watson named a wrong suspect: "${intent.raw}"`,
        actionResultNote: coldCaseNote,
        newClueDefs: [],
        isDeduction: true,
        deductionCorrect: false,
      }),
    };
  }

  // --------------------------------------------------------
  // WAIT (Phase 4a: advances the clock to the next time period)
  // --------------------------------------------------------

  private resolveWait(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const cfg = this.story.actTimeConfig[session.currentAct] ?? this.story.actTimeConfig[1];
    const total = cfg.canonicalMinutes + session.elapsedMinutes;
    const from = computeTimePeriod(total);
    const minutesAdvanced = minutesToNextPeriodBoundary(total);
    const to = computeTimePeriod(total + minutesAdvanced);
    const hours = Math.round((minutesAdvanced / 60) * 10) / 10;

    return {
      actionSuccess: true,
      actionType: 'wait',
      minutesAdvanced,
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: `Watson deliberately waited at ${this.story.locations[session.location].name} as ${from} gave way to ${to}.`,
        actionResultNote:
          `SUCCESS — TIME PASSES. Watson chose to wait; roughly ${hours} hour(s) pass and ${from} becomes ${to}. ` +
          `Narrate the passage of time as ONE compressed beat (light changing, street sounds shifting, Watson's thoughts turning over the case) — ` +
          `not a minute-by-minute account. Do not invent events, arrivals, or discoveries beyond any listed above.`,
        newClueDefs: [],
        extraMinutes: minutesAdvanced,
      }),
    };
  }

  // --------------------------------------------------------
  // HELP
  // --------------------------------------------------------

  private resolveHelp(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = this.story.locations[session.location];
    const clueCount = session.discoveredClueIds.length;
    return {
      actionSuccess: true,
      actionType: 'help',
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: 'Watson consulted his mental notes on how to proceed.',
        actionResultNote:
          `HELP — Remind Watson of his available actions, in character. ` +
          `Available commands: LOOK (survey surroundings), GO [place] (move to a location), ` +
          `EXAMINE [object/person] (inspect something closely), TALK TO [person] (speak with someone), ` +
          `TAKE [object] (add evidence to your bag), USE [object] (interact with something), ` +
          `INVENTORY (check your bag), NOTEBOOK (review discovered clues and case progress), ` +
          `DEDUCE / SOLVE (name the killer — requires ${this.story.deductionThreshold} clues; ` +
          `${clueCount} discovered so far). ` +
          `Current location: ${currentLoc.name}. ` +
          `Write 2–3 sentences as Watson reminding himself of his options — keep it brief and in period voice.`,
        newClueDefs: [],
      }),
    };
  }

  // --------------------------------------------------------
  // QUERY (atmospheric / world question — no state change)
  // --------------------------------------------------------

  private resolveQuery(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    return {
      actionSuccess: true,
      actionType: 'query',
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: `Watson observed: "${intent.raw}"`,
        actionResultNote:
          `WORLD QUERY — Answer Watson's specific question or observation in 1–2 sentences, Watson's first-person voice. ` +
          `Draw on: (1) the location atmosphere and description for immediate scene detail; ` +
          `(2) Watson's knowledge as a Victorian doctor and gentleman for questions about 1888 London life, ` +
          `customs, trades, objects, and period context — he need not limit himself to the immediate scene. ` +
          `If the question concerns something that did not exist in 1888 London — modern technology, post-1888 events, ` +
          `or concepts foreign to a Victorian gentleman — Watson should briefly and gracefully acknowledge he has no ` +
          `knowledge of such a thing, in character. Do not invent anachronistic answers. ` +
          `Do not list exits, objects, or NPCs unless directly relevant to the question.`,
        newClueDefs: [],
      }),
    };
  }

  // --------------------------------------------------------
  // UNRESOLVED TARGET (examine verb used but target unrecognised)
  // --------------------------------------------------------

  private resolveUnresolvedTarget(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = this.story.locations[session.location];
    const availableObjects = currentLoc.interactables
      .map(id => this.story.objectDisplayNames[id] ?? id)
      .join(', ');
    return {
      actionSuccess: false,
      actionType: 'unresolved_target',
      blockedReason: `Watson could not find "${intent.targetRaw}" to examine.`,
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: false,
        actionDescription: `Watson tried to examine "${intent.targetRaw}" but the target could not be identified.`,
        actionResultNote:
          `UNRESOLVED TARGET — Watson could not identify "${intent.targetRaw}" as anything in the scene. ` +
          `Watson should briefly admit he found no such thing, quoting or paraphrasing the player's phrase (e.g. "I could find no '${intent.targetRaw}' worthy of attention"). ` +
          `Then gesture at what IS available at ${currentLoc.name}: ${availableObjects}. ` +
          `Keep it to 1–2 sentences. Do not invent objects or leave Watson sounding confused about the room.`,
        newClueDefs: [],
      }),
    };
  }

  // --------------------------------------------------------
  // OTHER (free-text, no recognised intent)
  // --------------------------------------------------------

  private resolveOther(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = this.story.locations[session.location];
    return {
      actionSuccess: true,
      actionType: 'other',
      discoveredClueIds: [],
      aiContext: buildNarrationContext(this.story, intent, session, {
        success: true,
        actionDescription: `Watson heard himself mutter something unclear: "${intent.raw}"`,
        actionResultNote:
          'UNRECOGNISED INPUT — the instruction was not understood. Watson should briefly, ' +
          'in character, admit he is unsure what he meant to do (e.g. pausing, collecting his ' +
          'thoughts) and naturally suggest what he COULD do here: examine something present, ' +
          'speak to someone present, or move on. Do NOT invent an action or narrate progress.',
        newClueDefs: [],
      }),
    };
  }

  /** See resolvers/support.computeActEntry — kept as a method for existing callers. */
  public computeActEntry(toAct: number, session: SessionSnapshot) {
    return computeActEntry(this.story, toAct, session);
  }
}


// Singleton export — the one place the active story is bound to the engine.
export const gameEngine = new GameEngine(WHITECHAPEL_MANIFEST);
