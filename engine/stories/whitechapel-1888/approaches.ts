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
    text: 'He crosses to Watson, voice dropped low, to pass on what has reached him.',
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
    text: "He clears a stack of files from the second chair before Watson can ask, and remarks that the office holds the cold badly this time of year — Watson would do better nearer the stove.",
  },

  // ── Holmes — mundane approaches ───────────────────────────────────────────
  // A third register, distinct from his other two systems: scriptedLines are
  // act/flag-gated capstones (major theory beats); idleBehaviors are flat,
  // rotating atmosphere with zero narrative weight. These sit between the
  // two — a one-shot moment where Holmes specifically initiates something
  // WITH Watson (notices him, cracks composure, dryly corrects himself) —
  // never case-theory content, never a foreshadow of a still-gated reveal.
  // locationId 'any': he's a follows_watson NPC, present wherever Watson is,
  // so there's no single location to anchor these to (npcLocationAt resolves
  // his live position from the follower's stored location — see presence.ts).
  //
  // His scriptedLines fire at h_division_station/act2 (triggerFlag
  // talked_to_tumblety_at_h_division_station), goulston_street/act3
  // (triggerFlag examined_goulston_street), lusk_office/act4, and
  // bond_office+baker_street/act5. Two entries below (acts 0, 1, 6) sidestep
  // collision entirely by using acts where Holmes has no scriptedLines at
  // all. The other two (acts 2, 3) use `forbidFlags` on the exact
  // triggerFlag instead of avoiding the whole act — the only real collision
  // risk is this approach firing at literally h_division_station/goulston_street
  // once that specific flag is true (scriptedLines fire on every turn at
  // that location once their flag is set, not just once), so forbidFlags
  // closes that window precisely rather than forfeiting acts 2-3 entirely.
  {
    id: 'holmes_watson_revolver',
    npcId: 'holmes',
    locationId: 'any',
    acts: [0],
    kind: 'mundane',
    text: 'Holmes glances up from his own preparations to observe, with the faint approval he rarely troubles to voice, that Watson has remembered the revolver, and not merely the intention of bringing it.',
  },
  {
    id: 'holmes_quiet_composure',
    npcId: 'holmes',
    locationId: 'any',
    acts: [1],
    kind: 'mundane',
    text: 'Holmes has gone quiet for some minutes together — no aside, no reasoning worked aloud — and when Watson catches his eye he says only that he does not care to describe what he is thinking, and returns to his notebook.',
  },
  {
    id: 'holmes_watson_fatigue',
    npcId: 'holmes',
    locationId: 'any',
    acts: [2],
    // Dodges only his h_division_station scriptedLine, not the whole act —
    // see the section note above.
    forbidFlags: ['talked_to_tumblety_at_h_division_station'],
    kind: 'mundane',
    text: 'Holmes studies Watson a moment longer than the conversation requires, then observes, unprompted, that Watson has slept badly for three nights running and eaten less than that — he offers no remedy, only the observation, and lets the subject drop.',
  },
  {
    id: 'holmes_discarded_theories',
    npcId: 'holmes',
    locationId: 'any',
    acts: [3],
    // Dodges only his goulston_street scriptedLine, not the whole act — see
    // the section note above.
    forbidFlags: ['examined_goulston_street'],
    kind: 'mundane',
    text: "Holmes remarks, watching the crowd rather than Watson, that he has discarded nine theories this week before breakfast could interrupt him — and does not seem to consider that a poor morning's work.",
  },
  {
    id: 'holmes_patience_admission',
    npcId: 'holmes',
    locationId: 'any',
    acts: [6],
    kind: 'mundane',
    text: 'Holmes remarks, without any apparent wish to be excused for it, that he was slower about this business than he cares to admit — the facts wanted more patience than his temperament generally allows. He does not dwell on it further.',
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
    // Sourcing ("constables who frequent the mortuary") lives in the paired
    // rumor statement (rumors.ts) — kept out of the framing here so the two
    // don't repeat it back to back when narrated as one beat.
    text: 'Lusk waits until the door has swung shut behind them before repeating something recently passed to him.',
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
    // No `acts` filter: Abberline's schedule also has him at whitechapel_pub
    // in Act 0, but Act 0 confines Watson to Baker Street (its only exit is
    // act-1-gated), so that slot is structurally unreachable — this fires
    // only in Act 2 evening/night/lateNight in practice. Left unfiltered
    // rather than pinned to acts: [2] so a future Act-0 exit change doesn't
    // silently leave this approach stale.
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
