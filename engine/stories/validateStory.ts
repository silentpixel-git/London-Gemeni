// Pure story-data validator. No engine, Supabase, or AI imports.
// Given a story's data tables, return every structural/spoiler problem found.
import type {
  LocationDefinition,
  NPCDefinition,
  ClueDefinition,
  ActCondition,
  SuspectProfile,
} from './types';

export type Severity = 'error' | 'warn';

export interface ValidationIssue {
  severity: Severity;
  rule: string;      // short id, e.g. 'clue-connections'
  message: string;   // human-readable, names the offending id
}

export interface StoryData {
  LOCATIONS: Record<string, LocationDefinition>;
  NPCS: Record<string, NPCDefinition>;
  CLUE_DEFINITIONS: Record<string, ClueDefinition>;
  CLUE_TRIGGERS: Record<string, Record<string, string[]>>;
  ACT_ANCHORS: Record<number, string>;
  ACT_PROGRESSION: Record<number, ActCondition>;
  SUSPECT_PROFILES: Record<string, SuspectProfile>;
}

export function validateStory(story: StoryData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const clueIds = new Set(Object.keys(story.CLUE_DEFINITIONS));

  // Rule: every clue connection points at a real clue id.
  for (const [clueId, clue] of Object.entries(story.CLUE_DEFINITIONS)) {
    for (const connId of clue.connections) {
      if (!clueIds.has(connId)) {
        issues.push({
          severity: 'error',
          rule: 'clue-connections',
          message: `Clue "${clueId}" connects to unknown clue "${connId}"`,
        });
      }
    }
  }

  return issues;
}
