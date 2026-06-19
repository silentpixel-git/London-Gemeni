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
export type SfxId = 'clue-discovered' | 'item-pickup' | 'act-bell';

export const SFX_FILES: Record<SfxId, string> = {
  'clue-discovered': `${BASE}/sfx/clue-discovered.mp3`, // soft violin pluck (Holmes plays violin)
  'item-pickup':     `${BASE}/sfx/item-pickup.mp3`,     // paper / cloth rustle
  'act-bell':        `${BASE}/sfx/act-bell.mp3`,        // distant church bell
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

// ── Weather layers, keyed by WeatherCondition string ─────────────────────────
// `volume` lets one rain bed serve both drizzle and a heavier downpour.
export const WEATHER_LAYERS: Record<string, { file: string; volume: number }> = {
  drizzle:  { file: `${BASE}/weather/rain.mp3`,     volume: 0.25 },
  pouring:  { file: `${BASE}/weather/rain.mp3`,     volume: 0.55 },
  foggy:    { file: `${BASE}/weather/fog-wind.mp3`, volume: 0.30 },
  overcast: { file: `${BASE}/weather/fog-wind.mp3`, volume: 0.15 },
};
