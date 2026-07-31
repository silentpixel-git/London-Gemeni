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
import { deriveKnowledgeEnvelope, suggestTopics } from './stories/knowledge';
import { computeTimePeriod, formatTimeLabel, resolveActDay } from './time';
import { getPresentNpcIds, maturedSpreadsFor, npcLocationAt, returnsPeriodFor } from './presence';
import type { SessionSnapshot } from './session';
import { periodOf } from './resolvers/support';
import { visibleInteractables } from './visibility';

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
  // Topic-scoped TALK: resolved by the TALK resolver against the story's fact
  // graph before narration is built. Exactly one of these is set on a TALK turn
  // that named a subject; a bare TALK sets neither and gets suggestedTopics.
  topicFact?: { label: string; statement: string };
  topicMissed?: string;
  /** Extra words beyond the normal compact-mode ceiling — threaded from an
   *  authored ShowInteraction.extraWordBudget when its resultNote is long
   *  enough that the standard budget would force cutting essential content. */
  extraWordBudget?: number;
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

  // World events (Phase 4a) — authored broadcasts whose fire time the clock
  // has passed this act. atClockMinutes earlier than the act's start means
  // the next day (the vigil's midnight, the following dawn). Delivered
  // once via world_event_* flags, lifted onto flagsUpdate in resolve().
  //
  // Computed HERE, ahead of presence and object visibility, because an event
  // that brings someone into the room (Act 0's caller) sets the very flag those
  // two gate on. Reading session.flags for them would hold both back a turn:
  // the sidebar showed the visitor and her belongings while the prose was still
  // being told the room was empty.
  const actTimeCfgForEvents = resolveActDay(story.actTimeConfig[session.currentAct] ?? story.actTimeConfig[1], session.flags);
  const clockNow = actTimeCfgForEvents.canonicalMinutes + session.elapsedMinutes + (outcome.extraMinutes ?? 0);
  const firedEvents = story.worldEvents
    .filter(e => e.act === session.currentAct && !session.flags[`world_event_${e.id}`])
    .map(e => ({ e, fireAt: e.atClockMinutes >= actTimeCfgForEvents.canonicalMinutes ? e.atClockMinutes : e.atClockMinutes + 1440 }))
    .filter(({ fireAt }) => clockNow >= fireAt)
    .sort((a, b) => a.fireAt - b.fireAt);
  const worldEventFlagsUpdate: Record<string, boolean> = {};
  for (const { e } of firedEvents) worldEventFlagsUpdate[`world_event_${e.id}`] = true;
  const worldEvents = firedEvents.length > 0 ? firedEvents.map(({ e }) => e.text) : undefined;

  // Authored staging keyed to the player-turn index (see ScriptedBeat). At most
  // one lands per turn by construction — that is the whole point of the
  // mechanism — and it is delivered once, tracked as beat_<id>.
  const scriptedBeatFlagsUpdate: Record<string, boolean> = {};
  const firedBeat = story.scriptedBeats.find(b =>
    b.act === session.currentAct &&
    b.atTurn === session.turnCount &&
    !session.flags[`beat_${b.id}`]);
  if (firedBeat) {
    scriptedBeatFlagsUpdate[`beat_${firedBeat.id}`] = true;
    if (firedBeat.setsFlag) scriptedBeatFlagsUpdate[firedBeat.setsFlag] = true;
  }
  const scriptedBeat = firedBeat ? { text: firedBeat.text, style: firedBeat.style } : undefined;

  /** Flags as they stand AFTER this turn's world events and scripted beat —
   *  what the room looks like now. A beat that admits an NPC must be visible to
   *  the presence and object-visibility reads below, or the prose is told the
   *  room is empty on the very turn the caller walks into it. */
  const flagsNow = { ...session.flags, ...worldEventFlagsUpdate, ...scriptedBeatFlagsUpdate };

  // Determine which NPCs are in this location after any movements
  const resolvedNpcStates = { ...session.npcStates };
  if (outcome.newNpcUpdates) {
    for (const [id, upd] of Object.entries(outcome.newNpcUpdates)) {
      resolvedNpcStates[id] = { ...(resolvedNpcStates[id] || { npcId: id, disposition: 50, status: 'alive' }), ...upd };
    }
  }

  const presentNPCEntries = getPresentNpcIds(story.npcs, locationId, resolvedNpcStates, session.currentAct, periodOf(story, session, outcome.extraMinutes ?? 0), flagsNow)
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

  // Who came or went since last turn. Departures are labelled from the NPC
  // record rather than from npcsPresent (they are, by definition, no longer in
  // it), and use the same alias-aware rule so a departing stranger is not
  // suddenly named.
  const previousNpcIds = session.previousNpcIds;
  const npcsArrived = previousNpcIds === undefined
    ? []
    : npcsPresent.filter(n => !previousNpcIds.includes(n.npcId)).map(n => n.label);
  const npcsDeparted = previousNpcIds === undefined
    ? []
    : previousNpcIds
        .filter(id => !npcIds.includes(id))
        .map(id => {
          const npc = story.npcs[id];
          if (!npc) return id;
          const isIntroduced = !npc.requiresIntroduction || session.introducedNpcs.includes(id);
          return isIntroduced ? npc.displayName : (npc.alias ?? story.npcAliases[id] ?? npc.displayName);
        });

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
  // act matches, the named NPC is present, and the condition holds. An array
  // instruction escalates with how long the player has been stalled here.
  const TURNS_PER_RUNG = 2;
  for (const net of story.actSafetyNets) {
    if (net.act !== session.currentAct) continue;
    if (!net.when(session)) continue;
    const present = npcsPresent.find(n => n.npcId === net.requiresNpcPresent);
    if (!present) continue;
    const rungs = Array.isArray(net.instruction) ? net.instruction : [net.instruction];
    const rung = Math.min(
      Math.floor(session.turnsAtLocationWithoutProgress / TURNS_PER_RUNG),
      rungs.length - 1,
    );
    npcScriptedLines.push({ npcId: present.npcId, label: present.label, instruction: rungs[rung] });
  }

  // Idle beat — at most ONE flat ambient beat per turn across ALL present
  // NPCs, and none on a turn where a scripted moment or safety net fired
  // (those are the scene's texture that round). The NPC is chosen round-robin
  // by turn count so no one hogs the background; within the chosen NPC,
  // location-scoped beats (props that live here) win over portable quirks.
  // The beat index strides by the round-robin QUOTIENT, not turnCount itself —
  // with a shared counter, gcd(eligible.length, beats.length) > 1 would lock
  // each NPC to a fixed subset of their beats forever.
  if (npcScriptedLines.length === 0) {
    const eligible = npcsPresent
      .filter(({ npcId }) => npcId !== outcome.targetNpcId)
      .map(({ npcId, label }) => {
        const applicable = (story.npcs[npcId]?.idleBeats ?? []).filter(b =>
          (!b.locationId || b.locationId === locationId) &&
          (b.act === undefined || b.act === session.currentAct));
        const located = applicable.filter(b => b.locationId);
        return { npcId, label, beats: located.length > 0 ? located : applicable };
      })
      .filter(e => e.beats.length > 0);
    if (eligible.length > 0) {
      const { npcId, label, beats } = eligible[session.turnCount % eligible.length];
      const beatIndex = Math.floor(session.turnCount / eligible.length) % beats.length;
      npcScriptedLines.push({
        npcId, label,
        // "Once" is explicit because the model was restating the same piece of
        // business two and three times within a single reply, which made a
        // rotating pool look far smaller than it is.
        instruction: `Background only, no emphasis. Give it one clause and do not restate it later in the reply: ${beats[beatIndex].text}`,
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
      // This fires on EVERY turn the companion is present and not interviewed,
      // so its wording reaches the model more often than anything else in the
      // prompt. Without the caveat the model echoes its vocabulary back turn
      // after turn — a playtest found "restless" in 12 of 20 replies, traced to
      // the single word in the Act 0 catch-all variant below.
      npcScriptedLines.push({
        npcId: cd.npcId,
        label: present.label,
        instruction: `Demeanor note (a register for how to play him this scene, NOT a line to render — never reuse its wording, and vary how it shows from turn to turn): ${variant.text}`,
      });
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
  const availableObjects = visibleInteractables(story, locationId, flagsNow)
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
  //
  // ONE blockquote per turn, always. A blockquote-styled scripted beat is
  // appended to the finished prose, and the model has no way to know that — so
  // the turn has to give up its own, or the reader gets two quoted blocks
  // stacked against each other and the form stops meaning anything.
  const blockquoteHint: NarrationContext['blockquoteHint'] =
    scriptedBeat?.style === 'blockquote'
      ? 'none'
      : narrationMode === 'full'
        ? 'world_event'
        : Math.random() < 0.3 ? 'inner_thought' : 'none';

  // Compute current in-game time — anchored to the act's canonical start,
  // advanced by the minutes elapsed this act (tracked in the hook).
  const act = session.currentAct;
  const actTimeCfg   = resolveActDay(story.actTimeConfig[act] ?? story.actTimeConfig[1], session.flags);
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
        ...deriveKnowledgeEnvelope(story.facts, outcome.targetNpcId, session.currentAct, flagsNow),
      ],
      recentlyHeard,
      playerQuestion: intent.raw,
      topic: outcome.topicFact,
      topicMissed: outcome.topicMissed,
      // Only a bare TALK offers subjects. Once the player has named one, the
      // reply belongs to that subject alone — trailing a list of alternatives
      // after an answer reads as a menu and undoes the free-text illusion.
      suggestedTopics: !outcome.topicFact && !outcome.topicMissed && intent.type === 'talk'
        ? suggestTopics(story.facts, outcome.targetNpcId, session.currentAct, session.flags)
        : undefined,
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
    npcsArrived,
    npcsDeparted,
    scriptedBeat,
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
    extraWordBudget: outcome.extraWordBudget,
    npcScriptedLines: npcScriptedLines.length > 0 ? npcScriptedLines : undefined,
    // Pass introduction flags so useGameState can update introducedNpcs
    _introductionFlagsUpdate: Object.keys(introductionFlagsUpdate).length > 0
      ? introductionFlagsUpdate
      : undefined,
    // Vignette once-only flags — lifted onto result.flagsUpdate in resolve()
    _vignetteFlagsUpdate: Object.keys(vignetteFlagsUpdate).length > 0
      ? vignetteFlagsUpdate
      : undefined,
    // World-event and scripted-beat once-only flags — lifted onto
    // result.flagsUpdate in resolve(). They share this channel because they are
    // the same kind of thing: authored beats that fire once and must be
    // recorded, or they re-fire on the next turn.
    _worldEventFlagsUpdate: Object.keys({ ...worldEventFlagsUpdate, ...scriptedBeatFlagsUpdate }).length > 0
      ? { ...worldEventFlagsUpdate, ...scriptedBeatFlagsUpdate }
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
  const whereId = npcLocationAt(story.npcs, npcId, session.currentAct, period, session.npcStates, session.flags);
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
