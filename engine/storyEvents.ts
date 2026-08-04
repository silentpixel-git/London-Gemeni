import type { EngineResult, NPCState, StoryEventPayload } from '../types';
import type { ParsedIntent } from './intentParser';
import { getPresentNpcIds } from './presence';
import { periodOf } from './resolvers/support';
import type { SessionSnapshot } from './session';
import { deriveKnowledgeEnvelope } from './stories/knowledge';
import type { StoryEventDefinition, StoryEventTrigger, StoryManifest } from './stories/types';
import { visibleInteractables } from './visibility';

function normalise(value: string): string {
  return value.toLowerCase().replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function phraseMatches(value: string | undefined, phrases: string[] | undefined): boolean {
  if (!phrases?.length) return false;
  const haystack = normalise(value ?? '');
  return phrases.some(phrase => {
    const needle = normalise(phrase);
    return haystack === needle || haystack.includes(needle);
  });
}

function exactPhraseMatches(value: string | undefined, phrases: string[] | undefined): boolean {
  if (!phrases?.length) return false;
  const haystack = normalise(value ?? '');
  return phrases.some(phrase => haystack === normalise(phrase));
}

function npcTarget(intent: ParsedIntent, result: EngineResult): string | undefined {
  if (intent.type === 'show') {
    return intent.showTargetNpcId ?? result.aiContext.targetNpcInterview?.npcId;
  }
  return result.aiContext.targetNpcInterview?.npcId ?? (intent.type === 'talk' ? intent.targetId : undefined);
}

function triggerMatches(
  trigger: StoryEventTrigger,
  intent: ParsedIntent,
  result: EngineResult,
  session: SessionSnapshot,
): boolean {
  if (!trigger.intentTypes.includes(result.actionType)) return false;
  if (!result.actionSuccess && !trigger.replacesBlocked) return false;
  if (trigger.locationId && session.location !== trigger.locationId) return false;
  if ((trigger.requireFlags ?? []).some(flag => session.flags[flag] !== true)) return false;
  if ((trigger.forbidFlags ?? []).some(flag => session.flags[flag] === true)) return false;

  const targetMatch = trigger.targetIds?.includes(intent.targetId ?? '') ?? false;
  const rawMatch = trigger.rawPhraseMatch === 'exact'
    ? exactPhraseMatches(intent.raw, trigger.rawPhrases)
    : phraseMatches(intent.raw, trigger.rawPhrases);
  if (trigger.targetIds?.length && trigger.rawPhrases?.length) {
    if (!targetMatch && !rawMatch) return false;
  } else {
    if (trigger.targetIds?.length && !targetMatch) return false;
    if (trigger.rawPhrases?.length && !rawMatch) return false;
  }
  if (trigger.npcIds?.length && !trigger.npcIds.includes(npcTarget(intent, result) ?? '')) return false;
  if (trigger.topicAbsent && (intent.topicRaw || result.resolvedTopicId)) return false;
  if (trigger.topicIds?.length || trigger.topicPhrases?.length) {
    const idMatch = trigger.topicIds?.includes(result.resolvedTopicId ?? '') ?? false;
    const phraseMatch = phraseMatches(intent.topicRaw ?? intent.raw, trigger.topicPhrases);
    if (!idMatch && !phraseMatch) return false;
  }
  return true;
}

function payloadOf(event: StoryEventDefinition): StoryEventPayload {
  return { id: event.id, beats: event.beats, maxWords: event.maxWords, notice: event.notice };
}

function refreshContextState(story: StoryManifest, session: SessionSnapshot, result: EngineResult): void {
  const flags = { ...session.flags, ...(result.flagsUpdate ?? {}) };
  const locationId = result.newLocation ?? session.location;
  const npcStates: Record<string, NPCState> = { ...session.npcStates };
  for (const [id, update] of Object.entries(result.npcUpdates ?? {})) {
    npcStates[id] = {
      ...(npcStates[id] ?? { npcId: id, disposition: 50, status: 'alive', memory: [] }),
      ...update,
    } as NPCState;
  }
  const presentIds = getPresentNpcIds(story.npcs, locationId, npcStates, session.currentAct,
    periodOf(story, session, result.minutesAdvanced ?? 0), flags);
  const npcsPresent = presentIds.map(npcId => {
    const npc = story.npcs[npcId];
    const introduced = !npc.requiresIntroduction || session.introducedNpcs.includes(npcId);
    return {
      npcId,
      isIntroduced: introduced,
      label: introduced ? npc.displayName : (npc.alias ?? story.npcAliases[npcId] ?? npc.displayName),
    };
  });
  const previous = session.previousNpcIds ?? result.aiContext.npcsPresent.map(n => n.npcId);
  result.aiContext.npcsPresent = npcsPresent;
  result.aiContext.npcsArrived = npcsPresent.filter(n => !previous.includes(n.npcId)).map(n => n.label);
  result.aiContext.npcsDeparted = previous.filter(id => !presentIds.includes(id))
    .map(id => story.npcs[id]?.displayName ?? id);
  result.aiContext.availableObjects = visibleInteractables(story, locationId, flags)
    .map(id => story.objectDisplayNames[id] ?? id);
  result.aiContext.inventory = [
    ...session.inventory.filter(item => !(result.inventoryRemove ?? []).includes(item)),
    ...(result.inventoryAdd ?? []),
  ];
  if (result.aiContext.targetNpcInterview) {
    result.aiContext.targetNpcInterview.knowledgeEnvelope = deriveKnowledgeEnvelope(
      story.facts, result.aiContext.targetNpcInterview.npcId, session.currentAct, flags);
  }
}

function suppressOptionalNarration(result: EngineResult): void {
  result.aiContext.vignette = undefined;
  result.aiContext.npcScriptedLines = undefined;
  result.aiContext.watsonHint = undefined;
  result.aiContext.npcApproach = undefined;
  result.aiContext.blockquoteHint = 'none';
}

/** Match one main event, then schedule any due separate follow-up. */
export function applyStoryEvents(
  story: StoryManifest,
  intent: ParsedIntent,
  session: SessionSnapshot,
  result: EngineResult,
): EngineResult {
  const event = story.storyEvents.find(candidate =>
    candidate.act === session.currentAct &&
    !session.flags[`story_event_${candidate.id}`] &&
    candidate.triggers.some(trigger => triggerMatches(trigger, intent, result, session)));

  if (event) {
    result.actionSuccess = true;
    result.blockedReason = undefined;
    result.flagsUpdate = {
      ...result.flagsUpdate,
      ...Object.fromEntries(event.setFlags.map(flag => [flag, true])),
      [`story_event_${event.id}`]: true,
    };
    result.aiContext.actionSuccess = true;
    result.aiContext.actionDescription = event.actionDescription;
    result.aiContext.actionResultNote = event.actionResultNote;
    result.aiContext.storyEvent = payloadOf(event);
  }

  const fallback = story.storyEvents.find(candidate =>
    candidate.act === session.currentAct && candidate.fallback)?.fallback;
  const mergedFlags = { ...session.flags, ...(result.flagsUpdate ?? {}) };
  const fallbackActive = fallback &&
    (!fallback.locationId || session.location === fallback.locationId) &&
    (fallback.requireFlags ?? []).every(flag => session.flags[flag] === true) &&
    (fallback.forbidFlags ?? []).every(flag => mergedFlags[flag] !== true) &&
    result.actionSuccess && fallback.eligibleIntentTypes.includes(result.actionType);

  if (fallbackActive && fallback) {
    const completed = fallback.counterFlags.filter(flag => session.flags[flag]).length;
    const nextCounter = fallback.counterFlags[completed];
    if (nextCounter) result.flagsUpdate = { ...result.flagsUpdate, [nextCounter]: true };
    if (completed + 1 === fallback.afterEligibleActions) {
      const effects = Object.fromEntries(fallback.setFlags.map(flag => [flag, true]));
      result.flagsUpdate = { ...result.flagsUpdate, ...effects, [`story_event_${fallback.id}`]: true };
      const storyEvent: StoryEventPayload = {
        id: fallback.id, beats: fallback.beats, maxWords: fallback.maxWords,
      };
      result.followUpEvent = {
        storyEvent,
        effects,
        aiContext: {
          ...result.aiContext,
          storyEvent,
          actionSuccess: true,
          actionDescription: 'Mrs Kemp explained the purpose of her visit after Watson’s second local action.',
          actionResultNote: 'FOLLOW-UP STORY EVENT — Kemp says Nell has been missing six days. This is a distinct narration after the resolved player action.',
          vignette: undefined,
          npcScriptedLines: undefined,
          watsonHint: undefined,
          npcApproach: undefined,
          blockquoteHint: 'none',
        },
      };
    }
  }

  if (event || result.followUpEvent) {
    refreshContextState(story, session, result);
    if (result.followUpEvent) {
      Object.assign(result.followUpEvent.aiContext, {
        npcsPresent: result.aiContext.npcsPresent,
        npcsArrived: result.aiContext.npcsArrived,
        npcsDeparted: result.aiContext.npcsDeparted,
        availableObjects: result.aiContext.availableObjects,
        inventory: result.aiContext.inventory,
      });
    }
    suppressOptionalNarration(result);
  }
  return result;
}
