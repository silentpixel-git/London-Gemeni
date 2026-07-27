/**
 * Design tokens are defined as CSS custom properties in index.css
 * and mapped to Tailwind utility names in the tailwind.config block
 * in index.html. Use lb-* class names in all components.
 *
 * Color tokens: lb-bg, lb-paper, lb-primary, lb-accent, lb-muted, lb-border
 * Font tokens:  font-sans (Lato), font-serif (Playfair Display)
 */
export const THEME = {
  fonts: {
    heading: 'font-serif',
    body: 'font-sans'
  }
};

export const INITIAL_LOCATION = 'baker_street';
export const INITIAL_ACT = 0;
export const INITIAL_INVENTORY = ['Watson\'s Diary', 'Pocket Watch'];

// NPC IDs Watson already knows at investigation start (professional acquaintances).
// These are pre-populated into introducedNpcs[] so their real names show from turn 1.
// Edmund must NEVER appear here — his identity is the mystery.
export const INITIAL_INTRODUCED_NPCS: string[] = ['abberline', 'bond'];

/** Empty on start — Sidebar renders its own "Opening diary..." animation until AI fills this in. */
export const INITIAL_JOURNAL = "";

export const INITIAL_NPC_STATES: Record<string, any> = {
  // Act 0 Prologue — Holmes is at Baker Street; Abberline is at H Division (telegram contact only)
  holmes: { npcId: 'holmes', currentLocation: 'baker_street', status: 'alive', memory: [] },
  // The Act 0 caller. The Sidebar builds its "present in location" list from
  // this map, not from scheduleByAct, so an NPC omitted here is invisible in the
  // UI even while the engine correctly places her and lets Watson talk to her.
  mrs_kemp: { npcId: 'mrs_kemp', currentLocation: 'baker_street', status: 'alive', memory: [] },
  abberline: { npcId: 'abberline', currentLocation: 'h_division_station', status: 'alive', memory: [] },
  bond: { npcId: 'bond', currentLocation: 'whitechapel_mortuary', status: 'alive', memory: [] },
  edmund: { npcId: 'edmund', currentLocation: 'whitechapel_mortuary', status: 'alive', memory: [] },
  lusk: { npcId: 'lusk', currentLocation: 'lusk_office', status: 'alive', memory: [] },
  diemschutz: { npcId: 'diemschutz', currentLocation: 'dutfields_yard', status: 'alive', memory: [] },
  superintendent: { npcId: 'superintendent', currentLocation: 'private_asylum', status: 'alive', memory: [] },
  // Reweave — the loud suspects and the second medical voice. Initial locations
  // mirror their first canonical act; until that act they are simply offstage
  // (their locations are unreachable earlier, so they never appear prematurely).
  hutchinson: { npcId: 'hutchinson', currentLocation: 'dorset_street', status: 'alive', memory: [] },
  phillips: { npcId: 'phillips', currentLocation: 'whitechapel_mortuary', status: 'alive', memory: [] },
  tumblety: { npcId: 'tumblety', currentLocation: 'h_division_station', status: 'alive', memory: [] },
  pizer: { npcId: 'pizer', currentLocation: 'working_mens_club', status: 'alive', memory: [] },
  barmaid: { npcId: 'barmaid', currentLocation: 'whitechapel_pub', status: 'alive', memory: [] },
};

// NPC_DISPLAY_NAMES kept here for sidebar rendering (App.tsx doesn't import from engine/gameData)
export const NPC_DISPLAY_NAMES: Record<string, string> = {
  abberline: 'Inspector Abberline',
  bond: 'Dr. Thomas Bond',
  edmund: 'Edmund Halward',
  lusk: 'George Lusk',
  diemschutz: 'Louis Diemschutz',
  holmes: 'Sherlock Holmes',
  mrs_kemp: 'Mrs. Kemp',
  superintendent: 'Asylum Superintendent',
  hutchinson: 'George Hutchinson',
  phillips: 'Dr. George Bagster Phillips',
  tumblety: 'Francis Tumblety',
  pizer: 'John Pizer',
  barmaid: 'The Barmaid',
};

// Roman numerals for act labels (index 0 = prologue, unused as a numeral).
export const ACT_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
