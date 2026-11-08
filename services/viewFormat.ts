// Display helpers for the PlayerView (packages/schema/view.ts). Presentation
// only: the view itself carries no formatted strings.
import type { PlayerView } from '../packages/schema/view.js';

/** Absolute in-game minutes (may exceed a day) as a 12-hour clock, e.g. "10:41 PM". */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * The "Try" chips: up to four things here the player has not tried yet — an
 * object not yet examined, someone not yet spoken to here, a place not yet
 * visited — in that order. Drawn only from what the sidebar lists, with the
 * sidebar's own commands, and never from Rules or progression, so a chip never
 * says which of them matters.
 */
export function suggestionsFor(view: PlayerView): string[] {
  return [
    ...view.objects.filter(o => !o.examined).map(o => `examine ${o.name}`),
    ...view.persons.filter(p => !p.spokenTo).map(p => `talk to ${p.name}`),
    ...view.exits.filter(e => !e.visited).map(e => `go ${e.name}`),
  ].slice(0, 4);
}
