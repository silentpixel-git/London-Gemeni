# Phase 3 — Tool-Calling Parse Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the deterministic parser misses, a constrained Gemini function-call maps the player's free text to one validated `ParsedIntent` — behind the `VITE_AI_PARSER` flag, with the QA corpus as the cutover gate.

**Architecture:** Hybrid fast-path per the approved spec (`docs/superpowers/specs/2026-07-04-phase3-tool-call-parser-design.md`). `parseIntent` (regex) runs first on every input; only on a miss does the client build spoiler-safe candidate lists and call a new `parseAction` gateway op. The server forces one function call whose arguments are enum-locked to those lists, re-validates them, and returns a `ParsedIntent` or `null`. `null` → the turn proceeds with the original regex intent (today's behavior). Engine, narration, and story data are untouched.

**Tech Stack:** TypeScript, React 19 hook orchestration, `@google/genai` ^1.33 function calling (`FunctionCallingConfigMode.ANY`), Vercel serverless gateway (`api/ai.ts`), `tsx` QA scripts.

## Global Constraints

- **Server ESM rule:** any new relative **value** import reachable from `api/ai.ts` or `server/*.ts` needs an explicit `.js` extension (`import { x } from './parseAction.js'`). `import type` is erased and exempt. (Phase 1 gotcha, PR #18.)
- **Engine/AI contract:** `parseAction` returns a *selection* (an intent), never a state mutation. The engine re-validates everything in `resolve()`.
- **Spoiler safety:** an unintroduced NPC's real name must never enter a prompt — candidates use `npc.alias` / `npc.aliasDescription` when `requiresIntroduction && !introducedNpcs.includes(id)`.
- **No player-facing UI** for the flag (restraint principle). `VITE_AI_PARSER === 'on'` is the only switch.
- **`npm run lint`** (`tsc --noEmit`) must pass at the end of every task.
- **qa-parser without an API key must still run:** never add a top-level static import of `server/aiCore.ts` to `scripts/qa-parser.ts` — it constructs the Gemini client. `server/parseAction.ts` (pure, no client) is safe to import statically. Keep the existing `await import('../server/aiCore')` pattern inside `GEMINI_API_KEY` guards.
- **No cutover in this plan.** `resolveTargetWithAI` stays as the flag-off path; `intentParser.ts` is not shrunk. Cutover is a separate later change once the gate criteria in the spec are met.
- Surgical diffs (CLAUDE.md): match surrounding style, touch nothing beyond the listed files.

---

### Task 1: Shared types + pure server module `parseAction.ts` (validation logic, TDD offline)

**Files:**
- Modify: `types.ts` (append after the existing intent-related types near line 160)
- Create: `server/parseAction.ts`
- Test: `scripts/qa-parser.ts` (new offline section)

**Interfaces:**
- Consumes: `IntentType`/`ParsedIntent` (existing), `Type`, `FunctionDeclaration` from `@google/genai`.
- Produces (used by Tasks 2, 3, 5):
  - `types.ts`: `interface ParseCandidateEntry { id: string; name: string }` and `interface ParseCandidates { objects; carried; people; locations: ParseCandidateEntry[] }`
  - `server/parseAction.ts`: `buildParseTools(c: ParseCandidates): FunctionDeclaration[]`, `buildParsePrompt(rawInput: string, c: ParseCandidates): string`, `interface ToolCallOutcome { intent: ParsedIntent | null; invalidArgs: boolean }`, `toolCallToIntent(name: string | undefined, args: Record<string, unknown>, c: ParseCandidates, rawInput: string): ToolCallOutcome`

- [ ] **Step 1: Add the shared candidate types to `types.ts`**

Append near the other intent types (after the `IntentType` union region):

```ts
// Phase 3 — candidate lists for the constrained tool-calling parse fallback.
// Built client-side (spoiler-safe: unintroduced NPCs are alias-masked) and
// enforced server-side: parseAction may only return ids from these lists.
export interface ParseCandidateEntry { id: string; name: string }
export interface ParseCandidates {
  objects: ParseCandidateEntry[];    // present interactables + carried copies (object ids)
  carried: ParseCandidateEntry[];    // subset of objects the player carries (show/drop enums)
  people: ParseCandidateEntry[];     // NPCs present this act, alias-masked if unintroduced
  locations: ParseCandidateEntry[];  // all locations (names are public)
}
```

- [ ] **Step 2: Write the failing offline test — tool-call validation section in `scripts/qa-parser.ts`**

Add these imports at the top of `scripts/qa-parser.ts` (static import of `server/parseAction` is safe — it constructs no client):

```ts
import { toolCallToIntent } from '../server/parseAction';
import type { ParseCandidates } from '../types';
```

Add this function above `main()`, and call `runToolCallValidationChecks();` as the first line inside `main()`:

```ts
// ── Offline validation of the Phase 3 tool-call → intent mapping ──────────────
// No API key needed: feeds synthetic function calls into toolCallToIntent and
// asserts the enum enforcement (an id outside its list must NEVER pass through).
function runToolCallValidationChecks(): void {
  console.log('\n=== TOOL-CALL VALIDATION (offline) ===\n');
  const C: ParseCandidates = {
    objects: [
      { id: 'the_bed', name: 'The Bed' },
      { id: 'from_hell_letter', name: 'From Hell Letter' },
    ],
    carried: [{ id: 'from_hell_letter', name: 'From Hell Letter' }],
    people: [{ id: 'holmes', name: 'Sherlock Holmes — consulting detective' }],
    locations: [{ id: 'baker_street', name: '221B Baker Street' }],
  };
  let failures = 0;
  const check = (label: string, cond: boolean) => {
    console.log(`  [${cond ? 'OK ' : 'FAIL'}] ${label}`);
    if (!cond) failures++;
  };

  let r = toolCallToIntent('examine', { target: 'the_bed' }, C, 'peer beneath the bedframe');
  check('examine valid id → examine intent',
    r.intent?.type === 'examine' && r.intent.targetId === 'the_bed' && !r.invalidArgs);
  r = toolCallToIntent('examine', { target: 'the_window' }, C, 'x');
  check('examine out-of-enum id → null + invalidArgs', r.intent === null && r.invalidArgs);
  r = toolCallToIntent('move', { destination: 'baker_street' }, C, 'go home');
  check('move valid → move intent', r.intent?.type === 'move' && r.intent.targetId === 'baker_street');
  r = toolCallToIntent('move', { destination: 'narnia' }, C, 'x');
  check('move out-of-enum → null + invalidArgs', r.intent === null && r.invalidArgs);
  r = toolCallToIntent('talk', { person: 'holmes' }, C, 'x');
  check('talk valid → talk intent', r.intent?.type === 'talk' && r.intent.targetId === 'holmes');
  r = toolCallToIntent('show', { item: 'from_hell_letter', person: 'holmes' }, C, 'x');
  check('show carried item to person → show intent',
    r.intent?.type === 'show' && r.intent.targetId === 'from_hell_letter' && r.intent.showTargetNpcId === 'holmes');
  r = toolCallToIntent('show', { item: 'the_bed', person: 'holmes' }, C, 'x');
  check('show non-carried item → null + invalidArgs', r.intent === null && r.invalidArgs);
  r = toolCallToIntent('use', { object: 'the_bed' }, C, 'x');
  check('use without second object → use intent', r.intent?.type === 'use' && r.intent.targetId === 'the_bed');
  r = toolCallToIntent('use', { object: 'the_bed', with: 'the_window' }, C, 'x');
  check('use with out-of-enum second object → null + invalidArgs', r.intent === null && r.invalidArgs);
  r = toolCallToIntent('drop', { item: 'from_hell_letter' }, C, 'x');
  check('drop carried item → drop intent', r.intent?.type === 'drop' && r.intent.targetId === 'from_hell_letter');
  r = toolCallToIntent('no_action', { reason: 'question' }, C, 'what hour is it');
  check('no_action(question) → query intent', r.intent?.type === 'query' && !r.invalidArgs);
  r = toolCallToIntent('no_action', { reason: 'atmospheric' }, C, 'the fog is thick');
  check('no_action(atmospheric) → null, NOT invalid', r.intent === null && !r.invalidArgs);
  r = toolCallToIntent('deduce', {}, C, 'i believe it was the assistant');
  check('deduce → deduce intent carrying the raw text',
    r.intent?.type === 'deduce' && r.intent.deductionText === 'i believe it was the assistant');
  r = toolCallToIntent('dance', {}, C, 'x');
  check('unknown tool → null + invalidArgs', r.intent === null && r.invalidArgs);

  if (failures > 0) {
    console.error(`\n[FAIL] ${failures} tool-call validation checks failed.`);
    process.exit(1);
  }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run qa:parser`
Expected: FAIL — `Cannot find module '../server/parseAction'` (tsx module-resolution error before any pass runs).

- [ ] **Step 4: Create `server/parseAction.ts`**

```ts
/**
 * server/parseAction.ts
 *
 * Pure logic for the Phase 3 tool-calling parse fallback: function
 * declarations built from candidate lists, the parse prompt, and validation
 * of the model's tool call back into a ParsedIntent. No Gemini client is
 * constructed here, so qa scripts can import the validators offline; the
 * model call itself lives in server/aiCore.ts (parseAction()).
 *
 * Contract: toolCallToIntent returns a SELECTION (an intent whose every id
 * came verbatim from the supplied candidate lists), never a mutation. An id
 * outside its list is rejected (intent: null, invalidArgs: true) — the QA
 * harness treats any invalidArgs as a hard failure.
 */

import { Type, type FunctionDeclaration } from '@google/genai';
import type { ParseCandidates } from '../types.js';
import type { ParsedIntent } from '../engine/intentParser.js';

const enumParam = (ids: string[], description: string) => ({
  type: Type.STRING,
  enum: ids,
  description,
});

export function buildParseTools(c: ParseCandidates): FunctionDeclaration[] {
  const objectIds = c.objects.map(o => o.id);
  const carriedIds = c.carried.map(o => o.id);
  const peopleIds = c.people.map(p => p.id);
  const locationIds = c.locations.map(l => l.id);
  const decls: FunctionDeclaration[] = [];

  if (locationIds.length > 0) {
    decls.push({
      name: 'move',
      description: 'Walk to another location in London.',
      parameters: {
        type: Type.OBJECT,
        properties: { destination: enumParam(locationIds, 'Where the player wants to go.') },
        required: ['destination'],
      },
    });
  }
  if (objectIds.length > 0) {
    decls.push({
      name: 'examine',
      description: 'Look closely at, search, or investigate an object in this scene or carried.',
      parameters: {
        type: Type.OBJECT,
        properties: { target: enumParam(objectIds, 'The object the player wants to inspect.') },
        required: ['target'],
      },
    });
    decls.push({
      name: 'take',
      description: 'Pick up or pocket an object in this scene.',
      parameters: {
        type: Type.OBJECT,
        properties: { object: enumParam(objectIds, 'The object to take.') },
        required: ['object'],
      },
    });
    decls.push({
      name: 'read',
      description: 'Read the text of a document in this scene or carried.',
      parameters: {
        type: Type.OBJECT,
        properties: { document: enumParam(objectIds, 'The document to read.') },
        required: ['document'],
      },
    });
    decls.push({
      name: 'use',
      description: 'Use or operate an object, optionally together with a second object.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          object: enumParam(objectIds, 'The object to use.'),
          with: enumParam(objectIds, 'Optional second object.'),
        },
        required: ['object'],
      },
    });
  }
  if (peopleIds.length > 0) {
    decls.push({
      name: 'talk',
      description: 'Speak with, question, or approach a person present in this scene.',
      parameters: {
        type: Type.OBJECT,
        properties: { person: enumParam(peopleIds, 'The person to address.') },
        required: ['person'],
      },
    });
  }
  if (carriedIds.length > 0) {
    if (peopleIds.length > 0) {
      decls.push({
        name: 'show',
        description: 'Show or hand a carried item to a person present.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            item: enumParam(carriedIds, 'The carried item to show.'),
            person: enumParam(peopleIds, 'Who to show it to.'),
          },
          required: ['item', 'person'],
        },
      });
    }
    decls.push({
      name: 'drop',
      description: 'Put down or discard a carried item.',
      parameters: {
        type: Type.OBJECT,
        properties: { item: enumParam(carriedIds, 'The carried item to drop.') },
        required: ['item'],
      },
    });
  }
  decls.push({
    name: 'deduce',
    description: "State a theory or accusation about the killer's identity.",
    parameters: { type: Type.OBJECT, properties: {} },
  });
  decls.push({
    name: 'no_action',
    description: 'The input is not a game action: a question about the world, atmospheric musing, or unintelligible.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          enum: ['question', 'atmospheric', 'unintelligible'],
          description: 'Why no action applies.',
        },
      },
      required: ['reason'],
    },
  });
  return decls;
}

export function buildParsePrompt(rawInput: string, c: ParseCandidates): string {
  const list = (xs: Array<{ id: string; name: string }>) =>
    xs.map(x => `- ${x.id} — "${x.name}"`).join('\n') || '(none)';
  return `The player (Dr Watson) typed: "${rawInput}"

People present:
${list(c.people)}

Objects here or carried:
${list(c.objects)}

Carried items:
${list(c.carried)}

Known locations:
${list(c.locations)}

Call exactly one function for what the player is trying to DO. Only match when the meaning genuinely corresponds — if no candidate fits, or the input is a question or pure atmosphere, call no_action.`;
}

export interface ToolCallOutcome {
  intent: ParsedIntent | null;
  // True when the model called an action tool with an id outside its enum
  // (or an unknown tool). The QA harness treats any of these as a hard failure.
  invalidArgs: boolean;
}

export function toolCallToIntent(
  name: string | undefined,
  args: Record<string, unknown>,
  c: ParseCandidates,
  rawInput: string,
): ToolCallOutcome {
  const pick = (xs: Array<{ id: string }>, v: unknown): string | null =>
    typeof v === 'string' && xs.some(x => x.id === v) ? v : null;
  const ok = (intent: ParsedIntent): ToolCallOutcome => ({ intent, invalidArgs: false });
  const invalid: ToolCallOutcome = { intent: null, invalidArgs: true };
  const base = { targetRaw: rawInput, raw: rawInput };

  switch (name) {
    case 'move': {
      const d = pick(c.locations, args.destination);
      return d ? ok({ type: 'move', targetId: d, ...base }) : invalid;
    }
    case 'examine': {
      const t = pick(c.objects, args.target);
      return t ? ok({ type: 'examine', targetId: t, ...base }) : invalid;
    }
    case 'take': {
      const t = pick(c.objects, args.object);
      return t ? ok({ type: 'take', targetId: t, ...base }) : invalid;
    }
    case 'read': {
      const t = pick(c.objects, args.document);
      return t ? ok({ type: 'read', targetId: t, ...base }) : invalid;
    }
    case 'use': {
      const t = pick(c.objects, args.object);
      if (!t) return invalid;
      if (args.with === undefined) return ok({ type: 'use', targetId: t, ...base });
      const w = pick(c.objects, args.with);
      return w ? ok({ type: 'use', targetId: t, useWithTargetId: w, ...base }) : invalid;
    }
    case 'talk': {
      const p = pick(c.people, args.person);
      return p ? ok({ type: 'talk', targetId: p, ...base }) : invalid;
    }
    case 'show': {
      const i = pick(c.carried, args.item);
      const p = pick(c.people, args.person);
      return i && p
        ? ok({ type: 'show', targetId: i, showTargetNpcId: p, ...base })
        : invalid;
    }
    case 'drop': {
      const i = pick(c.carried, args.item);
      return i ? ok({ type: 'drop', targetId: i, ...base }) : invalid;
    }
    case 'deduce':
      return ok({ type: 'deduce', deductionText: rawInput, raw: rawInput });
    case 'no_action':
      return args.reason === 'question'
        ? ok({ type: 'query', targetRaw: rawInput, raw: rawInput })
        : { intent: null, invalidArgs: false };
    default:
      return invalid;
  }
}
```

Note: if `tsc` rejects the `enum` property on the schema literals, add `format: 'enum'` beside each `enum:` — older `@google/genai` typings require it. Do not cast to `any`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run qa:parser`
Expected: the new `TOOL-CALL VALIDATION (offline)` section prints 14 `[OK ]` lines, then the existing deterministic/NPC passes run and their `[PASS]` gates still hold.

Run: `npm run lint`
Expected: clean exit.

- [ ] **Step 6: Commit**

```bash
git add types.ts server/parseAction.ts scripts/qa-parser.ts
git commit -m "feat: tool-call parse validation core (Phase 3) — enum-locked toolCallToIntent"
```

---

### Task 2: Gateway wiring — `parseAction` op end to end

**Files:**
- Modify: `server/aiCore.ts` (imports at top; new method after `resolveTargetObject`, ~line 767; new system-prompt const near `HOLMES_PERSONA_PROMPT`, ~line 45)
- Modify: `api/ai.ts` (header comment op list ~line 10-14; new case after `resolveTarget`, ~line 84)
- Modify: `services/AIService.ts` (imports; new method after `resolveTargetObject`)

**Interfaces:**
- Consumes (Task 1): `buildParseTools`, `buildParsePrompt`, `toolCallToIntent`, `ToolCallOutcome` from `server/parseAction.ts`; `ParseCandidates` from `types.ts`.
- Produces (used by Tasks 4, 5): server `aiService.parseAction(rawInput: string, candidates: ParseCandidates): Promise<ToolCallOutcome>`; client `aiService.parseAction(rawInput: string, candidates: ParseCandidates): Promise<{ intent: ParsedIntent | null }>`; gateway op `{ op: 'parseAction', rawInput, candidates }`.

- [ ] **Step 1: Add the server method to `server/aiCore.ts`**

Extend the existing SDK import (line 26) to:

```ts
import { GoogleGenAI, Type, FunctionCallingConfigMode } from '@google/genai';
```

Add `ParseCandidates` to the existing `../types.js` type import, and below it:

```ts
import { buildParseTools, buildParsePrompt, toolCallToIntent, type ToolCallOutcome } from './parseAction.js';
```

Near `HOLMES_PERSONA_PROMPT`, add:

```ts
// System prompt for the Phase 3 tool-calling parse (constrained, non-narration).
const PARSE_ACTION_SYSTEM =
  "You translate a detective-game player's typed command into exactly one game action by calling a function. " +
  'Choose ids only from the declared parameter enums — never invent one. ' +
  'If the input is a question about the world, call no_action with reason "question". ' +
  'If it is atmospheric musing or not a command, use reason "atmospheric" or "unintelligible". ' +
  "Do not guess wildly: when no candidate genuinely matches the player's meaning, prefer no_action.";
```

Add the method to the `AIService` class directly after `resolveTargetObject`:

```ts
  /**
   * Phase 3 tool-calling parse (NOT narration) — the same constrained contract
   * as resolveTargetObject, generalised to every verb. Maps a missed player
   * input to one validated ParsedIntent via forced function calling; every
   * argument is enum-locked to the client-supplied candidate lists and
   * re-validated in toolCallToIntent. Never throws into the turn loop.
   */
  async parseAction(rawInput: string, candidates: ParseCandidates): Promise<ToolCallOutcome> {
    try {
      const prompt = buildParsePrompt(rawInput, candidates);
      logPromptSize('parseAction', PARSE_ACTION_SYSTEM, prompt);
      const response = await this.ai.models.generateContent({
        model: MODEL_ID,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: PARSE_ACTION_SYSTEM,
          thinkingConfig: { thinkingBudget: 0 },
          tools: [{ functionDeclarations: buildParseTools(candidates) }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
        },
      });
      const call = response.functionCalls?.[0];
      if (!call) return { intent: null, invalidArgs: false };
      return toolCallToIntent(
        call.name,
        (call.args ?? {}) as Record<string, unknown>,
        candidates,
        rawInput,
      );
    } catch {
      return { intent: null, invalidArgs: false };
    }
  }
```

- [ ] **Step 2: Add the gateway case to `api/ai.ts`**

In the header comment op list add:

```
 * - parseAction   → { intent, invalidArgs }
```

After the `resolveTarget` case:

```ts
      case 'parseAction':
        return Response.json(
          await aiService.parseAction(body.rawInput as never, body.candidates as never),
        );
```

- [ ] **Step 3: Add the client method to `services/AIService.ts`**

Add imports:

```ts
import type { ParseCandidates } from '../types';
import type { ParsedIntent } from '../engine/intentParser';
```

Add after `resolveTargetObject`:

```ts
  /**
   * Phase 3 tool-calling parse fallback (NOT narration) — maps a missed player
   * input to one validated ParsedIntent, or null. Never throws into the turn loop.
   */
  async parseAction(
    rawInput: string,
    candidates: ParseCandidates,
  ): Promise<{ intent: ParsedIntent | null }> {
    try {
      return await postJson<{ intent: ParsedIntent | null }>({ op: 'parseAction', rawInput, candidates });
    } catch {
      return { intent: null };
    }
  }
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: clean exit.

- [ ] **Step 5: Live smoke test (only if `GEMINI_API_KEY` is in `.env.local`; otherwise skip — Task 5's gateway tier covers it)**

Start the dev server in the background, then:

```bash
curl -s localhost:3000/api/ai -H 'content-type: application/json' -d '{
  "op": "parseAction",
  "rawInput": "crouch down and look under the sleeping pallet",
  "candidates": {
    "objects": [{"id": "the_bed", "name": "The Bed"}],
    "carried": [],
    "people": [],
    "locations": [{"id": "baker_street", "name": "221B Baker Street"}]
  }
}'
```

Expected: `{"intent":{"type":"examine","targetId":"the_bed",...},"invalidArgs":false}`. Stop the dev server afterwards.

- [ ] **Step 6: Commit**

```bash
git add server/aiCore.ts api/ai.ts services/AIService.ts
git commit -m "feat: parseAction gateway op — forced function-call parse behind /api/ai"
```

---

### Task 3: Client miss-detection + candidate builder (`engine/parseFallback.ts`, TDD offline)

**Files:**
- Create: `engine/parseFallback.ts`
- Test: `scripts/qa-parser.ts` (new fast-path-guard section)

**Interfaces:**
- Consumes: `LOCATIONS`, `NPCS`, `OBJECT_DISPLAY_NAMES`, `TAKEABLE_OBJECTS` from `engine/gameData`; `getPresentNpcIds` from `engine/GameEngine`; `WHITECHAPEL_MANIFEST` from `engine/stories/whitechapel-1888/manifest`; `ParsedIntent`, `ParseCandidates`, `NPCState` types.
- Produces (used by Tasks 4, 5): `needsAiParse(intent: ParsedIntent, location: string, inventory: string[]): boolean` and `buildParseCandidates(location: string, inventory: string[], npcStates: Record<string, NPCState>, currentAct: number, introducedNpcs: string[]): ParseCandidates`.

**Key data fact:** `TAKEABLE_OBJECTS` maps *object id → inventory display string* (e.g. `from_hell_letter → "From Hell Letter (transcript)"`), and `inventory` holds those display strings. "Carried" object ids are recovered by reverse lookup, exactly as `useGameState.ts:99` does.

- [ ] **Step 1: Write the failing test — fast-path guard section in `scripts/qa-parser.ts`**

Add the import:

```ts
import { needsAiParse, buildParseCandidates } from '../engine/parseFallback';
```

Add this function above `main()`, and call `runFastPathGuard();` inside `main()` right after `runToolCallValidationChecks();`:

```ts
// ── Fast-path guard: the free offline path must never silently regress into
// paid AI calls, and the AI path's candidate lists must never leak a spoiler. ─
function runFastPathGuard(): void {
  console.log('\n=== FAST-PATH GUARD (offline) ===\n');
  let failures = 0;

  // 1. Every tier-1 object phrasing that deterministically resolves must NOT
  //    trigger the AI parse (needsAiParse must be false for a clean hit).
  for (const fx of FIXTURES) {
    const locId = OBJECT_LOCATION[fx.objectId];
    for (const p of fx.phrasings) {
      if (p.category === 'paraphrase') continue;
      const intent = parseIntent(`examine ${p.text}`);
      if (intent.targetId === fx.objectId && needsAiParse(intent, locId, [])) {
        console.error(`  [FAIL] clean hit would still call AI: "examine ${p.text}" @ ${locId}`);
        failures++;
      }
    }
  }

  // 2. Misses MUST route: an unrecognised action phrase triggers the AI parse.
  const miss = parseIntent('crouch down and look under the sleeping pallet');
  if (!needsAiParse(miss, 'millers_court', [])) {
    console.error('  [FAIL] unparseable action did not route to the AI parse');
    failures++;
  }

  // 3. World questions never route (queries stay with narration).
  const q = parseIntent('why would the killer strike twice in one night');
  if (q.type !== 'query' || needsAiParse(q, 'baker_street', [])) {
    console.error('  [FAIL] query routed to the AI parse');
    failures++;
  }

  // 4. Spoiler mask: across every location and act, an unintroduced NPC's real
  //    name must never appear in the people candidates.
  for (const locId of Object.keys(LOCATIONS)) {
    for (let act = 0; act <= 6; act++) {
      const c = buildParseCandidates(locId, [], {}, act, []);
      for (const person of c.people) {
        const npc = NPCS[person.id];
        if (npc?.requiresIntroduction && person.name.includes(npc.displayName)) {
          console.error(`  [FAIL] spoiler: ${npc.displayName} unmasked at ${locId} act ${act}`);
          failures++;
        }
      }
    }
  }

  if (failures > 0) {
    console.error(`\n[FAIL] ${failures} fast-path guard checks failed.`);
    process.exit(1);
  }
  console.log('  All fast-path guard checks passed.');
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run qa:parser`
Expected: FAIL — `Cannot find module '../engine/parseFallback'`.

- [ ] **Step 3: Create `engine/parseFallback.ts`**

```ts
/**
 * engine/parseFallback.ts
 *
 * Phase 3 client-side helpers for the tool-calling parse fallback.
 * Pure functions — no fetch, no AI client. Decides WHEN the AI parse fires
 * (needsAiParse) and WHAT it may choose from (buildParseCandidates).
 * The gateway op itself lives in server/parseAction.ts + server/aiCore.ts.
 */

import type { ParsedIntent } from './intentParser';
import type { ParseCandidates, NPCState } from '../types';
import { LOCATIONS, NPCS, OBJECT_DISPLAY_NAMES, TAKEABLE_OBJECTS } from './gameData';
import { getPresentNpcIds } from './GameEngine';
import { WHITECHAPEL_MANIFEST } from './stories/whitechapel-1888/manifest';

// Verb intents that carry a target phrase; a non-empty phrase with no resolved
// id is a miss the AI parse can recover.
const VERBS_NEEDING_TARGET = new Set<ParsedIntent['type']>([
  'move', 'talk', 'take', 'examine', 'use', 'show', 'read', 'drop',
]);

/**
 * Should this regex-parse result be routed through the AI parse?
 * Mirrors (and supersets) the miss conditions of resolveTargetWithAI:
 * 'other', 'unresolved_target', verb-with-unresolved-target, and the
 * soft miss (resolved examine target that is neither here nor carried).
 * Queries never route — world questions belong to narration.
 */
export function needsAiParse(intent: ParsedIntent, location: string, inventory: string[]): boolean {
  if (intent.type === 'other' || intent.type === 'unresolved_target') return true;
  if (
    VERBS_NEEDING_TARGET.has(intent.type) &&
    (intent.targetRaw ?? '').trim() !== '' &&
    !intent.targetId
  ) return true;
  if (intent.type === 'examine' && intent.targetId) {
    const present = LOCATIONS[location]?.interactables ?? [];
    const t = intent.targetId;
    if (
      OBJECT_DISPLAY_NAMES[t] &&
      !present.includes(t) &&
      !(TAKEABLE_OBJECTS[t] && inventory.includes(TAKEABLE_OBJECTS[t]))
    ) return true;
  }
  return false;
}

/**
 * Candidate lists for the parseAction op. Spoiler-safe: an unintroduced NPC
 * appears under their alias, never their real name (same masking as
 * resolveTargetWithAI in useGameState).
 */
export function buildParseCandidates(
  location: string,
  inventory: string[],
  npcStates: Record<string, NPCState>,
  currentAct: number,
  introducedNpcs: string[],
): ParseCandidates {
  const present = LOCATIONS[location]?.interactables ?? [];
  const carriedIds = Object.entries(TAKEABLE_OBJECTS)
    .filter(([, itemName]) => inventory.includes(itemName))
    .map(([objId]) => objId);
  const objectIds = [...new Set([...present, ...carriedIds])];
  const asEntry = (id: string) => ({ id, name: OBJECT_DISPLAY_NAMES[id] ?? id.replace(/_/g, ' ') });

  const people = getPresentNpcIds(WHITECHAPEL_MANIFEST.npcs, location, npcStates, currentAct)
    .map(id => {
      const npc = NPCS[id];
      const introduced = !npc.requiresIntroduction || introducedNpcs.includes(id);
      const name = introduced
        ? `${npc.displayName} — ${npc.role}`
        : `${npc.alias ?? 'a stranger'} — ${npc.aliasDescription ?? npc.role}`;
      return { id, name };
    });

  return {
    objects: objectIds.map(asEntry),
    carried: carriedIds.map(asEntry),
    people,
    locations: Object.entries(LOCATIONS).map(([id, loc]) => ({ id, name: loc.name })),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run qa:parser`
Expected: `All fast-path guard checks passed.` and every pre-existing `[PASS]` gate still green. If guard check 2 fails because the regex parser happens to resolve that phrase, substitute another verifiably-unparseable action phrase (confirm `parseIntent(...)` returns `type: 'other'` first) — the guard's point is that at least one known miss routes.

Run: `npm run lint`
Expected: clean exit.

- [ ] **Step 5: Commit**

```bash
git add engine/parseFallback.ts scripts/qa-parser.ts
git commit -m "feat: miss detection + spoiler-safe candidate builder for the AI parse path"
```

---

### Task 4: Feature flag + turn-loop integration in `useGameState`

**Files:**
- Modify: `vite.config.ts` (define block, ~line 70)
- Modify: `hooks/useGameState.ts` (imports ~line 22; new function after `resolveTargetWithAI`, ~line 123; call site at ~line 1112)

**Interfaces:**
- Consumes: `needsAiParse`, `buildParseCandidates` (Task 3); client `aiService.parseAction` (Task 2).
- Produces: flag-gated turn-loop behavior. No new exports.

- [ ] **Step 1: Expose the flag in `vite.config.ts`**

In the `define` block add:

```ts
        'import.meta.env.VITE_AI_PARSER': JSON.stringify(env.VITE_AI_PARSER ?? ''),
```

- [ ] **Step 2: Add the flag-gated resolver to `hooks/useGameState.ts`**

Add to the imports near line 22:

```ts
import { needsAiParse, buildParseCandidates } from '../engine/parseFallback';
```

Directly after the `resolveTargetWithAI` function (after ~line 123), add:

```ts
// ── Phase 3: tool-calling parse fallback ─────────────────────────────────────
// When the deterministic parse misses, route the WHOLE input through the
// constrained parseAction op — every verb, not just examine/talk targets.
// Flag-gated: VITE_AI_PARSER='on' uses this path; anything else keeps
// resolveTargetWithAI byte-for-byte. Deleted-at-cutover: the old path.
// Plain (non-optional-chained) access: Vite's define replaces the exact token
// `import.meta.env.VITE_AI_PARSER`, same pattern as supabase.ts.
const AI_PARSER_ENABLED = (import.meta.env.VITE_AI_PARSER ?? '') === 'on';

// Per-session memo, same pattern as targetResolveCache above.
const parseActionCache = new Map<string, ParsedIntent | null>();

async function resolveIntentWithAI(
  intent: ParsedIntent,
  location: string,
  inventory: string[],
  npcStates: Record<string, NPCState>,
  currentAct: number,
  introducedNpcs: string[],
): Promise<ParsedIntent> {
  if (!needsAiParse(intent, location, inventory)) return intent;
  const raw = intent.raw.trim();
  if (!raw) return intent;

  const key = `parse::${location}::${currentAct}::${raw.toLowerCase()}`;
  let resolved: ParsedIntent | null;
  if (parseActionCache.has(key)) {
    resolved = parseActionCache.get(key)!;
  } else {
    const candidates = buildParseCandidates(location, inventory, npcStates, currentAct, introducedNpcs);
    ({ intent: resolved } = await aiService.parseAction(raw, candidates));
    parseActionCache.set(key, resolved);
  }
  // null = no confident match → keep the regex intent (engine misses in character).
  return resolved ?? intent;
}
```

- [ ] **Step 3: Branch the call site**

Replace the single line at ~1112:

```ts
      intent = await resolveTargetWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs);
```

with:

```ts
      intent = AI_PARSER_ENABLED
        ? await resolveIntentWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs)
        : await resolveTargetWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs);
```

Also update the STEP 2.5 comment above it to mention the flag, e.g. append: `With VITE_AI_PARSER='on', the Phase 3 tool-calling parse handles ALL miss types instead.`

- [ ] **Step 4: Enable the flag in dev**

```bash
grep -q '^VITE_AI_PARSER=' .env.local 2>/dev/null || echo 'VITE_AI_PARSER=on' >> .env.local
```

(Vercel: leave the variable unset in Production/Preview until cutover — unset means off.)

- [ ] **Step 5: Typecheck + manual smoke (needs `GEMINI_API_KEY` in `.env.local`; otherwise verify only that lint passes and the flag-off path is untouched)**

Run: `npm run lint` — expected clean.

Manual: `npm run dev`, start/resume an investigation at Baker Street, type `pore over the stack of telegrams`. Expected: Watson narrates examining the telegrams (the AI parse resolved `examine telegrams_pile`), not a generic "I could find no such thing" miss. Then type `why would the killer strike twice in one night` and confirm it narrates as a world question (query path — no action taken).

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts hooks/useGameState.ts
git commit -m "feat: flag-gated tool-calling parse fallback in the turn loop (VITE_AI_PARSER)"
```

---

### Task 5: Intent-fixture corpus + tool-call QA pass + scaffolding comment cleanup

**Files:**
- Modify: `scripts/qa-parser.ts` (fixtures + `runIntentFixtures()` + call at end of `main()`)
- Modify: `engine/stories/types.ts` (comments at ~lines 260 and 270)

**Interfaces:**
- Consumes: `needsAiParse`, `buildParseCandidates` (Task 3); server `aiService.parseAction` → `ToolCallOutcome` (Task 2); existing `parseIntent`.
- Produces: the cutover gate numbers (tool-call accuracy, enum-failure count) reported by `npm run qa:parser`.

- [ ] **Step 1: Add the intent fixtures and pass to `scripts/qa-parser.ts`**

Add below the existing `NPC_FIXTURES` block:

```ts
// ── Phase 3 intent fixtures — whole COMMANDS, not bare nouns. Each runs the
// real routing: regex parse → needsAiParse → (offline assert | parseAction).
// A fixture that the regex resolves is asserted offline (fast-path proof);
// one that misses is asserted through the tool-call pass (gateway tier).
interface IntentFixture {
  scene: { location: string; act: number; inventory?: string[] };
  input: string;
  expect:
    | { type: 'move' | 'examine' | 'talk' | 'take' | 'read' | 'drop'; targetId: string }
    | { type: 'show'; targetId: string; showTargetNpcId: string }
    | { type: 'deduce' }
    | { type: 'query' }
    | { type: 'none' }; // AI must decline to act (no_action → null intent)
}

const INTENT_FIXTURES: IntentFixture[] = [
  // move — offline (implicit location alias) and via AI
  { scene: { location: 'dorset_street', act: 1 }, input: 'we ought to return home to baker street',
    expect: { type: 'move', targetId: 'baker_street' } },
  { scene: { location: 'millers_court', act: 4 }, input: 'return to our lodgings at once',
    expect: { type: 'move', targetId: 'baker_street' } },
  // examine via AI
  { scene: { location: 'baker_street', act: 1 }, input: 'pore over the stack of telegrams',
    expect: { type: 'examine', targetId: 'telegrams_pile' } },
  { scene: { location: 'millers_court', act: 4 }, input: 'crouch down and look under the sleeping pallet',
    expect: { type: 'examine', targetId: 'the_bed' } },
  // talk via AI
  { scene: { location: 'dorset_street', act: 1 }, input: 'speak with the man who watched mary kelly that night',
    expect: { type: 'talk', targetId: 'hutchinson' } },
  { scene: { location: 'dorset_street', act: 1 }, input: 'i should like to question the policeman leading this investigation',
    expect: { type: 'talk', targetId: 'abberline' } },
  // take via AI
  { scene: { location: 'lusk_office', act: 3 }, input: 'gather up that vile correspondence',
    expect: { type: 'take', targetId: 'from_hell_letter' } },
  // read via AI
  { scene: { location: 'baker_street', act: 1 }, input: 'read whatever the papers have printed about the murders',
    expect: { type: 'read', targetId: 'newspaper_pile' } },
  // show — offline ("present … to …" verb form) and via AI
  { scene: { location: 'baker_street', act: 3, inventory: ['Kidney Examination Notes'] },
    input: 'present my notes on the kidney to holmes',
    expect: { type: 'show', targetId: 'kidney_parcel', showTargetNpcId: 'holmes' } },
  { scene: { location: 'baker_street', act: 3, inventory: ['Kidney Examination Notes'] },
    input: 'let holmes see what lusk received in the post',
    expect: { type: 'show', targetId: 'kidney_parcel', showTargetNpcId: 'holmes' } },
  // drop via AI
  { scene: { location: 'dorset_street', act: 1, inventory: ['Newspaper Clipping (the "Dear Boss" letter)'] },
    input: 'rid myself of that wretched cutting',
    expect: { type: 'drop', targetId: 'newspaper_pile' } },
  // deduce (robust to being caught offline by DEDUCTION_KEYWORDS)
  { scene: { location: 'baker_street', act: 5 }, input: 'it must have been the quiet young assistant all along',
    expect: { type: 'deduce' } },
  // query — stays offline with narration, never routes to the AI parse
  { scene: { location: 'baker_street', act: 1 }, input: 'why would the killer strike twice in one night',
    expect: { type: 'query' } },
  // no_action escapes — atmosphere must NOT become an action
  { scene: { location: 'baker_street', act: 1 }, input: 'the fog tonight is thicker than usual',
    expect: { type: 'none' } },
  { scene: { location: 'mitre_square', act: 3 }, input: 'hum a quiet tune to steady my nerves',
    expect: { type: 'none' } },
];

function intentMatches(got: ParsedIntentResult, exp: IntentFixture['expect']): boolean {
  if (exp.type === 'none') return got === null;
  if (!got) return false;
  if (exp.type === 'query') return got.type === 'query';
  if (exp.type === 'deduce') return got.type === 'deduce';
  if (got.type !== exp.type) return false;
  if (got.targetId !== exp.targetId) return false;
  if (exp.type === 'show' && got.showTargetNpcId !== exp.showTargetNpcId) return false;
  return true;
}
type ParsedIntentResult = ReturnType<typeof parseIntent> | null;
```

Add the pass function above `main()` and call `await runIntentFixtures();` as the LAST line inside `main()` (after the existing regression-gate block):

```ts
async function runIntentFixtures(): Promise<void> {
  console.log('\n=== INTENT FIXTURES (full commands, Phase 3) ===\n');
  let offTotal = 0, offHit = 0;
  const offMisses: string[] = [];
  const aiCases: IntentFixture[] = [];

  for (const fx of INTENT_FIXTURES) {
    const intent = parseIntent(fx.input);
    const inv = fx.scene.inventory ?? [];
    if (!needsAiParse(intent, fx.scene.location, inv)) {
      offTotal++;
      if (intentMatches(intent, fx.expect)) offHit++;
      else offMisses.push(`  [off ] "${fx.input}" → ${intent.type}/${intent.targetId ?? '-'} (want ${fx.expect.type})`);
    } else {
      aiCases.push(fx);
    }
  }
  console.log(`  Offline-resolved: ${offHit}/${offTotal}`);
  offMisses.forEach(m => console.error(m));

  let tcTotal = 0, tcHit = 0, enumFailures = 0;
  if (process.env.GEMINI_API_KEY) {
    console.log('\n  Tool-call pass (parseAction on the regex misses):');
    const { aiService } = await import('../server/aiCore');
    for (const fx of aiCases) {
      const inv = fx.scene.inventory ?? [];
      const candidates = buildParseCandidates(fx.scene.location, inv, {}, fx.scene.act, []);
      const res = await aiService.parseAction(fx.input, candidates);
      if (res.invalidArgs) enumFailures++;
      tcTotal++;
      const ok = intentMatches(res.intent, fx.expect);
      if (ok) tcHit++;
      const got = res.intent ? `${res.intent.type}/${res.intent.targetId ?? '-'}` : 'null';
      console.log(`    [${ok ? 'OK ' : '   '}] "${fx.input}" → ${got}`);
    }
    console.log(`\n    Tool-call accuracy: ${tcHit}/${tcTotal}; enum-validation failures: ${enumFailures}`);
  } else {
    console.log(`  (Set GEMINI_API_KEY to run the tool-call pass on the ${aiCases.length} regex misses.)`);
  }

  // Gates: offline fixture mismatches and enum failures are hard failures;
  // tool-call accuracy has an initial floor to raise as the corpus stabilises.
  const TC_GATE = 0.75;
  let failed = false;
  if (offMisses.length > 0) {
    console.error(`\n[FAIL] ${offMisses.length} offline intent fixtures mismatched.`);
    failed = true;
  }
  if (enumFailures > 0) {
    console.error(`[FAIL] ${enumFailures} enum-validation failures (id outside its candidate list).`);
    failed = true;
  }
  if (tcTotal > 0 && tcHit / tcTotal < TC_GATE) {
    console.error(`[FAIL] Tool-call accuracy ${((tcHit / tcTotal) * 100).toFixed(0)}% below gate ${TC_GATE * 100}%.`);
    failed = true;
  } else if (tcTotal > 0) {
    console.log(`\n[PASS] Tool-call accuracy ${((tcHit / tcTotal) * 100).toFixed(0)}% ≥ gate ${TC_GATE * 100}%.`);
  }
  if (failed) process.exit(1);
}
```

- [ ] **Step 2: Run offline and fix any fixture that lands wrong**

Run: `npm run qa:parser` (no key)
Expected: `Offline-resolved: N/N` with zero `[off ]` mismatch lines, and `(Set GEMINI_API_KEY …)` for the rest. If a fixture unexpectedly resolves offline to the WRONG intent (a regex-alias quirk — e.g. a stray `'letter'`/`'street'`/`'bed'` substring hijacking the input), reword that fixture's phrasing so it either misses cleanly (routes to AI) or resolves to the expected intent, keeping the verb intent it exercises and keeping ≥15 fixtures total. Note any rewording in the commit message body.

- [ ] **Step 3: Run the gateway tier (needs `GEMINI_API_KEY` in the environment)**

Run: `GEMINI_API_KEY=$(grep '^GEMINI_API_KEY=' .env.local | cut -d= -f2-) npm run qa:parser`
Expected: all existing passes green, `enum-validation failures: 0`, tool-call accuracy ≥ 75% (`[PASS]`). If accuracy is below the gate, inspect the per-fixture log lines: prompt/description tweaks in `server/parseAction.ts` (tool descriptions, `buildParsePrompt` wording) are in scope; loosening validation is NOT.

- [ ] **Step 4: Update the scaffolding comments in `engine/stories/types.ts`**

Line ~260: change `// hintObjectives is unused in 2b — scaffolding for Phase 3.` to `// hintObjectives is unused by the engine so far — scaffolding for future phases.`

Lines ~268-270: change `// consumed by GameEngine today; convergenceFlag and playerNpcId are unused` / `// in 2b — scaffolding for Phase 3 (tool-calling turn loop).` to `// consumed by GameEngine today; convergenceFlag and playerNpcId are unused` / `// so far — scaffolding for future phases (Phase 3 did not need them).`

- [ ] **Step 5: Full QA sweep**

Run: `npm run lint && npm run qa:validate && npm run qa:engine && npm run qa:parser`
Expected: all green (qa:parser offline tiers pass without a key; the tool-call pass line simply notes the key requirement).

- [ ] **Step 6: Commit**

```bash
git add scripts/qa-parser.ts engine/stories/types.ts
git commit -m "feat: qa:parser intent-fixture corpus + tool-call pass — the Phase 3 cutover gate"
```

---

## Post-plan (not in this plan)

- Manual playthrough with the flag on, then set `VITE_AI_PARSER=on` in Vercel Preview → Production once the spec's gate criteria hold.
- Cutover commit (separate PR): delete `resolveTargetWithAI` + the flag's off-branch; retire the old hybrid pass in qa-parser in favor of the tool-call pass.
- Post-cutover: shrink `intentParser.ts` alias tables where the AI path demonstrably covers them.
