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
  {
    id: 'hutchinson_dorset_weather',
    npcId: 'hutchinson',
    locationId: 'dorset_street',
    acts: [1],
    kind: 'mundane',
    text: 'A man detaches himself from the crowd to remark that he has stood this corner half the night, and that the rain has only now thought to stop.',
  },
  {
    // rumorId/npcId sourced from rumors.ts's first RumorDefinition
    // ('bond_saw_the_letter', triggerFlag 'showed_from_hell_letter_to_bond'):
    // its first (only) spread entry recipient is 'phillips'.
    id: 'rumor_delivery_seed',
    npcId: 'phillips',
    locationId: 'any',
    kind: 'rumor',
    rumorId: 'bond_saw_the_letter',
    text: 'They cross to Watson, voice dropped low, to pass on what has reached them.',
  },
];
