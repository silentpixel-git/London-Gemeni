import { EngineResult } from '../../types';
import { ParsedIntent } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { checkActProgression } from './support';
import { buildNarrationContext, blocked } from '../narrationContext';
import { visibleInteractables } from '../visibility';

/**
 * OPEN — reveals a container's contents.
 *
 * Openability is a lookup against story.containerContents rather than a
 * hardcoded check, so a locked container later becomes a new branch here plus
 * a real UNLOCK verb, not a rewrite.
 */
export function resolveOpen(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  const targetId = intent.targetId;
  const objectName = targetId ? (story.objectDisplayNames[targetId] || intent.targetRaw) : intent.targetRaw;

  if (!targetId || !visibleInteractables(story, session.location, session.flags).includes(targetId)) {
    return blocked(story, intent, session,
      `Watson looks for ${objectName || 'it'}, and finds nothing of the kind to hand.`,
      `OPEN blocked: "${objectName}" is not present at ${currentLoc.name}. Watson should briefly note he cannot find it, then let the moment pass. Do not invent an object.`
    );
  }

  const contents = story.containerContents[targetId];
  if (!contents || contents.length === 0) {
    return blocked(story, intent, session,
      `The ${objectName} does not open, or has nothing in it worth the opening.`,
      `OPEN blocked: "${targetId}" is not a container. Watson should turn it over, find no lid or nothing inside, and set it down. One sentence. Do not name any game mechanism.`
    );
  }

  const openFlag = `opened_${session.location}_${targetId}`;
  const alreadyOpen = session.flags[openFlag] === true;

  const flagsUpdate: Record<string, boolean> = { [openFlag]: true };
  const actCheck = checkActProgression(story, session, { ...session.flags, ...flagsUpdate });

  const revealed = contents.map(id => story.objectDisplayNames[id] ?? id).join(', ');

  // A container's FIRST opening can be a moment in its own right — an
  // intrusion into someone's private property, not just a lid coming off a
  // box — rather than scenery that happens to hold things. Authored per
  // container (story.containerOpenNotes), never on the re-open.
  const openNote = !alreadyOpen ? story.containerOpenNotes?.[targetId] : undefined;

  return {
    actionSuccess: true,
    actionType: 'open',
    flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
    newAct: actCheck.newAct,
    gameOver: actCheck.gameOver,
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: `Watson opened the ${objectName}.`,
      actionResultNote: alreadyOpen
        ? `SUCCESS — the ${objectName} is already open. Inside: ${revealed}. Watson looks again at what is already before him; no new discovery. One sentence.`
        : `SUCCESS — the ${objectName} is now open. Inside: ${revealed}. Describe only these contents and nothing else.${openNote ? ` ${openNote}` : ''}`,
      newClueDefs: [],
    }),
  };
}
