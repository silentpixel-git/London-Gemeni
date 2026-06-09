// Canonical historical facts for case-related dialogue.
// The AI uses these when NPCs speak about the investigation.
export const WHITECHAPEL_FACTS = {
  victims: [
    { name: 'Mary Ann Nichols', location: "Buck's Row", date: '31 August 1888' },
    { name: 'Annie Chapman', location: '29 Hanbury Street', date: '8 September 1888' },
    { name: 'Elizabeth Stride', location: "Dutfield's Yard", date: '30 September 1888 (interrupted)' },
    { name: 'Catherine Eddowes', location: 'Mitre Square', date: '30 September 1888 (double event, ~45 min after Stride)' },
    { name: 'Mary Jane Kelly', location: "Miller's Court", date: '9 November 1888 (killer had uninterrupted hours)' },
  ],
  forensics: {
    Chapman: 'Uterus removed; anatomical knowledge evident but not surgical mastery',
    Eddowes: 'Left kidney and uterus removed within minutes; consistent with repeated anatomical familiarity',
    Kelly: 'Most extensive injuries; fire burned through the night, providing light for the killer',
  },
  investigation: 'Over 2,000 people interviewed; Metropolitan Police (Abberline, H Division) and City Police (Eddowes scene) coordination has been problematic',
  pressureDynamics: 'The Star and Times printing speculation as fact; witnesses terrified into silence',
  fromHellLetter: {
    received: 'George Lusk, 16 October 1888',
    contents: 'Half a human kidney preserved in spirits of wine, letter beginning "From hell"',
    spelling: 'The word "prasarved" (for preserved) is idiosyncratic and consistent across the letter and other documents',
  },
};

import type { TimePeriod } from '../../../types';

// Each seed is tagged with the time periods it is valid for.
// An empty periods array means it works for any time of day.
export interface AtmosphericSeed {
  text: string;
  periods: TimePeriod[]; // empty = all periods
  requiresFog?: boolean; // only valid when the current act's weather is foggy
}

// One is chosen at random per narration call, filtered to the current time period,
// so the AI never defaults to the same micro-detail or contradicts the time of day.
export const ATMOSPHERIC_SEEDS: AtmosphericSeed[] = [
  // ── ALL PERIODS ──────────────────────────────────────────────────────────
  { text: 'A match scraping against brick somewhere unseen',                             periods: [] },
  { text: "A child's cough from behind a closed door",                                  periods: [] },
  { text: 'The distant clatter of a handcart on cobblestones',                          periods: [] },
  { text: 'The smell of boiled cabbage drifting from an upper window',                  periods: [] },
  { text: 'A woman arguing in a low, urgent voice two streets over',                    periods: [] },
  { text: 'A loose shutter banging rhythmically somewhere above',                       periods: [] },
  { text: 'Wet newspaper clinging to the base of a wall',                               periods: [] },
  { text: 'The smell of coal smoke settling low in the fog',                            periods: [], requiresFog: true },
  { text: 'A single church bell tolling the quarter-hour',                              periods: [] },
  { text: 'Footsteps on a wooden floor directly above, then silence',                   periods: [] },
  { text: 'The drip of a gutter, metronomic in the quiet',                              periods: [] },
  { text: 'Steam rising from a grate in the pavement',                                  periods: [] },
  { text: 'The creak of a sign-board swinging overhead in the wind',                    periods: [] },
  { text: 'A wheel-barrow abandoned at the kerb, one handle broken',                    periods: [] },
  { text: 'The echo of a dropped tin pail two streets away',                            periods: [] },
  { text: 'A baby crying briefly, then nothing',                                        periods: [] },

  // ── DAY ONLY (dawn / morning / afternoon) ────────────────────────────────
  { text: "Children's voices from a court, suddenly hushed",                            periods: ['dawn', 'morning', 'afternoon'] },
  { text: "The scratch of a pen behind a lighted window",                               periods: ['morning', 'afternoon'] },
  { text: 'The rustle of pigeons disturbed on a nearby roof',                           periods: ['dawn', 'morning', 'afternoon'] },
  { text: 'The distant rumble of a goods train',                                        periods: ['morning', 'afternoon'] },
  { text: 'A pigeon with a broken wing circling the lamp-post',                         periods: ['dawn', 'morning', 'afternoon'] },
  { text: 'A costermonger calling his wares two streets over',                          periods: ['morning', 'afternoon'] },
  { text: 'The clatter of milk churns being unloaded from a cart',                      periods: ['dawn', 'morning'] },

  // ── NIGHT ONLY (evening / night / lateNight) ─────────────────────────────
  { text: 'A gas lamp guttering in the wind, its flame turning blue',                   periods: ['evening', 'night', 'lateNight'] },
  { text: "The tap of a blind man's cane receding into the fog",                        periods: ['evening', 'night', 'lateNight'], requiresFog: true },
  { text: 'The distant moan of a foghorn on the Thames',                                periods: ['night', 'lateNight'], requiresFog: true },
  { text: "A drunk's muffled singing fading around a corner",                           periods: ['evening', 'night', 'lateNight'] },
  { text: "A constable's whistle, far off, answered by silence",                        periods: ['evening', 'night', 'lateNight'] },
  { text: 'The sour smell of the tannery carried on the night air',                     periods: ['night', 'lateNight'] },
  { text: 'A stray dog nosing at something in the gutter, then fleeing',                periods: ['night', 'lateNight'] },
  { text: 'A pair of boots ascending iron stairs somewhere above',                      periods: ['evening', 'night', 'lateNight'] },
  { text: 'Laughter from inside a public house — low, uncomfortable',                   periods: ['evening', 'night'] },
  { text: 'A door opening, then closing without anyone appearing',                      periods: ['evening', 'night', 'lateNight'] },
  { text: 'The flare of a match in an upstairs window, briefly illuminating a face',    periods: ['night', 'lateNight'] },
  { text: 'Broken glass crunching underfoot somewhere off to the left',                 periods: ['night', 'lateNight'] },
  { text: 'A horse snorting somewhere in the dark, unseen',                             periods: ['night', 'lateNight'] },
  { text: "The acrid smell of an extinguished tallow candle drifting past",             periods: ['evening', 'night', 'lateNight'] },
  { text: 'A figure crossing the end of the street without looking up',                 periods: ['night', 'lateNight'] },
];
