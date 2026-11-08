/**
 * components/Sidebar.tsx
 *
 * Left panel showing current location, carried items, present people,
 * objects of interest, and available exits. Story-agnostic: it renders only
 * from the server-provided PlayerView (packages/schema/view.ts) and never
 * reads story data, engine state or flags.
 */

import React, { useEffect, useRef } from 'react';
import { MapPin, Briefcase, Compass, Users, Eye, CloudFog, CloudDrizzle, CloudRain, Cloudy, Moon, Haze, type LucideIcon } from 'lucide-react';
import type { PlayerView } from '../packages/schema/view.js';
import { formatClock } from '../services/viewFormat';

// UI-layer mapping: weather id/name keywords → Lucide icon. The view carries
// only an id and a name, so the icon is picked by keyword.
function weatherIcon(weather: { id: string; name: string }): LucideIcon {
  const s = `${weather.id} ${weather.name}`.toLowerCase();
  if (s.includes('fog') || s.includes('mist')) return CloudFog;
  if (s.includes('drizzle')) return CloudDrizzle;
  if (s.includes('rain') || s.includes('pour') || s.includes('storm')) return CloudRain;
  if (s.includes('clear')) return Moon;
  if (s.includes('haze') || s.includes('close')) return Haze;
  return Cloudy;
}

interface SidebarProps {
  isSidebarOpen: boolean;
  onClose: () => void;
  /** Puts a command in the input without sending it. */
  onPrefill: (command: string) => void;
  view: PlayerView | null;
}

interface Row { label: string; command: string }

const SectionHead: React.FC<{ icon: LucideIcon; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-lb-accent">
    <Icon size={15} />
    {children}
  </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="m-0 text-sm italic text-lb-muted">{children}</p>
);

export const Sidebar: React.FC<SidebarProps> = ({ isSidebarOpen, onClose, onPrefill, view }) => {
  const locationId = view?.location.id ?? '';

  // Items that appear while the player stays in one place (a carried item, a revealed
  // object, an arrival) slide in; a new location shows its lists at once.
  // `keys` is what was listed on arriving; anything else here is new (the class
  // stays put, so later re-renders never cut the animation short).
  const shown = useRef<{ location: string; keys: Set<string> }>({ location: '', keys: new Set() });
  const arrive = (key: string) =>
    shown.current.location === locationId && !shown.current.keys.has(key) ? 'lb-arrive' : '';
  const keys = view
    ? [
        ...view.inventory.map(i => `i:${i.id}`),
        ...view.persons.map(n => `n:${n.id}`),
        ...view.objects.flatMap(o => [`o:${o.id}`, `c:${o.id}`]),
        ...view.exits.map(e => `e:${e.id}`),
      ]
    : [];
  useEffect(() => {
    if (shown.current.location !== locationId) shown.current = { location: locationId, keys: new Set(keys) };
  });

  // A list entry is a button: a click puts its command in the input (it does
  // not send it), and closes the drawer on narrow screens.
  // A render helper, not a component, so re-renders never remount the rows.
  const renderItem = (item: Row, arriveKey: string, hollow = false, note?: string) => (
    <li key={arriveKey} className={arrive(arriveKey)}>
      <button
        type="button"
        onClick={() => { onPrefill(item.command); onClose(); }}
        title={`Puts “${item.command}” in the command line`}
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

  const WeatherIcon = view ? weatherIcon(view.weather) : Cloudy;

  // Objects whose `inside` container is itself listed nest under it.
  const objectIds = new Set(view?.objects.map(o => o.id));
  const topObjects = view?.objects.filter(o => !o.inside || !objectIds.has(o.inside)) ?? [];
  const nestedIn = (id: string) => view?.objects.filter(o => o.inside === id) ?? [];

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
      <div key={locationId} className="flex flex-col gap-8 px-5 pb-6 pt-[calc(24px+env(safe-area-inset-top,0px))] desk:p-8 animate-in fade-in duration-300">

        {/* Current location */}
        <section className="flex flex-col gap-3">
          <SectionHead icon={MapPin}>Current Location</SectionHead>
          {view ? (
            <>
              <h2 className="m-0 font-serif font-bold text-2xl leading-[1.2] text-balance">
                {view.location.name}
              </h2>
              <p className="m-0 italic tabular-nums text-lb-primary/75">{formatClock(view.clock)} — {view.act.dateLabel}</p>
              <p className="m-0 flex items-center gap-2 text-sm text-lb-primary/75">
                <WeatherIcon size={16} className="text-lb-accent shrink-0" />
                <span>{view.weather.name}</span>
              </p>
            </>
          ) : (
            <Empty>No investigation open.</Empty>
          )}
        </section>

        {view && (
          <>
            {/* Carried */}
            <section className="flex flex-col gap-3">
              <SectionHead icon={Briefcase}>Carried</SectionHead>
              {view.inventory.length > 0 ? (
                <ul className="m-0 p-0 list-none flex flex-col gap-1">
                  {view.inventory.map(i => renderItem({ label: i.name, command: `examine ${i.name}` }, `i:${i.id}`))}
                </ul>
              ) : (
                <Empty>Nothing carried.</Empty>
              )}
            </section>

            {/* Present */}
            <section className="flex flex-col gap-3">
              <SectionHead icon={Users}>Present in Location</SectionHead>
              {view.persons.length > 0 ? (
                <ul className="m-0 p-0 list-none flex flex-col gap-1">
                  {view.persons.map(p => renderItem({ label: p.name, command: `talk to ${p.name}` }, `n:${p.id}`))}
                </ul>
              ) : (
                <Empty>No one else is here.</Empty>
              )}
            </section>

            {/* Objects of interest — open containers list their contents beneath them. */}
            <section className="flex flex-col gap-3">
              <SectionHead icon={Eye}>Objects of Interest</SectionHead>
              {topObjects.length > 0 ? (
                <ul className="m-0 p-0 list-none flex flex-col gap-1">
                  {topObjects.map(obj => {
                    const children = nestedIn(obj.id);
                    return (
                      <React.Fragment key={obj.id}>
                        {renderItem({ label: obj.name, command: `examine ${obj.name}` }, `o:${obj.id}`, false, obj.closed ? 'closed' : undefined)}
                        {children.length > 0 && (
                          <li>
                            <ul className="m-0 pl-5 p-0 list-none flex flex-col gap-1">
                              {children.map(c => renderItem({ label: c.name, command: `examine ${c.name}` }, `c:${c.id}`, true, c.closed ? 'closed' : undefined))}
                            </ul>
                          </li>
                        )}
                      </React.Fragment>
                    );
                  })}
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
                  {view.exits.map(e => renderItem({ label: e.to, command: `go ${e.name}` }, `e:${e.id}`))}
                </ul>
              ) : (
                <Empty>No way on from here.</Empty>
              )}
            </section>
          </>
        )}

      </div>
    </aside>
  );
};
