// Barrel re-export. Story data lives in engine/stories/whitechapel-1888/.
// All existing imports from this file continue to work unchanged.

export type {
  LocationDefinition,
  NPCDefinition,
  ClueDefinition,
  ActCondition,
  SuspectProfile,
} from './stories/types.js';

export {
  LOCATIONS,
  OBJECT_DISPLAY_NAMES,
} from './stories/whitechapel-1888/locations.js';

export {
  NPCS,
  NPC_DISPLAY_NAMES,
  NPC_ALIASES,
} from './stories/whitechapel-1888/npcs.js';

export {
  CLUE_DEFINITIONS,
  CLUE_TRIGGERS,
  ATMOSPHERIC_NOTES,
  TAKEABLE_OBJECTS,
  ITEM_SPENT_AFTER_ACT,
  USE_INTERACTIONS,
  SHOW_INTERACTIONS,
  USE_COMBINATIONS,
  DOCUMENT_TEXT,
  DOCUMENT_OBJECT_IDS,
} from './stories/whitechapel-1888/clues.js';
export type { ShowInteraction, UseCombination } from './stories/whitechapel-1888/clues.js';

export {
  ACT_NAMES,
  ACT_BRIDGES,
  ACT_PROGRESSION,
  ACT_ANCHORS,
  ACT_TIME_CONFIG,
  ACT_WEATHER,
  DEDUCTION_THRESHOLD,
  DEDUCTION_KEYWORDS,
  formatGameClock,
} from './stories/whitechapel-1888/acts.js';
export type { ActTimeConfig, ActWeather, WeatherCondition } from './stories/whitechapel-1888/acts.js';

export { SUSPECT_PROFILES, PERSONS_OF_INTEREST } from './stories/whitechapel-1888/suspects.js';
export type { PersonOfInterest } from './stories/whitechapel-1888/suspects.js';

export { TRUE_ENDING_CODA } from './stories/whitechapel-1888/endings.js';

export { ATMOSPHERIC_SEEDS, WHITECHAPEL_FACTS } from './stories/whitechapel-1888/atmosphere.js';

export { resolveDiaryEntry } from './stories/whitechapel-1888/diary.js';
export type { ResolvedDiaryEntry, DiaryKind } from './stories/whitechapel-1888/diary.js';
export { DECISION_DIARY, DECISION_BY_FLAG } from './stories/whitechapel-1888/diaryDecisions.js';
export type { DecisionDiaryEntry } from './stories/whitechapel-1888/diaryDecisions.js';
export { LOCATION_DIARY } from './stories/whitechapel-1888/diaryLocations.js';
export type { LocationDiaryEntry } from './stories/whitechapel-1888/diaryLocations.js';
