// Story manifest for "London Bleeds: The Whitechapel Diaries" (1888).
// Import this file to load all story data as a single composed object,
// or import individual named exports for direct access.

export { LOCATIONS, OBJECT_DISPLAY_NAMES } from './locations';
export { NPCS, NPC_DISPLAY_NAMES, NPC_ALIASES } from './npcs';
export {
  CLUE_DEFINITIONS,
  CLUE_TRIGGERS,
  ATMOSPHERIC_NOTES,
  TAKEABLE_OBJECTS,
  USE_INTERACTIONS,
  SHOW_INTERACTIONS,
  USE_COMBINATIONS,
  DOCUMENT_TEXT,
} from './clues';
export type { ShowInteraction, UseCombination } from './clues';
export {
  ACT_NAMES,
  ACT_PROGRESSION,
  ACT_ANCHORS,
  ACT_TIME_CONFIG,
  DEDUCTION_THRESHOLD,
  DEDUCTION_KEYWORDS,
} from './acts';
export type { ActTimeConfig } from './acts';
export { SUSPECT_PROFILES, PERSONS_OF_INTEREST } from './suspects';
export type { PersonOfInterest } from './suspects';
export { ATMOSPHERIC_SEEDS, WHITECHAPEL_FACTS } from './atmosphere';
