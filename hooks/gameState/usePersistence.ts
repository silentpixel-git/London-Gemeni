import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { GameRepository } from '../../services/GameRepository';
import { LOCATIONS, formatGameClock } from '../../engine/gameData';
import {
  INITIAL_LOCATION,
  INITIAL_ACT,
  INITIAL_INVENTORY,
  INITIAL_NPC_STATES,
  INITIAL_JOURNAL,
  INITIAL_INTRODUCED_NPCS,
} from '../../constants';
import { GameHistoryItem, GameState, Investigation, NPCState, STIMEntry, RumorEvents, PendingActTransition, DiaryEntry } from '../../types';
import { supabase } from '../../supabase';

export interface PersistenceDeps {
  user: User | null;
  activeInvestigation: Investigation | null;
  setActiveInvestigation: React.Dispatch<React.SetStateAction<Investigation | null>>;
  // world values read by handleSaveGame
  history: GameHistoryItem[];
  location: string;
  inventory: string[];
  medicalPoints: number;
  moralPoints: number;
  npcStates: Record<string, NPCState>;
  flags: Record<string, boolean>;
  journalNotes: string;
  stim: Record<string, STIMEntry>;
  introducedNpcs: string[];
  currentAct: number;
  rumorEvents: RumorEvents;
  // world setters written by the loaders + realtime sync
  setLocation: React.Dispatch<React.SetStateAction<string>>;
  setInventory: React.Dispatch<React.SetStateAction<string[]>>;
  setMedicalPoints: React.Dispatch<React.SetStateAction<number>>;
  setMoralPoints: React.Dispatch<React.SetStateAction<number>>;
  setCurrentAct: React.Dispatch<React.SetStateAction<number>>;
  setElapsedMinutes: React.Dispatch<React.SetStateAction<number>>;
  setRumorEvents: React.Dispatch<React.SetStateAction<RumorEvents>>;
  setIsGameOver: React.Dispatch<React.SetStateAction<boolean>>;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setJournalNotes: React.Dispatch<React.SetStateAction<string>>;
  setIntroducedNpcs: React.Dispatch<React.SetStateAction<string[]>>;
  setNpcStates: React.Dispatch<React.SetStateAction<Record<string, NPCState>>>;
  setStim: React.Dispatch<React.SetStateAction<Record<string, STIMEntry>>>;
  setTurnCount: React.Dispatch<React.SetStateAction<number>>;
  setHistory: React.Dispatch<React.SetStateAction<GameHistoryItem[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setNotification: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' } | null>>;
  // act-break state cleared on load (owned by orchestrator)
  setPendingActTransition: React.Dispatch<React.SetStateAction<PendingActTransition | null>>;
  setIsActBreakReady: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCurtainPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  // diary (from useDiary)
  diaryEntries: DiaryEntry[];
  setDiaryEntries: React.Dispatch<React.SetStateAction<DiaryEntry[]>>;
  diarySeqRef: React.MutableRefObject<number>;
  loggedLocationsRef: React.MutableRefObject<Set<string>>;
  // scenes (from useSceneStreams)
  hasGeneratedOpening: React.MutableRefObject<boolean>;
  generateOpeningScene: () => Promise<void>;
  streamResumeScene: (resume: { location: string; act: number; inventory: string[]; flags: Record<string, boolean>; npcStates: Record<string, NPCState>; medicalPoints: number; moralPoints: number; introducedNpcs: string[]; elapsedMinutes: number; investigationId?: string }) => Promise<void>;
}

export function usePersistence(deps: PersistenceDeps) {
  const {
    user,
    activeInvestigation,
    setActiveInvestigation,
    history,
    location,
    inventory,
    medicalPoints,
    moralPoints,
    npcStates,
    flags,
    journalNotes,
    stim,
    introducedNpcs,
    currentAct,
    rumorEvents,
    setLocation,
    setInventory,
    setMedicalPoints,
    setMoralPoints,
    setCurrentAct,
    setElapsedMinutes,
    setRumorEvents,
    setIsGameOver,
    setFlags,
    setJournalNotes,
    setIntroducedNpcs,
    setNpcStates,
    setStim,
    setTurnCount,
    setHistory,
    setIsLoading,
    setNotification,
    setPendingActTransition,
    setIsActBreakReady,
    setIsCurtainPlaying,
    diaryEntries,
    setDiaryEntries,
    diarySeqRef,
    loggedLocationsRef,
    hasGeneratedOpening,
    generateOpeningScene,
    streamResumeScene,
  } = deps;

  // ── Persistence / UI ────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [slots, setSlots] = useState<Investigation[]>([]);

  // ── Save / load ───────────────────────────────────────────────────────────

  // Hydrate all React state from a cloud investigation (a save slot).
  // Shared by the slot menu (handleSelectSlot) and the anonymous-fallback loader.
  const loadInvestigationIntoState = useCallback(async (investigation: Investigation) => {
    const inv = (investigation as any).inventory || INITIAL_INVENTORY;
    // Use ?? not || — Act 0 (the prologue) is a valid act and must not fall back to 1.
    const act = (investigation as any).currentAct ?? INITIAL_ACT;
    // Strip inert pre-refactor reload markers so old saves don't carry dead flags.
    const loadedFlags = Object.fromEntries(
      Object.entries(investigation.globalFlags as Record<string, boolean>)
        .filter(([k]) => !k.startsWith('__pending_act_to_'))
    );
    const loadedIntroduced = (investigation as any).introducedNpcs?.length
      ? ((investigation as any).introducedNpcs as string[])
      : INITIAL_INTRODUCED_NPCS;
    const loadedElapsed = (investigation as any).elapsedMinutes ?? 0;

    setLocation(investigation.currentLocation);
    setInventory(inv);
    setMedicalPoints(investigation.medicalPoints || 0);
    setMoralPoints(investigation.moralPoints || 0);
    setCurrentAct(act);
    setIsGameOver(investigation.status === 'solved');
    setFlags(loadedFlags);
    setJournalNotes(investigation.journalNotes || INITIAL_JOURNAL);
    setIntroducedNpcs(loadedIntroduced);
    setElapsedMinutes(loadedElapsed);
    setRumorEvents((investigation as Investigation).rumorEvents ?? {});
    setActiveInvestigation(investigation);

    // Load Watson's diary casebook for this investigation.
    const loadedDiary = await GameRepository.getDiaryEntries(investigation.id);
    setDiaryEntries(loadedDiary);
    diarySeqRef.current = loadedDiary.reduce((m, e) => Math.max(m, e.sequence), -1) + 1;
    loggedLocationsRef.current = new Set(loadedDiary.filter(e => e.kind === 'location').map(e => e.refId));

    const npcMap = await GameRepository.getAllNPCStates(investigation.id);
    const loadedNpcStates: Record<string, NPCState> = Object.keys(npcMap).length > 0
      ? { ...(INITIAL_NPC_STATES as Record<string, NPCState>), ...npcMap }
      : (INITIAL_NPC_STATES as Record<string, NPCState>);
    setNpcStates(loadedNpcStates);

    setStim((investigation as any).stim || {});

    // The resume look replaces the opening; clear any held transition.
    setPendingActTransition(null);
    setIsActBreakReady(false);
    setIsCurtainPlaying(false);

    // A brand-new slot (untouched prologue) keeps the authored dated intro.
    const isFreshSlot = act === INITIAL_ACT
      && investigation.currentLocation === INITIAL_LOCATION
      && Object.keys(loadedFlags).length === 0
      && loadedDiary.length === 0;

    if (isFreshSlot) {
      hasGeneratedOpening.current = false;
      setHistory([]);
      generateOpeningScene();
      return;
    }

    // Resume: do NOT replay the stored transcript — open with one fresh look at
    // the saved location/act. The diary holds the durable record of clues/objects.
    hasGeneratedOpening.current = true;
    setIsLoading(true);
    try {
      await streamResumeScene({
        location: investigation.currentLocation,
        act,
        inventory: inv,
        flags: loadedFlags,
        npcStates: loadedNpcStates,
        medicalPoints: investigation.medicalPoints || 0,
        moralPoints: investigation.moralPoints || 0,
        introducedNpcs: loadedIntroduced,
        elapsedMinutes: loadedElapsed,
        investigationId: investigation.id,
      });
    } finally {
      setIsLoading(false);
    }
    setNotification({ message: 'Investigation Resumed!', type: 'success' });
  }, [generateOpeningScene, streamResumeScene]);

  const handleSaveGame = useCallback(async (silent = false) => {
    setIsSaving(true);

    const gameState: GameState = {
      history,
      location,
      inventory,
      medicalPoints,
      moralPoints,
      npcStates,
      flags,
      journalNotes,
      diaryEntries,
      introducedNpcs,
      currentAct,
      rumorEvents,
      timestamp: new Date().toLocaleString(),
    };

    try {
      localStorage.setItem('londonBleedsSave', JSON.stringify(gameState));

      if (user && activeInvestigation) {
        const updated = await GameRepository.updateInvestigation(activeInvestigation.id, {
          currentLocation: location,
          medicalPoints,
          moralPoints,
          currentAct,
          inventory,
          globalFlags: flags,
          journalNotes,
          stim,
          introducedNpcs,
          rumorEvents,
        });
        if (updated) setActiveInvestigation(updated as Investigation);
        // Safety net: upsert the whole diary (idempotent by id) so any entry
        // captured before activeInvestigation was set still reaches the DB.
        if (diaryEntries.length > 0) {
          GameRepository.addDiaryEntries(activeInvestigation.id, diaryEntries);
        }
        if (!silent) setNotification({ message: 'Game Saved to Cloud!', type: 'success' });
      } else {
        if (!silent) setNotification({ message: 'Game Saved Locally!', type: 'success' });
      }
    } catch (e) {
      console.error('Save failed', e);
      if (!silent) setNotification({ message: 'Failed to save game.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeInvestigation, history, location, inventory, medicalPoints, moralPoints, npcStates, flags, journalNotes, diaryEntries, currentAct, introducedNpcs]);

  // Always-fresh handle to handleSaveGame so async flows (e.g. beginNextAct) can
  // persist the LATEST committed state rather than a stale closure snapshot.
  const handleSaveGameRef = useRef(handleSaveGame);
  useEffect(() => { handleSaveGameRef.current = handleSaveGame; }, [handleSaveGame]);

  const handleLoadGame = useCallback(async () => {
    // Hydrate authoritative state from a local (guest) save and open with one
    // fresh look — the stored transcript is ignored (diary carries continuity).
    // Local saves don't store currentAct/elapsedMinutes, so the act is derived
    // from the saved location and the clock starts at the act's canonical time.
    const resumeFromLocalSave = async (state: GameState) => {
      // Prefer the saved act; fall back to location-derived for older local saves
      // (ambiguous for shared anchors, e.g. bond_office serves Act 5 and Act 6).
      const guestAct = state.currentAct ?? LOCATIONS[state.location]?.act ?? INITIAL_ACT;
      const guestNpcStates = state.npcStates || (INITIAL_NPC_STATES as Record<string, NPCState>);
      const guestIntroduced = state.introducedNpcs?.length ? state.introducedNpcs : INITIAL_INTRODUCED_NPCS;
      setLocation(state.location);
      setInventory(state.inventory);
      setMedicalPoints(state.medicalPoints || 0);
      setMoralPoints(state.moralPoints || 0);
      setCurrentAct(guestAct);
      setElapsedMinutes(0);
      setRumorEvents(state.rumorEvents ?? {});
      setFlags(state.flags || {});
      setJournalNotes(state.journalNotes || INITIAL_JOURNAL);
      setNpcStates(guestNpcStates);
      setIntroducedNpcs(guestIntroduced);
      if (state.diaryEntries) {
        setDiaryEntries(state.diaryEntries);
        diarySeqRef.current = state.diaryEntries.reduce((m, e) => Math.max(m, e.sequence), -1) + 1;
        loggedLocationsRef.current = new Set(state.diaryEntries.filter(e => e.kind === 'location').map(e => e.refId));
      }
      setPendingActTransition(null);
      setIsActBreakReady(false);
      setIsCurtainPlaying(false);
      hasGeneratedOpening.current = true;
      setIsLoading(true);
      try {
        await streamResumeScene({
          location: state.location,
          act: guestAct,
          inventory: state.inventory,
          flags: state.flags || {},
          npcStates: guestNpcStates,
          medicalPoints: state.medicalPoints || 0,
          moralPoints: state.moralPoints || 0,
          introducedNpcs: guestIntroduced,
          elapsedMinutes: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    try {
      if (user) {
        const investigation = await GameRepository.getActiveInvestigation(user.id);
        if (investigation) {
          await loadInvestigationIntoState(investigation);
        }
        return;
      }

      // Local fallback (not logged in)
      const savedData = localStorage.getItem('londonBleedsSave');
      if (savedData) {
        const state = JSON.parse(savedData) as GameState;
        setNotification({ message: `Local Save Loaded! (${state.timestamp})`, type: 'success' });
        await resumeFromLocalSave(state);
      }
    } catch (e) {
      console.error('Load failed', e);

      // Cloud unreachable — attempt local save fallback so the game is never stuck
      try {
        const savedData = localStorage.getItem('londonBleedsSave');
        if (savedData) {
          const state = JSON.parse(savedData) as GameState;
          if (state.location) {
            setNotification({ message: 'Cloud unavailable — local save loaded.', type: 'error' });
            await resumeFromLocalSave(state);
            return;
          }
        }
      } catch {}

      // No local save either — generate a fresh opening scene so the screen is never blank
      setNotification({ message: 'Cloud unavailable — starting fresh locally.', type: 'error' });
      if (history.length === 0) {
        hasGeneratedOpening.current = false;
        generateOpeningScene();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, generateOpeningScene, loadInvestigationIntoState, streamResumeScene]);

  // ── Save slots ──────────────────────────────────────────────────────────────
  // On login the app shows a slot-select menu (see App.tsx) instead of auto-loading,
  // so the player is never dropped straight back into their last location.

  const refreshSlots = useCallback(async () => {
    if (!user) { setSlots([]); return; }
    const list = await GameRepository.listActiveSlots(user.id);
    setSlots(list);
  }, [user]);

  const handleSelectSlot = useCallback(async (investigation: Investigation) => {
    await loadInvestigationIntoState(investigation);
  }, [loadInvestigationIntoState]);

  const handleContinue = useCallback(async () => {
    if (slots.length === 0) return;
    const mostRecent = [...slots].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
    await loadInvestigationIntoState(mostRecent);
  }, [slots, loadInvestigationIntoState]);

  // Real-time Supabase sync
  useEffect(() => {
    if (!user || !activeInvestigation) return;

    const channel = supabase
      .channel(`investigation-${activeInvestigation.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'investigations',
        filter: `id=eq.${activeInvestigation.id}`,
      }, (payload) => {
        const data = payload.new as any;
        // Apply all incoming DB updates — subscription only fires on genuine changes.
        setLocation(data.current_location);
        setInventory(data.inventory || []);
        setMedicalPoints(data.medical_points);
        setMoralPoints(data.moral_points);
        setCurrentAct(data.current_act ?? INITIAL_ACT);
        if (data.elapsed_minutes !== undefined) setElapsedMinutes(data.elapsed_minutes ?? 0);
        if (data.rumor_events !== undefined) setRumorEvents(data.rumor_events ?? {});
        setFlags(data.global_flags || {});
        setJournalNotes(data.journal_notes || INITIAL_JOURNAL);
        setActiveInvestigation(prev =>
          prev
            ? {
                ...prev,
                currentLocation: data.current_location,
                medicalPoints: data.medical_points,
                moralPoints: data.moral_points,
                globalFlags: data.global_flags,
                journalNotes: data.journal_notes,
                updatedAt: data.updated_at,
              }
            : null
        );
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'npc_states',
        filter: `investigation_id=eq.${activeInvestigation.id}`,
      }, (payload) => {
        const data = payload.new as any;
        setNpcStates(prev => {
          const existing = prev[data.npc_id];
          if (
            existing &&
            existing.lastInteraction === data.last_interaction &&
            existing.status === data.status
          ) {
            return prev;
          }
          return {
            ...prev,
            [data.npc_id]: {
              npcId: data.npc_id,
              disposition: data.disposition,
              currentLocation: data.current_location,
              status: data.status,
              lastInteraction: data.last_interaction,
              memory: data.memory,
            },
          };
        });
      })
      // NOTE: no logs-INSERT handler. The feed is a clean per-session view (resume
      // opens with a fresh look; the diary carries continuity), so injecting logged
      // rows from another tab would reintroduce stale cross-session prose. Only the
      // authoritative investigations/npc_states sync across tabs.
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // Only recreate channel when investigation identity changes, not on every save.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeInvestigation?.id]);

  // ── New Game (start a fresh investigation in a given save slot) ─────────────

  const handleStartInSlot = useCallback(async (slotNumber: number) => {
    // If the target slot is already occupied, archive that game first so the
    // partial unique index (owner_id, save_slot) stays satisfied. Its data is
    // preserved, just freed from the slot.
    if (user) {
      const occupant = slots.find(s => s.saveSlot === slotNumber);
      if (occupant) {
        try {
          await GameRepository.archiveSlot(occupant.id);
        } catch (e) {
          console.error('Could not archive slot occupant:', e);
        }
      }
    }

    // Clear local save slot
    try { localStorage.removeItem('londonBleedsSave'); } catch {}

    // Reset all game state to initial values
    setHistory([]);
    setLocation(INITIAL_LOCATION);
    setInventory(INITIAL_INVENTORY);
    setMedicalPoints(0);
    setMoralPoints(0);
    setIsGameOver(false);
    setFlags({});
    setNpcStates(INITIAL_NPC_STATES as Record<string, NPCState>);
    setCurrentAct(INITIAL_ACT);
    setElapsedMinutes(0);
    setRumorEvents({});
    setStim({});
    setTurnCount(0);
    setIntroducedNpcs(INITIAL_INTRODUCED_NPCS);
    setJournalNotes(INITIAL_JOURNAL);
    setDiaryEntries([]);
    diarySeqRef.current = 0;
    loggedLocationsRef.current = new Set();
    setActiveInvestigation(null);

    // Create a fresh investigation for logged-in users
    if (user) {
      try {
        const newInv = await GameRepository.createInvestigation(user.id, {
          currentLocation: INITIAL_LOCATION,
          inventory: INITIAL_INVENTORY,
          currentAct: INITIAL_ACT,
          globalFlags: {},
          journalNotes: INITIAL_JOURNAL,
          saveSlot: slotNumber,
        });
        setActiveInvestigation(newInv);
      } catch (e) {
        console.error('Could not create new investigation:', e);
      }
    }

    // Trigger fresh opening scene (diary starts empty — player writes manually)
    hasGeneratedOpening.current = false;
    generateOpeningScene();

    setNotification({ message: 'New Investigation Started!', type: 'success' });
    refreshSlots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, slots, generateOpeningScene, refreshSlots]);

  // Delete (archive) a slot, freeing it. Returns the refreshed slot list.
  const handleDeleteSlot = useCallback(async (investigation: Investigation) => {
    try {
      await GameRepository.archiveSlot(investigation.id);
    } catch (e) {
      console.error('Could not delete slot:', e);
    }
    if (activeInvestigation?.id === investigation.id) {
      setActiveInvestigation(null);
    }
    await refreshSlots();
  }, [activeInvestigation?.id, refreshSlots]);

  return {
    isSaving,
    slots,
    handleSaveGame,
    handleSaveGameRef,
    loadInvestigationIntoState,
    handleLoadGame,
    refreshSlots,
    handleSelectSlot,
    handleContinue,
    handleStartInSlot,
    handleDeleteSlot,
  };
}
