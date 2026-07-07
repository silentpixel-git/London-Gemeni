/**
 * engine/narrationContext.ts
 *
 * Builds the NarrationContext handed to the AI — every field derived from
 * verified world data, never invented — plus the two blocked-result
 * helpers that wrap it. Extracted verbatim from GameEngine.ts (backlog #8
 * god-file split).
 */

import { EngineResult, NarrationContext, NPCState } from '../types';
import { ParsedIntent } from './intentParser';
import type { StoryManifest, NPCDefinition } from './stories/types';
import { deriveKnowledgeEnvelope } from './stories/knowledge';
import { computeTimePeriod, formatTimeLabel } from './time';
import { getPresentNpcIds, maturedSpreadsFor, npcLocationAt, returnsPeriodFor } from './presence';
import type { SessionSnapshot } from './session';
import { periodOf } from './resolvers/support';

/** The verified outcome a resolver hands to buildNarrationContext. */
export interface NarrationOutcome {
  success: boolean;
  actionDescription: string;
  actionResultNote: string;
  newClueDefs: Array<{ name: string; description: string; holmesDeduction: string }>;
  itemsGained?: string[];         // Inventory items gained this turn (verified)
  targetLocationId?: string;      // For move actions, the destination
  targetNpcId?: string;
  newNpcUpdates?: Record<string, Partial<NPCState>>;
  isDeduction?: boolean;
  deductionCorrect?: boolean;
  extraMinutes?: number;
}

/** An NPC's introduction mode; absent = self-introduces on first TALK. */
function introductionOf(npc: NPCDefinition): { type: 'self' } | { type: 'document'; objectId: string } {
  return npc.introduction ?? { type: 'self' };
}

/**
 * Build the NarrationContext that gets sent to the AI.
 * All fields are derived from verified world data — never invented.
 */
export function buildNarrationContext(
  story: StoryManifest,
  intent: ParsedIntent,
  session: SessionSnapshot,
  outcome: NarrationOutcome
): NarrationContext {
  // Use destination location for move actions, otherwise current
  const locationId = outcome.targetLocationId || session.location;
  const loc = story.locations[locationId] || story.locations[session.location];

  // Determine which NPCs are in this location after any movements
  const resolvedNpcStates = { ...session.npcStates };
  if (outcome.newNpcUpdates) {
    for (const [id, upd] of Object.entries(outcome.newNpcUpdates)) {
      resolvedNpcStates[id] = { ...(resolvedNpcStates[id] || { npcId: id, disposition: 50, status: 'alive' }), ...upd };
    }
  }

  const presentNPCEntries = getPresentNpcIds(story.npcs, locationId, resolvedNpcStates, session.currentAct, periodOf(story, session, outcome.extraMinutes ?? 0))
    .map(npcId => [npcId, story.npcs[npcId]] as const);

  // Build alias-aware NPC list for NarrationContext
  const npcsPresent = presentNPCEntries.map(([npcId, npc]) => {
    const isIntroduced = !npc.requiresIntroduction ||
      session.introducedNpcs.includes(npcId);
    const label = isIntroduced
      ? npc.displayName
      : (npc.alias ?? story.npcAliases[npcId] ?? npc.displayName);
    return { label, npcId, isIntroduced };
  });

  // Legacy flat arrays kept for internal engine use (NPC memory lookup etc.)
  const npcIds = presentNPCEntries.map(([id]) => id);

  // Scripted NPC presence moments — fire when NPC present + location matches + flag satisfied.
  // These are directorial instructions injected into the AI prompt; no state changes.
  const npcScriptedLines: Array<{ npcId: string; label: string; instruction: string }> = [];
  for (const { npcId, label } of npcsPresent) {
    const npc = story.npcs[npcId];
    if (!npc.scriptedLines) continue;
    for (const line of npc.scriptedLines) {
      if (line.locationId !== locationId) continue;
      if (line.triggerFlag && !session.flags[line.triggerFlag]) continue;
      if (line.act !== undefined && line.act !== session.currentAct) continue;
      npcScriptedLines.push({ npcId, label, instruction: line.instruction });
    }
  }

  // Act safety nets — story-authored failure-path nudges. Fire when the
  // act matches, the named NPC is present, and the condition holds.
  for (const net of story.actSafetyNets) {
    if (net.act !== session.currentAct) continue;
    if (!net.when(session)) continue;
    const present = npcsPresent.find(n => n.npcId === net.requiresNpcPresent);
    if (!present) continue;
    npcScriptedLines.push({ npcId: present.npcId, label: present.label, instruction: net.instruction });
  }

  // Idle behaviors — one rotating flat beat per present NPC who is not being
  // interviewed this turn, cycled by turn count so it never repeats twice running.
  for (const { npcId, label } of npcsPresent) {
    if (npcId === outcome.targetNpcId) continue;
    const idle = story.npcs[npcId]?.idleBehaviors;
    if (idle && idle.length > 0) {
      npcScriptedLines.push({
        npcId, label,
        instruction: `Background only, no emphasis: ${idle[session.turnCount % idle.length]}`,
      });
    }
  }

  // Companion case-state demeanor — derived, no new state. First matching
  // variant wins; injected only when the NPC is present and not interviewed.
  for (const cd of story.companionDemeanors) {
    if (outcome.targetNpcId === cd.npcId) continue;
    const present = npcsPresent.find(n => n.npcId === cd.npcId);
    if (!present) continue;
    const variant = cd.variants.find(v => v.when(session));
    if (variant) {
      npcScriptedLines.push({ npcId: cd.npcId, label: present.label, instruction: `Demeanor note: ${variant.text}` });
    }
  }

  // Available exits (filtered by act)
  const availableExits = (loc.exits || [])
    .filter(exitId => {
      const exitLoc = story.locations[exitId];
      return exitLoc && exitLoc.act <= session.currentAct;
    })
    .map(exitId => story.locations[exitId]?.shortName || exitId);

  // Available objects
  const availableObjects = (loc.interactables || [])
    .map(id => story.objectDisplayNames[id] || id);

  // Recent NPC memory for NPCs present (keyed by label — alias or displayName)
  const npcRecentMemory: Record<string, string[]> = {};
  for (const [npcId, state] of Object.entries(resolvedNpcStates)) {
    const entry = npcsPresent.find(n => n.npcId === npcId);
    if (entry && state.memory && state.memory.length > 0) {
      npcRecentMemory[entry.label] = state.memory.slice(0, 2);
    }
  }

  // 'full' narration: moving to a new location or looking around with no specific target.
  // 'compact' narration: examining an object, talking, taking, using, etc. A
  // blocked move (invalid/unavailable destination) must stay 'compact' too —
  // the full template has no instruction to acknowledge a failed action, so a
  // blocked move rendered in full mode silently reads as a normal look-around.
  const narrationMode: 'full' | 'compact' =
    (intent.type === 'move' && outcome.success) ||
    (intent.type === 'examine' && !intent.targetId) ||
    (intent.type === 'other' && !intent.targetId)
      ? 'full'
      : 'compact';

  // Full mode always gets a world_event blockquote.
  // Compact mode gets an inner_thought ~30% of the time — less frequent so each one lands harder.
  const blockquoteHint: NarrationContext['blockquoteHint'] =
    narrationMode === 'full'
      ? 'world_event'
      : Math.random() < 0.3 ? 'inner_thought' : 'none';

  // Compute current in-game time — anchored to the act's canonical start,
  // advanced by the minutes elapsed this act (tracked in the hook).
  const act = session.currentAct;
  const actTimeCfg   = story.actTimeConfig[act] ?? story.actTimeConfig[1];
  const totalMinutes = actTimeCfg.canonicalMinutes + session.elapsedMinutes + (outcome.extraMinutes ?? 0);

  // Dynamic Witness Interrogation — include NPC knowledge envelope for talk actions
  let targetNpcInterview: NarrationContext['targetNpcInterview'] | undefined;
  const rumorAckFlagsUpdate: Record<string, boolean> = {};
  if (outcome.targetNpcId && story.npcs[outcome.targetNpcId]) {
    const npc = story.npcs[outcome.targetNpcId];
    const isIntroduced = !npc.requiresIntroduction ||
      session.introducedNpcs.includes(outcome.targetNpcId);
    // True only on the single turn the player first talks to a self-introducing
    // NPC — mirrors the introductionFlagsUpdate condition below. On this turn the
    // sidebar reveals the real name; the AI must narrate the name reveal in-fiction
    // to match. Edmund never self-introduces (his name comes from the forensic note).
    const introducingThisTurn = !!npc.requiresIntroduction &&
      !session.introducedNpcs.includes(outcome.targetNpcId) &&
      introductionOf(npc).type === 'self';
    const label = isIntroduced
      ? npc.displayName
      : (npc.alias ?? story.npcAliases[outcome.targetNpcId] ?? npc.displayName);

    // Phase 4b — matured hearsay for this NPC, prepended to the envelope.
    // The nudge (recentlyHeard + ack flag) fires only on a successful TALK.
    const matured = maturedSpreadsFor(
      story.rumors, session.rumorEvents, outcome.targetNpcId, act, totalMinutes);
    let recentlyHeard: string[] | undefined;
    if (intent.type === 'talk' && outcome.success) {
      const unacked = matured.filter(
        m => !session.flags[`rumor_ack_${m.rumorId}_${outcome.targetNpcId}`]);
      if (unacked.length > 0) {
        recentlyHeard = unacked.map(m => m.statement);
        for (const m of unacked) {
          rumorAckFlagsUpdate[`rumor_ack_${m.rumorId}_${outcome.targetNpcId}`] = true;
        }
      }
    }

    targetNpcInterview = {
      npcId: outcome.targetNpcId,
      label,
      isIntroduced,
      introducingThisTurn,
      realName: introducingThisTurn ? npc.displayName : undefined,
      role: npc.role,
      speakingStyle: npc.speakingStyle,
      personality: npc.personality,
      knowledgeEnvelope: [
        ...matured.map(m => m.statement),
        ...deriveKnowledgeEnvelope(story.facts, outcome.targetNpcId, session.currentAct),
      ],
      recentlyHeard,
      playerQuestion: intent.raw,
    };
  }

  // Atmospheric fallback note — used when examined object triggers no clue.
  // Act-keyed override first ("<objectId>@<act>") for act-variant descriptions.
  const atmosphericNote =
    intent.targetId && outcome.newClueDefs.length === 0
      ? (story.atmosphericNotes[locationId]?.[`${intent.targetId}@${session.currentAct}`]
          ?? story.atmosphericNotes[locationId]?.[intent.targetId])
      : undefined;

  // Introduction flags: talking to an NPC introduces them (if they self-introduce)
  // Document-based introductions are handled by the examine check below.
  const introductionFlagsUpdate: Record<string, boolean> = {};
  if (outcome.targetNpcId) {
    const npc = story.npcs[outcome.targetNpcId];
    if (npc?.requiresIntroduction &&
        !session.introducedNpcs.includes(outcome.targetNpcId) &&
        introductionOf(npc).type === 'self') {
      // NPC self-introduces on first TALK
      introductionFlagsUpdate[`npc_introduced_${outcome.targetNpcId}`] = true;
    }
  }
  // Document-introduced NPCs: examining their introduction object reveals the name
  if (intent.targetId) {
    for (const [npcId, npcDef] of Object.entries(story.npcs)) {
      const intro = introductionOf(npcDef);
      if (intro.type === 'document' &&
          intro.objectId === intent.targetId &&
          !session.introducedNpcs.includes(npcId)) {
        introductionFlagsUpdate[`npc_introduced_${npcId}`] = true;
      }
    }
  }

  const timePeriod   = computeTimePeriod(totalMinutes);
  const timeLabel    = formatTimeLabel(totalMinutes, actTimeCfg.dayOfWeek, actTimeCfg.displayDate);

  const locationVisitCount = (session.locationVisitCounts[locationId] ?? 0) + 1;

  // Intra-act weather drift — the act's weather may shift late in the act
  const baseWeather = story.actWeather[act] ?? story.actWeather[1];
  const weather = baseWeather.lateShift && session.elapsedMinutes + (outcome.extraMinutes ?? 0) >= baseWeather.lateShift.afterMinutes
    ? { condition: baseWeather.lateShift.condition, label: baseWeather.lateShift.label }
    : { condition: baseWeather.condition, label: baseWeather.label };

  // One-shot vignette — fires on full-mode narration only, at most once each
  // per playthrough (flag vignette_<locId>_<idx>), replacing the random seed.
  let vignette: string | undefined;
  const vignetteFlagsUpdate: Record<string, boolean> = {};
  if (narrationMode === 'full' && loc.vignettes) {
    const idx = loc.vignettes.findIndex((v, i) =>
      !session.flags[`vignette_${locationId}_${i}`] && (v.act === undefined || v.act === act));
    if (idx !== -1) {
      vignette = loc.vignettes[idx].text;
      vignetteFlagsUpdate[`vignette_${locationId}_${idx}`] = true;
    }
  }

  // Ambient extra — prose-only background figure, rotated by visit count
  const ambientExtra = loc.extras && loc.extras.length > 0
    ? loc.extras[(locationVisitCount - 1) % loc.extras.length]
    : undefined;

  // World events (Phase 4a) — authored broadcasts whose fire time the clock
  // has passed this act. atClockMinutes earlier than the act's start means
  // the next day (the vigil's midnight, the following dawn). Delivered
  // once via world_event_* flags, lifted onto flagsUpdate in resolve().
  const worldEventFlagsUpdate: Record<string, boolean> = {};
  const clockNow = totalMinutes; // already includes extraMinutes (WAIT spans deliver what they cross)
  const firedEvents = story.worldEvents
    .filter(e => e.act === act && !session.flags[`world_event_${e.id}`])
    .map(e => ({ e, fireAt: e.atClockMinutes >= actTimeCfg.canonicalMinutes ? e.atClockMinutes : e.atClockMinutes + 1440 }))
    .filter(({ fireAt }) => clockNow >= fireAt)
    .sort((a, b) => a.fireAt - b.fireAt);
  for (const { e } of firedEvents) worldEventFlagsUpdate[`world_event_${e.id}`] = true;
  const worldEvents = firedEvents.length > 0 ? firedEvents.map(({ e }) => e.text) : undefined;

  return {
    locationName: loc.name,
    locationAtmosphere: loc.atmosphere,
    locationDescription: loc.description,
    locationVisitCount,
    locationTimeframe: loc.timeframe ?? 'present',
    locationReconstitutionNote: loc.reconstitutionNote,
    act,
    actName: story.actNames[act] || `Act ${act}`,
    timeLabel,
    timePeriod,
    weather,
    vignette,
    worldEvents,
    ambientExtra,
    npcsPresent,
    availableObjects,
    availableExits,
    inventory: session.inventory,
    watsonStats: {
      medicalPoints: session.medicalPoints,
      moralPoints: session.moralPoints,
    },
    actionType: intent.type,
    actionSuccess: outcome.success,
    actionDescription: outcome.actionDescription,
    actionResultNote: outcome.actionResultNote,
    newCluesDiscovered: outcome.newClueDefs.map(c => ({
      name: c.name,
      description: c.description,
      holmesDeduction: c.holmesDeduction,
    })),
    itemsGained: outcome.itemsGained?.length ? outcome.itemsGained : undefined,
    atmosphericNote,
    npcRecentMemory: Object.keys(npcRecentMemory).length > 0 ? npcRecentMemory : undefined,
    targetNpcInterview,
    narrationMode,
    blockquoteHint,
    npcScriptedLines: npcScriptedLines.length > 0 ? npcScriptedLines : undefined,
    // Pass introduction flags so useGameState can update introducedNpcs
    _introductionFlagsUpdate: Object.keys(introductionFlagsUpdate).length > 0
      ? introductionFlagsUpdate
      : undefined,
    // Vignette once-only flags — lifted onto result.flagsUpdate in resolve()
    _vignetteFlagsUpdate: Object.keys(vignetteFlagsUpdate).length > 0
      ? vignetteFlagsUpdate
      : undefined,
    // World-event once-only flags — lifted onto result.flagsUpdate in resolve()
    _worldEventFlagsUpdate: Object.keys(worldEventFlagsUpdate).length > 0
      ? worldEventFlagsUpdate
      : undefined,
    // Rumor-ack once-only flags — lifted onto result.flagsUpdate in resolve()
    _rumorAckFlagsUpdate: Object.keys(rumorAckFlagsUpdate).length > 0
      ? rumorAckFlagsUpdate
      : undefined,
  } as NarrationContext & {
    _introductionFlagsUpdate?: Record<string, boolean>;
    _vignetteFlagsUpdate?: Record<string, boolean>;
    _worldEventFlagsUpdate?: Record<string, boolean>;
    _rumorAckFlagsUpdate?: Record<string, boolean>;
  };
}

/**
 * Returns a blocked EngineResult with appropriate context.
 */
export function blocked(
  story: StoryManifest,
  intent: ParsedIntent,
  session: SessionSnapshot,
  blockedReason: string,
  actionResultNote: string
): EngineResult {
  return {
    actionSuccess: false,
    actionType: intent.type,
    blockedReason,
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
      success: false,
      actionDescription: `Watson attempted: "${intent.raw}"`,
      actionResultNote,
      newClueDefs: [],
    }),
  };
}

/**
 * Blocked result for addressing an NPC who is scheduled elsewhere right now.
 * Diegetic redirect — never a dead end: the note carries where they are and
 * when the schedule brings them back, alias-masked until introduced.
 */
export function absentNpcBlocked(
  story: StoryManifest,
  intent: ParsedIntent,
  session: SessionSnapshot,
  npcId: string,
  attemptedVerb: string,
): EngineResult {
  const npc = story.npcs[npcId];
  const period = periodOf(story, session);
  const introduced = !npc.requiresIntroduction || session.introducedNpcs.includes(npcId);
  const label = introduced
    ? npc.displayName
    : (npc.alias ?? story.npcAliases[npcId] ?? npc.displayName);
  const whereId = npcLocationAt(story.npcs, npcId, session.currentAct, period, session.npcStates);
  const where = story.locations[whereId];
  const returns = returnsPeriodFor(npc, session.currentAct, session.location, period);
  const currentLocName = story.locations[session.location].name;

  return blocked(
    story,
    intent,
    session,
    `${label} is not here at the moment.`,
    `ABSENT PERSON — Watson tried to ${attemptedVerb} ${label}, but they are not at ${currentLocName} right now. ` +
    (where ? `They are presently at ${where.name}. ` : `They are nowhere to be found in Whitechapel at present. `) +
    (returns ? `They are expected back here come ${returns}. ` : '') +
    `Convey this diegetically (an attendant's word, a note on a door, the empty room itself) in 1–2 sentences. ` +
    `Watson is NOT stuck: he may follow them there, wait, or turn to something else. Do not invent dialogue with the absent person.`
  );
}
