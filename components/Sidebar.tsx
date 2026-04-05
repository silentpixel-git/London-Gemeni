/**
 * components/Sidebar.tsx
 *
 * Left panel showing current location, medical bag, available exits,
 * present NPCs, and Watson's diary with an AI-refresh button.
 */

import React from 'react';
import { MapPin, Briefcase, DoorOpen, User, ScrollText, Sparkles, Brain, X } from 'lucide-react';
import { JournalRenderer } from './JournalRenderer';
import { LOCATIONS } from '../engine/gameData';
import { INITIAL_NPC_STATES, NPC_DISPLAY_NAMES } from '../constants';
import { NPCState } from '../types';

interface SidebarProps {
  isSidebarOpen: boolean;
  onClose: () => void;
  location: string;
  inventory: string[];
  currentAct: number;
  npcStates: Record<string, NPCState>;
  journalNotes: string;
  isUpdatingJournal: boolean;
  onUpdateJournal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  onClose,
  location,
  inventory,
  currentAct,
  npcStates,
  journalNotes,
  isUpdatingJournal,
  onUpdateJournal,
}) => {
  // NPCs visible in the current location
  const presentNpcs = Object.values(npcStates).filter(s => {
    const npcLoc = s.currentLocation || (INITIAL_NPC_STATES[s.npcId]?.currentLocation);
    return npcLoc === location && s.status !== 'deceased';
  });

  // Exits available at the current act level
  const visibleExits = (LOCATIONS[location]?.exits || []).filter(exitId => {
    const exitData = LOCATIONS[exitId];
    return exitData && exitData.act <= currentAct;
  });

  return (
    <div className={`
      fixed lg:relative z-50 h-full border-r border-lb-border transition-all duration-300 ease-in-out flex flex-col bg-lb-bg flex-shrink-0 overflow-hidden w-80
      ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full lg:w-0 lg:translate-x-0 lg:opacity-0'}
    `}>
      {/* Mobile close button */}
      <div className="flex justify-between items-center px-8 pt-8 lg:hidden">
        <button onClick={onClose} className="text-lb-primary">
          <X size={24} />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto p-8 w-80 ${isSidebarOpen ? 'opacity-100 transition-opacity duration-500 delay-100' : 'opacity-0'}`}>

        {/* Current location */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-lb-accent mb-2">
            <MapPin size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Current Sector</span>
          </div>
          <h2 className="font-serif text-2xl leading-tight text-lb-primary">
            {LOCATIONS[location]?.name || 'Unknown Location'}
          </h2>
        </div>

        {/* Inventory */}
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

        {/* Available exits */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-lb-accent mb-4">
            <DoorOpen size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Avenues</span>
          </div>
          <ul className="space-y-3">
            {visibleExits.map((exitId, idx) => {
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

        {/* Present NPCs */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-lb-accent mb-4">
            <User size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Present in Sector</span>
          </div>
          <ul className="space-y-3">
            {presentNpcs.length === 0 ? (
              <p className="text-sm text-lb-muted italic">No one else is here.</p>
            ) : (
              presentNpcs.map(state => {
                const displayName =
                  NPC_DISPLAY_NAMES[state.npcId as keyof typeof NPC_DISPLAY_NAMES] || state.npcId;
                return (
                  <li key={state.npcId} className="flex flex-col gap-1 text-lb-primary opacity-90">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-lb-accent" />
                      <span className="font-sans text-md capitalize">{displayName}</span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Watson's Diary */}
        <div className="flex flex-col mb-8">
          <div className="flex items-center justify-between text-lb-accent mb-4">
            <div className="flex items-center gap-2">
              <ScrollText size={18} />
              <span className="uppercase tracking-widest text-xs font-bold">Watson's Diary</span>
            </div>
            <button
              onClick={onUpdateJournal}
              disabled={isUpdatingJournal}
              className="p-1 hover:bg-lb-accent/10 rounded-full transition-colors"
              title="Refine Diary"
            >
              <Sparkles size={14} className={isUpdatingJournal ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="bg-lb-paper border border-lb-border rounded-lg p-6 shadow-sm relative">
            <div className="absolute top-2 right-2 opacity-30">
              <Brain size={16} />
            </div>
            <JournalRenderer text={journalNotes} />
          </div>
        </div>

      </div>
    </div>
  );
};
