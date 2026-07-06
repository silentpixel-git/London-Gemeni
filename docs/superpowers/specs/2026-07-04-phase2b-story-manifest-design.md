# Phase 2b — StoryManifest + Generic Engine Runtime (Design)

**Date:** 2026-07-04
**Status:** Approved design, pre-implementation
**Roadmap context:** H3 from `docs/London Bleeds — Rebuild-from-Scratch Brainstorm & Improvement Backlog.md`. Follows Phase 2a (fact graph, PR #19). Primary motivation: reduce story/engine coupling so Phase 3 (tool-calling turn loop) can be built without fighting hardcoded Whitechapel special-cases. Multi-story support is a side benefit, not the goal.

## Problem

After 2a, the engine layer still reaches into story content in three ways:

1. **Scattered imports.** `GameEngine.ts` imports ~20 named tables from the `gameData.ts` barrel *plus* deep imports from `stories/whitechapel-1888/hints.ts` and `facts.ts`. `useGameState.ts` deep-imports `hints.ts` and `diaryLeads.ts`. There is no single object that says "this is the story."
2. **Hardcoded story constants.** `SMOKING_GUN_CLUE = 'clue_06_prasarved_spelling'` (GameEngine.ts ~972) and the convergence flag `'used_edmund_forensic_note_with_from_hell_letter'` (~1286) live inline in engine code.
3. **NPC-id-keyed special cases.** Three imperative blocks in `GameEngine.ts` know Whitechapel characters by name:
   - Edmund's document-based introduction (`!== 'edmund'` at ~1347 and ~1380; `edmund_forensic_note` examine check at ~1386).
   - Holmes case-state demeanor block (~1284–1292).
   - Act-5 "never copied the From Hell letter" safety-net nudge (~1258–1268).

Phase 3's new parser/turn path would otherwise have to replicate or route around all of this.

## Design

### 1. `StoryManifest` type

New interface in `engine/stories/types.ts`. One object aggregating everything the engine and game-state hook consume. Data stays TypeScript; tsc remains the schema (consistent with the 2a no-Zod decision). Predicates are plain functions over a narrow session view — no condition DSL.

```ts
export interface StoryManifest {
  id: string;                                   // 'whitechapel-1888'

  // Existing data tables — same objects currently exported, no reshaping
  locations; npcs; npcAliases; clues; clueTriggers; atmosphericNotes;
  takeableObjects; useInteractions; showInteractions; useCombinations;
  documentText; objectDisplayNames; npcDisplayNames; suspectProfiles;
  actNames; actProgression; actAnchors; actTimeConfig; actWeather;
  deductionThreshold; personsOfInterest;

  // Hint + diary systems (currently deep-imported from whitechapel-1888/)
  selectHint;                                   // hints.ts
  hintObjectives;                               // OBJECTIVES from hints.ts
  diaryLeads: {
    isRequiredFlag; clueGateFlag; leadContextFor; detectSilentLeadFlags;
  };

  // Fact graph (2a)
  facts;

  // Story constants currently inlined in GameEngine
  smokingGunClueId: string;                     // 'clue_06_prasarved_spelling'
  convergenceFlag: string;                      // 'used_edmund_forensic_note_with_from_hell_letter'
  playerNpcId: string;                          // 'watson' — the followsNpcId convention

  // Declarative behavior hooks (section 3)
  companionDemeanors: Array<{
    npcId: string;
    variants: Array<{ when: (s: SessionView) => boolean; text: string }>;  // first match wins
  }>;
  actSafetyNets: Array<{
    act: number;
    when: (s: SessionView) => boolean;
    requiresNpcPresent: string;
    instruction: string;
  }>;
}
```

`SessionView` is a read-only subset of `SessionSnapshot` (flags, inventory, discoveredClueIds, currentAct, turnCount — whatever the predicates actually need, kept minimal).

`engine/stories/whitechapel-1888/index.ts` exports `WHITECHAPEL_MANIFEST: StoryManifest`.

### 2. Consumers go manifest-driven

- **GameEngine** receives the manifest via constructor. The singleton construction `export const gameEngine = new GameEngine(WHITECHAPEL_MANIFEST)` is the **single sanctioned story import** in the engine layer — everything else in `GameEngine.ts` reads `this.story.X`; all other named imports from `gameData.ts` and the deep `hints.ts`/`facts.ts` imports are removed.
- **useGameState.ts** drops its deep imports of `hints.ts` and `diaryLeads.ts` and reads the same members off the manifest.
- **gameData.ts barrel stays untouched.** Other consumers (`useGameState`'s table imports, `aiCore.ts`, components) keep working; migrating them off the barrel is not required for 2b. Surgical rule applies.
- **ESM caveat:** if `WHITECHAPEL_MANIFEST` enters the server-side import graph (`api/ai.ts` → `aiCore.ts`), relative imports in the affected files need explicit `.js` extensions (see PR #18 gotcha).

### 3. Special-cases become story data

Three imperative blocks in `GameEngine.ts` become generic mechanisms fed by manifest data. **Identical runtime behavior** — this is a parity refactor.

1. **NPC introduction.** `NPCDefinition` gains:
   ```ts
   introduction?: { type: 'self' } | { type: 'document'; objectId: string };
   ```
   Default (absent) = `self` for NPCs with `requiresIntroduction`. Edmund becomes `{ type: 'document', objectId: 'edmund_forensic_note' }`. The engine's introduction logic becomes: self-introducing NPCs introduce on first TALK; document-introduced NPCs introduce when their `objectId` is examined. All three `'edmund'` literals disappear.

2. **Companion demeanor.** The Holmes demeanor block becomes a loop over `manifest.companionDemeanors`: for each entry whose NPC is present and not the interview target, evaluate `variants` in order, first `when(s)` match wins, push its `text` as a scripted-line instruction. Whitechapel data carries one entry (Holmes) with the existing three variants (convergence-done / ≥3 clues / default) verbatim.

3. **Act safety nets.** The inline Act-5 check becomes a loop over `manifest.actSafetyNets`: for each entry matching the current act, with `requiresNpcPresent` present and `when(s)` true, push `instruction` as a scripted line. Whitechapel data carries one entry (act 5, Holmes present, From Hell letter not in inventory) verbatim.

### Out of scope

- **intentParser alias tables** (location/NPC/object aliases, ~lines 117–380). They serve only the legacy regex parser, which Phase 3 replaces. Not worth abstracting.
- **The Holmes-nudge mechanism** (`shouldFireHolmesNudge`) — already story-generic; only its `selectHint` call moves to `this.story.selectHint`.
- Migrating remaining `gameData.ts` barrel consumers; UI; any behavior change.

## Verification

Parity refactor, verified like 2a:

1. `npm run qa:validate` passes unchanged before and after.
2. Engine regression suite (`qa:*` engine tests) passes unchanged before and after.
3. **New qa:validate checks** for the new fields:
   - every `introduction.objectId` resolves to a real examinable object (interactable / clue trigger);
   - every `companionDemeanors[].npcId` and `actSafetyNets[].requiresNpcPresent` is a real NPC id;
   - every `actSafetyNets[].act` is a valid act number.
4. **Grep gate:** `grep -rn "whitechapel-1888" engine/GameEngine.ts engine/intentParser.ts hooks/useGameState.ts` returns only the sanctioned manifest import sites: the singleton construction in `GameEngine.ts` and (if needed) one manifest import in `useGameState.ts`.
5. Post-merge deploy check: ENGINE status light green in production (guards the ESM-extension gotcha).
