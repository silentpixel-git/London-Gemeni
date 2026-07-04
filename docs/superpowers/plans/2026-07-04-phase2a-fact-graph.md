# Phase 2a — Structured Fact Graph (H4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-written NPC `publicKnowledge` prose arrays with an atomic fact graph (`StoryFact[]`); NPC knowledge envelopes become derived views filtered by `knownBy` + act gate.

**Architecture:** A new `engine/stories/whitechapel-1888/facts.ts` holds all world knowledge as atomic facts `{ id, statement, knownBy, visibleFromAct, relatedClues? }`. A generic helper `deriveKnowledgeEnvelope(facts, npcId, act)` in `engine/stories/knowledge.ts` produces the per-NPC envelope at narration-context build time (`GameEngine.buildContext`), replacing the static `npc.publicKnowledge` read. The migration is parity-first: facts are generated 1:1 from the existing arrays (verbatim statements, `visibleFromAct: 0`) and verified byte-identical before the old arrays are deleted; deduplication into shared multi-NPC facts happens as a separate, reviewed editorial task.

**Tech Stack:** TypeScript (strict, `tsc --noEmit` via `npm run lint`), tsx-driven QA scripts (`npm run qa:validate`, `npm run qa:engine`) — no test framework, no new dependencies.

## Global Constraints

- No new npm dependencies (explicitly deferring Zod — TS types are the schema while story data stays in TS; revisit if stories ever move to JSON).
- All statements migrate **verbatim** in Task 2; content edits happen only in Task 5 (dedupe) with narrative review.
- All migrated facts get `visibleFromAct: 0` (behavior parity — current envelopes are act-neutral by design). Act-tagging individual facts is a later content pass, NOT this plan.
- No `spoilerLevel` field (roadmap mentions it, but the Halward validator rule + `visibleFromAct` cover the need — YAGNI).
- `engine/gameData.ts` is in the Vercel server import graph → do NOT add facts exports there (nothing server-side needs them; envelope is derived engine-side into `NarrationContext`). `GameEngine.ts` is client/QA-only → extensionless relative imports are fine there (matches existing `./stories/whitechapel-1888/hints` import).
- The intentional `prasarved` misspelling must survive untouched anywhere it appears.
- QA gates for every task: `npm run lint`, `npm run qa:validate`, `npm run qa:engine` all pass (exit 0).
- Derived envelope order = file order of `FACTS` filtered per NPC. `server/aiCore.ts` caps envelopes at 8 items preferring keyword matches then list head — so within each NPC's facts, keep the original author ordering.

---

### Task 1: `StoryFact` type + `deriveKnowledgeEnvelope` helper

**Files:**
- Modify: `engine/stories/types.ts` (append at end)
- Create: `engine/stories/knowledge.ts`
- Test: `scripts/qa-engine.ts` (new section appended before the summary block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `interface StoryFact { id: string; statement: string; knownBy: string[]; visibleFromAct: number; relatedClues?: string[] }` (exported from `engine/stories/types.ts`); `function deriveKnowledgeEnvelope(facts: StoryFact[], npcId: string, currentAct: number): string[]` (exported from `engine/stories/knowledge.ts`).

- [ ] **Step 1: Add the `StoryFact` interface to `engine/stories/types.ts`**

```ts
// ── Fact graph (Phase 2a) ────────────────────────────────────────────────────
// World knowledge as atomic facts. NPC knowledge envelopes are DERIVED views:
// facts where knownBy includes the NPC and the act gate passes. One edit
// updates every NPC consistently; spoiler gating is mechanical.
export interface StoryFact {
  id: string;             // unique, snake_case
  statement: string;      // the prose line rendered into the AI prompt (the hard knowledge ceiling)
  knownBy: string[];      // NPC ids that can voice this fact
  visibleFromAct: number; // earliest act (0-6) this fact may surface; 0 = always
  relatedClues?: string[]; // clue ids this fact supports (validator-checked)
}
```

- [ ] **Step 2: Create `engine/stories/knowledge.ts`**

```ts
// Generic fact-graph helpers shared by all stories. No Whitechapel imports.
import type { StoryFact } from './types';

/**
 * Derive an NPC's knowledge envelope from the fact graph: every fact this NPC
 * knows whose act gate has passed, in fact-file order (author order matters —
 * aiCore's 8-item cap falls back to the head of this list).
 */
export function deriveKnowledgeEnvelope(
  facts: StoryFact[],
  npcId: string,
  currentAct: number,
): string[] {
  return facts
    .filter(f => f.knownBy.includes(npcId) && f.visibleFromAct <= currentAct)
    .map(f => f.statement);
}
```

- [ ] **Step 3: Add a failing test section to `scripts/qa-engine.ts`** (append before the summary block, using the existing `pass`/`fail` helpers)

```ts
// ── Fact graph: deriveKnowledgeEnvelope ──────────────────────────────────────

import { deriveKnowledgeEnvelope } from '../engine/stories/knowledge';
import type { StoryFact } from '../engine/stories/types';

{
  const testFacts: StoryFact[] = [
    { id: 'f_shared',   statement: 'shared fact',    knownBy: ['a', 'b'], visibleFromAct: 0 },
    { id: 'f_a_only',   statement: 'a-only fact',    knownBy: ['a'],      visibleFromAct: 0 },
    { id: 'f_late',     statement: 'late fact',      knownBy: ['a'],      visibleFromAct: 4 },
  ];
  const actual = deriveKnowledgeEnvelope(testFacts, 'a', 2);
  if (JSON.stringify(actual) === JSON.stringify(['shared fact', 'a-only fact'])) {
    pass('deriveKnowledgeEnvelope filters by knownBy and act gate, preserves order');
  } else {
    fail('deriveKnowledgeEnvelope wrong result', JSON.stringify(actual));
  }
  const late = deriveKnowledgeEnvelope(testFacts, 'a', 4);
  if (late.length === 3 && late[2] === 'late fact') {
    pass('deriveKnowledgeEnvelope admits act-gated facts once the act arrives');
  } else {
    fail('act-gated fact not admitted at its act', JSON.stringify(late));
  }
  const other = deriveKnowledgeEnvelope(testFacts, 'c', 6);
  if (other.length === 0) {
    pass('deriveKnowledgeEnvelope returns empty for an NPC with no facts');
  } else {
    fail('expected empty envelope for unknown npc', JSON.stringify(other));
  }
}
```

Note: `scripts/qa-engine.ts` places imports at the top of the file — put the two import lines with the existing imports, only the test block goes before the summary.

- [ ] **Step 4: Run the QA suites**

Run: `npm run qa:engine` → expect the three new `[PASS]` lines, exit 0.
Run: `npm run lint` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add engine/stories/types.ts engine/stories/knowledge.ts scripts/qa-engine.ts
git commit -m "feat: add StoryFact type and deriveKnowledgeEnvelope helper (fact graph, phase 2a)"
```

---

### Task 2: `facts.ts` — mechanical 1:1 migration with parity proof

**Files:**
- Create: `engine/stories/whitechapel-1888/facts.ts`
- Scratch (not committed): parity-check script in the session scratchpad

**Interfaces:**
- Consumes: `StoryFact` from `engine/stories/types.ts`; `NPCS` (read-only, as migration source).
- Produces: `export const FACTS: StoryFact[]` from `engine/stories/whitechapel-1888/facts.ts`.

- [ ] **Step 1: Generate `facts.ts` from the current `publicKnowledge` arrays**

Transform rule (applies to all 11 NPCs — holmes, abberline, bond, edmund, lusk, diemschutz, hutchinson, phillips, tumblety, pizer, superintendent — in their `npcs.ts` declaration order):

For each NPC `npcId`, for each `publicKnowledge[i]` string (in order), emit:

```ts
{ id: '<npcId>_<slug>', statement: <the string, verbatim>, knownBy: ['<npcId>'], visibleFromAct: 0 },
```

where `<slug>` is a 2-4 word snake_case summary of the statement (unique across the file). Carry over the explanatory `//` comments that precede entries in `npcs.ts` (they encode authorial intent — e.g. Holmes's spoiler-safety note, Abberline's Bond-alibi note). File skeleton:

```ts
// Atomic world-knowledge facts for the Whitechapel 1888 story.
// NPC knowledge envelopes are DERIVED from this file (see engine/stories/knowledge.ts):
// an NPC knows every fact whose knownBy includes them and whose visibleFromAct has passed.
// ORDER MATTERS: per-NPC envelope order = file order (aiCore's 8-item cap prefers the head).
// Phase 2a migration: statements verbatim from the old publicKnowledge arrays; all
// visibleFromAct: 0 for behavior parity. Dedupe/act-tagging are separate passes.
import type { StoryFact } from '../types';

export const FACTS: StoryFact[] = [
  // ── holmes ──────────────────────────────────────────────────────────────
  // Spoiler-safe and timeline-neutral: Holmes's envelope must hold from the
  // prologue (four victims, Kelly alive) through Act 6. The prasarved match
  // and "murders stopped" are DISCOVERIES, not knowledge — never listed here.
  { id: 'holmes_studied_files', statement: 'Has studied the police files on every murder and visits each scene to conduct independent analysis', knownBy: ['holmes'], visibleFromAct: 0 },
  // ... one entry per publicKnowledge line, all 11 NPCs ...
];
```

- [ ] **Step 2: Write and run the parity check (scratchpad, throwaway)**

Write to `<scratchpad>/parity-check.ts`:

```ts
import { NPCS } from '<repo>/engine/stories/whitechapel-1888/npcs';
import { FACTS } from '<repo>/engine/stories/whitechapel-1888/facts';
import { deriveKnowledgeEnvelope } from '<repo>/engine/stories/knowledge';

let bad = 0;
for (const [npcId, npc] of Object.entries(NPCS)) {
  for (let act = 0; act <= 6; act++) {
    const derived = deriveKnowledgeEnvelope(FACTS, npcId, act);
    if (JSON.stringify(derived) !== JSON.stringify(npc.publicKnowledge)) {
      console.error(`MISMATCH ${npcId} act ${act}`);
      console.error('  old:', JSON.stringify(npc.publicKnowledge));
      console.error('  new:', JSON.stringify(derived));
      bad++;
    }
  }
}
console.log(bad === 0 ? 'PARITY OK — all NPCs, all acts' : `${bad} mismatches`);
process.exit(bad === 0 ? 0 : 1);
```

Run: `npx tsx <scratchpad>/parity-check.ts`
Expected: `PARITY OK — all NPCs, all acts`, exit 0. Fix any mismatch (usually a dropped/reordered line) before proceeding.

- [ ] **Step 3: Duplicate-id guard**

Run: `npx tsx -e "import { FACTS } from '<repo>/engine/stories/whitechapel-1888/facts'; const ids = FACTS.map(f => f.id); const dupes = ids.filter((x, i) => ids.indexOf(x) !== i); if (dupes.length) { console.error('dupes:', dupes); process.exit(1); } console.log('ids unique:', ids.length);"`
Expected: `ids unique: <n>` where n = total publicKnowledge lines (should be ~90).

- [ ] **Step 4: Run `npm run lint`** → exit 0.

- [ ] **Step 5: Commit**

```bash
git add engine/stories/whitechapel-1888/facts.ts
git commit -m "feat: migrate all NPC publicKnowledge into atomic FACTS (1:1, parity-verified)"
```

---

### Task 3: Engine derives envelopes from FACTS; delete `publicKnowledge`

**Files:**
- Modify: `engine/GameEngine.ts:1358` (the `targetNpcInterview` build) and its import block
- Modify: `engine/stories/types.ts` (remove `publicKnowledge` from `NPCDefinition`)
- Modify: `engine/stories/whitechapel-1888/npcs.ts` (delete all 11 `publicKnowledge` arrays)
- Modify: `types.ts:286` (comment only — `knowledgeEnvelope` doc line)

**Interfaces:**
- Consumes: `FACTS` (Task 2), `deriveKnowledgeEnvelope` (Task 1).
- Produces: `NarrationContext.targetNpcInterview.knowledgeEnvelope` unchanged in shape (`string[]`) — downstream `server/aiCore.ts` untouched.

- [ ] **Step 1: Switch `buildContext` to the derived envelope**

In `engine/GameEngine.ts`, add imports next to the existing `selectHint` import:

```ts
import { FACTS } from './stories/whitechapel-1888/facts';
import { deriveKnowledgeEnvelope } from './stories/knowledge';
```

At line ~1358 replace:

```ts
        knowledgeEnvelope: npc.publicKnowledge,
```

with:

```ts
        knowledgeEnvelope: deriveKnowledgeEnvelope(FACTS, outcome.targetNpcId, session.currentAct),
```

- [ ] **Step 2: Delete the `publicKnowledge` field**

In `engine/stories/types.ts` remove the line `publicKnowledge: string[];  // Facts/topics this NPC knows and can discuss` from `NPCDefinition`. In `engine/stories/whitechapel-1888/npcs.ts` delete every `publicKnowledge: [ ... ],` block (the migrated comments now live in `facts.ts`; leave the rest of each NPC untouched). In root `types.ts` update the comment on `knowledgeEnvelope` to `// derived from the story fact graph — AI hard ceiling`.

- [ ] **Step 3: Fix the validator compile break**

`scripts/qa-validate.ts` reads `npc.publicKnowledge` in its spoiler-guard section — this no longer compiles. Replace the spoiler-guard section body (keep `aliasDescription` and `idleBehaviors` surfaces on NPCS) so publicKnowledge scanning moves to FACTS — full replacement code is in Task 4 Step 1; for THIS step just delete the `...npc.publicKnowledge.map(...)` line from the `surfaces` array so the suite compiles. (Task 4 immediately restores equivalent-or-stronger coverage; both tasks land in the same session.)

- [ ] **Step 4: Run the QA suites**

Run: `npm run lint` → exit 0.
Run: `npm run qa:engine` → all pass (talk flows still produce envelopes — the qa-engine talk tests exercise `resolveTalk`).
Run: `npm run qa:validate` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add engine/GameEngine.ts engine/stories/types.ts engine/stories/whitechapel-1888/npcs.ts types.ts scripts/qa-validate.ts
git commit -m "feat: derive NPC knowledge envelopes from the fact graph; drop publicKnowledge"
```

---

### Task 4: Validator — fact-graph integrity + mechanical spoiler linter

**Files:**
- Modify: `scripts/qa-validate.ts` (new "Facts" section after the NPCs section; spoiler-guard section reworked)

**Interfaces:**
- Consumes: `FACTS`, `deriveKnowledgeEnvelope`, existing `npcIds`/`clueIds` lookup sets.
- Produces: `npm run qa:validate` failures for: duplicate fact ids, unknown `knownBy` NPC, unknown `relatedClues` clue, out-of-range `visibleFromAct`, killer-naming facts visible early, and a warning for talkable NPCs with an empty envelope.

- [ ] **Step 1: Add imports and the Facts section**

Import at top: `import { FACTS } from '../engine/stories/whitechapel-1888/facts';` and `import { deriveKnowledgeEnvelope } from '../engine/stories/knowledge';`

Insert after the NPCs section:

```ts
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
```

- [ ] **Step 2: Rework the spoiler-guard section**

The killer's name check becomes mechanical over facts (replacing the deleted publicKnowledge scan; `aliasDescription`/`idleBehaviors` checks on NPCS stay as-is):

```ts
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
  if (factsOk) pass('no fact leaks the killer\'s name before Act VI');
```

Note: this is a `fail` (the old check was a `warn`) — with structured data the rule is now precise enough to enforce.

- [ ] **Step 3: Run `npm run qa:validate`** → expect new `[PASS]` lines for facts + spoiler linter, exit 0. Run `npm run lint` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/qa-validate.ts
git commit -m "feat: qa:validate checks fact-graph integrity and act-gated killer-name spoilers"
```

---

### Task 5: Dedupe pass — merge clearly-duplicated facts into shared facts

**Files:**
- Modify: `engine/stories/whitechapel-1888/facts.ts` (content-only edit)

**Interfaces:**
- Consumes/Produces: `FACTS` shape unchanged; statements/knownBy edited.

- [ ] **Step 1: Identify near-identical facts across NPCs**

Candidates known from the old arrays (~40% overlap): the five-victim canon, the 30 Sep double event, the Goulston Street graffiti erasure, Bond's "no surgical training" conclusion, press/witness dynamics, Tumblety's custody, Pizer's alibi. Merge ONLY facts that are equivalent in content AND neutral in phrasing — a merged fact keeps one canonical statement and a multi-NPC `knownBy: ['holmes', 'abberline', ...]`, placed at the earliest original position among its sources so envelope heads stay stable. Facts phrased in a specific NPC's voice or perspective (e.g. Abberline's "Abberline confirmed this personally", anything first-person) stay separate — voice matters more than dedupe.

- [ ] **Step 2: Run the QA gates**

Run: `npm run qa:validate && npm run qa:engine && npm run lint` → all exit 0.

- [ ] **Step 3: Narrative consistency review**

Dispatch the `narrative-consistency-reviewer` agent (project-configured for exactly this: "use after any edit to npcs.ts... or story data") over `facts.ts` + `npcs.ts`. Fix anything it confirms; re-run Step 2.

- [ ] **Step 4: Commit**

```bash
git add engine/stories/whitechapel-1888/facts.ts
git commit -m "refactor: merge duplicated world knowledge into shared multi-NPC facts"
```

---

## Out of scope (deliberately)

- **H3 / Phase 2b** (StoryManifest, generic engine, parser alias extraction, Edmund-introduction data-driving) — separate plan, written after this lands so it plans against real code.
- Act-tagging existing facts (`visibleFromAct > 0` content pass), embedding-based fact retrieval, rumor propagation (M1/Phase 4), topic-based ASK ABOUT (M6/Phase 3+).

## Verification (whole-plan)

1. `npm run lint && npm run qa:validate && npm run qa:engine` all exit 0.
2. `grep -rn publicKnowledge . --include='*.ts' -l` (excluding node_modules) returns nothing.
3. `grep -c prasarved engine/stories/whitechapel-1888/clues.ts` unchanged from before the migration.
4. Spot-check: temporarily add a fact naming Halward with `knownBy: ['bond'], visibleFromAct: 2` → `qa:validate` must FAIL; remove it.
