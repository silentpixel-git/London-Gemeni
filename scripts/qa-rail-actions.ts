/**
 * scripts/qa-rail-actions.ts
 *
 * Case-rail verb QA. Every verb the rail offers on a person, object or carried
 * item must do what its label promises when the parser meets it:
 *   - run verbs   → parse to the advertised intent with a resolved target
 *   - fill verbs  → once the player completes the sentence, parse to a fully
 *                   resolved intent (target + second noun / topic)
 * Swept over every location × act × flag state so no scene offers a dead button.
 *
 * Run: npx tsx scripts/qa-rail-actions.ts   (exit 1 on any failure)
 */

import { parseIntent, type ParsedIntent } from '../engine/intentParser';
import { LOCATIONS, NPCS, OBJECT_VISIBILITY, OBJECT_DISPLAY_NAMES, TAKEABLE_OBJECTS } from '../engine/gameData';
import { INITIAL_NPC_STATES } from '../constants';
import { deriveScene, deriveInventory, type RailAction } from '../components/sceneView';

const ACTS = [0, 1, 2, 3, 4, 5, 6];
const allGates = Array.from(new Set(Object.values(OBJECT_VISIBILITY)));
const allFlagsOn = Object.fromEntries(allGates.map(g => [g, true]));

// Completions the player would plausibly type after a fill verb.
const PROBE_TOPIC = 'the case';
const PROBE_ITEM = OBJECT_DISPLAY_NAMES['from_hell_letter'] ?? 'letter';
const PROBE_NPC = 'Sherlock Holmes';
const PROBE_OBJECT = OBJECT_DISPLAY_NAMES['pawn_ticket'] ?? 'ticket';

const EXPECT_RUN: Record<string, ParsedIntent['type']> = { talk: 'talk', examine: 'examine', read: 'read', open: 'open' };

function check(action: RailAction): string | null {
  if (action.mode === 'run') {
    const want = EXPECT_RUN[action.key];
    const i = parseIntent(action.command);
    if (i.type !== want) return `parsed as ${i.type}, wanted ${want}`;
    if (!i.targetId) return 'target did not resolve';
    return null;
  }
  switch (action.key) {
    case 'ask': {
      const i = parseIntent(action.command + PROBE_TOPIC);
      return i.type === 'talk' && i.targetId && i.topicRaw ? null : `completed sentence → ${i.type}, target=${i.targetId}, topic=${i.topicRaw}`;
    }
    case 'show': {
      const i = parseIntent(action.command + PROBE_ITEM);
      return i.type === 'show' && i.targetId && i.showTargetNpcId ? null : `completed sentence → ${i.type}, item=${i.targetId}, npc=${i.showTargetNpcId}`;
    }
    case 'use': {
      const i = parseIntent(action.command + PROBE_OBJECT);
      return i.type === 'use' && i.targetId && i.useWithTargetId ? null : `completed sentence → ${i.type}, first=${i.targetId}, second=${i.useWithTargetId}`;
    }
    case 'showto': {
      const i = parseIntent(action.command + PROBE_NPC);
      return i.type === 'show' && i.targetId && i.showTargetNpcId ? null : `completed sentence → ${i.type}, item=${i.targetId}, npc=${i.showTargetNpcId}`;
    }
    default:
      return `unknown fill verb "${action.key}"`;
  }
}

let checked = 0;
const failures: string[] = [];
const seen = new Set<string>();

function run(where: string, actions: RailAction[]) {
  for (const a of actions) {
    const key = a.command;
    if (seen.has(key)) continue;
    seen.add(key);
    checked++;
    const problem = check(a);
    if (problem) failures.push(`[${where}] ${a.label} → "${a.command}": ${problem}`);
  }
}

for (const loc of Object.keys(LOCATIONS)) {
  for (const act of ACTS) {
    for (const flags of [{}, allFlagsOn]) {
      const npcStates = Object.fromEntries(Object.keys(INITIAL_NPC_STATES).map(id => [
        id, { ...INITIAL_NPC_STATES[id], currentLocation: loc },
      ]));
      for (const introduced of [Object.keys(NPCS), []]) {
        const scene = deriveScene({ location: loc, currentAct: act, npcStates: npcStates as any, introducedNpcs: introduced, flags });
        for (const n of scene.npcs) run(`${loc}/npc ${n.npcId}`, n.actions);
        for (const o of scene.objects) {
          run(`${loc}/object ${o.id}`, o.actions);
          for (const c of o.children) run(`${loc}/child ${c.id}`, c.actions);
        }
      }
    }
  }
}

// Carried items: the opening kit plus everything takeable.
for (const item of deriveInventory(["Watson's Diary", 'Pocket Watch', ...Object.values(TAKEABLE_OBJECTS)])) {
  run(`bag ${item.id}`, item.actions);
}

console.log(`qa-rail-actions: ${checked} distinct verbs checked, ${failures.length} failed`);
for (const f of failures.slice(0, 80)) console.log('  FAIL', f);
if (failures.length > 80) console.log(`  …and ${failures.length - 80} more`);
process.exit(failures.length ? 1 : 0);
