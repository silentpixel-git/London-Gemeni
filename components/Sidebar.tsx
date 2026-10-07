/**
 * components/Sidebar.tsx
 *
 * Left-hand panel: current location and weather, then medical bag, present
 * NPCs, objects of interest, and available exits. Scene data arrives
 * pre-derived (components/sceneView.ts).
 *
 * The lists are always open. Tapping a name drops it into the command bar
 * (like an @mention) — the player still writes the verb.
 */

import React from 'react';
import { MapPin, Briefcase, DoorOpen, User, Search, X, CloudFog, CloudDrizzle, CloudRain, Cloudy, Moon, Haze, type LucideIcon } from 'lucide-react';
import { LOCATIONS } from '../engine/gameData';
import type { ActWeather, WeatherCondition } from '../engine/gameData';
import type { SceneView } from './sceneView';

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

const SectionTitle: React.FC<{ icon: LucideIcon; title: string }> = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 text-lb-accent mb-4">
    <Icon size={18} />
    <span className="uppercase tracking-widest text-xs font-bold">{title}</span>
  </div>
);

interface NameProps {
  name: string;
  hollow?: boolean;
  note?: string;
  capitalize?: boolean;
  onMention: (name: string) => void;
}

/** A list entry; tapping it inserts its name into the command bar. */
const Name: React.FC<NameProps> = ({ name, hollow, note, capitalize, onMention }) => (
  <button
    type="button"
    onClick={() => onMention(name)}
    className="flex items-center gap-3 text-left text-lb-primary opacity-90 hover:opacity-100 hover:text-lb-accent pressable"
  >
    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hollow ? 'border border-lb-accent' : 'bg-lb-accent'}`} />
    <span className={`font-sans text-md ${capitalize ? 'capitalize' : ''}`}>{name}</span>
    {note && <span className="font-sans text-sm italic text-lb-primary opacity-60">{note}</span>}
  </button>
);

interface SidebarProps {
  isSidebarOpen: boolean;
  onClose: () => void;
  location: string;
  inventory: string[];
  scene: SceneView;
  displayTime: string;
  displayDate: string;
  weather: ActWeather;
  onMention: (name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  onClose,
  location,
  inventory,
  scene,
  displayTime,
  displayDate,
  weather,
  onMention,
}) => {
  const WeatherIcon = WEATHER_ICON[weather.condition];

  return (
    <aside
      aria-label="Case notes"
      className={`
      fixed left-0 lg:relative z-50 h-full border-r border-lb-border transition-[width,transform,opacity] duration-300 ease-out-expo flex flex-col bg-lb-bg flex-shrink-0 overflow-hidden w-80
      ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full lg:w-0 lg:translate-x-0 lg:opacity-0'}
    `}>
      {/* Mobile close button */}
      <div className="flex justify-between items-center px-8 pt-8 lg:hidden">
        <button onClick={onClose} className="text-lb-primary" aria-label="Close the panel">
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
            <SectionTitle icon={Briefcase} title="Medical Bag" />
            <ul className="space-y-3">
              {inventory.map(item => (
                <li key={item}><Name name={item} onMention={onMention} /></li>
              ))}
            </ul>
          </div>

          {/* Present NPCs */}
          <div className="mb-8">
            <SectionTitle icon={User} title="Present in Location" />
            {scene.npcs.length === 0 ? (
              <p className="text-sm text-lb-muted italic">No one else is here.</p>
            ) : (
              <ul className="space-y-3">
                {scene.npcs.map(npc => (
                  <li key={npc.npcId}><Name name={npc.displayName} capitalize onMention={onMention} /></li>
                ))}
              </ul>
            )}
          </div>

          {/* Objects of interest — what's in the current scene, mirrored from the
              narration text. Containers show their revealed contents as children. */}
          <div className="mb-8">
            <SectionTitle icon={Search} title="Objects of Interest" />
            {scene.objects.length > 0 ? (
              <ul className="space-y-3">
                {scene.objects.map(obj => (
                  <li key={obj.id}>
                    <Name name={obj.name} note={obj.closed ? 'closed' : undefined} onMention={onMention} />
                    {obj.children.length > 0 && (
                      <ul className="mt-3 ml-6 space-y-3">
                        {obj.children.map(child => (
                          <li key={child}><Name name={child} hollow onMention={onMention} /></li>
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
            <SectionTitle icon={DoorOpen} title="Avenues" />
            {scene.exits.length > 0 ? (
              <ul className="space-y-3">
                {scene.exits.map(exit => (
                  <li key={exit.id}><Name name={exit.name} onMention={onMention} /></li>
                ))}
              </ul>
            ) : (
              <p className="font-sans text-sm text-lb-primary opacity-70 italic">Investigate further before leaving</p>
            )}
          </div>

        </div>
      </div>
    </aside>
  );
};
