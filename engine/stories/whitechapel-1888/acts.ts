import type { ActCondition } from '../types';

// ============================================================
// ACT TIME CONFIGURATION
// Canonical in-game clock anchor for each act.
// Acts 1–3 = 9 November 1888 (Kelly's murder day)
// Acts 4–6 = 10 November 1888 (follow-up investigation day)
// ============================================================

export interface ActTimeConfig {
  canonicalMinutes: number; // Minutes from midnight at act start
  dayOfWeek: string;
  displayDate: string;      // e.g. "9 November 1888"
}

export const ACT_TIME_CONFIG: Record<number, ActTimeConfig> = {
  1: { canonicalMinutes: 645,  dayOfWeek: 'Wednesday', displayDate: '9 November 1888' },  // 10:45 AM — Kelly's body discovered
  2: { canonicalMinutes: 780,  dayOfWeek: 'Wednesday', displayDate: '9 November 1888' },  // 1:00 PM  — afternoon review of earlier crime scenes
  3: { canonicalMinutes: 1380, dayOfWeek: 'Wednesday', displayDate: '9 November 1888' },  // 11:00 PM — night investigation; double event was at midnight
  4: { canonicalMinutes: 540,  dayOfWeek: 'Thursday',  displayDate: '10 November 1888' }, // 9:00 AM  — next morning, the letter trail
  5: { canonicalMinutes: 840,  dayOfWeek: 'Thursday',  displayDate: '10 November 1888' }, // 2:00 PM  — afternoon, Dr. Bond's office
  6: { canonicalMinutes: 990,  dayOfWeek: 'Thursday',  displayDate: '10 November 1888' }, // 4:30 PM  — dusk, the confrontation
};

export const ACT_NAMES: Record<number, string> = {
  1: 'The Last Murder',
  2: 'Reconstructing the Murders',
  3: 'The Double Event',
  4: 'The Letter',
  5: 'The Suspicion',
  6: 'The Confrontation',
};

// Acts advance automatically when all required flags are set.
// The engine checks these after every action.
export const ACT_PROGRESSION: Record<number, ActCondition> = {
  1: {
    name: 'The Last Murder',
    requireFlags: ['examined_millers_court'],
    advanceTo: 2,
  },
  2: {
    name: 'Reconstructing the Murders',
    requireFlags: ['examined_bucks_row', 'examined_hanbury_street'],
    advanceTo: 3,
  },
  3: {
    name: 'The Double Event',
    requireFlags: ['examined_dutfields_yard', 'examined_mitre_square'],
    advanceTo: 4,
  },
  4: {
    name: 'The Letter',
    requireFlags: ['examined_lusk_office'],
    advanceTo: 5,
  },
  5: {
    name: 'The Suspicion',
    requireFlags: ['examined_bond_office'],
    advanceTo: 6,
  },
  6: {
    name: 'The Confrontation',
    requireFlags: ['visited_private_asylum'],
    advanceTo: 7, // triggers game over assessment
  },
};

// Minimum clues required for a successful deduction attempt
export const DEDUCTION_THRESHOLD = 5;

// Keywords that suggest a deduction attempt
export const DEDUCTION_KEYWORDS = [
  'deduce', 'solve', 'theory', 'killer is', 'murderer is',
  'i believe', 'i think it was', 'my conclusion', 'the answer is',
  'it must be', 'suspect is', 'culprit',
];
