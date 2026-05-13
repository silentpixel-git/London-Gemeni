import type { SuspectProfile } from '../types';

// Data-driven deduction resolution. The engine checks the
// player's theory against each profile's aliases to determine
// success or failure — no character names are hardcoded in
// the engine itself.
export const SUSPECT_PROFILES: SuspectProfile[] = [
  {
    npcId: 'edmund',
    aliases: ['edmund', 'halward', "bond's assistant", 'the assistant', 'the young man'],
    isGuilty: true,
    successFlags: { 'deduction_correct': true, 'asylum_unlocked': true },
    successAct: 6,
    successVisitFlag: 'visited_private_asylum',
  },
];
