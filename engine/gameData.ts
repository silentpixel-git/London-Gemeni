// Barrel re-export. Story data lives in engine/stories/whitechapel-1888/.
// All existing imports from this file continue to work unchanged.

export type {
  LocationDefinition,
  NPCDefinition,
  ClueDefinition,
  ActCondition,
  SuspectProfile,
} from './stories/types';

export {
  LOCATIONS,
  OBJECT_DISPLAY_NAMES,
} from './stories/whitechapel-1888/locations';

export {
  NPCS,
  NPC_DISPLAY_NAMES,
  NPC_ALIASES,
} from './stories/whitechapel-1888/npcs';

export {
  CLUE_DEFINITIONS,
  CLUE_TRIGGERS,
  ATMOSPHERIC_NOTES,
  TAKEABLE_OBJECTS,
  USE_INTERACTIONS,
  SHOW_INTERACTIONS,
  USE_COMBINATIONS,
  DOCUMENT_TEXT,
} from './stories/whitechapel-1888/clues';
export type { ShowInteraction, UseCombination } from './stories/whitechapel-1888/clues';

export {
  ACT_NAMES,
  ACT_PROGRESSION,
  ACT_ANCHORS,
  ACT_TIME_CONFIG,
  ACT_WEATHER,
  DEDUCTION_THRESHOLD,
  DEDUCTION_KEYWORDS,
} from './stories/whitechapel-1888/acts';
export type { ActTimeConfig, ActWeather, WeatherCondition } from './stories/whitechapel-1888/acts';

export { SUSPECT_PROFILES, PERSONS_OF_INTEREST } from './stories/whitechapel-1888/suspects';
export type { PersonOfInterest } from './stories/whitechapel-1888/suspects';

export { ATMOSPHERIC_SEEDS, WHITECHAPEL_FACTS } from './stories/whitechapel-1888/atmosphere';
