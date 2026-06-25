# Watson Hint System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cryptic Holmes hint with a clue-aware, Watson-voiced hint that points the player at one randomly-chosen *available* next step needed to advance the current act.

**Architecture:** A new pure module (`hints.ts`) holds a declarative table of per-act "objectives" (each derived from the real `ACT_PROGRESSION` gate flags) with `done`/`available` predicates, plus a synchronous `selectHint(state)` selector. The engine and the UI hook both call `selectHint`; the AI only phrases the chosen target in Watson's voice (`getWatsonHint`). Engine decides *what*, AI decides *how it sounds* — preserving the engine/AI contract.

**Tech Stack:** TypeScript, React 19, `@google/genai` (Gemini), Vite. No test framework — QA is hand-rolled `tsx` scripts in `scripts/` (see `qa-engine.ts`), run with `npx tsx`.

---

## Background facts (verified in code — do not re-derive)

- Act gates live in `ACT_PROGRESSION` ([engine/stories/whitechapel-1888/acts.ts:107](../../../engine/stories/whitechapel-1888/acts.ts)). The unmet `requireFlags` for the current act ARE the remaining steps.
- Gate flag shapes: `examined_<loc>_<obj>`, `examined_<loc>` (location-level; set by examining ANY interactable there — [GameEngine.ts:391](../../../engine/GameEngine.ts)), `talked_to_<npc>_at_<loc>`, `showed_<obj>_to_<npc>`, `visited_<loc>`.
- SHOW requires the item in inventory ([GameEngine.ts:690](../../../engine/GameEngine.ts)); examining the object adds it to inventory ([GameEngine.ts:402](../../../engine/GameEngine.ts)). Hence the two-step "examine pile → show clipping" chain.
- Act 5 has no flag gate (sentinel `__advance_via_correct_deduction_only__`, never set). It advances via correct deduction needing `clue_06`, obtained by `USE edmund_forensic_note WITH from_hell_letter` at `baker_street`. That USE already sets the flag `used_edmund_forensic_note_with_from_hell_letter` ([GameEngine.ts:592](../../../engine/GameEngine.ts)). A correct deduction sets `deduction_correct` + `asylum_unlocked` ([suspects.ts:86](../../../engine/stories/whitechapel-1888/suspects.ts)).
- Act 6 locations: `private_asylum` has `requiresFlag: 'asylum_unlocked'` ([locations.ts:188](../../../engine/stories/whitechapel-1888/locations.ts)). Since `asylum_unlocked` is set when entering Act 6, the asylum is reachable throughout Act 6.
- Inventory holds DISPLAY NAMES (`TAKEABLE_OBJECTS` values — [clues.ts:446](../../../engine/stories/whitechapel-1888/clues.ts)), e.g. `'Newspaper Clipping (the "Dear Boss" letter)'`, `'From Hell Letter (transcript)'`, `"Assistant's Forensic Note (copy)"`.
- Name maps: `OBJECT_DISPLAY_NAMES`, `LOCATIONS[id].name` ([locations.ts:341](../../../engine/stories/whitechapel-1888/locations.ts)); `NPC_DISPLAY_NAMES`, `NPCS[id].canonicalLocationByAct` ([npcs.ts:451](../../../engine/stories/whitechapel-1888/npcs.ts)).
- NPC presence (engine's own rule): `npcStates[id]?.currentLocation ?? NPCS[id].canonicalLocationByAct[currentAct]`, excluding `status === 'deceased'`.
- Current hint flow to replace: `getHolmesHint` ([AIService.ts:572](../../../services/AIService.ts)), `handleConsultHolmes` ([useGameState.ts:1462](../../../hooks/useGameState.ts)), the auto-nudge `holmesNudge` ([GameEngine.ts:153](../../../engine/GameEngine.ts)) rendered at [AIService.ts:358](../../../services/AIService.ts), `NarrationContext.holmesNudge` ([types.ts:272](../../../types.ts)), and the button ([CommandInput.tsx:121](../../../components/CommandInput.tsx)).

## File structure

- **Create** `types.ts` additions: `HintVerb`, `HintTarget` (shared narration types; placed here so `NarrationContext` can reference them without importing the story module).
- **Create** `engine/stories/whitechapel-1888/hints.ts`: `HintState`, `HintObjective`, the `OBJECTIVES` table, predicate helpers, `selectHint`, `FALLBACK`.
- **Create** `scripts/qa-hints.ts`: assertion harness (drift guard + selector behaviour).
- **Modify** `services/AIService.ts`: add `getWatsonHint`; remove `getHolmesHint`; swap the `holmesNudge` render block for a `watsonHint` block.
- **Modify** `types.ts`: replace `NarrationContext.holmesNudge` with `watsonHint?: HintTarget`.
- **Modify** `engine/GameEngine.ts`: nudge block populates `aiContext.watsonHint = selectHint(session)`; remove old `holmesNudge`/cross-location logic.
- **Modify** `hooks/useGameState.ts`: rewire the manual handler to `selectHint` + `getWatsonHint`, render as a Watson inner-thought.
- **Modify** `components/CommandInput.tsx`: button `title`/label.

---

### Task 1: Shared hint types

**Files:**
- Modify: `types.ts` (add near the other narration types, e.g. just above `NarrationContext`)

- [ ] **Step 1: Add the shared types**

Add to `types.ts`:

```ts
export type HintVerb = 'examine' | 'talk' | 'show' | 'use' | 'deduce' | 'reflect';

/** The chosen next-step target the engine hands to the AI to phrase in Watson's voice. */
export interface HintTarget {
  verb: HintVerb;
  /** Neutral, player-facing noun phrase. Never contains clue findings/spoilers. */
  subject: string;
  /** Display name of the location the step happens at ('' for the reflect fallback). */
  locationName: string;
  /** True when that location is where Watson currently stands. */
  isCurrentLocation: boolean;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat(hints): add shared HintVerb/HintTarget types"
```

---

### Task 2: The objectives module (`hints.ts`)

**Files:**
- Create: `engine/stories/whitechapel-1888/hints.ts`

- [ ] **Step 1: Write the module**

Create `engine/stories/whitechapel-1888/hints.ts`:

```ts
import type { HintTarget, HintVerb } from '../../../types';
import { LOCATIONS, OBJECT_DISPLAY_NAMES } from './locations';
import { NPCS } from './npcs';

/** Narrow, read-only slice of session state the selector needs. */
export interface HintState {
  currentAct: number;
  location: string;
  flags: Record<string, boolean>;
  inventory: string[];
  npcStates: Record<string, { currentLocation?: string; status?: string }>;
}

export interface HintObjective {
  id: string;
  act: number;
  locationId: string;
  verb: HintVerb;
  /** Neutral, player-facing noun phrase. MUST NOT reveal clue content. */
  subject: string;
  done: (s: HintState) => boolean;
  available: (s: HintState) => boolean;
}

// ── Inventory display names (must match TAKEABLE_OBJECTS values in clues.ts) ──
const CLIPPING = 'Newspaper Clipping (the "Dear Boss" letter)';
const FROM_HELL = 'From Hell Letter (transcript)';
const FORENSIC_NOTE = "Assistant's Forensic Note (copy)";

// ── Predicate helpers ────────────────────────────────────────────────────────
function flag(s: HintState, name: string): boolean {
  return s.flags[name] === true;
}
function hasItem(s: HintState, displayName: string): boolean {
  return s.inventory.includes(displayName);
}
function locationReachable(s: HintState, locId: string): boolean {
  const loc = LOCATIONS[locId] as any;
  if (!loc) return false;
  if ((loc.act ?? 0) > s.currentAct) return false;
  if (loc.requiresFlag && !flag(s, loc.requiresFlag)) return false;
  return true;
}
function npcAt(s: HintState, npcId: string, locId: string): boolean {
  const st = s.npcStates[npcId];
  const loc = st?.currentLocation ?? (NPCS[npcId] as any)?.canonicalLocationByAct?.[s.currentAct];
  return loc === locId && st?.status !== 'deceased';
}
/** A talk/show step is available only if its location is reachable AND the NPC is there. */
function npcStep(s: HintState, locId: string, npcId: string): boolean {
  return locationReachable(s, locId) && npcAt(s, npcId, locId);
}

// ── The objective table — one entry per ACT_PROGRESSION gate flag, plus the
//    prerequisite steps that unlock show/use gates. Subjects stay neutral. ──────
export const OBJECTIVES: HintObjective[] = [
  // ----- Act 0: The Baker Street Vigil -----
  { id: 'a0_casewall', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: "Holmes's case-files wall and the four victims pinned upon it",
    done: s => flag(s, 'examined_baker_street_case_files_wall'),
    available: s => locationReachable(s, 'baker_street') },
  { id: 'a0_holmes', act: 0, locationId: 'baker_street', verb: 'talk',
    subject: 'Holmes himself, for his reading of the case',
    done: s => flag(s, 'talked_to_holmes_at_baker_street'),
    available: s => npcStep(s, 'baker_street', 'holmes') },
  { id: 'a0_newspile_examine', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the newspapers Holmes keeps piled by his chair',
    done: s => hasItem(s, CLIPPING) || flag(s, 'examined_baker_street_newspaper_pile'),
    available: s => locationReachable(s, 'baker_street') },
  { id: 'a0_newspile_show', act: 0, locationId: 'baker_street', verb: 'show',
    subject: "the 'Dear Boss' clipping — Holmes may make something of it",
    done: s => flag(s, 'showed_newspaper_pile_to_holmes'),
    available: s => hasItem(s, CLIPPING) && npcStep(s, 'baker_street', 'holmes') },
  { id: 'a0_telegrams', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: "Abberline's telegrams stacked on the side table",
    done: s => flag(s, 'examined_baker_street_telegrams_pile'),
    available: s => locationReachable(s, 'baker_street') },

  // ----- Act 1: The Last Murder -----
  { id: 'a1_hutchinson', act: 1, locationId: 'dorset_street', verb: 'talk',
    subject: 'the witness Hutchinson, lingering near the court',
    done: s => flag(s, 'talked_to_hutchinson_at_dorset_street'),
    available: s => npcStep(s, 'dorset_street', 'hutchinson') },
  { id: 'a1_clothing', act: 1, locationId: 'millers_court', verb: 'examine',
    subject: 'the burned clothing left in the grate',
    done: s => flag(s, 'examined_millers_court_burned_clothing'),
    available: s => locationReachable(s, 'millers_court') },
  { id: 'a1_bed', act: 1, locationId: 'millers_court', verb: 'examine',
    subject: 'the bed, and what was left upon it',
    done: s => flag(s, 'examined_millers_court_the_bed'),
    available: s => locationReachable(s, 'millers_court') },
  { id: 'a1_bond', act: 1, locationId: 'millers_court', verb: 'talk',
    subject: 'Dr. Bond, who has not yet spoken his mind',
    done: s => flag(s, 'talked_to_bond_at_millers_court'),
    available: s => npcStep(s, 'millers_court', 'bond') },

  // ----- Act 2: The First Victims -----
  { id: 'a2_mortuary', act: 2, locationId: 'whitechapel_mortuary', verb: 'examine',
    subject: "Dr. Bond's autopsy ledger at the mortuary",
    done: s => flag(s, 'examined_whitechapel_mortuary'),
    available: s => locationReachable(s, 'whitechapel_mortuary') },
  { id: 'a2_bucks', act: 2, locationId: 'bucks_row', verb: 'examine',
    subject: 'the spot on Buck’s Row where the earliest body lay',
    done: s => flag(s, 'examined_bucks_row'),
    available: s => locationReachable(s, 'bucks_row') },
  { id: 'a2_hanbury', act: 2, locationId: 'hanbury_street', verb: 'examine',
    subject: 'the yard at Hanbury Street',
    done: s => flag(s, 'examined_hanbury_street'),
    available: s => locationReachable(s, 'hanbury_street') },
  { id: 'a2_tumblety', act: 2, locationId: 'h_division_station', verb: 'talk',
    subject: 'the American doctor held at the station',
    done: s => flag(s, 'talked_to_tumblety_at_h_division_station'),
    available: s => npcStep(s, 'h_division_station', 'tumblety') },
  { id: 'a2_holmes', act: 2, locationId: 'h_division_station', verb: 'talk',
    subject: 'Holmes, on what he makes of the man in custody',
    done: s => flag(s, 'talked_to_holmes_at_h_division_station'),
    available: s => npcStep(s, 'h_division_station', 'holmes') },

  // ----- Act 3: The Double Event -----
  { id: 'a3_dutfields', act: 3, locationId: 'dutfields_yard', verb: 'examine',
    subject: "Dutfield's Yard, where the night's first body was found",
    done: s => flag(s, 'examined_dutfields_yard'),
    available: s => locationReachable(s, 'dutfields_yard') },
  { id: 'a3_pizer', act: 3, locationId: 'working_mens_club', verb: 'talk',
    subject: "Pizer, the man the mob named 'Leather Apron'",
    done: s => flag(s, 'talked_to_pizer_at_working_mens_club'),
    available: s => npcStep(s, 'working_mens_club', 'pizer') },
  { id: 'a3_mitre', act: 3, locationId: 'mitre_square', verb: 'examine',
    subject: 'the corner of Mitre Square',
    done: s => flag(s, 'examined_mitre_square'),
    available: s => locationReachable(s, 'mitre_square') },
  { id: 'a3_goulston', act: 3, locationId: 'goulston_street', verb: 'examine',
    subject: 'the doorway on Goulston Street and the chalked wall',
    done: s => flag(s, 'examined_goulston_street'),
    available: s => locationReachable(s, 'goulston_street') },
  { id: 'a3_holmes', act: 3, locationId: 'goulston_street', verb: 'talk',
    subject: 'Holmes, before the erased writing',
    done: s => flag(s, 'talked_to_holmes_at_goulston_street'),
    available: s => npcStep(s, 'goulston_street', 'holmes') },

  // ----- Act 4: The Letter -----
  { id: 'a4_lusk', act: 4, locationId: 'lusk_office', verb: 'examine',
    subject: 'the parcel and the letter sent to Mr. Lusk',
    done: s => flag(s, 'examined_lusk_office'),
    available: s => locationReachable(s, 'lusk_office') },
  { id: 'a4_abberline', act: 4, locationId: 'lusk_office', verb: 'talk',
    subject: 'Inspector Abberline, on where the trail now leads',
    done: s => flag(s, 'talked_to_abberline_at_lusk_office'),
    available: s => npcStep(s, 'lusk_office', 'abberline') },
  { id: 'a4_holmes', act: 4, locationId: 'lusk_office', verb: 'talk',
    subject: 'Holmes, for his reading of the letter',
    done: s => flag(s, 'talked_to_holmes_at_lusk_office'),
    available: s => npcStep(s, 'lusk_office', 'holmes') },

  // ----- Act 5: The Suspicion (no flag gate — convergence then deduction) -----
  { id: 'a5_letter', act: 5, locationId: 'lusk_office', verb: 'examine',
    subject: 'the From Hell letter, so its transcript is to hand',
    done: s => hasItem(s, FROM_HELL),
    available: s => locationReachable(s, 'lusk_office') },
  { id: 'a5_note', act: 5, locationId: 'bond_office', verb: 'examine',
    subject: "the assistant's cataloguing note among Bond's records",
    done: s => hasItem(s, FORENSIC_NOTE),
    available: s => locationReachable(s, 'bond_office') },
  { id: 'a5_convergence', act: 5, locationId: 'baker_street', verb: 'use',
    subject: 'the note and the letter, set side by side at Baker Street',
    done: s => flag(s, 'used_edmund_forensic_note_with_from_hell_letter'),
    available: s => hasItem(s, FROM_HELL) && hasItem(s, FORENSIC_NOTE) && locationReachable(s, 'baker_street') },
  { id: 'a5_deduce', act: 5, locationId: 'baker_street', verb: 'deduce',
    subject: 'the conclusion these papers point to',
    done: s => flag(s, 'deduction_correct'),
    available: s => flag(s, 'used_edmund_forensic_note_with_from_hell_letter') },

  // ----- Act 6: The Confrontation -----
  { id: 'a6_records', act: 6, locationId: 'private_asylum', verb: 'examine',
    subject: 'the patient records at the asylum',
    done: s => flag(s, 'visited_private_asylum'),
    available: s => locationReachable(s, 'private_asylum') },
  { id: 'a6_edmund', act: 6, locationId: 'private_asylum', verb: 'talk',
    subject: 'Edmund Halward, at the last',
    done: s => flag(s, 'talked_to_edmund_at_private_asylum'),
    available: s => npcStep(s, 'private_asylum', 'edmund') },
];

// Used when nothing actionable remains (transient: all current-act gates met).
const FALLBACK: HintTarget = {
  verb: 'reflect',
  subject: 'everything gathered so far',
  locationName: '',
  isCurrentLocation: true,
};

function toTarget(o: HintObjective, s: HintState): HintTarget {
  const loc = LOCATIONS[o.locationId] as any;
  return {
    verb: o.verb,
    subject: o.subject,
    locationName: loc?.name ?? o.locationId,
    isCurrentLocation: o.locationId === s.location,
  };
}

/**
 * Pick the next-step target. Prefers an available step at the player's current
 * location (forward momentum); otherwise any available step elsewhere. Random
 * within the chosen tier. Returns FALLBACK when nothing is actionable.
 */
export function selectHint(s: HintState): HintTarget {
  const pool = OBJECTIVES.filter(o => o.act === s.currentAct && !o.done(s) && o.available(s));
  if (pool.length === 0) return FALLBACK;
  const local = pool.filter(o => o.locationId === s.location);
  const tier = local.length > 0 ? local : pool;
  const pick = tier[Math.floor(Math.random() * tier.length)];
  return toTarget(pick, s);
}
```

> Note: `OBJECT_DISPLAY_NAMES` is imported for parity/future use of object ids; if `npm run lint` flags it as unused, drop it from the import. Leave it only if used.

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS. (If `OBJECT_DISPLAY_NAMES` is reported unused, remove it from the import line and re-run.)

- [ ] **Step 3: Commit**

```bash
git add engine/stories/whitechapel-1888/hints.ts
git commit -m "feat(hints): add objective table and selectHint selector"
```

---

### Task 3: QA harness for the selector (drift guard + behaviour)

**Files:**
- Create: `scripts/qa-hints.ts`
- Modify: `package.json` (add `qa:hints` script)

- [ ] **Step 1: Write the failing harness**

Create `scripts/qa-hints.ts`:

```ts
/**
 * scripts/qa-hints.ts
 * Deterministic QA for the Watson hint selector. No AI, no browser, no Supabase.
 * Run: npx tsx scripts/qa-hints.ts   (exit code 1 on any FAIL)
 */
import { OBJECTIVES, selectHint, HintState } from '../engine/stories/whitechapel-1888/hints';
import { ACT_PROGRESSION } from '../engine/stories/whitechapel-1888/acts';

let passes = 0, fails = 0;
function pass(l: string) { console.log(`[PASS] ${l}`); passes++; }
function fail(l: string, d?: string) { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; }

function state(p: Partial<HintState>): HintState {
  return { currentAct: 0, location: '', flags: {}, inventory: [], npcStates: {}, ...p };
}

const SENTINEL = '__advance_via_correct_deduction_only__';

// 1) Drift guard: every real gate flag is covered by an objective whose `done`
//    flips true when only that flag (or its inventory equivalent) is set.
for (const [actStr, cond] of Object.entries(ACT_PROGRESSION)) {
  const act = Number(actStr);
  for (const f of cond.requireFlags) {
    if (f === SENTINEL) continue;
    const s = state({ currentAct: act, flags: { [f]: true } });
    const covered = OBJECTIVES.some(o => o.act === act && o.done(s));
    covered ? pass(`gate covered: act ${act} ${f}`)
            : fail(`gate NOT covered by any objective`, `act ${act} ${f}`);
  }
}

// 2) Act 0 prerequisite chain: clipping not yet in hand → examine pile, not show.
{
  const before = state({ currentAct: 0, location: 'baker_street',
    npcStates: { holmes: { currentLocation: 'baker_street', status: 'alive' } } });
  const pool = OBJECTIVES.filter(o => o.act === 0 && !o.done(before) && o.available(before));
  const ids = pool.map(o => o.id);
  ids.includes('a0_newspile_examine') && !ids.includes('a0_newspile_show')
    ? pass('act0: examine-pile available, show-clipping not (no clipping yet)')
    : fail('act0 prereq gating wrong', ids.join(','));

  const after = state({ currentAct: 0, location: 'baker_street',
    inventory: ['Newspaper Clipping (the "Dear Boss" letter)'],
    flags: { examined_baker_street_newspaper_pile: true },
    npcStates: { holmes: { currentLocation: 'baker_street', status: 'alive' } } });
  const ids2 = OBJECTIVES.filter(o => o.act === 0 && !o.done(after) && o.available(after)).map(o => o.id);
  ids2.includes('a0_newspile_show') && !ids2.includes('a0_newspile_examine')
    ? pass('act0: with clipping in hand, show-clipping available, examine done')
    : fail('act0 show gating wrong', ids2.join(','));
}

// 3) Locked location: Act 6 asylum unavailable until asylum_unlocked.
{
  const locked = state({ currentAct: 6, location: 'bond_office' });
  const a = OBJECTIVES.find(o => o.id === 'a6_records')!;
  !a.available(locked) ? pass('act6: asylum locked without asylum_unlocked')
                       : fail('act6 asylum should be locked');
  const unlocked = state({ currentAct: 6, location: 'bond_office', flags: { asylum_unlocked: true } });
  a.available(unlocked) ? pass('act6: asylum reachable with asylum_unlocked')
                        : fail('act6 asylum should be reachable');
}

// 4) selectHint never returns a done/unavailable step; returns FALLBACK when empty.
{
  const allDone = state({ currentAct: 2, location: 'whitechapel_mortuary', flags: {
    examined_whitechapel_mortuary: true, examined_bucks_row: true, examined_hanbury_street: true,
    talked_to_tumblety_at_h_division_station: true, talked_to_holmes_at_h_division_station: true } });
  const t = selectHint(allDone);
  t.verb === 'reflect' ? pass('empty pool → reflect fallback')
                       : fail('expected reflect fallback', t.verb);

  const partial = state({ currentAct: 1, location: 'millers_court',
    flags: { examined_millers_court_burned_clothing: true } });
  const tgt = selectHint(partial);
  const match = OBJECTIVES.find(o => o.act === 1 && o.subject === tgt.subject);
  (tgt.verb === 'reflect') || (match && !match.done(partial) && match.available(partial))
    ? pass('selectHint returns an open, available step')
    : fail('selectHint returned a done/unavailable step', tgt.subject);
}

// 5) Local-first tiering: an available local step is preferred over remote ones.
{
  const s = state({ currentAct: 2, location: 'bucks_row' });
  // bucks_row examine is local & available; mortuary/hanbury are remote but reachable.
  let localHits = 0;
  for (let i = 0; i < 20; i++) if (selectHint(s).subject.includes('Buck')) localHits++;
  localHits === 20 ? pass('local-first: always picks the current-location step when available')
                   : fail('local-first tiering failed', `${localHits}/20`);
}

console.log(`\n${passes} passed, ${fails} failed`);
if (fails > 0) process.exit(1);
```

- [ ] **Step 2: Add the npm script**

In `package.json` `scripts`, add after `qa:parser`:

```json
    "qa:hints": "npx tsx scripts/qa-hints.ts"
```

- [ ] **Step 3: Run it**

Run: `npm run qa:hints`
Expected: all PASS, final line `N passed, 0 failed`, exit 0. If a drift-guard line FAILs, an objective's `done` predicate doesn't match a real gate flag — fix the objective in `hints.ts`, not the test.

- [ ] **Step 4: Commit**

```bash
git add scripts/qa-hints.ts package.json
git commit -m "test(hints): QA harness for selector drift guard and gating"
```

---

### Task 4: Watson hint generation in AIService

**Files:**
- Modify: `services/AIService.ts` (remove `getHolmesHint` at ~572-605; add `getWatsonHint`)

- [ ] **Step 1: Add `getWatsonHint` and remove `getHolmesHint`**

Delete the entire `getHolmesHint(...)` method ([AIService.ts:572-605](../../../services/AIService.ts)). Add in its place:

```ts
  /**
   * Non-streaming Watson-voiced hint. The engine has already chosen the target
   * (what to do next); Watson only phrases it. Directed but never spoils.
   */
  async getWatsonHint(target: HintTarget): Promise<string> {
    const where = target.isCurrentLocation
      ? 'It is here, where Watson already stands.'
      : `It is at ${target.locationName}; Watson would need to make his way there.`;

    const verbCue: Record<string, string> = {
      examine: 'look more closely at',
      talk: 'speak with',
      show: 'put before the right person',
      use: 'lay together and compare',
      deduce: 'draw his conclusion about',
      reflect: 'turn over again in his mind',
    };

    const focus = target.verb === 'reflect'
      ? `Watson senses he has gathered what this place can give, and should weigh ${target.subject}.`
      : `The avenue Watson has not yet pursued: ${verbCue[target.verb]} ${target.subject}. ${where}`;

    const prompt = `${focus}

Write Watson's private thought nudging himself toward this — first person, past tense, no more than 45 words. Name the avenue plainly so the reader knows what to do, but NEVER state what it will reveal or name the murderer. No preamble.`;

    const response = await this.ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction:
          `You are Dr. John Watson in 1888 London, writing in the first person, past tense. Restrained, observant, medical. You are recalling a moment when you realised what you had not yet done. One short reflection. Never reveal conclusions or the killer's identity.`,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return response.text?.trim()
      || 'I realised there was still ground I had not covered, and resolved to put that right.';
  }
```

- [ ] **Step 2: Import `HintTarget`**

Ensure `HintTarget` is imported at the top of `services/AIService.ts`. Find the existing `import ... from '../types'` and add `HintTarget` to it (or add `import type { HintTarget } from '../types';`).

- [ ] **Step 3: Verify it compiles**

Run: `npm run lint`
Expected: PASS. (There will be a follow-up error only if something still references `getHolmesHint` — that is fixed in Tasks 6/7.)

- [ ] **Step 4: Commit**

```bash
git add services/AIService.ts
git commit -m "feat(hints): add Watson getWatsonHint, remove getHolmesHint"
```

---

### Task 5: Swap the auto-nudge to Watson (engine + narration render + type)

**Files:**
- Modify: `types.ts` (`NarrationContext.holmesNudge` → `watsonHint`)
- Modify: `engine/GameEngine.ts:153-185` (populate `watsonHint`, drop old logic)
- Modify: `services/AIService.ts:358-377` (render `watsonHint` instead of `holmesNudge`)

- [ ] **Step 1: Replace the type field**

In `types.ts`, replace the whole `holmesNudge?: { ... };` block ([types.ts:272](../../../types.ts)) with:

```ts
  // Proactive hint woven into the turn when the player is stuck — chosen by the
  // engine's selectHint, phrased by the AI in Watson's voice.
  watsonHint?: HintTarget;
```

Ensure `HintTarget` is in scope in `types.ts` — it is defined in this same file (Task 1), so no import needed.

- [ ] **Step 2: Populate `watsonHint` in the engine**

In `engine/GameEngine.ts`, replace the nudge block ([GameEngine.ts:154-185](../../../engine/GameEngine.ts)) — from `if (this.shouldFireHolmesNudge(session, result)) {` through its closing `}` (the block that sets `holmesNudge`, the `holmes_nudged_at_*` flag, and the cross-location redirect) — with:

```ts
    // Proactive Watson hint — fires once per location when the player is stuck.
    if (this.shouldFireHolmesNudge(session, result)) {
      result.aiContext.watsonHint = selectHint(session);
      result.flagsUpdate = {
        ...result.flagsUpdate,
        [`holmes_nudged_at_${session.location}`]: true,
      };
    }
```

Add the import near the other story-data imports at the top of `GameEngine.ts`:

```ts
import { selectHint } from './stories/whitechapel-1888/hints';
```

`session` is a `SessionSnapshot`, a structural superset of `HintState` (it has `currentAct`, `location`, `flags`, `inventory`, `npcStates`), so it is accepted directly. Leave `shouldFireHolmesNudge` unchanged — it is still the correct trigger condition.

- [ ] **Step 3: Render `watsonHint` in the narration prompt**

In `services/AIService.ts`, replace the `if (ctx.holmesNudge) { ... }` block ([AIService.ts:358-377](../../../services/AIService.ts)) with:

```ts
  if (ctx.watsonHint) {
    const h = ctx.watsonHint;
    const place = h.isCurrentLocation ? 'here' : `at ${h.locationName}`;
    compactPrompt += `

=== WATSON'S THOUGHT (mandatory — append as the final paragraph) ===
Watson has spent several turns without progress. As the closing paragraph, add ONE brief private reflection (2–3 sentences, first person, past tense) in which he realises he has not yet ${h.verb === 'reflect' ? `weighed ${h.subject}` : `pursued ${h.subject} (${place})`}.
Name the avenue plainly so the reader knows what to do next. Do NOT reveal what it will show, and do NOT name the murderer. No act header.`;
  }
```

- [ ] **Step 4: Verify it compiles and selector tests still pass**

Run: `npm run lint && npm run qa:hints && npm run qa:engine`
Expected: lint PASS; `qa:hints` all PASS; `qa:engine` unchanged (still passes as before).

- [ ] **Step 5: Commit**

```bash
git add types.ts engine/GameEngine.ts services/AIService.ts
git commit -m "feat(hints): auto-nudge uses Watson selectHint instead of Holmes"
```

---

### Task 6: Rewire the manual hint button handler

**Files:**
- Modify: `hooks/useGameState.ts` (`handleConsultHolmes` at ~1462-1497)

- [ ] **Step 1: Rewrite the handler body**

Replace the body of `handleConsultHolmes` ([useGameState.ts:1462-1497](../../../hooks/useGameState.ts)) with:

```ts
  const handleConsultHolmes = useCallback(async () => {
    if (isConsultingHolmes || isLoading) return;
    setIsConsultingHolmes(true);
    setIsLoading(true);

    try {
      const target = selectHint({ currentAct, location, flags, inventory, npcStates });
      const hint = await aiService.getWatsonHint(target);

      setHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `> *A thought surfaced, unbidden.*\n\n${hint}`,
        },
      ]);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error('Hint failed', error);
    } finally {
      setIsConsultingHolmes(false);
      setIsLoading(false);
    }
  }, [isConsultingHolmes, isLoading, currentAct, location, flags, inventory, npcStates, scrollToBottom]);
```

- [ ] **Step 2: Add the import**

At the top of `hooks/useGameState.ts`, add to the story-data imports:

```ts
import { selectHint } from '../engine/stories/whitechapel-1888/hints';
```

- [ ] **Step 3: Verify no references to the removed method remain**

Run: `grep -rn "getHolmesHint\|criticalPathLead" hooks/ services/ App.tsx components/`
Expected: no matches (other than possibly a `criticalPathLead` field still defined in location data, which is fine — only the hint usage must be gone).

- [ ] **Step 4: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useGameState.ts
git commit -m "feat(hints): manual hint button uses Watson clue-aware hint"
```

---

### Task 7: Relabel the button

**Files:**
- Modify: `components/CommandInput.tsx:126`

- [ ] **Step 1: Change the title**

In `components/CommandInput.tsx`, change the button `title` ([CommandInput.tsx:126](../../../components/CommandInput.tsx)) from:

```tsx
              title="Consult Holmes"
```

to:

```tsx
              title="Gather your thoughts"
```

Leave the `Lightbulb` icon and `onConsultHolmes` prop name as-is (renaming the prop is out of scope and would touch App.tsx + the hook interface for no functional gain).

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/CommandInput.tsx
git commit -m "feat(hints): relabel hint button away from Holmes"
```

---

### Task 8: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full check suite**

Run: `npm run lint && npm run qa:hints && npm run qa:engine && npm run qa:parser`
Expected: all PASS.

- [ ] **Step 2: Live smoke test (needs API key)**

`GEMINI_API_KEY` lives in `.env` on `main` — copy it into this branch's `.env` if absent. Then run the dev server (`npm run dev`), start a new game, and at Baker Street click the hint button (now "Gather your thoughts") **before** examining anything. Confirm:
- The hint is in Watson's first-person voice (not "Sherlock Holmes:").
- It names a real available avenue at Baker Street (case wall / newspapers / telegrams / speak with Holmes) and never "show Holmes the clipping" before the pile is examined.
- After examining the newspaper pile, the hint can now suggest showing the clipping to Holmes.

- [ ] **Step 3: Final commit (if any uncommitted tidy-ups)**

```bash
git add -A && git commit -m "chore(hints): finalize Watson hint system" || echo "nothing to commit"
```

---

## Self-review notes

- **Spec coverage:** objective model (Task 2) ✓; act-gate-driven targeting (Task 2 table) ✓; availability incl. show-needs-inventory prereq (Task 2 `a0_newspile_*`, `a5_*`) ✓; random selection + local-first momentum (Task 2 `selectHint`) ✓; Watson voice/directed/non-spoiling (Task 4) ✓; both mechanisms unified (Tasks 5 & 6) ✓; Act 5 convergence + deduce (Task 2 `a5_*`) ✓; Act 6 asylum gating (Task 2 `a6_*`) ✓; drift guard test (Task 3) ✓; button relabel (Task 7) ✓.
- **Type consistency:** `HintTarget`/`HintVerb` defined once in `types.ts`; `HintState`/`HintObjective`/`selectHint`/`OBJECTIVES` in `hints.ts`; `selectHint` consumed by both `GameEngine.ts` and `useGameState.ts` with the same shape. Inventory display-name constants in `hints.ts` mirror `TAKEABLE_OBJECTS` values exactly.
- **No data-model changes:** the Act 5 convergence reuses the existing `used_edmund_forensic_note_with_from_hell_letter` flag — no engine/data edits required for detection.
