import { EngineResult } from '../../types';
import { ParsedIntent } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { buildNarrationContext } from '../narrationContext';
import { computeTimePeriod, minutesToNextPeriodBoundary, resolveActDay } from '../time';

// --------------------------------------------------------
// WAIT (Phase 4a: advances the clock to the next time period)
// --------------------------------------------------------

export function resolveWait(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const cfg = story.actTimeConfig[session.currentAct] ?? story.actTimeConfig[1];
  const total = resolveActDay(cfg, session.flags).canonicalMinutes + session.elapsedMinutes;
  const from = computeTimePeriod(total);
  const minutesAdvanced = minutesToNextPeriodBoundary(total);
  const to = computeTimePeriod(total + minutesAdvanced);
  const hours = Math.round((minutesAdvanced / 60) * 10) / 10;

  return {
    actionSuccess: true,
    actionType: 'wait',
    minutesAdvanced,
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: `Watson deliberately waited at ${story.locations[session.location].name} as ${from} gave way to ${to}.`,
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

export function resolveHelp(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  const clueCount = session.discoveredClueIds.length;
  return {
    actionSuccess: true,
    actionType: 'help',
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: 'Watson consulted his mental notes on how to proceed.',
      actionResultNote:
        `HELP — Remind Watson of his available actions, in character. ` +
        `Available commands: LOOK (survey surroundings), GO [place] (move to a location), ` +
        `EXAMINE [object/person] (inspect something closely), TALK TO [person] (speak with someone), ` +
        `TAKE [object] (add evidence to your bag), USE [object] (interact with something), ` +
        `INVENTORY (check your bag), NOTEBOOK (review discovered clues and case progress), ` +
        `DEDUCE / SOLVE (name the killer — requires ${story.deductionThreshold} clues; ` +
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

export function resolveQuery(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  return {
    actionSuccess: true,
    actionType: 'query',
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
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

export function resolveUnresolvedTarget(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  const availableObjects = currentLoc.interactables
    .map(id => story.objectDisplayNames[id] ?? id)
    .join(', ');
  return {
    actionSuccess: false,
    actionType: 'unresolved_target',
    blockedReason: `Watson could not find "${intent.targetRaw}" to examine.`,
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
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

export function resolveOther(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  return {
    actionSuccess: true,
    actionType: 'other',
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
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
