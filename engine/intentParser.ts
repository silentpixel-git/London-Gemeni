/**
 * engine/intentParser.ts
 *
 * Parses free-form player text into a structured ParsedIntent.
 * The engine uses this to determine what the player is trying to do
 * without relying on the AI to interpret commands.
 *
 * Supports: move, examine, talk, take, use, inventory, deduce, other
 */

import { LOCATIONS, NPCS, OBJECT_DISPLAY_NAMES, DEDUCTION_KEYWORDS } from './gameData';
import type { IntentType } from '../types';
export type { IntentType };

export interface ParsedIntent {
  type: IntentType;
  targetId?: string;         // Resolved ID: location ID, NPC ID, or object ID
  targetRaw?: string;        // What the player typed as the target
  deductionText?: string;    // For 'deduce' type: the player's theory text
  showTargetNpcId?: string;  // For 'show' type: the NPC to show the item to
  useWithTargetId?: string;  // For 'use' type: the second item/object in "USE X WITH Y"
  raw: string;               // Original input
}

// Movement trigger words
const MOVE_VERBS = [
  'go', 'goto', 'go to', 'head to', 'head towards', 'walk to', 'walk towards',
  'enter', 'leave', 'exit', 'proceed to', 'travel to', 'move to',
  'visit', 'step into', 'step outside', 'run to', 'hurry to',
];

// Examine trigger words (read is now a distinct verb with its own handler)
const EXAMINE_VERBS = [
  'examine', 'look at', 'look', 'inspect', 'study', 'observe', 'check',
  'search', 'review', 'view', 'scrutinise', 'scrutinize',
  'investigate', 'analyse', 'analyze', 'survey', 'peruse', 'open', 'smell',
];

// Talk trigger words
const TALK_VERBS = [
  'talk to', 'talk with', 'speak to', 'speak with', 'ask', 'question',
  'interview', 'converse with', 'address', 'approach', 'consult',
  'interrogate', 'chat with', 'enquire', 'inquire',
];

// Take/pickup trigger words
const TAKE_VERBS = [
  'take', 'pick up', 'grab', 'collect', 'retrieve', 'pocket',
  'acquire', 'get', 'obtain',
];

// Use/interact trigger words
const USE_VERBS = [
  'use', 'interact with', 'activate', 'operate', 'apply',
];

// Show item to NPC (Infocom: SHOW X TO Y)
const SHOW_VERBS = [
  'show', 'present', 'give', 'hand', 'display', 'reveal',
];

// Read a document (distinct from examine — reads the literal text)
const READ_VERBS = [
  'read',
];

// Drop / leave an item
const DROP_VERBS = [
  'drop', 'leave', 'put down', 'discard', 'place',
];

// Inventory trigger words
const INVENTORY_VERBS = [
  'inventory', 'what am i carrying', "what's in my bag", 'my items',
  'check bag', 'medical bag', 'what do i have', 'show inventory',
  'check inventory',
];

// Help trigger words
const HELP_VERBS = [
  'help', '?', 'commands', 'what can i do', 'how do i', 'how to',
  'show commands', 'list commands', 'options', 'what can watson do',
];

// Notebook trigger words — review discovered clues and investigation progress
const NOTEBOOK_VERBS = [
  'notebook', 'notes', 'clues', 'evidence', 'what have i found',
  'what do i know', 'review clues', 'review evidence', 'list clues',
  'show clues', 'show evidence', 'my clues', 'case notes',
  'show notes', 'case progress', 'what clues',
];

/**
 * Normalise a string: lowercase, collapse spaces, remove punctuation.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[.,!?'"]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Try to match a raw target string to a known location ID.
 * Uses name, shortName, and partial matching.
 */
function matchLocationId(raw: string): string | undefined {
  const norm = normalise(raw);
  for (const [id, loc] of Object.entries(LOCATIONS)) {
    if (
      normalise(loc.name).includes(norm) ||
      norm.includes(normalise(loc.name)) ||
      (loc.shortName && normalise(loc.shortName).includes(norm)) ||
      (loc.shortName && norm.includes(normalise(loc.shortName))) ||
      norm.includes(id.replace(/_/g, ' '))
    ) {
      return id;
    }
  }
  // Common aliases
  const aliases: Record<string, string> = {
    "miller's court": 'millers_court',
    "millers court": 'millers_court',
    "room 13": 'millers_court',
    "the room": 'millers_court',
    "buck's row": 'bucks_row',
    "bucks row": 'bucks_row',
    "hanbury": 'hanbury_street',
    "dutfield": 'dutfields_yard',
    "dutfield's": 'dutfields_yard',
    "working men": 'working_mens_club',
    "the club": 'working_mens_club',
    "mitre": 'mitre_square',
    "goulston": 'goulston_street',
    "lusk": 'lusk_office',
    "lusk's office": 'lusk_office',
    "bond": 'bond_office',
    "bond's office": 'bond_office',
    "asylum": 'private_asylum',
    "baker street": 'baker_street',
    "baker": 'baker_street',
    "221b": 'baker_street',
    "home": 'baker_street',
    "outside": 'dorset_street',
    "the street": 'dorset_street',
    "whitechapel": 'dorset_street',
  };
  for (const [alias, id] of Object.entries(aliases)) {
    if (norm.includes(alias)) return id;
  }
  return undefined;
}

/**
 * Try to match a raw target string to a known NPC ID.
 */
function matchNpcId(raw: string): string | undefined {
  const norm = normalise(raw);
  for (const [id, npc] of Object.entries(NPCS)) {
    if (
      norm.includes(normalise(npc.displayName)) ||
      normalise(npc.displayName).includes(norm) ||
      norm.includes(id.replace(/_/g, ' '))
    ) {
      return id;
    }
  }
  // Common NPC aliases
  const npcAliases: Record<string, string> = {
    'inspector': 'abberline',
    'detective': 'abberline',
    'dr bond': 'bond',
    'doctor bond': 'bond',
    'dr. bond': 'bond',
    'the doctor': 'bond',
    'halward': 'edmund',
    'mr halward': 'edmund',
    'the assistant': 'edmund',
    'the young man': 'edmund',
    'mr lusk': 'lusk',
    'louis': 'diemschutz',
    'the steward': 'diemschutz',
    'the superintendent': 'superintendent',
    'the warden': 'superintendent',
    // Reweave suspects
    'the american': 'tumblety',
    'american doctor': 'tumblety',
    'the quack': 'tumblety',
    'the mad doctor': 'tumblety',
    'leather apron': 'pizer',
    'the bootmaker': 'pizer',
    'the witness': 'hutchinson',
    'dr phillips': 'phillips',
    'doctor phillips': 'phillips',
  };
  for (const [alias, id] of Object.entries(npcAliases)) {
    if (norm.includes(alias)) return id;
  }
  return undefined;
}

/**
 * Try to match a raw target string to a known object ID.
 */
function matchObjectId(raw: string): string | undefined {
  const norm = normalise(raw);
  for (const [id, displayName] of Object.entries(OBJECT_DISPLAY_NAMES)) {
    if (
      normalise(displayName).includes(norm) ||
      norm.includes(normalise(displayName)) ||
      norm.includes(id.replace(/_/g, ' '))
    ) {
      return id;
    }
  }

  // Partial word subset matching: "case wall" → "Case Files Wall"
  // All input words must appear in the display name's words; require ≥2 matches
  // or a unique candidate to keep false positives low.
  const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'in', 'at', 'on', 'to']);
  const inputWords = norm.split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  if (inputWords.length >= 1) {
    const candidates: string[] = [];
    for (const [id, displayName] of Object.entries(OBJECT_DISPLAY_NAMES)) {
      const dnWords = normalise(displayName).split(/\s+/);
      const matchCount = inputWords.filter(w => dnWords.includes(w)).length;
      if (matchCount >= 2 || (matchCount >= 1 && matchCount === inputWords.length)) {
        candidates.push(id);
      }
    }
    if (candidates.length === 1) return candidates[0];
  }

  // Common object aliases
  const objectAliases: Record<string, string> = {
    'letter': 'from_hell_letter',
    'the letter': 'from_hell_letter',
    'kidney': 'kidney_parcel',
    'the kidney': 'kidney_parcel',
    'parcel': 'kidney_parcel',
    'the parcel': 'kidney_parcel',
    'fireplace': 'burned_clothing',
    'grate': 'burned_clothing',
    'ashes': 'burned_clothing',
    'bed': 'the_bed',
    'sheets': 'bloodstained_sheets',
    'instruments': 'examination_instruments',
    'cobblestones': 'cobblestone_roadway',
    'street': 'cobblestone_roadway',
    'ground': 'ground_where_body_was_discovered',
    'body site': 'ground_where_body_was_discovered',
    'fence': 'wooden_fence',
    'gate': 'yard_entrance_gate',
    'graffiti': 'graffiti_wall',
    'writing': 'graffiti_wall',
    'chalk': 'graffiti_wall',
    'apron': 'apron_fragment_location',
    'box': 'parcel_box',
    'reports': 'medical_reports',
    'forensic reports': 'medical_reports',
    'clipping': 'newspaper_pile',
    'newspaper clipping': 'newspaper_pile',
    'dear boss': 'newspaper_pile',
    'notes': 'edmund_forensic_note',
    "edmund's note": 'edmund_forensic_note',
    "halward's note": 'edmund_forensic_note',
    'textbook': 'anatomical_texts',
    'anatomy': 'anatomical_texts',
    'jars': 'specimen_jars',
    'specimens': 'specimen_jars',
    'records': 'patient_records',
    'diary': 'watson_diary',
    'violin': 'holmes_violin',
    'alley': 'alleyways',
    'escape routes': 'alleyways',
    'lantern': 'police_lanterns',
    'walls': 'square_walls',
    'furnishings': 'edmund_room_furnishings',
    "edmund's room": 'edmund_room_furnishings',
    'members': 'club_members',
    'people': 'club_members',
    'crowd': 'crowd',
    'bystanders': 'crowd',
    'barricade': 'police_barricade',
    'lamp': 'street_lamps',
    'lamps': 'street_lamps',
    'lodgings': 'lodging_house_entrances',
    'lodging houses': 'lodging_house_entrances',
    'warehouse': 'warehouse_doors',
    'doorway': 'club_doorway',
    'posters': 'posters',
  };
  for (const [alias, id] of Object.entries(objectAliases)) {
    if (norm.includes(alias)) return id;
  }
  return undefined;
}

/**
 * Strip a leading verb pattern from the input and return the remainder.
 * E.g. "examine the burned clothing" → "burned clothing"
 *      "go to miller's court" → "miller's court"
 */
function stripVerb(input: string, verbs: string[]): string {
  const norm = normalise(input);
  // Sort by length descending so longer multi-word verbs match first
  const sorted = [...verbs].sort((a, b) => b.length - a.length);
  for (const verb of sorted) {
    if (norm.startsWith(verb + ' ')) {
      return input.slice(verb.length).replace(/^\s*(the\s+|a\s+|an\s+)/i, '').trim();
    }
    if (norm === verb) return '';
  }
  return input;
}

/**
 * Parse the player's raw input into a structured intent.
 */
export function parseIntent(rawInput: string): ParsedIntent {
  const norm = normalise(rawInput);

  // 1. Help check
  for (const verb of HELP_VERBS) {
    if (norm === verb || norm.startsWith(verb + ' ')) {
      return { type: 'help', raw: rawInput };
    }
  }

  // 2. Inventory check (whole-phrase match first)
  for (const verb of INVENTORY_VERBS) {
    if (norm.includes(verb)) {
      return { type: 'inventory', raw: rawInput };
    }
  }

  // 2b. Deduction attempt — checked before the notebook review so that a
  // theory phrased with words like "evidence"/"clues" (e.g. "I believe the
  // evidence points to Edmund") is treated as a deduction, not a notebook open.
  for (const keyword of DEDUCTION_KEYWORDS) {
    if (norm.includes(keyword)) {
      return {
        type: 'deduce',
        deductionText: rawInput,
        raw: rawInput,
      };
    }
  }

  // 3. Notebook / clue review check
  for (const verb of NOTEBOOK_VERBS) {
    if (norm === verb || norm.startsWith(verb + ' ') || norm.includes(verb)) {
      return { type: 'notebook', raw: rawInput };
    }
  }

  // 3. Movement
  for (const verb of MOVE_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const targetRaw = stripVerb(rawInput, MOVE_VERBS);
      const targetId = matchLocationId(targetRaw);
      return {
        type: 'move',
        targetId,
        targetRaw: targetRaw || rawInput,
        raw: rawInput,
      };
    }
  }

  // 4. Talk
  for (const verb of TALK_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const targetRaw = stripVerb(rawInput, TALK_VERBS);
      const targetId = matchNpcId(targetRaw) || matchObjectId(targetRaw);
      return {
        type: 'talk',
        targetId,
        targetRaw,
        raw: rawInput,
      };
    }
  }

  // 5. Take
  for (const verb of TAKE_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const targetRaw = stripVerb(rawInput, TAKE_VERBS);
      const targetId = matchObjectId(targetRaw);
      return {
        type: 'take',
        targetId,
        targetRaw,
        raw: rawInput,
      };
    }
  }

  // 6. Show item to NPC — "show letter to abberline" / "give note to holmes"
  // Pattern: SHOW <item> TO <npc>
  for (const verb of SHOW_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const afterVerb = stripVerb(rawInput, SHOW_VERBS);
      // Split on " to " to separate item from NPC
      const toIdx = afterVerb.toLowerCase().search(/\bto\b/);
      if (toIdx !== -1) {
        const itemRaw = afterVerb.slice(0, toIdx).trim();
        const npcRaw  = afterVerb.slice(toIdx + 2).trim();
        const targetId = matchObjectId(itemRaw);
        const showTargetNpcId = matchNpcId(npcRaw);
        return {
          type: 'show',
          targetId,
          targetRaw: itemRaw,
          showTargetNpcId,
          raw: rawInput,
        };
      }
      // No "to" — treat as show <item> with no specific target
      const targetId = matchObjectId(afterVerb) || matchNpcId(afterVerb);
      return { type: 'show', targetId, targetRaw: afterVerb, raw: rawInput };
    }
  }

  // 6b. Read <document> — distinct from examine: reads literal text
  for (const verb of READ_VERBS) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const targetRaw = stripVerb(rawInput, READ_VERBS);
      const targetId = targetRaw ? matchObjectId(targetRaw) : undefined;
      return { type: 'read', targetId, targetRaw, raw: rawInput };
    }
  }

  // 6c. Drop <item>
  for (const verb of DROP_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const targetRaw = stripVerb(rawInput, DROP_VERBS);
      const targetId = matchObjectId(targetRaw);
      return { type: 'drop', targetId, targetRaw, raw: rawInput };
    }
  }

  // 6d. Use / interact — also handles "USE X WITH Y" / "USE X ON Y"
  for (const verb of USE_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const afterVerb = stripVerb(rawInput, USE_VERBS);
      // Check for "X with Y" or "X on Y"
      const withIdx = afterVerb.toLowerCase().search(/\b(with|on)\b/);
      if (withIdx !== -1) {
        const itemRaw  = afterVerb.slice(0, withIdx).trim();
        const item2Raw = afterVerb.slice(withIdx).replace(/^(with|on)\s+/i, '').trim();
        const targetId = matchObjectId(itemRaw) || matchNpcId(itemRaw);
        const useWithTargetId = matchObjectId(item2Raw) || matchNpcId(item2Raw);
        return {
          type: 'use',
          targetId,
          targetRaw: itemRaw,
          useWithTargetId,
          raw: rawInput,
        };
      }
      const targetId = matchObjectId(afterVerb) || matchNpcId(afterVerb);
      return { type: 'use', targetId, targetRaw: afterVerb, raw: rawInput };
    }
  }

  // 7. Examine (check last, broad)
  for (const verb of EXAMINE_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const targetRaw = stripVerb(rawInput, EXAMINE_VERBS);
      // Only attempt to match a target if the verb had something after it.
      // A bare "look" / "examine" / "survey" with no target is a look-around (targetId = undefined),
      // which triggers full narration mode. An empty string passed to the matchers
      // would incorrectly match everything via String.includes('').
      const targetId = targetRaw
        ? matchObjectId(targetRaw) || matchNpcId(targetRaw) || matchLocationId(targetRaw)
        : undefined;
      // Examine verb + unresolvable target → Watson should name what he missed
      if (targetRaw && !targetId) {
        return { type: 'unresolved_target', targetRaw, raw: rawInput };
      }
      // Examine verb + location target (e.g. "describe dorset street") → world query;
      // locations are not interactable objects and can't be examined by the engine
      if (targetId && LOCATIONS[targetId] && !OBJECT_DISPLAY_NAMES[targetId]) {
        return { type: 'query', targetRaw, raw: rawInput };
      }
      return {
        type: 'examine',
        targetId,
        targetRaw,
        raw: rawInput,
      };
    }
  }

  // 8. Natural-language question — must come before implicit matching so that
  //    inputs like "what is dorset street" are not swallowed by the location matcher.
  //    Bare entity names ("dorset street", "holmes") still reach implicit matching below.
  const QUESTION_PREFIXES = /^(what|how|why|where|when|which|who|does|is|are|can|tell me|describe)/;
  if (QUESTION_PREFIXES.test(norm)) {
    return { type: 'query', targetRaw: rawInput, raw: rawInput };
  }

  // 9. Implicit movement: if the whole input matches a location name
  const directLocationMatch = matchLocationId(rawInput);
  if (directLocationMatch) {
    return {
      type: 'move',
      targetId: directLocationMatch,
      targetRaw: rawInput,
      raw: rawInput,
    };
  }

  // 10. Implicit examine: if the whole input matches an object or NPC
  const directObjectMatch = matchObjectId(rawInput);
  if (directObjectMatch) {
    return {
      type: 'examine',
      targetId: directObjectMatch,
      targetRaw: rawInput,
      raw: rawInput,
    };
  }

  const directNpcMatch = matchNpcId(rawInput);
  if (directNpcMatch) {
    return {
      type: 'talk',
      targetId: directNpcMatch,
      targetRaw: rawInput,
      raw: rawInput,
    };
  }

  // 11. Fallback
  return {
    type: 'other',
    raw: rawInput,
  };
}
