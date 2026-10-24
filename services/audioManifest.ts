/**
 * services/audioManifest.ts
 *
 * Declarative map of game state → audio file. The AudioManager reads this; it
 * holds no logic. Files live under /public/audio and are user-supplied — a
 * missing entry simply means "silent here", never an error.
 *
 * See docs/audio-prompts.md for the generation brief behind each file.
 */

const BASE = '/audio';

// ── One-shot sound effects ──────────────────────────────────────────────────
export type SfxId =
  | 'clue-discovered' | 'item-pickup' | 'act-bell'
  // From the Act 0 prototype (owner-picked ElevenLabs takes):
  | 'lamplighter' | 'glass-down' | 'pages-riffle';

export const SFX_FILES: Record<SfxId, string> = {
  'clue-discovered': `${BASE}/sfx/clue-discovered.mp3`, // soft violin pluck (Holmes plays violin)
  'item-pickup':     `${BASE}/sfx/item-pickup.mp3`,     // paper / cloth rustle
  'act-bell':        `${BASE}/sfx/act-bell.mp3`,        // distant church bell
  'lamplighter':     `${BASE}/sfx/lamplighter.wav`,     // lamplighter's pole and ladder in the street, heard through the window
  // Wager beats — registered now, fired once The Wager is implemented:
  'glass-down':      `${BASE}/sfx/glass-down.mp3`,      // Holmes sets the opera glass on the mantel
  'pages-riffle':    `${BASE}/sfx/pages-riffle.mp3`,    // Watson opens the monograph (the losing branch)
};

/** Per-file trim for takes mastered louder than the rest (1 = as is). */
export const SFX_TRIM: Partial<Record<SfxId, number>> = {
  lamplighter: 0.8,
};

// ── Per-location ambient beds ────────────────────────────────────────────────
// All 15 locations are mapped; a file that isn't present yet is silently skipped.
export const AMBIENT_BEDS: Record<string, string> = {
  baker_street:         `${BASE}/ambient/baker-street.mp3`,
  dorset_street:        `${BASE}/ambient/dorset-street.mp3`,
  millers_court:        `${BASE}/ambient/millers-court.mp3`,
  whitechapel_mortuary: `${BASE}/ambient/mortuary.mp3`,
  h_division_station:   `${BASE}/ambient/h-division.mp3`,
  whitechapel_pub:      `${BASE}/ambient/ten-bells.mp3`,
  lusk_office:          `${BASE}/ambient/lusk-office.mp3`,
  bond_office:          `${BASE}/ambient/bond-office.mp3`,
  private_asylum:       `${BASE}/ambient/private-asylum.mp3`,
  bucks_row:            `${BASE}/ambient/bucks-row.mp3`,
  hanbury_street:       `${BASE}/ambient/hanbury-street.mp3`,
  dutfields_yard:       `${BASE}/ambient/dutfields-yard.mp3`,
  working_mens_club:    `${BASE}/ambient/working-mens-club.mp3`,
  mitre_square:         `${BASE}/ambient/mitre-square.mp3`,
  goulston_street:      `${BASE}/ambient/goulston-street.mp3`,
};

// Act-scoped beds, keyed "act:location", checked before AMBIENT_BEDS. Baker
// Street on the bank-holiday evening of the Prologue is the holiday crowd
// through the open windows, not the later acts' November street.
export const ACT_BEDS: Record<string, string> = {
  '0:baker_street': `${BASE}/ambient/holiday-street.mp3`,
};

// ── Weather layers, keyed by WeatherCondition string ─────────────────────────
// `volume` lets one rain bed serve both drizzle and a heavier downpour.
export const WEATHER_LAYERS: Record<string, { file: string; volume: number }> = {
  drizzle:  { file: `${BASE}/weather/rain.mp3`,     volume: 0.25 },
  pouring:  { file: `${BASE}/weather/rain.mp3`,     volume: 0.55 },
  foggy:    { file: `${BASE}/weather/fog-wind.mp3`, volume: 0.30 },
  overcast: { file: `${BASE}/weather/fog-wind.mp3`, volume: 0.15 },
  // 'close' is still air — barely a bed at all, just enough not to feel muted.
  close:    { file: `${BASE}/weather/fog-wind.mp3`, volume: 0.08 },
  // 'clear-warm' gets no layer: a warm clear night is carried by the location
  // ambience alone, and a wind bed would contradict it.
};
