import type { HintTarget, HintVerb } from '../../../types';
import { LOCATIONS } from './locations';
import { NPCS } from './npcs';

/** Narrow, read-only slice of session state the selector needs. */
export interface HintState {
  currentAct: number;
  location: string;
  flags: Record<string, boolean>;
  inventory: string[];
  npcStates: Record<string, { currentLocation?: string; status?: string }>;
  /** Visit count per location id. Used to decide whether Watson may know a
   *  location's contents (a hint must not name objects he has never seen). */
  locationVisitCounts: Record<string, number>;
}

export interface HintObjective {
  id: string;
  act: number;
  locationId: string;
  verb: HintVerb;
  /** Neutral, player-facing noun phrase. MUST NOT reveal clue content. */
  subject: string;
  /** The exact ACT_PROGRESSION gate flag this objective's `done` tracks, when
   *  it maps 1:1 onto one (most do). Absent for prerequisite-only steps (e.g.
   *  examining the newspaper pile before it can be shown) and for objectives
   *  whose `done` isn't a single-flag check (Act 5's inventory-based steps). */
  flag?: string;
  done: (s: HintState) => boolean;
  available: (s: HintState) => boolean;
}

// ── Inventory display names (must match TAKEABLE_OBJECTS values in clues.ts) ──
const CLIPPING = 'Newspaper Clipping (the "Dear Boss" letter)';
const FROM_HELL = 'From Hell Letter (transcript)';
const FORENSIC_NOTE = "Assistant's Forensic Note (copy)";

// ── Predicate helpers ────────────────────────────────────────────────────────
function flag(s: HintState, name: string): boolean {
  return s.flags[name] === true;
}
function hasItem(s: HintState, displayName: string): boolean {
  return s.inventory.includes(displayName);
}
function locationReachable(s: HintState, locId: string): boolean {
  const loc = LOCATIONS[locId] as any;
  if (!loc) return false;
  if ((loc.act ?? 0) > s.currentAct) return false;
  if (loc.requiresFlag && !flag(s, loc.requiresFlag)) return false;
  return true;
}
function npcAt(s: HintState, npcId: string, locId: string): boolean {
  const st = s.npcStates[npcId];
  const loc = st?.currentLocation ?? (NPCS[npcId] as any)?.canonicalLocationByAct?.[s.currentAct];
  return loc === locId && st?.status !== 'deceased';
}
/** A talk/show step is available only if its location is reachable AND the NPC is there. */
function npcStep(s: HintState, locId: string, npcId: string): boolean {
  return locationReachable(s, locId) && npcAt(s, npcId, locId);
}

// ── The objective table — one entry per ACT_PROGRESSION gate flag, plus the
//    prerequisite steps that unlock show/use gates. Subjects stay neutral. ──────
export const OBJECTIVES: HintObjective[] = [
  // ----- Act 0: The Baker Street Vigil -----
  { id: 'a0_casewall', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: "Holmes's case-files wall and the four victims pinned upon it",
    flag: 'examined_baker_street_case_files_wall',
    done: s => flag(s, 'examined_baker_street_case_files_wall'),
    available: s => locationReachable(s, 'baker_street') },
  { id: 'a0_holmes', act: 0, locationId: 'baker_street', verb: 'talk',
    subject: 'Holmes himself, for his reading of the case',
    flag: 'talked_to_holmes_at_baker_street',
    done: s => flag(s, 'talked_to_holmes_at_baker_street'),
    available: s => npcStep(s, 'baker_street', 'holmes') },
  { id: 'a0_newspile_examine', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the newspapers Holmes keeps piled by his chair',
    done: s => hasItem(s, CLIPPING) || flag(s, 'examined_baker_street_newspaper_pile'),
    available: s => locationReachable(s, 'baker_street') },
  { id: 'a0_newspile_show', act: 0, locationId: 'baker_street', verb: 'show',
    subject: "the 'Dear Boss' clipping — Holmes may make something of it",
    flag: 'showed_newspaper_pile_to_holmes',
    done: s => flag(s, 'showed_newspaper_pile_to_holmes'),
    available: s => hasItem(s, CLIPPING) && npcStep(s, 'baker_street', 'holmes') },
  { id: 'a0_telegrams', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: "Abberline's telegrams stacked on the side table",
    flag: 'examined_baker_street_telegrams_pile',
    done: s => flag(s, 'examined_baker_street_telegrams_pile'),
    available: s => locationReachable(s, 'baker_street') },

  // ----- Act 1: The Last Murder -----
  { id: 'a1_hutchinson', act: 1, locationId: 'dorset_street', verb: 'talk',
    subject: 'the witness Hutchinson, lingering near the court',
    flag: 'talked_to_hutchinson_at_dorset_street',
    done: s => flag(s, 'talked_to_hutchinson_at_dorset_street'),
    available: s => npcStep(s, 'dorset_street', 'hutchinson') },
  { id: 'a1_clothing', act: 1, locationId: 'millers_court', verb: 'examine',
    subject: 'the burned clothing left in the grate',
    flag: 'examined_millers_court_burned_clothing',
    done: s => flag(s, 'examined_millers_court_burned_clothing'),
    available: s => locationReachable(s, 'millers_court') },
  { id: 'a1_bed', act: 1, locationId: 'millers_court', verb: 'examine',
    subject: 'the bed, and what was left upon it',
    flag: 'examined_millers_court_the_bed',
    done: s => flag(s, 'examined_millers_court_the_bed'),
    available: s => locationReachable(s, 'millers_court') },
  { id: 'a1_bond', act: 1, locationId: 'millers_court', verb: 'talk',
    subject: 'Dr. Bond, who has not yet spoken his mind',
    flag: 'talked_to_bond_at_millers_court',
    done: s => flag(s, 'talked_to_bond_at_millers_court'),
    available: s => npcStep(s, 'millers_court', 'bond') },

  // ----- Act 2: The First Victims -----
  { id: 'a2_mortuary', act: 2, locationId: 'whitechapel_mortuary', verb: 'examine',
    subject: "Dr. Bond's autopsy ledger at the mortuary",
    flag: 'examined_whitechapel_mortuary',
    done: s => flag(s, 'examined_whitechapel_mortuary'),
    available: s => locationReachable(s, 'whitechapel_mortuary') },
  { id: 'a2_phillips', act: 2, locationId: 'whitechapel_mortuary', verb: 'talk',
    subject: 'Dr. Phillips, the divisional surgeon, who examined the earliest victims himself',
    flag: 'talked_to_phillips_at_whitechapel_mortuary',
    done: s => flag(s, 'talked_to_phillips_at_whitechapel_mortuary'),
    available: s => npcStep(s, 'whitechapel_mortuary', 'phillips') },
  { id: 'a2_bucks', act: 2, locationId: 'bucks_row', verb: 'examine',
    subject: 'the spot on Buck’s Row where the earliest body lay',
    flag: 'examined_bucks_row',
    done: s => flag(s, 'examined_bucks_row'),
    available: s => locationReachable(s, 'bucks_row') },
  { id: 'a2_hanbury', act: 2, locationId: 'hanbury_street', verb: 'examine',
    subject: 'the yard at Hanbury Street',
    flag: 'examined_hanbury_street',
    done: s => flag(s, 'examined_hanbury_street'),
    available: s => locationReachable(s, 'hanbury_street') },
  { id: 'a2_tumblety', act: 2, locationId: 'h_division_station', verb: 'talk',
    subject: 'the American doctor held at the station',
    flag: 'talked_to_tumblety_at_h_division_station',
    done: s => flag(s, 'talked_to_tumblety_at_h_division_station'),
    available: s => npcStep(s, 'h_division_station', 'tumblety') },
  { id: 'a2_holmes', act: 2, locationId: 'h_division_station', verb: 'talk',
    subject: 'Holmes, on what he makes of the man in custody',
    flag: 'talked_to_holmes_at_h_division_station',
    done: s => flag(s, 'talked_to_holmes_at_h_division_station'),
    available: s => npcStep(s, 'h_division_station', 'holmes') },

  // ----- Act 3: The Double Event -----
  { id: 'a3_dutfields', act: 3, locationId: 'dutfields_yard', verb: 'examine',
    subject: "Dutfield's Yard, where the night's first body was found",
    flag: 'examined_dutfields_yard',
    done: s => flag(s, 'examined_dutfields_yard'),
    available: s => locationReachable(s, 'dutfields_yard') },
  { id: 'a3_pizer', act: 3, locationId: 'working_mens_club', verb: 'talk',
    subject: "Pizer, the man the mob named 'Leather Apron'",
    flag: 'talked_to_pizer_at_working_mens_club',
    done: s => flag(s, 'talked_to_pizer_at_working_mens_club'),
    available: s => npcStep(s, 'working_mens_club', 'pizer') },
  { id: 'a3_mitre', act: 3, locationId: 'mitre_square', verb: 'examine',
    subject: 'the corner of Mitre Square',
    flag: 'examined_mitre_square',
    done: s => flag(s, 'examined_mitre_square'),
    available: s => locationReachable(s, 'mitre_square') },
  { id: 'a3_goulston', act: 3, locationId: 'goulston_street', verb: 'examine',
    subject: 'the doorway on Goulston Street and the chalked wall',
    flag: 'examined_goulston_street',
    done: s => flag(s, 'examined_goulston_street'),
    available: s => locationReachable(s, 'goulston_street') },
  { id: 'a3_holmes', act: 3, locationId: 'goulston_street', verb: 'talk',
    subject: 'Holmes, before the erased writing',
    flag: 'talked_to_holmes_at_goulston_street',
    done: s => flag(s, 'talked_to_holmes_at_goulston_street'),
    available: s => npcStep(s, 'goulston_street', 'holmes') },

  // ----- Act 4: The Letter -----
  { id: 'a4_lusk', act: 4, locationId: 'lusk_office', verb: 'examine',
    subject: 'the parcel and the letter sent to Mr. Lusk',
    flag: 'examined_lusk_office',
    done: s => flag(s, 'examined_lusk_office'),
    available: s => locationReachable(s, 'lusk_office') },
  { id: 'a4_abberline', act: 4, locationId: 'lusk_office', verb: 'talk',
    subject: 'Inspector Abberline, on where the trail now leads',
    flag: 'talked_to_abberline_at_lusk_office',
    done: s => flag(s, 'talked_to_abberline_at_lusk_office'),
    available: s => npcStep(s, 'lusk_office', 'abberline') },
  { id: 'a4_holmes', act: 4, locationId: 'lusk_office', verb: 'talk',
    subject: 'Holmes, for his reading of the letter',
    flag: 'talked_to_holmes_at_lusk_office',
    done: s => flag(s, 'talked_to_holmes_at_lusk_office'),
    available: s => npcStep(s, 'lusk_office', 'holmes') },

  // ----- Act 5: The Suspicion (no flag gate — convergence then deduction) -----
  { id: 'a5_letter', act: 5, locationId: 'lusk_office', verb: 'examine',
    subject: 'the From Hell letter, so its transcript is to hand',
    done: s => hasItem(s, FROM_HELL),
    available: s => locationReachable(s, 'lusk_office') },
  { id: 'a5_note', act: 5, locationId: 'bond_office', verb: 'examine',
    subject: "the assistant's cataloguing note among Bond's records",
    done: s => hasItem(s, FORENSIC_NOTE),
    available: s => locationReachable(s, 'bond_office') },
  { id: 'a5_convergence', act: 5, locationId: 'baker_street', verb: 'use',
    subject: 'the note and the letter, set side by side at Baker Street',
    done: s => flag(s, 'used_edmund_forensic_note_with_from_hell_letter'),
    available: s => hasItem(s, FROM_HELL) && hasItem(s, FORENSIC_NOTE) && locationReachable(s, 'baker_street') },
  { id: 'a5_deduce', act: 5, locationId: 'baker_street', verb: 'deduce',
    subject: 'the conclusion these papers point to',
    done: s => flag(s, 'deduction_correct'),
    available: s => flag(s, 'used_edmund_forensic_note_with_from_hell_letter') },

  // ----- Act 6: The Confrontation -----
  { id: 'a6_records', act: 6, locationId: 'private_asylum', verb: 'examine',
    subject: 'the patient records at the asylum',
    flag: 'visited_private_asylum',
    done: s => flag(s, 'visited_private_asylum'),
    available: s => locationReachable(s, 'private_asylum') },
  { id: 'a6_edmund', act: 6, locationId: 'private_asylum', verb: 'talk',
    subject: 'Edmund Halward, at the last',
    flag: 'talked_to_edmund_at_private_asylum',
    done: s => flag(s, 'talked_to_edmund_at_private_asylum'),
    available: s => npcStep(s, 'private_asylum', 'edmund') },
];

// Used when nothing actionable remains (transient: all current-act gates met).
const FALLBACK: HintTarget = {
  verb: 'reflect',
  subject: 'everything gathered so far',
  locationName: '',
  isCurrentLocation: true,
  locationKnown: true,
};

function visited(s: HintState, locId: string): boolean {
  return locId === s.location || (s.locationVisitCounts?.[locId] ?? 0) > 0;
}

function toTarget(o: HintObjective, s: HintState): HintTarget {
  const loc = LOCATIONS[o.locationId] as any;
  const locationName = loc?.name ?? o.locationId;
  // If Watson has never been to the target location, he cannot know what is inside
  // it — so the hint may only point him there. We drop the interior subject entirely
  // (it never reaches the AI), turning the target into a plain 'travel' nudge.
  if (!visited(s, o.locationId)) {
    return { verb: 'travel', subject: '', locationName, isCurrentLocation: false, locationKnown: false };
  }
  return {
    verb: o.verb,
    subject: o.subject,
    locationName,
    isCurrentLocation: o.locationId === s.location,
    locationKnown: true,
  };
}

/**
 * Pick the next-step target. Prefers an available step at the player's current
 * location (forward momentum); otherwise any available step elsewhere. Random
 * within the chosen tier. Returns FALLBACK when nothing is actionable.
 */
export function selectHint(s: HintState): HintTarget {
  const pool = OBJECTIVES.filter(o => o.act === s.currentAct && !o.done(s) && o.available(s));
  if (pool.length === 0) return FALLBACK;
  const local = pool.filter(o => o.locationId === s.location);
  const tier = local.length > 0 ? local : pool;
  const pick = tier[Math.floor(Math.random() * tier.length)];
  return toTarget(pick, s);
}
