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
} from './stories/whitechapel-1888/clues';

export {
  ACT_NAMES,
  ACT_PROGRESSION,
  ACT_TIME_CONFIG,
  DEDUCTION_THRESHOLD,
  DEDUCTION_KEYWORDS,
} from './stories/whitechapel-1888/acts';
export type { ActTimeConfig } from './stories/whitechapel-1888/acts';

export { SUSPECT_PROFILES } from './stories/whitechapel-1888/suspects';

export { ATMOSPHERIC_SEEDS, WHITECHAPEL_FACTS } from './stories/whitechapel-1888/atmosphere';
