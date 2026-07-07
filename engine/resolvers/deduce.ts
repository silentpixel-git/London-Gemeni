import { EngineResult } from '../../types';
import { ParsedIntent } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { buildNarrationContext } from '../narrationContext';

// --------------------------------------------------------
// NOTEBOOK — review discovered clues and progress
// --------------------------------------------------------

export function resolveNotebook(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const clueCount = session.discoveredClueIds.length;
  const foundClues = session.discoveredClueIds
    .map(id => story.clueDefinitions[id])
    .filter(Boolean);

  const clueLines = foundClues.length > 0
    ? foundClues.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n')
    : 'No evidence formally recorded yet.';

  const remaining = Math.max(0, story.deductionThreshold - clueCount);
  const readinessNote = clueCount >= story.deductionThreshold
    ? 'Watson has sufficient evidence to attempt a deduction. Type DEDUCE followed by your theory to name a suspect.'
    : `Watson needs ${remaining} more piece${remaining === 1 ? '' : 's'} of evidence before a deduction is viable.`;

  // Persons of Interest — the suspect ledger. Entries appear once their
  // requiresFlag is set; cleared entries are annotated (struck through, in
  // Watson's hand). Edmund is never listed pre-convergence by design.
  const poiVisible = story.personsOfInterest.filter(
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
    aiContext: buildNarrationContext(story, intent, session, {
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

export function resolveDeduce(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const theory = (intent.deductionText || intent.raw).toLowerCase();
  const clueCount = session.discoveredClueIds.length;

  // Check if player has enough clues
  if (clueCount < story.deductionThreshold) {
    // Spoiler-safe pointer: name locations (accessible this act) that still
    // hold untriggered clues — never the clue content itself.
    const uncoveredLocations = Object.entries(story.clueTriggers)
      .filter(([locId, objMap]) => {
        const loc = story.locations[locId];
        if (!loc || loc.act > session.currentAct) return false;
        return Object.values(objMap).some(clueIds =>
          clueIds.some(id => !session.discoveredClueIds.includes(id)));
      })
      .map(([locId]) => story.locations[locId].name)
      .slice(0, 2);
    const groundNote = uncoveredLocations.length > 0
      ? ` Holmes refuses the theory and — without explaining why — names ground not yet covered: ${uncoveredLocations.join(' and ')}. He says only that the evidence there has not been read, not what it contains.`
      : '';
    return {
      actionSuccess: false,
      actionType: 'deduce',
      blockedReason: `Insufficient evidence — only ${clueCount} of ${story.deductionThreshold} required clues discovered.`,
      discoveredClueIds: [],
      aiContext: buildNarrationContext(story, intent, session, {
        success: false,
        actionDescription: `Watson attempted to name the killer: "${intent.raw}"`,
        actionResultNote: `BLOCKED — Only ${clueCount} clues discovered. Holmes requires more evidence before committing to a theory.${groundNote}`,
        newClueDefs: [],
      }),
    };
  }

  // Check theory against all suspect profiles
  const matchedProfile = story.suspectProfiles.find(profile =>
    profile.aliases.some(alias => theory.includes(alias))
  );

  if (matchedProfile?.isGuilty) {
    // The smoking-gun clue (see the manifest's smokingGunClueId) must be
    // discovered before Holmes commits to a name. Without it, Watson has
    // only circumstantial evidence and Holmes will not commit to a name.
    if (!session.discoveredClueIds.includes(story.smokingGunClueId)) {
      return {
        actionSuccess: false,
        actionType: 'deduce',
        blockedReason: `Holmes taps his fingers together. "The connexion exists, Watson — I have seen the shadow of it. But I will not name a man without the thread that ties him to the letters. There is something we have not yet found."`,
        discoveredClueIds: [],
        aiContext: buildNarrationContext(story, intent, session, {
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
    const npcName = story.npcs[matchedProfile.npcId]?.displayName ?? matchedProfile.npcId;

    return {
      actionSuccess: true,
      actionType: 'deduce',
      flagsUpdate: matchedProfile.successFlags,
      newAct: matchedProfile.successAct && session.currentAct < matchedProfile.successAct
        ? matchedProfile.successAct
        : undefined,
      gameOver: isGameOver,
      discoveredClueIds: [],
      aiContext: buildNarrationContext(story, intent, session, {
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
      aiContext: buildNarrationContext(story, intent, session, {
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
    aiContext: buildNarrationContext(story, intent, session, {
      success: false,
      actionDescription: `Watson named a wrong suspect: "${intent.raw}"`,
      actionResultNote: coldCaseNote,
      newClueDefs: [],
      isDeduction: true,
      deductionCorrect: false,
    }),
  };
}
