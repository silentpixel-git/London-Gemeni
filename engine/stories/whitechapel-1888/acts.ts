import type { ActCondition } from '../types';

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
