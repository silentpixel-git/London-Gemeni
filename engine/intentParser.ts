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

export type IntentType = 'move' | 'examine' | 'talk' | 'take' | 'use' | 'inventory' | 'deduce' | 'help' | 'other';

export interface ParsedIntent {
  type: IntentType;
  targetId?: string;       // Resolved ID: location ID, NPC ID, or object ID
  targetRaw?: string;      // What the player typed as the target
  deductionText?: string;  // For 'deduce' type: the player's theory text
  raw: string;             // Original input
}

// Movement trigger words
const MOVE_VERBS = [
  'go', 'goto', 'go to', 'head to', 'head towards', 'walk to', 'walk towards',
  'enter', 'leave', 'exit', 'proceed to', 'travel to', 'move to',
  'visit', 'step into', 'step outside', 'run to', 'hurry to',
];

// Examine trigger words
const EXAMINE_VERBS = [
  'examine', 'look at', 'look', 'inspect', 'study', 'observe', 'check',
  'search', 'review', 'read', 'view', 'scrutinise', 'scrutinize',
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
  'use', 'interact with', 'activate', 'operate', 'show', 'give',
  'apply', 'present',
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

  // 3. Deduction attempt
  for (const keyword of DEDUCTION_KEYWORDS) {
    if (norm.includes(keyword)) {
      return {
        type: 'deduce',
        deductionText: rawInput,
        raw: rawInput,
      };
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

  // 6. Use / interact
  for (const verb of USE_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const targetRaw = stripVerb(rawInput, USE_VERBS);
      const targetId = matchObjectId(targetRaw) || matchNpcId(targetRaw);
      return {
        type: 'use',
        targetId,
        targetRaw,
        raw: rawInput,
      };
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
      return {
        type: 'examine',
        targetId,
        targetRaw,
        raw: rawInput,
      };
    }
  }

  // 8. Implicit movement: if the whole input matches a location name
  const directLocationMatch = matchLocationId(rawInput);
  if (directLocationMatch) {
    return {
      type: 'move',
      targetId: directLocationMatch,
      targetRaw: rawInput,
      raw: rawInput,
    };
  }

  // 9. Implicit examine: if the whole input matches an object or NPC
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

  // 10. Fallback
  return {
    type: 'other',
    raw: rawInput,
  };
}
