import type { RumorDefinition } from '../types';

// Authored rumor spread — Phase 4b. Every hop is hand-written hearsay in the
// recipient's register; nothing auto-propagates. Trigger flags must be
// engine-settable (qa:validate enforces the corpus). Load the historian and
// narration-voice-check skills before authoring new entries.
export const RUMORS: RumorDefinition[] = [
  // Fixture pair for the engine test suite — real triggers, modest content.
  // The curated Phase 4b set extends/reworks these in a data-only commit.
  {
    id: 'bond_saw_the_letter',
    triggerFlag: 'showed_from_hell_letter_to_bond',
    spread: [
      {
        npcId: 'phillips',
        delayPeriods: 1,
        statement: 'Has heard through the mortuary men that Dr. Bond was shown the Lusk letter itself by the doctor from Baker Street — and that Bond went very quiet over one passage of it',
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
];
