// Display helpers for the PlayerView (packages/schema/view.ts). Presentation
// only: the view itself carries no formatted strings.

/** Absolute in-game minutes (may exceed a day) as a 12-hour clock, e.g. "10:41 PM". */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
