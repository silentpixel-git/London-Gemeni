import {
  INITIAL_INTRODUCED_NPCS,
  INITIAL_INVENTORY,
  INITIAL_LOCATION,
  INITIAL_NPC_STATES,
} from '../constants';
import { gameEngine, type SessionSnapshot } from '../engine/GameEngine';
import { parseIntent } from '../engine/intentParser';
import type { EngineResult, NarrationContext, NPCState } from '../types';

function initialAct0Snapshot(): SessionSnapshot {
  return {
    location: INITIAL_LOCATION,
    inventory: [...INITIAL_INVENTORY],
    flags: {},
    npcStates: { ...INITIAL_NPC_STATES },
    currentAct: 0,
    medicalPoints: 0,
    moralPoints: 0,
    discoveredClueIds: [],
    turnsAtLocationWithoutProgress: 0,
    elapsedMinutes: 0,
    introducedNpcs: [...INITIAL_INTRODUCED_NPCS],
    locationVisitCounts: {},
    turnCount: 0,
    rumorEvents: {},
  };
}

function applyAct0Result(snapshot: SessionSnapshot, result: EngineResult): SessionSnapshot {
  const npcStates: Record<string, NPCState> = { ...snapshot.npcStates };
  for (const [id, update] of Object.entries(result.npcUpdates ?? {})) {
    npcStates[id] = {
      ...(npcStates[id] ?? { npcId: id, disposition: 50, status: 'alive' }),
      ...update,
    } as NPCState;
  }
  return {
    ...snapshot,
    location: result.newLocation ?? snapshot.location,
    currentAct: result.newAct ?? snapshot.currentAct,
    flags: { ...snapshot.flags, ...(result.flagsUpdate ?? {}) },
    inventory: [
      ...snapshot.inventory.filter(item => !(result.inventoryRemove ?? []).includes(item)),
      ...(result.inventoryAdd ?? []).filter(item => !snapshot.inventory.includes(item)),
    ],
    npcStates,
    turnCount: snapshot.turnCount + 1,
  };
}

export function buildAct0NarrationContexts(): Array<{ id: string; ctx: NarrationContext }> {
  const captured: Array<{ id: string; ctx: NarrationContext }> = [];
  const resolve = (snapshot: SessionSnapshot, input: string) => {
    const result = gameEngine.resolve(parseIntent(input), snapshot);
    if (result.aiContext.storyEvent) {
      captured.push({ id: result.aiContext.storyEvent.id, ctx: result.aiContext });
    }
    return { result, snapshot: applyAct0Result(snapshot, result) };
  };

  let snapshot = initialAct0Snapshot();
  ({ snapshot } = resolve(snapshot, 'talk to holmes'));
  ({ snapshot } = resolve(snapshot, 'examine the woman'));
  ({ snapshot } = resolve(snapshot, 'open the door'));
  const afterArrival = snapshot;

  ({ snapshot } = resolve(snapshot, 'talk to mrs kemp'));
  ({ snapshot } = resolve(snapshot, 'examine the boots'));
  ({ snapshot } = resolve(snapshot, 'examine the pawn ticket'));
  ({ snapshot } = resolve(snapshot, 'open the workbox'));
  ({ snapshot } = resolve(snapshot, "examine nell's letters"));
  ({ snapshot } = resolve(snapshot, 'examine the card'));
  ({ snapshot } = resolve(snapshot, 'show the card to holmes'));
  const beforeChoice = snapshot;

  const give = resolve(beforeChoice, 'show the card to mrs kemp');
  resolve(beforeChoice, 'ask mrs kemp why nell hid this from her');
  const withhold = resolve(beforeChoice, 'say nothing');

  snapshot = withhold.snapshot;
  ({ snapshot } = resolve(snapshot, 'take the pawn ticket'));
  resolve(snapshot, 'talk to holmes');

  let fallbackSnapshot = afterArrival;
  ({ snapshot: fallbackSnapshot } = resolve(fallbackSnapshot, 'examine the boots'));
  const fallbackResult = resolve(fallbackSnapshot, 'open the workbox').result;
  if (fallbackResult.followUpEvent) {
    captured.push({
      id: fallbackResult.followUpEvent.storyEvent.id,
      ctx: fallbackResult.followUpEvent.aiContext,
    });
  }

  if (give.result.aiContext.storyEvent?.id !== 'act0_give_card') {
    throw new Error('Act 0 narration fixture setup did not reach the give-card choice.');
  }

  const expectedIds = [
    'act0_caller_noticed', 'act0_bell_rang', 'act0_kemp_arrives',
    'act0_kemp_business', 'act0_boots_analyzed', 'act0_reconstruction',
    'act0_give_card', 'act0_ask_why_nell_hid', 'act0_withhold_card',
    'act0_closing', 'act0_kemp_business_fallback',
  ];
  for (const id of expectedIds) {
    if (!captured.some(fixture => fixture.id === id)) {
      throw new Error(`Act 0 narration fixture setup did not reach ${id}.`);
    }
  }
  return expectedIds.map(id => captured.find(fixture => fixture.id === id)!);
}
