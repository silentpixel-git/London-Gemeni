/**
 * components/Sidebar.tsx
 *
 * Left-hand case rail: current location and weather, then collapsible panels
 * for the medical bag, present NPCs, objects of interest, and available exits.
 * Scene data arrives pre-derived (components/sceneView.ts). Tapping a person,
 * object or carried item expands it to its verbs: single-step verbs run at once,
 * verbs that need a second noun or a topic fill the command bar for the player
 * to finish (see RailAction).
 */

import React, { useState } from 'react';
import { MapPin, Briefcase, DoorOpen, User, Search, X, ChevronDown, ArrowRight, CloudFog, CloudDrizzle, CloudRain, Cloudy, Moon, Haze, type LucideIcon } from 'lucide-react';
import { LOCATIONS } from '../engine/gameData';
import type { ActWeather, WeatherCondition } from '../engine/gameData';
import { deriveInventory, type SceneView, type SceneItem, type RailAction } from './sceneView';

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

type PanelId = 'bag' | 'present' | 'objects' | 'avenues';
const STORAGE_KEY = 'lb-rail-collapsed';

// Per-viewer convenience only — storage can be blocked or throw, so the rail
// must render correctly without it.
const loadCollapsed = (): Partial<Record<PanelId, boolean>> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

interface PanelProps {
  id: PanelId;
  icon: LucideIcon;
  title: string;
  count?: number;
  collapsed: boolean;
  onToggle: (id: PanelId) => void;
  children: React.ReactNode;
}

const Panel: React.FC<PanelProps> = ({ id, icon: Icon, title, count, collapsed, onToggle, children }) => (
  <section className="border-t border-lb-border first:border-t-0">
    <button
      type="button"
      onClick={() => onToggle(id)}
      aria-expanded={!collapsed}
      aria-controls={`lb-panel-${id}`}
      className="w-full flex items-center gap-2 py-4 text-lb-accent text-left pressable"
    >
      <Icon size={16} className="shrink-0" />
      <span className="uppercase tracking-widest text-xs font-bold">{title}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] font-sans font-bold text-lb-muted">{count}</span>
      )}
      <ChevronDown
        size={14}
        className={`ml-auto shrink-0 text-lb-muted transition-transform duration-200 ease-out ${collapsed ? '-rotate-90' : ''}`}
      />
    </button>
    {/* grid-rows 0fr→1fr animates height without measuring content */}
    <div
      id={`lb-panel-${id}`}
      className={`grid transition-[grid-template-rows] duration-200 ease-out ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
    >
      <div className="overflow-hidden">
        <div className="pb-5">{children}</div>
      </div>
    </div>
  </section>
);

const Bullet: React.FC<{ hollow?: boolean }> = ({ hollow }) => (
  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hollow ? 'border border-lb-accent' : 'bg-lb-accent'}`} />
);

interface ActionRowProps {
  item: SceneItem;
  hollow?: boolean;
  note?: string;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  onAction: (action: RailAction) => void;
}

/** A list row that expands in place to its verbs: one filled primary button, quieter secondaries. */
const ActionRow: React.FC<ActionRowProps> = ({ item, hollow, note, expanded, disabled, onToggle, onAction }) => {
  // Nothing to offer (not yet addressable, or not an object): a plain row.
  if (item.actions.length === 0) {
    return (
      <div className="flex items-center gap-3 text-lb-primary opacity-90">
        <Bullet hollow={hollow} />
        <span className="font-sans text-md">{item.name}</span>
        {note && <span className="font-sans text-sm italic text-lb-primary opacity-60">{note}</span>}
      </div>
    );
  }
  return (
  <div>
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="w-full flex items-center gap-3 text-left text-lb-primary opacity-90 hover:opacity-100 hover:text-lb-accent pressable"
    >
      <Bullet hollow={hollow} />
      <span className="font-sans text-md">{item.name}</span>
      {note && <span className="font-sans text-sm italic text-lb-primary opacity-60">{note}</span>}
      <ChevronDown
        size={12}
        className={`ml-auto shrink-0 text-lb-muted transition-transform duration-200 ease-out ${expanded ? '' : '-rotate-90'}`}
      />
    </button>
    <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="overflow-hidden">
        <div className="flex flex-wrap gap-2 pt-2.5 pl-[18px]" role="group" aria-label={`Actions for ${item.name}`}>
          {item.actions.map(action => (
            <button
              key={action.key}
              type="button"
              tabIndex={expanded ? 0 : -1}
              disabled={disabled}
              onClick={() => onAction(action)}
              className={`rounded-full px-3 py-1 text-sm font-sans disabled:opacity-40 pressable ${
                action.primary
                  ? 'bg-lb-accent text-white hover:brightness-110'
                  : 'border border-lb-border bg-lb-paper text-lb-primary/80 hover:border-lb-accent hover:text-lb-accent'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

interface SidebarProps {
  isSidebarOpen: boolean;
  onClose: () => void;
  location: string;
  inventory: string[];
  scene: SceneView;
  displayTime: string;
  displayDate: string;
  weather: ActWeather;
  /** True while a turn is resolving — verbs are disabled so a tap can't queue a second action. */
  isBusy: boolean;
  onRunCommand: (command: string) => void;
  onFillCommand: (command: string) => void;
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
  isBusy,
  onRunCommand,
  onFillCommand,
}) => {
  const WeatherIcon = WEATHER_ICON[weather.condition];
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  // One row open at a time — the rail is narrow and a stack of open menus reads as clutter.
  const [openRow, setOpenRow] = useState<string | null>(null);
  const bagItems = React.useMemo(() => deriveInventory(inventory), [inventory]);

  const toggleRow = (key: string) => setOpenRow(prev => (prev === key ? null : key));
  const runAction = (action: RailAction) => {
    setOpenRow(null);
    if (action.mode === 'run') onRunCommand(action.command);
    else onFillCommand(action.command);
  };
  const rowProps = (key: string, item: SceneItem) => ({
    item,
    expanded: openRow === key,
    disabled: isBusy,
    onToggle: () => toggleRow(key),
    onAction: runAction,
  });

  const togglePanel = (id: PanelId) => {
    setCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const panelProps = (id: PanelId) => ({ id, collapsed: !!collapsed[id], onToggle: togglePanel });

  return (
    <aside
      aria-label="Case notes"
      className={`
      fixed left-0 lg:relative z-50 h-full border-r border-lb-border transition-[width,transform,opacity] duration-300 ease-out-expo flex flex-col bg-lb-bg flex-shrink-0 overflow-hidden w-80
      ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full lg:w-0 lg:translate-x-0 lg:opacity-0'}
    `}>
      {/* Mobile close button */}
      <div className="flex justify-between items-center px-6 pt-6 lg:hidden">
        <button onClick={onClose} className="text-lb-primary" aria-label="Close the panel">
          <X size={24} />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto px-6 py-6 w-80 ${isSidebarOpen ? 'opacity-100 transition-opacity duration-300 delay-75' : 'opacity-0'}`}>

        <div key={location} className="animate-in fade-in duration-300">

          {/* Current location — always visible, the page header of the notebook */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-lb-accent mb-2">
              <MapPin size={16} />
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

          <Panel {...panelProps('bag')} icon={Briefcase} title="Medical Bag" count={inventory.length}>
            <ul className="space-y-3">
              {bagItems.map(item => (
                <li key={item.id}><ActionRow {...rowProps(`bag:${item.id}`, item)} /></li>
              ))}
            </ul>
          </Panel>

          <Panel {...panelProps('present')} icon={User} title="Present in Location" count={scene.npcs.length}>
            {scene.npcs.length === 0 ? (
              <p className="text-sm text-lb-muted italic">No one else is here.</p>
            ) : (
              <ul className="space-y-3">
                {scene.npcs.map(npc => (
                  <li key={npc.npcId}>
                    <ActionRow {...rowProps(`npc:${npc.npcId}`, { id: npc.npcId, name: npc.displayName, actions: npc.actions })} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Objects of interest — what's in the current scene, mirrored from the
              narration text. Each row expands to its verbs. */}
          <Panel {...panelProps('objects')} icon={Search} title="Objects of Interest" count={scene.objects.length}>
            {scene.objects.length > 0 ? (
              <ul className="space-y-3">
                {scene.objects.map(obj => (
                  <li key={obj.id}>
                    <ActionRow {...rowProps(`obj:${obj.id}`, obj)} note={obj.closed ? 'closed' : undefined} />
                    {obj.children.length > 0 && (
                      <ul className="mt-3 ml-6 space-y-3">
                        {obj.children.map(child => (
                          <li key={child.id}><ActionRow {...rowProps(`obj:${child.id}`, child)} hollow /></li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-sans text-sm text-lb-primary opacity-70 italic">Nothing here catches the eye.</p>
            )}
          </Panel>

          <Panel {...panelProps('avenues')} icon={DoorOpen} title="Avenues" count={scene.exits.length}>
            {scene.exits.length > 0 ? (
              <ul className="space-y-3">
                {scene.exits.map(exit => (
                  <li key={exit.id}>
                    {/* A single verb, so no expand step: one tap goes. */}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onRunCommand(`Go to ${exit.name}`)}
                      className="w-full flex items-center gap-3 text-left text-lb-primary opacity-90 hover:opacity-100 hover:text-lb-accent disabled:opacity-40 pressable"
                    >
                      <Bullet />
                      <span className="font-sans text-md">{exit.name}</span>
                      <ArrowRight size={13} className="ml-auto shrink-0 text-lb-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-sans text-sm text-lb-primary opacity-70 italic">Investigate further before leaving</p>
            )}
          </Panel>

        </div>
      </div>
    </aside>
  );
};
