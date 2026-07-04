# Phase 2b — StoryManifest + Generic Engine Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GameEngine and useGameState consume one injected `StoryManifest` object instead of scattered story imports, and the three Whitechapel-specific special-cases (Edmund's document introduction, Holmes demeanor, act-5 safety net) become story data.

**Architecture:** A `StoryManifest` interface in `engine/stories/types.ts` aggregates every table/function the engine layer needs. `engine/stories/whitechapel-1888/manifest.ts` exports `WHITECHAPEL_MANIFEST`. `GameEngine` takes the manifest via constructor (`this.story.X`); the singleton construction is the single sanctioned story import in engine code. Three imperative NPC-id-keyed blocks become generic loops over manifest data. **This is a parity refactor — zero behavior change.**

**Tech Stack:** TypeScript (tsc is the schema — no Zod, per the 2a decision), Vite client build, tsx-driven QA scripts as the regression suite (no unit-test framework in this repo).

**Spec:** `docs/superpowers/specs/2026-07-04-phase2b-story-manifest-design.md`

## Global Constraints

- Parity refactor: `npm run qa:validate`, `qa:engine`, `qa:parser`, `qa:hints`, `qa:diary-leads` must pass unchanged after every task. Capture baseline output before Task 1.
- `npm run lint` (`tsc --noEmit`) must pass after every task.
- The `gameData.ts` barrel stays untouched (other consumers keep using it). Do not migrate barrel consumers beyond what each task states.
- `engine/intentParser.ts` alias tables are OUT OF SCOPE — do not touch that file except if lint forces it (it shouldn't).
- ESM gotcha (PR #18): only files reachable from `api/ai.ts` → `server/aiCore.ts` need `.js` extensions on relative imports. `aiCore.ts` imports only `ATMOSPHERIC_SEEDS` from the barrel; nothing in this plan enters the server graph as a *value* import (type-only imports are erased). If in doubt after Task 2, run `npm run build` and check nothing new broke.
- Grep gate (final): `grep -n "whitechapel-1888" engine/GameEngine.ts engine/intentParser.ts hooks/useGameState.ts` returns only (a) the manifest import in `GameEngine.ts` (singleton construction) and (b) at most one manifest import in `useGameState.ts`.
- Commit after every task. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Baseline (do first, before Task 1)

- [ ] Run all five QA suites and save output to compare against later:

```bash
npm run lint && npm run qa:validate && npm run qa:engine && npm run qa:parser && npm run qa:hints && npm run qa:diary-leads
```

Expected: all pass (exit 0). If any fail at baseline, STOP and report — do not start the refactor on a broken base.

---

### Task 1: Shared manifest types in `engine/stories/types.ts`

**Files:**
- Modify: `engine/stories/types.ts`
- Modify: `engine/stories/whitechapel-1888/acts.ts` (re-export moved types)
- Modify: `engine/stories/whitechapel-1888/clues.ts` (re-export moved types)
- Modify: `engine/stories/whitechapel-1888/suspects.ts` (re-export moved type)
- Modify: `engine/stories/whitechapel-1888/hints.ts` (re-export moved types)
- Modify: `engine/stories/whitechapel-1888/diaryLeads.ts` (re-export moved type)

**Interfaces:**
- Consumes: existing `LocationDefinition`, `NPCDefinition`, `ClueDefinition`, `ActCondition`, `StoryFact`, `SuspectProfile` in `stories/types.ts`; `HintTarget`, `HintVerb` from root `types.ts`.
- Produces: `StoryManifest`, `SessionView`, `NPCIntroduction`, `CompanionDemeanor`, `ActSafetyNet`, `DiaryLeadHelpers`, and the relocated `ActTimeConfig`, `WeatherCondition`, `ActWeather`, `ShowInteraction`, `UseCombination`, `PersonOfInterest`, `HintState`, `HintObjective`, `LeadContext`. Task 2 builds the manifest against exactly these names.

Why the moves: `StoryManifest` must reference these types, and `stories/types.ts` cannot import from `stories/whitechapel-1888/*` (that would invert the schema→data dependency). Each origin file keeps a type re-export so every existing import site (barrel, qa scripts, hooks) compiles unchanged.

- [ ] **Step 1: Move the type definitions into `engine/stories/types.ts`**

Cut these blocks verbatim from their current files and paste them into `stories/types.ts` (below the existing interfaces). Their bodies do not change:

- From `acts.ts`: `export interface ActTimeConfig` (line ~15), `export type WeatherCondition` (~55), `export interface ActWeather` (~58)
- From `clues.ts`: `export interface ShowInteraction` (~522), `export interface UseCombination` (~582)
- From `suspects.ts`: `export interface PersonOfInterest` (~11)
- From `hints.ts`: `export interface HintState` (~6), `export interface HintObjective` (~17)
- From `diaryLeads.ts`: `export interface LeadContext` (~26)

At the top of `stories/types.ts` add the one import these need (`HintObjective` uses `HintVerb`; the manifest below uses `HintTarget`):

```ts
import type { HintTarget, HintVerb } from '../../types';
```

- [ ] **Step 2: Add back-compat re-exports in each origin file**

In each file the types were cut from, add (and remove the now-unneeded local definitions):

```ts
// acts.ts
export type { ActTimeConfig, WeatherCondition, ActWeather } from '../types';
// clues.ts
export type { ShowInteraction, UseCombination } from '../types';
// suspects.ts
export type { PersonOfInterest } from '../types';
// hints.ts
export type { HintState, HintObjective } from '../types';
// diaryLeads.ts
export type { LeadContext } from '../types';
```

Where a file still *uses* the moved type internally (e.g. `acts.ts` typing `ACT_TIME_CONFIG: Record<number, ActTimeConfig>`, `hints.ts` predicates over `HintState`), also add a type import: `import type { ActTimeConfig, ... } from '../types';`. (A re-export alone does not bring the name into local scope.)

- [ ] **Step 3: Add the new manifest types to `engine/stories/types.ts`**

```ts
// ── Story manifest (Phase 2b) ────────────────────────────────────────────────
// One object aggregating everything the engine layer consumes from a story.
// tsc is the schema; predicates are plain functions over a narrow SessionView.

/** Read-only slice of SessionSnapshot that manifest predicates may inspect. */
export interface SessionView {
  currentAct: number;
  location: string;
  flags: Record<string, boolean>;
  inventory: string[];
  discoveredClueIds: string[];
  turnCount: number;
}

/** How an NPC's real name is learned. Absent = 'self' (introduces on first TALK). */
export type NPCIntroduction =
  | { type: 'self' }
  | { type: 'document'; objectId: string };

/** Case-state demeanor for a companion NPC — first matching variant wins. */
export interface CompanionDemeanor {
  npcId: string;
  variants: Array<{ when: (s: SessionView) => boolean; text: string }>;
}

/** Directorial nudge injected when an act's failure-path condition holds. */
export interface ActSafetyNet {
  act: number;
  requiresNpcPresent: string;
  when: (s: SessionView) => boolean;
  instruction: string;
}

export interface DiaryLeadHelpers {
  isRequiredFlag(actNumber: number, flag: string): boolean;
  clueGateFlag(def: ClueDefinition): string;
  leadContextFor(actNumber: number, flag: string): LeadContext | null;
  detectSilentLeadFlags(params: {
    actNumber: number;
    flagsUpdate: Record<string, boolean>;
    priorFlags: Record<string, boolean>;
    discoveredClueIds: string[];
  }): string[];
}

export interface StoryManifest {
  id: string;

  // World data tables (same objects the story files already export)
  locations: Record<string, LocationDefinition>;
  npcs: Record<string, NPCDefinition>;
  npcAliases: Record<string, string>;
  npcDisplayNames: Record<string, string>;
  objectDisplayNames: Record<string, string>;
  clueDefinitions: Record<string, ClueDefinition>;
  clueTriggers: Record<string, Record<string, string[]>>;
  atmosphericNotes: Record<string, Record<string, string>>;
  takeableObjects: Record<string, string>;
  useInteractions: Record<string, Record<string, string>>;
  showInteractions: Record<string, Record<string, ShowInteraction>>;
  useCombinations: Record<string, Record<string, UseCombination>>;
  documentText: Record<string, string>;

  // Act structure
  actNames: Record<number, string>;
  actProgression: Record<number, ActCondition>;
  actAnchors: Record<number, string>;
  actTimeConfig: Record<number, ActTimeConfig>;
  actWeather: Record<number, ActWeather>;

  // Deduction
  deductionThreshold: number;
  suspectProfiles: SuspectProfile[];
  personsOfInterest: PersonOfInterest[];

  // Hint + diary-lead systems
  selectHint: (s: HintState) => HintTarget;
  hintObjectives: HintObjective[];
  diaryLeads: DiaryLeadHelpers;

  // Fact graph (Phase 2a)
  facts: StoryFact[];

  // Story constants previously inlined in GameEngine
  smokingGunClueId: string;
  convergenceFlag: string;
  playerNpcId: string;

  // Declarative behavior hooks (replace NPC-id-keyed engine blocks)
  companionDemeanors: CompanionDemeanor[];
  actSafetyNets: ActSafetyNet[];
}
```

- [ ] **Step 4: Add the `introduction` field to `NPCDefinition`**

In `stories/types.ts`, inside `NPCDefinition`, directly under `requiresIntroduction?: boolean;`:

```ts
  requiresIntroduction?: boolean;  // If true, shown as alias until introduced via flag
  // How the real name is learned. Absent = self (first TALK). 'document' NPCs
  // are introduced when the player examines the named object instead.
  introduction?: NPCIntroduction;
```

- [ ] **Step 5: Verify the whole repo still typechecks**

Run: `npm run lint`
Expected: exit 0, no errors. (This proves every re-export site works — barrel, qa scripts, hooks.)

- [ ] **Step 6: Run the QA suites (parity check)**

Run: `npm run qa:validate && npm run qa:engine && npm run qa:hints && npm run qa:diary-leads`
Expected: identical pass counts to baseline.

- [ ] **Step 7: Commit**

```bash
git add engine/stories/types.ts engine/stories/whitechapel-1888/acts.ts engine/stories/whitechapel-1888/clues.ts engine/stories/whitechapel-1888/suspects.ts engine/stories/whitechapel-1888/hints.ts engine/stories/whitechapel-1888/diaryLeads.ts
git commit -m "feat: add StoryManifest types; hoist shared story types to stories/types.ts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `WHITECHAPEL_MANIFEST` in `engine/stories/whitechapel-1888/manifest.ts`

**Files:**
- Create: `engine/stories/whitechapel-1888/manifest.ts`

**Interfaces:**
- Consumes: `StoryManifest`, `CompanionDemeanor`, `ActSafetyNet` from Task 1; every existing named export from the whitechapel-1888 story files.
- Produces: `export const WHITECHAPEL_MANIFEST: StoryManifest`. Tasks 3–5 import exactly this name from exactly this path.

The demeanor texts, safety-net instruction, and constants below are copied **verbatim** from `GameEngine.ts` (lines ~972, ~1258–1268, ~1284–1292). Task 4 deletes the originals; until then the strings exist in two places, which is fine — the manifest copies are unused until wired.

- [ ] **Step 1: Create the manifest file**

```ts
// engine/stories/whitechapel-1888/manifest.ts
//
// The single composed story object for "London Bleeds: The Whitechapel
// Diaries". The engine layer consumes ONLY this (injected into GameEngine's
// constructor) — no other engine file imports whitechapel-1888 data directly.

import type { StoryManifest, CompanionDemeanor, ActSafetyNet } from '../types';
import { LOCATIONS, OBJECT_DISPLAY_NAMES } from './locations';
import { NPCS, NPC_DISPLAY_NAMES, NPC_ALIASES } from './npcs';
import {
  CLUE_DEFINITIONS,
  CLUE_TRIGGERS,
  ATMOSPHERIC_NOTES,
  TAKEABLE_OBJECTS,
  USE_INTERACTIONS,
  SHOW_INTERACTIONS,
  USE_COMBINATIONS,
  DOCUMENT_TEXT,
} from './clues';
import {
  ACT_NAMES,
  ACT_PROGRESSION,
  ACT_ANCHORS,
  ACT_TIME_CONFIG,
  ACT_WEATHER,
  DEDUCTION_THRESHOLD,
} from './acts';
import { SUSPECT_PROFILES, PERSONS_OF_INTEREST } from './suspects';
import { selectHint, OBJECTIVES } from './hints';
import { isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags } from './diaryLeads';
import { FACTS } from './facts';

// Holmes case-state demeanor — derived, no new state. Colors how he carries
// himself this act; injected only when he is present and not interviewed.
// First matching variant wins; the last is the catch-all.
const COMPANION_DEMEANORS: CompanionDemeanor[] = [
  {
    npcId: 'holmes',
    variants: [
      {
        when: s => s.flags['used_edmund_forensic_note_with_from_hell_letter'] === true,
        text: 'Holmes is grim and certain now — coiled, economical, already three moves ahead. The chase has replaced the puzzle.',
      },
      {
        when: s => s.discoveredClueIds.length >= 3,
        text: 'Holmes is absorbed — the abstracted intensity of a mind cross-referencing everything it sees. He answers a beat late.',
      },
      {
        when: () => true,
        text: 'Holmes is restless, irritable at the want of data — snapping at small noises, retreating into tobacco.',
      },
    ],
  },
];

// Act 5 safety net: the convergence needs the From Hell letter transcript,
// but the Act 4 gate is the location flag — a player can reach Act 5 without
// ever copying the letter. If so, Holmes steers Watson back to Lusk's office.
const ACT_SAFETY_NETS: ActSafetyNet[] = [
  {
    act: 5,
    requiresNpcPresent: 'holmes',
    when: s => !s.inventory.includes(TAKEABLE_OBJECTS['from_hell_letter']),
    instruction: 'Watson never copied the From Hell letter. Holmes notes, with mild impatience, that a comparison wants both documents — and the letter still sits in Lusk\'s office. He suggests Watson return there and take the text down word for word. Do not say what the comparison will reveal.',
  },
];

export const WHITECHAPEL_MANIFEST: StoryManifest = {
  id: 'whitechapel-1888',

  locations: LOCATIONS,
  npcs: NPCS,
  npcAliases: NPC_ALIASES,
  npcDisplayNames: NPC_DISPLAY_NAMES,
  objectDisplayNames: OBJECT_DISPLAY_NAMES,
  clueDefinitions: CLUE_DEFINITIONS,
  clueTriggers: CLUE_TRIGGERS,
  atmosphericNotes: ATMOSPHERIC_NOTES,
  takeableObjects: TAKEABLE_OBJECTS,
  useInteractions: USE_INTERACTIONS,
  showInteractions: SHOW_INTERACTIONS,
  useCombinations: USE_COMBINATIONS,
  documentText: DOCUMENT_TEXT,

  actNames: ACT_NAMES,
  actProgression: ACT_PROGRESSION,
  actAnchors: ACT_ANCHORS,
  actTimeConfig: ACT_TIME_CONFIG,
  actWeather: ACT_WEATHER,

  deductionThreshold: DEDUCTION_THRESHOLD,
  suspectProfiles: SUSPECT_PROFILES,
  personsOfInterest: PERSONS_OF_INTEREST,

  selectHint,
  hintObjectives: OBJECTIVES,
  diaryLeads: { isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags },

  facts: FACTS,

  // The smoking-gun clue (the 'prasarved' misspelling in Edmund's forensic note)
  smokingGunClueId: 'clue_06_prasarved_spelling',
  convergenceFlag: 'used_edmund_forensic_note_with_from_hell_letter',
  playerNpcId: 'watson',

  companionDemeanors: COMPANION_DEMEANORS,
  actSafetyNets: ACT_SAFETY_NETS,
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: exit 0. If a manifest field's type mismatches its table, fix the `StoryManifest` field type in `stories/types.ts` to match the real table type (the data is the ground truth; do NOT reshape data).

- [ ] **Step 3: Verify the client build is unaffected**

Run: `npm run build`
Expected: builds clean (guards the ESM/server-graph constraint — nothing here should enter the server graph, this confirms no surprise).

- [ ] **Step 4: Commit**

```bash
git add engine/stories/whitechapel-1888/manifest.ts
git commit -m "feat: compose WHITECHAPEL_MANIFEST story object

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: GameEngine goes manifest-driven (mechanical injection)

**Files:**
- Modify: `engine/GameEngine.ts`
- Modify: `hooks/useGameState.ts` (ONLY the `getPresentNpcIds` call site, line ~64, plus its import line)
- Modify: `scripts/qa-parser.ts` (ONLY the `getPresentNpcIds` call site, line ~211)

**Interfaces:**
- Consumes: `WHITECHAPEL_MANIFEST` from Task 2; `StoryManifest`, `SessionView`, `NPCDefinition` from Task 1.
- Produces: `class GameEngine { constructor(private readonly story: StoryManifest) {} }`; singleton `export const gameEngine = new GameEngine(WHITECHAPEL_MANIFEST)`; `getPresentNpcIds(npcs: Record<string, NPCDefinition>, locationId: string, npcStates: Record<string, NPCState>, currentAct: number): string[]` (new first parameter). Task 4 assumes `this.story` exists inside the class.

This task is purely mechanical — no behavior blocks change. The special-case blocks (Edmund/Holmes/act-5) survive verbatim here, just reading `this.story.X`; Task 4 replaces them.

- [ ] **Step 1: Replace the story imports at the top of `GameEngine.ts`**

Delete the `gameData` named-import block (lines ~15–37), the `selectHint` import (~38), and the `FACTS` import (~39). Keep `deriveKnowledgeEnvelope` from `./stories/knowledge` (story-generic engine helper). Add:

```ts
import type { StoryManifest, NPCDefinition } from './stories/types';
import { WHITECHAPEL_MANIFEST } from './stories/whitechapel-1888/manifest';
```

Note: `ClueDefinition` was imported from `./gameData` — re-import it as `import type { ClueDefinition } from './stories/types';` if `GameEngine.ts` references it (it does, for `newClueDefs`).

- [ ] **Step 2: Add the constructor and swap every table reference**

```ts
export class GameEngine {
  constructor(private readonly story: StoryManifest) {}
  ...
```

Then apply this mechanical mapping across the whole file (inside class methods → `this.story.X`; there are no module-level uses left after Step 3):

| Old identifier | New expression |
|---|---|
| `LOCATIONS` | `this.story.locations` |
| `NPCS` | `this.story.npcs` |
| `NPC_ALIASES` | `this.story.npcAliases` |
| `NPC_DISPLAY_NAMES` | `this.story.npcDisplayNames` |
| `OBJECT_DISPLAY_NAMES` | `this.story.objectDisplayNames` |
| `CLUE_DEFINITIONS` | `this.story.clueDefinitions` |
| `CLUE_TRIGGERS` | `this.story.clueTriggers` |
| `ATMOSPHERIC_NOTES` | `this.story.atmosphericNotes` |
| `TAKEABLE_OBJECTS` | `this.story.takeableObjects` |
| `USE_INTERACTIONS` | `this.story.useInteractions` |
| `SHOW_INTERACTIONS` | `this.story.showInteractions` |
| `USE_COMBINATIONS` | `this.story.useCombinations` |
| `DOCUMENT_TEXT` | `this.story.documentText` |
| `ACT_NAMES` | `this.story.actNames` |
| `ACT_PROGRESSION` | `this.story.actProgression` |
| `ACT_ANCHORS` | `this.story.actAnchors` |
| `ACT_TIME_CONFIG` | `this.story.actTimeConfig` |
| `ACT_WEATHER` | `this.story.actWeather` |
| `DEDUCTION_THRESHOLD` | `this.story.deductionThreshold` |
| `SUSPECT_PROFILES` | `this.story.suspectProfiles` |
| `PERSONS_OF_INTEREST` | `this.story.personsOfInterest` |
| `selectHint(` | `this.story.selectHint(` |
| `FACTS` (deriveKnowledgeEnvelope arg, ~1360) | `this.story.facts` |
| `const SMOKING_GUN_CLUE = 'clue_06_prasarved_spelling'` (~972) | delete the const; use `this.story.smokingGunClueId` at its use sites. Also reword the explanatory comment above it (lines ~969–971) so it no longer names the clue — e.g. "The smoking-gun clue (see the manifest's smokingGunClueId) must be discovered before Holmes commits to a name." — the Task 4 grep gate checks that `prasarved` no longer appears anywhere in this file |

- [ ] **Step 3: Give `getPresentNpcIds` an explicit `npcs` parameter**

It's a module-level export used by `useGameState.ts` and `scripts/qa-parser.ts`, so it can't read `this.story`:

```ts
export function getPresentNpcIds(
  npcs: Record<string, NPCDefinition>,
  locationId: string,
  npcStates: Record<string, NPCState>,
  currentAct: number,
): string[] {
  return Object.keys(npcs).filter(npcId => {
    const state = npcStates[npcId];
    const npcLoc = state?.currentLocation ?? npcs[npcId]?.canonicalLocationByAct[currentAct];
    return npcLoc === locationId && state?.status !== 'deceased';
  });
}
```

Update the internal call (~1226): `getPresentNpcIds(this.story.npcs, locationId, resolvedNpcStates, session.currentAct)`.

- [ ] **Step 4: Construct the singleton with the manifest**

At the bottom of `GameEngine.ts` (this import + construction is the single sanctioned story reference in the engine layer):

```ts
// Singleton export — the one place the active story is bound to the engine.
export const gameEngine = new GameEngine(WHITECHAPEL_MANIFEST);
```

- [ ] **Step 5: Update the two external `getPresentNpcIds` callers**

`hooks/useGameState.ts` — add the manifest import and pass `npcs`:

```ts
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';
```
```ts
    const presentNpcIds = getPresentNpcIds(WHITECHAPEL_MANIFEST.npcs, location, npcStates, currentAct);
```

`scripts/qa-parser.ts` (~211) — same pattern:

```ts
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';
```
```ts
  return getPresentNpcIds(WHITECHAPEL_MANIFEST.npcs, scene.location, {}, scene.act).map(id => {
```

- [ ] **Step 6: Typecheck, then run engine + parser QA**

Run: `npm run lint && npm run qa:engine && npm run qa:parser`
Expected: lint exit 0; both suites match baseline pass counts exactly. Any behavioral diff here means a reference was mis-mapped — diff against baseline output to locate it.

- [ ] **Step 7: Run the remaining suites**

Run: `npm run qa:validate && npm run qa:hints && npm run qa:diary-leads`
Expected: match baseline.

- [ ] **Step 8: Commit**

```bash
git add engine/GameEngine.ts hooks/useGameState.ts scripts/qa-parser.ts
git commit -m "refactor: inject StoryManifest into GameEngine; drop scattered story imports

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Special-cases become manifest data

**Files:**
- Modify: `engine/GameEngine.ts` (three blocks: ~1258–1268 safety net, ~1284–1292 demeanor, introduction logic at ~1337–1390)
- Modify: `engine/stories/whitechapel-1888/npcs.ts` (Edmund's entry, ~line 157)

**Interfaces:**
- Consumes: `this.story.actSafetyNets`, `this.story.companionDemeanors` (Task 2 data), `NPCIntroduction` on `NPCDefinition` (Task 1), `SessionView` (Task 1 — `SessionSnapshot` satisfies it structurally).
- Produces: no new exports; identical `EngineResult` output for every input (parity).

- [ ] **Step 1: Give Edmund a document introduction in `npcs.ts`**

In Edmund's `NPCDefinition` (the entry with `alias: "Bond's assistant"`), directly under `requiresIntroduction: true,`:

```ts
    requiresIntroduction: true,
    // Edmund never self-introduces — his name is revealed when the player
    // examines his forensic note (the 'prasarved' document).
    introduction: { type: 'document', objectId: 'edmund_forensic_note' },
```

- [ ] **Step 2: Replace the act-5 safety-net block with a generic loop**

Delete the hardcoded block at ~1258–1268 (`if (session.currentAct === 5 && !session.inventory.includes(...from_hell_letter...) && npcsPresent.some(n => n.npcId === 'holmes'))`). In its place:

```ts
    // Act safety nets — story-authored failure-path nudges. Fire when the
    // act matches, the named NPC is present, and the condition holds.
    for (const net of this.story.actSafetyNets) {
      if (net.act !== session.currentAct) continue;
      if (!net.when(session)) continue;
      const present = npcsPresent.find(n => n.npcId === net.requiresNpcPresent);
      if (!present) continue;
      npcScriptedLines.push({ npcId: present.npcId, label: present.label, instruction: net.instruction });
    }
```

- [ ] **Step 3: Replace the Holmes demeanor block with a generic loop**

Delete the hardcoded block at ~1284–1292 (`if (npcsPresent.some(n => n.npcId === 'holmes') && outcome.targetNpcId !== 'holmes') { ... }` including the `clueCount`/`convergenceDone`/`demeanor` locals). In its place:

```ts
    // Companion case-state demeanor — derived, no new state. First matching
    // variant wins; injected only when the NPC is present and not interviewed.
    for (const cd of this.story.companionDemeanors) {
      if (outcome.targetNpcId === cd.npcId) continue;
      const present = npcsPresent.find(n => n.npcId === cd.npcId);
      if (!present) continue;
      const variant = cd.variants.find(v => v.when(session));
      if (variant) {
        npcScriptedLines.push({ npcId: cd.npcId, label: present.label, instruction: `Demeanor note: ${variant.text}` });
      }
    }
```

Parity note: the old code labels the line with the literal `'Sherlock Holmes'`; the new code uses `present.label`. For Holmes these are identical (`requiresIntroduction: false`, so his label is always his display name). Verify in Step 6.

- [ ] **Step 4: Replace the Edmund introduction special-cases**

Three sites, one shared rule. Add a tiny private helper to the class:

```ts
  /** An NPC's introduction mode; absent = self-introduces on first TALK. */
  private introductionOf(npc: NPCDefinition): { type: 'self' } | { type: 'document'; objectId: string } {
    return npc.introduction ?? { type: 'self' };
  }
```

Site A — `introducingThisTurn` (~1345): replace

```ts
      const introducingThisTurn = !!npc.requiresIntroduction &&
        !session.introducedNpcs.includes(outcome.targetNpcId) &&
        outcome.targetNpcId !== 'edmund';
```

with

```ts
      const introducingThisTurn = !!npc.requiresIntroduction &&
        !session.introducedNpcs.includes(outcome.targetNpcId) &&
        this.introductionOf(npc).type === 'self';
```

Site B — talk-introduction flag (~1377–1383): replace

```ts
      if (npc?.requiresIntroduction &&
          !session.introducedNpcs.includes(outcome.targetNpcId) &&
          outcome.targetNpcId !== 'edmund') {
```

with

```ts
      if (npc?.requiresIntroduction &&
          !session.introducedNpcs.includes(outcome.targetNpcId) &&
          this.introductionOf(npc).type === 'self') {
```

Site C — document-introduction (~1385–1388): replace

```ts
    // Edmund's name is revealed when the player examines his forensic note
    if (intent.targetId === 'edmund_forensic_note' &&
        !session.introducedNpcs.includes('edmund')) {
      introductionFlagsUpdate['npc_introduced_edmund'] = true;
    }
```

with

```ts
    // Document-introduced NPCs: examining their introduction object reveals the name
    if (intent.targetId) {
      for (const [npcId, npcDef] of Object.entries(this.story.npcs)) {
        const intro = this.introductionOf(npcDef);
        if (intro.type === 'document' &&
            intro.objectId === intent.targetId &&
            !session.introducedNpcs.includes(npcId)) {
          introductionFlagsUpdate[`npc_introduced_${npcId}`] = true;
        }
      }
    }
```

Update the stale comment above the `introductionFlagsUpdate` block ("Document-based introductions are handled by examine (see clue_06 / edmund_forensic_note)") to: "Document-based introductions are handled by the examine check below."

- [ ] **Step 5: Grep the engine for leftover hardcoded ids**

Run: `grep -n "'edmund'\|'holmes'\|from_hell_letter\|prasarved" engine/GameEngine.ts`
Expected: zero hits. (`'watson'` remains — the `followsNpcId` convention was declared out of this task's scope; it stays.)

- [ ] **Step 6: Full parity check**

Run: `npm run lint && npm run qa:validate && npm run qa:engine && npm run qa:parser && npm run qa:hints && npm run qa:diary-leads`
Expected: everything matches baseline. `qa:engine` exercises Edmund's introduction path and act progression — pay attention to its output specifically.

- [ ] **Step 7: Commit**

```bash
git add engine/GameEngine.ts engine/stories/whitechapel-1888/npcs.ts
git commit -m "refactor: drive NPC introductions, companion demeanor, and act safety nets from story data

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: useGameState reads hints/diaryLeads off the manifest

**Files:**
- Modify: `hooks/useGameState.ts` (lines ~22–23 deep imports and their use sites)

**Interfaces:**
- Consumes: `WHITECHAPEL_MANIFEST.selectHint`, `.diaryLeads.{isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags}` (import already added in Task 3).
- Produces: no export changes; hook behavior identical.

- [ ] **Step 1: Remove the deep imports**

Delete:

```ts
import { selectHint } from '../engine/stories/whitechapel-1888/hints';
import { isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags } from '../engine/stories/whitechapel-1888/diaryLeads';
```

Replace with local destructuring off the manifest (keeps every call site untouched):

```ts
const { selectHint } = WHITECHAPEL_MANIFEST;
const { isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags } = WHITECHAPEL_MANIFEST.diaryLeads;
```

Place these right after the import block. (If `LeadContext` is imported as a type from diaryLeads anywhere in the file, point that type import at `../engine/stories/types` instead.)

- [ ] **Step 2: Verify the grep gate**

Run: `grep -n "whitechapel-1888" engine/GameEngine.ts engine/intentParser.ts hooks/useGameState.ts`
Expected: exactly two hits — the manifest import in `GameEngine.ts` and the manifest import in `useGameState.ts`. Nothing else.

- [ ] **Step 3: Typecheck + full QA**

Run: `npm run lint && npm run qa:validate && npm run qa:engine && npm run qa:parser && npm run qa:hints && npm run qa:diary-leads`
Expected: match baseline.

- [ ] **Step 4: Commit**

```bash
git add hooks/useGameState.ts
git commit -m "refactor: useGameState consumes hints and diary leads via the story manifest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: qa:validate checks for the new manifest fields

**Files:**
- Modify: `scripts/qa-validate.ts`

**Interfaces:**
- Consumes: `WHITECHAPEL_MANIFEST` from Task 2; the script's existing `pass`/`fail`/`warn`/`section` helpers and `npcIds`/`allObjectIds` lookup sets.
- Produces: three new validator sections; exit 1 on any new FAIL.

- [ ] **Step 1: Import the manifest**

Add to the import block at the top of `scripts/qa-validate.ts`:

```ts
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';
```

- [ ] **Step 2: Add the checks**

Append a new section after the existing checks, before the summary/exit code (follow the file's existing section style):

```ts
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
```

- [ ] **Step 3: Prove the checks can fail (then revert)**

Temporarily change Edmund's `introduction.objectId` in `npcs.ts` to `'edmund_forensic_note_TYPO'`, run `npm run qa:validate`, and confirm it exits 1 with the new FAIL line. **Revert the typo immediately** (`git checkout -- engine/stories/whitechapel-1888/npcs.ts`).

- [ ] **Step 4: Run the full suite green**

Run: `npm run lint && npm run qa:validate && npm run qa:engine && npm run qa:parser && npm run qa:hints && npm run qa:diary-leads && npm run build`
Expected: all pass; validator shows the new PASS lines.

- [ ] **Step 5: Commit**

```bash
git add scripts/qa-validate.ts
git commit -m "feat: qa:validate checks manifest introduction/demeanor/safety-net integrity

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final acceptance (whole plan)

- [ ] All five QA suites + lint + build pass, output matching baseline (plus the new validator PASS lines).
- [ ] Grep gate holds: `grep -n "whitechapel-1888" engine/GameEngine.ts engine/intentParser.ts hooks/useGameState.ts` → exactly the two manifest imports.
- [ ] `grep -n "'edmund'\|'holmes'\|prasarved\|from_hell_letter" engine/GameEngine.ts` → zero hits.
- [ ] `engine/intentParser.ts` untouched (`git diff main -- engine/intentParser.ts` is empty).
- [ ] Post-merge (not part of this branch): ENGINE status light green in production.
