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

import { NPCState, EngineResult, NarrationContext, IntentType } from '../types';
import { ParsedIntent } from './intentParser';
import {
  LOCATIONS,
  NPCS,
  CLUE_TRIGGERS,
  CLUE_DEFINITIONS,
  ClueDefinition,
  TAKEABLE_OBJECTS,
  ACT_PROGRESSION,
  ACT_NAMES,
  OBJECT_DISPLAY_NAMES,
  NPC_DISPLAY_NAMES,
  DEDUCTION_THRESHOLD,
  SANITY_PENALTIES,
  USE_INTERACTIONS,
  SUSPECT_PROFILES,
} from './gameData';

// ============================================================
// Current session state snapshot passed to the engine
// ============================================================

export interface SessionSnapshot {
  location: string;
  inventory: string[];
  flags: Record<string, boolean>;
  npcStates: Record<string, NPCState>;
  currentAct: number;
  sanity: number;
  medicalPoints: number;
  moralPoints: number;
  discoveredClueIds: string[];
  investigationId?: string;
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
    switch (intent.type) {
      case 'move':
        return this.resolveMove(intent, session);
      case 'examine':
        return this.resolveExamine(intent, session);
      case 'talk':
        return this.resolveTalk(intent, session);
      case 'take':
        return this.resolveTake(intent, session);
      case 'use':
        return this.resolveUse(intent, session);
      case 'inventory':
        return this.resolveInventory(intent, session);
      case 'deduce':
        return this.resolveDeduce(intent, session);
      case 'help':
        return this.resolveHelp(intent, session);
      case 'query':
        return this.resolveQuery(intent, session);
      case 'other':
      default:
        return this.resolveOther(intent, session);
    }
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

    // Apply sanity penalty on first examination of horrific scenes
    const sanityDelta = !alreadyExamined
      ? (SANITY_PENALTIES[session.location]?.[targetId] ?? 0)
      : 0;

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
      discoveredClueIds: newClueIds,
      medicalPointsDelta: medicalDelta || undefined,
      moralPointsDelta: moralDelta || undefined,
      sanityDelta: sanityDelta !== 0 ? sanityDelta : undefined,
      inventoryAdd: inventoryAdd.length > 0 ? inventoryAdd : undefined,
      aiContext: this.buildContext(intent, session, {
        success: true,
        actionDescription: `Watson examined the ${objectName} at ${currentLoc.name}.`,
        actionResultNote: newClueIds.length > 0
          ? `SUCCESS — Watson discovered ${newClueIds.length} new clue(s).${sanityDelta < 0 ? ` (Sanity cost: ${sanityDelta})` : ''}`
          : alreadyExamined
          ? `SUCCESS — Watson re-examined the ${objectName}. (Previously examined — no new clues.)`
          : `SUCCESS — Watson examined the ${objectName}.${sanityDelta < 0 ? ` (Sanity cost: ${sanityDelta} — the horror of the scene.)` : ''}`,
        newClueDefs,
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
    const npcLoc = npcState?.currentLocation || NPCS[targetId]?.canonicalLocationByAct[session.currentAct];

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
      }),
    };
  }

  // --------------------------------------------------------
  // USE
  // --------------------------------------------------------

  private resolveUse(intent: ParsedIntent, session: SessionSnapshot): EngineResult {
    const currentLoc = LOCATIONS[session.location];
    const targetId = intent.targetId;

    // Check for a specific use interaction at this location
    const useDesc = targetId ? USE_INTERACTIONS[session.location]?.[targetId] : undefined;

    if (useDesc && targetId) {
      // Verify the object is present (either in location or in inventory via a takeable mapping)
      const isInLocation = currentLoc.interactables.includes(targetId);
      // Also allow using inventory items that map back to their original object IDs
      const isInInventory = session.inventory.some(item =>
        Object.entries(TAKEABLE_OBJECTS).some(([id, name]) => id === targetId && session.inventory.includes(name))
      ) || currentLoc.interactables.includes(targetId);

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
      const isGameOver = session.flags[matchedProfile.successVisitFlag] === true;
      const npcName = NPCS[matchedProfile.npcId]?.displayName ?? matchedProfile.npcId;

      return {
        actionSuccess: true,
        actionType: 'deduce',
        flagsUpdate: matchedProfile.successFlags,
        newAct: session.currentAct < matchedProfile.successAct ? matchedProfile.successAct : undefined,
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
    return {
      actionSuccess: false,
      actionType: 'deduce',
      gameOver: true,
      flagsUpdate: { 'deduction_attempted': true, 'deduction_incorrect': true, 'cold_case': true },
      discoveredClueIds: [],
      aiContext: this.buildContext(intent, session, {
        success: false,
        actionDescription: `Watson named a wrong suspect: "${intent.raw}"`,
        actionResultNote:
          `COLD CASE — Watson's theory cannot be supported by the evidence. Holmes gently but firmly disagrees. ` +
          `The Whitechapel murders will go unsolved. Write a 150-word final diary entry: Watson reflects on the ` +
          `failure, the unanswered questions, and the shadow this case casts over London. Tone: sombre and resigned. ` +
          `End with Watson closing his diary.`,
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
          `INVENTORY (check your bag), DEDUCE / SOLVE (name the killer — requires ${DEDUCTION_THRESHOLD} clues; ` +
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
        actionDescription: `Watson considered: "${intent.raw}"`,
        actionResultNote: 'Watson reflects on the situation. No specific action was taken.',
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
    const npcsPresent = presentNPCEntries.map(([, npc]) => npc.displayName);
    const npcIds      = presentNPCEntries.map(([id]) => id);

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

    // Recent NPC memory for NPCs present
    const npcRecentMemory: Record<string, string[]> = {};
    for (const [npcId, state] of Object.entries(resolvedNpcStates)) {
      if (npcsPresent.includes(NPC_DISPLAY_NAMES[npcId]) && state.memory && state.memory.length > 0) {
        npcRecentMemory[NPC_DISPLAY_NAMES[npcId]] = state.memory.slice(0, 2);
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

    const act = session.currentAct;
    return {
      locationName: loc.name,
      locationAtmosphere: loc.atmosphere,
      locationDescription: loc.description,
      act,
      actName: ACT_NAMES[act] || `Act ${act}`,
      npcsPresent,
      npcIds,
      availableObjects,
      availableExits,
      inventory: session.inventory,
      watsonStats: {
        sanity: session.sanity,
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
      npcRecentMemory: Object.keys(npcRecentMemory).length > 0 ? npcRecentMemory : undefined,
      narrationMode,
    };
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

    // First pass: location-based and fixed NPCs (establish canonical positions)
    for (const [npcId, npc] of Object.entries(NPCS)) {
      if (npc.followingRule === 'location_based' || npc.followingRule === 'fixed') {
        const canonical = npc.canonicalLocationByAct[session.currentAct];
        if (canonical && canonical !== session.npcStates[npcId]?.currentLocation) {
          updates[npcId] = { currentLocation: canonical };
        }
      }
    }

    // Second pass: NPCs that shadow another entity
    for (const [npcId, npc] of Object.entries(NPCS)) {
      if (!npc.followsNpcId) continue;

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
  ): { newAct?: number; flagsUpdate?: Record<string, boolean> } {
    const condition = ACT_PROGRESSION[session.currentAct];
    if (!condition) return {};

    const allMet = condition.requireFlags.every(flag => currentFlags[flag] === true);
    if (!allMet) return {};

    // All conditions met — advance act
    const advanceTo = condition.advanceTo;
    if (advanceTo <= session.currentAct) return {}; // Prevent regression

    // Sync NPC locations for new act
    return {
      newAct: advanceTo,
      flagsUpdate: { [`act_${advanceTo}_started`]: true },
    };
  }
}

// Singleton export
export const gameEngine = new GameEngine();
