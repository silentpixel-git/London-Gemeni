/**
 * scripts/qa-chips.ts
 *
 * Suggestion-chip QA: for every location, act and flag-set that changes what is
 * visible, every chip the UI would offer must parse to the intent and target it
 * advertises. A chip the parser cannot resolve is a button that lies.
 *
 * Run: npx tsx scripts/qa-chips.ts   (exit 1 on any failure)
 */

import { parseIntent } from '../engine/intentParser';
import { LOCATIONS, NPCS } from '../engine/gameData';
import { OBJECT_VISIBILITY } from '../engine/stories/whitechapel-1888/locations';
import { INITIAL_NPC_STATES } from '../constants';
import { deriveScene, buildChips } from '../components/sceneView';

const ACTS = [0, 1, 2, 3, 4, 5, 6];
const allGates = Array.from(new Set(Object.values(OBJECT_VISIBILITY)));
const allFlagsOn = Object.fromEntries(allGates.map(g => [g, true]));

let checked = 0;
const failures: string[] = [];
const seen = new Set<string>();

for (const loc of Object.keys(LOCATIONS)) {
  for (const act of ACTS) {
    for (const flags of [{}, allFlagsOn]) {
      // Everyone introduced, and every NPC placed here, to exercise the NPC chip.
      const npcStates = Object.fromEntries(Object.keys(INITIAL_NPC_STATES).map(id => [
        id, { ...INITIAL_NPC_STATES[id], currentLocation: loc },
      ]));
      for (const introduced of [Object.keys(NPCS), []]) {
        const scene = deriveScene({ location: loc, currentAct: act, npcStates: npcStates as any, introducedNpcs: introduced, flags });
        for (const chip of buildChips(scene)) {
          const key = `${loc}|${chip.command}`;
          if (seen.has(key)) continue;
          seen.add(key);
          checked++;
          const intent = parseIntent(chip.command);
          const want = chip.kind === 'object' ? 'examine' : chip.kind === 'npc' ? 'talk' : 'move';
          if (intent.type !== want) {
            failures.push(`[${loc}] "${chip.command}" → ${intent.type} (wanted ${want})`);
          }
        }
      }
    }
  }
}

console.log(`qa-chips: ${checked} distinct chips checked, ${failures.length} failed`);
for (const f of failures.slice(0, 60)) console.log('  FAIL', f);
if (failures.length > 60) console.log(`  …and ${failures.length - 60} more`);
process.exit(failures.length ? 1 : 0);
