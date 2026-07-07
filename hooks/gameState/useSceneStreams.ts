import React, { useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { GameRepository } from '../../services/GameRepository';
import { aiService } from '../../services/AIService';
import { injectAfterHeading } from '../../services/narrationFormat';
import { gameEngine, SessionSnapshot } from '../../engine/GameEngine';
import { parseIntent } from '../../engine/intentParser';
import { ACT_NAMES, ACT_BRIDGES, ITEM_SPENT_AFTER_ACT, formatGameClock } from '../../engine/gameData';
import {
  INITIAL_LOCATION,
  INITIAL_ACT,
  INITIAL_INVENTORY,
  INITIAL_NPC_STATES,
  INITIAL_INTRODUCED_NPCS,
} from '../../constants';
import { GameHistoryItem, Investigation, NPCState } from '../../types';
import { OPENING_FALLBACK_NARRATIVE } from './narration';

export interface SceneStreamsDeps {
  user: User | null;
  activeInvestigation: Investigation | null;
  // world values read by the arrival/resume snapshots
  inventory: string[];
  flags: Record<string, boolean>;
  npcStates: Record<string, NPCState>;
  medicalPoints: number;
  moralPoints: number;
  introducedNpcs: string[];
  locationVisitCounts: Record<string, number>;
  turnCount: number;
  // setters owned by the orchestrator
  setHistory: React.Dispatch<React.SetStateAction<GameHistoryItem[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAutoScrollLocked: React.Dispatch<React.SetStateAction<boolean>>;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  scrollRef: React.RefObject<HTMLDivElement>;
  captureLocationArrival: (locationId: string, actNumber: number, timeLabel: string) => void;
}

export function useSceneStreams(deps: SceneStreamsDeps) {
  const {
    user,
    activeInvestigation,
    inventory,
    flags,
    npcStates,
    medicalPoints,
    moralPoints,
    introducedNpcs,
    locationVisitCounts,
    turnCount,
    setHistory,
    setIsLoading,
    setIsAutoScrollLocked,
    setFlags,
    scrollRef,
    captureLocationArrival,
  } = deps;

  const hasGeneratedOpening = useRef(false);

  // The "look"-based scene generators (opening / act arrival / resume) render
  // one-shot vignettes but, unlike a normal turn in handleAction, never commit
  // the engine's flagsUpdate — so the vignette's `vignette_*` guard flag was
  // never recorded and the vignette re-fired on every arrival/resume. Commit just
  // those keys (NOT location/progression flags, which gate act advancement) so a
  // vignette fires at most once. `baseFlags` is the freshest known flag set for
  // the cloud write; persistence is skipped when no investigation id is available.
  const commitVignetteFlags = useCallback((
    flagsUpdate: Record<string, boolean> | undefined,
    baseFlags: Record<string, boolean>,
    investigationId?: string,
  ) => {
    if (!flagsUpdate) return;
    const vig = Object.fromEntries(
      Object.entries(flagsUpdate).filter(([k]) => k.startsWith('vignette_'))
    );
    if (Object.keys(vig).length === 0) return;
    setFlags(prev => ({ ...prev, ...vig }));
    if (user && investigationId) {
      GameRepository.updateInvestigation(investigationId, { globalFlags: { ...baseFlags, ...vig } });
    }
  }, [user]);

  // ── Opening scene ─────────────────────────────────────────────────────────

  const generateOpeningScene = useCallback(async () => {
    if (hasGeneratedOpening.current) return;
    hasGeneratedOpening.current = true;
    // Seed the diary with the opening locale so it is never empty on a fresh start.
    captureLocationArrival(INITIAL_LOCATION, INITIAL_ACT, formatGameClock(INITIAL_ACT, 0));
    setIsLoading(true);
    setHistory([{ role: 'assistant', text: '' }]);

    try {
      const intent = parseIntent('look');
      const snapshot: SessionSnapshot = {
        location: INITIAL_LOCATION,
        inventory: INITIAL_INVENTORY,
        flags: {},
        npcStates: INITIAL_NPC_STATES as Record<string, NPCState>,
        currentAct: INITIAL_ACT,
        medicalPoints: 0,
        moralPoints: 0,
        discoveredClueIds: [],
        investigationId: undefined,
        turnsAtLocationWithoutProgress: 0,
        elapsedMinutes: 0,
        introducedNpcs: INITIAL_INTRODUCED_NPCS,
        locationVisitCounts: {},
        turnCount: 0,
        rumorEvents: {},
      };
      const result = gameEngine.resolve(intent, snapshot);
      commitVignetteFlags(result.flagsUpdate, {}, activeInvestigation?.id);

      const OPENING_FIXED_LINE = "I arrived at Baker Street on the evening of the eighth of November, 1888 - three months after the Jack the Ripper murders had begun, and the day before it concluded.\n\n";
      let lastText = '';
      for await (const update of aiService.stream({ ...result.aiContext, narrationMode: 'opening', blockquoteHint: 'none' })) {
        if (update.narrative) {
          lastText = update.narrative;
          setHistory([{ role: 'assistant', text: injectAfterHeading(lastText, OPENING_FIXED_LINE) }]);
        }
      }
      if (!lastText) setHistory([{ role: 'assistant', text: OPENING_FIXED_LINE + OPENING_FALLBACK_NARRATIVE }]);
    } catch (error) {
      console.error('Opening scene generation failed:', error);
      setHistory([{ role: 'assistant', text: OPENING_FALLBACK_NARRATIVE }]);
    } finally {
      setIsLoading(false);
    }
  }, [captureLocationArrival, commitVignetteFlags]);

  // Stream a single fresh "look" when RESUMING a saved game. The loaded
  // authoritative snapshot is the source of truth — we do NOT replay the stored
  // transcript; the diary carries the durable record. Takes the loaded values as
  // explicit args (the loader's setX calls haven't flushed to closure state yet),
  // builds a look at the SAVED location/act (not an act anchor), and starts the
  // feed clean. Mirrors streamArrivalScene minus the act-entry concerns.
  const streamResumeScene = useCallback(async (resume: {
    location: string;
    act: number;
    inventory: string[];
    flags: Record<string, boolean>;
    npcStates: Record<string, NPCState>;
    medicalPoints: number;
    moralPoints: number;
    introducedNpcs: string[];
    elapsedMinutes: number;
    investigationId?: string;
  }) => {
    setHistory([{ role: 'assistant', text: '' }]);
    setIsAutoScrollLocked(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
    try {
      const intent = parseIntent('look');
      const snapshot: SessionSnapshot = {
        location: resume.location,
        inventory: resume.inventory,
        flags: resume.flags,
        npcStates: resume.npcStates,
        currentAct: resume.act,
        medicalPoints: resume.medicalPoints,
        moralPoints: resume.moralPoints,
        discoveredClueIds: [],
        investigationId: resume.investigationId,
        turnsAtLocationWithoutProgress: 0,
        elapsedMinutes: resume.elapsedMinutes,
        introducedNpcs: resume.introducedNpcs,
        locationVisitCounts: {},
        turnCount: 0,
        rumorEvents: {},
      };
      const result = gameEngine.resolve(intent, snapshot);
      commitVignetteFlags(result.flagsUpdate, resume.flags, resume.investigationId);
      let last = '';
      for await (const update of aiService.stream({ ...result.aiContext, narrationMode: 'full', blockquoteHint: 'world_event' })) {
        if (update.narrative) {
          last = update.narrative;
          setHistory(prev => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], text: last };
            return next;
          });
        }
      }
    } catch (e) {
      console.error('Resume scene failed', e);
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], text: `### ${ACT_NAMES[resume.act] ?? `Act ${resume.act}`}` };
        return next;
      });
    }
  }, [commitVignetteFlags]);

  // Stream Watson's arrival into a new act's anchor location. Mirrors
  // generateOpeningScene but for a committed act transition. `npcUpdates` are the
  // act-entry NPC movements — merged in so the arrival sees the NEW act's positions
  // (the captured npcStates is still the pre-commit Act-N-1 snapshot).
  const streamArrivalScene = useCallback(async (
    toAct: number,
    anchor: string,
    npcUpdates: Record<string, Partial<NPCState>>,
  ) => {
    const arrivalNpcStates = { ...npcStates };
    Object.entries(npcUpdates).forEach(([id, upd]) => {
      arrivalNpcStates[id] = {
        ...(arrivalNpcStates[id] || { npcId: id, disposition: 50, status: 'alive' }),
        ...upd,
      } as NPCState;
    });
    // Mirror the act-boundary bag prune so the arrival narration never references
    // an item Watson just dropped (e.g. the spent "Dear Boss" clipping).
    const arrivalInventory = inventory.filter(item => {
      const spentAfter = ITEM_SPENT_AFTER_ACT[item];
      return spentAfter === undefined || toAct <= spentAfter;
    });
    // Fresh feed for the new act — clear the prior act's transcript and pin to
    // the top so it reads as a clean start (masthead + the act's opening scene).
    setHistory([{ role: 'assistant', text: '' }]);
    setIsAutoScrollLocked(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
    try {
      const intent = parseIntent('look');
      const snapshot: SessionSnapshot = {
        location: anchor,
        inventory: arrivalInventory,
        flags,
        npcStates: arrivalNpcStates,
        currentAct: toAct,
        medicalPoints,
        moralPoints,
        discoveredClueIds: [],
        investigationId: activeInvestigation?.id,
        turnsAtLocationWithoutProgress: 0,
        elapsedMinutes: 0,
        introducedNpcs,
        locationVisitCounts,
        turnCount,
        rumorEvents: {},
      };
      const result = gameEngine.resolve(intent, snapshot);
      commitVignetteFlags(result.flagsUpdate, flags, activeInvestigation?.id);
      // Authored bridge ("why we are here") injected after the AI's act heading,
      // mirroring the opening's fixed line. Empty for any act without one.
      const bridge = ACT_BRIDGES[toAct] ? ACT_BRIDGES[toAct] + '\n\n' : '';
      let last = '';
      for await (const update of aiService.stream({ ...result.aiContext, narrationMode: 'full', blockquoteHint: 'world_event' })) {
        if (update.narrative) {
          last = update.narrative;
          setHistory(prev => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], text: injectAfterHeading(last, bridge) };
            return next;
          });
        }
      }
    } catch (e) {
      console.error('Arrival scene failed', e);
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], text: `### Act ${toAct}` };
        return next;
      });
    }
  }, [inventory, flags, npcStates, medicalPoints, moralPoints, activeInvestigation, introducedNpcs, locationVisitCounts, turnCount, commitVignetteFlags]);

  return { hasGeneratedOpening, commitVignetteFlags, generateOpeningScene, streamResumeScene, streamArrivalScene };
}
