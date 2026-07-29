import { EngineResult } from '../../types';
import { ParsedIntent } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { triggerClues, checkActProgression } from './support';
import { buildNarrationContext, blocked } from '../narrationContext';
import { resolveExamine } from './examine';
import { visibleInteractables } from '../visibility';

// --------------------------------------------------------
// TAKE
// --------------------------------------------------------

export function resolveTake(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  const targetId = intent.targetId;
  const objectName = targetId ? (story.objectDisplayNames[targetId] || intent.targetRaw) : intent.targetRaw;

  if (!targetId || !visibleInteractables(story, session.location, session.flags).includes(targetId)) {
    return blocked(story,
      intent,
      session,
      `Watson cannot take ${objectName || 'that'} — it is not here, or cannot be removed.`,
      `Watson attempted to take "${objectName}" but it is not available at ${currentLoc.name}.`
    );
  }

  // Flag-gated takeable: the object exists here but is not yet Watson's to take.
  const gateFlag = story.takeableRequiresFlag[targetId];
  if (gateFlag && session.flags[gateFlag] !== true) {
    return blocked(story,
      intent,
      session,
      `Watson considers the ${objectName}, but there is nothing yet for him to set down — something must come first.`,
      `TAKE blocked: "${targetId}" is gated on flag "${gateFlag}" which is not yet set. Narrate Watson recognising the moment is premature, without naming any game mechanism.`
    );
  }

  // Check if it's a takeable object
  const inventoryItem = story.takeableObjects[targetId];
  if (!inventoryItem) {
    return blocked(story,
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
      aiContext: buildNarrationContext(story, intent, session, {
        success: true,
        actionDescription: `Watson checked his ${inventoryItem}.`,
        actionResultNote: `SUCCESS — Watson already has ${inventoryItem} in his possession.`,
        newClueDefs: [],
      }),
    };
  }

  const { newClueIds, newClueDefs, medicalDelta, moralDelta } =
    triggerClues(story, session.location, targetId, false, session.discoveredClueIds);

  const tookFlag = `took_${session.location}_${targetId}`;
  const flagsUpdate: Record<string, boolean> = { [tookFlag]: true };
  const actCheck = checkActProgression(story, session, { ...session.flags, ...flagsUpdate });

  return {
    actionSuccess: true,
    actionType: 'take',
    inventoryAdd: [inventoryItem],
    flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
    newAct: actCheck.newAct,
    gameOver: actCheck.gameOver,
    discoveredClueIds: newClueIds,
    medicalPointsDelta: medicalDelta || undefined,
    moralPointsDelta: moralDelta || undefined,
    aiContext: buildNarrationContext(story, intent, session, {
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

export function resolveUse(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  const targetId = intent.targetId;

  // ── USE X WITH Y (Infocom-style combination) ──────────────────────────────
  if (intent.useWithTargetId && targetId) {
    // The authored orientation decides the flag key, whichever way the player
    // phrased it — "use letter with note" must set the same flag as
    // "use note with letter", or flag-gated content downstream never sees it.
    const forward = story.useCombinations[targetId]?.[intent.useWithTargetId];
    const reverse = story.useCombinations[intent.useWithTargetId]?.[targetId];
    const combination = forward ?? reverse;
    const [authoredA, authoredB] = forward
      ? [targetId, intent.useWithTargetId]
      : [intent.useWithTargetId, targetId];

    if (combination) {
      // Act-locked combinations (spoiler gate — e.g. the kidney cross-reference
      // grants asylum-reveal content and must not fire before Act 6).
      if (combination.requiresAct !== undefined && session.currentAct < combination.requiresAct) {
        return blocked(story, intent, session,
          `Watson sets the two side by side, but the connection between them refuses to form. Something is still missing — the comparison is premature.`,
          `USE combination blocked: ${targetId} + ${intent.useWithTargetId} requires act ${combination.requiresAct} (currently act ${session.currentAct}). Narrate Watson sensing the documents are related but lacking the context to see how. Do NOT reveal what the connection is.`
        );
      }

      // Location-locked combinations (e.g. the document convergence that must
      // happen at Baker Street, against the casefiles).
      if (combination.requiresLocation && session.location !== combination.requiresLocation) {
        const placeName = story.locations[combination.requiresLocation]?.name ?? 'elsewhere';
        return blocked(story, intent, session,
          `Watson holds the two side by side, but this is not the place for careful comparison. Better done at ${placeName}, with room to think.`,
          `USE combination blocked: ${targetId} + ${intent.useWithTargetId} requires location '${combination.requiresLocation}' (currently '${session.location}'). Narrate Watson deciding to make the comparison properly at ${placeName}.`
        );
      }

      // Symmetric accessibility: each side may be in inventory (via its
      // takeable mapping) or present in the room; at least one side must be
      // a held item (Watson brings something TO something).
      const inInventory = (id: string) =>
        story.takeableObjects[id] !== undefined && session.inventory.includes(story.takeableObjects[id]);
      const visible = visibleInteractables(story, session.location, session.flags);
      const inLocation = (id: string) => visible.includes(id);
      const accessible = (id: string) => inInventory(id) || inLocation(id);

      if (accessible(targetId) && accessible(intent.useWithTargetId)
          && (inInventory(targetId) || inInventory(intent.useWithTargetId))) {
        const { newClueIds, newClueDefs } = combination.clueId
          && !session.discoveredClueIds.includes(combination.clueId)
          ? { newClueIds: [combination.clueId], newClueDefs: [{ name: story.clueDefinitions[combination.clueId]?.name ?? combination.clueId, description: story.clueDefinitions[combination.clueId]?.description ?? '', holmesDeduction: story.clueDefinitions[combination.clueId]?.holmesDeduction ?? '' }] }
          : { newClueIds: [], newClueDefs: [] };

        const flagKey = `used_${authoredA}_with_${authoredB}`;
        const allFlags = { ...session.flags, [flagKey]: true };
        const actCheck = checkActProgression(story, session, allFlags);

        return {
          actionSuccess: true,
          actionType: 'use',
          flagsUpdate: { [flagKey]: true, ...(actCheck.flagsUpdate || {}) },
          newAct: actCheck.newAct,
          discoveredClueIds: newClueIds,
          aiContext: buildNarrationContext(story, intent, session, {
            success: true,
            actionDescription: `Watson used ${story.objectDisplayNames[targetId] ?? targetId} with ${story.objectDisplayNames[intent.useWithTargetId] ?? intent.useWithTargetId}.`,
            actionResultNote: combination.resultNote,
            newClueDefs,
          }),
        };
      }

      // Items not accessible
      return blocked(story, intent, session,
        `Watson cannot combine those items here — one or both are not at hand.`,
        `USE combination blocked: ${targetId} + ${intent.useWithTargetId} — item(s) not in inventory or location.`
      );
    }

    // No authored combination
    return blocked(story, intent, session,
      `Watson considers it, but there is nothing useful to be learned from combining those two things.`,
      `No USE combination defined for ${targetId} + ${intent.useWithTargetId}.`
    );
  }

  // ── Standard USE at location ──────────────────────────────────────────────
  const useDesc = targetId ? story.useInteractions[session.location]?.[targetId] : undefined;

  if (useDesc && targetId) {
    // Verify the object is present (either in location or in inventory via a takeable mapping)
    const isInLocation = visibleInteractables(story, session.location, session.flags).includes(targetId);
    const isInInventory =
      story.takeableObjects[targetId] !== undefined &&
      session.inventory.includes(story.takeableObjects[targetId]);

    if (isInLocation || isInInventory) {
      const objectName = story.objectDisplayNames[targetId] || intent.targetRaw;
      const alreadyExaminedFlag = `examined_${session.location}_${targetId}`;
      const alreadyExamined = session.flags[alreadyExaminedFlag] === true;

      const { newClueIds, newClueDefs, medicalDelta, moralDelta } =
        triggerClues(story, session.location, targetId, alreadyExamined, session.discoveredClueIds);

      const locationFlag = currentLoc.locationExaminedFlag;
      const flagsUpdate: Record<string, boolean> = {
        [alreadyExaminedFlag]: true,
        ...(locationFlag ? { [locationFlag]: true } : {}),
      };
      const allFlags = { ...session.flags, ...flagsUpdate };
      const actCheck = checkActProgression(story, session, allFlags);

      return {
        actionSuccess: true,
        actionType: 'use',
        flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
        newAct: actCheck.newAct,
        gameOver: actCheck.gameOver,
        discoveredClueIds: newClueIds,
        medicalPointsDelta: medicalDelta || undefined,
        moralPointsDelta: moralDelta || undefined,
        aiContext: buildNarrationContext(story, intent, session, {
          success: true,
          actionDescription: `Watson used/interacted with the ${objectName} at ${currentLoc.name}.`,
          actionResultNote: `SUCCESS — ${useDesc}`,
          newClueDefs,
        }),
      };
    }
  }

  // No specific use interaction — fall back to examine
  return resolveExamine(story, { ...intent, type: 'examine' }, session);
}

// --------------------------------------------------------
// DROP
// Watson leaves an inventory item at the current location.
// --------------------------------------------------------

export function resolveDrop(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const targetId = intent.targetId;
  const objectName = targetId
    ? (story.takeableObjects[targetId] ?? story.objectDisplayNames[targetId] ?? intent.targetRaw ?? targetId)
    : (intent.targetRaw ?? 'that item');

  // Find matching inventory item
  const inventoryItem = targetId
    ? session.inventory.find(i => i === story.takeableObjects[targetId])
    : undefined;

  if (!inventoryItem) {
    return blocked(story, intent, session,
      `Watson is not carrying ${objectName}.`,
      `DROP blocked: ${targetId ?? 'unknown'} not in inventory.`
    );
  }

  return {
    actionSuccess: true,
    actionType: 'drop',
    inventoryRemove: [inventoryItem],
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
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

export function resolveInventory(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  return {
    actionSuccess: true,
    actionType: 'inventory',
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: 'Watson checked the contents of his medical bag.',
      actionResultNote: `SUCCESS — Inventory: ${session.inventory.join(', ')}.`,
      newClueDefs: [],
    }),
  };
}
