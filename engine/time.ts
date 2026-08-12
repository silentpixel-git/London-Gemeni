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

/**
 * The effective day of a (possibly multi-day) act, derived from flags — the
 * last authored step whose `advancedByFlag` is set, or day 0.
 *
 * Derived rather than stored: flags already persist, so a save resumes on the
 * right day with no new state and no migration. Returns an ActTimeConfig-shaped
 * object so every existing helper that takes a cfg keeps working unchanged.
 */
export function resolveActDay(
  cfg: ActTimeConfig,
  flags: Record<string, boolean>,
): ActTimeConfig & { stepIndex: number } {
  const steps = cfg.days ?? [];
  let stepIndex = -1;
  for (let i = 0; i < steps.length; i++) {
    if (flags[steps[i].advancedByFlag]) stepIndex = i;
  }
  if (stepIndex === -1) return { ...cfg, stepIndex: -1 };
  const step = steps[stepIndex];
  return {
    ...cfg,
    canonicalMinutes: step.canonicalMinutes,
    dayOfWeek: step.dayOfWeek,
    displayDate: step.displayDate,
    stepIndex,
  };
}

/** The TimePeriod at a given act + minutes elapsed since its canonical start. */
export function timePeriodFor(
  actTimeConfig: Record<number, ActTimeConfig>,
  act: number,
  elapsedMinutes: number,
  flags: Record<string, boolean> = {},
): TimePeriod {
  const cfg = resolveActDay(actTimeConfig[act] ?? actTimeConfig[1], flags);
  return computeTimePeriod(cfg.canonicalMinutes + elapsedMinutes);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Rolls dayOfWeek/displayDate forward by however many midnight boundaries
 * `totalMinutes` (canonicalMinutes + elapsed) has crossed past its first day.
 * Every act's canonicalMinutes is authored under 1440 (a clock-of-day value),
 * so Math.floor(totalMinutes / 1440) is exactly "how many extra calendar days
 * elapsed play has pushed us into."
 *
 * Deliberately separate from resolveActDay's `days` step system (engine.
 * GameEngine.ts's day-step-advance detection): that mechanism is for
 * INTENTIONAL, narratively-authored day transitions with their own transition
 * text, triggered by a flag. This covers the generic case no act currently
 * opts into — a player who simply waits, or otherwise spends enough turns,
 * to cross midnight without any authored transition to carry it. A live
 * playtest found the display frozen on the original date after several WAITs
 * narrated dawn breaking, while the room's own clock (formatGameClock, %1440)
 * correctly wrapped — this closes that gap without touching the step system.
 *
 * Composes safely with an active day-step: elapsedMinutes resets to 0 when a
 * step advances (see GameEngine.ts), so totalMinutes here already measures
 * time since whichever day is currently active, authored or not.
 *
 * Defensive: an unparseable displayDate (an author typo) returns the label
 * unchanged rather than crashing the turn on it.
 */
export function rollForwardCalendarLabel(
  totalMinutes: number,
  dayOfWeek: string,
  displayDate: string,
): { dayOfWeek: string; displayDate: string } {
  const extraDays = Math.floor(totalMinutes / 1440);
  if (extraDays <= 0) return { dayOfWeek, displayDate };
  const base = new Date(displayDate);
  if (isNaN(base.getTime())) return { dayOfWeek, displayDate };
  base.setDate(base.getDate() + extraDays);
  return {
    dayOfWeek: WEEKDAY_NAMES[base.getDay()],
    displayDate: `${base.getDate()} ${MONTH_NAMES[base.getMonth()]} ${base.getFullYear()}`,
  };
}

export function formatTimeLabel(totalMinutes: number, dayOfWeek: string, displayDate: string): string {
  const rolled = rollForwardCalendarLabel(totalMinutes, dayOfWeek, displayDate);
  const m    = totalMinutes % 1440;
  const h24  = Math.floor(m / 60);
  const mins = m % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12  = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mins.toString().padStart(2, '0')} ${ampm} — ${rolled.dayOfWeek}, ${rolled.displayDate}`;
}
