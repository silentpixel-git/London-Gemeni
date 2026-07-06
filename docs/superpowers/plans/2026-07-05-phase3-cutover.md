# Phase 3 Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Phase 3 tool-calling parse fallback the production default (kill switch `VITE_AI_PARSER='off'`), delete the legacy `resolveTargetWithAI`/`resolveTarget` path across all four layers, and re-route qa:parser's AI recovery passes through the production path.

**Architecture:** Pure cutover — no new capability. The flag inverts from opt-in to opt-out in `hooks/useGameState.ts`; the legacy examine/talk-only fallback (hook function → client service method → gateway op → server method) is deleted; `scripts/qa-parser.ts`'s hybrid and NPC tier-2 passes switch from the deleted op to `buildParseCandidates` + `aiService.parseAction`, so the corpus measures the path players actually hit.

**Tech Stack:** React/Vite/TypeScript, Vercel serverless gateway (`api/ai.ts`), Gemini via `@google/genai`, tsx QA scripts.

**Spec:** `docs/superpowers/specs/2026-07-05-phase3-cutover-design.md`

## Global Constraints

- Kill-switch semantics: `AI_PARSER_ENABLED = (import.meta.env.VITE_AI_PARSER ?? '') !== 'off'` — unset means ON.
- Regression gates keep their floors, verbatim: object `GATE = 0.75`, NPC tier-1 `NPC_GATE = 0.90`, tool-call `TC_GATE = 0.75`. This branch may not lower any bar.
- `engine/intentParser.ts`: orphan cleanup only. `unresolved_target` stays (`needsAiParse` and the engine consume it). Expected: file untouched.
- Every commit compiles and passes `npm run lint` — task order is chosen so no commit leaves a dangling reference.
- Commit messages end with `(Phase 3 cutover)`.
- Working branch: current worktree branch (`claude/lucid-curran-d2d338`).

---

### Task 1: Client cutover — flag inversion + delete `resolveTargetWithAI`

**Files:**
- Modify: `hooks/useGameState.ts` (imports at 19 and 24; delete lines 42–126; rewrite comment+flag at 128–135; turn-loop branch at ~1160–1167)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `resolveIntentWithAI` (already defined in the same file, unchanged).
- Produces: `AI_PARSER_ENABLED` with inverted semantics. `aiService.resolveTargetObject` loses its last caller (still compiles; deleted in Task 3).

- [ ] **Step 1: Trim the two import lines**

Line 19, remove `timePeriodFor, getPresentNpcIds` (only `resolveTargetWithAI` used them):

```ts
import { gameEngine, SessionSnapshot, computeTimePeriod } from '../engine/GameEngine';
```

Line 24, remove `OBJECT_DISPLAY_NAMES, TAKEABLE_OBJECTS, NPCS` (same reason — `NPC_DISPLAY_NAMES` from `../constants` is a different symbol and stays):

```ts
import { LOCATIONS, CLUE_DEFINITIONS, ACT_NAMES, ACT_BRIDGES, ACT_TIME_CONFIG, ACT_WEATHER, TRUE_ENDING_CODA, ITEM_SPENT_AFTER_ACT, DECISION_BY_FLAG, LOCATION_DIARY, formatGameClock } from '../engine/gameData';
```

(`LOCATIONS` stays — used at ~line 947.)

- [ ] **Step 2: Delete the legacy fallback block (lines 42–126)**

Delete everything from the comment line `// ── AI fallback target resolution ─────...` down to (and including) the closing `}` of `resolveTargetWithAI` — the comment block, `const targetResolveCache = new Map<...>();`, and the whole function. The next surviving line is the `// ── Phase 3: tool-calling parse fallback ──...` comment.

- [ ] **Step 3: Rewrite the flag block**

Replace the comment + flag (old lines 128–135):

```ts
// ── AI parse fallback (Phase 3, default-on) ──────────────────────────────────
// When the deterministic parse misses, route the WHOLE input through the
// constrained parseAction op — every verb. Kill switch: VITE_AI_PARSER='off'
// disables it (pure regex parsing; misses stay in-character engine misses —
// same degraded mode as a Gemini outage, since parseAction returns null on
// any failure and the turn keeps the regex intent).
// Plain (non-optional-chained) access: Vite's define replaces the exact token
// `import.meta.env.VITE_AI_PARSER`, same pattern as supabase.ts.
const AI_PARSER_ENABLED = (import.meta.env.VITE_AI_PARSER ?? '') !== 'off';
```

- [ ] **Step 4: Collapse the turn-loop branch**

Replace (old lines ~1160–1167):

```ts
      // STEP 2.5: AI fallback — only when the deterministic parse missed a target.
      // Resolves a natural-language/paraphrased object (examine) or person (talk)
      // against THIS location's entities so the engine can fire. No-op (and no
      // latency) on hits. With VITE_AI_PARSER='on', the Phase 3 tool-calling parse
      // handles ALL miss types instead.
      intent = AI_PARSER_ENABLED
        ? await resolveIntentWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs, elapsedMinutes)
        : await resolveTargetWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs, elapsedMinutes);
```

with:

```ts
      // STEP 2.5: AI parse fallback — only when the deterministic parse missed.
      // Resolves the whole input against THIS location's candidates so the
      // engine can fire. No-op (and no latency) on hits. VITE_AI_PARSER='off'
      // is the emergency kill switch (regex-only parsing).
      if (AI_PARSER_ENABLED) {
        intent = await resolveIntentWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs, elapsedMinutes);
      }
```

- [ ] **Step 5: Document the kill switch in `.env.example`**

Append:

```
# AI parse fallback kill switch (Phase 3). Unset or any other value = ON.
# Set to 'off' for pure regex parsing (emergency rollback, no code revert).
VITE_AI_PARSER=
```

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run qa:validate && npm run qa:engine && npm run build`
Expected: all green; no unused-symbol warnings for the trimmed imports; build succeeds (the `vite.config.ts` define line is untouched).

- [ ] **Step 7: Commit**

```bash
git add hooks/useGameState.ts .env.example
git commit -m "feat: AI parse fallback default-on with VITE_AI_PARSER=off kill switch (Phase 3 cutover)"
```

---

### Task 2: qa:parser recovery passes route through `parseAction`

**Files:**
- Modify: `scripts/qa-parser.ts` (header comment ~14–16; imports 24–25 and 23; delete `npcCandidatesFor` ~212–223 and `candidatesFor` ~225–230; hybrid pass ~542–563; NPC tier-2 ~588–604)

**Interfaces:**
- Consumes: `buildParseCandidates(location, inventory, npcStates, currentAct, introducedNpcs, elapsedMinutes): ParseCandidates` from `engine/parseFallback` (already imported at line 28); `aiService.parseAction(rawInput, candidates): Promise<ToolCallOutcome>` from `server/aiCore` (already dynamically imported by the tool-call pass).
- Produces: a qa:parser whose every live Gemini call goes through the production `parseAction` path. Server `resolveTargetObject` loses its last caller (deleted in Task 3).

- [ ] **Step 1: Update the header comment**

Replace (lines ~14–16):

```ts
 *   Hybrid pass — only when GEMINI_API_KEY is set. Routes the deterministic MISSES
 *   through aiService.resolveTargetObject() (constrained to the object's location)
 *   and reports the combined lift.
```

with:

```ts
 *   Hybrid pass — only when GEMINI_API_KEY is set. Routes the deterministic MISSES
 *   through aiService.parseAction() (the production tool-calling fallback, with
 *   candidates scoped to the object's location) and reports the combined lift.
```

- [ ] **Step 2: Delete the two candidate helpers and trim imports**

Delete `npcCandidatesFor` (the function and its two comment lines, ~212–223) and `candidatesFor` (function and its comment line, ~225–230) — both passes now use `buildParseCandidates`.

Then trim imports:
- Delete line 24 entirely: `import { getPresentNpcIds, timePeriodFor } from '../engine/GameEngine';` (only `npcCandidatesFor` used them).
- Delete line 25 entirely: `import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';` (same).
- Line 23 becomes (drop `OBJECT_DISPLAY_NAMES`, keep `LOCATIONS` — used at ~278 and by the new hybrid pass — and `NPCS` — used at ~282):

```ts
import { LOCATIONS, NPCS } from '../engine/gameData';
```

- [ ] **Step 3: Rewrite the hybrid pass**

Replace the loop body inside `if (process.env.GEMINI_API_KEY) {` in the hybrid pass (the block starting `console.log('\n=== HYBRID PASS ...`):

```ts
    console.log('\n=== HYBRID PASS (parseAction fallback on deterministic misses) ===\n');
    const { aiService } = await import('../server/aiCore');
    let recovered = 0;
    for (const m of misses) {
      try {
        const act = (LOCATIONS as Record<string, { act?: number }>)[m.locId]?.act ?? 0;
        const { intent } = await aiService.parseAction(
          `examine ${m.text}`,
          buildParseCandidates(m.locId, [], {}, act, [], 0),
        );
        const got = intent?.targetId ?? null;
        const ok = got === m.objectId;
        if (ok) recovered++;
        console.log(`  [${ok ? 'OK ' : '   '}] "examine ${m.text}" → ${got ?? 'null'} (want ${m.objectId})`);
      } catch (e) {
        console.log(`  [ERR] "examine ${m.text}" → ${(e as Error).message}`);
      }
    }
```

(The `recovered`/`hybridHit` summary lines after the loop are unchanged. The success check is targetId equality, verb-agnostic — the same metric the old objectId check measured.)

- [ ] **Step 4: Rewrite the NPC tier-2 pass**

Replace the loop body inside the tier-2 `if (process.env.GEMINI_API_KEY) {` block:

```ts
    console.log('\n  Tier-2 (parseAction fallback) on paraphrases:');
    const { aiService } = await import('../server/aiCore');
    let npcRecovered = 0;
    for (const m of npcParaMisses) {
      try {
        const { intent } = await aiService.parseAction(
          `talk to ${m.text}`,
          buildParseCandidates(m.scene.location, [], {}, m.scene.act, [], 0),
        );
        const got = intent?.targetId ?? null;
        const ok = got === m.npcId;
        if (ok) npcRecovered++;
        console.log(`    [${ok ? 'OK ' : '   '}] "talk to ${m.text}" → ${got ?? 'none'} (want ${m.npcId})`);
      } catch (e) {
        console.log(`    [ERR] "talk to ${m.text}" → ${(e as Error).message}`);
      }
    }
    console.log(`    Recovered ${npcRecovered}/${npcParaMisses.length} NPC paraphrases via AI.`);
```

Note `buildParseCandidates` alias-masks unintroduced NPCs internally (same as production), replacing what `npcCandidatesFor` did by hand.

- [ ] **Step 5: Verify offline**

Run: `npm run lint && npx tsx scripts/qa-parser.ts`
Expected (no `GEMINI_API_KEY` in the worktree env): deterministic pass ≥ 75%, NPC tier-1 ≥ 90%, offline intent fixtures 100%, the three "(Set GEMINI_API_KEY ...)" skip lines print, exit 0. The live passes are exercised in Task 4.

- [ ] **Step 6: Commit**

```bash
git add scripts/qa-parser.ts
git commit -m "refactor: qa:parser recovery passes route through parseAction (Phase 3 cutover)"
```

---

### Task 3: Delete the `resolveTarget` op end-to-end + comment hygiene

**Files:**
- Modify: `api/ai.ts` (ops list line 14; `case 'resolveTarget'` ~85–93)
- Modify: `server/aiCore.ts` (header ~19–24; delete `resolveTargetObject` + docblock ~775–824; `parseAction` docblock ~826–832)
- Modify: `services/AIService.ts` (delete `resolveTargetObject` + docblock ~147–169)
- Modify: `engine/parseFallback.ts` (docblock lines ~24 and ~51)

**Interfaces:**
- Consumes: nothing — Tasks 1 and 2 removed every caller.
- Produces: `resolveTargetObject`/`'resolveTarget'` gone from the codebase; `parseAction` is the only constrained-parse surface.

- [ ] **Step 1: `api/ai.ts`**

Delete line 14 from the header ops list:

```ts
 * - resolveTarget → { objectId }
```

Delete the whole case (~85–93):

```ts
      case 'resolveTarget':
        return Response.json(
          await aiService.resolveTargetObject(
            body.rawInput as never,
            body.intentType as never,
            body.candidates as never,
            body.entityNoun as never,
          ),
        );
```

(An unknown op already falls through to the 400 `Unknown op` default — stale clients degrade safely.)

- [ ] **Step 2: `server/aiCore.ts`**

Replace the header exception paragraph (~19–24):

```ts
 * One narrow exception to "narration-only": resolveTargetObject() is a CONSTRAINED
 * target resolver. It maps a player's noun to one object id chosen from a SUPPLIED
 * list (the objects in the current location). Because it can only return an id from
 * that list (or null), it can never invent an object or grant a clue — the engine
 * still owns every clue and state decision. It returns a selection, never a mutation.
```

with:

```ts
 * One narrow exception to "narration-only": parseAction() is a CONSTRAINED
 * parser. It maps a missed player input to one tool call whose every argument
 * is enum-locked to SUPPLIED candidate lists (this location's objects, people,
 * exits). Because it can only select from those lists (or return null), it can
 * never invent an entity or grant a clue — the engine still owns every clue
 * and state decision. It returns a selection, never a mutation.
```

Delete the `resolveTargetObject` method and its docblock (from `/**\n * Constrained target resolver (NOT narration)...` through the method's closing `}` at ~824).

Replace the `parseAction` docblock (~826–832):

```ts
  /**
   * Phase 3 tool-calling parse (NOT narration) — the same constrained contract
   * as resolveTargetObject, generalised to every verb. Maps a missed player
   * input to one validated ParsedIntent via forced function calling; every
   * argument is enum-locked to the client-supplied candidate lists and
   * re-validated in toolCallToIntent. Never throws into the turn loop.
   */
```

with:

```ts
  /**
   * Tool-calling parse (NOT narration) — maps a missed player input to one
   * validated ParsedIntent via forced function calling; every argument is
   * enum-locked to the client-supplied candidate lists and re-validated in
   * toolCallToIntent. Never throws into the turn loop.
   */
```

- [ ] **Step 3: `services/AIService.ts`**

Delete the `resolveTargetObject` method and its docblock (from `/**\n   * Constrained target resolver (NOT narration)...` through the method's closing `}`). The `parseAction` method below it is untouched.

- [ ] **Step 4: `engine/parseFallback.ts` comment updates**

In the `needsAiParse` docblock, replace:

```ts
 * Mirrors (and supersets) the miss conditions of resolveTargetWithAI:
 * 'other', 'unresolved_target', verb-with-unresolved-target, and the
 * soft miss (resolved examine target that is neither here nor carried).
```

with:

```ts
 * Misses are: 'other', 'unresolved_target', verb-with-unresolved-target,
 * and the soft miss (resolved examine target that is neither here nor
 * carried).
```

In the `buildParseCandidates` docblock, replace:

```ts
 * Candidate lists for the parseAction op. Spoiler-safe: an unintroduced NPC
 * appears under their alias, never their real name (same masking as
 * resolveTargetWithAI in useGameState).
```

with:

```ts
 * Candidate lists for the parseAction op. Spoiler-safe: an unintroduced NPC
 * appears under their alias, never their real name.
```

- [ ] **Step 5: Verify the symbol is gone, then run the suites**

Run: `grep -rn "resolveTargetObject\|resolveTargetWithAI\|'resolveTarget'" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v docs/`
Expected: no output.

(`engine/stories/types.ts:321` already reads "scaffolding for future phases (Phase 3 did not need them)" — the predecessor spec's rewording request was satisfied by commit 7fb7574; verify-only, no change.)

Run: `npm run lint && npm run qa:validate && npm run qa:engine && npm run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add api/ai.ts server/aiCore.ts services/AIService.ts engine/parseFallback.ts
git commit -m "refactor: delete legacy resolveTarget op across gateway, server, client (Phase 3 cutover)"
```

---

### Task 4: Full verification gate — live corpus, manual smoke, whole-branch review

**Files:**
- None expected (fix-forward only if findings emerge; fixes commit as `fix: ... (Phase 3 cutover)`)

- [ ] **Step 1: Full offline suite**

Run: `npm run lint && npm run qa:validate && npm run qa:engine && npm run qa:narration-inject && npm run qa:hints && npm run qa:diary-leads && npm run build`
Expected: everything green.

- [ ] **Step 2: Live qa:parser run**

Copy the key into the worktree (`.env.local` is gitignored — confirm with `git check-ignore .env.local` before proceeding):

```bash
cp "/Users/silentpixel/Dropbox/Claude Projects/LondonBleeds-Claude/.env.local" .env.local
```

Run: `set -a && source .env.local && set +a && npx tsx scripts/qa-parser.ts`
Expected: object ≥ 75%, NPC tier-1 ≥ 90%, tool-call ≥ 75%, zero enum-validation failures, exit 0. The hybrid and tier-2 recovery lines now print `parseAction`-routed results.

- [ ] **Step 3: Manual smoke — AI parser on (the new default)**

Start the dev server with preview tooling (`.claude/launch.json` entry: `{"name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173}`; the dev gateway middleware needs `GEMINI_API_KEY` from `.env.local`, already copied). `VITE_AI_PARSER` stays unset — that IS the production configuration.

In a guest session: play to any location with interactables and enter a paraphrase the regex parser cannot resolve (e.g. at Baker Street: `read whatever the papers have printed about the murders`). Expected: the input resolves to examining the relevant object (narration engages with it) instead of an "I don't follow" style miss. Check the browser console and server logs for gateway errors: none expected.

- [ ] **Step 4: Manual smoke — kill switch**

Stop the server. Add `VITE_AI_PARSER=off` to the worktree `.env.local`. Restart, repeat the same paraphrase input. Expected: an in-character miss (regex-only mode works; no crash, no gateway call for parsing). Then remove the `VITE_AI_PARSER` line and stop the server.

- [ ] **Step 5: Whole-branch reviews**

Dispatch `engine-logic-reviewer` and `engineering-reviewer` in parallel over the branch diff vs `main` (focus: turn-loop branch collapse in `useGameState.ts`, gateway op removal, qa-parser rework). Fix Critical/Important findings, re-run Step 1, commit fixes as `fix: ... (Phase 3 cutover)`.

- [ ] **Step 6: Post-merge notes (for the session driver, not a commit)**

After merge + Vercel production deploy: one live spot-check (paraphrased input resolves; no gateway errors in Vercel logs). Rollback path if needed: set `VITE_AI_PARSER=off` in Vercel (Production) + redeploy. Update the rebuild-roadmap memory: cutover done, flag-removal cleanup is the only Phase 3 remnant.
