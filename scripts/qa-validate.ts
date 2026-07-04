/**
 * scripts/qa-validate.ts
 *
 * Story-data referential-integrity validator for London Bleeds.
 * Pure data checks — no AI calls, no browser, no Supabase. Catches the
 * authoring-error classes that previously surfaced only in playtesting:
 * dangling clue connections, trigger objects missing from locations,
 * progression-gate flags nothing can set, NPC placement gaps, scripted
 * lines that can never fire, and spoiler leaks into public knowledge.
 *
 * FAIL = structurally broken (a gate can never open, an id doesn't resolve).
 * WARN = suspicious but possibly intentional (review by hand).
 *
 * Run: npx tsx scripts/qa-validate.ts
 * Exit code 1 if any FAIL.
 */

import { LOCATIONS } from '../engine/stories/whitechapel-1888/locations';
import { NPCS } from '../engine/stories/whitechapel-1888/npcs';
import {
  CLUE_DEFINITIONS,
  CLUE_TRIGGERS,
  TAKEABLE_OBJECTS,
  SHOW_INTERACTIONS,
  USE_COMBINATIONS,
  DOCUMENT_TEXT,
} from '../engine/stories/whitechapel-1888/clues';
import { ACT_PROGRESSION } from '../engine/stories/whitechapel-1888/acts';
import { SUSPECT_PROFILES } from '../engine/stories/whitechapel-1888/suspects';
import { DECISION_BY_FLAG } from '../engine/stories/whitechapel-1888/diaryDecisions';
import { INITIAL_INVENTORY } from '../constants';

// ── Logging helpers (same conventions as qa-engine.ts) ──────────────────────

let passes = 0;
let fails = 0;
let warns = 0;

function pass(label: string) { console.log(`[PASS] ${label}`); passes++; }
function fail(label: string, detail?: string) { console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`); fails++; }
function warn(label: string, detail?: string) { console.warn(`[WARN] ${label}${detail ? ` — ${detail}` : ''}`); warns++; }

function section(title: string) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 56 - title.length))}`); }

// ── Derived lookup sets ──────────────────────────────────────────────────────

const locationIds = new Set(Object.keys(LOCATIONS));
const npcIds = new Set(Object.keys(NPCS));
const clueIds = new Set(Object.keys(CLUE_DEFINITIONS));

// Every object id that exists anywhere in the world.
const allInteractables = new Set<string>();
for (const loc of Object.values(LOCATIONS)) {
  for (const obj of loc.interactables) allInteractables.add(obj);
}
const allObjectIds = new Set<string>([
  ...allInteractables,
  ...Object.keys(TAKEABLE_OBJECTS),
  ...Object.values(TAKEABLE_OBJECTS),
  ...INITIAL_INVENTORY,
]);

// Exact-match flags the engine or data can set outside the naming conventions.
const explicitSettableFlags = new Set<string>([
  ...Object.values(LOCATIONS).map(l => l.locationExaminedFlag),
  ...Object.keys(DECISION_BY_FLAG),
  'asylum_unlocked', // set by the engine on a correct deduction
]);

/**
 * Can this flag ever become true? Mirrors the engine's flag grammar:
 *   examined_<locationId>_<objectId>
 *   talked_to_<npcId>_at_<locationId>
 *   showed_<objectId>_to_<npcId>
 *   used_<objectId>_with_<objectId>
 *   npc_introduced_<npcId> | vignette_<locId>_<idx> | act_<n>_started
 * plus locationExaminedFlag values, decision flags, and engine specials.
 * Returns null when settable, else a human-readable reason.
 */
function flagUnreachableReason(flag: string): string | null {
  if (explicitSettableFlags.has(flag)) return null;

  // Dunder sentinels (e.g. __advance_via_correct_deduction_only__) are
  // deliberately unsettable — they mark gates that advance by other means.
  if (/^__.*__$/.test(flag)) return null;

  if (flag.startsWith('examined_')) {
    for (const locId of locationIds) {
      const prefix = `examined_${locId}_`;
      if (flag.startsWith(prefix)) {
        const objId = flag.slice(prefix.length);
        if (LOCATIONS[locId].interactables.includes(objId)) return null;
        if (allObjectIds.has(objId)) {
          return `object "${objId}" exists but is not an interactable at ${locId}`;
        }
        return `no object "${objId}" at ${locId}`;
      }
    }
    return 'no known location id matches this examined_ flag';
  }

  if (flag.startsWith('talked_to_')) {
    for (const npcId of npcIds) {
      const prefix = `talked_to_${npcId}_at_`;
      if (flag.startsWith(prefix)) {
        const locId = flag.slice(prefix.length);
        if (!locationIds.has(locId)) return `unknown location "${locId}"`;
        const npc = NPCS[npcId];
        const canonicallyThere = Object.values(npc.canonicalLocationByAct).includes(locId);
        const follows = npc.followingRule === 'follows_watson' || npc.followingRule === 'follows_bond';
        if (!canonicallyThere && !follows) {
          return `${npcId} is never canonically at ${locId} and does not follow anyone`;
        }
        return null;
      }
    }
    return 'no known npc id matches this talked_to_ flag';
  }

  if (flag.startsWith('showed_')) {
    const rest = flag.slice('showed_'.length);
    const sep = rest.lastIndexOf('_to_');
    if (sep === -1) return 'malformed showed_ flag (missing _to_)';
    const objId = rest.slice(0, sep);
    const npcId = rest.slice(sep + '_to_'.length);
    if (!npcIds.has(npcId)) return `unknown npc "${npcId}"`;
    if (!allObjectIds.has(objId)) return `unknown object "${objId}"`;
    return null;
  }

  if (flag.startsWith('used_')) {
    const rest = flag.slice('used_'.length);
    const sep = rest.indexOf('_with_');
    if (sep === -1) return 'malformed used_ flag (missing _with_)';
    const a = rest.slice(0, sep);
    const b = rest.slice(sep + '_with_'.length);
    if (USE_COMBINATIONS[a]?.[b] || USE_COMBINATIONS[b]?.[a]) return null;
    return `no USE_COMBINATIONS entry for ${a} + ${b}`;
  }

  if (flag.startsWith('npc_introduced_')) {
    const npcId = flag.slice('npc_introduced_'.length);
    return npcIds.has(npcId) ? null : `unknown npc "${npcId}"`;
  }

  if (flag.startsWith('vignette_')) return null;
  if (/^act_\d+_started$/.test(flag)) return null;
  if (flag.startsWith('holmes_nudged_at_')) return null;

  return 'does not match any flag the engine or story data can set';
}

// ── 1. Location graph ────────────────────────────────────────────────────────

section('Locations');
{
  let ok = true;
  for (const [locId, loc] of Object.entries(LOCATIONS)) {
    for (const exit of loc.exits) {
      if (!locationIds.has(exit)) {
        fail(`location ${locId}: exit "${exit}" does not resolve`);
        ok = false;
      }
    }
    if (loc.requiresFlag) {
      const reason = flagUnreachableReason(loc.requiresFlag);
      if (reason) {
        fail(`location ${locId}: requiresFlag "${loc.requiresFlag}" can never be set`, reason);
        ok = false;
      }
    }
  }
  if (ok) pass(`all ${locationIds.size} locations: exits and requiresFlag resolve`);
}

// ── 2. Clues ─────────────────────────────────────────────────────────────────

section('Clues');
{
  // Clue ids granted by show/use interactions (legitimate non-trigger paths).
  const grantedElsewhere = new Set<string>();
  for (const perNpc of Object.values(SHOW_INTERACTIONS)) {
    for (const si of Object.values(perNpc)) if (si.clueId) grantedElsewhere.add(si.clueId);
  }
  for (const perTarget of Object.values(USE_COMBINATIONS)) {
    for (const uc of Object.values(perTarget)) if (uc.clueId) grantedElsewhere.add(uc.clueId);
  }
  const triggeredClueIds = new Set<string>();
  for (const perObject of Object.values(CLUE_TRIGGERS)) {
    for (const ids of Object.values(perObject)) ids.forEach(id => triggeredClueIds.add(id));
  }

  let connectionsOk = true;
  let reachableOk = true;
  for (const [clueId, clue] of Object.entries(CLUE_DEFINITIONS)) {
    for (const conn of clue.connections) {
      if (!clueIds.has(conn)) {
        fail(`clue ${clueId}: connection "${conn}" does not resolve`);
        connectionsOk = false;
      }
    }
    if (!locationIds.has(clue.locationFound)) {
      fail(`clue ${clueId}: locationFound "${clue.locationFound}" does not resolve`);
      reachableOk = false;
      continue;
    }
    if (!triggeredClueIds.has(clueId) && !grantedElsewhere.has(clueId)) {
      fail(`clue ${clueId}: unreachable`, 'not granted by any CLUE_TRIGGERS, SHOW_INTERACTIONS, or USE_COMBINATIONS entry');
      reachableOk = false;
    }
  }
  if (connectionsOk) pass(`all clue connections resolve (${clueIds.size} clues)`);
  if (reachableOk) pass('every clue is reachable via trigger, show, or use');

  // CLUE_TRIGGERS structural integrity.
  let triggersOk = true;
  for (const [locId, perObject] of Object.entries(CLUE_TRIGGERS)) {
    if (!locationIds.has(locId)) {
      fail(`CLUE_TRIGGERS: unknown location "${locId}"`);
      triggersOk = false;
      continue;
    }
    for (const [objId, ids] of Object.entries(perObject)) {
      if (!LOCATIONS[locId].interactables.includes(objId)) {
        fail(`CLUE_TRIGGERS[${locId}]: "${objId}" is not an interactable there`);
        triggersOk = false;
      }
      for (const id of ids) {
        if (!clueIds.has(id)) {
          fail(`CLUE_TRIGGERS[${locId}][${objId}]: clue "${id}" does not resolve`);
          triggersOk = false;
        }
      }
    }
  }
  if (triggersOk) pass('CLUE_TRIGGERS locations, objects, and clue ids all resolve');
}

// ── 3. Act progression gates ─────────────────────────────────────────────────

section('Act progression');
{
  let ok = true;
  for (const [act, condition] of Object.entries(ACT_PROGRESSION)) {
    for (const flag of condition.requireFlags) {
      const reason = flagUnreachableReason(flag);
      if (reason) {
        fail(`Act ${act} gate flag "${flag}" can never be set`, reason);
        ok = false;
      }
    }
  }
  if (ok) pass('every ACT_PROGRESSION gate flag is settable');
}

// ── 4. NPCs ──────────────────────────────────────────────────────────────────

section('NPCs');
{
  let placementOk = true;
  let scriptedOk = true;
  for (const [npcId, npc] of Object.entries(NPCS)) {
    for (const [act, locId] of Object.entries(npc.canonicalLocationByAct)) {
      if (!locationIds.has(locId)) {
        fail(`npc ${npcId}: canonicalLocationByAct[${act}] "${locId}" does not resolve`);
        placementOk = false;
      }
    }
    const coveredActs = Object.keys(npc.canonicalLocationByAct).map(Number);
    if (coveredActs.length === 0) {
      warn(`npc ${npcId}: no canonicalLocationByAct entries at all`);
    } else {
      const missing = [1, 2, 3, 4, 5, 6].filter(a => !coveredActs.includes(a));
      if (missing.length > 0) {
        warn(`npc ${npcId}: no canonical location for act(s) ${missing.join(', ')}`,
          'absent from the world in those acts — confirm intentional');
      }
    }
    for (const [i, line] of (npc.scriptedLines ?? []).entries()) {
      if (!locationIds.has(line.locationId)) {
        fail(`npc ${npcId}: scriptedLines[${i}] location "${line.locationId}" does not resolve`);
        scriptedOk = false;
      }
      if (line.triggerFlag) {
        const reason = flagUnreachableReason(line.triggerFlag);
        if (reason) {
          fail(`npc ${npcId}: scriptedLines[${i}] triggerFlag "${line.triggerFlag}" can never be set`, reason);
          scriptedOk = false;
        }
      }
    }
  }
  if (placementOk) pass(`all ${npcIds.size} NPC canonical locations resolve`);
  if (scriptedOk) pass('all scriptedLines locations and trigger flags are valid');
}

// ── 5. Spoiler guard ─────────────────────────────────────────────────────────

section('Spoiler guard');
{
  // The killer's name must never sit in knowledge the AI may narrate freely
  // before the final act. Edmund's own entry is excluded (it defines him).
  let ok = true;
  for (const [npcId, npc] of Object.entries(NPCS)) {
    if (npcId === 'edmund') continue;
    const surfaces: Array<[string, string]> = [
      ...(npc.aliasDescription ? [[`aliasDescription`, npc.aliasDescription] as [string, string]] : []),
      ...(npc.idleBehaviors ?? []).map((k, i) => [`idleBehaviors[${i}]`, k] as [string, string]),
    ];
    for (const [where, text] of surfaces) {
      if (/halward/i.test(text)) {
        warn(`npc ${npcId} ${where} names Halward`, `"${text.slice(0, 80)}…" — confirm this cannot leak before Act VI`);
        ok = false;
      }
    }
  }
  if (ok) pass("no NPC public knowledge names the killer");

  // The "prasarved" misspelling is the smoking gun — a well-meaning typo fix
  // would break the mystery. Assert it survives in the story data.
  const clueJson = JSON.stringify(CLUE_DEFINITIONS);
  const docJson = JSON.stringify(DOCUMENT_TEXT);
  if (clueJson.includes('prasarved') && docJson.includes('prasarved')) {
    pass('the "prasarved" misspelling (intentional!) is intact in clues and documents');
  } else {
    fail('the intentional "prasarved" misspelling is missing',
      'someone may have "fixed" the smoking-gun typo — the deduction chain depends on it');
  }
}

// ── 6. Suspects ──────────────────────────────────────────────────────────────

section('Suspects');
{
  let ok = true;
  for (const s of SUSPECT_PROFILES) {
    // Red herrings may name a figure who is not an on-stage NPC (the engine
    // falls back to the raw id for display) — but the guilty party must exist.
    if (s.isGuilty && !npcIds.has(s.npcId)) {
      fail(`guilty suspect "${s.npcId}": npc does not resolve`);
      ok = false;
    }
    if (s.aliases.length === 0) {
      fail(`suspect profile "${s.npcId}": no aliases — the player cannot name them`);
      ok = false;
    }
  }
  const guilty = SUSPECT_PROFILES.filter(s => s.isGuilty);
  if (guilty.length !== 1) {
    fail(`expected exactly 1 guilty suspect, found ${guilty.length}`);
    ok = false;
  }
  if (ok) pass(`all ${SUSPECT_PROFILES.length} suspect profiles resolve (1 guilty)`);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`Results: ${passes} passed · ${fails} failed · ${warns} warnings`);
console.log('─'.repeat(60));
if (fails > 0) {
  console.error('\n✗ Story data validation FAILED');
  process.exit(1);
}
console.log('\n✓ Story data validation passed');
