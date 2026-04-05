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

export const INITIAL_LOCATION = 'dorset_street';
export const INITIAL_INVENTORY = ['Medical Bag', 'Watson\'s Diary', 'Pocket Watch'];
export const INITIAL_SANITY = 100;

export const INITIAL_NPC_STATES: Record<string, any> = {
  abberline: { npcId: 'abberline', currentLocation: 'dorset_street', status: 'alive', memory: [] },
  bond: { npcId: 'bond', currentLocation: 'millers_court', status: 'alive', memory: [] },
  edmund: { npcId: 'edmund', currentLocation: 'millers_court', status: 'alive', memory: [] },
  lusk: { npcId: 'lusk', currentLocation: 'lusk_office', status: 'alive', memory: [] },
  diemschutz: { npcId: 'diemschutz', currentLocation: 'dutfields_yard', status: 'alive', memory: [] },
  holmes: { npcId: 'holmes', currentLocation: 'dorset_street', status: 'alive', memory: [] },
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
