
import { 
  MapPin, Send, Briefcase, User, Menu, X, Feather, Sparkles, 
  ScrollText, Lightbulb, Save, FolderOpen, Brain, PanelLeftClose, 
  PanelLeftOpen, ChevronDown, LogOut, DoorOpen
} from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StoryRenderer } from './components/StoryRenderer';
import { JournalRenderer } from './components/JournalRenderer';
import { TypewriterBlock } from './components/TypewriterBlock';
import { Notification } from './components/Notification';
import { callGemini, streamGemini } from './services/geminiService';
import { 
  THEME, 
  INITIAL_LOCATION, 
  INITIAL_INVENTORY, 
  INITIAL_SANITY, 
  INITIAL_DISPOSITION, 
  WORLD_DATA, 
  GAME_ENGINE_PROMPT 
} from './constants';
import { GameHistoryItem, GameState, GameResponse } from './types';

const App: React.FC = () => {
  // --- STATE ---
  const [history, setHistory] = useState<GameHistoryItem[]>([
    { 
      role: 'assistant', 
      text: "### SCENE 1: A STUDY IN SMOKE\n\n> *The pattern is too deliberate...*\n\nYou stand in 221B Baker Street. It is early morning. **Sherlock Holmes** sits cross-legged on the floor, surrounded by a chaotic map of Whitechapel, red string connecting points like *bloody veins*. You hold **The Diary** in your hand; its cover feels faintly warm.\n\nHolmes murmurs without looking up: \"The sigils match the locations, Watson. Inspect the board.\"\n\n**Sherlock Holmes** is here, sitting cross-legged on the floor amidst a sea of maps.\n**Objects of interest:** The Case files, The Board.\n**Possible exits:** Scotland Yard." 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Game State
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [sanity, setSanity] = useState(INITIAL_SANITY);
  const [disposition, setDisposition] = useState(INITIAL_DISPOSITION);
  
  const [journalNotes, setJournalNotes] = useState("CASE PROGRESS:\n\n**Current Lead:**\n* Inspect the map board at Baker Street.\n\n**Inventory:**\n* Diary, Watch, Laudanum.");
  
  const [isUpdatingJournal, setIsUpdatingJournal] = useState(false);
  const [isConsultingHolmes, setIsConsultingHolmes] = useState(false);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [history, scrollToBottom]);

  const handleSaveGame = () => {
    setIsProfileMenuOpen(false);
    const gameState: GameState = {
      history,
      location,
      inventory,
      sanity,
      disposition,
      journalNotes,
      timestamp: new Date().toLocaleString()
    };
    try {
      localStorage.setItem('londonBleedsSave', JSON.stringify(gameState));
      setNotification({ message: "Game Saved Successfully!", type: "success" });
    } catch (e) {
      console.error("Save failed", e);
      setNotification({ message: "Failed to save game.", type: "error" });
    }
  };

  const handleLoadGame = () => {
    setIsProfileMenuOpen(false);
    try {
      const savedData = localStorage.getItem('londonBleedsSave');
      if (!savedData) {
        setNotification({ message: "No saved game found.", type: "error" });
        return;
      }
      const state = JSON.parse(savedData) as GameState;
      setHistory(state.history);
      setLocation(state.location);
      setInventory(state.inventory);
      setSanity(state.sanity || 100);
      setDisposition(state.disposition || INITIAL_DISPOSITION);
      setJournalNotes(state.journalNotes || journalNotes);
      setNotification({ message: `Game Loaded! (${state.timestamp})`, type: "success" });
    } catch (e) {
      console.error("Load failed", e);
      setNotification({ message: "Failed to load game save.", type: "error" });
    }
  };

  const handleAction = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userAction = input;
    setInput('');
    setIsLoading(true);

    setHistory(prev => [...prev, { role: 'user', text: userAction }]);
    setHistory(prev => [...prev, { role: 'assistant', text: '' }]);

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

      const narrativeHistory = history
        .slice(-10)
        .filter(h => h.role !== 'system')
        .map(h => `${h.role === 'user' ? 'PLAYER' : 'GAME ENGINE'}: ${h.text}`)
        .join('\n\n');

      const contextPrompt = `
        ${GAME_ENGINE_PROMPT}

        === CURRENT LOCATION DATA ===
        Name: ${currentLocationData.name}
        Key Clues to Find: ${currentLocationData.keyClues.join(', ')}
        CRITICAL PROGRESSION LEAD: ${currentLocationData.criticalPathLead}

        === NARRATIVE HISTORY ===
        ${narrativeHistory}

        === CURRENT STATE ===
        - Location: ${location}
        - Inventory: ${inventory.join(', ')}
        - Sanity: ${sanity}/100
        
        PLAYER ACTION: "${userAction}"
      `;

      let fullAccumulatedText = "";
      let finalJsonData = "";
      
      const stream = streamGemini(contextPrompt);

      for await (const chunk of stream) {
        fullAccumulatedText += chunk;
        const separator = "<<<GAME_STATE>>>";
        const splitIndex = fullAccumulatedText.indexOf(separator);

        if (splitIndex !== -1) {
             const narrativePart = fullAccumulatedText.substring(0, splitIndex);
             finalJsonData = fullAccumulatedText.substring(splitIndex + separator.length);
             setHistory(prev => {
                const newHistory = [...prev];
                const lastIdx = newHistory.length - 1;
                newHistory[lastIdx] = { ...newHistory[lastIdx], text: narrativePart };
                return newHistory;
             });
        } else {
             setHistory(prev => {
                const newHistory = [...prev];
                const lastIdx = newHistory.length - 1;
                newHistory[lastIdx] = { ...newHistory[lastIdx], text: fullAccumulatedText };
                return newHistory;
             });
        }
      }
      
      if (finalJsonData.trim()) {
        try {
            const aiData = JSON.parse(finalJsonData.trim()) as GameResponse;
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
            if (aiData.dispositionUpdate) {
                setDisposition(prev => {
                const next = { ...prev };
                Object.keys(aiData.dispositionUpdate || {}).forEach(char => {
                    const charKey = char as keyof typeof prev;
                    if (next[charKey]) {
                    const update = aiData.dispositionUpdate![charKey];
                    if (update.trust) next[charKey].trust += update.trust;
                    if (update.annoyance) next[charKey].annoyance += update.annoyance;
                    }
                });
                return next;
                });
            }
        } catch (parseError) {
            console.error("Failed to parse game state JSON", parseError);
        }
      }

    } catch (error) {
      console.error(error);
      setHistory(prev => [...prev, { role: 'system', text: "The connection to the engine was lost." }]);
    } finally {
      setIsLoading(false);
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
        Critical Progression Goal: ${currentLocationData?.criticalPathLead}
        Context: ${context}
        Task: Give a sharp, brief, cryptic deduction that points Watson toward the Critical Path Goal. 
        Max 40 words. No fluff.
      `;
      
      const hint = await callGemini(prompt, false);
      setHistory(prev => [...prev, { 
        role: 'assistant', 
        text: `> *Holmes leans in, his eyes sharp and analytical...*\n\n**Sherlock Holmes**: "${hint || "Focus on the facts at hand, Watson!"}"` 
      }]);
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
      const fullStory = history.filter(h => h.role !== 'system').map(h => h.text || "").join('\n');
      const prompt = `You are Dr. Watson. Update your medical journal about the Whitechapel case.
      Constraint: Keep it very brief and fact-oriented. No narrative re-telling.
      Format: 
      **Found:**
      - [bulleted list of clues]
      
      **Current Lead:**
      - [bulleted list of next steps]
      
      **Sanity Note:**
      - [brief medical reflection on sanity]
      
      Source Material: ${fullStory}`;
      
      const notes = await callGemini(prompt, false);
      setJournalNotes(notes || "No updates available.");
    } catch (error) {
      console.error("Journal update failed", error);
    } finally {
      setIsUpdatingJournal(false);
    }
  };

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
                    <span className="uppercase tracking-widest text-xs font-bold">Current Location</span>
                </div>
                <h2 className="font-serif text-2xl leading-tight text-[#293351]">
                    {WORLD_DATA[location as keyof typeof WORLD_DATA]?.name || "Unknown Location"}
                </h2>
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-2 text-[#CD7B00] mb-4">
                    <Briefcase size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Inventory</span>
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
                    <span className="uppercase tracking-widest text-xs font-bold">Exits</span>
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

            <div className="flex flex-col mb-8">
                <div className="flex items-center justify-between text-[#CD7B00] mb-4">
                    <div className="flex items-center gap-2">
                    <ScrollText size={18} />
                    <span className="uppercase tracking-widest text-xs font-bold">Watson's Journal</span>
                    </div>
                    <button onClick={handleUpdateJournal} disabled={isUpdatingJournal} className="p-1 hover:bg-[#CD7B00]/10 rounded-full transition-colors">
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
                        <span className="block text-sm font-bold group-hover:text-[#CD7B00]">Dr. John Watson</span>
                        <span className="text-[10px] uppercase tracking-widest opacity-60">Detective Profile</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#293351] text-white flex items-center justify-center"><User size={16} /></div>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isProfileMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-[#C5CBDD] rounded-lg shadow-xl z-20 overflow-hidden">
                            <div className="p-1">
                                <button onClick={handleSaveGame} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#293351] hover:bg-[#FDF9F5] rounded text-left"><Save size={14} /><span>Save Progress</span></button>
                                <button onClick={handleLoadGame} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#293351] hover:bg-[#FDF9F5] rounded text-left"><FolderOpen size={14} /><span>Load Game</span></button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 md:px-16 pb-64 scroll-smooth">
          <div className="max-w-4xl mx-auto pt-8 pb-6 z-10">
            <h1 className="font-serif text-5xl md:text-[76px] text-[#293351] leading-none mb-2">London Bleeds</h1>
            <p className="font-serif text-2xl md:text-[40px] text-[#293351] opacity-90">The Whitechapel diaries</p>
          </div>

          <div className="max-w-4xl mx-auto">
            {history.map((msg, index) => {
                const isAI = msg.role === 'assistant';
                const isLast = index === history.length - 1;

                if (!isAI && msg.role !== 'system') {
                return (
                    <div key={index} className="my-8 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="pl-4 border-l-[2px] border-[#CD7B00]">
                        <span className="text-[#CD7B00] font-sans font-medium text-[16px] md:text-[20px] leading-relaxed">
                        {msg.text}
                        </span>
                    </div>
                    </div>
                );
                }

                if (isLast && isAI) {
                     return (
                        <div key={index} className="mb-8">
                            <TypewriterBlock text={msg.text} scrollToBottom={scrollToBottom} />
                        </div>
                    );
                }

                return (
                    <div key={index} className="mb-8">
                        <StoryRenderer text={msg.text} />
                    </div>
                );
            })}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 pt-32 md:px-16 md:pb-12 md:pt-48 bg-gradient-to-t from-[#FDF9F5] via-[#FDF9F5] to-transparent pointer-events-none">
          <form onSubmit={handleAction} className="relative pointer-events-auto max-w-4xl mx-auto">
            <div className="absolute right-0 -top-10 flex justify-end mb-2 z-20">
               <button type="button" onClick={handleConsultHolmes} disabled={isLoading} className="flex items-center gap-2 bg-[#293351] text-white px-4 py-1.5 rounded-t-lg shadow-sm hover:bg-[#CD7B00] transition-all disabled:opacity-50">
                 <Lightbulb size={14} className="text-yellow-300" /><span className="text-xs font-bold uppercase">Consult Holmes</span>
               </button>
            </div>

            {isLoading && history[history.length-1].text === "" && (
                <div className="absolute bottom-full left-4 mb-2 flex items-center gap-2 text-[#CD7B00] animate-in fade-in zoom-in-95 duration-300 z-20">
                    <Feather size={14} className="animate-bounce" />
                    <span className="text-sm italic font-serif">
                        {isConsultingHolmes ? "Holmes is deducing..." : "The ink is flowing..."}
                    </span>
                </div>
            )}

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What do you wish to do?"
              className="w-full bg-white border border-[#C5CBDD] rounded-lg py-4 pl-4 pr-14 text-[#293351] placeholder-[#929DBF] text-lg focus:outline-none focus:border-[#CD7B00] shadow-sm relative z-10"
              autoFocus
            />
            <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#929DBF] hover:text-[#CD7B00] z-20">
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;