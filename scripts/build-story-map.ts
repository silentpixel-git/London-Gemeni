/**
 * scripts/build-story-map.ts
 *
 * Extractor for the interactive Story Map (tools/story-map.html) — an author's
 * overview of "London Bleeds: The Whitechapel Diaries". Reads the REAL composed
 * story manifest and derives, per act and per location: characters present,
 * clues found, hint objectives, puzzles (USE/SHOW/combination steps) with their
 * solutions, readable documents, plus the act-advance gate and a location graph
 * for the map view. No AI, no browser — pure data over the manifest.
 *
 * Run:  npx tsx scripts/build-story-map.ts
 * Out:  tools/story-map.html   (template + injected data)
 *       --json  →  also print the data object to stdout (debugging)
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { WHITECHAPEL_MANIFEST as M } from '../engine/stories/whitechapel-1888/manifest';
import { ACT_BRIDGES } from '../engine/stories/whitechapel-1888/acts';
import { ITEM_SPENT_AFTER_ACT } from '../engine/stories/whitechapel-1888/clues';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// ── display-name helpers ─────────────────────────────────────────────────────
const npcName = (id: string): string => M.npcDisplayNames[id] ?? M.npcs[id]?.displayName ?? id;
const objName = (id: string): string => M.objectDisplayNames[id] ?? id;
const itemName = (id: string): string => M.takeableObjects[id] ?? objName(id);
const locName = (id: string): string => M.locations[id]?.name ?? id;

const ACTS = Object.keys(M.actNames).map(Number).sort((a, b) => a - b);

// Reverse index: object id → the location whose interactables list it.
const objectHome: Record<string, string> = {};
for (const [locId, loc] of Object.entries(M.locations)) {
  for (const obj of loc.interactables) objectHome[obj] = locId;
}

// A handful of hint objectives express a USE/SHOW step but carry no `flag`
// (they are prerequisite/inventory steps). Map their id → the engine flag the
// step actually sets, so we can recover the concrete interaction + solution.
const OBJECTIVE_FLAG_OVERRIDE: Record<string, string> = {
  a1_account_test: 'used_hutchinson_account_with_court_archway',
  a4_kidney_letter: 'used_kidney_parcel_with_from_hell_letter',
  a5_convergence: 'used_edmund_forensic_note_with_from_hell_letter',
};

// ── solution recovery for an objective flag ──────────────────────────────────
interface Solution {
  kind: 'use' | 'show';
  itemName: string;
  targetName: string;   // object (use) or NPC (show)
  result: string;
  clueName?: string;
  requiresLocation?: string;
  requiresAct?: number;
  requireFlags?: string[];
}

function solutionForFlag(flag: string | undefined): Solution | undefined {
  if (!flag) return undefined;
  let m = /^used_(.+)_with_(.+)$/.exec(flag);
  if (m) {
    const [, a, b] = m;
    const combo = M.useCombinations[a]?.[b];
    if (!combo) return undefined;
    return {
      kind: 'use',
      itemName: itemName(a),
      targetName: itemName(b) !== b ? itemName(b) : objName(b),
      result: combo.resultNote,
      clueName: combo.clueId ? M.clueDefinitions[combo.clueId]?.name : undefined,
      requiresLocation: combo.requiresLocation ? locName(combo.requiresLocation) : undefined,
      requiresAct: combo.requiresAct,
    };
  }
  m = /^showed_(.+)_to_(.+)$/.exec(flag);
  if (m) {
    const [, a, b] = m;
    const show = M.showInteractions[a]?.[b];
    if (!show) return undefined;
    return {
      kind: 'show',
      itemName: itemName(a),
      targetName: npcName(b),
      result: show.resultNote,
      clueName: show.clueId ? M.clueDefinitions[show.clueId]?.name : undefined,
      requireFlags: show.requireFlags,
    };
  }
  return undefined;
}

// Turn a raw gate flag into a readable step, preferring the matching objective's
// authored subject, else a mechanical fallback parse. Carries the place the step
// happens — without it the act's checklist can't be followed without hunting.
function gateStep(flag: string): { text: string; verb?: string; where?: string } {
  if (flag.startsWith('__')) {
    return {
      text: 'Advances only on a correct deduction — lay the note beside the letter at Baker Street, then name him. ' +
        `A deduction needs at least ${M.deductionThreshold} clues in hand.`,
    };
  }
  const obj = M.hintObjectives.find(o => o.flag === flag);
  if (obj) return { text: obj.subject, verb: obj.verb, where: locName(obj.locationId) };
  // Fallback: examined_<loc>_<obj>, talked_to_<npc>_at_<loc>, etc.
  let mm = /^talked_to_(.+)_at_(.+)$/.exec(flag);
  if (mm) return { text: `Talk to ${npcName(mm[1])}`, verb: 'talk', where: locName(mm[2]) };
  return { text: flag.replace(/_/g, ' ') };
}

/** An act whose gate is the never-set sentinel advances by deduction instead. */
function advancesByDeduction(act: number): boolean {
  return (M.actProgression[act]?.requireFlags ?? []).some(f => String(f).startsWith('__'));
}

// Reverse index: clue id → the USE combination that grants it (synthetic clues).
const comboByClue: Record<string, { a: string; b: string; combo: (typeof M.useCombinations)[string][string] }> = {};
for (const [a, targets] of Object.entries(M.useCombinations)) {
  for (const [b, combo] of Object.entries(targets)) {
    if (combo.clueId) comboByClue[combo.clueId] = { a, b, combo };
  }
}

// The single act in which a clue is actually obtainable. Combination-granted
// (synthetic) clues resolve to their gate act; plain examines to the act their
// location first opens — so a revisited location (Baker Street in Acts 0 and 5)
// shows each clue exactly once, under the right act.
function primaryAct(clueId: string): number {
  const c = M.clueDefinitions[clueId];
  const cb = comboByClue[clueId];
  if (cb) {
    if (cb.combo.requiresAct != null) return cb.combo.requiresAct;
    const flag = `used_${cb.a}_with_${cb.b}`;
    const obj = M.hintObjectives.find(o => (o.flag ?? OBJECTIVE_FLAG_OVERRIDE[o.id]) === flag);
    if (obj) return obj.act;
    if (cb.combo.requiresLocation) return M.locations[cb.combo.requiresLocation]?.act ?? 0;
  }
  return M.locations[c.locationFound]?.act ?? 0;
}

// ── per-act / per-location assembly ──────────────────────────────────────────
type Clue = ReturnType<typeof clueView>;
function clueView(id: string) {
  const c = M.clueDefinitions[id];
  const synthetic = M.clueTriggers[c.locationFound]?.[c.triggerObject] === undefined;
  return {
    id,
    name: c.name,
    group: c.clueGroup,
    trigger: objName(c.triggerObject),
    synthetic, // granted via a USE combination, not a plain examine
    diaryNote: c.diaryNote,
    description: c.description,
    holmes: c.holmesDeduction,
    medicalPoints: c.medicalPoints,
    moralPoints: c.moralPoints,
    // Carry ids so the clue web is walkable, not just readable.
    connections: c.connections
      .filter(x => M.clueDefinitions[x])
      .map(x => ({ id: x, name: M.clueDefinitions[x].name })),
  };
}

// NPCs present at (act, location) via their schedule.
function npcsAt(act: number, locId: string) {
  const out: Array<{ id: string; name: string; role: string; masked?: string }> = [];
  for (const npc of Object.values(M.npcs)) {
    const sched = npc.scheduleByAct[act];
    if (!sched) continue;
    const spots = new Set<string>([sched.default, ...Object.values(sched.byPeriod ?? {})]);
    if (!spots.has(locId)) continue;
    out.push({
      id: npc.id,
      name: npcName(npc.id),
      role: npc.role,
      // For introduction-gated NPCs, note what the player sees before the reveal.
      masked: npc.requiresIntroduction && npc.alias && npc.alias !== npc.displayName ? npc.alias : undefined,
    });
  }
  return out;
}

// Clues found at a location, scoped to the act they are obtainable in (so a
// revisited location doesn't repeat its clues across acts).
function cluesAt(act: number, locId: string): Clue[] {
  return Object.keys(M.clueDefinitions)
    .filter(id => M.clueDefinitions[id].locationFound === locId && primaryAct(id) === act)
    .map(clueView);
}

// Objectives (hints) for (act, location), enriched with a solution when the
// step is a USE/SHOW interaction.
function objectivesAt(act: number, locId: string) {
  const gateFlags = new Set<string>((M.actProgression[act]?.requireFlags ?? []).map(String));
  // Act 5 has no reachable flag gate — it advances on the deduction, so every
  // step there is on the critical path to it.
  const allRequired = advancesByDeduction(act);
  return M.hintObjectives
    .filter(o => o.act === act && o.locationId === locId)
    .map(o => {
      const flag = o.flag ?? OBJECTIVE_FLAG_OVERRIDE[o.id];
      return {
        id: o.id,
        verb: o.verb,
        subject: o.subject,
        flag,
        // Required = this step is itself an act-advance gate. Everything else is
        // supporting: prerequisites that unlock a gate, or optional colour.
        required: allRequired || (!!o.flag && gateFlags.has(o.flag)),
        solution: solutionForFlag(flag),
      };
    });
}

// The earliest act an inventory item can exist: a talk-granted item is available
// once its NPC first appears; otherwise the item's source object opens with its
// location. Used to hide interactions whose item cannot exist yet this act.
function itemSourceAct(itemId: string): number {
  for (const [npcId, granted] of Object.entries(M.talkGrantsItem)) {
    if (granted === itemId) {
      const acts = Object.keys(M.npcs[npcId]?.scheduleByAct ?? {}).map(Number);
      return acts.length ? Math.min(...acts) : 0;
    }
  }
  const home = objectHome[itemId];
  return home ? (M.locations[home]?.act ?? 0) : 0;
}

// Whether an item is actually in Watson's bag during a given act: available from
// its source act, and not yet dropped by the spent-after-act bag hygiene.
function itemInBag(itemId: string, act: number): boolean {
  if (itemSourceAct(itemId) > act) return false;
  const spentAfter = ITEM_SPENT_AFTER_ACT[itemName(itemId)];
  return spentAfter === undefined || act <= spentAfter;
}

// "Other interactions" anchored to a location that the objectives don't already
// surface: single-object USE flavour, plus USE-combos / SHOWs pinned here that
// no act-step covers. Keeps the puzzle surface complete.
function extraInteractionsAt(act: number, locId: string, coveredFlags: Set<string>) {
  const out: Array<{ label: string; result: string; clueName?: string; note?: string }> = [];

  // USE combinations whose requiresLocation pins them here.
  for (const [a, targets] of Object.entries(M.useCombinations)) {
    for (const [b, combo] of Object.entries(targets)) {
      const flag = `used_${a}_with_${b}`;
      if (coveredFlags.has(flag)) continue;
      if (combo.requiresLocation !== locId) continue;
      if (combo.requiresAct && combo.requiresAct !== act) continue;
      // Both items must be in the bag this act.
      if (!itemInBag(a, act) || (M.takeableObjects[b] && !itemInBag(b, act))) continue;
      out.push({
        label: `USE ${itemName(a)} WITH ${objName(b)}`,
        result: combo.resultNote,
        clueName: combo.clueId ? M.clueDefinitions[combo.clueId]?.name : undefined,
        note: combo.requiresAct ? `Act ${combo.requiresAct}+ only` : undefined,
      });
    }
  }

  // SHOW interactions where the recipient NPC is present here this act.
  const present = new Set(npcsAt(act, locId).map(n => n.id));
  for (const [item, recipients] of Object.entries(M.showInteractions)) {
    for (const [npc, show] of Object.entries(recipients)) {
      const flag = `showed_${item}_to_${npc}`;
      if (coveredFlags.has(flag)) continue;
      if (!present.has(npc)) continue;
      if (!itemInBag(item, act)) continue; // item not in Watson's bag this act
      out.push({
        label: `SHOW ${itemName(item)} TO ${npcName(npc)}`,
        result: show.resultNote,
        clueName: show.clueId ? M.clueDefinitions[show.clueId]?.name : undefined,
        note: show.requireFlags?.length ? 'Gated — see steps' : undefined,
      });
    }
  }
  return out;
}

// Readable documents whose source object lives here.
function documentsAt(locId: string) {
  const out: Array<{ name: string; text: string }> = [];
  for (const [objId, text] of Object.entries(M.documentText)) {
    // Doc keys can be act-suffixed (case_files_wall@0); strip for the home check.
    const base = objId.split('@')[0];
    if (objectHome[base] === locId) out.push({ name: objName(base) + (objId.includes('@') ? ` (Act ${objId.split('@')[1]})` : ''), text });
  }
  return out;
}

// Which locations belong to an act's walkthrough: those first available this act
// (location.act === n) unioned with any location an objective references this act.
function locationsForAct(act: number): string[] {
  const ids = new Set<string>();
  for (const [id, loc] of Object.entries(M.locations)) if (loc.act === act) ids.add(id);
  for (const o of M.hintObjectives) if (o.act === act) ids.add(o.locationId);
  // Order: anchor first, then by location.act then name.
  return [...ids].sort((a, b) => {
    const anchor = M.actAnchors[act];
    if (a === anchor) return -1;
    if (b === anchor) return 1;
    return (M.locations[a]?.act ?? 0) - (M.locations[b]?.act ?? 0) || locName(a).localeCompare(locName(b));
  });
}

function locationView(act: number, locId: string) {
  const loc = M.locations[locId];
  const objectives = objectivesAt(act, locId);
  const coveredFlags = new Set(objectives.map(o => o.flag).filter(Boolean) as string[]);
  return {
    id: locId,
    name: loc.name,
    shortName: loc.shortName,
    act: loc.act,
    revisit: loc.act !== act, // an earlier location revisited this act
    timeframe: loc.timeframe,
    timeOfDay: loc.timeOfDay,
    atmosphere: loc.atmosphere,
    description: loc.description,
    exits: loc.exits.map(e => ({ id: e, name: locName(e) })),
    openPeriods: loc.openPeriods ?? null,
    requiresFlag: (loc as any).requiresFlag ?? null,
    characters: npcsAt(act, locId),
    clues: cluesAt(act, locId),
    objectives,
    interactions: extraInteractionsAt(act, locId, coveredFlags),
    documents: documentsAt(locId),
  };
}

function actView(act: number) {
  const t = M.actTimeConfig[act];
  const w = M.actWeather[act];
  const gate = M.actProgression[act];
  const locations = locationsForAct(act).map(id => locationView(act, id));
  return {
    number: act,
    name: M.actNames[act],
    dayOfWeek: t?.dayOfWeek ?? '',
    date: t?.displayDate ?? '',
    weather: w?.label ?? '',
    anchor: M.actAnchors[act] ? locName(M.actAnchors[act]) : '221B Baker Street',
    bridge: (ACT_BRIDGES as Record<number, string>)[act] ?? '',
    gate: {
      advanceTo: gate?.advanceTo,
      byDeduction: advancesByDeduction(act),
      steps: (gate?.requireFlags ?? []).map(f => gateStep(f)),
    },
    // At-a-glance shape of the act, readable while every act is still collapsed.
    tally: {
      places: locations.length,
      clues: locations.reduce((n, l) => n + l.clues.length, 0),
      required: locations.reduce((n, l) => n + l.objectives.filter(o => o.required).length, 0),
    },
    locations,
  };
}

// ── cast + suspects roster ───────────────────────────────────────────────────
// Group the cast by the role they play in Watson's investigation — a reader's
// organising frame, not a mechanical field. Order within a group by appearance.
const CAST_GROUP: Record<string, string> = {
  holmes: 'detectives', abberline: 'detectives', bond: 'detectives', phillips: 'detectives', edmund: 'detectives',
  hutchinson: 'witnesses', diemschutz: 'witnesses', lusk: 'witnesses', barmaid: 'witnesses', superintendent: 'witnesses',
  tumblety: 'blamed', pizer: 'blamed',
};
const CAST_GROUP_ORDER = ['detectives', 'witnesses', 'blamed'];

function castView() {
  return Object.values(M.npcs).map(npc => {
    const firstAct = Math.min(...Object.keys(npc.scheduleByAct).map(Number));
    return {
      id: npc.id,
      name: npcName(npc.id),
      role: npc.role,
      description: npc.description,
      personality: npc.personality,
      // The alias mechanic: who Watson takes them for before they are named.
      firstSeenAs: npc.requiresIntroduction ? (M.npcAliases[npc.id] ?? npc.alias) : null,
      group: CAST_GROUP[npc.id] ?? 'witnesses',
      firstAct,
      schedule: ACTS
        .filter(a => npc.scheduleByAct[a])
        .map(a => ({ act: a, location: locName(npc.scheduleByAct[a].default) })),
    };
  }).sort((a, b) =>
    CAST_GROUP_ORDER.indexOf(a.group) - CAST_GROUP_ORDER.indexOf(b.group) || a.firstAct - b.firstAct,
  );
}

// The suspect board: every theory the player can name, resolved. Sourced from
// SUSPECT_PROFILES (the authority on guilt + Holmes's rebuttal), enriched from
// PERSONS_OF_INTEREST for the "why suspected" line where one exists. A profile
// need not be a real NPC (the Vanishing Gentleman is a theory, not a man), and
// not every profile has a POI (Abberline) — both handled without gaps.
function suspectsView() {
  return M.suspectProfiles.map(sp => {
    const npc = M.npcs[sp.npcId];
    const poi = M.personsOfInterest.find(p => p.id === `poi_${sp.npcId}`);
    const rebuttal = sp.wrongDeductionNote
      ?.replace(/^COLD CASE[^—]*—\s*/i, '')          // strip authoring prefix
      .replace(/\s*Write a 150-word[\s\S]*$/i, '')   // strip authoring directive tail
      .trim();
    return {
      npcId: sp.npcId,
      name: npc ? npcName(sp.npcId) : (poi?.label ?? sp.npcId),
      role: npc ? npc.role : 'A theory, never a man Watson meets',
      firstSeenAs: npc?.requiresIntroduction ? (M.npcAliases[sp.npcId] ?? npc.alias) : null,
      isGuilty: sp.isGuilty,
      whySuspected: poi?.detail,                     // the case FOR suspicion
      verdict: sp.isGuilty ? undefined : rebuttal,   // Holmes dismantling the theory
      cleared: poi?.clearedNote,                     // one-line "how it was struck"
    };
  });
}

// ── map graph ────────────────────────────────────────────────────────────────
function mapView() {
  const nodes = Object.values(M.locations).map(l => ({
    id: l.id,
    name: l.name,
    shortName: l.shortName,
    act: l.act,
    timeframe: l.timeframe,
    timeOfDay: l.timeOfDay,
    requiresFlag: (l as any).requiresFlag ?? null,
  }));
  const seen = new Set<string>();
  const edges: Array<{ a: string; b: string }> = [];
  for (const l of Object.values(M.locations)) {
    for (const e of l.exits) {
      if (!M.locations[e]) continue;
      const key = [l.id, e].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: l.id, b: e });
    }
  }
  return { nodes, edges };
}

// ── assemble ─────────────────────────────────────────────────────────────────
const data = {
  meta: {
    title: 'London Bleeds — Story Map',
    subtitle: 'The Whitechapel Diaries · author overview',
    generatedAt: new Date().toISOString().slice(0, 10),
    deductionThreshold: M.deductionThreshold,
    smokingGun: M.clueDefinitions[M.smokingGunClueId]?.name ?? M.smokingGunClueId,
    guiltyName: npcName(M.suspectProfiles.find(s => s.isGuilty)?.npcId ?? ''),
    actCount: ACTS.length,
    locationCount: Object.keys(M.locations).length,
    npcCount: Object.keys(M.npcs).length,
    clueCount: Object.keys(M.clueDefinitions).length,
  },
  acts: ACTS.map(actView),
  cast: castView(),
  suspects: suspectsView(),
  map: mapView(),
};

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(data, null, 2));
  process.exit(0);
}

// Inject into the template and write the final self-contained HTML.
const templatePath = join(ROOT, 'tools', 'story-map.template.html');
const outPath = join(ROOT, 'tools', 'story-map.html');
try {
  const template = readFileSync(templatePath, 'utf8');
  const html = template.replace(
    '/*__STORY_DATA__*/',
    `window.STORY = ${JSON.stringify(data)};`,
  );
  writeFileSync(outPath, html, 'utf8');
  console.log(`✓ Wrote ${outPath}`);
  console.log(
    `  ${data.acts.length} acts · ${data.meta.locationCount} locations · ` +
      `${data.meta.npcCount} NPCs · ${data.meta.clueCount} clues`,
  );
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    console.log('  (template not found yet — run again after tools/story-map.template.html exists)');
  } else {
    throw err;
  }
}
