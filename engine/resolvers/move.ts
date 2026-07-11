import { EngineResult } from '../../types';
import { ParsedIntent } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { periodOf, triggerClues, checkActProgression, computeNpcMovements } from './support';
import { buildNarrationContext, blocked } from '../narrationContext';
import { npcLocationAt } from '../presence';
import { nextOpenPeriod } from '../time';

// --------------------------------------------------------
// MOVE
// --------------------------------------------------------

const CAB_ID = 'hansom_cab';
const CAB_COST_LOCAL = 15;   // minutes, same district
const CAB_COST_CROSS = 40;   // minutes, cross-district (also the no-boarding-point fallback)

function cabCost(story: StoryManifest, fromId: string | undefined, toId: string): number {
  const from = fromId ? story.locations[fromId]?.district : undefined;
  const to = story.locations[toId]?.district;
  return from && to && from === to ? CAB_COST_LOCAL : CAB_COST_CROSS;
}

export function resolveMove(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  const targetId = intent.targetId;

  if (!targetId) {
    return blocked(story,
      intent,
      session,
      `Watson cannot determine where to go. The fog of Whitechapel obscures that path.`,
      `Watson attempted to move but could not identify a destination: "${intent.targetRaw}".`
    );
  }

  const targetLoc = story.locations[targetId];
  const isAdjacent = currentLoc.exits.includes(targetId);
  const inCab = currentLoc.id === CAB_ID;
  const canHailHere = currentLoc.exits.includes(CAB_ID);
  const boardingCab = targetId === CAB_ID;
  // A ride = leaving the cab for a destination, or a named non-adjacent,
  // present-day destination from a street with a cab stand.
  // NOTE — the two disjuncts are deliberately asymmetric: the from-street hailing
  // branch requires !isAdjacent && canHailHere && present-day, but once Watson is
  // already `inCab` any destination in hansom_cab.exits is ridable, with none of
  // those guards (including the timeframe check). That's only safe today because
  // hansom_cab.exits happens to list every present-day location and no
  // 'reconstruction'-timeframe ones. If a future edit adds a reconstruction
  // location to hansom_cab.exits (or removes one it currently relies on being
  // absent), this branch will let Watson ride there without the present-day
  // check the hailing branch enforces — curate hansom_cab.exits accordingly,
  // or add an explicit timeframe guard here to match.
  const isCabRide = !!targetLoc && !boardingCab && targetId !== session.location &&
    (inCab || (!isAdjacent && canHailHere && (targetLoc.timeframe ?? 'present') === 'present'));

  if (!targetLoc || (!isAdjacent && !isCabRide)) {
    const targetName = targetLoc?.name || intent.targetRaw;
    return blocked(story, intent, session,
      `There is no direct path from ${currentLoc.name} to ${targetName} from here.`,
      `Watson attempted to go to "${targetName}" but that exit is not available from ${currentLoc.name}.`);
  }

  const rideOrigin = inCab ? session.cabBoardedFrom : session.location;
  const rideMinutes = isCabRide ? cabCost(story, rideOrigin, targetId) : 0;

  // Check act gate — location requires a higher act
  if (targetLoc.act > session.currentAct) {
    return blocked(story,
      intent,
      session,
      `Holmes places a hand on Watson's arm. "Not yet, Watson. There is more to understand before we pursue that thread."`,
      `Watson attempted to travel to ${targetLoc.name} but it is not yet accessible (requires Act ${targetLoc.act}, currently Act ${session.currentAct}).`
    );
  }

  // Check flag gate — some locations open only after a specific milestone
  // (e.g. the asylum requires a correct deduction first).
  if (targetLoc.requiresFlag && session.flags[targetLoc.requiresFlag] !== true) {
    return blocked(story,
      intent,
      session,
      `Holmes shakes his head. "We cannot present ourselves there without a name, Watson. We must be certain first."`,
      `Watson attempted to travel to ${targetLoc.name} but it requires a correct deduction first (flag '${targetLoc.requiresFlag}' not set).`
    );
  }

  // Opening hours (Phase 4a) — arriving outside openPeriods is a locked
  // door, never a dead end: the note says when it opens and where the
  // keyholder is, and WAIT gets Watson in.
  const period = periodOf(story, session, rideMinutes);
  if (targetLoc.openPeriods && !targetLoc.openPeriods.includes(period)) {
    const reopens = nextOpenPeriod(targetLoc.openPeriods, period);
    const keyholderId = targetLoc.lockedNote?.keyholderNpcId;
    let keyholderNote = '';
    if (keyholderId) {
      const kh = story.npcs[keyholderId];
      const introduced = !kh?.requiresIntroduction || session.introducedNpcs.includes(keyholderId);
      const label = introduced ? (story.npcDisplayNames[keyholderId] ?? keyholderId) : (kh?.alias ?? 'the keeper');
      const whereId = npcLocationAt(story.npcs, keyholderId, session.currentAct, period, session.npcStates);
      const where = story.locations[whereId];
      if (where && whereId !== targetId) keyholderNote = ` ${label} is presently at ${where.name}.`;
    }
    if (isCabRide) {
      return blocked(story, intent, session,
        `The driver shakes his head. "${targetLoc.name}'ll be shut by the time we're there, sir."`,
        `BLOCKED — the cab driver refuses the fare: ${targetLoc.name} will be closed (${period}) on arrival. ` +
        (reopens ? `It opens come ${reopens}.` : '') + keyholderNote +
        ` Convey this as the driver's word from his perch — Watson has NOT travelled and no time has passed. ` +
        `He may wait, or name another destination.`);
    }
    return blocked(story,
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
  const newNpcUpdates = computeNpcMovements(story, targetId, session);
  const actCheck = checkActProgression(story, { ...session, location: targetId }, session.flags);

  return {
    actionSuccess: true,
    actionType: 'move',
    newLocation: targetId,
    minutesAdvanced: isCabRide ? rideMinutes : undefined,
    cabBoardedFromUpdate: boardingCab ? session.location : (inCab || isCabRide) ? null : undefined,
    npcUpdates: newNpcUpdates,
    flagsUpdate: actCheck.flagsUpdate,
    newAct: actCheck.newAct,
    gameOver: actCheck.gameOver,
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: isCabRide
        ? `Watson took a hansom cab from ${story.locations[rideOrigin ?? session.location]?.name ?? 'the street'} to ${targetLoc.name} (about ${rideMinutes} minutes through the London streets).`
        : `Watson travelled from ${currentLoc.name} to ${targetLoc.name}.`,
      actionResultNote: isCabRide
        ? `SUCCESS — Watson has arrived at ${targetLoc.name} by hansom cab. Mention the ride briefly (a sentence — streets sliding past, the fare paid) before the arrival proper.`
        : `SUCCESS — Watson has arrived at ${targetLoc.name}.`,
      newClueDefs: [],
      targetLocationId: targetId,
      newNpcUpdates,
      extraMinutes: isCabRide ? rideMinutes : undefined,
    }),
  };
}
