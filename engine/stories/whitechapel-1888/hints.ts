import type { HintTarget } from '../../../types';
import type { HintState, HintObjective } from '../types';
import type { StoryFlag } from './flags';
import { LOCATIONS } from './locations';
import { NPCS } from './npcs';

export type { HintState, HintObjective } from '../types';

// ── Inventory display names (must match TAKEABLE_OBJECTS values in clues.ts) ──
const FROM_HELL = 'From Hell Letter (transcript)';
const FORENSIC_NOTE = "Assistant's Forensic Note (copy)";
const HUTCH_ACCOUNT = "Hutchinson's Account (Watson's note)";
const KIDNEY_NOTES = 'Kidney Examination Notes';

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
  const npc = NPCS[npcId] as any;
  // Mirrors npcLocationAt's gate check in engine/presence.ts — keep in sync.
  if (npc?.presenceRequiresFlag && s.flags[npc.presenceRequiresFlag] !== true) return false;
  if (npc?.presenceForbidFlag && s.flags[npc.presenceForbidFlag] === true) return false;
  const st = s.npcStates[npcId];
  const loc = st?.currentLocation ?? npc?.scheduleByAct?.[s.currentAct]?.default;
  return loc === locId && st?.status !== 'deceased';
}
/** A talk/show step is available only if its location is reachable AND the NPC is there. */
function npcStep(s: HintState, locId: string, npcId: string): boolean {
  return locationReachable(s, locId) && npcAt(s, npcId, locId);
}

// ── The objective table — one entry per ACT_PROGRESSION gate flag, plus the
//    prerequisite steps that unlock show/use gates. Subjects stay neutral. ──────
export const OBJECTIVES: HintObjective<StoryFlag>[] = [
  // ----- Act 0: The Bank Holiday -----
  { id: 'a0_caller', act: 0, locationId: 'baker_street', verb: 'talk',
    subject: 'Holmes, or the street he is studying',
    flag: 'act0_caller_noticed',
    done: s => flag(s, 'act0_caller_noticed'),
    available: s => npcStep(s, 'baker_street', 'holmes') },
  { id: 'a0_bell', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the hesitant caller below, or the window from which Holmes saw her',
    flag: 'act0_bell_rang',
    done: s => flag(s, 'act0_bell_rang'),
    available: s => flag(s, 'act0_caller_noticed') },
  { id: 'a0_business', act: 0, locationId: 'baker_street', verb: 'talk',
    subject: 'Mrs Kemp, about why she has come',
    flag: 'act0_kemp_business_heard',
    done: s => flag(s, 'act0_kemp_business_heard'),
    available: s => npcStep(s, 'baker_street', 'mrs_kemp') },
  { id: 'a0_boots', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the deposits worked into the worn boots',
    flag: 'act0_boots_analyzed',
    done: s => flag(s, 'act0_boots_analyzed'),
    available: s => flag(s, 'world_event_kemp_arrives') },
  { id: 'a0_ticket', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the ticket she has laid on the table',
    done: s => flag(s, 'examined_baker_street_pawn_ticket'),
    available: s => flag(s, 'world_event_kemp_arrives') },
  { id: 'a0_workbox', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the tin box she brought with her',
    done: s => flag(s, 'opened_baker_street_nells_workbox'),
    available: s => flag(s, 'world_event_kemp_arrives') },
  { id: 'a0_letters', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'Nell’s correspondence in the open workbox',
    done: s => flag(s, 'examined_baker_street_nells_letters'),
    available: s => flag(s, 'opened_baker_street_nells_workbox') },
  { id: 'a0_card', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the printed card in the open workbox',
    done: s => flag(s, 'examined_baker_street_charity_card'),
    available: s => flag(s, 'opened_baker_street_nells_workbox') },
  { id: 'a0_reconstruction', act: 0, locationId: 'baker_street', verb: 'show',
    subject: 'the printed card to Holmes, once the ticket, boots, and letters have been examined',
    flag: 'act0_reconstruction_complete',
    done: s => flag(s, 'act0_reconstruction_complete'),
    available: s => flag(s, 'examined_baker_street_pawn_ticket') && flag(s, 'act0_boots_analyzed') &&
      flag(s, 'examined_baker_street_nells_letters') && hasItem(s, "A Subscriber's Card") &&
      npcStep(s, 'baker_street', 'holmes') },
  { id: 'a0_choice', act: 0, locationId: 'baker_street', verb: 'talk',
    subject: 'what Mrs Kemp should be told before she leaves',
    flag: 'act0_kemp_choice_resolved',
    done: s => flag(s, 'act0_kemp_choice_resolved'),
    available: s => flag(s, 'act0_reconstruction_complete') && npcStep(s, 'baker_street', 'mrs_kemp') },
  { id: 'a0_take_ticket', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'whether the ticket left behind should now be taken',
    flag: 'took_baker_street_pawn_ticket',
    done: s => flag(s, 'took_baker_street_pawn_ticket'),
    available: s => flag(s, 'act0_kemp_choice_resolved') },
  { id: 'a0_closing', act: 0, locationId: 'baker_street', verb: 'talk',
    subject: 'Holmes, or the holiday crowd beyond the open window',
    flag: 'act0_closing_complete',
    done: s => flag(s, 'act0_closing_complete'),
    available: s => flag(s, 'took_baker_street_pawn_ticket') && npcStep(s, 'baker_street', 'holmes') },

  // ----- Act 1: The Last Murder -----
  { id: 'a1_hutchinson', act: 1, locationId: 'dorset_street', verb: 'talk',
    subject: 'the witness Hutchinson, lingering near the court',
    done: s => flag(s, 'talked_to_hutchinson_at_dorset_street'),
    available: s => npcStep(s, 'dorset_street', 'hutchinson') },
  { id: 'a1_account_test', act: 1, locationId: 'dorset_street', verb: 'use',
    subject: 'his account, tried against the archway and the light where he says he stood',
    done: s => flag(s, 'used_hutchinson_account_with_court_archway'),
    available: s => hasItem(s, HUTCH_ACCOUNT) && locationReachable(s, 'dorset_street') },
  { id: 'a1_account_confront', act: 1, locationId: 'dorset_street', verb: 'show',
    subject: 'the statement, read back to the man who gave it',
    flag: 'showed_hutchinson_account_to_hutchinson',
    done: s => flag(s, 'showed_hutchinson_account_to_hutchinson'),
    available: s => flag(s, 'used_hutchinson_account_with_court_archway') && npcStep(s, 'dorset_street', 'hutchinson') },
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
    subject: "Dr. Bond about Mary Kelly, if he can bear to speak of her",
    flag: 'asked_bond_about_bond_kelly_findings',
    done: s => flag(s, 'asked_bond_about_bond_kelly_findings'),
    available: s => npcStep(s, 'millers_court', 'bond') },

  // ----- Act 2: The First Victims -----
  { id: 'a2_mortuary', act: 2, locationId: 'whitechapel_mortuary', verb: 'examine',
    subject: "Dr. Bond's autopsy ledger at the mortuary",
    flag: 'examined_whitechapel_mortuary',
    done: s => flag(s, 'examined_whitechapel_mortuary'),
    available: s => locationReachable(s, 'whitechapel_mortuary') },
  { id: 'a2_phillips', act: 2, locationId: 'whitechapel_mortuary', verb: 'talk',
    subject: "Dr. Phillips about the training such work would require",
    flag: 'asked_phillips_about_phillips_watched_not_qualified',
    done: s => flag(s, 'asked_phillips_about_phillips_watched_not_qualified'),
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
    subject: "the American about the murders themselves",
    flag: 'asked_tumblety_about_tumblety_theatrical_denial',
    done: s => flag(s, 'asked_tumblety_about_tumblety_theatrical_denial'),
    available: s => npcStep(s, 'h_division_station', 'tumblety') },
  { id: 'a2_holmes', act: 2, locationId: 'h_division_station', verb: 'talk',
    subject: "Holmes about the American, once the man has performed",
    flag: 'asked_holmes_about_holmes_tumblety_performance',
    done: s => flag(s, 'asked_holmes_about_holmes_tumblety_performance'),
    available: s => npcStep(s, 'h_division_station', 'holmes') },

  // ----- Act 3: The Double Event -----
  { id: 'a3_dutfields', act: 3, locationId: 'dutfields_yard', verb: 'examine',
    subject: "Dutfield's Yard, where the night's first body was found",
    flag: 'examined_dutfields_yard',
    done: s => flag(s, 'examined_dutfields_yard'),
    available: s => locationReachable(s, 'dutfields_yard') },
  { id: 'a3_pizer', act: 3, locationId: 'working_mens_club', verb: 'talk',
    subject: "Pizer about the neighbourhood, and how he lives in it now",
    flag: 'asked_pizer_about_pizer_community_fears_mob',
    done: s => flag(s, 'asked_pizer_about_pizer_community_fears_mob'),
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
    subject: "Holmes about the witnesses, and why not one of them remembers a face",
    flag: 'asked_holmes_about_holmes_no_reliable_witness',
    done: s => flag(s, 'asked_holmes_about_holmes_no_reliable_witness'),
    available: s => npcStep(s, 'goulston_street', 'holmes') },

  // ----- Act 4: The Letter -----
  { id: 'a4_lusk', act: 4, locationId: 'lusk_office', verb: 'examine',
    subject: 'the parcel and the letter sent to Mr. Lusk',
    flag: 'examined_lusk_office',
    done: s => flag(s, 'examined_lusk_office'),
    available: s => locationReachable(s, 'lusk_office') },
  { id: 'a4_abberline', act: 4, locationId: 'lusk_office', verb: 'talk',
    subject: "Abberline about the gentleman whose file crossed his desk",
    flag: 'asked_abberline_about_abberline_barrister_file',
    done: s => flag(s, 'asked_abberline_about_abberline_barrister_file'),
    available: s => npcStep(s, 'lusk_office', 'abberline') },
  { id: 'a4_holmes', act: 4, locationId: 'lusk_office', verb: 'talk',
    subject: "Holmes about the kidney, and the hand that preserved it",
    flag: 'asked_holmes_about_holmes_preserving_hand',
    done: s => flag(s, 'asked_holmes_about_holmes_preserving_hand'),
    available: s => npcStep(s, 'lusk_office', 'holmes') },
  { id: 'a4_kidney_letter', act: 4, locationId: 'lusk_office', verb: 'use',
    subject: "Bond's notes on the kidney, set against the letter that boasts of it",
    done: s => flag(s, 'used_kidney_parcel_with_from_hell_letter'),
    available: s => hasItem(s, FROM_HELL) && hasItem(s, KIDNEY_NOTES) },

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
    subject: "the assistant about light",
    flag: 'asked_edmund_about_edmund_eye_for_light',
    done: s => flag(s, 'asked_edmund_about_edmund_eye_for_light'),
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
