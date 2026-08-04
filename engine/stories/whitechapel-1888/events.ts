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
    atClockMinutes: 0, // midnight — earlier than the 8:30 PM start, so it fires past midnight
    // Re-dressed for the Bank Holiday (6 Aug 1888): the bells have to compete
    // with a city still out of doors. No hint of anything to come — nothing has
    // happened, and the holiday is simply a holiday.
    text: 'Midnight comes over London in a slow relay of church bells, each parish a half-beat behind the last. Tonight not one of them can make itself heard over the holiday, which shows no sign whatever of going home.',
  },
  // Mrs. Kemp's arrival is not clock-timed. The action-triggered Act 0 event
  // sets `world_event_kemp_arrives`, preserving the established presence and
  // object-visibility flag without allowing unrelated turns to admit her.
  {
    id: 'act2_church_bells',
    act: 2,
    atClockMinutes: 660, // 11:00 AM, 11 Nov — a Sunday; morning service lets out
    text: 'Somewhere off toward Commercial Street a peal of bells lets out a morning service, and for a few minutes the pavement fills with dark coats and lowered voices before the crowd thins back into the ordinary week.',
  },
  {
    id: 'act4_newsboys_tumblety',
    act: 4,
    atClockMinutes: 780, // 1:00 PM, 17 Nov — an afternoon edition
    text: 'A newsboy works the corner with an afternoon edition, his cry rising above the traffic: the American doctor held on the indecency charge has slipped his bail and is thought fled the country. Nobody stops walking to buy one, but several slow down to listen.',
  },
  {
    id: 'act5_lamplighters',
    act: 5,
    atClockMinutes: 1020, // 5:00 PM, 20 Nov — dusk, fog thickening
    text: 'The lamplighter works up the street with his pole, one gas lamp at a time, and each small flame seems to lose a little of its fight to the fog before it has properly caught.',
  },
];
