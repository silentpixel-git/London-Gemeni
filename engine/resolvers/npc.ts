import { EngineResult } from '../../types';
import { ParsedIntent } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { periodOf } from './support';
import { buildNarrationContext, blocked, absentNpcBlocked } from '../narrationContext';
import { npcLocationAt, getPresentNpcIds } from '../presence';
import { matchTopic } from '../stories/knowledge';
import { resolveExamine } from './examine';

// --------------------------------------------------------
// TALK
// --------------------------------------------------------

export function resolveTalk(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  let targetId = intent.targetId;

  // "ask about the graffiti" names a subject but no one. If exactly one NPC is
  // here, Watson addresses them — the same courtesy SHOW already extends.
  if (!targetId && intent.topicRaw) {
    const present = getPresentNpcIds(story.npcs, session.location, session.npcStates,
      session.currentAct, periodOf(story, session), session.flags);
    if (present.length === 1) targetId = present[0];
  }

  if (!targetId || !story.npcs[targetId]) {
    return blocked(story,
      intent,
      session,
      `Watson is uncertain whom to address.`,
      `Watson attempted to speak with "${intent.targetRaw}" but could not identify this person.`
    );
  }

  // Check NPC is actually in this location
  const npcLoc = npcLocationAt(story.npcs, targetId, session.currentAct, periodOf(story, session), session.npcStates, session.flags);

  if (npcLoc !== session.location) {
    return absentNpcBlocked(story, intent, session, targetId, 'speak with');
  }

  const npcName = story.npcDisplayNames[targetId] || targetId;

  // Set interaction flag. This records that the conversation happened and still
  // drives hints and rumor acks — but it is no longer what act progression
  // hangs on. Walking up to a witness and saying nothing in particular is not
  // an interview; the gates now want `asked_<npc>_about_<factId>` (see acts.ts).
  const interactionFlag = `talked_to_${targetId}_at_${session.location}`;
  const flagsUpdate: Record<string, boolean> = { [interactionFlag]: true };

  // Topic-scoped ask: resolve the typed subject against what this NPC can
  // actually be asked about right now — known by them, act-gate open, and
  // carrying an authored topic phrase. Deciding it here rather than in the
  // prompt keeps the engine/AI contract intact: the AI is handed the answer,
  // it does not choose one.
  const matched = intent.topicRaw
    ? matchTopic(story.facts, targetId, session.currentAct, intent.topicRaw)
    : undefined;
  if (matched) flagsUpdate[`asked_${targetId}_about_${matched.id}`] = true;

  // Talk-granted item: some NPCs hand over testimony that only exists because
  // they gave it (a witness's account) — not scenery the player could have
  // taken beforehand. Granted once, the first time the talk succeeds.
  const grantedObjectId = story.talkGrantsItem[targetId];
  const grantedItem = grantedObjectId ? story.takeableObjects[grantedObjectId] : undefined;
  const inventoryAdd = grantedItem && !session.inventory.includes(grantedItem) ? [grantedItem] : undefined;

  return {
    actionSuccess: true,
    actionType: 'talk',
    flagsUpdate,
    discoveredClueIds: [],
    inventoryAdd,
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: matched
        ? `Watson asked ${npcName} about ${matched.topics![0]} at ${currentLoc.name}. Watson said: "${intent.raw}"`
        : `Watson addressed ${npcName} at ${currentLoc.name}. Watson said: "${intent.raw}"`,
      actionResultNote: inventoryAdd
        ? `SUCCESS — Watson engaged ${npcName} in conversation. As ${npcName} speaks, Watson takes down what is said in writing — narrate him transcribing it as part of the conversation, not as a separate act of picking something up.`
        : `SUCCESS — Watson engaged ${npcName} in conversation.`,
      newClueDefs: [],
      targetNpcId: targetId,
      itemsGained: inventoryAdd,
      topicFact: matched ? { label: matched.topics![0], statement: matched.statement } : undefined,
      topicMissed: intent.topicRaw && !matched ? intent.topicRaw : undefined,
    }),
  };
}

// --------------------------------------------------------
// SHOW (Infocom: SHOW X TO Y)
// Watson presents an inventory item to an NPC.
// --------------------------------------------------------

export function resolveShow(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const targetId = intent.targetId;          // The item being shown
  const npcId    = intent.showTargetNpcId;   // The NPC receiving it

  if (!targetId) {
    return blocked(story, intent, session,
      `Watson is not sure what to show.`,
      `SHOW blocked: no item specified.`
    );
  }

  // Item must be in inventory
  const inventoryName = story.takeableObjects[targetId];
  const hasItem = inventoryName && session.inventory.includes(inventoryName);
  if (!hasItem) {
    const objectName = story.objectDisplayNames[targetId] ?? intent.targetRaw ?? targetId;
    return blocked(story, intent, session,
      `Watson does not have the ${objectName} to show.`,
      `SHOW blocked: ${targetId} not in inventory.`
    );
  }

  // NPC must be present
  if (npcId) {
    const npcLoc     = npcLocationAt(story.npcs, npcId, session.currentAct, periodOf(story, session), session.npcStates, session.flags);
    const npcName    = story.npcDisplayNames[npcId] ?? npcId;

    if (npcLoc !== session.location) {
      return absentNpcBlocked(story, intent, session, npcId, 'show something to');
    }

    // Look up authored SHOW interaction
    const interaction = story.showInteractions[targetId]?.[npcId];
    if (interaction) {
      const unmet = (interaction.requireFlags ?? []).filter(f => session.flags[f] !== true);
      if (unmet.length > 0) {
        return blocked(story, intent, session,
          interaction.blockedNote ?? `Watson holds the ${inventoryName} half-out of his pocket, then thinks better of it — not yet.`,
          `SHOW gated: ${targetId} → ${npcId} requires flags [${unmet.join(', ')}]. Narrate Watson deciding the moment is premature, without revealing what is missing.`
        );
      }

      const { newClueIds, newClueDefs } = interaction.clueId
        && !session.discoveredClueIds.includes(interaction.clueId)
        ? { newClueIds: [interaction.clueId], newClueDefs: [{ name: story.clueDefinitions[interaction.clueId]?.name ?? '', description: story.clueDefinitions[interaction.clueId]?.description ?? '', holmesDeduction: story.clueDefinitions[interaction.clueId]?.holmesDeduction ?? '' }] }
        : { newClueIds: [], newClueDefs: [] };

      const flagKey = `showed_${targetId}_to_${npcId}`;
      return {
        actionSuccess: true,
        actionType: 'show',
        flagsUpdate: { [flagKey]: true },
        discoveredClueIds: newClueIds,
        aiContext: buildNarrationContext(story, intent, session, {
          success: true,
          actionDescription: `Watson showed ${inventoryName} to ${npcName}.`,
          actionResultNote: interaction.resultNote,
          newClueDefs,
          targetNpcId: npcId,
          extraWordBudget: interaction.extraWordBudget,
        }),
      };
    }

    // No authored interaction — NPC receives it but nothing specific happens
    return {
      actionSuccess: true,
      actionType: 'show',
      discoveredClueIds: [],
      aiContext: buildNarrationContext(story, intent, session, {
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
  const presentNpcIds = getPresentNpcIds(story.npcs, session.location, session.npcStates, session.currentAct, periodOf(story, session), session.flags);
  if (presentNpcIds.length === 1) {
    return resolveShow(story, { ...intent, showTargetNpcId: presentNpcIds[0] }, session);
  }

  // Multiple/no NPCs — Watson examines the item himself
  return resolveExamine(story, { ...intent, type: 'examine' }, session);
}
