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
  SUSPECT_PROFILES: SuspectProfile[];
  /** Optional story-specific guards. Omitted in self-tests that don't exercise them. */
  guards?: {
    /** Surname/token that must never leak into a non-killer NPC's publicKnowledge. */
    spoilerTokens?: string[];
    /** The killer NPC id, exempt from the spoiler check (may know their own name). */
    killerNpcId?: string;
    /** Intentional misspellings that must remain verbatim in the given clue's description. */
    protectedSpellings?: Array<{ clueId: string; text: string }>;
  };
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

  const locationIds = new Set(Object.keys(story.LOCATIONS));

  // Rule: clue locationFound points at a real location.
  for (const [clueId, clue] of Object.entries(story.CLUE_DEFINITIONS)) {
    if (!locationIds.has(clue.locationFound)) {
      issues.push({ severity: 'error', rule: 'clue-location',
        message: `Clue "${clueId}" locationFound "${clue.locationFound}" is not a known location` });
    }
  }

  // Rule: every CLUE_TRIGGERS entry references a real location, a real interactable there, and real clue ids.
  for (const [locId, objects] of Object.entries(story.CLUE_TRIGGERS)) {
    const loc = story.LOCATIONS[locId];
    if (!loc) {
      issues.push({ severity: 'error', rule: 'trigger-location',
        message: `CLUE_TRIGGERS references unknown location "${locId}"` });
      continue;
    }
    const interactables = new Set(loc.interactables);
    for (const [objId, triggered] of Object.entries(objects)) {
      if (!interactables.has(objId)) {
        issues.push({ severity: 'error', rule: 'trigger-object',
          message: `CLUE_TRIGGERS["${locId}"]["${objId}"] is not an interactable at "${locId}"` });
      }
      for (const cid of triggered) {
        if (!clueIds.has(cid)) {
          issues.push({ severity: 'error', rule: 'trigger-clue',
            message: `CLUE_TRIGGERS["${locId}"]["${objId}"] grants unknown clue "${cid}"` });
        }
      }
    }
  }

  // Rule: every location exit points at a real location.
  for (const [locId, loc] of Object.entries(story.LOCATIONS)) {
    for (const exit of loc.exits) {
      if (!locationIds.has(exit)) {
        issues.push({ severity: 'error', rule: 'location-exit',
          message: `Location "${locId}" has exit to unknown location "${exit}"` });
      }
    }
  }

  // Rule: NPC canonical locations and scriptedLines locations are real.
  for (const [npcId, npc] of Object.entries(story.NPCS)) {
    for (const [act, locId] of Object.entries(npc.canonicalLocationByAct)) {
      if (!locationIds.has(locId)) {
        issues.push({ severity: 'error', rule: 'npc-location',
          message: `NPC "${npcId}" canonicalLocationByAct[${act}] "${locId}" is not a known location` });
      }
    }
    for (const line of npc.scriptedLines ?? []) {
      if (!locationIds.has(line.locationId)) {
        issues.push({ severity: 'error', rule: 'npc-scripted-location',
          message: `NPC "${npcId}" scriptedLine locationId "${line.locationId}" is not a known location` });
      }
    }
  }

  // Rule: every ACT_ANCHORS target is a real location.
  for (const [act, locId] of Object.entries(story.ACT_ANCHORS)) {
    if (!locationIds.has(locId)) {
      issues.push({ severity: 'error', rule: 'act-anchor',
        message: `ACT_ANCHORS[${act}] "${locId}" is not a known location` });
    }
  }

  // Rule: spoiler tokens must not appear in any non-killer NPC's publicKnowledge.
  const spoilerTokens = story.guards?.spoilerTokens ?? [];
  for (const [npcId, npc] of Object.entries(story.NPCS)) {
    if (npcId === story.guards?.killerNpcId) continue;
    for (const fact of npc.publicKnowledge) {
      for (const token of spoilerTokens) {
        if (fact.toLowerCase().includes(token.toLowerCase())) {
          issues.push({ severity: 'error', rule: 'spoiler-leak',
            message: `NPC "${npcId}" publicKnowledge leaks spoiler token "${token}": "${fact.slice(0, 60)}"` });
        }
      }
    }
  }

  // Rule: intentional misspellings must remain verbatim (guards the smoking gun).
  for (const guard of story.guards?.protectedSpellings ?? []) {
    const clue = story.CLUE_DEFINITIONS[guard.clueId];
    if (!clue) {
      issues.push({ severity: 'error', rule: 'protected-spelling',
        message: `protectedSpellings references unknown clue "${guard.clueId}"` });
      continue;
    }
    if (!clue.description.includes(guard.text)) {
      issues.push({ severity: 'error', rule: 'protected-spelling',
        message: `Clue "${guard.clueId}" no longer contains protected text "${guard.text}" — the smoking gun may be broken` });
    }
  }

  // Rule: the guilty suspect must be a real NPC (the ending requires meeting them).
  // Theory-only red herrings (e.g. "the vanishing gentleman") may lack an NPC —
  // the engine falls back to the raw id for display — so those only warn.
  const npcIds = new Set(Object.keys(story.NPCS));
  for (const profile of story.SUSPECT_PROFILES) {
    if (!npcIds.has(profile.npcId)) {
      issues.push({
        severity: profile.isGuilty ? 'error' : 'warn',
        rule: 'suspect-npc',
        message: `SUSPECT_PROFILES entry npcId "${profile.npcId}" is not a known NPC${profile.isGuilty ? '' : ' (theory-only suspect — verify this is intentional)'}`,
      });
    }
  }

  return issues;
}
