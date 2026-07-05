// engine/stories/whitechapel-1888/manifest.ts
//
// The single composed story object for "London Bleeds: The Whitechapel
// Diaries". The engine layer consumes ONLY this (injected into GameEngine's
// constructor) — no other engine file imports whitechapel-1888 data directly.

import type { StoryManifest, CompanionDemeanor, ActSafetyNet } from '../types';
import { LOCATIONS, OBJECT_DISPLAY_NAMES } from './locations';
import { NPCS, NPC_DISPLAY_NAMES, NPC_ALIASES } from './npcs';
import {
  CLUE_DEFINITIONS,
  CLUE_TRIGGERS,
  ATMOSPHERIC_NOTES,
  TAKEABLE_OBJECTS,
  USE_INTERACTIONS,
  SHOW_INTERACTIONS,
  USE_COMBINATIONS,
  DOCUMENT_TEXT,
} from './clues';
import {
  ACT_NAMES,
  ACT_PROGRESSION,
  ACT_ANCHORS,
  ACT_TIME_CONFIG,
  ACT_WEATHER,
  DEDUCTION_THRESHOLD,
} from './acts';
import { SUSPECT_PROFILES, PERSONS_OF_INTEREST } from './suspects';
import { selectHint, OBJECTIVES } from './hints';
import { isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags } from './diaryLeads';
import { FACTS } from './facts';
import { WORLD_EVENTS } from './events';

// Holmes case-state demeanor — derived, no new state. Colors how he carries
// himself this act; injected only when he is present and not interviewed.
// First matching variant wins; the last is the catch-all.
const COMPANION_DEMEANORS: CompanionDemeanor[] = [
  {
    npcId: 'holmes',
    variants: [
      {
        when: s => s.flags['used_edmund_forensic_note_with_from_hell_letter'] === true,
        text: 'Holmes is grim and certain now — coiled, economical, already three moves ahead. The chase has replaced the puzzle.',
      },
      {
        when: s => s.discoveredClueIds.length >= 3,
        text: 'Holmes is absorbed — the abstracted intensity of a mind cross-referencing everything it sees. He answers a beat late.',
      },
      {
        when: () => true,
        text: 'Holmes is restless, irritable at the want of data — snapping at small noises, retreating into tobacco.',
      },
    ],
  },
];

// Act 5 safety net: the convergence needs the From Hell letter transcript,
// but the Act 4 gate is the location flag — a player can reach Act 5 without
// ever copying the letter. If so, Holmes steers Watson back to Lusk's office.
const ACT_SAFETY_NETS: ActSafetyNet[] = [
  {
    act: 5,
    requiresNpcPresent: 'holmes',
    when: s => !s.inventory.includes(TAKEABLE_OBJECTS['from_hell_letter']),
    instruction: 'Watson never copied the From Hell letter. Holmes notes, with mild impatience, that a comparison wants both documents — and the letter still sits in Lusk\'s office. He suggests Watson return there and take the text down word for word. Do not say what the comparison will reveal.',
  },
];

export const WHITECHAPEL_MANIFEST: StoryManifest = {
  id: 'whitechapel-1888',

  locations: LOCATIONS,
  npcs: NPCS,
  npcAliases: NPC_ALIASES,
  npcDisplayNames: NPC_DISPLAY_NAMES,
  objectDisplayNames: OBJECT_DISPLAY_NAMES,
  clueDefinitions: CLUE_DEFINITIONS,
  clueTriggers: CLUE_TRIGGERS,
  atmosphericNotes: ATMOSPHERIC_NOTES,
  takeableObjects: TAKEABLE_OBJECTS,
  useInteractions: USE_INTERACTIONS,
  showInteractions: SHOW_INTERACTIONS,
  useCombinations: USE_COMBINATIONS,
  documentText: DOCUMENT_TEXT,

  actNames: ACT_NAMES,
  actProgression: ACT_PROGRESSION,
  actAnchors: ACT_ANCHORS,
  actTimeConfig: ACT_TIME_CONFIG,
  actWeather: ACT_WEATHER,

  deductionThreshold: DEDUCTION_THRESHOLD,
  suspectProfiles: SUSPECT_PROFILES,
  personsOfInterest: PERSONS_OF_INTEREST,

  selectHint,
  hintObjectives: OBJECTIVES,
  diaryLeads: { isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags },

  facts: FACTS,

  worldEvents: WORLD_EVENTS,

  // The smoking-gun clue (the 'prasarved' misspelling in Edmund's forensic note)
  smokingGunClueId: 'clue_06_prasarved_spelling',
  convergenceFlag: 'used_edmund_forensic_note_with_from_hell_letter',
  playerNpcId: 'watson',

  companionDemeanors: COMPANION_DEMEANORS,
  actSafetyNets: ACT_SAFETY_NETS,
};
