import { EngineResult } from '../../types';
import { ParsedIntent, KEEP_PHRASES } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { buildNarrationContext, blocked } from '../narrationContext';
import { computeTimePeriod, minutesToNextPeriodBoundary, resolveActDay } from '../time';
import { visibleInteractables } from '../visibility';
import { periodOf } from './support';
import { getPresentNpcIds } from '../presence';

// --------------------------------------------------------
// WAIT (Phase 4a: advances the clock to the next time period)
// --------------------------------------------------------

export function resolveWait(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const cfg = story.actTimeConfig[session.currentAct] ?? story.actTimeConfig[1];
  const total = resolveActDay(cfg, session.flags).canonicalMinutes + session.elapsedMinutes;
  const from = computeTimePeriod(total);
  const minutesAdvanced = minutesToNextPeriodBoundary(total);

  // The calendar only moves when the story moves it (see ActTimeConfig.days:
  // "advance is FLAG-DRIVEN, never clock-driven"). WAIT jumping to the next
  // period boundary can cross midnight on its own — two WAITs from Act 0's
  // 8:30 PM start reached 5 AM the next day, past the historical hour of the
  // first murder, silently breaking the act's premise that nothing has
  // happened yet. Refuse in character rather than let the clock drift.
  if (total + minutesAdvanced > 1439) {
    return blocked(story, intent, session,
      `It is late enough. Watson does not care to let the rest of the night go by simply sitting.`,
      `WAIT blocked: waiting would carry the clock past midnight into the next calendar day, which only an authored act transition may do. Narrate Watson deciding against idling the night away — restlessness, an ache in an old wound, anything in character — never a system refusal.`
    );
  }

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
        `TAKE [object] (add evidence to your bag), OPEN [container] (look inside something), USE [object] (interact with something), ` +
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
  const availableObjects = visibleInteractables(story, session.location, session.flags)
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

  // Act-0-specific: the "keep the card" / "say nothing" branch of the act's one
  // consequential choice. Only live once Holmes has done the reconstruction —
  // otherwise there's no address yet to withhold — and only with Mrs. Kemp
  // actually in the room to withhold it from.
  if (
    session.currentAct === 0 &&
    session.flags['showed_charity_card_to_holmes'] === true &&
    intent.targetRaw !== undefined &&
    KEEP_PHRASES.includes(intent.targetRaw)
  ) {
    const presentNpcIds = getPresentNpcIds(story.npcs, session.location, session.npcStates,
      session.currentAct, periodOf(story, session), session.flags);
    if (presentNpcIds.includes('mrs_kemp')) {
      return {
        actionSuccess: true,
        actionType: 'other',
        flagsUpdate: { withheld_address: true },
        discoveredClueIds: [],
        aiContext: buildNarrationContext(story, intent, session, {
          success: true,
          actionDescription: 'Watson chose to say nothing and kept the card in his pocket.',
          actionResultNote:
            'SUCCESS — Watson says nothing. The card stays in his pocket. Mrs. Kemp waits a moment longer, then understands, and does not ask again.',
          newClueDefs: [],
        }),
      };
    }
  }

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
