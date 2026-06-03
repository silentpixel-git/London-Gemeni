import type { ActCondition } from '../types';

// ============================================================
// ACT TIME CONFIGURATION
// Canonical in-game clock anchor for each act.
// Acts 0   = Evening of 8 November 1888 (Baker Street vigil)
// Acts 1–3 = 9 November 1888 (Kelly's murder day)
// Acts 4–6 = 10 November 1888 (follow-up investigation day)
// Reconstruction locations use the original crime's time, not
// Watson's visit time — see locations.ts timeOfDay field.
// ============================================================

export interface ActTimeConfig {
  canonicalMinutes: number; // Minutes from midnight at act start
  dayOfWeek: string;
  displayDate: string;      // e.g. "9 November 1888"
}

export const ACT_TIME_CONFIG: Record<number, ActTimeConfig> = {
  0: { canonicalMinutes: 1200, dayOfWeek: 'Thursday', displayDate: '8 November 1888' },  // 8:00 PM  — Baker Street evening vigil
  1: { canonicalMinutes: 645,  dayOfWeek: 'Friday',   displayDate: '9 November 1888' },  // 10:45 AM — Kelly's body discovered
  2: { canonicalMinutes: 780,  dayOfWeek: 'Friday',   displayDate: '9 November 1888' },  // 1:00 PM  — afternoon review
  3: { canonicalMinutes: 1380, dayOfWeek: 'Friday',   displayDate: '9 November 1888' },  // 11:00 PM — night investigation
  4: { canonicalMinutes: 540,  dayOfWeek: 'Saturday', displayDate: '10 November 1888' }, // 9:00 AM  — next morning, the letter trail
  5: { canonicalMinutes: 840,  dayOfWeek: 'Saturday', displayDate: '10 November 1888' }, // 2:00 PM  — afternoon, Dr. Bond's office
  6: { canonicalMinutes: 990,  dayOfWeek: 'Saturday', displayDate: '10 November 1888' }, // 4:30 PM  — dusk, the confrontation
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

// Acts advance automatically when all required flags are set.
// The engine checks these after every action.
export const ACT_PROGRESSION: Record<number, ActCondition> = {
  // Prologue — Watson and Holmes at Baker Street, building the case map
  0: {
    name: 'The Baker Street Vigil',
    requireFlags: [
      'examined_baker_street_case_files_wall', // Watson reads the full case map
      'examined_baker_street_telegrams_pile',   // Watson reads Abberline's messages
      'talked_to_holmes_at_baker_street',       // Holmes briefs Watson before they leave
    ],
    advanceTo: 1,
  },
  // Act 1 — The fresh Kelly murder scene at Miller's Court
  1: {
    name: 'The Last Murder',
    requireFlags: ['examined_millers_court'],
    advanceTo: 2,
  },
  // Act 2 — Retrospective: the mortuary is mandatory (Bond's domain, Edmund present),
  // plus at least one cold crime scene reconstruction.
  2: {
    name: 'The First Victims',
    requireFlags: ['examined_whitechapel_mortuary', 'examined_bucks_row', 'examined_hanbury_street'],
    advanceTo: 3,
  },
  // Act 3 — Reconstructing the Double Event of September 30th
  3: {
    name: 'The Double Event',
    requireFlags: ['examined_dutfields_yard', 'examined_mitre_square', 'examined_working_mens_club'],
    advanceTo: 4,
  },
  // Act 4 — The From Hell letter and the kidney parcel
  4: {
    name: 'The Letter',
    requireFlags: ['examined_lusk_office'],
    advanceTo: 5,
  },
  // Act 5 — The assistant's forensic note and the smoking gun spelling
  5: {
    name: 'The Suspicion',
    requireFlags: ['examined_bond_office'],
    advanceTo: 6,
  },
  // Act 6 — The private asylum and final confrontation
  6: {
    name: 'The Confrontation',
    requireFlags: ['visited_private_asylum'],
    advanceTo: 7, // triggers game-over assessment
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
