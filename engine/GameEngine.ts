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
import { resolveMove } from './resolvers/move';
import { resolveExamine, resolveRead } from './resolvers/examine';
import { resolveTalk, resolveShow } from './resolvers/npc';

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
      case 'take':      result = this.resolveTake(intent, session); break;
      case 'use':       result = this.resolveUse(intent, session); break;
      case 'show':      result = resolveShow(this.story, intent, session); break;
      case 'read':      result = resolveRead(this.story, intent, session); break;
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
    return resolveExamine(this.story, { ...intent, type: 'examine' }, session);
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
