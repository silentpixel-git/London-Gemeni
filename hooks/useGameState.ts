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
import { GameRepository, UserProfile } from '../services/GameRepository';
import { aiService } from '../services/AIService';
import { gameEngine, SessionSnapshot } from '../engine/GameEngine';
import { parseIntent } from '../engine/intentParser';
import { LOCATIONS, CLUE_DEFINITIONS, ACT_NAMES } from '../engine/gameData';
import {
  INITIAL_LOCATION,
  INITIAL_ACT,
  INITIAL_INVENTORY,
  INITIAL_NPC_STATES,
  INITIAL_JOURNAL,
  INITIAL_INTRODUCED_NPCS,
  NPC_DISPLAY_NAMES,
} from '../constants';
import { GameHistoryItem, GameState, Investigation, NPCState, STIMEntry, ActJournalSummary } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey, isSupabaseConfigured } from '../supabase';

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
  retryConnections: () => Promise<void>;

  // Refs
  scrollRef: React.RefObject<HTMLDivElement>;
  lastUserMessageRef: React.RefObject<HTMLDivElement>;

  // Handlers
  handleAction: (userAction: string) => Promise<void>;
  handleSaveGame: (silent?: boolean) => Promise<void>;
  handleLoadGame: () => Promise<void>;
  handleConsultHolmes: () => Promise<void>;
  handleUpdateJournal: () => Promise<void>;
  handleNewGame: () => Promise<void>;
  handleScroll: () => void;
}

const OPENING_FALLBACK_NARRATIVE =
  "> *221B Baker Street. November 1888. The sitting room is no longer quite a sitting room.*\n\nHolmes paces before the fire, his pipe cold in his hand. The case files are everywhere — pinned, spread, stacked. Five murders. Eleven weeks. Scotland Yard is floundering.\n\n**Sherlock Holmes** is here.\n**Objects of interest:** Case Files Wall, Newspapers, Chemistry Table, Watson's Armchair.\n**Possible exits:** Dorset Street.";

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGameState({ user, isAuthReady, userProfile }: { user: User | null; isAuthReady: boolean; userProfile: UserProfile | null }): GameStateReturn {

  // ── Narrative state ─────────────────────────────────────────────────────
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoScrollLocked, setIsAutoScrollLocked] = useState(true);

  // ── World state ─────────────────────────────────────────────────────────
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [medicalPoints, setMedicalPoints] = useState(0);
  const [moralPoints, setMoralPoints] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [npcStates, setNpcStates] = useState<Record<string, NPCState>>(
    INITIAL_NPC_STATES as Record<string, NPCState>
  );
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);
  const [currentAct, setCurrentAct] = useState(INITIAL_ACT);
  const [stim, setStim] = useState<Record<string, STIMEntry>>({});
  const [turnCount, setTurnCount] = useState(0);
  // NPC introduction tracking — IDs of NPCs whose real names Watson now knows.
  // Pre-seeded with professional acquaintances Watson already knows at game start.
  const [introducedNpcs, setIntroducedNpcs] = useState<string[]>(INITIAL_INTRODUCED_NPCS);

  // Proactive Holmes nudge — turns at current location without discovering a clue
  const [turnsAtLocationWithoutProgress, setTurnsAtLocationWithoutProgress] = useState(0);
  // Procedural act journals — clue IDs accumulated since last act advance
  const [cluesFoundThisAct, setCluesFoundThisAct] = useState<string[]>([]);

  // ── Journal / sidebar ───────────────────────────────────────────────────
  const [journalNotes, setJournalNotes] = useState(INITIAL_JOURNAL);
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
  const needsJournalUpdate = useRef(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const lastUserMsgIdx = [...history].reverse().findIndex(m => m.role === 'user');
  const actualLastUserIdx = lastUserMsgIdx === -1 ? -1 : history.length - 1 - lastUserMsgIdx;

  // ── Effects ───────────────────────────────────────────────────────────────

  // ── Supabase connectivity ping ────────────────────────────────────────────
  // Uses a direct fetch to GoTrue's public /health endpoint instead of the
  // Supabase SDK. This avoids the SDK's internal storage-lock mechanism, which
  // can block or error during automatic token-refresh cycles and cause false
  // "cloud down" readings even when the project is perfectly healthy.
  const pingSupabase = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: supabaseAnonKey },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // Full connection check (Supabase + Gemini) — used on mount and manual retry
  const checkConnections = useCallback(async () => {
    setConnectionStatus({ gemini: null, supabase: null });

    const supabaseOk = await pingSupabase();
    setConnectionStatus(prev => ({ ...prev, supabase: supabaseOk }));
    if (!supabaseOk) {
      setNotification({ message: 'Cloud unavailable — progress will save locally.', type: 'error' });
    }

    try {
      const test = await callGemini("Say 'ok'", false, 0);
      setConnectionStatus(prev => ({ ...prev, gemini: test.toLowerCase().includes('ok') }));
    } catch {
      setConnectionStatus(prev => ({ ...prev, gemini: false }));
    }
  }, [pingSupabase]);

  // Run once when auth state is first known
  useEffect(() => {
    if (isAuthReady) checkConnections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady]);

  // Silent background monitor — re-checks every 60 s so the dot stays accurate
  // throughout the session without needing the user to click retry.
  useEffect(() => {
    if (!isAuthReady) return;
    const monitor = setInterval(async () => {
      const ok = await pingSupabase();
      setConnectionStatus(prev =>
        prev.supabase === ok ? prev : { ...prev, supabase: ok }
      );
    }, 60_000);
    return () => clearInterval(monitor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, pingSupabase]);

  // Theme persistence — localStorage + Supabase cloud sync
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    try { localStorage.setItem('lb-theme', isDark ? 'dark' : 'light'); } catch {}
    // Sync to cloud when logged in (user accessed via closure — intentionally omitted from deps)
    if (user) {
      GameRepository.upsertProfile(user.id, { themePreference: isDark ? 'dark' : 'light' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  // Load theme preference from cloud when user profile becomes available
  useEffect(() => {
    if (userProfile?.themePreference) {
      setIsDark(userProfile.themePreference === 'dark');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]); // only fire when user identity changes, not on every profile update

  // Auto-generate diary once after the opening scene finishes streaming.
  // Guard on isLoading: history.length changes to 1 while text is still empty
  // (streaming), so we wait until loading is false before checking hasContent.
  useEffect(() => {
    if (isLoading) return;
    const hasContent = history.some(h => h.text && h.text.trim().length > 0);
    if (needsJournalUpdate.current && hasContent && !isUpdatingJournal) {
      needsJournalUpdate.current = false;
      handleUpdateJournal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length, isLoading]);

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
        currentAct: INITIAL_ACT,
        medicalPoints: 0,
        moralPoints: 0,
        discoveredClueIds: [],
        investigationId: undefined,
        turnsAtLocationWithoutProgress: 0,
        introducedNpcs: INITIAL_INTRODUCED_NPCS,
      };
      const result = gameEngine.resolve(intent, snapshot);

      let lastText = '';
      for await (const update of aiService.stream({ ...result.aiContext, narrationMode: 'opening', blockquoteHint: 'none' })) {
        if (update.narrative) {
          lastText = update.narrative;
          setHistory([{ role: 'assistant', text: lastText }]);
        }
      }
      if (!lastText) setHistory([{ role: 'assistant', text: OPENING_FALLBACK_NARRATIVE }]);
    } catch (error) {
      console.error('Opening scene generation failed:', error);
      setHistory([{ role: 'assistant', text: OPENING_FALLBACK_NARRATIVE }]);
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
      medicalPoints,
      moralPoints,
      npcStates,
      flags,
      journalNotes,
      introducedNpcs,
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
  }, [user, activeInvestigation, history, location, inventory, medicalPoints, moralPoints, npcStates, flags, journalNotes, currentAct, introducedNpcs]);

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

          setLocation(investigation.currentLocation);
          setInventory(inv);
          setMedicalPoints(investigation.medicalPoints || 0);
          setMoralPoints(investigation.moralPoints || 0);
          setCurrentAct(act);
          setIsGameOver(investigation.status === 'solved');
          setFlags(investigation.globalFlags as Record<string, boolean>);
          setJournalNotes(investigation.journalNotes || INITIAL_JOURNAL);
          if ((investigation as any).introducedNpcs) {
            setIntroducedNpcs((investigation as any).introducedNpcs as string[]);
          }
          if (!investigation.journalNotes && historyItems.length > 0) {
            needsJournalUpdate.current = true;
          }
          setActiveInvestigation(investigation);

          const npcMap = await GameRepository.getAllNPCStates(investigation.id);
          if (Object.keys(npcMap).length > 0) {
            setNpcStates(prev => ({ ...prev, ...npcMap }));
          }

          if ((investigation as any).stim) setStim((investigation as any).stim);

          if (historyItems.length > 0) {
            setHistory(historyItems);
            setNotification({ message: 'Investigation Resumed!', type: 'success' });
          } else {
            // Investigation exists but no logs yet — generate opening scene
            hasGeneratedOpening.current = false;
            needsJournalUpdate.current = true;
            generateOpeningScene();
          }
          return;
        }

        // No existing investigation — create a fresh one
        investigation = await GameRepository.createInvestigation(user.id, {
          currentLocation: INITIAL_LOCATION,
          inventory: INITIAL_INVENTORY,
          currentAct: INITIAL_ACT,
          globalFlags: {},
          journalNotes: INITIAL_JOURNAL,
        });
        setActiveInvestigation(investigation);

        hasGeneratedOpening.current = false;
        needsJournalUpdate.current = true;
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
        setFlags(state.flags || {});
        setJournalNotes(state.journalNotes || journalNotes);
        if (state.npcStates) setNpcStates(state.npcStates);
      }
    } catch (e) {
      console.error('Load failed', e);

      // Cloud unreachable — attempt local save fallback so the game is never stuck
      try {
        const savedData = localStorage.getItem('londonBleedsSave');
        if (savedData) {
          const state = JSON.parse(savedData) as GameState;
          if (state.history && state.history.length > 0) {
            setHistory(state.history);
            setLocation(state.location);
            setInventory(state.inventory);
            setFlags(state.flags || {});
            setJournalNotes(state.journalNotes || INITIAL_JOURNAL);
            if (state.npcStates) setNpcStates(state.npcStates);
            setNotification({ message: 'Cloud unavailable — local save loaded.', type: 'error' });
            return;
          }
        }
      } catch {}

      // No local save either — generate a fresh opening scene so the screen is never blank
      setNotification({ message: 'Cloud unavailable — starting fresh locally.', type: 'error' });
      if (history.length === 0) {
        hasGeneratedOpening.current = false;
        needsJournalUpdate.current = true;
        generateOpeningScene();
      }
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
      needsJournalUpdate.current = true;
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
        // Apply all incoming DB updates — subscription only fires on genuine changes.
        setLocation(data.current_location);
        setInventory(data.inventory || []);
        setMedicalPoints(data.medical_points);
        setMoralPoints(data.moral_points);
        setCurrentAct(data.current_act || 1);
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
  // Only recreate channel when investigation identity changes, not on every save.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeInvestigation?.id]);

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
        medicalPoints,
        moralPoints,
        discoveredClueIds,
        investigationId: activeInvestigation?.id,
        turnsAtLocationWithoutProgress,
        introducedNpcs,
      };

      // STEP 3: Engine resolves — no AI yet
      const result = gameEngine.resolve(intent, snapshot);

      // STEP 3b: Process NPC introduction flags (alias system)
      // The engine attaches _introductionFlagsUpdate to aiContext as a side-channel.
      // Extract npc_introduced_* keys and update introducedNpcs[] state.
      const introFlags = (result.aiContext as any)._introductionFlagsUpdate as Record<string, boolean> | undefined;
      if (introFlags) {
        const newIntros = Object.keys(introFlags)
          .filter(k => k.startsWith('npc_introduced_') && introFlags[k])
          .map(k => k.replace('npc_introduced_', ''));
        if (newIntros.length > 0) {
          setIntroducedNpcs(prev => {
            const next = [...prev];
            for (const npcId of newIntros) {
              if (!next.includes(npcId)) next.push(npcId);
            }
            return next;
          });
        }
      }

      // STEP 4: Apply state changes optimistically
      const newLocation  = result.newLocation || location;
      const newInventory = (() => {
        let inv = [...inventory];
        if (result.inventoryAdd)    inv = [...inv, ...result.inventoryAdd.filter(i => !inv.includes(i))];
        if (result.inventoryRemove) inv = inv.filter(i => !result.inventoryRemove!.includes(i));
        return inv;
      })();
      const newMedicalPoints = result.medicalPointsDelta ? medicalPoints + result.medicalPointsDelta : medicalPoints;
      const newMoralPoints   = result.moralPointsDelta   ? moralPoints  + result.moralPointsDelta   : moralPoints;
      const newFlags         = result.flagsUpdate        ? { ...flags, ...result.flagsUpdate }      : flags;

      setLocation(newLocation);
      setInventory(newInventory);
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

      // Update turns-without-progress counter (for Holmes nudge)
      const madeProgress = !!(result.newLocation || result.newAct ||
        (result.discoveredClueIds && result.discoveredClueIds.length > 0));
      if (madeProgress) {
        setTurnsAtLocationWithoutProgress(0);
      } else {
        setTurnsAtLocationWithoutProgress(prev => prev + 1);
      }

      // Capture journal data before resetting per-act tracking (if act is advancing)
      let pendingJournalSummary: ActJournalSummary | null = null;
      if (result.newAct) {
        const allActClueIds = [
          ...cluesFoundThisAct,
          ...(result.discoveredClueIds || []),
        ];
        pendingJournalSummary = {
          actNumber: currentAct,
          actName: ACT_NAMES[currentAct] || `Act ${currentAct}`,
          cluesFound: allActClueIds
            .map(id => CLUE_DEFINITIONS[id])
            .filter(Boolean)
            .map(c => ({ name: c.name, description: c.description })),
        };
        setCluesFoundThisAct([]); // reset for the new act
      } else if (result.discoveredClueIds && result.discoveredClueIds.length > 0) {
        setCluesFoundThisAct(prev => [...prev, ...result.discoveredClueIds!]);
      }

      // STEP 5: Persist engine result to Supabase
      if (user && activeInvestigation) {
        await GameRepository.applyEngineResult(activeInvestigation.id, result, {
          location, inventory, medicalPoints, moralPoints, currentAct, flags,
        });
        if (result.npcUpdates) {
          GameRepository.applyNPCUpdates(activeInvestigation.id, result.npcUpdates);
        }
        if (result.discoveredClueIds && result.discoveredClueIds.length > 0) {
          GameRepository.addDiscoveredClues(activeInvestigation.id, result.discoveredClueIds);
        }
      }

      // STEP 6a: Holmes multi-clue synthesis — runs in parallel with STIM inject, before Watson narrates
      if (result.discoveredClueIds && result.discoveredClueIds.length > 0) {
        const allDiscoveredIds = [...discoveredClueIds, ...result.discoveredClueIds];
        const allClueObjects = allDiscoveredIds
          .map(id => CLUE_DEFINITIONS[id])
          .filter(Boolean)
          .map(c => ({ name: c.name, description: c.description, holmesDeduction: c.holmesDeduction }));
        const newClueNames = result.discoveredClueIds
          .map(id => CLUE_DEFINITIONS[id]?.name)
          .filter(Boolean) as string[];
        try {
          result.aiContext.holmesSynthesis = await aiService.consultHolmesMultiClue(
            allClueObjects,
            newClueNames,
            result.aiContext.act,
          );
        } catch {
          // Graceful fallback — Watson narrates with the hardcoded holmesDeduction per clue
        }
      }

      // STEP 6b: Inject session STIM into AI context (not part of engine — lives in hook)
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

      // STEP 8: Generate act journal after narration stream completes (act advance only)
      if (pendingJournalSummary) {
        try {
          const journalText = await aiService.generateJournalEntry(pendingJournalSummary);
          if (journalText) {
            setHistory(prev => [
              ...prev,
              { role: 'assistant', text: journalText, type: 'journal' },
            ]);
          }
        } catch {
          // Journal is bonus content — never block the game on failure
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
  }, [isLoading, user, activeInvestigation, location, inventory, flags, npcStates, currentAct, medicalPoints, moralPoints, introducedNpcs, handleSaveGame]);

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
      1. Use only this section: **Observed:**
      2. Provide a TOTAL of only 2 to 3 bullet points under Observed.
      3. Focus on physical evidence, witness accounts, and factual case observations.
      4. Be brief. No narrative re-telling. No sanity or mental-state commentary.`;

      const notes = await callGemini(prompt, false, 0, systemInstruction);
      setJournalNotes(notes || 'No updates available.');
    } catch (error) {
      console.error('Notes update failed', error);
      setNotification({ message: 'Notes update failed. Try again.', type: 'error' });
      // Ensure the diary never stays in the empty/loading state on failure
      setJournalNotes(prev => prev || '**Observed:**\n* Investigation underway.');
    } finally {
      setIsUpdatingJournal(false);
    }
  }, [isUpdatingJournal, history]);

  // ── New Game ──────────────────────────────────────────────────────────────

  const handleNewGame = useCallback(async () => {
    // Archive current investigation so it isn't lost
    if (user && activeInvestigation) {
      try {
        await GameRepository.updateInvestigation(activeInvestigation.id, { status: 'archived' });
      } catch (e) {
        console.error('Could not archive investigation:', e);
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
    setStim({});
    setTurnCount(0);
    setIntroducedNpcs(INITIAL_INTRODUCED_NPCS);
    setJournalNotes(INITIAL_JOURNAL);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeInvestigation?.id, generateOpeningScene]);

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
    retryConnections: checkConnections,

    scrollRef,
    lastUserMessageRef,

    handleAction,
    handleSaveGame,
    handleLoadGame,
    handleConsultHolmes,
    handleUpdateJournal,
    handleNewGame,
    handleScroll,
  };
}
