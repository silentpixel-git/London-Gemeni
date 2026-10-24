/**
 * components/Sidebar.tsx
 *
 * Left panel showing current location, medical bag, present NPCs,
 * objects of interest, and available exits.
 */

import React, { useEffect, useRef } from 'react';
import { MapPin, BriefcaseMedical, Compass, Users, Eye, CloudFog, CloudDrizzle, CloudRain, Cloudy, Moon, Haze, type LucideIcon } from 'lucide-react';
import { LOCATIONS } from '../engine/gameData';
import { sceneView, type SceneItem } from '../hooks/gameState/sceneView';
import type { ActWeather, WeatherCondition } from '../engine/gameData';
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
  /** Puts a command in the input without sending it. */
  onPrefill: (command: string) => void;
}

const SectionHead: React.FC<{ icon: LucideIcon; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-lb-accent">
    <Icon size={15} />
    {children}
  </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="m-0 text-sm italic text-lb-muted">{children}</p>
);

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
  onPrefill,
}) => {
  const WeatherIcon = WEATHER_ICON[weather.condition];
  const view = sceneView({ location, currentAct, inventory, npcStates, introducedNpcs, flags });

  // Items that appear while Watson stays in one place (a bag item, a revealed
  // object, an arrival) slide in; a new location shows its lists at once.
  // `keys` is what was listed on arriving; anything else here is new (the class
  // stays put, so later re-renders never cut the animation short).
  const shown = useRef<{ location: string; keys: Set<string> }>({ location: '', keys: new Set() });
  const arrive = (key: string) =>
    shown.current.location === location && !shown.current.keys.has(key) ? 'lb-arrive' : '';
  const keys = [
    ...view.bag.map(i => `i:${i.id}`),
    ...view.people.map(n => `n:${n.id}`),
    ...view.objects.flatMap(o => [`o:${o.id}`, ...o.children.map(c => `c:${c.id}`)]),
    ...view.exits.map(e => `e:${e.id}`),
  ];
  useEffect(() => {
    if (shown.current.location !== location) shown.current = { location, keys: new Set(keys) };
  });

  // A list entry is a button: a click puts its command in the input (it does
  // not send it), and closes the drawer on narrow screens.
  // A render helper, not a component, so re-renders never remount the rows.
  const renderItem = (item: SceneItem, arriveKey: string, hollow = false, note?: string) => (
    <li key={arriveKey} className={arrive(arriveKey)}>
      <button
        type="button"
        onClick={() => { onPrefill(item.command); onClose(); }}
        title={`Puts \u201c${item.command}\u201d in the command line`}
        className="flex items-baseline gap-2.5 w-full -ml-1.5 px-1.5 py-1 rounded-md text-left text-[15px] leading-[1.4] text-lb-primary hover:bg-lb-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lb-accent"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 -translate-y-0.5 ${hollow ? 'border border-lb-accent' : 'bg-lb-accent'}`} />
        <span>
          {item.label}
          {note && <small className="ml-1.5 text-xs text-lb-muted">{note}</small>}
        </span>
      </button>
    </li>
  );

  return (
    <aside
      aria-label="Case sidebar"
      // Off-screen when closed: keep its buttons out of the tab order and the
      // accessibility tree too.
      inert={!isSidebarOpen}
      className={`
      fixed desk:relative inset-y-0 left-0 z-50 h-full w-[min(320px,86vw)] desk:w-80 flex-shrink-0 overflow-y-auto
      border-r border-lb-border bg-lb-bg shadow-[0_0_40px_rgb(0_0_0/0.2)] desk:shadow-none
      transition-transform [transition-duration:320ms] ease-drawer desk:transition-none
      ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[105%] desk:translate-x-0 desk:-ml-80'}
    `} data-flip>
      <div key={location} className="flex flex-col gap-8 px-5 pb-6 pt-[calc(24px+env(safe-area-inset-top,0px))] desk:p-8 animate-in fade-in duration-300">

        {/* Current location */}
        <section className="flex flex-col gap-3">
          <SectionHead icon={MapPin}>Current Location</SectionHead>
          <h2 className="m-0 font-serif font-bold text-2xl leading-[1.2] text-balance">
            {LOCATIONS[location]?.name || 'Unknown Location'}
          </h2>
          <p className="m-0 italic tabular-nums text-lb-primary/75">{displayTime} — {displayDate}</p>
          <p className="m-0 flex items-center gap-2 text-sm text-lb-primary/75">
            <WeatherIcon size={16} className="text-lb-accent shrink-0" />
            <span>{weather.label}</span>
          </p>
        </section>

        {/* Medical bag */}
        <section className="flex flex-col gap-3">
          <SectionHead icon={BriefcaseMedical}>Medical Bag</SectionHead>
          {view.bag.length > 0 ? (
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {view.bag.map(item => renderItem(item, `i:${item.id}`))}
            </ul>
          ) : (
            <Empty>The usual instruments.</Empty>
          )}
        </section>

        {/* Present NPCs */}
        <section className="flex flex-col gap-3">
          <SectionHead icon={Users}>Present in Location</SectionHead>
          {view.people.length > 0 ? (
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {view.people.map(p => renderItem(p, `n:${p.id}`))}
            </ul>
          ) : (
            <Empty>No one else is here.</Empty>
          )}
        </section>

        {/* Objects of interest — the engine's own visibility rule; containers
            list their revealed contents beneath them. */}
        <section className="flex flex-col gap-3">
          <SectionHead icon={Eye}>Objects of Interest</SectionHead>
          {view.objects.length > 0 ? (
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {view.objects.map(obj => (
                <React.Fragment key={obj.id}>
                  {renderItem(obj, `o:${obj.id}`, false, obj.closed ? 'closed' : undefined)}
                  {obj.children.length > 0 && (
                    <li>
                      <ul className="m-0 pl-5 p-0 list-none flex flex-col gap-1">
                        {obj.children.map(c => renderItem(c, `c:${c.id}`, true))}
                      </ul>
                    </li>
                  )}
                </React.Fragment>
              ))}
            </ul>
          ) : (
            <Empty>Nothing here catches the eye.</Empty>
          )}
        </section>

        {/* Available exits */}
        <section className="flex flex-col gap-3">
          <SectionHead icon={Compass}>Avenues</SectionHead>
          {view.exits.length > 0 ? (
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {view.exits.map(e => renderItem(e, `e:${e.id}`))}
            </ul>
          ) : (
            <Empty>Investigate further before leaving.</Empty>
          )}
        </section>

      </div>
    </aside>
  );
};
