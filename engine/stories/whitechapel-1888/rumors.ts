import type { RumorDefinition } from '../types';
import type { StoryFlag } from './flags';

// Authored rumor spread — Phase 4b. Every hop is hand-written hearsay in the
// recipient's register; nothing auto-propagates. Trigger flags must be
// engine-settable (qa:validate enforces the corpus). Load the historian and
// narration-voice-check skills before authoring new entries.
//
// Rules:
// - Each statement is 15-35 words, third-person register, present tense hearsay
// - Every statement names its sourcing hedge ("through the mortuary men", etc)
// - No "Halward", no "prasarved" (spoilers)
// - delayPeriods: 0-1 same-circle, 2-4 cross-circle gossip, wrapped at act transition
// - Spread to NPCs only during acts when they are in the world (qa:validate warns if absent)
export const RUMORS: RumorDefinition<StoryFlag>[] = [
  // Fixture pair for the engine test suite — real triggers, exact statements preserved.
  // The fixture assertions in qa-engine.ts depend on these IDs and trigger flags;
  // statements may be reworded as long as intent matches.
  //
  // NOTE: the 'phillips' spread entry below is a protected engine-test fixture
  // (scripts/qa-engine.ts Phase 4b, testEnvelopeAndNudge — ~10 assertions on
  // phillips's envelope/nudge/ack-flag content for this exact rumor) and is
  // NOT removed here, even though it is narratively dead: the trigger
  // (showed_from_hell_letter_to_bond) cannot fire before Act 4 — the letter
  // lives at lusk_office, which is Act-4-gated — and Phillips is never
  // onstage past Act 3, so he can never actually receive this delivery in
  // play. The 'abberline' entry below is the genuinely reachable recipient
  // (onstage Acts 4-6, i.e. every act where the trigger could first become
  // true and after); approaches.ts's rumor_delivery_seed now targets him.
  {
    id: 'bond_saw_the_letter',
    triggerFlag: 'showed_from_hell_letter_to_bond',
    spread: [
      {
        npcId: 'phillips',
        delayPeriods: 1,
        statement: 'Has heard through the mortuary men that Dr. Bond was shown the Lusk letter itself by the doctor from Baker Street — and that Bond went very quiet over one passage of it',
      },
      {
        npcId: 'abberline',
        delayPeriods: 2,
        statement: 'Word from the men at the Yard is that Bond was shown the Lusk letter by the doctor from Baker Street — and went quiet over one passage of it',
      },
    ],
  },
  {
    id: 'abberline_saw_the_letter',
    triggerFlag: 'showed_from_hell_letter_to_abberline',
    spread: [
      {
        npcId: 'lusk',
        delayPeriods: 0,
        statement: 'Committee men at the station say Dr. Watson carries a full transcript of the From Hell letter and has been putting it in front of the police',
      },
    ],
  },

  // ── New rumors: Act 4–5 reveals around key documents and forensic detail ──

  // TRIGGER: showed_from_hell_letter_to_holmes
  // Watson brings the letter to Holmes for analysis — the Baker Street synthesis begins.
  // Holmes recognizes the illiteracy as deliberate, and that knowledge spreads.
  {
    id: 'holmes_knew_the_letter_was_fake',
    triggerFlag: 'showed_from_hell_letter_to_holmes',
    spread: [
      {
        npcId: 'abberline',
        delayPeriods: 3,
        statement: 'Word from Commercial Street is that the consulting detective thinks the letter a forgery or a performance — and has told the Yard the killer\'s hand is elsewhere',
      },
      {
        npcId: 'lusk',
        delayPeriods: 4,
        statement: 'From the constables, Lusk hears that Holmes examined the From Hell letter and found it wanting — a showman\'s piece, not the killer\'s voice at all',
      },
    ],
  },

  // TRIGGER: showed_kidney_parcel_to_bond
  // Bond identifies the precise preservation technique — the obsessive, technical hand.
  {
    id: 'bond_knew_the_kidney_was_preserved_by_hand',
    triggerFlag: 'showed_kidney_parcel_to_bond',
    spread: [
      {
        npcId: 'phillips',
        delayPeriods: 2,
        statement: 'Through the mortuary folk, word is Bond examined that kidney and said straight out the man who kept it worked at a laboratory bench, not a butcher\'s shop',
      },
      {
        npcId: 'lusk',
        delayPeriods: 3,
        statement: 'From the police gossip, the Vigilance Committee learns that Bond noticed the kidney was preserved by someone who knew the exact recipe — a man of training, not chance',
      },
    ],
  },

  // TRIGGER: examined_whitechapel_mortuary
  // Watson examines Bond's desk and reads the forensic note.
  // This spreads as clinical observation: the assistant has a studied, careful hand.
  {
    id: 'the_assistant_wrote_careful_notes',
    triggerFlag: 'examined_whitechapel_mortuary',
    spread: [
      {
        npcId: 'phillips',
        delayPeriods: 1,
        statement: 'Has heard from other mortuary men that Bond\'s assistant writes the post-mortem catalogue in a neat, unhurried hand — never crosses out, always spells the same way',
      },
      {
        npcId: 'lusk',
        delayPeriods: 2,
        statement: 'From the constables who frequent the mortuary, word comes that the assistant keeps such precise notes you\'d think he was a surgeon himself, though he never claims to be',
      },
    ],
  },

  // TRIGGER: showed_medical_reports_to_abberline
  // Abberline integrates the forensic pattern — one hand, five scenes, professional access.
  // This spreads as police speculation: someone was at every post-mortem.
  {
    id: 'abberline_saw_the_pattern_was_one_hand',
    triggerFlag: 'showed_medical_reports_to_abberline',
    spread: [
      {
        npcId: 'phillips',
        delayPeriods: 2,
        statement: 'Through the constables, Phillips learns that Abberline has been studying the Bond reports close and believes the same man was present at every examination — professional access, not accident',
      },
      {
        npcId: 'hutchinson',
        delayPeriods: 3,
        statement: 'From the police talk at the station, Hutchinson hears that the Yard now suspects the man they want is someone with a reason to be at the mortuary — not a vagrant at all',
      },
    ],
  },

  // TRIGGER: talked_to_edmund_at_private_asylum
  // Watson confronts Edmund in his cell and hears him speak.
  // This spreads as the final revelation: Edmund was present all along.
  {
    id: 'edmund_was_the_assistant',
    triggerFlag: 'talked_to_edmund_at_private_asylum',
    spread: [
      {
        npcId: 'holmes',
        delayPeriods: 0,
        statement: 'Holmes remarks to Watson that what Edmund told him answers every question at once — the handwriting, the kidney, the light in that room, and the man no one could ever quite remember',
      },
    ],
  },

  // TRIGGER: talked_to_bond_at_millers_court
  // Bond speaks of the horror and his burden — the emotional anchor of Act 1.
  // This spreads as concern for Bond's state of mind.
  {
    id: 'bond_was_broken_by_kelly',
    triggerFlag: 'talked_to_bond_at_millers_court',
    spread: [
      {
        npcId: 'phillips',
        delayPeriods: 1,
        statement: 'Through mortuary gossip, word spreads that Dr. Bond was much affected by the Kelly examination — went home early, stayed home the next day, returned to work hollow-eyed',
      },
      {
        npcId: 'abberline',
        delayPeriods: 2,
        statement: 'From the police who visit the mortuary, Abberline hears that Bond took the Kelly case harder than the others — a man of conscience, as it turns out, not merely technique',
      },
    ],
  },

  // TRIGGER: examined_autopsy_ledger
  // Watson reads Bond's sequential entries — the killer learned as he went.
  // This spreads as reassurance: the murders have a pattern, not randomness.
  {
    id: 'the_killer_learned_as_he_went',
    triggerFlag: 'examined_whitechapel_mortuary', // location examined, which triggers the ledger
    spread: [
      {
        npcId: 'phillips',
        delayPeriods: 2,
        statement: 'Through mortuary men, word goes that Bond\'s records show one pattern from first to last — the murderer improved with each case, not descended into madness but into skill',
      },
      {
        npcId: 'hutchinson',
        delayPeriods: 3,
        statement: 'From the constables\' talk, Hutchinson gathers that the forensic evidence shows a progression — the killer was teaching himself, act by act, how to do this thing',
      },
    ],
  },

  // TRIGGER: showed_edmund_forensic_note_to_holmes
  // Holmes reads the assistant's note and feels something cross his face — recognizes the signature.
  // This spreads as Holmes knowing more than he has said.
  {
    id: 'holmes_knew_who_wrote_the_note',
    triggerFlag: 'showed_edmund_forensic_note_to_holmes',
    spread: [
      {
        npcId: 'abberline',
        delayPeriods: 2,
        statement: 'From police channels, word comes that Holmes examined the forensic note and made a face that suggested recognition — as though he had already suspected whose hand wrote it',
      },
      {
        npcId: 'lusk',
        delayPeriods: 3,
        statement: 'From the constables at the Vigilance office, Lusk learns that the consulting detective read Bond\'s assistant\'s own notes and seemed to have understood something the Yard had missed',
      },
    ],
  },
];
