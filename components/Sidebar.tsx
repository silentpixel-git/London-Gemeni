/**
 * components/Sidebar.tsx
 *
 * Left panel showing current location, medical bag, present NPCs,
 * objects of interest, and available exits.
 */

import React from 'react';
import { MapPin, Briefcase, DoorOpen, User, Search, X, CloudFog, CloudDrizzle, CloudRain, Cloudy, Moon, Haze, type LucideIcon } from 'lucide-react';
import { LOCATIONS, NPCS, NPC_ALIASES, OBJECT_DISPLAY_NAMES, OBJECT_VISIBILITY, CONTAINER_CONTENTS } from '../engine/gameData';
import type { ActWeather, WeatherCondition } from '../engine/gameData';
import { INITIAL_NPC_STATES, NPC_DISPLAY_NAMES } from '../constants';
import { NPCState } from '../types';

// UI-layer mapping: weather condition → Lucide icon. Kept here (not in the
// engine) so story data stays free of React/Lucide dependencies.
const WEATHER_ICON: Record<WeatherCondition, LucideIcon> = {
  foggy: CloudFog,
  drizzle: CloudDrizzle,
  pouring: CloudRain,
  overcast: Cloudy,
  'clear-night': Moon,
  'clear-cold': Moon,
  'clear-warm': Moon,
  close: Haze,
};

interface SidebarProps {
  isSidebarOpen: boolean;
  onClose: () => void;
  location: string;
  inventory: string[];
  currentAct: number;
  npcStates: Record<string, NPCState>;
  introducedNpcs: string[];
  displayTime: string;
  displayDate: string;
  weather: ActWeather;
  flags: Record<string, boolean>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  onClose,
  location,
  inventory,
  currentAct,
  npcStates,
  introducedNpcs,
  displayTime,
  displayDate,
  weather,
  flags,
}) => {
  const WeatherIcon = WEATHER_ICON[weather.condition];
  // NPCs visible in the current location
  const presentNpcs = Object.values(npcStates).filter(s => {
    const npc = NPCS[s.npcId];
    // Mirrors npcLocationAt's gate check in engine/presence.ts — keep in sync.
    if (npc?.presenceRequiresFlag && flags[npc.presenceRequiresFlag] !== true) return false;
    const npcLoc = s.currentLocation || (INITIAL_NPC_STATES[s.npcId]?.currentLocation);
    return npcLoc === location && s.status !== 'deceased';
  });

  // Exits available at the current act level
  const visibleExits = (LOCATIONS[location]?.exits || []).filter(exitId => {
    const exitData = LOCATIONS[exitId];
    return exitData && exitData.act <= currentAct;
  });

  // Objects of interest — the same visibility rule the engine uses, so the
  // sidebar can never list something the parser will not resolve. Containers
  // render their revealed contents as children.
  const visibleIds = (LOCATIONS[location]?.interactables || [])
    .filter(id => {
      // Mirrors visibleInteractables' gate check in engine/visibility.ts — keep in sync.
      const gate = OBJECT_VISIBILITY[id];
      return !gate || flags[gate] === true;
    });
  const containedIds = new Set(
    Object.entries(CONTAINER_CONTENTS)
      .filter(([containerId]) => visibleIds.includes(containerId))
      .flatMap(([, contents]) => contents)
  );
  const visibleObjects = visibleIds
    .filter(id => !containedIds.has(id))
    .map(id => ({
      name: OBJECT_DISPLAY_NAMES[id] || id,
      // A container with no revealed contents is annotated as closed; one with
      // children needs no marker, since the indentation already says it is open.
      closed: !!CONTAINER_CONTENTS[id] && !visibleIds.some(c => CONTAINER_CONTENTS[id].includes(c)),
      children: (CONTAINER_CONTENTS[id] || [])
        .filter(c => visibleIds.includes(c))
        .map(c => OBJECT_DISPLAY_NAMES[c] || c),
    }));

  return (
    <div className={`
      fixed lg:relative z-50 h-full border-r border-lb-border transition-[width,transform,opacity] duration-300 ease-out-expo flex flex-col bg-lb-bg flex-shrink-0 overflow-hidden w-80
      ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full lg:w-0 lg:translate-x-0 lg:opacity-0'}
    `}>
      {/* Mobile close button */}
      <div className="flex justify-between items-center px-8 pt-8 lg:hidden">
        <button onClick={onClose} className="text-lb-primary">
          <X size={24} />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto p-8 w-80 ${isSidebarOpen ? 'opacity-100 transition-opacity duration-300 delay-75' : 'opacity-0'}`}>

        <div key={location} className="animate-in fade-in duration-300">

        {/* Current location */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-lb-accent mb-2">
            <MapPin size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Current Location</span>
          </div>
          <h2 className="font-serif text-2xl leading-tight text-lb-primary">
            {LOCATIONS[location]?.name || 'Unknown Location'}
          </h2>
          <p className="mt-1 text-xs text-lb-primary font-sans opacity-70 tracking-wide italic">
            {displayTime} — {displayDate}
          </p>
          <p className="mt-0.5 text-xs text-lb-primary font-sans opacity-70 tracking-wide italic flex items-center gap-1.5">
            <WeatherIcon size={13} className="text-lb-accent flex-shrink-0" />
            <span>{weather.label}</span>
          </p>
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

        {/* Present NPCs */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-lb-accent mb-4">
            <User size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Present in Location</span>
          </div>
          <ul className="space-y-3">
            {presentNpcs.length === 0 ? (
              <p className="text-sm text-lb-muted italic">No one else is here.</p>
            ) : (
              presentNpcs.map(state => {
                // Mirror the engine's label resolution (GameEngine.ts): show the
                // real name only once Watson has been introduced; otherwise the alias.
                const npc = NPCS[state.npcId];
                const isIntroduced =
                  !npc?.requiresIntroduction || introducedNpcs.includes(state.npcId);
                const displayName = isIntroduced
                  ? (NPC_DISPLAY_NAMES[state.npcId as keyof typeof NPC_DISPLAY_NAMES] || npc?.displayName || state.npcId)
                  : (npc?.alias ?? NPC_ALIASES[state.npcId] ?? NPC_DISPLAY_NAMES[state.npcId as keyof typeof NPC_DISPLAY_NAMES] ?? state.npcId);
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

        {/* Objects of interest — a reminder of what's in the current scene,
            mirrored from the narration text. Static list, not interactive. */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-lb-accent mb-4">
            <Search size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Objects of Interest</span>
          </div>
          {visibleObjects.length > 0 ? (
            <ul className="space-y-3">
              {visibleObjects.map((obj, idx) => (
                <li key={idx}>
                  <div className="flex items-center gap-3 text-lb-primary opacity-90">
                    <div className="w-1.5 h-1.5 rounded-full bg-lb-accent" />
                    <span className="font-sans text-md">{obj.name}</span>
                    {obj.closed && (
                      <span className="font-sans text-sm italic text-lb-primary opacity-60">closed</span>
                    )}
                  </div>
                  {obj.children.length > 0 && (
                    <ul className="mt-3 ml-6 space-y-3">
                      {obj.children.map((childName, cIdx) => (
                        <li key={cIdx} className="flex items-center gap-3 text-lb-primary opacity-90">
                          <div className="w-1.5 h-1.5 rounded-full border border-lb-accent" />
                          <span className="font-sans text-md">{childName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-sans text-sm text-lb-primary opacity-70 italic">Nothing here catches the eye.</p>
          )}
        </div>

        {/* Available exits */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-lb-accent mb-4">
            <DoorOpen size={18} />
            <span className="uppercase tracking-widest text-xs font-bold">Avenues</span>
          </div>
          {visibleExits.length > 0 ? (
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
          ) : (
            <p className="font-sans text-sm text-lb-primary opacity-70 italic">Investigate further before leaving</p>
          )}
        </div>

        </div>

      </div>
    </div>
  );
};
