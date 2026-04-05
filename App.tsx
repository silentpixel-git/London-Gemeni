
import {
  MapPin, Send, Briefcase, User, Menu, X, Feather, Sparkles,
  ScrollText, Lightbulb, Save, FolderOpen, Brain, PanelLeftClose,
  PanelLeftOpen, ChevronDown, LogOut, DoorOpen, ArrowDown, LogIn, Cloud,
  Sun, Moon
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StoryRenderer } from './components/StoryRenderer';
import { JournalRenderer } from './components/JournalRenderer';
import { TypewriterBlock } from './components/TypewriterBlock';
import { Notification } from './components/Notification';
import { callGemini } from './services/geminiService';
import { GameRepository } from './services/GameRepository';
import { aiService } from './services/AIService';
import { gameEngine, SessionSnapshot } from './engine/GameEngine';
import { parseIntent } from './engine/intentParser';
import { LOCATIONS } from './engine/gameData';
import {
  INITIAL_LOCATION,
  INITIAL_INVENTORY,
  INITIAL_SANITY,
  INITIAL_NPC_STATES,
  NPC_DISPLAY_NAMES,
} from './constants';
import {
  GameHistoryItem,
  GameState,
  Investigation,
  NPCState,
} from './types';
import { SupabaseProvider, useSupabase } from './components/SupabaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabase } from './supabase';

const AppContent: React.FC = () => {
  const { user, isAuthReady, authError, loginWithGoogle, logout, clearAuthError } = useSupabase();
  // --- STATE ---
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoScrollLocked, setIsAutoScrollLocked] = useState(true);
  
  // Game State
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [sanity, setSanity] = useState(INITIAL_SANITY);
  const [medicalPoints, setMedicalPoints] = useState(0);
  const [moralPoints, setMoralPoints] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [npcStates, setNpcStates] = useState<Record<string, NPCState>>(INITIAL_NPC_STATES as Record<string, NPCState>);
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);
  const [currentAct, setCurrentAct] = useState(1);
  
  const [journalNotes, setJournalNotes] = useState("**Found:**\n* Reports of a new murder in Miller's Court.\n\n**Sanity Note:**\n* The fog of Whitechapel feels heavier today.");
  
  const [isUpdatingJournal, setIsUpdatingJournal] = useState(false);
  const [isConsultingHolmes, setIsConsultingHolmes] = useState(false);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ gemini: boolean | null; supabase: boolean | null }>({ gemini: null, supabase: null });
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem('lb-theme') === 'dark'; } catch { return false; }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const hasGeneratedOpening = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const checkConnections = async () => {
      // Check Supabase
      try {
        const { error } = await supabase.from('investigations').select('id').limit(1);
        setConnectionStatus(prev => ({ ...prev, supabase: !error }));
      } catch (e) {
        setConnectionStatus(prev => ({ ...prev, supabase: false }));
      }

      // Check Gemini
      try {
        const test = await callGemini("Say 'ok'", false, 0);
        setConnectionStatus(prev => ({ ...prev, gemini: test.toLowerCase().includes('ok') }));
      } catch (e) {
        setConnectionStatus(prev => ({ ...prev, gemini: false }));
      }
    };
    checkConnections();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply theme token to <html> and persist preference
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    try { localStorage.setItem('lb-theme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAutoScrollLocked(isAtBottom);
    }
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (scrollRef.current && (isAutoScrollLocked || force)) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isAutoScrollLocked]);

  const scrollToActiveTurn = useCallback(() => {
    if (lastUserMessageRef.current) {
      // Anchoring the player input to the top of the viewport
      // The scroll-mt-[120px] on the element handles the sticky header gap
      lastUserMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const lastMsg = history[history.length - 1];
    
    // Trigger scroll to top of command when a new user message is added
    // even if an empty assistant message follows it immediately (start of stream)
    if (lastMsg?.role === 'assistant' && lastMsg.text === "" && history.length > 1 && history[history.length - 2].role === 'user') {
      requestAnimationFrame(() => {
        scrollToActiveTurn();
      });
    }
  }, [history.length, scrollToActiveTurn]);

  // ── Opening Scene ────────────────────────────────────────────────────────
  // Generates the first narration dynamically via the engine/AI pipeline so
  // it is always consistent with the actual game state (exits, NPCs, objects).
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
      // Fallback: minimal static opening with correct exits for Act 1
      setHistory([{
        role: 'assistant',
        text: "> *The fog of Whitechapel hangs heavy over Dorset Street. A crowd has gathered outside Miller's Court.*\n\nHolmes stands beside you, his gaze sharp as ever. Inspector Abberline approaches, his face drawn with fatigue.\n\n**Sherlock Holmes** and **Inspector Abberline** are here.\n**Objects of interest:** Police Barricade, Street Lamps, Lodging House Entrances.\n**Possible exits:** Miller's Court."
      }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSaveGame = async (silent = false) => {
    if (!silent) setIsProfileMenuOpen(false);
    setIsSaving(true);

    // Always persist a local snapshot for offline fallback
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
        // Cloud save — inventory, act, and flags are now all tracked as first-class columns
        const updated = await GameRepository.updateInvestigation(activeInvestigation.id, {
          currentLocation: location,
          sanity,
          medicalPoints,
          moralPoints,
          currentAct,
          inventory,
          globalFlags: flags,
          journalNotes,
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
  };

  const handleLoadGame = async () => {
    setIsProfileMenuOpen(false);
    try {
      if (user) {
        // ── Cloud Load ────────────────────────────────────────────────────
        let investigation = await GameRepository.getActiveInvestigation(user.id);

        if (investigation) {
          // Load conversation history from logs
          const logs = await GameRepository.getRecentLogs(investigation.id, 100);
          const historyItems: GameHistoryItem[] = logs.map(l => ({
            role: l.type === 'action' ? 'user' : 'assistant',
            text: l.content,
          }));

          // Restore all state from DB — inventory and currentAct are now first-class columns
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

          // Restore NPC states from DB (canonical positions, not AI-guessed)
          const npcMap = await GameRepository.getAllNPCStates(investigation.id);
          if (Object.keys(npcMap).length > 0) {
            setNpcStates(prev => ({ ...prev, ...npcMap }));
          }

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

        // Generate the opening scene dynamically so it matches the actual game state.
        // The narration will be persisted to logs once the stream completes (same as
        // every other turn — see the handleSaveGame(true) call inside handleAction).
        hasGeneratedOpening.current = false;
        generateOpeningScene();

        setNotification({ message: 'New Investigation Started!', type: 'success' });
        return;
      }

      // ── Local Fallback (not logged in) ────────────────────────────────
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
  };

  // Auto-load cloud save on login
  useEffect(() => {
    if (user && isAuthReady) {
      handleLoadGame();
    }
  }, [user, isAuthReady]);

  // Generate opening scene for fresh (unauthenticated) starts.
  // Fires once when auth check completes and there is no logged-in user.
  // Logged-in users get their opening via handleLoadGame (cloud or new investigation).
  useEffect(() => {
    if (!user && isAuthReady && history.length === 0) {
      generateOpeningScene();
    }
  }, [isAuthReady, user, generateOpeningScene]);

  // Real-time Sync for Investigation State
  useEffect(() => {
    if (!user || !activeInvestigation) return;

    const channel = supabase
      .channel(`investigation-${activeInvestigation.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'investigations', 
        filter: `id=eq.${activeInvestigation.id}` 
      }, (payload) => {
        const data = payload.new as any;
        // Only sync if the remote change is newer than our local state
        if (data.updated_at > activeInvestigation.updatedAt) {
          setLocation(data.current_location);
          setInventory(data.inventory || []);
          setSanity(data.sanity);
          setMedicalPoints(data.medical_points);
          setMoralPoints(data.moral_points);
          setCurrentAct(data.current_act || 1);
          setFlags(data.global_flags || {});
          setJournalNotes(data.journal_notes || '');
          setActiveInvestigation(prev => prev ? ({
            ...prev,
            currentLocation: data.current_location,
            sanity: data.sanity,
            medicalPoints: data.medical_points,
            moralPoints: data.moral_points,
            globalFlags: data.global_flags,
            journalNotes: data.journal_notes,
            updatedAt: data.updated_at,
          }) : null);
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'npc_states', 
        filter: `investigation_id=eq.${activeInvestigation.id}` 
      }, (payload) => {
        const data = payload.new as any;
        setNpcStates(prev => {
          // Check if we already have this exact state to avoid unnecessary re-renders
          const existing = prev[data.npc_id];
          if (existing && existing.lastInteraction === data.last_interaction && existing.status === data.status) {
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
              memory: data.memory
            }
          };
        });
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'logs', 
        filter: `investigation_id=eq.${activeInvestigation.id}` 
      }, (payload) => {
        const data = payload.new as any;
        setHistory(prev => {
          // Avoid duplicates if we were the one who added it
          const isDuplicate = prev.some(h => h.text === data.content);
          if (isDuplicate) return prev;
          
          return [...prev, {
            role: data.type === 'action' ? 'user' : 'assistant',
            text: data.content
          }];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeInvestigation?.id, activeInvestigation?.updatedAt]);

  const handleAction = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userAction = input;
    setInput('');
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
      // ── STEP 1: Parse the player's intent deterministically ─────────────
      const intent = parseIntent(userAction);

      // ── STEP 2: Build a session snapshot from current React state ────────
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

      // ── STEP 3: Engine resolves the action — no AI involved yet ─────────
      // All state changes (location, inventory, NPCs, flags, clues) are
      // determined here from canonical world data. The AI only narrates.
      const result = gameEngine.resolve(intent, snapshot);

      // ── STEP 4: Apply state changes optimistically to local React state ──
      const newLocation  = result.newLocation || location;
      const newInventory = (() => {
        let inv = [...inventory];
        if (result.inventoryAdd)    inv = [...inv, ...result.inventoryAdd.filter(i => !inv.includes(i))];
        if (result.inventoryRemove) inv = inv.filter(i => !result.inventoryRemove!.includes(i));
        return inv;
      })();
      const newSanity         = result.sanityDelta         ? Math.max(0, Math.min(100, sanity + result.sanityDelta)) : sanity;
      const newMedicalPoints  = result.medicalPointsDelta  ? medicalPoints + result.medicalPointsDelta : medicalPoints;
      const newMoralPoints    = result.moralPointsDelta    ? moralPoints  + result.moralPointsDelta  : moralPoints;
      const newFlags          = result.flagsUpdate         ? { ...flags, ...result.flagsUpdate }     : flags;

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

      // ── STEP 5: Persist engine result to Supabase ────────────────────────
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

      // ── STEP 6: Stream AI narration ──────────────────────────────────────
      // The AI receives only verified facts. It writes prose — nothing more.
      for await (const update of aiService.stream(result.aiContext)) {
        const { narrative, isComplete, parsed } = update;

        setHistory(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], text: narrative };
          return next;
        });

        if (isComplete && parsed) {
          // Persist narration to log
          if (user && activeInvestigation) {
            GameRepository.addLogEntry(activeInvestigation.id, {
              timestamp: new Date().toISOString(),
              type: 'narration',
              content: parsed.markdownOutput,
            });

            // Persist NPC memory summaries returned by AI
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
  };

  const handleConsultHolmes = async () => {
    if (isConsultingHolmes || isLoading) return;
    setIsConsultingHolmes(true);
    setIsLoading(true);

    try {
      const currentLocationData = LOCATIONS[location];
      const recentHistory = history.slice(-4).map(m => `${m.role}: ${m.text?.substring(0, 300) || ''}`).join('\n');

      const hint = await aiService.getHolmesHint({
        locationName: currentLocationData?.name || location,
        criticalPathLead: (currentLocationData as any)?.criticalPathLead || '',
        recentHistory,
        flags,
        medicalPoints,
        moralPoints,
      });

      setHistory(prev => [...prev, {
        role: 'assistant',
        text: `> *Holmes leans in, his eyes sharp and analytical...*\n\n**Sherlock Holmes**: "${hint || 'Focus on the facts at hand, Watson!'}"`,
      }]);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error('Hint failed', error);
    } finally {
      setIsConsultingHolmes(false);
      setIsLoading(false);
    }
  };

  const handleUpdateJournal = async () => {
    if (isUpdatingJournal) return;
    setIsUpdatingJournal(true);
    try {
      const fullStory = history
        .slice(-15)
        .filter(h => h.role !== 'system')
        .map(h => h.text || "")
        .join('\n');

      const prompt = `Source Material: ${fullStory}`;
      const systemInstruction = `You are Dr. Watson. Update your diary entries based on the case progress. 
      STRICT CONSTRAINTS:
      1. Keep the sections: **Found:** and **Sanity Note:**.
      2. Provide a TOTAL of only 2 to 3 bullet points across the entire notes.
      3. Focus on medical findings and systemic observations.
      4. Be brief. No narrative re-telling.`;
      
      const notes = await callGemini(prompt, false, 0, systemInstruction);
      setJournalNotes(notes || "No updates available.");
    } catch (error) {
      console.error("Notes update failed", error);
      setNotification({ message: "Notes update failed. Try again.", type: 'error' });
    } finally {
      setIsUpdatingJournal(false);
    }
  };

  // Find the index of the absolute last user message in the history
  const lastUserMsgIdx = [...history].reverse().findIndex(m => m.role === 'user');
  const actualLastUserIdx = lastUserMsgIdx === -1 ? -1 : history.length - 1 - lastUserMsgIdx;

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans selection:bg-lb-accent selection:text-white bg-lb-bg text-lb-primary">

      <div 
        className={`fixed inset-0 bg-lb-primary/50 z-40 lg:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}

      <div className={`
        fixed lg:relative z-50 h-full border-r border-lb-border transition-all duration-300 ease-in-out flex flex-col bg-lb-bg flex-shrink-0 overflow-hidden w-80
        ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full lg:w-0 lg:translate-x-0 lg:opacity-0'}
      `}>
        
        <div className="flex justify-between items-center px-8 pt-8 lg:hidden">
          <button onClick={() => setIsSidebarOpen(false)} className="text-lb-primary"><X size={24} /></button>
        </div>

        <div className={`flex-1 overflow-y-auto p-8 w-80 ${isSidebarOpen ? 'opacity-100 transition-opacity duration-500 delay-100' : 'opacity-0'}`}>
            <div className="mb-8">
                <div className="flex items-center gap-2 text-lb-accent mb-2">
                    <MapPin size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Current Sector</span>
                </div>
                <h2 className="font-serif text-2xl leading-tight text-lb-primary">
                    {LOCATIONS[location]?.name || "Unknown Location"}
                </h2>
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-2 text-lb-accent mb-4">
                    <Briefcase size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Medical Bag</span>
                </div>
                <ul className="space-y-3">
                    {inventory.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-lb-primary opacity-90">
                        <div className="w-1.5 h-1.5 rounded-full bg-lb-accent" />
                        <span className="font-sans text-md">{item}</span>
                    </li>
                    ))}
                </ul>
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-2 text-lb-accent mb-4">
                    <DoorOpen size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Avenues</span>
                </div>
                <ul className="space-y-3">
                    {(LOCATIONS[location]?.exits || [])
                      .filter(exitId => {
                        const exitData = LOCATIONS[exitId];
                        return exitData && exitData.act <= currentAct;
                      })
                      .map((exitId, idx) => {
                         const exitData = LOCATIONS[exitId];
                         return (
                            <li key={idx} className="flex items-center gap-3 text-lb-primary opacity-90">
                                <div className="w-1.5 h-1.5 rounded-full bg-lb-accent" />
                                <span className="font-sans text-md">{exitData?.shortName || exitId}</span>
                            </li>
                         );
                    })}
                </ul>
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-2 text-lb-accent mb-4">
                    <User size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Present in Sector</span>
                </div>
                <ul className="space-y-3">
                    {(() => {
                        const presentNpcs = Object.values(npcStates).filter(s => {
                            const npcLoc = s.currentLocation || (INITIAL_NPC_STATES[s.npcId]?.currentLocation);
                            return npcLoc === location && s.status !== 'deceased';
                        });

                        if (presentNpcs.length === 0) {
                            return <p className="text-sm text-lb-muted italic">No one else is here.</p>;
                        }

                        return presentNpcs.map(state => {
                            const npcId = state.npcId;
                            const displayName = NPC_DISPLAY_NAMES[npcId as keyof typeof NPC_DISPLAY_NAMES] || npcId;
                            return (
                                <li key={npcId} className="flex flex-col gap-1 text-lb-primary opacity-90">
                                    <div className="flex items-center gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-lb-accent" />
                                      <span className="font-sans text-md capitalize">{displayName}</span>
                                    </div>
                                </li>
                            );
                        });
                    })()}
                </ul>
            </div>

            <div className="flex flex-col mb-8">
                <div className="flex items-center justify-between text-lb-accent mb-4">
                    <div className="flex items-center gap-2">
                    <ScrollText size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Watson's Diary</span>
                    </div>
                    <button onClick={handleUpdateJournal} disabled={isUpdatingJournal} className="p-1 hover:bg-lb-accent/10 rounded-full transition-colors" title="Refine Diary">
                      <Sparkles size={14} className={isUpdatingJournal ? "animate-spin" : ""} />
                    </button>
                </div>
                <div className="bg-lb-paper border border-lb-border rounded-lg p-6 shadow-sm relative">
                    <div className="absolute top-2 right-2 opacity-30"><Brain size={16} /></div>
                    <JournalRenderer text={journalNotes} />
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative w-full transition-all duration-300">
        <header className="sticky top-0 z-30 px-8 md:px-16 py-4 flex items-center justify-between bg-lb-bg/90 backdrop-blur-sm border-b border-lb-border">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-lb-primary hover:bg-lb-primary/5 rounded-md">
                  {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              </button>
              
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-lb-paper/50 rounded-full border border-lb-border/50">
                  <div className="flex items-center gap-1.5" title={connectionStatus.gemini === true ? "Engine Connected" : connectionStatus.gemini === false ? "Engine Disconnected" : "Checking Engine..."}>
                      <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus.gemini === true ? 'bg-green-500' : connectionStatus.gemini === false ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
                      <span className="text-[9px] uppercase tracking-widest text-lb-muted font-bold">Engine</span>
                  </div>
                  <div className="w-px h-3 bg-lb-border/50" />
                  <div className="flex items-center gap-1.5" title={connectionStatus.supabase === true ? "Cloud Connected" : connectionStatus.supabase === false ? "Cloud Disconnected" : "Checking Cloud..."}>
                      <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus.supabase === true ? 'bg-green-500' : connectionStatus.supabase === false ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
                      <span className="text-[9px] uppercase tracking-widest text-lb-muted font-bold">Cloud</span>
                  </div>
                  {isSaving && (
                    <>
                      <div className="w-px h-3 bg-lb-border/50" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-[9px] uppercase tracking-widest text-orange-500 font-bold">Saving</span>
                      </div>
                    </>
                  )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDark(d => !d)}
                className="p-2 text-lb-muted hover:text-lb-accent hover:bg-lb-primary/5 rounded-md transition-colors"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

            <div className="relative">
                <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="flex items-center gap-3 text-lb-primary group">
                    <div className="text-right hidden sm:block">
                        <span className="block text-sm font-bold group-hover:text-lb-accent">
                          {user ? (user.user_metadata?.full_name || user.email) : "Dr. John Watson"}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest opacity-60">
                          {user ? "Cloud Profile" : "Medical Profile"}
                        </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-lb-primary text-white flex items-center justify-center overflow-hidden">
                      {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={16} />
                      )}
                    </div>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isProfileMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-56 bg-lb-paper border border-lb-border rounded-lg shadow-xl z-20 overflow-hidden">
                            <div className="p-1">
                                {user ? (
                                  <>
                                    <div className="px-3 py-2 border-b border-lb-border mb-1">
                                      <p className="text-[10px] uppercase tracking-widest text-lb-muted font-bold">Logged In As</p>
                                      <p className="text-xs font-medium text-lb-primary truncate">{user.user_metadata?.full_name || user.email}</p>
                                    </div>
                                    <button onClick={() => handleSaveGame()} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"><Save size={14} /><span>Save to Cloud</span></button>
                                    <button onClick={handleLoadGame} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"><FolderOpen size={14} /><span>Load from Cloud</span></button>
                                    <div className="h-px bg-lb-border my-1" />
                                    <button onClick={() => { logout(); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded text-left"><LogOut size={14} /><span>Sign Out</span></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => { loginWithGoogle(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left font-bold"><LogIn size={14} /><span>Sign In with Google</span></button>
                                    
                                    {authError && (
                                      <div className="px-3 py-2 bg-red-50 border border-red-100 rounded mx-2 my-1">
                                        <p className="text-[10px] text-red-600 leading-tight">{authError}</p>
                                        <button onClick={clearAuthError} className="text-[9px] text-red-400 underline mt-1">Clear</button>
                                      </div>
                                    )}

                                    {((import.meta as any).env.VITE_SUPABASE_URL === 'https://itjnzcqapohnoqfnxtat.supabase.co' || !(import.meta as any).env.VITE_SUPABASE_URL) && (
                                      <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded mx-2 my-1">
                                        <p className="text-[9px] text-amber-700 leading-tight">
                                          Using fallback project. To enable Google Login, please set your own Supabase credentials in Settings.
                                        </p>
                                      </div>
                                    )}
                                    <div className="h-px bg-lb-border my-1" />
                                    <button onClick={() => handleSaveGame()} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"><Save size={14} /><span>Save Locally</span></button>
                                    <button onClick={handleLoadGame} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"><FolderOpen size={14} /><span>Load Locally</span></button>
                                  </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
            </div>
        </header>

        <div 
          ref={scrollRef} 
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-8 md:px-16 pb-[60vh] scrollbar-thin scrollbar-thumb-lb-accent/20 scrollbar-track-transparent scroll-smooth"
        >
          <div className="max-w-3xl mx-auto pt-8 pb-6 z-10">
            <h1 className="font-serif text-5xl md:text-[76px] text-lb-primary leading-none mb-2 text-balance">London Bleeds</h1>
            <p className="font-serif text-2xl md:text-[40px] text-lb-primary opacity-90">The Whitechapel Diaries</p>
          </div>

          <div className="max-w-3xl mx-auto">
            <AnimatePresence initial={false}>
              {history.map((msg, index) => {
                  const isAI = msg.role === 'assistant';
                  const isLast = index === history.length - 1;
                  const isLatestUser = index === actualLastUserIdx;

                  if (!isAI && msg.role !== 'system') {
                  return (
                      <motion.div 
                        key={index} 
                        ref={isLatestUser ? lastUserMessageRef : null}
                        initial={isLatestUser ? { y: 300, opacity: 0 } : { opacity: 1 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.8 }}
                        className="my-8 scroll-mt-[120px]"
                      >
                      <div className="pl-6 border-l-[3px] border-lb-accent">
                          <span className="text-lb-accent font-sans font-medium text-[14px] md:text-[20px] leading-relaxed">
                          {msg.text}
                          </span>
                      </div>
                      </motion.div>
                  );
                  }

                  if (isLast && isAI && msg.text !== "") {
                       return (
                          <motion.div 
                            key={index} 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mb-8"
                          >
                              <TypewriterBlock text={msg.text} />
                          </motion.div>
                      );
                  }

                  if (msg.text !== "") {
                    return (
                        <motion.div 
                          key={index} 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mb-8"
                        >
                            <StoryRenderer text={msg.text} />
                        </motion.div>
                    );
                  }
                  return null;
              })}
            </AnimatePresence>
            
            {isGameOver && (
                <div className="flex flex-col items-center justify-center py-16 border-t border-lb-accent/20 mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="text-lb-accent flex flex-col items-center gap-4 text-center">
                        <Feather size={48} className="opacity-30" />
                        <div className="space-y-1">
                            <h2 className="font-serif text-4xl italic tracking-tight">Case Closed</h2>
                            <p className="text-xs opacity-60 font-sans tracking-[0.3em] uppercase">The Whitechapel Diaries</p>
                        </div>
                    </div>
                    
                    <div className="max-w-md text-center space-y-4">
                        <p className="font-serif text-lb-primary/70 italic leading-relaxed">
                            The ink has dried on this chapter of London's history. The truth, however elusive, has been recorded.
                        </p>
                    </div>

                    <button 
                        onClick={() => window.location.reload()}
                        className="group flex items-center gap-3 px-10 py-4 bg-lb-primary text-lb-bg rounded-full font-sans text-xs tracking-[0.2em] uppercase hover:bg-lb-accent transition-all duration-500 shadow-xl hover:shadow-2xl hover:-translate-y-1"
                    >
                        <span>Begin a New Diary</span>
                        <ArrowDown size={14} className="group-hover:translate-y-1 transition-transform" />
                    </button>
                </div>
            )}
          </div>
        </div>

        {!isGameOver && (
          <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 pt-10 md:px-16 md:pb-12 md:pt-16 lg:pt-18 bg-gradient-to-t from-lb-bg to-transparent pointer-events-none">
            <form onSubmit={handleAction} className="relative pointer-events-auto max-w-3xl mx-auto">
              {isLoading && (isConsultingHolmes || (history.length > 0 && history[history.length-1].role === 'assistant' && history[history.length-1].text === "")) && (
                  <div className="absolute bottom-full left-4 mb-2 flex items-center gap-2 text-lb-accent animate-in fade-in zoom-in-95 duration-300 z-20">
                      <Feather size={14} className="animate-bounce" />
                      <span className="text-sm italic font-serif">
                          {isConsultingHolmes ? "Holmes is contemplating..." : "The ink is drying..."}
                      </span>
                  </div>
              )}

              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="How do you choose to proceed, Doctor?"
                  className="w-full bg-lb-paper border border-lb-border rounded-full py-4 pl-6 pr-24 text-lb-primary placeholder-lb-muted text-lg focus:outline-none focus:border-lb-accent shadow-sm relative z-10"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                  <button 
                    type="button" 
                    onClick={handleConsultHolmes} 
                    disabled={isLoading} 
                    className="p-2 text-lb-muted hover:text-lb-accent transition-colors disabled:opacity-50"
                    title="Consult Holmes"
                  >
                    <Lightbulb size={20} />
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading || !input.trim()} 
                    className="p-2 text-lb-muted hover:text-lb-accent transition-colors disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <SupabaseProvider>
        <AppContent />
      </SupabaseProvider>
    </ErrorBoundary>
  );
};

export default App;
