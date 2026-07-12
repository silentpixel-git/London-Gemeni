import type { ApproachDefinition } from '../types';
import type { StoryFlag } from './flags';

// Authored NPC approaches — the world initiating contact. Load the historian
// skill before adding entries. Rules (spec 2026-07-11):
// - text must not reference datable happenings unless gated: a world event ⇒
//   requireFlags includes its world_event_<id> flag; an act-specific
//   happening ⇒ acts starts no earlier than that act.
// - Edmund must have mundane approaches like everyone else (recession rule:
//   an approach system where only the innocent initiate contact is a tell).
export const APPROACHES: ApproachDefinition<StoryFlag>[] = [
  // ── Seeds (Task 1) ──────────────────────────────────────────────────────────
  // The original two proof-of-concept entries — one mundane texture beat, one
  // rumor delivery. Kept in place; the rest of the set is organized by
  // category below.

  {
    id: 'hutchinson_dorset_weather',
    npcId: 'hutchinson',
    locationId: 'dorset_street',
    acts: [1],
    kind: 'mundane',
    text: 'A man detaches himself from the crowd to remark that he has stood this corner half the night, and that the rain has only now thought to stop.',
  },
  {
    // rumorId sourced from rumors.ts's first RumorDefinition
    // ('bond_saw_the_letter', triggerFlag 'showed_from_hell_letter_to_bond').
    // Originally targeted 'phillips' (its only spread entry at the time), but
    // that pairing was structurally dead: the letter lives at lusk_office
    // (Act 4+ only, per its `act: 4` gate), so the trigger cannot fire before
    // Act 4 — and Phillips is never onstage past Act 3. Retargeted to
    // 'abberline', who is onstage in Acts 4-6 (lusk_office, bond_office,
    // private_asylum) — every act the trigger could first become true and
    // after. rumors.ts gained a matching 'abberline' spread entry on
    // bond_saw_the_letter (added alongside the existing 'phillips' entry,
    // not replacing it — that entry is a protected qa-engine.ts fixture).
    id: 'rumor_delivery_seed',
    npcId: 'abberline',
    locationId: 'any',
    kind: 'rumor',
    rumorId: 'bond_saw_the_letter',
    text: 'They cross to Watson, voice dropped low, to pass on what has reached them.',
  },

  // ── Edmund — mundane approaches (recession rule) ──────────────────────────
  // Flat, warm, unremarkable. Must read exactly like any other NPC's beat —
  // no narrator weight, no hesitation, nothing the eye would catch. Statements
  // and actions only — Edmund's speakingStyle is explicit that he "never asks
  // questions, never volunteers curiosity."

  {
    id: 'edmund_mortuary_tea',
    npcId: 'edmund',
    locationId: 'whitechapel_mortuary',
    acts: [2, 3],
    kind: 'mundane',
    text: "He sets a cup of tea at Watson's elbow without a word — the mortuary keeps a kettle going for visitors who linger past noon.",
  },
  {
    id: 'edmund_bond_office_stove',
    npcId: 'edmund',
    locationId: 'bond_office',
    acts: [5],
    kind: 'mundane',
    text: "He clears a stack of files from the second chair without being asked, and remarks that the office holds the cold badly this time of year — Watson would do better nearer the stove.",
  },

  // ── Rumor deliveries ───────────────────────────────────────────────────────
  // Framing only — the matured statement itself is injected by the engine.

  {
    // rumorId 'the_assistant_wrote_careful_notes' (trigger 'examined_whitechapel_mortuary',
    // fires as early as Act 2) → spread entry for 'lusk', delayPeriods 2. Long
    // matured by the time Lusk is reachable in Act 4.
    id: 'rumor_delivery_lusk_assistant_notes',
    npcId: 'lusk',
    locationId: 'lusk_office',
    acts: [4, 5, 6],
    kind: 'rumor',
    rumorId: 'the_assistant_wrote_careful_notes',
    text: 'Lusk waits until the door has swung shut behind them before repeating something passed to him by a constable who frequents the mortuary.',
  },
  {
    // rumorId 'bond_was_broken_by_kelly' (trigger 'talked_to_bond_at_millers_court',
    // Act 1) → spread entry for 'phillips', delayPeriods 1. Matured well before
    // Phillips comes onstage in Act 2.
    id: 'rumor_delivery_phillips_bond_broken',
    npcId: 'phillips',
    locationId: 'any',
    kind: 'rumor',
    rumorId: 'bond_was_broken_by_kelly',
    text: 'He draws Watson a step aside — the professional courtesy of one medical man passing on news of another.',
  },

  // ── Mundane texture ─────────────────────────────────────────────────────────

  {
    // Second Hutchinson beat, later act and a different location/register
    // than the Dorset Street seed.
    id: 'hutchinson_pub_grief',
    npcId: 'hutchinson',
    locationId: 'whitechapel_pub',
    acts: [2],
    kind: 'mundane',
    text: "He turns from his glass to ask, not for the first time, whether Watson thinks a man might have done something different that night — then waves the question off before an answer can be given.",
  },
  {
    id: 'abberline_pub_evening',
    npcId: 'abberline',
    locationId: 'whitechapel_pub',
    timePeriods: ['evening', 'night', 'lateNight'],
    kind: 'mundane',
    text: "He finds Watson at the bar and orders without asking what he's having, remarking only that a man on this beat learns to drink whatever comes nearest to hand.",
  },
  {
    id: 'phillips_mortuary_shoptalk',
    npcId: 'phillips',
    locationId: 'whitechapel_mortuary',
    acts: [2, 3],
    kind: 'mundane',
    text: "He sets his own notes down beside Bond's and remarks, cheerfully enough, that the two of them will disagree again before the day is out — they generally do — and that he wouldn't have it any other way.",
  },
  {
    // Gated on the Act 4 newsboy world event (Tumblety's flight) — a lighter,
    // secondary echo of the news distinct from Abberline's own scripted line
    // delivering it in person at Lusk's office.
    id: 'abberline_tumblety_news_echo',
    npcId: 'abberline',
    locationId: 'bond_office',
    acts: [5],
    requireFlags: ['world_event_act4_newsboys_tumblety'],
    kind: 'mundane',
    text: "He mentions, almost in passing, that the newspapers still haven't let go of the American doctor's flight — as though the story were doing the Yard's work of distraction for it.",
  },
];
