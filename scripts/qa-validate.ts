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
  TAKEABLE_REQUIRES_FLAG,
  SHOW_INTERACTIONS,
  USE_COMBINATIONS,
  DOCUMENT_TEXT,
} from '../engine/stories/whitechapel-1888/clues';
import { ACT_PROGRESSION, ACT_TIME_CONFIG } from '../engine/stories/whitechapel-1888/acts';
import { computeTimePeriod, npcLocationAt, PERIOD_ORDER } from '../engine/GameEngine';
import { WORLD_EVENTS } from '../engine/stories/whitechapel-1888/events';
import { SUSPECT_PROFILES } from '../engine/stories/whitechapel-1888/suspects';
import { FACTS } from '../engine/stories/whitechapel-1888/facts';
import { deriveKnowledgeEnvelope } from '../engine/stories/knowledge';
import { DECISION_BY_FLAG } from '../engine/stories/whitechapel-1888/diaryDecisions';
import { INITIAL_INVENTORY } from '../constants';
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';
import { RUMORS } from '../engine/stories/whitechapel-1888/rumors';
import { APPROACHES } from '../engine/stories/whitechapel-1888/approaches';

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
        const canonicallyThere = Object.values(npc.scheduleByAct).some(s => s.default === locId || Object.values(s.byPeriod ?? {}).includes(locId));
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

  if (flag.startsWith('world_event_')) {
    const evId = flag.slice('world_event_'.length);
    return WORLD_EVENTS.some(e => e.id === evId) ? null : `no world event with id "${evId}"`;
  }

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

// ── 3b. Takeable gates + gated SHOW interactions ─────────────────────────────

section('Takeable gates + gated SHOW interactions');
{
  let takeableOk = true;
  for (const [objId, flag] of Object.entries(TAKEABLE_REQUIRES_FLAG)) {
    if (!(objId in TAKEABLE_OBJECTS)) {
      fail(`TAKEABLE_REQUIRES_FLAG["${objId}"]: "${objId}" is not in TAKEABLE_OBJECTS`,
        'gating an object that was never takeable to begin with');
      takeableOk = false;
      continue;
    }
    const reason = flagUnreachableReason(flag);
    if (reason) {
      fail(`TAKEABLE_REQUIRES_FLAG["${objId}"]: gate flag "${flag}" can never be set`, reason);
      takeableOk = false;
    }
  }
  if (takeableOk) pass('every TAKEABLE_REQUIRES_FLAG entry gates a real takeable object with a settable flag');

  let showGateOk = true;
  for (const [objId, perNpc] of Object.entries(SHOW_INTERACTIONS)) {
    for (const [npcId, si] of Object.entries(perNpc)) {
      for (const flag of si.requireFlags ?? []) {
        const reason = flagUnreachableReason(flag);
        if (reason) {
          fail(`SHOW_INTERACTIONS["${objId}"]["${npcId}"]: requireFlags entry "${flag}" can never be set`, reason);
          showGateOk = false;
        }
      }
    }
  }
  if (showGateOk) pass('every SHOW_INTERACTIONS requireFlags entry is settable');
}

// ── 4. NPCs ──────────────────────────────────────────────────────────────────

section('NPCs');
{
  let placementOk = true;
  let scriptedOk = true;
  let idleOk = true;
  for (const [npcId, npc] of Object.entries(NPCS)) {
    for (const [act, sched] of Object.entries(npc.scheduleByAct)) {
      if (!locationIds.has(sched.default)) {
        fail(`npc ${npcId}: scheduleByAct[${act}].default "${sched.default}" does not resolve`);
        placementOk = false;
      }
      for (const [period, locId] of Object.entries(sched.byPeriod ?? {})) {
        if (!locationIds.has(locId as string)) {
          fail(`npc ${npcId}: scheduleByAct[${act}].byPeriod.${period} "${locId}" does not resolve`);
          placementOk = false;
        }
      }
    }
    const coveredActs = Object.keys(npc.scheduleByAct).map(Number);
    if (coveredActs.length === 0) {
      warn(`npc ${npcId}: no scheduleByAct entries at all`);
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
    // Idle beats: a scoped beat must name a real location, and (unless the NPC
    // is a follower, who can be led anywhere) one their schedule can actually
    // place them at — otherwise it is silently dead content.
    for (const [i, beat] of (npc.idleBeats ?? []).entries()) {
      if (!beat.locationId) continue;
      if (!locationIds.has(beat.locationId)) {
        fail(`npc ${npcId}: idleBeats[${i}] location "${beat.locationId}" does not resolve`);
        idleOk = false;
        continue;
      }
      if (!npc.followsNpcId) {
        const reachable = Object.values(npc.scheduleByAct).some(s =>
          s.default === beat.locationId ||
          Object.values(s.byPeriod ?? {}).includes(beat.locationId));
        if (!reachable) {
          warn(`npc ${npcId}: idleBeats[${i}] scoped to "${beat.locationId}" but the schedule never places them there`,
            'dead content — the beat can never fire');
        }
      }
    }
  }
  if (placementOk) pass(`all ${npcIds.size} NPC canonical locations resolve`);
  if (scriptedOk) pass('all scriptedLines locations and trigger flags are valid');
  if (idleOk) pass('all idleBeats location scopes resolve');
}

// ── 4b. Fact graph ───────────────────────────────────────────────────────────

section('Facts');
{
  let ok = true;
  const factIds = new Set<string>();
  for (const f of FACTS) {
    if (factIds.has(f.id)) { fail(`fact "${f.id}": duplicate id`); ok = false; }
    factIds.add(f.id);
    for (const npcId of f.knownBy) {
      if (!npcIds.has(npcId)) { fail(`fact "${f.id}": knownBy "${npcId}" does not resolve`); ok = false; }
    }
    if (f.knownBy.length === 0) { fail(`fact "${f.id}": knownBy is empty — no one can voice it`); ok = false; }
    for (const clueId of f.relatedClues ?? []) {
      if (!clueIds.has(clueId)) { fail(`fact "${f.id}": relatedClues "${clueId}" does not resolve`); ok = false; }
    }
    if (!Number.isInteger(f.visibleFromAct) || f.visibleFromAct < 0 || f.visibleFromAct > 6) {
      fail(`fact "${f.id}": visibleFromAct ${f.visibleFromAct} out of range 0-6`); ok = false;
    }
  }
  if (ok) pass(`all ${FACTS.length} facts: ids unique, knownBy/relatedClues resolve, act gates in range`);

  // Every NPC the player can talk to should know something.
  for (const npcId of npcIds) {
    if (deriveKnowledgeEnvelope(FACTS, npcId, 6).length === 0) {
      warn(`npc ${npcId}: empty knowledge envelope even at Act 6`, 'talking to them gives the AI nothing — confirm intentional');
    }
  }
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
      ...(npc.idleBeats ?? []).map((b, i) => [`idleBeats[${i}]`, b.text] as [string, string]),
    ];
    for (const [where, text] of surfaces) {
      if (/halward/i.test(text)) {
        warn(`npc ${npcId} ${where} names Halward`, `"${text.slice(0, 80)}…" — confirm this cannot leak before Act VI`);
        ok = false;
      }
    }
  }
  if (ok) pass('no NPC alias description or idle behavior names the killer');

  // The killer's name in a fact is only safe if the fact is Edmund's own
  // (knownBy ⊆ {edmund}) or gated to the final act.
  let factsOk = true;
  for (const f of FACTS) {
    if (!/halward/i.test(f.statement)) continue;
    const edmundOnly = f.knownBy.every(id => id === 'edmund');
    if (!edmundOnly && f.visibleFromAct < 6) {
      fail(`fact "${f.id}" names Halward, is known by [${f.knownBy.join(', ')}], and is visible from act ${f.visibleFromAct}`,
        'gate it to visibleFromAct 6 or restrict knownBy to edmund');
      factsOk = false;
    }
  }
  if (factsOk) pass("no fact leaks the killer's name before Act VI");

  // World events are unconditional narration broadcasts (no knownBy/act gating
  // like facts) — the killer's name must never appear in one, full stop.
  let worldEventsOk = true;
  for (const ev of WORLD_EVENTS) {
    if (/halward/i.test(ev.text)) {
      fail(`world event "${ev.id}" names Halward`, `"${ev.text.slice(0, 80)}…" — world events broadcast unconditionally, this cannot be gated`);
      worldEventsOk = false;
    }
  }
  if (worldEventsOk) pass('no world event names the killer');

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

// ── 7. Story manifest (Phase 2b) ──────────────────────────────────────────────

section('Story manifest (Phase 2b)');

// Document-introduced NPCs point at a real examinable object.
for (const [npcId, npc] of Object.entries(NPCS)) {
  if (npc.introduction?.type === 'document') {
    if (allObjectIds.has(npc.introduction.objectId)) {
      pass(`introduction: ${npcId} document '${npc.introduction.objectId}' exists`);
    } else {
      fail(`introduction: ${npcId} document object '${npc.introduction.objectId}' does not exist in the world`);
    }
    if (!npc.requiresIntroduction) {
      warn(`introduction: ${npcId} has a document introduction but requiresIntroduction is not true`);
    }
  }
}

// Companion demeanors reference real NPCs and end in a catch-all variant.
for (const cd of WHITECHAPEL_MANIFEST.companionDemeanors) {
  if (npcIds.has(cd.npcId)) {
    pass(`companionDemeanors: '${cd.npcId}' is a real NPC`);
  } else {
    fail(`companionDemeanors: unknown NPC '${cd.npcId}'`);
  }
  if (cd.variants.length === 0) {
    fail(`companionDemeanors: '${cd.npcId}' has no variants`);
  } else {
    // The last variant should be a catch-all so a present companion always
    // carries a demeanor. Heuristic: it must match a bare default session.
    const emptySession = { currentAct: 1, location: '', flags: {}, inventory: [], discoveredClueIds: [], turnCount: 0 };
    if (cd.variants[cd.variants.length - 1].when(emptySession)) {
      pass(`companionDemeanors: '${cd.npcId}' last variant is a catch-all`);
    } else {
      warn(`companionDemeanors: '${cd.npcId}' last variant is not a catch-all — some states will carry no demeanor`);
    }
  }
}

// Act safety nets reference real acts and NPCs.
for (const net of WHITECHAPEL_MANIFEST.actSafetyNets) {
  if (npcIds.has(net.requiresNpcPresent)) {
    pass(`actSafetyNets: act ${net.act} NPC '${net.requiresNpcPresent}' is real`);
  } else {
    fail(`actSafetyNets: act ${net.act} references unknown NPC '${net.requiresNpcPresent}'`);
  }
  if (net.act >= 1 && net.act <= 6) {
    pass(`actSafetyNets: act ${net.act} is a valid act number`);
  } else {
    fail(`actSafetyNets: act ${net.act} is out of range (1-6)`);
  }
}

// Manifest story constants resolve.
if (clueIds.has(WHITECHAPEL_MANIFEST.smokingGunClueId)) {
  pass(`manifest: smokingGunClueId '${WHITECHAPEL_MANIFEST.smokingGunClueId}' is a real clue`);
} else {
  fail(`manifest: smokingGunClueId '${WHITECHAPEL_MANIFEST.smokingGunClueId}' does not resolve`);
}

section('Location opening hours (Phase 4a)');
for (const [locId, loc] of Object.entries(LOCATIONS)) {
  if (!loc.openPeriods) continue;
  if (loc.openPeriods.length === 0) fail(`location ${locId}: openPeriods is empty (always closed)`);
  if (!loc.lockedNote?.text) fail(`location ${locId}: openPeriods set but no lockedNote`);
  const kh = loc.lockedNote?.keyholderNpcId;
  if (kh && !npcIds.has(kh)) fail(`location ${locId}: lockedNote.keyholderNpcId "${kh}" does not resolve`);
  if (kh && npcIds.has(kh)) {
    for (const act of Object.keys(NPCS[kh].scheduleByAct).map(Number)) {
      for (const period of PERIOD_ORDER) {
        if (loc.openPeriods.includes(period)) continue;
        const whereId = npcLocationAt(NPCS, kh, act, period, {});
        if (whereId === locId) {
          warn(`location ${locId}: keyholder "${kh}" is scheduled at their own gated location during ${period} (act ${act}), a period NOT in openPeriods — self-referential locked-door note (engine suppresses it, but schedule data may want a byPeriod override)`);
        }
      }
    }
  }
}
pass('opening-hours integrity checked');

section('World events (Phase 4a)');
{
  const seen = new Set<string>();
  for (const ev of WORLD_EVENTS) {
    if (seen.has(ev.id)) fail(`world event "${ev.id}": duplicate id`);
    seen.add(ev.id);
    if (!ACT_TIME_CONFIG[ev.act]) fail(`world event "${ev.id}": act ${ev.act} has no time config`);
    if (ev.atClockMinutes < 0 || ev.atClockMinutes > 1439) fail(`world event "${ev.id}": atClockMinutes ${ev.atClockMinutes} out of range`);
    if (!ev.text.trim()) fail(`world event "${ev.id}": empty text`);
  }
  pass(`${WORLD_EVENTS.length} world events structurally valid`);
}

section('Schedule guard rail: gate NPCs findable at act start (Phase 4a)');
{
  // Every NPC whose conversation gates an act must be at their schedule
  // default during that act's canonical-start period — a player following a
  // hint straight there always finds them. Followers are exempt (they are
  // wherever Watson is).
  let checked = 0;
  for (const [actStr, cond] of Object.entries(ACT_PROGRESSION)) {
    const act = Number(actStr);
    const startPeriod = computeTimePeriod(ACT_TIME_CONFIG[act].canonicalMinutes);
    for (const flag of cond.requireFlags) {
      if (!flag.startsWith('talked_to_')) continue;
      // Disambiguate npc id vs location id by prefix-matching known npc ids.
      const npcId = [...npcIds].find(id => flag.startsWith(`talked_to_${id}_at_`));
      if (!npcId) continue; // unreachable-flag check already covers this
      const locId = flag.slice(`talked_to_${npcId}_at_`.length);
      const npc = NPCS[npcId];
      if (npc.followsNpcId && (npc.followsUntilAct === undefined || act <= npc.followsUntilAct)) continue;
      const atStart = npcLocationAt(NPCS, npcId, act, startPeriod, {});
      checked++;
      if (atStart !== locId) {
        fail(`gate NPC ${npcId} (act ${act}): scheduled at "${atStart}" during the act's start period (${startPeriod}), but the gate needs them at "${locId}"`);
      }
    }
  }
  pass(`${checked} act-gate NPC placements verified against schedules`);
}

// ── Rumors (Phase 4b) ────────────────────────────────────────────────────────

section('Rumors (Phase 4b)');
{
  // The corpus of trigger flags the engine can actually set. A typo'd trigger
  // silently kills the rumor forever, so unknown patterns are a hard FAIL.
  const settableFlags = new Set<string>();
  for (const [objId, byNpc] of Object.entries(SHOW_INTERACTIONS)) {
    for (const npcId of Object.keys(byNpc)) settableFlags.add(`showed_${objId}_to_${npcId}`);
  }
  for (const cond of Object.values(ACT_PROGRESSION)) {
    for (const f of cond.requireFlags) settableFlags.add(f);
  }
  const talkFlagRe = /^talked_to_([a-z_]+?)_at_([a-z_]+)$/;

  const failsBefore = fails;
  const seenIds = new Set<string>();
  for (const r of RUMORS) {
    if (seenIds.has(r.id)) fail(`rumor id "${r.id}" is duplicated`);
    seenIds.add(r.id);

    // Trigger must be a flag the engine can set.
    const talkMatch = r.triggerFlag.match(talkFlagRe);
    const talkOk = talkMatch && npcIds.has(talkMatch[1]) && locationIds.has(talkMatch[2]);
    if (!settableFlags.has(r.triggerFlag) && !talkOk) {
      fail(`rumor "${r.id}" trigger "${r.triggerFlag}" matches no settable flag`,
        'must be a showed_<objectId>_to_<npcId> pair from SHOW_INTERACTIONS, an ACT_PROGRESSION requireFlag, or talked_to_<npcId>_at_<locationId> with both ids resolving');
    }

    if (r.spread.length === 0) fail(`rumor "${r.id}" has an empty spread list`);
    for (const s of r.spread) {
      if (!npcIds.has(s.npcId)) fail(`rumor "${r.id}" spreads to unknown NPC "${s.npcId}"`);
      if (!Number.isInteger(s.delayPeriods) || s.delayPeriods < 0 || s.delayPeriods > 8) {
        fail(`rumor "${r.id}" → ${s.npcId} has delayPeriods ${s.delayPeriods}`, 'must be an integer 0–8');
      }
      if (/halward/i.test(s.statement)) {
        fail(`rumor "${r.id}" → ${s.npcId} statement names Halward`, 'rumor statements enter envelopes unconditionally once matured — the killer\'s name can never ride one');
      }
      if (/prasarved/i.test(s.statement)) {
        fail(`rumor "${r.id}" → ${s.npcId} statement contains "prasarved"`, 'the smoking-gun detail must never spread as hearsay');
      }
    }
  }
  if (fails === failsBefore) pass(`${RUMORS.length} rumors: ids unique, triggers settable, recipients resolve, statements spoiler-clean`);
}

// ── NPC approaches (Phase 5) ─────────────────────────────────────────────────

section('NPC approaches (Phase 5)');
{
  const seenIds = new Set<string>();
  const failsBefore = fails;
  for (const a of APPROACHES) {
    const label = `approach ${a.id}`;

    if (seenIds.has(a.id)) fail(`${label}: id is duplicated`);
    seenIds.add(a.id);

    if (!npcIds.has(a.npcId)) { fail(`${label}: npc "${a.npcId}" does not resolve`); continue; }
    if (a.locationId !== 'any' && !locationIds.has(a.locationId)) {
      fail(`${label}: location "${a.locationId}" does not resolve`);
      continue;
    }

    if ((a.kind === 'rumor') !== !!a.rumorId) {
      fail(`${label}: kind is "${a.kind}" but rumorId is ${a.rumorId ? `set to "${a.rumorId}"` : 'unset'}`,
        'rumorId must be set if and only if kind is "rumor"');
    }
    if (a.rumorId && !RUMORS.some(r => r.id === a.rumorId && r.spread.some(s => s.npcId === a.npcId))) {
      fail(`${label}: rumor "${a.rumorId}" has no spread entry for ${a.npcId}`,
        'the rumor must exist and list this npcId as a recipient');
    }

    for (const f of [...(a.requireFlags ?? []), ...(a.forbidFlags ?? [])]) {
      const reason = flagUnreachableReason(f);
      if (reason) fail(`${label}: flag "${f}" can never be set`, reason);
    }

    // The silent break: the NPC must actually be schedulable at the location
    // in at least one (act, period) combination the approach allows.
    if (a.locationId !== 'any') {
      const acts = a.acts ?? Object.keys(NPCS[a.npcId].scheduleByAct).map(Number);
      const periods = a.timePeriods ?? PERIOD_ORDER;
      const reachable = acts.some(act => periods.some(p =>
        npcLocationAt(NPCS, a.npcId, act, p, {}) === a.locationId));
      if (!reachable) fail(`${label}: ${a.npcId} is never at ${a.locationId} in the allowed acts/periods`);
    }

    // Spoiler guard over the authored text — same guard as world events.
    if (/halward/i.test(a.text)) {
      fail(`${label}: text names Halward`,
        `"${a.text.slice(0, 80)}…" — approaches fire unconditionally once eligible, this cannot be gated`);
    }
  }
  if (fails === failsBefore) {
    pass(`${APPROACHES.length} approaches: ids unique, npc/location/rumor references resolve, flags settable, placement reachable, text spoiler-clean`);
  }

  const edmundCount = APPROACHES.filter(a => a.npcId === 'edmund' && a.kind === 'mundane').length;
  if (edmundCount < 2) warn('Edmund has fewer than 2 mundane approaches', 'recession rule — the murderer must initiate contact like everyone else');
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
