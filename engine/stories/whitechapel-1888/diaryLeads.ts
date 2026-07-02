/**
 * diaryLeads.ts — identifies ACT_PROGRESSION gate flags that fire with no
 * existing diary coverage (no clue trigger, no DECISION_DIARY entry), and
 * supplies the neutral hint-objective context used to ground their
 * AI-generated diary text. Pure, no I/O — testable without a running game.
 */
import type { HintVerb } from '../../../types';
import type { ClueDefinition } from '../types';
import { ACT_PROGRESSION } from './acts';
import { CLUE_DEFINITIONS } from './clues';
import { DECISION_BY_FLAG } from './diaryDecisions';
import { OBJECTIVES } from './hints';

/** True when `flag` is one of the real (non-sentinel) gate flags for `actNumber`. */
export function isRequiredFlag(actNumber: number, flag: string): boolean {
  const gate = ACT_PROGRESSION[actNumber];
  if (!gate) return false;
  return gate.requireFlags.includes(flag) && !flag.startsWith('__');
}

/** The gate flag a clue's triggering examine action sets, by naming convention. */
export function clueGateFlag(def: ClueDefinition): string {
  return `examined_${def.locationFound}_${def.triggerObject}`;
}

export interface LeadContext {
  verb: HintVerb;
  subject: string;
}

/** Neutral, spoiler-safe verb+subject for a gate flag, reused from the hint objective table. */
export function leadContextFor(actNumber: number, flag: string): LeadContext | null {
  const objective = OBJECTIVES.find(o => o.act === actNumber && o.flag === flag);
  return objective ? { verb: objective.verb, subject: objective.subject } : null;
}

/**
 * Flags that just became true this turn, gate progression for `actNumber`, and
 * have no existing diary-producing path (clue trigger or DECISION_DIARY entry).
 * These are the candidates for AI-generated lead entries.
 */
export function detectSilentLeadFlags(params: {
  actNumber: number;
  flagsUpdate: Record<string, boolean>;
  priorFlags: Record<string, boolean>;
  discoveredClueIds: string[];
}): string[] {
  const { actNumber, flagsUpdate, priorFlags, discoveredClueIds } = params;

  const clueCoveredFlags = new Set(
    discoveredClueIds
      .map(id => CLUE_DEFINITIONS[id])
      .filter((d): d is ClueDefinition => Boolean(d))
      .map(clueGateFlag),
  );

  return Object.entries(flagsUpdate)
    .filter(([f, value]) =>
      value === true
      && !priorFlags[f]
      && isRequiredFlag(actNumber, f)
      && !DECISION_BY_FLAG[f]
      && !clueCoveredFlags.has(f),
    )
    .map(([f]) => f);
}
