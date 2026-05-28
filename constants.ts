/**
 * Design tokens are defined as CSS custom properties in index.css
 * and mapped to Tailwind utility names in the tailwind.config block
 * in index.html. Use lb-* class names in all components.
 *
 * Color tokens: lb-bg, lb-paper, lb-primary, lb-accent, lb-muted, lb-border
 * Font tokens:  font-sans (Open Sans), font-serif (Playfair Display)
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
  // Act 0 Prologue — Holmes and Watson are at Baker Street
  holmes: { npcId: 'holmes', currentLocation: 'baker_street', status: 'alive', memory: [] },
  abberline: { npcId: 'abberline', currentLocation: 'baker_street', status: 'alive', memory: [] },
  bond: { npcId: 'bond', currentLocation: 'whitechapel_mortuary', status: 'alive', memory: [] },
  edmund: { npcId: 'edmund', currentLocation: 'whitechapel_mortuary', status: 'alive', memory: [] },
  lusk: { npcId: 'lusk', currentLocation: 'lusk_office', status: 'alive', memory: [] },
  diemschutz: { npcId: 'diemschutz', currentLocation: 'dutfields_yard', status: 'alive', memory: [] },
  superintendent: { npcId: 'superintendent', currentLocation: 'private_asylum', status: 'alive', memory: [] },
};

// NPC_DISPLAY_NAMES kept here for sidebar rendering (App.tsx doesn't import from engine/gameData)
export const NPC_DISPLAY_NAMES: Record<string, string> = {
  abberline: 'Inspector Abberline',
  bond: 'Dr. Thomas Bond',
  edmund: 'Edmund Halward',
  lusk: 'George Lusk',
  diemschutz: 'Louis Diemschutz',
  holmes: 'Sherlock Holmes',
  superintendent: 'Asylum Superintendent',
};
