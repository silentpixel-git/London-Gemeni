/**
 * engine/time.ts
 *
 * Pure clock math for London Bleeds: TimePeriod boundaries, day-wrap
 * arithmetic, and the in-game time label. Extracted verbatim from
 * GameEngine.ts (backlog #8 god-file split). No game state, no story data —
 * only minutes in, periods/labels out.
 */

import { TimePeriod } from '../types';
import type { ActTimeConfig } from './stories/types';

export function computeTimePeriod(totalMinutes: number): TimePeriod {
  const m = totalMinutes % 1440;
  if (m >= 300  && m < 420)  return 'dawn';
  if (m >= 420  && m < 720)  return 'morning';
  if (m >= 720  && m < 1020) return 'afternoon';
  if (m >= 1020 && m < 1200) return 'evening';
  if (m >= 1200 && m < 1380) return 'night';
  return 'lateNight'; // 1380–1439 and 0–299
}

// Chronological day order of the six periods — shared by WAIT boundary math,
// "next open period" computations, and schedule iteration.
export const PERIOD_ORDER: TimePeriod[] = ['dawn', 'morning', 'afternoon', 'evening', 'night', 'lateNight'];

/**
 * Minutes from a clock value to the NEXT TimePeriod boundary. A turn starting
 * exactly on a boundary advances to the one after — never 0. lateNight wraps
 * past midnight to dawn (05:00).
 */
export function minutesToNextPeriodBoundary(totalMinutes: number): number {
  const BOUNDARIES = [300, 420, 720, 1020, 1200, 1380]; // computeTimePeriod's edges
  const m = totalMinutes % 1440;
  for (const b of BOUNDARIES) if (b > m) return b - m;
  return (1440 - m) + 300; // past 23:00 → dawn next day
}

/**
 * How many TimePeriod boundaries lie strictly after `fromMinutes`, up to and
 * including `toMinutes`. Day-wrap aware (minutes may exceed 1440). 0 when the
 * span is empty or negative.
 */
export function periodBoundariesCrossed(fromMinutes: number, toMinutes: number): number {
  const BOUNDARIES = [300, 420, 720, 1020, 1200, 1380];
  if (toMinutes <= fromMinutes) return 0;
  const span = toMinutes - fromMinutes;
  let count = Math.floor(span / 1440) * BOUNDARIES.length;
  const fromM = fromMinutes % 1440;
  const toM = fromM + (span % 1440);
  for (const b of BOUNDARIES) {
    if (b > fromM && b <= toM) count++;
    if (b + 1440 > fromM && b + 1440 <= toM) count++;
  }
  return count;
}

/** First open period at or after `from` (exclusive of `from`, wrapping the day). */
export function nextOpenPeriod(openPeriods: TimePeriod[], from: TimePeriod): TimePeriod | null {
  const start = PERIOD_ORDER.indexOf(from);
  for (let i = 1; i <= PERIOD_ORDER.length; i++) {
    const p = PERIOD_ORDER[(start + i) % PERIOD_ORDER.length];
    if (openPeriods.includes(p)) return p;
  }
  return null;
}

/** The TimePeriod at a given act + minutes elapsed since its canonical start. */
export function timePeriodFor(
  actTimeConfig: Record<number, ActTimeConfig>,
  act: number,
  elapsedMinutes: number,
): TimePeriod {
  const cfg = actTimeConfig[act] ?? actTimeConfig[1];
  return computeTimePeriod(cfg.canonicalMinutes + elapsedMinutes);
}

export function formatTimeLabel(totalMinutes: number, dayOfWeek: string, displayDate: string): string {
  const m    = totalMinutes % 1440;
  const h24  = Math.floor(m / 60);
  const mins = m % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12  = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mins.toString().padStart(2, '0')} ${ampm} — ${dayOfWeek}, ${displayDate}`;
}
