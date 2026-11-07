import { PERIOD_ORDER, type TimePeriod } from '../schema';

const BOUNDARIES = [300, 420, 720, 1020, 1200, 1380];

/** The TimePeriod at an absolute clock (minutes may exceed 1439 across days). */
export function periodOf(clock: number): TimePeriod {
  const m = ((clock % 1440) + 1440) % 1440;
  if (m >= 300 && m < 420) return 'dawn';
  if (m >= 420 && m < 720) return 'morning';
  if (m >= 720 && m < 1020) return 'afternoon';
  if (m >= 1020 && m < 1200) return 'evening';
  if (m >= 1200 && m < 1380) return 'night';
  return 'lateNight';
}

/** Period boundaries strictly after `from`, up to and including `to`. */
export function boundariesCrossed(from: number, to: number): number {
  if (to <= from) return 0;
  let n = 0;
  for (let day = Math.floor(from / 1440); day <= Math.floor(to / 1440); day++) {
    for (const b of BOUNDARIES) {
      const abs = day * 1440 + b;
      if (abs > from && abs <= to) n++;
    }
  }
  return n;
}

/** Whether a clock-of-day `at` is passed when the clock moves from `from` to `to` (exclusive, inclusive). */
export function clockTimePassed(from: number, to: number, at: number): boolean {
  for (let day = Math.floor(from / 1440); day <= Math.floor(to / 1440); day++) {
    const abs = day * 1440 + at;
    if (abs > from && abs <= to) return true;
  }
  return false;
}

/** Minutes until clock-of-day `at` next occurs strictly after `from`. */
export function minutesUntil(from: number, at: number): number {
  const m = ((from % 1440) + 1440) % 1440;
  const d = at - m;
  return d > 0 ? d : d + 1440;
}

export { PERIOD_ORDER };
