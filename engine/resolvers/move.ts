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

  // Check exit is valid from current location
  if (!currentLoc.exits.includes(targetId)) {
    const targetLoc = story.locations[targetId];
    const targetName = targetLoc?.name || intent.targetRaw;
    return blocked(story,
      intent,
      session,
      `There is no direct path from ${currentLoc.name} to ${targetName} from here.`,
      `Watson attempted to go to "${targetName}" but that exit is not available from ${currentLoc.name}.`
    );
  }

  // Check act gate — location requires a higher act
  const targetLoc = story.locations[targetId];
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
  const period = periodOf(story, session);
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
    npcUpdates: newNpcUpdates,
    flagsUpdate: actCheck.flagsUpdate,
    newAct: actCheck.newAct,
    gameOver: actCheck.gameOver,
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: `Watson travelled from ${currentLoc.name} to ${targetLoc.name}.`,
      actionResultNote: `SUCCESS — Watson has arrived at ${targetLoc.name}.`,
      newClueDefs: [],
      targetLocationId: targetId,
      newNpcUpdates,
    }),
  };
}
