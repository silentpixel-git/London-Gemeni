
import { 
  MapPin, Send, Briefcase, User, Menu, X, Feather, Sparkles, 
  ScrollText, Lightbulb, Save, FolderOpen, Brain, PanelLeftClose, 
  PanelLeftOpen, ChevronDown, LogOut, DoorOpen, ArrowDown, LogIn, Cloud
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StoryRenderer } from './components/StoryRenderer';
import { JournalRenderer } from './components/JournalRenderer';
import { TypewriterBlock } from './components/TypewriterBlock';
import { Notification } from './components/Notification';
import { callGemini, streamGemini } from './services/geminiService';
import { InvestigationService } from './services/investigationService';
import { 
  THEME, 
  INITIAL_LOCATION, 
  INITIAL_INVENTORY, 
  INITIAL_SANITY, 
  INITIAL_DISPOSITION, 
  WORLD_DATA, 
  GAME_ENGINE_PROMPT 
} from './constants';
import { 
  GameHistoryItem, 
  GameState, 
  GameResponse, 
  Investigation, 
  NPCState,
  LogEntry 
} from './types';
import { FirebaseProvider, useFirebase } from './components/FirebaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loginWithGoogle, logout, db, OperationType, handleFirestoreError } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const AppContent: React.FC = () => {
  const { user, isAuthReady } = useFirebase();
  // --- STATE ---
  const [history, setHistory] = useState<GameHistoryItem[]>([
    { 
      role: 'assistant', 
      text: "### ACT I: THE LAST MURDER\n\n> *Dorset Street is a grey sea of humanity, the fog thin and revealing the soot-stained faces of the working poor. A crowd has gathered outside Miller’s Court, their whispers a low hum against the city's noise.*\n\nI stand with Holmes outside the entrance to the court. Inspector Abberline is here, his face etched with the fatigue of a man who has seen too much and learned too little. 'Another one, Doctor,' he says, his voice flat. 'Inside. Room 13.'\n\n**Inspector Abberline** is here, guarding the entrance.\n**Objects of interest:** Police Barricade, Street Lamps, Lodging House Entrances.\n**Possible exits:** Miller’s Court, Buck’s Row." 
    }
  ]);
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
  const [disposition, setDisposition] = useState(INITIAL_DISPOSITION);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [npcStates, setNpcStates] = useState<Record<string, NPCState>>({});
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);
  
  const [journalNotes, setJournalNotes] = useState("**Found:**\n* Reports of a new murder in Miller's Court.\n\n**Sanity Note:**\n* The fog of Whitechapel feels heavier today.");
  
  const [isUpdatingJournal, setIsUpdatingJournal] = useState(false);
  const [isConsultingHolmes, setIsConsultingHolmes] = useState(false);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);

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
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    if (lastMsg?.role === 'user') {
      // Use requestAnimationFrame for most reliable scrolling after render
      requestAnimationFrame(() => {
        scrollToActiveTurn();
      });
    }
  }, [history.length, scrollToActiveTurn]);

  const handleSaveGame = async () => {
    setIsProfileMenuOpen(false);
    const gameState: GameState = {
      history,
      location,
      inventory,
      sanity,
      disposition,
      flags,
      journalNotes,
      timestamp: new Date().toLocaleString()
    };

    try {
      // Local Save
      localStorage.setItem('londonBleedsSave', JSON.stringify(gameState));
      
      // Cloud Save
      if (user) {
        // 1. Update Granular Investigation
        if (activeInvestigation) {
          await InvestigationService.updateInvestigation(activeInvestigation.id, {
            currentLocation: location,
            sanity,
            globalFlags: flags,
            journalNotes,
          });
        }

        // 2. Update Legacy Save Blob (for backward compatibility/snapshots)
        const saveRef = doc(db, 'saves', `${user.uid}_latest`);
        await setDoc(saveRef, {
          ...gameState,
          uid: user.uid,
          timestamp: new Date().toISOString()
        });
        setNotification({ message: "Game Saved to Cloud!", type: "success" });
      } else {
        setNotification({ message: "Game Saved Locally!", type: "success" });
      }
    } catch (e) {
      console.error("Save failed", e);
      if (user) {
        handleFirestoreError(e, OperationType.WRITE, `saves/${user.uid}_latest`);
      }
      setNotification({ message: "Failed to save game.", type: "error" });
    }
  };

  const handleLoadGame = async () => {
    setIsProfileMenuOpen(false);
    try {
      let state: GameState | null = null;
      let investigation: Investigation | null = null;

      // Try Cloud Load first if logged in
      if (user) {
        // 1. Try to find an active investigation
        investigation = await InvestigationService.getActiveInvestigation(user.uid);
        
        if (investigation) {
          // Load from granular structure
          const logs = await InvestigationService.getRecentLogs(investigation.id);
          const historyItems: GameHistoryItem[] = logs.map(l => ({
            role: l.type === 'action' ? 'user' : 'assistant',
            text: l.content
          }));

          setHistory(historyItems.length > 0 ? historyItems : history);
          setLocation(investigation.currentLocation);
          setSanity(investigation.sanity);
          setMedicalPoints(investigation.medicalPoints || 0);
          setMoralPoints(investigation.moralPoints || 0);
          setIsGameOver(investigation.status === 'solved');
          setFlags(investigation.globalFlags);
          setJournalNotes(investigation.journalNotes);
          setActiveInvestigation(investigation);

          // Fetch all NPC states for this investigation
          const npcIds = ['abberline', 'bond', 'edmund', 'lusk', 'diemschutz'];
          const npcPromises = npcIds.map(id => InvestigationService.getNPCState(investigation!.id, id));
          const npcResults = await Promise.all(npcPromises);
          const npcMap: Record<string, NPCState> = {};
          npcResults.forEach((s, i) => {
            if (s) npcMap[npcIds[i]] = s;
          });
          setNpcStates(npcMap);
          
          setNotification({ message: "Investigation Resumed!", type: "success" });
          return;
        }

        // 2. If no investigation, check for old save blob to migrate
        const saveRef = doc(db, 'saves', `${user.uid}_latest`);
        const saveSnap = await getDoc(saveRef);
        if (saveSnap.exists()) {
          const oldSave = saveSnap.data() as GameState & { isMigrated?: boolean };
          if (!oldSave.isMigrated) {
            setNotification({ message: "Migrating Case Files...", type: "success" });
            investigation = await InvestigationService.migrateOldSave(user.uid, oldSave);
            setActiveInvestigation(investigation);
            // Reload with new structure
            handleLoadGame();
            return;
          }
        }

        // 3. If still nothing, start a new investigation
        if (!investigation) {
          investigation = await InvestigationService.startNewInvestigation(user.uid, {
            currentLocation: location,
            sanity,
            globalFlags: flags,
            journalNotes
          });
          setActiveInvestigation(investigation);
          // Add initial log entry
          await InvestigationService.addLogEntry(investigation.id, {
            timestamp: new Date().toISOString(),
            type: 'narration',
            content: history[0].text
          });
        }
      }

      // Fallback to Local Load (Legacy)
      if (!user) {
        const savedData = localStorage.getItem('londonBleedsSave');
        if (savedData) {
          state = JSON.parse(savedData) as GameState;
          setNotification({ message: `Local Save Loaded! (${state.timestamp})`, type: "success" });
          
          setHistory(state.history);
          setLocation(state.location);
          setInventory(state.inventory);
          setSanity(state.sanity || 100);
          setDisposition(state.disposition || INITIAL_DISPOSITION);
          setFlags(state.flags || {});
          setJournalNotes(state.journalNotes || journalNotes);
        }
      }
    } catch (e) {
      console.error("Load failed", e);
      setNotification({ message: "Failed to load game save.", type: "error" });
    }
  };

  // Auto-load cloud save on login
  useEffect(() => {
    if (user && isAuthReady) {
      handleLoadGame();
    }
  }, [user, isAuthReady]);

  const handleAction = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userAction = input;
    setInput('');
    setIsLoading(true);
    // Temporarily unlock auto-scroll to bottom so our top-anchoring takes priority
    setIsAutoScrollLocked(false); 

    setHistory(prev => [...prev, { role: 'user', text: userAction }]);
    setHistory(prev => [...prev, { role: 'assistant', text: '' }]);

    // Persist user action to granular log
    if (user && activeInvestigation) {
      InvestigationService.addLogEntry(activeInvestigation.id, {
        timestamp: new Date().toISOString(),
        type: 'action',
        content: userAction
      });
    }

    try {
      const currentLocationData = WORLD_DATA[location as keyof typeof WORLD_DATA] || { 
        name: "Unknown Location", 
        atmosphere: "Void",
        description: "You are in a place that is not mapped.", 
        exits: [], 
        interactables: [],
        keyClues: [],
        criticalPathLead: ""
      };

      // --- Phase 3: Fetch Dynamic Context ---
      let dynamicContext = "";
      if (user && activeInvestigation) {
        const locState = await InvestigationService.getLocationState(activeInvestigation.id, location);
        if (locState) {
          dynamicContext += `\n=== DYNAMIC LOCATION STATE ===\n${JSON.stringify(locState)}\n`;
        }
        
        // Fetch state for NPCs in this location
        const npcPromises = currentLocationData.interactables
          .filter(id => ['abberline', 'bond', 'edmund', 'lusk', 'diemschutz'].includes(id))
          .map(id => InvestigationService.getNPCState(activeInvestigation.id, id));
        
        const npcStates = await Promise.all(npcPromises);
        const validNpcStates = npcStates.filter(s => s !== null);
        if (validNpcStates.length > 0) {
          dynamicContext += `\n=== DYNAMIC NPC STATES ===\n${JSON.stringify(validNpcStates.map(s => ({
            npcId: s.npcId,
            status: s.status,
            currentLocation: s.currentLocation,
            memory: s.memory // AI now sees what happened in last meetings
          })))}\n`;
        }

        const clues = await InvestigationService.getClues(activeInvestigation.id);
        if (clues.length > 0) {
          dynamicContext += `\n=== DISCOVERED CLUES ===\n${clues.map(c => `- ${c.name}: ${c.description}`).join('\n')}\n`;
        }
      }

      const narrativeHistory = history
        .slice(-10)
        .filter(h => h.role !== 'system')
        .map(h => `${h.role === 'user' ? 'WATSON' : 'GAME ENGINE'}: ${h.text}`)
        .join('\n\n');

      const isDeductionAttempt = input.toLowerCase().includes("deduce") || input.toLowerCase().includes("theory") || input.toLowerCase().includes("killer is");

      const contextPrompt = `
        ${GAME_ENGINE_PROMPT}

        === CURRENT LOCATION DATA ===
        Name: ${currentLocationData.name}
        Key Clues: ${currentLocationData.keyClues.join(', ')}
        CRITICAL PROGRESSION LEAD: ${currentLocationData.criticalPathLead}
        ${dynamicContext}

        === WATSON'S STATUS ===
        - Sanity: ${sanity}/100
        - Medical Path Points: ${medicalPoints}
        - Moral Path Points: ${moralPoints}
        - Inventory: ${inventory.join(', ')}
        - Active Flags: ${JSON.stringify(flags)}
        - Is Deduction Attempt: ${isDeductionAttempt ? "YES" : "NO"}

        REMINDER: If this is a deduction attempt, evaluate it against the Secret Truth (Edmund Halward). 
        If they are correct, reveal the path to the Private Asylum or trigger the Finale.
        If they are wrong, provide a chilling narrative setback.
        Use Watson's medical/moral style based on the points.

        === NARRATIVE HISTORY ===
        ${narrativeHistory}

        === CURRENT STATE ===
        - Location: ${location}
        - Inventory: ${inventory.join(', ')}
        - Sanity: ${sanity}/100
        - Flags: ${JSON.stringify(flags)}
        
        PLAYER ACTION: "${userAction}"
      `;

      let fullAccumulatedText = "";
      let foundSeparatorAt = -1;
      const separator = "<<<GAME_STATE>>>";
      
      const stream = streamGemini(contextPrompt);

      for await (const chunk of stream) {
        fullAccumulatedText += chunk;
        
        if (foundSeparatorAt === -1) {
          const idx = fullAccumulatedText.indexOf(separator);
          if (idx !== -1) {
            foundSeparatorAt = idx;
            const narrativePart = fullAccumulatedText.substring(0, idx);
            setHistory(prev => {
              const newHistory = [...prev];
              newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], text: narrativePart };
              return newHistory;
            });

            // Persist AI response to granular log
            if (user && activeInvestigation) {
              InvestigationService.addLogEntry(activeInvestigation.id, {
                timestamp: new Date().toISOString(),
                type: 'narration',
                content: narrativePart
              });
            }
          } else {
            setHistory(prev => {
              const newHistory = [...prev];
              newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], text: fullAccumulatedText };
              return newHistory;
            });
          }
        }
      }
      
      if (foundSeparatorAt !== -1) {
        const finalJsonData = fullAccumulatedText.substring(foundSeparatorAt + separator.length).trim();
        if (finalJsonData) {
          try {
              const aiData = JSON.parse(finalJsonData) as GameResponse;
              if (aiData.newLocationId && WORLD_DATA[aiData.newLocationId as keyof typeof WORLD_DATA]) {
                  setLocation(aiData.newLocationId);
              }
              if (aiData.inventoryUpdate) {
                  let newInv = [...inventory];
                  if (aiData.inventoryUpdate.add) newInv = [...newInv, ...aiData.inventoryUpdate.add];
                  if (aiData.inventoryUpdate.remove) newInv = newInv.filter(i => !aiData.inventoryUpdate!.remove!.includes(i));
                  setInventory(newInv);
              }
              if (aiData.sanityUpdate) {
                  setSanity(prev => Math.max(0, Math.min(100, prev + aiData.sanityUpdate!)));
              }
              if (aiData.flagsUpdate) {
                  setFlags(prev => ({ ...prev, ...aiData.flagsUpdate }));
              }

              // Update investigation state after AI turn
              if (user && activeInvestigation) {
                // 1. Update Core Investigation
                InvestigationService.updateInvestigation(activeInvestigation.id, {
                  currentLocation: aiData.newLocationId || location,
                  sanity: aiData.sanityUpdate ? Math.max(0, Math.min(100, sanity + aiData.sanityUpdate)) : sanity,
                  medicalPoints: medicalPoints + (aiData.medicalPointsUpdate || 0),
                  moralPoints: moralPoints + (aiData.moralPointsUpdate || 0),
                  globalFlags: { ...flags, ...(aiData.flagsUpdate || {}) },
                  journalNotes: journalNotes,
                });

                if (aiData.medicalPointsUpdate) setMedicalPoints(prev => prev + aiData.medicalPointsUpdate!);
                if (aiData.moralPointsUpdate) setMoralPoints(prev => prev + aiData.moralPointsUpdate!);

                if (aiData.gameOver) {
                  setIsGameOver(true);
                  InvestigationService.updateInvestigation(activeInvestigation.id, {
                    status: 'solved',
                    updatedAt: new Date().toISOString()
                  });
                }

                // 2. Handle Location Mutations
                if (aiData.locationMutations) {
                  Object.entries(aiData.locationMutations).forEach(([locId, updates]) => {
                    InvestigationService.upsertLocationState(activeInvestigation.id, locId, updates);
                  });
                }

                // 3. Handle NPC Mutations
                if (aiData.npcMutations) {
                  Object.entries(aiData.npcMutations).forEach(([npcId, updates]) => {
                    InvestigationService.upsertNPCState(activeInvestigation.id, npcId, updates);
                    setNpcStates(prev => ({
                      ...prev,
                      [npcId]: { ...(prev[npcId] || { npcId, disposition: 50, status: 'alive' }), ...updates }
                    }));
                  });
                }

                // 4. Handle NPC Memory Updates
                if (aiData.npcMemoryUpdate) {
                  Object.entries(aiData.npcMemoryUpdate).forEach(async ([npcId, summary]) => {
                    const currentState = await InvestigationService.getNPCState(activeInvestigation.id, npcId);
                    const memory = currentState?.memory || [];
                    const newMemory = [summary, ...memory].slice(0, 5); // Keep last 5
                    InvestigationService.upsertNPCState(activeInvestigation.id, npcId, { memory: newMemory });
                    setNpcStates(prev => ({
                      ...prev,
                      [npcId]: { ...(prev[npcId] || { npcId, disposition: 50, status: 'alive' }), memory: newMemory }
                    }));
                  });
                }

                // 5. Handle Discovered Clues
                if (aiData.discoveredClues) {
                  aiData.discoveredClues.forEach(clue => {
                    InvestigationService.addClue(activeInvestigation.id, clue);
                  });
                }
              }
              if (aiData.dispositionUpdate) {
                  setDisposition(prev => {
                  const next = { ...prev };
                  Object.keys(aiData.dispositionUpdate || {}).forEach(char => {
                      const charKey = char as keyof typeof prev;
                      if (next[charKey]) {
                          const update = aiData.dispositionUpdate![charKey];
                          if (update) {
                            if (update.trust !== undefined) next[charKey].trust += update.trust;
                            if (update.annoyance !== undefined) next[charKey].annoyance += update.annoyance;
                          }
                      }
                  });
                  return next;
                  });
              }
          } catch (parseError) {
              console.error("Failed to parse game state JSON", parseError);
          }
        }
      }

    } catch (error) {
      console.error(error);
      setHistory(prev => [...prev, { role: 'system', text: "The connection to the engine was lost." }]);
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
      const currentLocationData = WORLD_DATA[location as keyof typeof WORLD_DATA];
      const context = history.slice(-4).map(m => `${m.role}: ${m.text || ""}`).join('\n');
      
      const prompt = `
        You are Sherlock Holmes. Watson (the player) is stuck.
        Location: ${currentLocationData?.name}
        Progression Goal: ${currentLocationData?.criticalPathLead}
        Watson's Style: ${medicalPoints > moralPoints ? "Highly analytical and medical" : moralPoints > medicalPoints ? "Deeply moral and empathetic" : "Balanced"}
        Current Flags: ${JSON.stringify(flags)}
        Context: ${context}
        Task: Give a sharp, brief, cryptic deduction that points Watson toward the Medical or Moral Path. 
        Max 40 words. No fluff. Use Holmes's intellectual but respectful tone toward Watson.
      `;
      
      const hint = await callGemini(prompt, false, 0);
      setHistory(prev => [...prev, { 
        role: 'assistant', 
        text: `> *Holmes leans in, his eyes sharp and analytical...*\n\n**Sherlock Holmes**: "${hint || "Focus on the facts at hand, Watson!"}"` 
      }]);
      // For holmes, we want to scroll to bottom since it's an extra help line
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error("Hint failed", error);
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

      const prompt = `You are Dr. Watson. Update your diary entries based on the case progress. 
      STRICT CONSTRAINTS:
      1. Keep the sections: **Found:** and **Sanity Note:**.
      2. Provide a TOTAL of only 2 to 3 bullet points across the entire notes.
      3. Focus on medical findings and systemic observations.
      4. Be brief. No narrative re-telling.
      
      Source Material: ${fullStory}`;
      
      const notes = await callGemini(prompt, false, 0);
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
    <div className="flex h-screen w-full overflow-hidden font-sans selection:bg-[#CD7B00] selection:text-white" 
         style={{ backgroundColor: THEME.colors.bg, color: THEME.colors.primary }}>

      <div 
        className={`fixed inset-0 bg-[#293351]/50 z-40 lg:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}

      <div className={`
        fixed lg:relative z-50 h-full border-r transition-all duration-300 ease-in-out flex flex-col bg-[#FDF9F5] flex-shrink-0 overflow-hidden w-80
        ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full lg:w-0 lg:translate-x-0 lg:opacity-0'}
      `} style={{ borderColor: THEME.colors.border }}>
        
        <div className="flex justify-between items-center px-8 pt-8 lg:hidden">
          <button onClick={() => setIsSidebarOpen(false)} className="text-[#293351]"><X size={24} /></button>
        </div>

        <div className={`flex-1 overflow-y-auto p-8 w-80 ${isSidebarOpen ? 'opacity-100 transition-opacity duration-500 delay-100' : 'opacity-0'}`}>
            <div className="mb-8">
                <div className="flex items-center gap-2 text-[#CD7B00] mb-2">
                    <MapPin size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Current Sector</span>
                </div>
                <h2 className="font-serif text-2xl leading-tight text-[#293351]">
                    {WORLD_DATA[location as keyof typeof WORLD_DATA]?.name || "Unknown Location"}
                </h2>
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-2 text-[#CD7B00] mb-4">
                    <Briefcase size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Medical Bag</span>
                </div>
                <ul className="space-y-3">
                    {inventory.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-[#293351] opacity-90">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#CD7B00]" />
                        <span className="font-sans text-md">{item}</span>
                    </li>
                    ))}
                </ul>
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-2 text-[#CD7B00] mb-4">
                    <DoorOpen size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Avenues</span>
                </div>
                <ul className="space-y-3">
                    {WORLD_DATA[location as keyof typeof WORLD_DATA]?.exits.map((exitId, idx) => {
                         const exitData = WORLD_DATA[exitId as keyof typeof WORLD_DATA];
                         return (
                            <li key={idx} className="flex items-center gap-3 text-[#293351] opacity-90">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#CD7B00]" />
                                <span className="font-sans text-md">{exitData?.shortName || exitId}</span>
                            </li>
                         );
                    })}
                </ul>
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-2 text-[#CD7B00] mb-4">
                    <User size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Present in Sector</span>
                </div>
                <ul className="space-y-3">
                    {Object.entries(npcStates)
                      .filter(([_, state]) => state.currentLocation === location && state.status !== 'deceased')
                      .map(([npcId, state]) => (
                        <li key={npcId} className="flex flex-col gap-1 text-[#293351] opacity-90">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#CD7B00]" />
                              <span className="font-sans text-md font-bold capitalize">{npcId}</span>
                            </div>
                            {state.memory && state.memory.length > 0 && (
                              <p className="text-[10px] italic pl-4.5 opacity-60">Last: {state.memory[0]}</p>
                            )}
                        </li>
                      ))
                    }
                    {/* Fallback to static data if no dynamic NPCs found yet */}
                    {Object.values(npcStates).filter(s => s.currentLocation === location).length === 0 && 
                      WORLD_DATA[location as keyof typeof WORLD_DATA]?.interactables
                        .filter(id => ['abberline', 'bond', 'edmund', 'lusk', 'diemschutz'].includes(id))
                        .map((npcId, idx) => (
                          <li key={idx} className="flex items-center gap-3 text-[#293351] opacity-90">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#CD7B00]" />
                              <span className="font-sans text-md capitalize">{npcId}</span>
                          </li>
                        ))
                    }
                </ul>
            </div>

            <div className="flex flex-col mb-8">
                <div className="flex items-center justify-between text-[#CD7B00] mb-4">
                    <div className="flex items-center gap-2">
                    <ScrollText size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Watson's Diary</span>
                    </div>
                    <button onClick={handleUpdateJournal} disabled={isUpdatingJournal} className="p-1 hover:bg-[#CD7B00]/10 rounded-full transition-colors" title="Refine Diary">
                      <Sparkles size={14} className={isUpdatingJournal ? "animate-spin" : ""} />
                    </button>
                </div>
                <div className="bg-white border border-[#C5CBDD] rounded-lg p-6 shadow-sm relative">
                    <div className="absolute top-2 right-2 opacity-30"><Brain size={16} /></div>
                    <JournalRenderer text={journalNotes} />
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative w-full transition-all duration-300">
        <header className="sticky top-0 z-30 px-8 md:px-16 py-4 flex items-center justify-between bg-[#FDF9F5]/90 backdrop-blur-sm border-b border-[#C5CBDD]">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-[#293351] hover:bg-[#293351]/5 rounded-md">
                {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>

            <div className="relative">
                <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="flex items-center gap-3 text-[#293351] group">
                    <div className="text-right hidden sm:block">
                        <span className="block text-sm font-bold group-hover:text-[#CD7B00]">
                          {user ? user.displayName : "Dr. John Watson"}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest opacity-60">
                          {user ? "Cloud Profile" : "Medical Profile"}
                        </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#293351] text-white flex items-center justify-center overflow-hidden">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={16} />
                      )}
                    </div>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isProfileMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#C5CBDD] rounded-lg shadow-xl z-20 overflow-hidden">
                            <div className="p-1">
                                {user ? (
                                  <>
                                    <div className="px-3 py-2 border-b border-[#FDF9F5] mb-1">
                                      <p className="text-[10px] uppercase tracking-widest text-[#929DBF] font-bold">Logged In As</p>
                                      <p className="text-xs font-medium text-[#293351] truncate">{user.email}</p>
                                    </div>
                                    <button onClick={handleSaveGame} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#293351] hover:bg-[#FDF9F5] rounded text-left"><Save size={14} /><span>Save to Cloud</span></button>
                                    <button onClick={handleLoadGame} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#293351] hover:bg-[#FDF9F5] rounded text-left"><FolderOpen size={14} /><span>Load from Cloud</span></button>
                                    <div className="h-px bg-[#FDF9F5] my-1" />
                                    <button onClick={() => { logout(); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded text-left"><LogOut size={14} /><span>Sign Out</span></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => { loginWithGoogle(); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#293351] hover:bg-[#FDF9F5] rounded text-left font-bold"><LogIn size={14} /><span>Sign In with Google</span></button>
                                    <div className="h-px bg-[#FDF9F5] my-1" />
                                    <button onClick={handleSaveGame} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#293351] hover:bg-[#FDF9F5] rounded text-left"><Save size={14} /><span>Save Locally</span></button>
                                    <button onClick={handleLoadGame} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#293351] hover:bg-[#FDF9F5] rounded text-left"><FolderOpen size={14} /><span>Load Locally</span></button>
                                  </>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </header>

        <div 
          ref={scrollRef} 
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-8 md:px-16 pb-[60vh] scrollbar-thin scrollbar-thumb-[#CD7B00]/20 scrollbar-track-transparent scroll-smooth"
        >
          <div className="max-w-3xl mx-auto pt-8 pb-6 z-10">
            <h1 className="font-serif text-5xl md:text-[76px] text-[#293351] leading-none mb-2 text-balance">London Bleeds</h1>
            <p className="font-serif text-2xl md:text-[40px] text-[#293351] opacity-90">The Whitechapel Diaries</p>
          </div>

          <div className="max-w-3xl mx-auto">
            {history.map((msg, index) => {
                const isAI = msg.role === 'assistant';
                const isLast = index === history.length - 1;
                const isLatestUser = index === actualLastUserIdx;

                if (!isAI && msg.role !== 'system') {
                return (
                    <div 
                      key={index} 
                      ref={isLatestUser ? lastUserMessageRef : null}
                      className="my-8 animate-in slide-in-from-bottom-2 duration-300 scroll-mt-[100px]"
                    >
                    <div className="pl-6 border-l-[3px] border-[#CD7B00]">
                        <span className="text-[#CD7B00] font-sans font-medium text-[14px] md:text-[20px] leading-relaxed">
                        {msg.text}
                        </span>
                    </div>
                    </div>
                );
                }

                if (isLast && isAI && msg.text !== "") {
                     return (
                        <div key={index} className="mb-8">
                            <TypewriterBlock text={msg.text} />
                        </div>
                    );
                }

                if (msg.text !== "") {
                  return (
                      <div key={index} className="mb-8">
                          <StoryRenderer text={msg.text} />
                      </div>
                  );
                }
                return null;
            })}
            
            {isGameOver && (
                <div className="flex flex-col items-center justify-center py-16 border-t border-[#CD7B00]/20 mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="text-[#CD7B00] flex flex-col items-center gap-4 text-center">
                        <Feather size={48} className="opacity-30" />
                        <div className="space-y-1">
                            <h2 className="font-serif text-4xl italic tracking-tight">Case Closed</h2>
                            <p className="text-xs opacity-60 font-sans tracking-[0.3em] uppercase">The Whitechapel Diaries</p>
                        </div>
                    </div>
                    
                    <div className="max-w-md text-center space-y-4">
                        <p className="font-serif text-[#293351]/70 italic leading-relaxed">
                            The ink has dried on this chapter of London's history. The truth, however elusive, has been recorded.
                        </p>
                    </div>

                    <button 
                        onClick={() => window.location.reload()}
                        className="group flex items-center gap-3 px-10 py-4 bg-[#293351] text-[#FDF9F5] rounded-full font-sans text-xs tracking-[0.2em] uppercase hover:bg-[#CD7B00] transition-all duration-500 shadow-xl hover:shadow-2xl hover:-translate-y-1"
                    >
                        <span>Begin a New Diary</span>
                        <ArrowDown size={14} className="group-hover:translate-y-1 transition-transform" />
                    </button>
                </div>
            )}
          </div>
        </div>

        {!isGameOver && (
          <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 pt-32 md:px-16 md:pb-12 md:pt-48 bg-gradient-to-t from-[#FDF9F5] via-[#FDF9F5] to-transparent pointer-events-none">
            <form onSubmit={handleAction} className="relative pointer-events-auto max-w-3xl mx-auto">
              {isLoading && (isConsultingHolmes || (history.length > 0 && history[history.length-1].role === 'assistant' && history[history.length-1].text === "")) && (
                  <div className="absolute bottom-full left-4 mb-2 flex items-center gap-2 text-[#CD7B00] animate-in fade-in zoom-in-95 duration-300 z-20">
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
                  className="w-full bg-white border border-[#C5CBDD] rounded-full py-4 pl-6 pr-24 text-[#293351] placeholder-[#929DBF] text-lg focus:outline-none focus:border-[#CD7B00] shadow-sm relative z-10"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                  <button 
                    type="button" 
                    onClick={handleConsultHolmes} 
                    disabled={isLoading} 
                    className="p-2 text-[#929DBF] hover:text-[#CD7B00] transition-colors disabled:opacity-50"
                    title="Consult Holmes"
                  >
                    <Lightbulb size={20} />
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading || !input.trim()} 
                    className="p-2 text-[#929DBF] hover:text-[#CD7B00] transition-colors disabled:opacity-50"
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
      <FirebaseProvider>
        <AppContent />
      </FirebaseProvider>
    </ErrorBoundary>
  );
};

export default App;
