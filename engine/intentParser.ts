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
  // For 'talk' type: the subject the player asked about, verbatim, from
  // "ask bond about the mutilations". Resolved to a fact id by the TALK resolver
  // (engine/resolvers/npc.ts) rather than here — topics live in the story
  // manifest's fact graph, and the parser must stay story-agnostic about them.
  // Absent means a bare TALK: an opening exchange, which gates nothing.
  topicRaw?: string;
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
  'investigate', 'analyse', 'analyze', 'survey', 'peruse', 'smell',
];

/**
 * Phrases that modify a LOOK rather than name a target: "look around", "search
 * here", "examine the room". These must resolve to a bare look-around.
 *
 * Without this, "look around" left "around" as the target phrase, which is one
 * edit from "ground" — the fuzzy object matcher duly resolved it to
 * ground_where_body_was_discovered, so EVERY "look around" in the game told the
 * narrator that Watson had just tried and failed to examine a body discovery
 * site. The prose that came back had him searching the carpet for bloodstains
 * in a drawing room, which looked like a narration fault and was not one.
 */
// NOTE: stripVerb drops a leading article, so entries are listed bare as well
// ("room", not only "the room").
const BARE_LOOK_REMAINDERS = new Set([
  'around', 'about', 'round', 'here', 'about here', 'around here', 'round here',
  'room', 'the room', 'this room', 'around the room', 'about the room',
  'place', 'the place', 'surroundings', 'the surroundings', 'everything',
]);

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

// Open a container (distinct from examine — reveals contents rather than
// describing the outside). 'open' was previously an EXAMINE verb; it moved here
// when containers became a real mechanic.
const OPEN_VERBS = [
  'open', 'look inside', 'look in', 'unlatch', 'lift the lid of', 'lift the lid',
];

// Drop / leave an item
const DROP_VERBS = [
  'drop', 'leave', 'put down', 'discard', 'place',
];

// Wait / pass time (Phase 4a — advances the clock to the next time period)
const WAIT_VERBS = [
  'wait', 'pass the time', 'linger', 'rest a while', 'bide',
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

// Common NPC aliases — hoisted to module scope so matchNpcIdExact can also
// consult it without duplicating the list.
const NPC_ALIASES: Record<string, string> = {
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
    'labourer': 'hutchinson',
    'dr phillips': 'phillips',
    'doctor phillips': 'phillips',
    'bar maid': 'barmaid',
    'the bar maid': 'barmaid',
};

/**
 * Try to match a raw target string to a known NPC ID.
 */
// Topic prepositions for TALK: "ask bond about the mutilations", "question
// abberline regarding the graffiti". Longest-first so "on the subject of" wins
// over a bare "on". Split on the FIRST occurrence — a topic may itself contain
// "about" ("about the letter about the kidney") and the leftmost split keeps the
// subject correct, which is what the NPC match depends on.
const TOPIC_PREPOSITIONS = [
  'on the subject of', 'with regard to', 'in regard to', 'as regards',
  'regarding', 'concerning', 'about', 'anent',
];

/**
 * Splits a TALK target into who is addressed and what was asked about.
 * "holmes about the letter" → { subject: 'holmes', topicRaw: 'the letter' }
 * "about the letter"        → { subject: '',       topicRaw: 'the letter' }
 * "holmes"                  → { subject: 'holmes', topicRaw: undefined }
 */
function splitTopic(raw: string): { subject: string; topicRaw?: string } {
  const norm = normalise(raw);
  let best: { idx: number; len: number } | undefined;
  for (const prep of TOPIC_PREPOSITIONS) {
    // Word-boundary match so "aboutface" or a name containing "on" can't split.
    const m = new RegExp(`(?:^|\\s)${prep}(?:\\s|$)`).exec(norm);
    if (m) {
      const idx = m.index + (m[0].startsWith(' ') ? 1 : 0);
      if (!best || idx < best.idx) best = { idx, len: prep.length };
    }
  }
  if (!best) return { subject: raw.trim() };
  const topicRaw = norm.slice(best.idx + best.len).trim();
  return {
    subject: norm.slice(0, best.idx).trim(),
    topicRaw: topicRaw || undefined,
  };
}

/**
 * Remainders that name the addressee and nothing else — "talk to holmes again".
 * Treating these as a topic would turn an ordinary second conversation into a
 * "he has nothing to say on that", which is worse than the bare exchange.
 */
const NON_TOPIC_REMAINDERS = new Set([
  'again', 'once more', 'once again', 'some more', 'more', 'please', 'now',
  'further', 'briefly', 'a moment', 'a bit', 'for a moment',
]);

/**
 * A TALK whose subject carries more than the addressee:
 * "holmes why he finds modern crime so dull" → { holmes, "why he finds…" }.
 *
 * Players ask questions far more often than they write "about X". Without this
 * the remainder is silently dropped, the turn degrades to a bare opening
 * exchange, and no topic is ever credited — which is how an act's asked_ gates
 * become unreachable in practice even though every topic is authored correctly.
 *
 * Only the exact-name paths are sliced; fuzzy NPC matching is far too loose to
 * cut a string on. Returns undefined when nothing but the name is left, so a
 * plain "talk to holmes" stays a plain opening exchange.
 */
function splitAddresseeFromQuestion(subject: string): { id: string; topicRaw: string } | undefined {
  const norm = normalise(subject);
  const candidates: Array<{ id: string; phrase: string }> = [];
  for (const [id, npc] of Object.entries(NPCS)) {
    const displayName = normalise(npc.displayName);
    if (displayName && norm.includes(displayName)) candidates.push({ id, phrase: displayName });
    const idPhrase = id.replace(/_/g, ' ');
    if (norm.includes(idPhrase)) candidates.push({ id, phrase: idPhrase });
  }
  for (const [alias, id] of Object.entries(NPC_ALIASES)) {
    if (norm.includes(alias)) candidates.push({ id, phrase: alias });
  }
  if (candidates.length === 0) return undefined;
  // Longest phrase wins, so "mrs kemp" is cut rather than a bare "kemp".
  candidates.sort((a, b) => b.phrase.length - a.phrase.length);
  const { id, phrase } = candidates[0];
  const idx = norm.indexOf(phrase);
  const remainder = `${norm.slice(0, idx)} ${norm.slice(idx + phrase.length)}`
    .replace(/\s+/g, ' ')
    .replace(/^(?:to|with|for|about)\s+/, '')
    .trim();
  if (!remainder || NON_TOPIC_REMAINDERS.has(remainder)) return undefined;
  return { id, topicRaw: remainder };
}

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
  for (const [alias, id] of Object.entries(NPC_ALIASES)) {
    if (norm.includes(alias)) return id;
  }

  // Fuzzy last resort: typo tolerance against NPC name words, the id, and the
  // alias keys — giving NPC nouns the same forgiveness objects already get above.
  // EVERY meaningful input word must near-match a known word, and the NPC must be
  // UNIQUE — so "labrourer"→labourer/hutchinson and "abberlin"→abberline land,
  // while ambiguous near-misses resolve to nothing rather than the wrong person.
  const fuzzyWords = norm.split(/\s+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w));
  if (fuzzyWords.length >= 1) {
    const npcWords: Record<string, Set<string>> = {};
    const addWord = (id: string, w: string) => {
      if (w.length >= 4 && !STOP_WORDS.has(w)) (npcWords[id] ??= new Set()).add(w);
    };
    for (const [id, npc] of Object.entries(NPCS)) {
      for (const w of normalise(npc.displayName).split(/\s+/)) addWord(id, w);
      for (const w of id.replace(/_/g, ' ').split(/\s+/)) addWord(id, w);
    }
    for (const [alias, id] of Object.entries(NPC_ALIASES)) {
      for (const w of normalise(alias).split(/\s+/)) addWord(id, w);
    }
    const candidates: string[] = [];
    for (const [id, words] of Object.entries(npcWords)) {
      const dnWords = [...words];
      const allCovered = fuzzyWords.every(iw => {
        const maxDist = iw.length >= 6 ? 2 : 1;
        return dnWords.some(dw => editDistance(iw, dw, maxDist) <= maxDist);
      });
      if (allCovered) candidates.push(id);
    }
    if (candidates.length === 1) return candidates[0];
  }

  return undefined;
}

/**
 * Exact NPC identity match only — whole-string equality against the NPC's
 * display name, id, or a known alias, with no substring/fuzzy matching.
 * Used to give a bare NPC name ("holmes") priority over an object whose
 * display name happens to embed that name (e.g. "Holmes' Chemistry Table"
 * normalises to "holmes chemistry table", which contains "holmes").
 */
function matchNpcIdExact(raw: string): string | undefined {
  const norm = normalise(raw);
  for (const [id, npc] of Object.entries(NPCS)) {
    if (norm === normalise(npc.displayName) || norm === id.replace(/_/g, ' ')) {
      return id;
    }
  }
  return NPC_ALIASES[norm];
}

// Stop-words ignored when comparing a phrase against object names.
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'in', 'at', 'on', 'to']);

// Vocabulary of every meaningful word that appears in a known object's
// display name or id. Used to tell an unrecognised-but-object-like phrase
// ("case archives") apart from a purely atmospheric one ("the fog").
const OBJECT_VOCABULARY: Set<string> = (() => {
  const words = new Set<string>();
  for (const [id, displayName] of Object.entries(OBJECT_DISPLAY_NAMES)) {
    for (const w of normalise(displayName).split(/\s+/)) {
      if (w.length > 1 && !STOP_WORDS.has(w)) words.add(w);
    }
    for (const w of id.replace(/_/g, ' ').split(/\s+/)) {
      if (w.length > 1 && !STOP_WORDS.has(w)) words.add(w);
    }
  }
  return words;
})();

/**
 * Does this phrase appear to reach for a real object in the world?
 * True when it shares a meaningful word with some known object name —
 * i.e. the player was likely naming an object the engine couldn't resolve,
 * rather than asking about atmosphere. Drives unresolved_target vs query.
 */
export function looksLikeObjectReference(raw: string): boolean {
  return normalise(raw)
    .split(/\s+/)
    .some(w => w.length > 1 && !STOP_WORDS.has(w) && OBJECT_VOCABULARY.has(w));
}

// Common object aliases. Module-scoped (not local to matchObjectId) and
// exported so scripts/qa-validate.ts can mechanically verify every alias
// still resolves to the object it names — matchObjectId's earlier substring
// scan over OBJECT_DISPLAY_NAMES runs BEFORE this table is ever consulted, so
// a new display name whose normalised form contains an alias as a substring
// silently shadows it (bit us three times authoring Act 0: 'letter', 'box',
// 'boots'). NOTE: 'boots' → pawn_ticket is deliberately absent — Act 0 gave
// "Nell's Boots" its own object (nells_boots), so that alias can never fire
// again and was removed rather than left pointing at the wrong id.
export const objectAliases: Record<string, string> = {
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
  'ticket': 'pawn_ticket',
  'pawn ticket': 'pawn_ticket',
  'pawnbroker\'s ticket': 'pawn_ticket',
  'pledge': 'pawn_ticket',
  'case file': 'concluded_case_file',
  'concluded case': 'concluded_case_file',
  'last case': 'concluded_case_file',
  'notes': 'edmund_forensic_note',
  "edmund's note": 'edmund_forensic_note',
  "halward's note": 'edmund_forensic_note',
  'textbook': 'anatomical_texts',
  'anatomy': 'anatomical_texts',
  'jars': 'specimen_jars',
  'specimens': 'specimen_jars',
  'records': 'patient_records',
  'diary': 'watson_diary',
  // Repointed from a dangling 'holmes_violin' when Act 0 gained a real
  // violin_case object. ('watson_diary' above is likewise not an object id —
  // pre-existing, left alone.)
  'violin': 'violin_case',
  'violin case': 'violin_case',
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
  'archway': 'court_archway',
  'court entrance': 'court_archway',
  'passage': 'court_archway',
  'account': 'hutchinson_account',
  'statement': 'hutchinson_account',
  "hutchinson's account": 'hutchinson_account',
  "hutchinson's statement": 'hutchinson_account',
  'witness statement': 'hutchinson_account',
};

/**
 * Try to match a raw target string to a known object ID.
 */
export function matchObjectId(raw: string): string | undefined {
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

  // Longest alias wins — "pawnbroker's ticket" must match that alias, not the
  // shorter 'ticket'; "hutchinson's statement" not the shorter 'statement'.
  // Compare against the NORMALISED alias, not the raw dict key — normalise()
  // strips apostrophes from player input, so an un-normalised comparison can
  // never match an apostrophe-bearing alias ("edmund's note", "halward's
  // note", "edmund's room") against anything a player actually types. These
  // three were dead on arrival until this fix — verified via the "Object
  // alias reachability" qa:validate section, which now proves it.
  let bestId: string | undefined;
  let bestLen = 0;
  for (const [alias, id] of Object.entries(objectAliases)) {
    const normAlias = normalise(alias);
    if (norm.includes(normAlias) && normAlias.length > bestLen) {
      bestId = id;
      bestLen = normAlias.length;
    }
  }
  if (bestId) return bestId;

  // Fuzzy stage (last resort): typo tolerance against object display-name words,
  // giving object nouns the same forgiveness verbs already get via correctVerbTypo.
  // EVERY meaningful input word must near-match a word in the name (full coverage,
  // mirroring the subset rule) and the object must be UNIQUE — so "autopsi ledger"
  // / "newspaper pyle" land, but a stray name word like "holmes" in "spek to
  // holmes" never hijacks an object match.
  const fuzzyWords = norm.split(/\s+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w));
  if (fuzzyWords.length >= 1) {
    const fuzzyCandidates: string[] = [];
    for (const [id, displayName] of Object.entries(OBJECT_DISPLAY_NAMES)) {
      const dnWords = normalise(displayName).split(/\s+/).filter(w => w.length >= 4);
      const allCovered = fuzzyWords.every(iw => {
        const maxDist = iw.length >= 6 ? 2 : 1;
        return dnWords.some(dw => editDistance(iw, dw, maxDist) <= maxDist);
      });
      if (allCovered) fuzzyCandidates.push(id);
    }
    if (fuzzyCandidates.length === 1) return fuzzyCandidates[0];
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
 * Damerau-Levenshtein edit distance (adjacent transpositions like "shwo"→"show"
 * count as 1 edit) with early exit once the distance exceeds max.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] | null = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      curr[j] = d;
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = curr;
  }
  return prev[b.length];
}

// Single-word verbs eligible for typo correction (multi-word verbs are matched
// exactly; correcting them word-by-word isn't worth the false-positive risk).
const FUZZY_VERBS: string[] = [
  ...MOVE_VERBS, ...EXAMINE_VERBS, ...TALK_VERBS, ...TAKE_VERBS,
  ...USE_VERBS, ...SHOW_VERBS, ...READ_VERBS, ...DROP_VERBS, ...OPEN_VERBS,
].filter(v => !v.includes(' '));

/**
 * If the first word of the input is a near-miss of a known verb
 * (e.g. "exmaine"), return the input with the verb corrected. Otherwise null.
 * Only fires for words of 4+ letters that aren't already a known verb —
 * short words like "go" are too easy to false-positive on.
 */
function correctVerbTypo(rawInput: string): string | null {
  const firstWord = normalise(rawInput).split(' ')[0];
  if (firstWord.length < 4 || FUZZY_VERBS.includes(firstWord)) return null;
  const maxDist = firstWord.length >= 6 ? 2 : 1;
  let best: string | null = null;
  let bestDist = maxDist + 1;
  for (const verb of FUZZY_VERBS) {
    if (verb.length < 4) continue;
    const d = editDistance(firstWord, verb, maxDist);
    if (d < bestDist) { bestDist = d; best = verb; }
  }
  if (!best) return null;
  // Replace the first word in the original input, preserving the rest
  const rest = rawInput.trim().split(/\s+/).slice(1).join(' ');
  return rest ? `${best} ${rest}` : best;
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

  // 3b. Wait — whole-verb match ("wait", "wait here", "wait for the doctor"
  // all advance to the next period; wait-for-target is out of scope).
  for (const verb of WAIT_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm === verb || norm.startsWith(verb + ' ')) {
      return { type: 'wait', raw: rawInput };
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
      const rest = stripVerb(rawInput, TALK_VERBS);
      const { subject, topicRaw } = splitTopic(rest);
      // "ask about the graffiti" names no one — the resolver addresses the only
      // NPC present, the same courtesy SHOW already extends.
      let targetId = subject ? (matchNpcId(subject) || matchObjectId(subject)) : undefined;
      let topic = topicRaw;
      // No "about" clause, but the subject carries a question as well as the
      // addressee ("ask holmes why he finds modern crime so dull"). Recover the
      // topic rather than discarding it — see splitAddresseeFromQuestion.
      if (!topic && subject) {
        const asQuestion = splitAddresseeFromQuestion(subject);
        if (asQuestion) {
          targetId ??= asQuestion.id;
          topic = asQuestion.topicRaw;
        }
      }
      return {
        type: 'talk',
        targetId,
        targetRaw: subject || rest,
        topicRaw: topic,
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
      // No "to" — first try the dative form: "show holmes the clipping"
      // (NPC name leads, item follows). The NPC must match the LEADING words
      // only, otherwise "show the holmes letter" would misparse.
      const words = afterVerb.trim().split(/\s+/);
      for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
        const leading = words.slice(0, n).join(' ');
        const npcId = matchNpcId(leading);
        if (npcId) {
          const itemRaw = words.slice(n).join(' ').replace(/^(the|a|an)\s+/i, '');
          const itemId = matchObjectId(itemRaw);
          if (itemId) {
            return { type: 'show', targetId: itemId, targetRaw: itemRaw, showTargetNpcId: npcId, raw: rawInput };
          }
        }
      }
      // Otherwise: show <item> with no specific target
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

  // 6e. Open a container. MUST precede examine: EXAMINE_VERBS still contains
  // 'look', which would otherwise match "look inside the workbox" first.
  for (const verb of OPEN_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const targetRaw = stripVerb(rawInput, OPEN_VERBS);
      const targetId = targetRaw ? matchObjectId(targetRaw) : undefined;
      return { type: 'open', targetId, targetRaw, raw: rawInput };
    }
  }

  // 7. Examine (check last, broad)
  for (const verb of EXAMINE_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const strippedTarget = stripVerb(rawInput, EXAMINE_VERBS);
      // "look around" and friends name no target — see BARE_LOOK_REMAINDERS.
      const targetRaw = BARE_LOOK_REMAINDERS.has(normalise(strippedTarget)) ? '' : strippedTarget;
      // Only attempt to match a target if the verb had something after it.
      // A bare "look" / "examine" / "survey" with no target is a look-around (targetId = undefined),
      // which triggers full narration mode. An empty string passed to the matchers
      // would incorrectly match everything via String.includes('').
      const targetId = targetRaw
        ? matchNpcIdExact(targetRaw) || matchObjectId(targetRaw) || matchNpcId(targetRaw) || matchLocationId(targetRaw)
        : undefined;
      // Examine verb + unresolvable target. If the phrase reaches for a real
      // object ("examine the case archives"), Watson should name what he missed
      // (unresolved_target). If it's atmospheric/world ("examine the fog"),
      // fall back to a world query so Watson can answer in character.
      if (targetRaw && !targetId) {
        const type = looksLikeObjectReference(targetRaw) ? 'unresolved_target' : 'query';
        return { type, targetRaw, raw: rawInput };
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

  // 9. Typo correction: if no verb matched, try fixing a misspelled verb in
  // the first word (e.g. "exmaine the case wall", "dorp letter") and re-parse.
  // Must run BEFORE implicit entity matching, otherwise a typo'd verb followed
  // by a known item gets swallowed (e.g. "dorp letter" → implicit examine).
  const corrected = correctVerbTypo(rawInput);
  if (corrected) {
    const reparsed = parseIntent(corrected);
    if (reparsed.type !== 'other') {
      // Keep the player's original text as raw for display/AI context
      return { ...reparsed, raw: rawInput };
    }
  }

  // 10. Implicit movement: if the whole input matches a location name
  const directLocationMatch = matchLocationId(rawInput);
  if (directLocationMatch) {
    return {
      type: 'move',
      targetId: directLocationMatch,
      targetRaw: rawInput,
      raw: rawInput,
    };
  }

  // 11. Implicit talk: a bare NPC name ("holmes") takes priority over a loose
  // object-name match — an object like "Holmes' Chemistry Table" also embeds
  // "holmes" and would otherwise win via the substring check in step 12.
  const directNpcExactMatch = matchNpcIdExact(rawInput);
  if (directNpcExactMatch) {
    return {
      type: 'talk',
      targetId: directNpcExactMatch,
      targetRaw: rawInput,
      raw: rawInput,
    };
  }

  // 12. Implicit examine: if the whole input matches an object or NPC
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

  // 13. Fallback
  return {
    type: 'other',
    raw: rawInput,
  };
}
