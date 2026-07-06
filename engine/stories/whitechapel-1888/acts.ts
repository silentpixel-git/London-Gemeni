import type { ActCondition, ActTimeConfig, WeatherCondition, ActWeather } from '../types';
import type { StoryFlag } from './flags';

export type { ActTimeConfig, WeatherCondition, ActWeather } from '../types';

// ============================================================
// ACT TIME CONFIGURATION
// Canonical in-game clock anchor for each act.
// REWEAVE CALENDAR — the investigation spans ~two weeks of
// November 1888 so the real suspects appear live and in
// historical order (Tumblety in custody from 7 Nov; Hutchinson's
// statement 12 Nov; Tumblety's flight mid-Nov; Warren resigned
// 8 Nov — the eve of Kelly).
// Reconstruction locations use the original crime's time, not
// Watson's visit time — see locations.ts timeOfDay field.
// ============================================================

export const ACT_TIME_CONFIG: Record<number, ActTimeConfig> = {
  0: { canonicalMinutes: 1200, dayOfWeek: 'Thursday',  displayDate: '8 November 1888' },  // 8:00 PM  — the vigil; Warren resigned today; Kelly dies tonight
  1: { canonicalMinutes: 645,  dayOfWeek: 'Friday',    displayDate: '9 November 1888' },  // 10:45 AM — Bowyer finds Kelly; the fresh murder
  2: { canonicalMinutes: 540,  dayOfWeek: 'Sunday',    displayDate: '11 November 1888' }, // 9:00 AM  — the medical world; Tumblety in custody
  3: { canonicalMinutes: 600,  dayOfWeek: 'Wednesday', displayDate: '14 November 1888' }, // 10:00 AM — the double-event reconstruction
  4: { canonicalMinutes: 660,  dayOfWeek: 'Saturday',  displayDate: '17 November 1888' }, // 11:00 AM — the letter and the kidney; Tumblety flees
  5: { canonicalMinutes: 600,  dayOfWeek: 'Tuesday',   displayDate: '20 November 1888' }, // 10:00 AM — the gather, then the Baker Street convergence
  6: { canonicalMinutes: 840,  dayOfWeek: 'Thursday',  displayDate: '22 November 1888' }, // 2:00 PM  — the rush; the asylum
};

/**
 * Format the in-game clock for a given act + minutes elapsed within it, as a
 * 12-hour label (e.g. "10:41 PM"). Shared by the sidebar clock and diary
 * timestamps so both read identically.
 */
export function formatGameClock(actNumber: number, elapsedMinutes: number): string {
  const cfg = ACT_TIME_CONFIG[actNumber] ?? ACT_TIME_CONFIG[1];
  const m = (cfg.canonicalMinutes + elapsedMinutes) % 1440;
  const h24 = Math.floor(m / 60);
  const mins = m % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

// ============================================================
// ACT WEATHER
// Canonical weather per act, anchored like the clock above.
// The 9 Nov drizzle is the real record (overnight rain into the
// Lord Mayor's Show morning); the later-November days carry the
// season's characteristic mix of damp grey and cold fog.
// Derived purely from currentAct — no persistence required.
// ============================================================

export const ACT_WEATHER: Record<number, ActWeather> = {
  0: { condition: 'clear-night', label: 'Cold, Clear',     // Thu 8 Nov, 8:00 PM  — Baker Street evening
       lateShift: { afterMinutes: 120, condition: 'foggy', label: 'Fog Rising' } },
  1: { condition: 'drizzle',     label: 'Drizzle',          // Fri 9 Nov, 10:45 AM — wet morning, body discovered
       lateShift: { afterMinutes: 150, condition: 'overcast', label: 'Grey, Clearing' } },
  2: { condition: 'overcast',    label: 'Overcast' },      // Sun 11 Nov, 9:00 AM — damp grey morning
  3: { condition: 'foggy',       label: 'Foggy',             // Wed 14 Nov, 10:00 AM — fog lingering into the day
       lateShift: { afterMinutes: 180, condition: 'overcast', label: 'Fog Lifting' } },
  4: { condition: 'clear-cold',  label: 'Cold, Clear' },   // Sat 17 Nov, 11:00 AM — crisp morning
  5: { condition: 'overcast',    label: 'Overcast' },      // Tue 20 Nov, 10:00 AM — grey morning
  6: { condition: 'foggy',       label: 'Fog Settling' },  // Thu 22 Nov, 2:00 PM — fog thickening
};

// Anchor location for each act — where Watson begins the act.
// On act advance the engine performs a hard cut (auto-move) to this location,
// carrying follows_watson / follows_bond NPCs along. Keyed by the act being ENTERED.
// (Act 0 has no anchor — the game starts at Baker Street.)
export const ACT_ANCHORS: Record<number, string> = {
  1: 'dorset_street',         // the street outside Miller's Court
  2: 'whitechapel_mortuary',  // Bond's domain
  3: 'dutfields_yard',        // the double-event reconstruction
  4: 'lusk_office',           // the letter and the kidney
  5: 'bond_office',           // the forensic records
  6: 'bond_office',           // the confrontation begins where the records were
};

export const ACT_NAMES: Record<number, string> = {
  0: 'The Baker Street Vigil',
  1: 'The Last Murder',
  2: 'The First Victims',
  3: 'The Double Event',
  4: 'The Letter',
  5: 'The Suspicion',
  6: 'The Confrontation',
};

// Authored bridge line for each act arrival — the connective tissue between the
// curtain and the scene. Days pass and the anchor changes between acts (see
// ACT_TIME_CONFIG / ACT_ANCHORS), so without this the player is dropped into a
// new place with no sense of why Watson is there. Injected as its own paragraph
// after the streamed `### ACT …` heading, mirroring the opening's fixed line.
// Authored fact, not AI prose: the reason for the journey is canonical and must
// never be hallucinated. Watson's voice, first-person past tense; no time-of-
// death claim for Kelly, no naming of the murderer. Act 0 is the opening proper
// and carries its own fixed line, so it has no bridge.
export const ACT_BRIDGES: Record<number, string> = {
  1: "Our night's vigil had availed nothing. Then, that morning, word came that the killer had struck once more — behind a locked door, this time, in Miller's Court — and a cab bore us east into Whitechapel.",
  2: "Two days I spent turning Miller's Court over in my mind. If the killer's hand could be read anywhere, it was in the wounds of those who had gone before — and so, on the Sunday, we sought out Dr. Bond.",
  3: "The mortuary had given us a method; now we wanted the ground itself. No one had properly walked the night of the double murder — two women killed within the hour, across two jurisdictions — and on the Wednesday we set out to retrace it.",
  4: "Three days on, a different thread drew us. George Lusk, of the Vigilance Committee, had received through the post a letter and a parcel that no sane man would have sent — and the time had come to see them for ourselves.",
  5: "The pieces would not sit quietly. Three days I turned them over, and each time they pointed back to the records themselves — and so, on the Tuesday, we made our way to Bond's office, where the whole grim catalogue was kept.",
  6: "Two days had passed since I had given my conclusion its name. Holmes had been silent through most of them; then, on the Thursday afternoon, he rose without a word, and I knew the waiting was over.",
};

// Acts advance automatically when all required flags are set.
// The engine checks these after every action (including talk/show).
// REWEAVE: each act's gate now includes its suspect-theory beats —
// the moving spotlight is mandatory, not optional.
export const ACT_PROGRESSION: Record<number, ActCondition<StoryFlag>> = {
  // Prologue — the vigil. Four murders so far; Kelly is still alive tonight.
  // Tutorialises EXAMINE, TALK, TAKE, and SHOW in the safety of 221B.
  0: {
    name: 'The Baker Street Vigil',
    requireFlags: [
      'examined_baker_street_case_files_wall', // the case map — four victims, the suspect landscape
      'talked_to_holmes_at_baker_street',       // Holmes's briefing — "a man no one remembers"
      'showed_newspaper_pile_to_holmes',        // the clipping — Holmes calls the letters a press hoax
      'examined_baker_street_telegrams_pile',   // Tumblety's arrest; Warren's resignation
    ],
    advanceTo: 1,
  },
  // Act 1 — "The Stranger". The fresh Kelly scene; Hutchinson's account is
  // gated (everyone meets the theory), and the act CLOSES on Bond's aftermath
  // beat — a character exhale, not a cold examine.
  1: {
    name: 'The Last Murder',
    requireFlags: [
      'talked_to_hutchinson_at_dorset_street',  // the Stranger account + his loitering admission
      'examined_millers_court_burned_clothing', // the grate — the killer's use of light
      'examined_millers_court_the_bed',         // the central horror (arms Bond's aftermath beat)
      'talked_to_bond_at_millers_court',        // the emotional capstone — the surgeon's burden
    ],
    advanceTo: 2,
  },
  // Act 2 — "The Mad Doctor". The medical world + the earliest victims, then
  // Tumblety in custody; closes on Holmes's first crack in the theory.
  2: {
    name: 'The First Victims',
    requireFlags: [
      'examined_whitechapel_mortuary',
      'talked_to_phillips_at_whitechapel_mortuary', // the second medical voice — "watched and studied, not qualified"
      'examined_bucks_row',
      'examined_hanbury_street',
      'talked_to_tumblety_at_h_division_station', // the Mad Doctor blazes
      'talked_to_holmes_at_h_division_station',   // capstone — "this man is a performance"
    ],
    advanceTo: 3,
  },
  // Act 3 — "The Foreigner". The double event + the Leather Apron panic;
  // closes on Holmes before the erased wall.
  3: {
    name: 'The Double Event',
    requireFlags: [
      'examined_dutfields_yard',
      'talked_to_pizer_at_working_mens_club',   // the scapegoat, made human
      'examined_mitre_square',
      'examined_goulston_street',               // the apron trail + the erased graffiti
      'talked_to_holmes_at_goulston_street',    // capstone — "our man is not even noticed"
    ],
    advanceTo: 4,
  },
  // Act 4 — "The Vanishing Gentleman". The letter and the kidney; Tumblety
  // flees offstage; closes on Holmes's synthesis.
  4: {
    name: 'The Letter',
    requireFlags: [
      'examined_lusk_office',
      'talked_to_abberline_at_lusk_office',     // Tumblety has fled + the Gentleman file-lead
      'talked_to_holmes_at_lusk_office',        // capstone — "the preserving hand is still here"
    ],
    advanceTo: 5,
  },
  // Act 5 — "The Quiet Man". The Act 5→6 advance is the CORRECT DEDUCTION
  // (SuspectProfile.successAct = 6), which requires clue_06 — obtainable only
  // via the Baker Street document convergence. The flag below is a sentinel
  // that is NEVER set: it keeps the flag-gate permanently closed (an empty
  // requireFlags would auto-advance, since [].every() === true) while keeping
  // this entry present (its absence would make entering Act 5 read as the
  // final act and fire gameOver — checkActProgression's isFinalAct check).
  5: {
    name: 'The Suspicion',
    requireFlags: ['__advance_via_correct_deduction_only__'],
    advanceTo: 6,
  },

  // Act 6 — The confrontation. The asylum, the "eye for light", and the
  // extraction in writing. Both beats are mandatory; completing them ends
  // the game (endingType 'true_ending' → the scripted coda).
  6: {
    name: 'The Confrontation',
    requireFlags: [
      'visited_private_asylum',                 // the patient records — the extraction, documented
      'talked_to_edmund_at_private_asylum',     // "I have always had an eye for light."
    ],
    advanceTo: 7, // triggers game-over assessment
  },
};

// Minimum clues required for a successful deduction attempt.
// Set to 4 (not 5) to provide one clue of slack — the critical path yields 5+,
// so a player who misses one non-mandatory examine can still reach a conclusion.
export const DEDUCTION_THRESHOLD = 4;

// Keywords that suggest a deduction attempt
export const DEDUCTION_KEYWORDS = [
  'deduce', 'solve', 'theory', 'killer is', 'murderer is',
  'i believe', 'i think it was', 'my conclusion', 'the answer is',
  'it must be', 'suspect is', 'culprit',
];
