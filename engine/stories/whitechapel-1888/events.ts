import type { WorldEventDefinition } from '../types';

// Authored world events — the city moving whether or not Watson is "on time".
// Narration broadcasts only (no state changes). Historical texture: 9 November
// 1888 was Lord Mayor's Day; news of the Miller's Court murder broke into the
// procession crowds. Load the historian skill before adding entries here.
export const WORLD_EVENTS: WorldEventDefinition[] = [
  {
    id: 'act1_lord_mayors_show',
    act: 1,
    atClockMinutes: 720, // noon, 9 Nov — the procession is in the City while Whitechapel mourns
    text: 'Away west, faint under the grey sky, a brass band — the Lord Mayor\'s procession winding through the City, all gilt and cheering, while this street holds its breath.',
  },
  {
    id: 'act0_midnight_bells',
    act: 0,
    atClockMinutes: 0, // midnight of the vigil — earlier than the 8:00 PM start, so it fires past midnight
    text: 'Midnight comes over London in a slow relay of church bells, each parish a half-beat behind the last, until the count dies away east over Whitechapel.',
  },
];
