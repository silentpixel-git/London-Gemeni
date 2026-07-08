import { EngineResult } from '../../types';
import { ParsedIntent } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { periodOf, triggerClues, checkActProgression } from './support';
import { buildNarrationContext, blocked, absentNpcBlocked } from '../narrationContext';
import { npcLocationAt } from '../presence';

// --------------------------------------------------------
// EXAMINE
// --------------------------------------------------------

export function resolveExamine(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  const targetId = intent.targetId;

  if (!targetId) {
    // General "look around" — always succeeds, no state changes
    const locationFlag = currentLoc.locationExaminedFlag;
    const flagsUpdate = locationFlag ? { [locationFlag]: true } : {};
    const actCheck = checkActProgression(story, session, { ...session.flags, ...flagsUpdate });
    return {
      actionSuccess: true,
      actionType: 'examine',
      flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
      newAct: actCheck.newAct,
      gameOver: actCheck.gameOver,
      discoveredClueIds: [],
      aiContext: buildNarrationContext(story, intent, session, {
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
    if (story.npcs[targetId]) {
      const npcLoc = npcLocationAt(story.npcs, targetId, session.currentAct, periodOf(story, session), session.npcStates);
      const npcName = story.npcDisplayNames[targetId] || targetId;

      if (npcLoc !== session.location) {
        return absentNpcBlocked(story, intent, session, targetId, 'examine');
      }

      // NPC is present — physical/sensory examination (not dialogue)
      // The AI uses CHARACTER PROFILES + STIM for a consistent, doctor-eye description
      const what = intent.targetRaw || npcName;
      return {
        actionSuccess: true,
        actionType: 'examine',
        discoveredClueIds: [],
        aiContext: buildNarrationContext(story, intent, session, {
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
    const carriedItem = story.takeableObjects[targetId];
    if (carriedItem && session.inventory.includes(carriedItem)) {
      return {
        actionSuccess: true,
        actionType: 'examine',
        discoveredClueIds: [],
        aiContext: buildNarrationContext(story, intent, session, {
          success: true,
          actionDescription: `Watson took ${carriedItem} from his bag and examined it again.`,
          actionResultNote: `SUCCESS — Watson re-reads the ${carriedItem} he carries. It is in his medical bag; narrate him producing and studying it. No new evidence emerges, but he may reflect on what it means.`,
          newClueDefs: [],
        }),
      };
    }

    const objectName = story.objectDisplayNames[targetId] || intent.targetRaw;
    return blocked(story,
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
    triggerClues(story, session.location, targetId, alreadyExamined, session.discoveredClueIds);

  // Set location-level "examined" flag for act progression
  const locationFlag = currentLoc.locationExaminedFlag;
  const flagsUpdate: Record<string, boolean> = {
    [alreadyExaminedFlag]: true,
    ...(locationFlag ? { [locationFlag]: true } : {}),
  };

  const allFlags = { ...session.flags, ...flagsUpdate };
  const actCheck = checkActProgression(story, session, allFlags);

  // Inventory: add evidence notes for takeable objects whenever Watson is at
  // the source and is not already carrying it. The inventory check is the only
  // dedup needed — gating on !alreadyExamined would strand a dropped item
  // (examined flag stays set, so re-examining could never re-add it), breaking
  // DROP's promise that "He can retrieve it if he returns".
  const inventoryAdd: string[] = [];
  if (story.takeableObjects[targetId] && !session.inventory.includes(story.takeableObjects[targetId])) {
    inventoryAdd.push(story.takeableObjects[targetId]);
  }

  const objectName = story.objectDisplayNames[targetId] || intent.targetRaw;

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
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: `Watson examined the ${objectName} at ${currentLoc.name}.`,
      actionResultNote: newClueIds.length > 0
        ? `SUCCESS — Watson discovered ${newClueIds.length} new clue(s).`
        : alreadyExamined
        ? `SUCCESS — Watson re-examined the ${objectName}. (Previously examined — no new clues.${story.takeableObjects[targetId] && session.inventory.includes(story.takeableObjects[targetId]) ? ` Watson already carries ${story.takeableObjects[targetId]} — do NOT narrate him taking or copying it again.` : ''})`
        : `SUCCESS — Watson examined the ${objectName}.`,
      newClueDefs,
      itemsGained: inventoryAdd,
    }),
  };
}

// --------------------------------------------------------
// READ (Infocom: READ X — shows literal document text)
// Distinct from EXAMINE: reads words, not physical properties.
// --------------------------------------------------------

export function resolveRead(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const targetId = intent.targetId;

  if (!targetId) {
    return blocked(story, intent, session,
      `Watson is not sure what to read.`,
      `READ blocked: no target specified.`
    );
  }

  // Check story.documentText for authored literal text.
  // Act-keyed override first ("<objectId>@<act>") — lets the same document
  // read differently by act (e.g. the casefiles wall before/after Kelly).
  const docText = story.documentText[`${targetId}@${session.currentAct}`] ?? story.documentText[targetId];
  if (docText) {
    // Item must be in inventory OR in the current location
    const currentLoc = story.locations[session.location];
    const inLocation = currentLoc.interactables.includes(targetId);
    const inInventory = story.takeableObjects[targetId] && session.inventory.includes(story.takeableObjects[targetId]);

    if (inLocation || inInventory) {
      const objectName = story.objectDisplayNames[targetId] ?? intent.targetRaw ?? targetId;
      const flagKey = `read_${targetId}`;
      return {
        actionSuccess: true,
        actionType: 'read',
        flagsUpdate: { [flagKey]: true },
        discoveredClueIds: [],
        aiContext: buildNarrationContext(story, intent, session, {
          success: true,
          actionDescription: `Watson reads the ${objectName}.`,
          actionResultNote: `SUCCESS — Watson reads the literal text of the document:\n\n${docText}\n\nNarrate Watson reading this, quoting or paraphrasing it in his voice. Note any details that stand out to a trained observer.`,
          newClueDefs: [],
        }),
      };
    }
  }

  // No authored text — fall back to examine
  return resolveExamine(story, { ...intent, type: 'examine' }, session);
}
