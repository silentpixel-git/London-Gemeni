export type SfxEvent = 'clue' | 'item' | 'actChange' | 'newLocation' | 'gameOver';

const A = '/audio/ambient/';
const W = '/audio/weather/';
const S = '/audio/sfx/';

export const AMBIENT_MAP: Record<string, string> = {
  baker_street:       `${A}fireplace.mp3`,
  dorset_street:      `${A}busy-street.mp3`,
  millers_court:      `${A}crowd-murmur.mp3`,
  whitechapel_mortuary: `${A}dripping-echo.mp3`,
  whitechapel_pub:    `${A}tavern.mp3`,
  h_division_station: `${A}office.mp3`,
  bucks_row:          `${A}dark-alley.mp3`,
  hanbury_street:     `${A}dark-alley.mp3`,
  dutfields_yard:     `${A}dark-alley.mp3`,
  mitre_square:       `${A}dark-alley.mp3`,
  goulston_street:    `${A}dark-alley.mp3`,
  lusk_office:        `${A}quiet-office.mp3`,
  bond_office:        `${A}quiet-office.mp3`,
  private_asylum:     `${A}asylum.mp3`,
  working_mens_club:  `${A}low-conversation.mp3`,
};

export const WEATHER_MAP: Record<string, string> = {
  drizzle:  `${W}rain.mp3`,
  pouring:  `${W}rain.mp3`,
  foggy:    `${W}wind.mp3`,
};

export const SFX_MAP: Record<SfxEvent, string> = {
  clue:        `${S}paper-rustle.mp3`,
  item:        `${S}pickup.mp3`,
  actChange:   `${S}clock-chime.mp3`,
  newLocation: `${S}footsteps-door.mp3`,
  gameOver:    `${S}dramatic-sting.mp3`,
};
