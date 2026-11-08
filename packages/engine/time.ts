import type { Id, Story } from '../schema/index.js';

const DAY = 1440;
const dayMinute = (clock: number) => ((clock % DAY) + DAY) % DAY;

/** The Period id at an absolute clock (minutes may exceed 1439 across days). The last period wraps past midnight. */
export function periodOf(story: Story, clock: number): Id {
  const m = dayMinute(clock);
  let current = story.periods[story.periods.length - 1];
  for (const p of story.periods) if (p.startMinutes <= m) current = p;
  return current.id;
}

/** Period boundaries strictly after `from`, up to and including `to`. */
export function boundariesCrossed(story: Story, from: number, to: number): number {
  if (to <= from) return 0;
  let n = 0;
  for (let day = Math.floor(from / DAY); day <= Math.floor(to / DAY); day++) {
    for (const p of story.periods) {
      const abs = day * DAY + p.startMinutes;
      if (abs > from && abs <= to) n++;
    }
  }
  return n;
}

/** Whether a clock-of-day `at` is passed when the clock moves from `from` to `to` (exclusive, inclusive). */
export function clockTimePassed(from: number, to: number, at: number): boolean {
  for (let day = Math.floor(from / DAY); day <= Math.floor(to / DAY); day++) {
    const abs = day * DAY + at;
    if (abs > from && abs <= to) return true;
  }
  return false;
}

/** Minutes until clock-of-day `at` next occurs strictly after `from`. */
export function minutesUntil(from: number, at: number): number {
  const d = at - dayMinute(from);
  return d > 0 ? d : d + DAY;
}
