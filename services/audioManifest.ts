/**
 * services/audioManifest.ts
 *
 * Declarative map of sound id → audio file. The AudioManager reads this; it
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

// ── Ambient beds, keyed by the sound id a Story names (Location / Act `ambience`) ──
// Only files that exist. An id with no entry is silent; the client knows no Story.
export const AMBIENT_BEDS: Record<string, string> = {
  baker_street:    `${BASE}/ambient/baker-street.mp3`,
  holiday_street:  `${BASE}/ambient/holiday-street.mp3`,
  dorset_street:   `${BASE}/ambient/dorset-street.mp3`,
  millers_court:   `${BASE}/ambient/millers-court.mp3`,
  mortuary:        `${BASE}/ambient/mortuary.mp3`,
  lusk_office:     `${BASE}/ambient/lusk-office.mp3`,
  bond_office:     `${BASE}/ambient/bond-office.mp3`,
  bucks_row:       `${BASE}/ambient/bucks-row.mp3`,
  hanbury_street:  `${BASE}/ambient/hanbury-street.mp3`,
  goulston_street: `${BASE}/ambient/goulston-street.mp3`,
};

// ── Weather layers, keyed by the sound id a WeatherState names ───────────────
// `volume` lets one file serve several intensities.
export const WEATHER_LAYERS: Record<string, { file: string; volume: number }> = {
  rain_light:   { file: `${BASE}/weather/rain.mp3`,     volume: 0.25 },
  rain_heavy:   { file: `${BASE}/weather/rain.mp3`,     volume: 0.55 },
  fog_wind:     { file: `${BASE}/weather/fog-wind.mp3`, volume: 0.30 },
  fog_wind_low: { file: `${BASE}/weather/fog-wind.mp3`, volume: 0.15 },
  // Still air is barely a bed at all, just enough not to feel muted.
  still_air:    { file: `${BASE}/weather/fog-wind.mp3`, volume: 0.08 },
};
