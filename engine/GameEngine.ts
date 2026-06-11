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

import { NPCState, EngineResult, NarrationContext, IntentType, TimePeriod } from '../types';
import { ParsedIntent } from './intentParser';
import {
  LOCATIONS,
  NPCS,
  NPC_ALIASES,
  CLUE_TRIGGERS,
  CLUE_DEFINITIONS,
  ATMOSPHERIC_NOTES,
  ClueDefinition,
  TAKEABLE_OBJECTS,
  ACT_PROGRESSION,
  ACT_ANCHORS,
  ACT_NAMES,
  ACT_TIME_CONFIG,
  PERSONS_OF_INTEREST,
  ACT_WEATHER,
  OBJECT_DISPLAY_NAMES,
  NPC_DISPLAY_NAMES,
  DEDUCTION_THRESHOLD,
  USE_INTERACTIONS,
  SHOW_INTERACTIONS,
  USE_COMBINATIONS,
  DOCUMENT_TEXT,
  SUSPECT_PROFILES,
} from './gameData';

// ── Time helpers ──────────────────────────────────────────────────────────────

function computeTimePeriod(totalMinutes: number): TimePeriod {
  const m = totalMinutes % 1440;
  if (m >= 300  && m < 420)  return 'dawn';
  if (m >= 420  && m < 720)  return 'morning';
  if (m >= 720  && m < 1020) return 'afternoon';
  if (m >= 1020 && m < 1200) return 'evening';
  if (m >= 1200 && m < 1380) return 'night';
  return 'lateNight'; // 1380–1439 and 0–299
}

function formatTimeLabel(totalMinutes: number, dayOfWeek: string, displayDate: string): string {
  const m    = totalMinutes % 1440;
  const h24  = Math.floor(m / 60);
  const mins = m % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12  = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mins.toString().padStart(2, '0')} ${ampm} — ${dayOfWeek}, ${displayDate}`;
}

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
  // Note: sanity has been removed. Watson's prose register is now fixed
  // at the professional-composure baseline defined in the AI system prompt.
}

// ============================================================
// Main Engine Class
// ============================================================

export class GameEngine {

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
      case 'help':      result = this.resolveHelp(intent, session); break;
      case 'query':     result = this.resolveQuery(intent, session); break;
      case 'other':
      default:          result = this.resolveOther(intent, session); break;
    }

    // Act progression for talk/show — these resolvers set gate flags
    // (talked_to_*, showed_*) but do not run their own progression check.
    if (
      (result.actionType === 'talk' || result.actionType === 'show') &&
      result.actionSuccess &&
      result.newAct === undefined
    ) {
      const mergedFlags = { ...session.flags, ...(result.flagsUpdate ?? {}) };
      const actCheck = this.checkActProgression(session, mergedFlags);
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
      const anchor = ACT_ANCHORS[result.newAct];
      if (anchor && anchor !== (result.newLocation ?? session.location)) {
        result.newLocation = anchor;
        // Compute follower/canonical positions for the act being ENTERED, not
        // the act being left — Bond must be at his act-N station on arrival.
        result.npcUpdates = {
          ...result.npcUpdates,
          ...this.computeNpcMovements(anchor, { ...session, currentAct: result.newAct }),
        };
      }
    }

    // Ending classification — every gameOver carries its ending type.
    if (result.gameOver) {
      result.endingType =
        result.actionType === 'deduce' && !result.actionSuccess
          ? 'cold_case'
          : 'true_ending';
    }

    // Proactive Holmes nudge — fires once per location when player is stuck
    if (this.shouldFireHolmesNudge(session, result)) {
      result.aiContext.holmesNudge = {
        locationKeyClues: LOCATIONS[session.location].keyClues,
        turnsStuck: session.turnsAtLocationWithoutProgress,
      };
      result.flagsUpdate = {
        ...result.flagsUpdate,
        [`holmes_nudged_at_${session.location}`]: true,
      };

      // Cross-location redirect: if all interactables at the current location are already
      // examined, Holmes redirects Watson toward another accessible location with work to do.
      const currentInteractables = LOCATIONS[session.location].interactables || [];
      const allExamined = currentInteractables.length > 0 && currentInteractables.every(
        obj => session.flags[`examined_${session.location}_${obj}`]
      );
      if (allExamined) {
        const crossTarget = Object.entries(LOCATIONS).find(([locId, loc]) => {
          if ((loc as any).act > session.currentAct) return false;
          if (locId === session.location) return false;
          return ((loc as any).interactables || []).some(
            (obj: string) => !session.flags[`examined_${locId}_${obj}`]
          );
        });
        if (crossTarget) {
          result.aiContext.holmesNudge!.crossLocationTarget = {
            locationName: (crossTarget[1] as any).name,
            locationId: crossTarget[0],
          };
        }
      }
    }

    // Lift NPC introduction flags off the narration context onto the result
    // proper, so the AI context that leaves the engine carries verified facts only.
    const ctxWithIntro = result.aiContext as NarrationContext & {
      _introductionFlagsUpdate?: Record<string, boolean>;
    };
    if (ctxWithIntro._introductionFlagsUpdate) {
      result.introductionFlagsUpdate = ctxWithIntro._introductionFlagsUpdate;
      delete ctxWithIntro._introductionFlagsUpdate;
    }

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
    const currentLoc = LOCATIONS[session.location];
    const targetId = intent.targetId;

    if (!targetId) {
      return this.blocked(
        intent,
        session,
        `Watson cannot determine where to go. The fog of Whitechapel obscures that path.`,
        `Watson attempted to move but could not identify a destination: "${intent.targetRaw}".`
      );
    }

    // Check exit is valid from current location
    if (!currentLoc.exits.includes(targetId)) {
      const targetLoc = LOCATIONS[targetId];
      const targetName = targetLoc?.name || intent.targetRaw;
      return this.blocked(
        intent,
        session,
        `There is no direct path from ${currentLoc.name} to ${targetName} from here.`,
        `Watson attempted to go to "${targetName}" but that exit is not available from ${currentLoc.name}.`
      );
    }

    // Check act gate — location requires a higher act
    const targetLoc = LOCATIONS[targetId];
    if (targetLoc.act > session.currentAct) {
      return this.blocked(
        intent,
        session,
        `Holmes places a hand on Watson's arm. "Not yet, Watson. There is more to understand before we pursue that thread."`,
        `Watson attempted to travel to ${targetLoc.name} but it is not yet accessible (requires Act ${targetLoc.act}, currently Act ${session.currentAct}).`
      );
    }

    // Check flag gate — some locations open only after a specific milestone
    // (e.g. the asylum requires a correct deduction first).
    if (targetLoc.requiresFlag && session.flags[targetLoc.requiresFlag] !== true) {
      return this.blocked(
        intent,
        session,
        `Holmes shakes his head. "We cannot present ourselves there without a name, Watson. We must be certain first."`,
        `Watson attempted to travel to ${targetLoc.name} but it requires a correct deduction first (flag '${targetLoc.requiresFlag}' not set).`
      );
    }

    // Success — move to new location
    const newNpcUpdates = this.computeNpcMovements(targetId, session);
    const actCheck = this.checkActProgression({ ...session, location: targetId }, session.flags);

    return {
      actionSuccess: true,
      actionType: 'move',
      newLocation: targetId,
      npcUpdates: newNpcUpdates,
      flagsUpdate: actCheck.flagsUpdate,
      newAct: actCheck.newAct,
      gameOver: actCheck.gameOver,
      discoveredClueIds: [],
      aiContext: this.buildContext(intent, session, {
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
    const currentLoc = LOCATIONS[session.location];
    const targetId = intent.targetId;

    if (!targetId) {
      // General "look around" — always succeeds, no state changes
      const locationFlag = currentLoc.locationExaminedFlag;
      const flagsUpdate = locationFlag ? { [locationFlag]: true } : {};
      const actCheck = this.checkActProgression(session, { ...session.flags, ...flagsUpdate });
      return {
        actionSuccess: true,
        actionType: 'examine',
        flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
        newAct: actCheck.newAct,
        gameOver: actCheck.gameOver,
        discoveredClueIds: [],
        aiContext: this.buildContext(intent, session, {
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
      if (NPCS[targetId]) {
        const npcState = session.npcStates[targetId];
        const npcLoc = npcState?.currentLocation ?? NPCS[targetId]?.canonicalLocationByAct[session.currentAct];
        const npcName = NPC_DISPLAY_NAMES[targetId] || targetId;

        if (npcLoc !== session.location) {
          return this.blocked(
            intent,
            session,
            `${npcName} is not here at the moment.`,
            `Watson attempted to examine ${npcName} but they are not at ${currentLoc.name}.`
          );
        }

        // NPC is present — physical/sensory examination (not dialogue)
        // The AI uses CHARACTER PROFILES + STIM for a consistent, doctor-eye description
        const what = intent.targetRaw || npcName;
        return {
          actionSuccess: true,
          actionType: 'examine',
          discoveredClueIds: [],
          aiContext: this.buildContext(intent, session, {
            success: true,
            actionDescription: `Watson examined ${what} at ${currentLoc.name}.`,
            actionResultNote:
              `SUCCESS — ORGANIC PHYSICAL EXAMINATION of ${npcName}. ` +
              `Watson is looking at ${what} — this is a sensory observation by a trained surgeon, NOT a conversation. ` +
              `Do NOT write dialogue. Use the CHARACTER PROFILES section to inform physical details (build, manner, staining, wear). ` +
              `Check SESSION OBSERVATIONS (STIM) first — if this subject is already there, reproduce it exactly. ` +
              `If not in STIM, invent one vivid 10-15 word medical/forensic observation Watson would notice, ` +
              `then return it in stimUpdate with a stable snake_case key (e.g. "holmes_coat", "abberline_hands").`,
            newClueDefs: [],
          }),
        };
      }
      // Carried copy: the object isn't here, but Watson holds its takeable
      // item (e.g. the Dear Boss clipping examined away from Baker Street).
      const carriedItem = TAKEABLE_OBJECTS[targetId];
      if (carriedItem && session.inventory.includes(carriedItem)) {
        return {
          actionSuccess: true,
          actionType: 'examine',
          discoveredClueIds: [],
          aiContext: this.buildContext(intent, session, {
            success: true,
            actionDescription: `Watson took ${carriedItem} from his bag and examined it again.`,
            actionResultNote: `SUCCESS — Watson re-reads the ${carriedItem} he carries. It is in his medical bag; narrate him producing and studying it. No new evidence emerges, but he may reflect on what it means.`,
            newClueDefs: [],
          }),
        };
      }

      const objectName = OBJECT_DISPLAY_NAMES[targetId] || intent.targetRaw;
      return this.blocked(
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
      this.triggerClues(session.location, targetId, alreadyExamined, session.discoveredClueIds);

    // Set location-level "examined" flag for act progression
    const locationFlag = currentLoc.locationExaminedFlag;
    const flagsUpdate: Record<string, boolean> = {
      [alreadyExaminedFlag]: true,
      ...(locationFlag ? { [locationFlag]: true } : {}),
    };

    const allFlags = { ...session.flags, ...flagsUpdate };
    const actCheck = this.checkActProgression(session, allFlags);

    // Inventory: add evidence notes for takeable objects (first time only)
    const inventoryAdd: string[] = [];
    if (!alreadyExamined && TAKEABLE_OBJECTS[targetId] && !session.inventory.includes(TAKEABLE_OBJECTS[targetId])) {
      inventoryAdd.push(TAKEABLE_OBJECTS[targetId]);
    }

    const objectName = OBJECT_DISPLAY_NAMES[targetId] || intent.targetRaw;

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
      aiContext: this.buildContext(intent, session, {
        success: true,
        actionDescription: `Watson examined the ${objectName} at ${currentLoc.name}.`,
        actionResultNote: newClueIds.length > 0
          ? `SUCCESS — Watson discovered ${newClueIds.length} new clue(s).`
          : alreadyExamined
          ? `SUCCESS — Watson re-examined the ${objectName}. (Previously examined — no new clues.)`
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
    const currentLoc = LOCATIONS[session.location];
    const targetId = intent.targetId;

    if (!targetId || !NPCS[targetId]) {
      return this.blocked(
        intent,
        session,
        `Watson is uncertain whom to address.`,
        `Watson attempted to speak with "${intent.targetRaw}" but could not identify this person.`
      );
    }

    // Check NPC is actually in this location
    const npcState = session.npcStates[targetId];
    const npcLoc = npcState?.currentLocation ?? NPCS[targetId]?.canonicalLocationByAct[session.currentAct];

    if (npcLoc !== session.location) {
      const npcName = NPC_DISPLAY_NAMES[targetId] || targetId;
      return this.blocked(
        intent,
        session,
        `${npcName} is not here at the moment.`,
        `Watson attempted to speak with ${npcName} but they are not at ${currentLoc.name}.`
      );
    }

    const npcName = NPC_DISPLAY_NAMES[targetId] || targetId;

    // Set interaction flag
    const interactionFlag = `talked_to_${targetId}_at_${session.location}`;
    const flagsUpdate: Record<string, boolean> = { [interactionFlag]: true };

    return {
      actionSuccess: true,
      actionType: 'talk',
      flagsUpdate,
      discoveredClueIds: [],
      aiContext: this.buildContext(intent, session, {
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
    const currentLoc = LOCATIONS[session.location];
    const targetId = intent.targetId;
    const objectName = targetId ? (OBJECT_DISPLAY_NAMES[targetId] || intent.targetRaw) : intent.targetRaw;

    if (!targetId || !currentLoc.interactables.includes(targetId)) {
      return this.blocked(
        intent,
        session,
        `Watson cannot take ${objectName || 'that'} — it is not here, or cannot be removed.`,
        `Watson attempted to take "${objectName}" but it is not available at ${currentLoc.name}.`
      );
    }

    // Check if it's a takeable object
    const inventoryItem = TAKEABLE_OBJECTS[targetId];
    if (!inventoryItem) {
      return this.blocked(
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
        aiContext: this.buildContext(intent, session, {
          success: true,
          actionDescription: `Watson checked his ${inventoryItem}.`,
          actionResultNote: `SUCCESS — Watson already has ${inventoryItem} in his possession.`,
          newClueDefs: [],
        }),
      };
    }

    const { newClueIds, newClueDefs, medicalDelta, moralDelta } =
      this.triggerClues(session.location, targetId, false, session.discoveredClueIds);

    return {
      actionSuccess: true,
      actionType: 'take',
      inventoryAdd: [inventoryItem],
      discoveredClueIds: newClueIds,
      medicalPointsDelta: medicalDelta || undefined,
      moralPointsDelta: moralDelta || undefined,
      aiContext: this.buildContext(intent, session, {
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
    const currentLoc = LOCATIONS[session.location];
    const targetId = intent.targetId;

    // ── USE X WITH Y (Infocom-style combination) ──────────────────────────────
    if (intent.useWithTargetId && targetId) {
      const combination = USE_COMBINATIONS[targetId]?.[intent.useWithTargetId]
                       ?? USE_COMBINATIONS[intent.useWithTargetId]?.[targetId];

      if (combination) {
        // Act-locked combinations (spoiler gate — e.g. the kidney cross-reference
        // grants asylum-reveal content and must not fire before Act 6).
        if (combination.requiresAct !== undefined && session.currentAct < combination.requiresAct) {
          return this.blocked(intent, session,
            `Watson sets the two side by side, but the connection between them refuses to form. Something is still missing — the comparison is premature.`,
            `USE combination blocked: ${targetId} + ${intent.useWithTargetId} requires act ${combination.requiresAct} (currently act ${session.currentAct}). Narrate Watson sensing the documents are related but lacking the context to see how. Do NOT reveal what the connection is.`
          );
        }

        // Location-locked combinations (e.g. the document convergence that must
        // happen at Baker Street, against the casefiles).
        if (combination.requiresLocation && session.location !== combination.requiresLocation) {
          const placeName = LOCATIONS[combination.requiresLocation]?.name ?? 'elsewhere';
          return this.blocked(intent, session,
            `Watson holds the two side by side, but this is not the place for careful comparison. Better done at ${placeName}, with room to think.`,
            `USE combination blocked: ${targetId} + ${intent.useWithTargetId} requires location '${combination.requiresLocation}' (currently '${session.location}'). Narrate Watson deciding to make the comparison properly at ${placeName}.`
          );
        }

        const hasItem = TAKEABLE_OBJECTS[targetId] !== undefined
          && session.inventory.includes(TAKEABLE_OBJECTS[targetId]);
        const item2InLocation = currentLoc.interactables.includes(intent.useWithTargetId);
        const item2InInventory = TAKEABLE_OBJECTS[intent.useWithTargetId] !== undefined
          && session.inventory.includes(TAKEABLE_OBJECTS[intent.useWithTargetId]);

        if (hasItem && (item2InLocation || item2InInventory)) {
          const { newClueIds, newClueDefs } = combination.clueId
            && !session.discoveredClueIds.includes(combination.clueId)
            ? { newClueIds: [combination.clueId], newClueDefs: [{ name: CLUE_DEFINITIONS[combination.clueId]?.name ?? combination.clueId, description: CLUE_DEFINITIONS[combination.clueId]?.description ?? '', holmesDeduction: CLUE_DEFINITIONS[combination.clueId]?.holmesDeduction ?? '' }] }
            : { newClueIds: [], newClueDefs: [] };

          const flagKey = `used_${targetId}_with_${intent.useWithTargetId}`;
          const allFlags = { ...session.flags, [flagKey]: true };
          const actCheck = this.checkActProgression(session, allFlags);

          return {
            actionSuccess: true,
            actionType: 'use',
            flagsUpdate: { [flagKey]: true, ...(actCheck.flagsUpdate || {}) },
            newAct: actCheck.newAct,
            discoveredClueIds: newClueIds,
            aiContext: this.buildContext(intent, session, {
              success: true,
              actionDescription: `Watson used ${OBJECT_DISPLAY_NAMES[targetId] ?? targetId} with ${OBJECT_DISPLAY_NAMES[intent.useWithTargetId] ?? intent.useWithTargetId}.`,
              actionResultNote: combination.resultNote,
              newClueDefs,
            }),
          };
        }

        // Items not accessible
        return this.blocked(intent, session,
          `Watson cannot combine those items here — one or both are not at hand.`,
          `USE combination blocked: ${targetId} + ${intent.useWithTargetId} — item(s) not in inventory or location.`
        );
      }

      // No authored combination
      return this.blocked(intent, session,
        `Watson considers it, but there is nothing useful to be learned from combining those two things.`,
        `No USE combination defined for ${targetId} + ${intent.useWithTargetId}.`
      );
    }

    // ── Standard USE at location ──────────────────────────────────────────────
    const useDesc = targetId ? USE_INTERACTIONS[session.location]?.[targetId] : undefined;

    if (useDesc && targetId) {
      // Verify the object is present (either in location or in inventory via a takeable mapping)
      const isInLocation = currentLoc.interactables.includes(targetId);
      const isInInventory =
        TAKEABLE_OBJECTS[targetId] !== undefined &&
        session.inventory.includes(TAKEABLE_OBJECTS[targetId]);

      if (isInLocation || isInInventory) {
        const objectName = OBJECT_DISPLAY_NAMES[targetId] || intent.targetRaw;
        const alreadyExaminedFlag = `examined_${session.location}_${targetId}`;
        const alreadyExamined = session.flags[alreadyExaminedFlag] === true;

        const { newClueIds, newClueDefs, medicalDelta, moralDelta } =
          this.triggerClues(session.location, targetId, alreadyExamined, session.discoveredClueIds);

        const locationFlag = currentLoc.locationExaminedFlag;
        const flagsUpdate: Record<string, boolean> = {
          [alreadyExaminedFlag]: true,
          ...(locationFlag ? { [locationFlag]: true } : {}),
        };
        const allFlags = { ...session.flags, ...flagsUpdate };
        const actCheck = this.checkActProgression(session, allFlags);

        return {
          actionSuccess: true,
          actionType: 'use',
          flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
          newAct: actCheck.newAct,
          gameOver: actCheck.gameOver,
          discoveredClueIds: newClueIds,
          medicalPointsDelta: medicalDelta || undefined,
          moralPointsDelta: moralDelta || undefined,
          aiContext: this.buildContext(intent, session, {
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
      return this.blocked(intent, session,
        `Watson is not sure what to show.`,
        `SHOW blocked: no item specified.`
      );
    }

    // Item must be in inventory
    const inventoryName = TAKEABLE_OBJECTS[targetId];
    const hasItem = inventoryName && session.inventory.includes(inventoryName);
    if (!hasItem) {
      const objectName = OBJECT_DISPLAY_NAMES[targetId] ?? intent.targetRaw ?? targetId;
      return this.blocked(intent, session,
        `Watson does not have the ${objectName} to show.`,
        `SHOW blocked: ${targetId} not in inventory.`
      );
    }

    // NPC must be present
    if (npcId) {
      const npcState   = session.npcStates[npcId];
      const npcLoc     = npcState?.currentLocation ?? NPCS[npcId]?.canonicalLocationByAct[session.currentAct];
      const npcName    = NPC_DISPLAY_NAMES[npcId] ?? npcId;

      if (npcLoc !== session.location) {
        return this.blocked(intent, session,
          `${npcName} is not here.`,
          `SHOW blocked: ${npcId} not at ${session.location}.`
        );
      }

      // Look up authored SHOW interaction
      const interaction = SHOW_INTERACTIONS[targetId]?.[npcId];
      if (interaction) {
        const { newClueIds, newClueDefs } = interaction.clueId
          && !session.discoveredClueIds.includes(interaction.clueId)
          ? { newClueIds: [interaction.clueId], newClueDefs: [{ name: CLUE_DEFINITIONS[interaction.clueId]?.name ?? '', description: CLUE_DEFINITIONS[interaction.clueId]?.description ?? '', holmesDeduction: CLUE_DEFINITIONS[interaction.clueId]?.holmesDeduction ?? '' }] }
          : { newClueIds: [], newClueDefs: [] };

        const flagKey = `showed_${targetId}_to_${npcId}`;
        return {
          actionSuccess: true,
          actionType: 'show',
          flagsUpdate: { [flagKey]: true },
          discoveredClueIds: newClueIds,
          aiContext: this.buildContext(intent, session, {
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
        aiContext: this.buildContext(intent, session, {
          success: true,
          actionDescription: `Watson showed ${inventoryName} to ${npcName}.`,
          actionResultNote: `SUCCESS — ${npcName} examines what Watson has shown. They have no specific reaction beyond polite acknowledgement.`,
          newClueDefs: [],
          targetNpcId: npcId,
        }),
      };
    }

    // No NPC specified — Watson examines the item himself
    return this.resolveExamine({ ...intent, type: 'examine' }, session);
  }

  // --------------------------------------------------------
  // READ (Infocom: READ X — shows literal document text)
  // Distinct from EXAMINE: reads words, not physical properties.
  // --------------------------------------------------------

  private resolveRead(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const targetId = intent.targetId;

    if (!targetId) {
      return this.blocked(intent, session,
        `Watson is not sure what to read.`,
        `READ blocked: no target specified.`
      );
    }

    // Check DOCUMENT_TEXT for authored literal text.
    // Act-keyed override first ("<objectId>@<act>") — lets the same document
    // read differently by act (e.g. the casefiles wall before/after Kelly).
    const docText = DOCUMENT_TEXT[`${targetId}@${session.currentAct}`] ?? DOCUMENT_TEXT[targetId];
    if (docText) {
      // Item must be in inventory OR in the current location
      const currentLoc = LOCATIONS[session.location];
      const inLocation = currentLoc.interactables.includes(targetId);
      const inInventory = TAKEABLE_OBJECTS[targetId] && session.inventory.includes(TAKEABLE_OBJECTS[targetId]);

      if (inLocation || inInventory) {
        const objectName = OBJECT_DISPLAY_NAMES[targetId] ?? intent.targetRaw ?? targetId;
        const flagKey = `read_${targetId}`;
        return {
          actionSuccess: true,
          actionType: 'read',
          flagsUpdate: { [flagKey]: true },
          discoveredClueIds: [],
          aiContext: this.buildContext(intent, session, {
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
      ? (TAKEABLE_OBJECTS[targetId] ?? OBJECT_DISPLAY_NAMES[targetId] ?? intent.targetRaw ?? targetId)
      : (intent.targetRaw ?? 'that item');

    // Find matching inventory item
    const inventoryItem = targetId
      ? session.inventory.find(i => i === TAKEABLE_OBJECTS[targetId])
      : undefined;

    if (!inventoryItem) {
      return this.blocked(intent, session,
        `Watson is not carrying ${objectName}.`,
        `DROP blocked: ${targetId ?? 'unknown'} not in inventory.`
      );
    }

    return {
      actionSuccess: true,
      actionType: 'drop',
      inventoryRemove: [inventoryItem],
      discoveredClueIds: [],
      aiContext: this.buildContext(intent, session, {
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
      aiContext: this.buildContext(intent, session, {
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
      .map(id => CLUE_DEFINITIONS[id])
      .filter(Boolean);

    const clueLines = foundClues.length > 0
      ? foundClues.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n')
      : 'No evidence formally recorded yet.';

    const remaining = Math.max(0, DEDUCTION_THRESHOLD - clueCount);
    const readinessNote = clueCount >= DEDUCTION_THRESHOLD
      ? 'Watson has sufficient evidence to attempt a deduction. Type DEDUCE followed by your theory to name a suspect.'
      : `Watson needs ${remaining} more piece${remaining === 1 ? '' : 's'} of evidence before a deduction is viable.`;

    // Persons of Interest — the suspect ledger. Entries appear once their
    // requiresFlag is set; cleared entries are annotated (struck through, in
    // Watson's hand). Edmund is never listed pre-convergence by design.
    const poiVisible = PERSONS_OF_INTEREST.filter(
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
      aiContext: this.buildContext(intent, session, {
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
    if (clueCount < DEDUCTION_THRESHOLD) {
      return {
        actionSuccess: false,
        actionType: 'deduce',
        blockedReason: `Insufficient evidence — only ${clueCount} of ${DEDUCTION_THRESHOLD} required clues discovered.`,
        discoveredClueIds: [],
        aiContext: this.buildContext(intent, session, {
          success: false,
          actionDescription: `Watson attempted to name the killer: "${intent.raw}"`,
          actionResultNote: `BLOCKED — Only ${clueCount} clues discovered. Holmes requires more evidence before committing to a theory.`,
          newClueDefs: [],
        }),
      };
    }

    // Check theory against all suspect profiles
    const matchedProfile = SUSPECT_PROFILES.find(profile =>
      profile.aliases.some(alias => theory.includes(alias))
    );

    if (matchedProfile?.isGuilty) {
      // The smoking-gun clue (the 'prasarved' misspelling in Edmund's forensic note)
      // is required to confirm the correct deduction. Without it, Watson has only
      // circumstantial evidence and Holmes will not commit to a name.
      const SMOKING_GUN_CLUE = 'clue_06_prasarved_spelling';
      if (!session.discoveredClueIds.includes(SMOKING_GUN_CLUE)) {
        return {
          actionSuccess: false,
          actionType: 'deduce',
          blockedReason: `Holmes taps his fingers together. "The connexion exists, Watson — I have seen the shadow of it. But I will not name a man without the thread that ties him to the letters. There is something we have not yet found."`,
          discoveredClueIds: [],
          aiContext: this.buildContext(intent, session, {
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
      const npcName = NPCS[matchedProfile.npcId]?.displayName ?? matchedProfile.npcId;

      return {
        actionSuccess: true,
        actionType: 'deduce',
        flagsUpdate: matchedProfile.successFlags,
        newAct: matchedProfile.successAct && session.currentAct < matchedProfile.successAct
          ? matchedProfile.successAct
          : undefined,
        gameOver: isGameOver,
        discoveredClueIds: [],
        aiContext: this.buildContext(intent, session, {
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

    // Wrong suspect — cold case ending.
    // The case goes unsolved; Watson closes his diary without a resolution.
    // A named red herring (isGuilty:false profile) gets a tailored rebuttal.
    const coldCaseNote = matchedProfile?.wrongDeductionNote ??
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
      aiContext: this.buildContext(intent, session, {
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
  // HELP
  // --------------------------------------------------------

  private resolveHelp(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = LOCATIONS[session.location];
    const clueCount = session.discoveredClueIds.length;
    return {
      actionSuccess: true,
      actionType: 'help',
      discoveredClueIds: [],
      aiContext: this.buildContext(intent, session, {
        success: true,
        actionDescription: 'Watson consulted his mental notes on how to proceed.',
        actionResultNote:
          `HELP — Remind Watson of his available actions, in character. ` +
          `Available commands: LOOK (survey surroundings), GO [place] (move to a location), ` +
          `EXAMINE [object/person] (inspect something closely), TALK TO [person] (speak with someone), ` +
          `TAKE [object] (add evidence to your bag), USE [object] (interact with something), ` +
          `INVENTORY (check your bag), NOTEBOOK (review discovered clues and case progress), ` +
          `DEDUCE / SOLVE (name the killer — requires ${DEDUCTION_THRESHOLD} clues; ` +
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
      aiContext: this.buildContext(intent, session, {
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
  // OTHER (free-text, no recognised intent)
  // --------------------------------------------------------

  private resolveOther(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = LOCATIONS[session.location];
    return {
      actionSuccess: true,
      actionType: 'other',
      discoveredClueIds: [],
      aiContext: this.buildContext(intent, session, {
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

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Look up clues triggered by examining objectId at locationId.
   * Filters out clues already discovered or suppressed by alreadyExamined.
   * Returns the clue list plus pre-calculated point deltas.
   */
  private triggerClues(
    locationId: string,
    objectId: string,
    alreadyExamined: boolean,
    discoveredClueIds: string[]
  ): { newClueIds: string[]; newClueDefs: ClueDefinition[]; medicalDelta: number; moralDelta: number } {
    const candidates = CLUE_TRIGGERS[locationId]?.[objectId] ?? [];
    const newClueIds = alreadyExamined
      ? []
      : candidates.filter(id => !discoveredClueIds.includes(id));
    const newClueDefs = newClueIds.map(id => CLUE_DEFINITIONS[id]).filter(Boolean) as ClueDefinition[];
    return {
      newClueIds,
      newClueDefs,
      medicalDelta: newClueDefs.reduce((sum, c) => sum + c.medicalPoints, 0),
      moralDelta: newClueDefs.reduce((sum, c) => sum + c.moralPoints, 0),
    };
  }

  /**
   * Build the NarrationContext that gets sent to the AI.
   * All fields are derived from verified world data — never invented.
   */
  private buildContext(
    intent: ParsedIntent,
    session: SessionSnapshot,
    outcome: {
      success: boolean;
      actionDescription: string;
      actionResultNote: string;
      newClueDefs: Array<{ name: string; description: string; holmesDeduction: string }>;
      itemsGained?: string[];         // Inventory items gained this turn (verified)
      targetLocationId?: string;      // For move actions, the destination
      targetNpcId?: string;
      newNpcUpdates?: Record<string, Partial<NPCState>>;
      isDeduction?: boolean;
      deductionCorrect?: boolean;
    }
  ): NarrationContext {
    // Use destination location for move actions, otherwise current
    const locationId = outcome.targetLocationId || session.location;
    const loc = LOCATIONS[locationId] || LOCATIONS[session.location];

    // Determine which NPCs are in this location after any movements
    const resolvedNpcStates = { ...session.npcStates };
    if (outcome.newNpcUpdates) {
      for (const [id, upd] of Object.entries(outcome.newNpcUpdates)) {
        resolvedNpcStates[id] = { ...(resolvedNpcStates[id] || { npcId: id, disposition: 50, status: 'alive' }), ...upd };
      }
    }

    const presentNPCEntries = Object.entries(NPCS)
      .filter(([npcId]) => {
        const state = resolvedNpcStates[npcId];
        const npcLoc = state?.currentLocation ?? NPCS[npcId]?.canonicalLocationByAct[session.currentAct];
        return npcLoc === locationId && state?.status !== 'deceased';
      });

    // Build alias-aware NPC list for NarrationContext
    const npcsPresent = presentNPCEntries.map(([npcId, npc]) => {
      const isIntroduced = !npc.requiresIntroduction ||
        session.introducedNpcs.includes(npcId);
      const label = isIntroduced
        ? npc.displayName
        : (npc.alias ?? NPC_ALIASES[npcId] ?? npc.displayName);
      return { label, npcId, isIntroduced };
    });

    // Legacy flat arrays kept for internal engine use (NPC memory lookup etc.)
    const npcIds = presentNPCEntries.map(([id]) => id);

    // Scripted NPC presence moments — fire when NPC present + location matches + flag satisfied.
    // These are directorial instructions injected into the AI prompt; no state changes.
    const npcScriptedLines: Array<{ npcId: string; label: string; instruction: string }> = [];
    for (const { npcId, label } of npcsPresent) {
      const npc = NPCS[npcId];
      if (!npc.scriptedLines) continue;
      for (const line of npc.scriptedLines) {
        if (line.locationId !== locationId) continue;
        if (line.triggerFlag && !session.flags[line.triggerFlag]) continue;
        if (line.act !== undefined && line.act !== session.currentAct) continue;
        npcScriptedLines.push({ npcId, label, instruction: line.instruction });
      }
    }

    // Act 5 safety net: the convergence needs the From Hell letter transcript,
    // but the Act 4 gate is the location flag — a player can reach Act 5 without
    // ever copying the letter. If so, Holmes steers Watson back to Lusk's office.
    if (session.currentAct === 5 &&
        !session.inventory.includes(TAKEABLE_OBJECTS['from_hell_letter']) &&
        npcsPresent.some(n => n.npcId === 'holmes')) {
      npcScriptedLines.push({
        npcId: 'holmes',
        label: 'Sherlock Holmes',
        instruction: 'Watson never copied the From Hell letter. Holmes notes, with mild impatience, that a comparison wants both documents — and the letter still sits in Lusk\'s office. He suggests Watson return there and take the text down word for word. Do not say what the comparison will reveal.',
      });
    }

    // Available exits (filtered by act)
    const availableExits = (loc.exits || [])
      .filter(exitId => {
        const exitLoc = LOCATIONS[exitId];
        return exitLoc && exitLoc.act <= session.currentAct;
      })
      .map(exitId => LOCATIONS[exitId]?.shortName || exitId);

    // Available objects
    const availableObjects = (loc.interactables || [])
      .map(id => OBJECT_DISPLAY_NAMES[id] || id);

    // Recent NPC memory for NPCs present (keyed by label — alias or displayName)
    const npcRecentMemory: Record<string, string[]> = {};
    for (const [npcId, state] of Object.entries(resolvedNpcStates)) {
      const entry = npcsPresent.find(n => n.npcId === npcId);
      if (entry && state.memory && state.memory.length > 0) {
        npcRecentMemory[entry.label] = state.memory.slice(0, 2);
      }
    }

    // 'full' narration: moving to a new location or looking around with no specific target.
    // 'compact' narration: examining an object, talking, taking, using, etc.
    const narrationMode: 'full' | 'compact' =
      intent.type === 'move' ||
      (intent.type === 'examine' && !intent.targetId) ||
      (intent.type === 'other' && !intent.targetId)
        ? 'full'
        : 'compact';

    // Full mode always gets a world_event blockquote.
    // Compact mode gets an inner_thought ~30% of the time — less frequent so each one lands harder.
    const blockquoteHint: NarrationContext['blockquoteHint'] =
      narrationMode === 'full'
        ? 'world_event'
        : Math.random() < 0.3 ? 'inner_thought' : 'none';

    // Dynamic Witness Interrogation — include NPC knowledge envelope for talk actions
    let targetNpcInterview: NarrationContext['targetNpcInterview'] | undefined;
    if (outcome.targetNpcId && NPCS[outcome.targetNpcId]) {
      const npc = NPCS[outcome.targetNpcId];
      const isIntroduced = !npc.requiresIntroduction ||
        session.introducedNpcs.includes(outcome.targetNpcId);
      const label = isIntroduced
        ? npc.displayName
        : (npc.alias ?? NPC_ALIASES[outcome.targetNpcId] ?? npc.displayName);
      targetNpcInterview = {
        npcId: outcome.targetNpcId,
        label,
        isIntroduced,
        role: npc.role,
        speakingStyle: npc.speakingStyle,
        personality: npc.personality,
        knowledgeEnvelope: npc.publicKnowledge,
        playerQuestion: intent.raw,
      };
    }

    // Atmospheric fallback note — used when examined object triggers no clue.
    // Act-keyed override first ("<objectId>@<act>") for act-variant descriptions.
    const atmosphericNote =
      intent.targetId && outcome.newClueDefs.length === 0
        ? (ATMOSPHERIC_NOTES[locationId]?.[`${intent.targetId}@${session.currentAct}`]
            ?? ATMOSPHERIC_NOTES[locationId]?.[intent.targetId])
        : undefined;

    // Introduction flags: talking to an NPC introduces them (if they self-introduce)
    // Document-based introductions are handled by examine (see clue_06 / edmund_forensic_note)
    const introductionFlagsUpdate: Record<string, boolean> = {};
    if (outcome.targetNpcId) {
      const npc = NPCS[outcome.targetNpcId];
      if (npc?.requiresIntroduction &&
          !session.introducedNpcs.includes(outcome.targetNpcId) &&
          outcome.targetNpcId !== 'edmund') {
        // NPC self-introduces on first TALK (everyone except Edmund)
        introductionFlagsUpdate[`npc_introduced_${outcome.targetNpcId}`] = true;
      }
    }
    // Edmund's name is revealed when the player examines his forensic note
    if (intent.targetId === 'edmund_forensic_note' &&
        !session.introducedNpcs.includes('edmund')) {
      introductionFlagsUpdate['npc_introduced_edmund'] = true;
    }

    const act = session.currentAct;

    // Compute current in-game time — anchored to the act's canonical start,
    // advanced by the minutes elapsed this act (tracked in the hook).
    const actTimeCfg   = ACT_TIME_CONFIG[act] ?? ACT_TIME_CONFIG[1];
    const totalMinutes = actTimeCfg.canonicalMinutes + session.elapsedMinutes;
    const timePeriod   = computeTimePeriod(totalMinutes);
    const timeLabel    = formatTimeLabel(totalMinutes, actTimeCfg.dayOfWeek, actTimeCfg.displayDate);

    const locationVisitCount = (session.locationVisitCounts[locationId] ?? 0) + 1;

    return {
      locationName: loc.name,
      locationAtmosphere: loc.atmosphere,
      locationDescription: loc.description,
      locationVisitCount,
      locationTimeframe: loc.timeframe ?? 'present',
      locationReconstitutionNote: loc.reconstitutionNote,
      act,
      actName: ACT_NAMES[act] || `Act ${act}`,
      timeLabel,
      timePeriod,
      weather: ACT_WEATHER[act] ?? ACT_WEATHER[1],
      npcsPresent,
      availableObjects,
      availableExits,
      inventory: session.inventory,
      watsonStats: {
        medicalPoints: session.medicalPoints,
        moralPoints: session.moralPoints,
      },
      actionType: intent.type,
      actionSuccess: outcome.success,
      actionDescription: outcome.actionDescription,
      actionResultNote: outcome.actionResultNote,
      newCluesDiscovered: outcome.newClueDefs.map(c => ({
        name: c.name,
        description: c.description,
        holmesDeduction: c.holmesDeduction,
      })),
      itemsGained: outcome.itemsGained?.length ? outcome.itemsGained : undefined,
      atmosphericNote,
      npcRecentMemory: Object.keys(npcRecentMemory).length > 0 ? npcRecentMemory : undefined,
      targetNpcInterview,
      narrationMode,
      blockquoteHint,
      npcScriptedLines: npcScriptedLines.length > 0 ? npcScriptedLines : undefined,
      // Pass introduction flags so useGameState can update introducedNpcs
      _introductionFlagsUpdate: Object.keys(introductionFlagsUpdate).length > 0
        ? introductionFlagsUpdate
        : undefined,
    } as NarrationContext & { _introductionFlagsUpdate?: Record<string, boolean> };
  }

  /**
   * Returns a blocked EngineResult with appropriate context.
   */
  private blocked(
    intent: ParsedIntent,
    session: SessionSnapshot,
    blockedReason: string,
    actionResultNote: string
  ): EngineResult {
    return {
      actionSuccess: false,
      actionType: intent.type,
      blockedReason,
      discoveredClueIds: [],
      aiContext: this.buildContext(intent, session, {
        success: false,
        actionDescription: `Watson attempted: "${intent.raw}"`,
        actionResultNote,
        newClueDefs: [],
      }),
    };
  }

  /**
   * When Watson moves, compute which NPCs follow.
   * Behaviour is driven entirely by NPCDefinition fields:
   *   followsNpcId === 'watson'  → shadow the player destination
   *   followsNpcId === <npcId>   → shadow that NPC's resolved location
   *   location_based / fixed     → snap to canonicalLocationByAct
   */
  private computeNpcMovements(
    newLocationId: string,
    session: SessionSnapshot
  ): Record<string, Partial<NPCState>> {
    const updates: Record<string, Partial<NPCState>> = {};

    // First pass: location-based and fixed NPCs (establish canonical positions).
    // An NPC with NO canonical entry for the current act is OFFSTAGE — e.g.
    // Tumblety after he flees in Act 4. The 'offstage' sentinel never matches
    // a real location id, so the NPC simply does not appear anywhere.
    for (const [npcId, npc] of Object.entries(NPCS)) {
      if (npc.followingRule === 'location_based' || npc.followingRule === 'fixed') {
        const canonical = npc.canonicalLocationByAct[session.currentAct] ?? 'offstage';
        if (canonical !== session.npcStates[npcId]?.currentLocation) {
          updates[npcId] = { currentLocation: canonical };
        }
      }
    }

    // Second pass: NPCs that shadow another entity
    for (const [npcId, npc] of Object.entries(NPCS)) {
      if (!npc.followsNpcId) continue;

      // Once an NPC stops following (e.g. Edmund committed in Act 6), it
      // reverts to its canonical location for the current act.
      if (npc.followsUntilAct !== undefined && session.currentAct > npc.followsUntilAct) {
        const canonical = npc.canonicalLocationByAct[session.currentAct];
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
          NPCS[npc.followsNpcId]?.canonicalLocationByAct[session.currentAct];
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
  private checkActProgression(
    session: SessionSnapshot,
    currentFlags: Record<string, boolean>
  ): { newAct?: number; flagsUpdate?: Record<string, boolean>; gameOver?: boolean } {
    const condition = ACT_PROGRESSION[session.currentAct];
    if (!condition) return {};

    const allMet = condition.requireFlags.every(flag => currentFlags[flag] === true);
    if (!allMet) return {};

    // All conditions met — advance act
    const advanceTo = condition.advanceTo;
    if (advanceTo <= session.currentAct) return {}; // Prevent regression

    // Advancing past the final playable act (no further progression defined)
    // concludes the game — e.g. visiting the Private Asylum in Act VI.
    const isFinalAct = !ACT_PROGRESSION[advanceTo];

    // Sync NPC locations for new act
    return {
      newAct: advanceTo,
      flagsUpdate: { [`act_${advanceTo}_started`]: true },
      gameOver: isFinalAct || undefined,
    };
  }
}

// Singleton export
export const gameEngine = new GameEngine();
