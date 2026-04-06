/**
 * hooks/useGameState.ts
 *
 * Custom hook that owns all London Bleeds game state, refs, effects, and
 * handlers. App.tsx becomes a thin layout shell — it passes slices of this
 * hook's return value down to focused UI components.
 *
 * State ownership:
 *  - isSidebarOpen   → AppContent  (affects root layout, needed by Sidebar + Header)
 *  - isProfileMenuOpen → Header    (purely local UI state)
 *  - input (text field) → CommandInput (purely local UI state)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { callGemini } from '../services/geminiService';
import { GameRepository } from '../services/GameRepository';
import { aiService } from '../services/AIService';
import { gameEngine, SessionSnapshot } from '../engine/GameEngine';
import { parseIntent } from '../engine/intentParser';
import { LOCATIONS } from '../engine/gameData';
import {
  INITIAL_LOCATION,
  INITIAL_INVENTORY,
  INITIAL_SANITY,
  INITIAL_NPC_STATES,
  NPC_DISPLAY_NAMES,
} from '../constants';
import { GameHistoryItem, GameState, Investigation, NPCState, STIMEntry } from '../types';
import { supabase } from '../supabase';

// ── Public interface ──────────────────────────────────────────────────────────

export interface GameStateReturn {
  // Narrative
  history: GameHistoryItem[];
  isLoading: boolean;
  isAutoScrollLocked: boolean;
  isGameOver: boolean;
  isConsultingHolmes: boolean;
  actualLastUserIdx: number;

  // World state
  location: string;
  inventory: string[];
  sanity: number;
  medicalPoints: number;
  moralPoints: number;
  currentAct: number;
  flags: Record<string, boolean>;
  npcStates: Record<string, NPCState>;
  activeInvestigation: Investigation | null;

  // UI / persistence
  journalNotes: string;
  isUpdatingJournal: boolean;
  isSaving: boolean;
  isDark: boolean;
  setIsDark: React.Dispatch<React.SetStateAction<boolean>>;
  notification: { message: string; type: 'success' | 'error' } | null;
  setNotification: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' } | null>>;
  connectionStatus: { gemini: boolean | null; supabase: boolean | null };

  // Refs
  scrollRef: React.RefObject<HTMLDivElement>;
  lastUserMessageRef: React.RefObject<HTMLDivElement>;

  // Handlers
  handleAction: (userAction: string) => Promise<void>;
  handleSaveGame: (silent?: boolean) => Promise<void>;
  handleLoadGame: () => Promise<void>;
  handleConsultHolmes: () => Promise<void>;
  handleUpdateJournal: () => Promise<void>;
  handleScroll: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGameState({ user, isAuthReady }: { user: User | null; isAuthReady: boolean }): GameStateReturn {

  // ── Narrative state ─────────────────────────────────────────────────────
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoScrollLocked, setIsAutoScrollLocked] = useState(true);

  // ── World state ─────────────────────────────────────────────────────────
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [sanity, setSanity] = useState(INITIAL_SANITY);
  const [medicalPoints, setMedicalPoints] = useState(0);
  const [moralPoints, setMoralPoints] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [npcStates, setNpcStates] = useState<Record<string, NPCState>>(
    INITIAL_NPC_STATES as Record<string, NPCState>
  );
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);
  const [currentAct, setCurrentAct] = useState(1);
  const [stim, setStim] = useState<Record<string, STIMEntry>>({});
  const [turnCount, setTurnCount] = useState(0);

  // ── Journal / sidebar ───────────────────────────────────────────────────
  const [journalNotes, setJournalNotes] = useState(
    "**Found:**\n* Reports of a new murder in Miller's Court.\n\n**Sanity Note:**\n* The fog of Whitechapel feels heavier today."
  );
  const [isUpdatingJournal, setIsUpdatingJournal] = useState(false);
  const [isConsultingHolmes, setIsConsultingHolmes] = useState(false);

  // ── Persistence / UI ────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    gemini: boolean | null;
    supabase: boolean | null;
  }>({ gemini: null, supabase: null });
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem('lb-theme') === 'dark'; } catch { return false; }
  });

  // ── Refs ─────────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const hasGeneratedOpening = useRef(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const lastUserMsgIdx = [...history].reverse().findIndex(m => m.role === 'user');
  const actualLastUserIdx = lastUserMsgIdx === -1 ? -1 : history.length - 1 - lastUserMsgIdx;

  // ── Effects ───────────────────────────────────────────────────────────────

  // Resize + connection checks on mount
  useEffect(() => {
    const checkConnections = async () => {
      try {
        const { error } = await supabase.from('investigations').select('id').limit(1);
        setConnectionStatus(prev => ({ ...prev, supabase: !error }));
      } catch {
        setConnectionStatus(prev => ({ ...prev, supabase: false }));
      }
      try {
        const test = await callGemini("Say 'ok'", false, 0);
        setConnectionStatus(prev => ({ ...prev, gemini: test.toLowerCase().includes('ok') }));
      } catch {
        setConnectionStatus(prev => ({ ...prev, gemini: false }));
      }
    };
    checkConnections();
  }, []);

  // Theme persistence
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    try { localStorage.setItem('lb-theme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  // Scroll to active turn when new assistant placeholder appears
  const scrollToActiveTurn = useCallback(() => {
    if (lastUserMessageRef.current) {
      lastUserMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const lastMsg = history[history.length - 1];
    if (
      lastMsg?.role === 'assistant' &&
      lastMsg.text === '' &&
      history.length > 1 &&
      history[history.length - 2].role === 'user'
    ) {
      requestAnimationFrame(() => scrollToActiveTurn());
    }
  }, [history.length, scrollToActiveTurn]);

  // ── Scroll helpers ────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setIsAutoScrollLocked(scrollHeight - scrollTop - clientHeight < 100);
    }
  }, []);

  const scrollToBottom = useCallback(
    (force = false) => {
      if (scrollRef.current && (isAutoScrollLocked || force)) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    },
    [isAutoScrollLocked]
  );

  // ── Opening scene ─────────────────────────────────────────────────────────

  const generateOpeningScene = useCallback(async () => {
    if (hasGeneratedOpening.current) return;
    hasGeneratedOpening.current = true;
    setIsLoading(true);
    setHistory([{ role: 'assistant', text: '' }]);

    try {
      const intent = parseIntent('look');
      const snapshot: SessionSnapshot = {
        location: INITIAL_LOCATION,
        inventory: INITIAL_INVENTORY,
        flags: {},
        npcStates: INITIAL_NPC_STATES as Record<string, NPCState>,
        currentAct: 1,
        sanity: INITIAL_SANITY,
        medicalPoints: 0,
        moralPoints: 0,
        discoveredClueIds: [],
        investigationId: undefined,
      };
      const result = gameEngine.resolve(intent, snapshot);

      for await (const update of aiService.stream(result.aiContext)) {
        setHistory([{ role: 'assistant', text: update.narrative }]);
      }
    } catch (error) {
      console.error('Opening scene generation failed:', error);
      setHistory([{
        role: 'assistant',
        text: "> *The fog of Whitechapel hangs heavy over Dorset Street. A crowd has gathered outside Miller's Court.*\n\nHolmes stands beside you, his gaze sharp as ever. Inspector Abberline approaches, his face drawn with fatigue.\n\n**Sherlock Holmes** and **Inspector Abberline** are here.\n**Objects of interest:** Police Barricade, Street Lamps, Lodging House Entrances.\n**Possible exits:** Miller's Court.",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Save / load ───────────────────────────────────────────────────────────

  const handleSaveGame = useCallback(async (silent = false) => {
    setIsSaving(true);

    const gameState: GameState = {
      history,
      location,
      inventory,
      sanity,
      medicalPoints,
      moralPoints,
      npcStates,
      flags,
      journalNotes,
      timestamp: new Date().toLocaleString(),
    };

    try {
      localStorage.setItem('londonBleedsSave', JSON.stringify(gameState));

      if (user && activeInvestigation) {
        const updated = await GameRepository.updateInvestigation(activeInvestigation.id, {
          currentLocation: location,
          sanity,
          medicalPoints,
          moralPoints,
          currentAct,
          inventory,
          globalFlags: flags,
          journalNotes,
          stim,
        });
        if (updated) setActiveInvestigation(updated as Investigation);
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
  }, [user, activeInvestigation, history, location, inventory, sanity, medicalPoints, moralPoints, npcStates, flags, journalNotes, currentAct]);

  const handleLoadGame = useCallback(async () => {
    try {
      if (user) {
        let investigation = await GameRepository.getActiveInvestigation(user.id);

        if (investigation) {
          const logs = await GameRepository.getRecentLogs(investigation.id, 100);
          const historyItems: GameHistoryItem[] = logs.map(l => ({
            role: l.type === 'action' ? 'user' : 'assistant',
            text: l.content,
          }));

          const inv = (investigation as any).inventory || INITIAL_INVENTORY;
          const act = (investigation as any).currentAct || 1;

          setHistory(historyItems.length > 0 ? historyItems : history);
          setLocation(investigation.currentLocation);
          setInventory(inv);
          setSanity(investigation.sanity);
          setMedicalPoints(investigation.medicalPoints || 0);
          setMoralPoints(investigation.moralPoints || 0);
          setCurrentAct(act);
          setIsGameOver(investigation.status === 'solved');
          setFlags(investigation.globalFlags as Record<string, boolean>);
          setJournalNotes(investigation.journalNotes);
          setActiveInvestigation(investigation);

          const npcMap = await GameRepository.getAllNPCStates(investigation.id);
          if (Object.keys(npcMap).length > 0) {
            setNpcStates(prev => ({ ...prev, ...npcMap }));
          }

          if ((investigation as any).stim) setStim((investigation as any).stim);

          setNotification({ message: 'Investigation Resumed!', type: 'success' });
          return;
        }

        // No existing investigation — create a fresh one
        investigation = await GameRepository.createInvestigation(user.id, {
          currentLocation: INITIAL_LOCATION,
          inventory: INITIAL_INVENTORY,
          sanity: INITIAL_SANITY,
          currentAct: 1,
          globalFlags: {},
          journalNotes: '',
        });
        setActiveInvestigation(investigation);

        hasGeneratedOpening.current = false;
        generateOpeningScene();

        setNotification({ message: 'New Investigation Started!', type: 'success' });
        return;
      }

      // Local fallback (not logged in)
      const savedData = localStorage.getItem('londonBleedsSave');
      if (savedData) {
        const state = JSON.parse(savedData) as GameState;
        setNotification({ message: `Local Save Loaded! (${state.timestamp})`, type: 'success' });
        setHistory(state.history);
        setLocation(state.location);
        setInventory(state.inventory);
        setSanity(state.sanity || 100);
        setFlags(state.flags || {});
        setJournalNotes(state.journalNotes || journalNotes);
        if (state.npcStates) setNpcStates(state.npcStates);
      }
    } catch (e) {
      console.error('Load failed', e);
      setNotification({ message: 'Failed to load game save.', type: 'error' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, generateOpeningScene]);

  // Auto-load cloud save on login
  useEffect(() => {
    if (user && isAuthReady) {
      handleLoadGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthReady]);

  // Generate opening scene for fresh unauthenticated starts
  useEffect(() => {
    if (!user && isAuthReady && history.length === 0) {
      generateOpeningScene();
    }
  }, [isAuthReady, user, generateOpeningScene, history.length]);

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
        if (data.updated_at > activeInvestigation.updatedAt) {
          setLocation(data.current_location);
          setInventory(data.inventory || []);
          setSanity(data.sanity);
          setMedicalPoints(data.medical_points);
          setMoralPoints(data.moral_points);
          setCurrentAct(data.current_act || 1);
          setFlags(data.global_flags || {});
          setJournalNotes(data.journal_notes || '');
          setActiveInvestigation(prev =>
            prev
              ? {
                  ...prev,
                  currentLocation: data.current_location,
                  sanity: data.sanity,
                  medicalPoints: data.medical_points,
                  moralPoints: data.moral_points,
                  globalFlags: data.global_flags,
                  journalNotes: data.journal_notes,
                  updatedAt: data.updated_at,
                }
              : null
          );
        }
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'logs',
        filter: `investigation_id=eq.${activeInvestigation.id}`,
      }, (payload) => {
        const data = payload.new as any;
        setHistory(prev => {
          const isDuplicate = prev.some(h => h.text === data.content);
          if (isDuplicate) return prev;
          return [...prev, {
            role: data.type === 'action' ? 'user' : 'assistant',
            text: data.content,
          }];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeInvestigation?.id, activeInvestigation?.updatedAt]);

  // ── Main action handler ────────────────────────────────────────────────────

  const handleAction = useCallback(async (userAction: string) => {
    if (!userAction.trim() || isLoading) return;

    setIsLoading(true);
    setIsAutoScrollLocked(false);

    setHistory(prev => [...prev, { role: 'user', text: userAction }]);
    setHistory(prev => [...prev, { role: 'assistant', text: '' }]);

    // Persist user action to log
    if (user && activeInvestigation) {
      GameRepository.addLogEntry(activeInvestigation.id, {
        timestamp: new Date().toISOString(),
        type: 'action',
        content: userAction,
      });
    }

    try {
      // STEP 1: Parse intent deterministically
      const intent = parseIntent(userAction);

      // STEP 2: Build session snapshot from current React state
      const discoveredClueIds = user && activeInvestigation
        ? await GameRepository.getDiscoveredClueIds(activeInvestigation.id)
        : [];

      const snapshot: SessionSnapshot = {
        location,
        inventory,
        flags,
        npcStates,
        currentAct,
        sanity,
        medicalPoints,
        moralPoints,
        discoveredClueIds,
        investigationId: activeInvestigation?.id,
      };

      // STEP 3: Engine resolves — no AI yet
      const result = gameEngine.resolve(intent, snapshot);

      // STEP 4: Apply state changes optimistically
      const newLocation  = result.newLocation || location;
      const newInventory = (() => {
        let inv = [...inventory];
        if (result.inventoryAdd)    inv = [...inv, ...result.inventoryAdd.filter(i => !inv.includes(i))];
        if (result.inventoryRemove) inv = inv.filter(i => !result.inventoryRemove!.includes(i));
        return inv;
      })();
      const newSanity        = result.sanityDelta        ? Math.max(0, Math.min(100, sanity + result.sanityDelta)) : sanity;
      const newMedicalPoints = result.medicalPointsDelta ? medicalPoints + result.medicalPointsDelta : medicalPoints;
      const newMoralPoints   = result.moralPointsDelta   ? moralPoints  + result.moralPointsDelta   : moralPoints;
      const newFlags         = result.flagsUpdate        ? { ...flags, ...result.flagsUpdate }      : flags;

      setLocation(newLocation);
      setInventory(newInventory);
      setSanity(newSanity);
      setMedicalPoints(newMedicalPoints);
      setMoralPoints(newMoralPoints);
      setFlags(newFlags);
      if (result.newAct)   setCurrentAct(result.newAct);
      if (result.gameOver) setIsGameOver(true);

      if (result.npcUpdates) {
        setNpcStates(prev => {
          const next = { ...prev };
          Object.entries(result.npcUpdates!).forEach(([id, upd]) => {
            next[id] = { ...(next[id] || { npcId: id, disposition: 50, status: 'alive' }), ...upd } as NPCState;
          });
          return next;
        });
      }

      // STEP 5: Persist engine result to Supabase
      if (user && activeInvestigation) {
        await GameRepository.applyEngineResult(activeInvestigation.id, result, {
          location, inventory, sanity, medicalPoints, moralPoints, currentAct, flags,
        });
        if (result.npcUpdates) {
          GameRepository.applyNPCUpdates(activeInvestigation.id, result.npcUpdates);
        }
        if (result.discoveredClueIds && result.discoveredClueIds.length > 0) {
          GameRepository.addDiscoveredClues(activeInvestigation.id, result.discoveredClueIds);
        }
      }

      // STEP 6: Inject session STIM into AI context (not part of engine — lives in hook)
      result.aiContext.stim = stim;

      // STEP 7: Stream AI narration
      for await (const update of aiService.stream(result.aiContext)) {
        const { narrative, isComplete, parsed } = update;

        setHistory(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], text: narrative };
          return next;
        });

        if (isComplete && parsed) {
          if (user && activeInvestigation) {
            GameRepository.addLogEntry(activeInvestigation.id, {
              timestamp: new Date().toISOString(),
              type: 'narration',
              content: parsed.markdownOutput,
            });

            if (parsed.npcMemoryUpdate && Object.keys(parsed.npcMemoryUpdate).length > 0) {
              GameRepository.updateNPCMemory(
                activeInvestigation.id,
                parsed.npcMemoryUpdate,
                npcStates
              );
              setNpcStates(prev => {
                const next = { ...prev };
                Object.entries(parsed.npcMemoryUpdate!).forEach(([npcId, summary]) => {
                  const existing = next[npcId]?.memory || [];
                  next[npcId] = {
                    ...(next[npcId] || { npcId, disposition: 50, status: 'alive' }),
                    memory: [summary, ...existing].slice(0, 5),
                  } as NPCState;
                });
                return next;
              });
            }
          }

          // Handle STIM updates (session memory — first observation wins, never overwrite)
          if (parsed.stimUpdate && Object.keys(parsed.stimUpdate).length > 0) {
            setStim(prev => {
              const next = { ...prev };
              (Object.entries(parsed.stimUpdate!) as [string, STIMEntry][]).forEach(([id, entry]) => {
                if (!next[id]) {
                  next[id] = { ...entry, turnCreated: turnCount };
                }
              });
              // Evict oldest beyond 25
              const sorted = (Object.entries(next) as [string, STIMEntry][])
                .sort(([, a], [, b]) => b.turnCreated - a.turnCreated)
                .slice(0, 25);
              return Object.fromEntries(sorted);
            });
            setTurnCount(t => t + 1);
          }

          // Silent auto-save after every completed turn
          handleSaveGame(true);
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('handleAction error:', errorMsg, error);
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          text: `> *The connection to the investigation archives was momentarily lost. Please try again.*\n\n> *(Debug: ${errorMsg})*`,
        };
        return next;
      });
    } finally {
      setIsLoading(false);
      setIsAutoScrollLocked(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, activeInvestigation, location, inventory, flags, npcStates, currentAct, sanity, medicalPoints, moralPoints, handleSaveGame]);

  // ── Holmes hint ───────────────────────────────────────────────────────────

  const handleConsultHolmes = useCallback(async () => {
    if (isConsultingHolmes || isLoading) return;
    setIsConsultingHolmes(true);
    setIsLoading(true);

    try {
      const currentLocationData = LOCATIONS[location];
      const recentHistory = history
        .slice(-4)
        .map(m => `${m.role}: ${m.text?.substring(0, 300) || ''}`)
        .join('\n');

      const hint = await aiService.getHolmesHint({
        locationName: currentLocationData?.name || location,
        criticalPathLead: (currentLocationData as any)?.criticalPathLead || '',
        recentHistory,
        flags,
        medicalPoints,
        moralPoints,
      });

      setHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `> *Holmes leans in, his eyes sharp and analytical...*\n\n**Sherlock Holmes**: "${hint || 'Focus on the facts at hand, Watson!'}"`
        },
      ]);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error('Hint failed', error);
    } finally {
      setIsConsultingHolmes(false);
      setIsLoading(false);
    }
  }, [isConsultingHolmes, isLoading, location, history, flags, medicalPoints, moralPoints, scrollToBottom]);

  // ── Journal update ────────────────────────────────────────────────────────

  const handleUpdateJournal = useCallback(async () => {
    if (isUpdatingJournal) return;
    setIsUpdatingJournal(true);
    try {
      const fullStory = history
        .slice(-15)
        .filter(h => h.role !== 'system')
        .map(h => h.text || '')
        .join('\n');

      const prompt = `Source Material: ${fullStory}`;
      const systemInstruction = `You are Dr. Watson. Update your diary entries based on the case progress.
      STRICT CONSTRAINTS:
      1. Keep the sections: **Found:** and **Sanity Note:**.
      2. Provide a TOTAL of only 2 to 3 bullet points across the entire notes.
      3. Focus on medical findings and systemic observations.
      4. Be brief. No narrative re-telling.`;

      const notes = await callGemini(prompt, false, 0, systemInstruction);
      setJournalNotes(notes || 'No updates available.');
    } catch (error) {
      console.error('Notes update failed', error);
      setNotification({ message: 'Notes update failed. Try again.', type: 'error' });
    } finally {
      setIsUpdatingJournal(false);
    }
  }, [isUpdatingJournal, history]);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    history,
    isLoading,
    isAutoScrollLocked,
    isGameOver,
    isConsultingHolmes,
    actualLastUserIdx,

    location,
    inventory,
    sanity,
    medicalPoints,
    moralPoints,
    currentAct,
    flags,
    npcStates,
    activeInvestigation,

    journalNotes,
    isUpdatingJournal,
    isSaving,
    isDark,
    setIsDark,
    notification,
    setNotification,
    connectionStatus,

    scrollRef,
    lastUserMessageRef,

    handleAction,
    handleSaveGame,
    handleLoadGame,
    handleConsultHolmes,
    handleUpdateJournal,
    handleScroll,
  };
}
