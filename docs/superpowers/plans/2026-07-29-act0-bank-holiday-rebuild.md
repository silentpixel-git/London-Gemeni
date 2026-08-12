# Act 0 Bank Holiday Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Act 0 from a four-flag click-through into a five-object domestic case with a real reconstruction, per `docs/act0-bank-holiday-spec.md`.

**Architecture:** Five contained engine additions (a TAKE flag, flag-gated object visibility, an OPEN verb, flag-gated NPC presence, escalating safety nets), then Act 0 rewritten as story data on top of them, then two UI changes. The engine/AI contract is untouched: every addition resolves deterministically and the AI still only narrates decided outcomes.

**Tech Stack:** TypeScript, React, Vite. No unit-test framework — correctness is `tsc --noEmit` plus the scripted `qa-*.ts` harnesses in `scripts/`. "Write the failing test" in this plan means "add an assertion to the relevant harness and watch it fail."

---

## Read before starting

- `docs/superpowers/specs/2026-07-29-act0-bank-holiday-rebuild-design.md` — the design this implements
- `docs/act0-bank-holiday-spec.md` — **the authored prose.** Every speech, description and diary line in Tasks 6–12 is written there. Do not invent replacements; lift them.
- `CLAUDE.md` — the engine/AI contract, and the rule that engine files never call AI or Supabase
- Skills to load when writing player-facing prose: `historian`, `narration-voice-check`, `game-direction`

**Two standing style rules for all authored text in this plan:** no em dashes, and no three-beat lists. The house voice already has enough of both; leave existing prose alone but do not add more.

**Saves break.** Every Act 0 object id, flag and gate changes. This is expected and approved.

---

## File structure

**New files:**

| File | Responsibility |
|---|---|
| `engine/visibility.ts` | `visibleInteractables()` — the single answer to "what objects are in this room right now" |
| `engine/resolvers/open.ts` | The OPEN verb resolver |
| `engine/stories/whitechapel-1888/diaryActs.ts` | Authored act-closing diary entries with flag-keyed variants |

**Modified — engine:**

| File | Change |
|---|---|
| `types.ts` | `'open'` in `IntentType` |
| `engine/intentParser.ts` | `OPEN_VERBS`, dispatch block, `'open'` removed from `EXAMINE_VERBS` |
| `engine/GameEngine.ts` | `case 'open'` dispatch |
| `engine/presence.ts` | `presenceRequiresFlag` gate in `npcLocationAt` / `getPresentNpcIds` |
| `engine/narrationContext.ts` | `visibleInteractables`; safety-net ladder selection |
| `engine/parseFallback.ts` | `visibleInteractables` (2 sites) |
| `engine/resolvers/items.ts` | `took_*` flag; `visibleInteractables` (3 sites) |
| `engine/resolvers/examine.ts` | `visibleInteractables` (2 sites) |
| `engine/resolvers/meta.ts` | `visibleInteractables` (1 site) |
| `engine/stories/types.ts` | `presenceRequiresFlag`, `ActSafetyNet.instruction` as array, manifest fields |

**Modified — story data:** `locations.ts`, `clues.ts`, `facts.ts`, `flags.ts`, `acts.ts`, `npcs.ts`, `events.ts`, `approaches.ts`, `hints.ts`, `diaryDecisions.ts`, `diary.ts`, `manifest.ts`

**Modified — UI:** `components/Sidebar.tsx`, `components/DiaryModal.tsx`, `App.tsx`, `hooks/useGameState.ts`

**Modified — harnesses:** `scripts/qa-engine.ts`, `scripts/qa-validate.ts`, `scripts/qa-parser.ts`

---

# Phase A — Engine primitives

Each task here is independently testable and committable. Story data does not change until Phase B, so `qa:engine` tests in this phase splice synthetic manifests, following the existing pattern at `scripts/qa-engine.ts:1881`.

---

## Task 1: TAKE sets a flag

`resolveTake` is the only verb resolver that returns no `flagsUpdate` at all. Act 0's gate needs `took_baker_street_pawn_ticket`.

**Files:**
- Modify: `engine/resolvers/items.ts:13-90`
- Modify: `engine/stories/whitechapel-1888/flags.ts:75-91`
- Test: `scripts/qa-engine.ts`

- [ ] **Step 1: Write the failing test**

Add this function to `scripts/qa-engine.ts`, immediately before the `// ── Main ──` comment block:

```ts
function runTakeSetsFlag() {
  console.log('\n=== TAKE sets a took_<loc>_<obj> flag ===');

  // pawn_ticket is takeable at baker_street in Act 0 (see TAKEABLE_OBJECTS).
  const snap = buildSnapshot({ location: 'baker_street', currentAct: 0 });
  const r = gameEngine.resolve(parseIntent('take the pawn ticket'), snap);

  if (r.actionSuccess && r.flagsUpdate?.['took_baker_street_pawn_ticket'] === true) {
    pass('TAKE sets took_baker_street_pawn_ticket');
  } else {
    fail('TAKE sets took_baker_street_pawn_ticket', JSON.stringify(r.flagsUpdate));
  }

  // A blocked take must NOT set the flag.
  const blockedSnap = buildSnapshot({ location: 'baker_street', currentAct: 0 });
  const blockedResult = gameEngine.resolve(parseIntent('take the violin case'), blockedSnap);
  if (!blockedResult.actionSuccess && !blockedResult.flagsUpdate?.['took_baker_street_violin_case']) {
    pass('blocked TAKE sets no took_ flag');
  } else {
    fail('blocked TAKE sets no took_ flag', JSON.stringify(blockedResult.flagsUpdate));
  }

  // Taking something already held must not re-fire progression.
  const heldSnap = buildSnapshot({
    location: 'baker_street',
    currentAct: 0,
    inventory: ["Nell's Pawn Ticket"],
  });
  const heldResult = gameEngine.resolve(parseIntent('take the pawn ticket'), heldSnap);
  if (heldResult.actionSuccess && heldResult.newAct === undefined) {
    pass('re-taking a held item does not advance the act');
  } else {
    fail('re-taking a held item does not advance the act', JSON.stringify(heldResult.newAct));
  }
}
```

Register it in the `try {` block at the bottom of the file, after `runItemsGained();`:

```ts
  runTakeSetsFlag();
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx scripts/qa-engine.ts 2>&1 | grep -A2 "TAKE sets a took"
```

Expected: `[FAIL] TAKE sets took_baker_street_pawn_ticket — undefined`

- [ ] **Step 3: Add the flag template**

In `engine/stories/whitechapel-1888/flags.ts`, after the `ShowedFlag` type (line 48):

```ts
/** Took an object into inventory from a location. */
type TookFlag = `took_${LocationId}_${ObjectId}`;
```

And add `TookFlag` to the `StoryFlag` union at line 82:

```ts
export type StoryFlag =
  | ExaminedFlag
  | EpilogueCutFlag
  | TalkedToFlag
  | AskedAboutFlag
  | ShowedFlag
  | TookFlag
  | UsedFlag
  | VisitedFlag
  | WorldEventFlag
  | LiteralFlag;
```

- [ ] **Step 4: Set the flag in the resolver**

In `engine/resolvers/items.ts`, replace the final `return` of `resolveTake` (currently starting at line 66, `return { actionSuccess: true, actionType: 'take', inventoryAdd: [inventoryItem], ...`) with:

```ts
  const tookFlag = `took_${session.location}_${targetId}`;
  const flagsUpdate: Record<string, boolean> = { [tookFlag]: true };
  const actCheck = checkActProgression(story, session, { ...session.flags, ...flagsUpdate });

  return {
    actionSuccess: true,
    actionType: 'take',
    inventoryAdd: [inventoryItem],
    flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
    newAct: actCheck.newAct,
    gameOver: actCheck.gameOver,
    discoveredClueIds: newClueIds,
    medicalPointsDelta: medicalDelta || undefined,
    moralPointsDelta: moralDelta || undefined,
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: `Watson took the ${objectName}.`,
      actionResultNote: `SUCCESS — ${inventoryItem} added to Watson's possessions.`,
      newClueDefs,
    }),
  };
```

Keep whatever `actionDescription` / `actionResultNote` strings are already there if they differ; only the flag, progression check and the three new result fields are the change.

`checkActProgression` is already imported at the top of `items.ts`. Verify before adding a duplicate import.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx tsx scripts/qa-engine.ts 2>&1 | grep -A4 "TAKE sets a took"
```

Expected: three `[PASS]` lines.

- [ ] **Step 6: Verify nothing else regressed**

```bash
npm run lint && npx tsx scripts/qa-engine.ts && npx tsx scripts/qa-validate.ts
```

Expected: lint clean, both harnesses exit 0. `qa:engine` is red on this branch for Act 0 reasons that Phase B fixes — if a failure names an Act 0 gate flag, note it and continue. Any *other* new failure is a regression from this task and must be fixed before committing.

- [ ] **Step 7: Commit**

```bash
git add engine/resolvers/items.ts engine/stories/whitechapel-1888/flags.ts scripts/qa-engine.ts && git commit --no-gpg-sign -m "feat(engine): TAKE sets a took_<loc>_<obj> flag"
```

---

## Task 2: Flag-gated object visibility

One helper replaces every direct read of `LocationDefinition.interactables` in the play path. Nine call sites.

**Files:**
- Create: `engine/visibility.ts`
- Modify: `engine/stories/types.ts` (manifest fields)
- Modify: `engine/stories/whitechapel-1888/locations.ts` (the tables)
- Modify: `engine/stories/whitechapel-1888/manifest.ts` (wire them in)
- Modify: `engine/narrationContext.ts:168`, `engine/parseFallback.ts:37,60`, `engine/resolvers/meta.ts:99`, `engine/resolvers/examine.ts:39,186`, `engine/resolvers/items.ts:18,128,176`
- Test: `scripts/qa-engine.ts`

- [ ] **Step 1: Write the failing test**

Add to `scripts/qa-engine.ts` before `// ── Main ──`:

```ts
function runObjectVisibility() {
  console.log('\n=== Flag-gated object visibility ===');

  // A synthetic manifest: 'violin_case' at baker_street is hidden until a flag.
  const gated = new GameEngine({
    ...WHITECHAPEL_MANIFEST,
    objectVisibility: { violin_case: 'test_reveal_flag' },
    containerContents: {},
  });

  const hiddenSnap = buildSnapshot({ location: 'baker_street', currentAct: 0 });
  const hiddenResult = gated.resolve(parseIntent('examine the violin case'), hiddenSnap);
  if (!hiddenResult.actionSuccess) {
    pass('gated object cannot be examined before its flag');
  } else {
    fail('gated object cannot be examined before its flag', 'examine succeeded');
  }

  const objectsWhileHidden = (hiddenResult.aiContext as any).availableObjects as string[];
  if (!objectsWhileHidden.some(n => n.toLowerCase().includes('violin'))) {
    pass('gated object absent from availableObjects before its flag');
  } else {
    fail('gated object absent from availableObjects', JSON.stringify(objectsWhileHidden));
  }

  const shownSnap = buildSnapshot({
    location: 'baker_street',
    currentAct: 0,
    flags: { test_reveal_flag: true },
  });
  const shownResult = gated.resolve(parseIntent('examine the violin case'), shownSnap);
  const objectsWhenShown = (shownResult.aiContext as any).availableObjects as string[];
  if (shownResult.actionSuccess && objectsWhenShown.some(n => n.toLowerCase().includes('violin'))) {
    pass('gated object appears once its flag is set');
  } else {
    fail('gated object appears once its flag is set', JSON.stringify(objectsWhenShown));
  }

  // Ungated objects are unaffected.
  const plain = gameEngine.resolve(parseIntent('examine the violin case'),
    buildSnapshot({ location: 'baker_street', currentAct: 0 }));
  if (plain.actionSuccess) {
    pass('ungated objects are unaffected by the visibility table');
  } else {
    fail('ungated objects are unaffected by the visibility table', 'examine failed');
  }
}
```

Register it in the `try {` block after `runTakeSetsFlag();`:

```ts
  runObjectVisibility();
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx scripts/qa-engine.ts 2>&1 | grep -A4 "Flag-gated object visibility"
```

Expected: a TypeScript error on the unknown `objectVisibility` manifest property, or `[FAIL] gated object cannot be examined before its flag — examine succeeded`.

- [ ] **Step 3: Add the manifest fields**

In `engine/stories/types.ts`, inside `interface StoryManifest`, after `takeableRequiresFlag`:

```ts
  /** Object id → the flag that makes it visible in its location. An object
   *  absent from this map is always visible. Covers both container contents
   *  (revealed by `opened_<loc>_<obj>`) and objects that arrive mid-scene. */
  objectVisibility: Record<string, string>;
  /** Container object id → the object ids OPEN reveals. Drives both the OPEN
   *  resolver and the sidebar's nested display. */
  containerContents: Record<string, string[]>;
```

- [ ] **Step 4: Create the helper**

Create `engine/visibility.ts`:

```ts
/**
 * engine/visibility.ts
 *
 * What is actually in a room right now. LocationDefinition.interactables is the
 * full authored inventory of a location; this filters it against the session's
 * flags so that container contents and objects that have not yet arrived are
 * invisible to narration, parsing, and every resolver.
 *
 * Story-auditing scripts (qa-validate, build-story-map) deliberately do NOT use
 * this — they need the full authored list.
 */

import type { StoryManifest } from './stories/types';

export function visibleInteractables(
  story: StoryManifest,
  locationId: string,
  flags: Record<string, boolean>,
): string[] {
  const all = story.locations[locationId]?.interactables ?? [];
  return all.filter(id => {
    const gate = story.objectVisibility[id];
    return !gate || flags[gate] === true;
  });
}
```

- [ ] **Step 5: Add the story tables**

At the bottom of `engine/stories/whitechapel-1888/locations.ts`, after `OBJECT_DISPLAY_NAMES`:

```ts
// Objects that are not present in their location from the start of the act.
// `world_event_kemp_arrives` fires on the first substantive turn of Act 0 (see
// events.ts); `opened_baker_street_nells_workbox` is set by the OPEN resolver.
export const OBJECT_VISIBILITY: Record<string, string> = {};

// Containers and what OPEN reveals.
export const CONTAINER_CONTENTS: Record<string, string[]> = {};
```

Both are empty for now — Task 6 fills them. Empty tables keep this task's blast radius to the plumbing.

- [ ] **Step 6: Wire them into the manifest**

In `engine/stories/whitechapel-1888/manifest.ts`, add to the import from `./locations`:

```ts
import { LOCATIONS, OBJECT_DISPLAY_NAMES, OBJECT_VISIBILITY, CONTAINER_CONTENTS } from './locations';
```

And in the `WHITECHAPEL_MANIFEST` object, after `takeableRequiresFlag:`:

```ts
  objectVisibility: OBJECT_VISIBILITY,
  containerContents: CONTAINER_CONTENTS,
```

- [ ] **Step 7: Replace all nine call sites**

Each site gets `import { visibleInteractables } from '<relative path>/visibility';` and the substitution below. Work through them in this order and check each off:

- [ ] `engine/narrationContext.ts:168` — `const availableObjects = (loc.interactables || [])` becomes `const availableObjects = visibleInteractables(story, locationId, session.flags)`. Confirm the local variable holding the location id is named `locationId` at that point; if it is not, use whatever the local is.
- [ ] `engine/resolvers/examine.ts:39` — `if (!currentLoc.interactables.includes(targetId))` becomes `if (!visibleInteractables(story, session.location, session.flags).includes(targetId))`
- [ ] `engine/resolvers/examine.ts:186` — same substitution for the `inLocation` const
- [ ] `engine/resolvers/items.ts:18` — `!currentLoc.interactables.includes(targetId)` becomes `!visibleInteractables(story, session.location, session.flags).includes(targetId)`
- [ ] `engine/resolvers/items.ts:128` — `const inLocation = (id: string) => currentLoc.interactables.includes(id);` becomes `const visible = visibleInteractables(story, session.location, session.flags); const inLocation = (id: string) => visible.includes(id);`
- [ ] `engine/resolvers/items.ts:176` — `const isInLocation = currentLoc.interactables.includes(targetId);` becomes `const isInLocation = visibleInteractables(story, session.location, session.flags).includes(targetId);`
- [ ] `engine/resolvers/meta.ts:99` — `const availableObjects = currentLoc.interactables` becomes `const availableObjects = visibleInteractables(story, session.location, session.flags)`
- [ ] `engine/parseFallback.ts:37` — `const present = LOCATIONS[location]?.interactables ?? [];` becomes `const present = visibleInteractables(WHITECHAPEL_MANIFEST, location, flags);`
- [ ] `engine/parseFallback.ts:60` — same substitution

`parseFallback.ts` does not currently receive `flags`. Add a `flags: Record<string, boolean>` parameter to both `needsAiParse` and `buildParseCandidates`, and update their callers in `hooks/gameState/aiParse.ts` and `hooks/useGameState.ts` (the call at `useGameState.ts:384`) to pass the session `flags`. Follow the compiler: `npm run lint` will name every caller.

Leave `scripts/qa-validate.ts` and `scripts/build-story-map.ts` reading `interactables` directly. They audit the story, not the session.

- [ ] **Step 8: Run the tests to verify they pass**

```bash
npm run lint && npx tsx scripts/qa-engine.ts 2>&1 | grep -A5 "Flag-gated object visibility"
```

Expected: lint clean, four `[PASS]` lines.

- [ ] **Step 9: Add the qa:validate integrity check**

In `scripts/qa-validate.ts`, add a section following the file's existing `pass()`/`fail()` style:

```ts
// ── Object visibility + containers ────────────────────────────────────────────
for (const [objId, gateFlag] of Object.entries(OBJECT_VISIBILITY)) {
  if (!allInteractables.has(objId)) {
    fail(`objectVisibility: '${objId}' is not an interactable at any location`);
  } else {
    pass(`objectVisibility: '${objId}' exists`);
  }
  if (!gateFlag || typeof gateFlag !== 'string') {
    fail(`objectVisibility: '${objId}' has no gate flag`);
  }
}

for (const [containerId, contents] of Object.entries(CONTAINER_CONTENTS)) {
  if (!allInteractables.has(containerId)) {
    fail(`containerContents: container '${containerId}' is not an interactable anywhere`);
  } else {
    pass(`containerContents: container '${containerId}' exists`);
  }
  for (const contentId of contents) {
    if (!OBJECT_VISIBILITY[contentId]) {
      fail(`containerContents: '${contentId}' is inside '${containerId}' but is not gated in OBJECT_VISIBILITY — it would be visible before the container is opened`);
    } else {
      pass(`containerContents: '${contentId}' is visibility-gated`);
    }
  }
}
```

Add `OBJECT_VISIBILITY, CONTAINER_CONTENTS` to the existing `./locations` import at the top of `qa-validate.ts`. `allInteractables` is already built at `qa-validate.ts:62`.

- [ ] **Step 10: Run the full check**

```bash
npm run lint && npx tsx scripts/qa-validate.ts && npx tsx scripts/qa-engine.ts
```

Expected: lint clean, `qa-validate` exit 0, `qa-engine` no new failures beyond the known Act 0 gate ones.

- [ ] **Step 11: Commit**

```bash
git add engine/visibility.ts engine/stories/types.ts engine/stories/whitechapel-1888/locations.ts engine/stories/whitechapel-1888/manifest.ts engine/narrationContext.ts engine/parseFallback.ts engine/resolvers/ hooks/ scripts/qa-engine.ts scripts/qa-validate.ts && git commit --no-gpg-sign -m "feat(engine): flag-gated object visibility"
```

---

## Task 3: The OPEN verb

**`'open'` is currently an EXAMINE verb** (`engine/intentParser.ts:42`). This task moves it, which changes existing behaviour: `open X` presently examines X. That is the change `qa:parser`'s baseline exists to catch, and Task 15 re-records it.

**Files:**
- Create: `engine/resolvers/open.ts`
- Modify: `types.ts:176`, `engine/intentParser.ts:39-43` and the dispatch chain, `engine/GameEngine.ts:59-77`, `engine/stories/whitechapel-1888/flags.ts`, `hooks/useGameState.ts:512`
- Test: `scripts/qa-engine.ts`

- [ ] **Step 1: Write the failing test**

Add to `scripts/qa-engine.ts` before `// ── Main ──`:

```ts
function runOpenVerb() {
  console.log('\n=== OPEN verb ===');

  // Parsing: OPEN must win over EXAMINE for all its phrasings.
  for (const phrase of ['open the workbox', 'look inside the workbox', 'look in the workbox', 'unlatch the workbox']) {
    const intent = parseIntent(phrase);
    if (intent.type === 'open') pass(`"${phrase}" parses as open`);
    else fail(`"${phrase}" parses as open`, `got '${intent.type}'`);
  }

  // A bare "look" must still be a look-around, not an open.
  if (parseIntent('look').type === 'examine') pass('"look" is still a look-around');
  else fail('"look" is still a look-around', parseIntent('look').type);

  // A synthetic container: violin_case at baker_street holds two objects.
  const withContainer = new GameEngine({
    ...WHITECHAPEL_MANIFEST,
    containerContents: { violin_case: ['holmes_chemistry_table'] },
    objectVisibility: { holmes_chemistry_table: 'opened_baker_street_violin_case' },
  });

  const snap = buildSnapshot({ location: 'baker_street', currentAct: 0 });
  const opened = withContainer.resolve(parseIntent('open the violin case'), snap);
  if (opened.actionSuccess && opened.flagsUpdate?.['opened_baker_street_violin_case'] === true) {
    pass('OPEN sets opened_<loc>_<obj>');
  } else {
    fail('OPEN sets opened_<loc>_<obj>', JSON.stringify(opened.flagsUpdate));
  }
  if (opened.actionType === 'open') pass('OPEN returns actionType open');
  else fail('OPEN returns actionType open', opened.actionType);

  // Opening a non-container is blocked, not silently successful.
  const notAContainer = withContainer.resolve(parseIntent('open the chemistry table'),
    buildSnapshot({ location: 'baker_street', currentAct: 0, flags: { opened_baker_street_violin_case: true } }));
  if (!notAContainer.actionSuccess) pass('OPEN on a non-container is blocked');
  else fail('OPEN on a non-container is blocked', 'succeeded');

  // Opening something not in the room is blocked.
  const absent = withContainer.resolve(parseIntent('open the autopsy ledger'), snap);
  if (!absent.actionSuccess) pass('OPEN on an absent object is blocked');
  else fail('OPEN on an absent object is blocked', 'succeeded');

  // Re-opening an open container succeeds without re-firing progression.
  const reopen = withContainer.resolve(parseIntent('open the violin case'),
    buildSnapshot({ location: 'baker_street', currentAct: 0, flags: { opened_baker_street_violin_case: true } }));
  if (reopen.actionSuccess && reopen.newAct === undefined) pass('re-opening is idempotent');
  else fail('re-opening is idempotent', JSON.stringify({ ok: reopen.actionSuccess, act: reopen.newAct }));
}
```

Register it in the `try {` block after `runObjectVisibility();`:

```ts
  runOpenVerb();
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx scripts/qa-engine.ts 2>&1 | grep -A6 "=== OPEN verb ==="
```

Expected: `[FAIL] "open the workbox" parses as open — got 'examine'`

- [ ] **Step 3: Add the intent type**

In `types.ts:176`, add `'open'` to `IntentType`:

```ts
export type IntentType = 'move' | 'examine' | 'talk' | 'take' | 'use' | 'show' | 'read' | 'open' | 'drop' | 'inventory' | 'deduce' | 'wait' | 'help' | 'query' | 'notebook' | 'other' | 'unresolved_target';
```

- [ ] **Step 4: Add the parser verbs**

In `engine/intentParser.ts`, remove `'open'` from `EXAMINE_VERBS` (line 42). The list becomes:

```ts
const EXAMINE_VERBS = [
  'examine', 'look at', 'look', 'inspect', 'study', 'observe', 'check',
  'search', 'review', 'view', 'scrutinise', 'scrutinize',
  'investigate', 'analyse', 'analyze', 'survey', 'peruse', 'smell',
];
```

Add a new list immediately after `READ_VERBS` (line 88):

```ts
// Open a container (distinct from examine — reveals contents rather than
// describing the outside). 'open' was previously an EXAMINE verb; it moved here
// when containers became a real mechanic.
const OPEN_VERBS = [
  'open', 'look inside', 'look in', 'unlatch', 'lift the lid of', 'lift the lid',
];
```

Add `...OPEN_VERBS` to `FUZZY_VERBS` (line 588):

```ts
const FUZZY_VERBS: string[] = [
  ...MOVE_VERBS, ...EXAMINE_VERBS, ...TALK_VERBS, ...TAKE_VERBS,
  ...USE_VERBS, ...SHOW_VERBS, ...READ_VERBS, ...DROP_VERBS, ...OPEN_VERBS,
].filter(v => !v.includes(' '));
```

- [ ] **Step 5: Add the parser dispatch block**

In `parseIntent`, insert this **immediately before the `// 7. Examine (check last, broad)` block**. Order is load-bearing: EXAMINE's `'look'` would otherwise swallow `look inside the box`.

```ts
  // 6e. Open a container. MUST precede examine: EXAMINE_VERBS still contains
  // 'look', which would otherwise match "look inside the workbox" first.
  for (const verb of OPEN_VERBS.sort((a, b) => b.length - a.length)) {
    if (norm.startsWith(verb + ' ') || norm === verb) {
      const targetRaw = stripVerb(rawInput, OPEN_VERBS);
      const targetId = targetRaw ? matchObjectId(targetRaw) : undefined;
      return { type: 'open', targetId, targetRaw, raw: rawInput };
    }
  }
```

- [ ] **Step 6: Add the flag template**

In `engine/stories/whitechapel-1888/flags.ts`, after the `TookFlag` type added in Task 1:

```ts
/** Opened a container at a location. */
type OpenedFlag = `opened_${LocationId}_${ObjectId}`;
```

And add `OpenedFlag` to the `StoryFlag` union.

- [ ] **Step 7: Create the resolver**

Create `engine/resolvers/open.ts`:

```ts
import { EngineResult } from '../../types';
import { ParsedIntent } from '../intentParser';
import type { StoryManifest } from '../stories/types';
import type { SessionSnapshot } from '../session';
import { checkActProgression } from './support';
import { buildNarrationContext, blocked } from '../narrationContext';
import { visibleInteractables } from '../visibility';

/**
 * OPEN — reveals a container's contents.
 *
 * Openability is a lookup against story.containerContents rather than a
 * hardcoded check, so a locked container later becomes a new branch here plus
 * a real UNLOCK verb, not a rewrite.
 */
export function resolveOpen(story: StoryManifest, intent: ParsedIntent, session: SessionSnapshot): EngineResult {
  const currentLoc = story.locations[session.location];
  const targetId = intent.targetId;
  const objectName = targetId ? (story.objectDisplayNames[targetId] || intent.targetRaw) : intent.targetRaw;

  if (!targetId || !visibleInteractables(story, session.location, session.flags).includes(targetId)) {
    return blocked(story, intent, session,
      `Watson looks for ${objectName || 'it'}, and finds nothing of the kind to hand.`,
      `OPEN blocked: "${objectName}" is not present at ${currentLoc.name}. Watson should briefly note he cannot find it, then let the moment pass. Do not invent an object.`
    );
  }

  const contents = story.containerContents[targetId];
  if (!contents || contents.length === 0) {
    return blocked(story, intent, session,
      `The ${objectName} does not open, or has nothing in it worth the opening.`,
      `OPEN blocked: "${targetId}" is not a container. Watson should turn it over, find no lid or nothing inside, and set it down. One sentence. Do not name any game mechanism.`
    );
  }

  const openFlag = `opened_${session.location}_${targetId}`;
  const alreadyOpen = session.flags[openFlag] === true;

  const flagsUpdate: Record<string, boolean> = { [openFlag]: true };
  const actCheck = checkActProgression(story, session, { ...session.flags, ...flagsUpdate });

  const revealed = contents.map(id => story.objectDisplayNames[id] ?? id).join(', ');

  return {
    actionSuccess: true,
    actionType: 'open',
    flagsUpdate: { ...flagsUpdate, ...(actCheck.flagsUpdate || {}) },
    newAct: actCheck.newAct,
    gameOver: actCheck.gameOver,
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: `Watson opened the ${objectName}.`,
      actionResultNote: alreadyOpen
        ? `SUCCESS — the ${objectName} is already open. Inside: ${revealed}. Watson looks again at what is already before him; no new discovery. One sentence.`
        : `SUCCESS — the ${objectName} is now open. Inside: ${revealed}. Describe only these contents and nothing else.`,
      newClueDefs: [],
    }),
  };
}
```

- [ ] **Step 8: Wire the dispatch**

In `engine/GameEngine.ts`, add the import alongside the other resolvers (line 22 area):

```ts
import { resolveOpen } from './resolvers/open';
```

And the dispatch case, after `case 'read':` (line 66):

```ts
      case 'open':      result = resolveOpen(this.story, intent, session); break;
```

- [ ] **Step 9: Give OPEN a turn cost**

In `hooks/useGameState.ts:512`, add `open` to the table:

```ts
      const ACTION_TIME_MINUTES: Partial<Record<typeof result.actionType, number>> = {
        move: 10, talk: 5, deduce: 5, examine: 2, open: 2,
        use: 2, take: 1, inventory: 0, query: 1, help: 0, other: 2,
      };
```

- [ ] **Step 10: Add OPEN to the help text**

Find the verb enumeration in `engine/resolvers/meta.ts` (`resolveHelp`) and add OPEN to the listed verbs, matching the surrounding wording and register.

- [ ] **Step 11: Run the tests to verify they pass**

```bash
npm run lint && npx tsx scripts/qa-engine.ts 2>&1 | grep -A12 "=== OPEN verb ==="
```

Expected: every line `[PASS]`.

- [ ] **Step 12: Commit**

```bash
git add types.ts engine/intentParser.ts engine/resolvers/open.ts engine/GameEngine.ts engine/resolvers/meta.ts engine/stories/whitechapel-1888/flags.ts hooks/useGameState.ts scripts/qa-engine.ts && git commit --no-gpg-sign -m "feat(engine): OPEN verb and containers"
```

---

## Task 4: Flag-gated NPC presence

Mrs. Kemp must be offstage until she has climbed the stairs.

**Files:**
- Modify: `engine/stories/types.ts` (`NPCDefinition`)
- Modify: `engine/presence.ts:70-104`
- Modify: callers of `npcLocationAt` / `getPresentNpcIds` (the compiler names them)
- Test: `scripts/qa-engine.ts`

- [ ] **Step 1: Write the failing test**

Add to `scripts/qa-engine.ts` before `// ── Main ──`:

```ts
function runPresenceGating() {
  console.log('\n=== Flag-gated NPC presence ===');

  const gatedNpcs = {
    ...WHITECHAPEL_MANIFEST.npcs,
    mrs_kemp: {
      ...WHITECHAPEL_MANIFEST.npcs['mrs_kemp'],
      presenceRequiresFlag: 'test_arrival_flag',
      scheduleByAct: { 0: { default: 'baker_street' } },
    },
  };
  const gated = new GameEngine({ ...WHITECHAPEL_MANIFEST, npcs: gatedNpcs });

  const before = buildSnapshot({ location: 'baker_street', currentAct: 0 });
  const presentBefore = getPresentNpcIds(gatedNpcs as any, 'baker_street', before.npcStates, 0, 'night');
  if (!presentBefore.includes('mrs_kemp')) pass('gated NPC is absent before her flag');
  else fail('gated NPC is absent before her flag', JSON.stringify(presentBefore));

  const talkBefore = gated.resolve(parseIntent('talk to mrs kemp'), before);
  if (!talkBefore.actionSuccess) pass('cannot talk to a gated NPC before her flag');
  else fail('cannot talk to a gated NPC before her flag', 'talk succeeded');

  const after = buildSnapshot({
    location: 'baker_street', currentAct: 0, flags: { test_arrival_flag: true },
  });
  const presentAfter = getPresentNpcIds(gatedNpcs as any, 'baker_street', after.npcStates, 0, 'night', after.flags);
  if (presentAfter.includes('mrs_kemp')) pass('gated NPC is present once her flag is set');
  else fail('gated NPC is present once her flag is set', JSON.stringify(presentAfter));

  // Ungated NPCs are unaffected.
  const holmesPresent = getPresentNpcIds(WHITECHAPEL_MANIFEST.npcs, 'baker_street', after.npcStates, 0, 'night', after.flags);
  if (holmesPresent.includes('holmes')) pass('ungated NPCs are unaffected');
  else fail('ungated NPCs are unaffected', JSON.stringify(holmesPresent));
}
```

Register it in the `try {` block after `runOpenVerb();`:

```ts
  runPresenceGating();
```

Note the test calls `getPresentNpcIds` with a sixth `flags` argument that does not exist yet — that is deliberate and is part of what Step 2 shows failing.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx scripts/qa-engine.ts 2>&1 | grep -A5 "Flag-gated NPC presence"
```

Expected: a TypeScript error on the unknown `presenceRequiresFlag` property or the extra argument, or `[FAIL] gated NPC is absent before her flag`.

- [ ] **Step 3: Add the field**

In `engine/stories/types.ts`, inside `interface NPCDefinition`, after `followsUntilAct`:

```ts
  /** Offstage until this flag is set, regardless of scheduleByAct. For NPCs who
   *  arrive mid-scene rather than being in the room at curtain-up. */
  presenceRequiresFlag?: F;
```

- [ ] **Step 4: Gate the presence functions**

In `engine/presence.ts`, change `npcLocationAt` to take flags and honour the gate:

```ts
export function npcLocationAt(
  npcs: Record<string, NPCDefinition>,
  npcId: string,
  act: number,
  timePeriod: TimePeriod,
  npcStates: Record<string, NPCState>,
  flags: Record<string, boolean> = {},
): string {
  const npc = npcs[npcId];
  if (!npc) return 'offstage';
  // Not yet arrived: offstage no matter what the schedule says.
  if (npc.presenceRequiresFlag && flags[npc.presenceRequiresFlag] !== true) return 'offstage';
  const sched = npc.scheduleByAct[act];
  const scheduled = sched ? (sched.byPeriod?.[timePeriod] ?? sched.default) : undefined;
  const stored = npcStates[npcId]?.currentLocation;
  const isActiveFollower =
    !!npc.followsNpcId && (npc.followsUntilAct === undefined || act <= npc.followsUntilAct);
  if (isActiveFollower) return stored ?? scheduled ?? 'offstage';
  return scheduled ?? stored ?? 'offstage';
}
```

The `flags` parameter defaults to `{}`, so an ungated NPC behaves identically and callers that do not pass it still compile. That default is what keeps this change from rippling into every call site at once.

Then `getPresentNpcIds`:

```ts
export function getPresentNpcIds(
  npcs: Record<string, NPCDefinition>,
  locationId: string,
  npcStates: Record<string, NPCState>,
  currentAct: number,
  timePeriod: TimePeriod,
  flags: Record<string, boolean> = {},
): string[] {
  return Object.keys(npcs).filter(npcId =>
    npcLocationAt(npcs, npcId, currentAct, timePeriod, npcStates, flags) === locationId &&
    npcStates[npcId]?.status !== 'deceased');
}
```

- [ ] **Step 5: Pass flags at every call site that has them**

The default parameter means nothing breaks, but a call site that omits `flags` will treat a gated NPC as present. Find every caller and pass session flags:

```bash
grep -rn "npcLocationAt(\|getPresentNpcIds(" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v worktrees
```

Update each one in `engine/`, `hooks/` and `components/` to pass the session's flags as the final argument. Leave `scripts/` callers alone unless a test depends on gating.

- [ ] **Step 6: Also gate NPC movement**

In `engine/resolvers/support.ts`, `computeNpcMovements` computes a canonical location for `fixed`/`location_based` NPCs directly from the schedule and would write a gated NPC into the room. In the first pass loop (around line 129), skip gated NPCs whose flag is unset:

```ts
    if (npc.followingRule === 'location_based' || npc.followingRule === 'fixed') {
      if (npc.presenceRequiresFlag && session.flags[npc.presenceRequiresFlag] !== true) continue;
      const canonical = ...
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npm run lint && npx tsx scripts/qa-engine.ts 2>&1 | grep -A6 "Flag-gated NPC presence"
```

Expected: four `[PASS]` lines.

- [ ] **Step 8: Commit**

```bash
git add engine/stories/types.ts engine/presence.ts engine/resolvers/support.ts engine/ hooks/ components/ scripts/qa-engine.ts && git commit --no-gpg-sign -m "feat(engine): NPCs can be offstage until a flag is set"
```

---

## Task 5: Escalating safety nets

Holmes points at the box with increasing dryness. The rung comes from `turnsAtLocationWithoutProgress`, which already exists on `SessionSnapshot` and, in an act with no clues and no travel, is a clean monotonic "turns spent stalled here" counter. No new session state and no persistence change.

**Files:**
- Modify: `engine/stories/types.ts` (`ActSafetyNet`)
- Modify: `engine/narrationContext.ts:98-104`
- Modify: `scripts/qa-validate.ts:620-629`
- Test: `scripts/qa-engine.ts`

- [ ] **Step 1: Write the failing test**

Add to `scripts/qa-engine.ts` before `// ── Main ──`:

```ts
function runSafetyNetLadder() {
  console.log('\n=== Escalating safety nets ===');

  const laddered = new GameEngine({
    ...WHITECHAPEL_MANIFEST,
    actSafetyNets: [{
      act: 0,
      requiresNpcPresent: 'holmes',
      when: () => true,
      instruction: ['RUNG ZERO', 'RUNG ONE', 'RUNG TWO'],
    }],
  });

  const rungFor = (turns: number): string | undefined => {
    const snap = buildSnapshot({
      location: 'baker_street', currentAct: 0, turnsAtLocationWithoutProgress: turns,
    });
    const r = laddered.resolve(parseIntent('look'), snap);
    const lines = (r.aiContext as any).npcScriptedLines as Array<{ instruction: string }> | undefined;
    return lines?.find(l => l.instruction.startsWith('RUNG'))?.instruction;
  };

  const cases: Array<[number, string]> = [
    [0, 'RUNG ZERO'], [1, 'RUNG ZERO'],
    [2, 'RUNG ONE'],  [3, 'RUNG ONE'],
    [4, 'RUNG TWO'],  [9, 'RUNG TWO'],
  ];
  for (const [turns, expected] of cases) {
    const got = rungFor(turns);
    if (got === expected) pass(`${turns} stalled turns selects ${expected}`);
    else fail(`${turns} stalled turns selects ${expected}`, `got ${got}`);
  }

  // A single-string instruction still works unchanged.
  const single = new GameEngine({
    ...WHITECHAPEL_MANIFEST,
    actSafetyNets: [{ act: 0, requiresNpcPresent: 'holmes', when: () => true, instruction: 'FLAT' }],
  });
  const flatSnap = buildSnapshot({ location: 'baker_street', currentAct: 0, turnsAtLocationWithoutProgress: 8 });
  const flatLines = (single.resolve(parseIntent('look'), flatSnap).aiContext as any).npcScriptedLines as Array<{ instruction: string }>;
  if (flatLines?.some(l => l.instruction === 'FLAT')) pass('a string instruction still fires unchanged');
  else fail('a string instruction still fires unchanged', JSON.stringify(flatLines));
}
```

Register it in the `try {` block after `runPresenceGating();`:

```ts
  runSafetyNetLadder();
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx scripts/qa-engine.ts 2>&1 | grep -A8 "Escalating safety nets"
```

Expected: a TypeScript error on `instruction` being an array, or `[FAIL] 2 stalled turns selects RUNG ONE — got RUNG ZERO`.

- [ ] **Step 3: Widen the type**

In `engine/stories/types.ts`, change `ActSafetyNet`:

```ts
/** Directorial nudge injected when an act's failure-path condition holds.
 *  An array escalates: the rung advances every two stalled turns and holds on
 *  the last entry, so an infinitely patient Holmes gets drier rather than
 *  repeating himself. */
export interface ActSafetyNet {
  act: number;
  requiresNpcPresent: string;
  when: (s: SessionView) => boolean;
  instruction: string | string[];
}
```

- [ ] **Step 4: Select the rung**

In `engine/narrationContext.ts`, replace the safety-net loop (lines 98-104):

```ts
  // Act safety nets — story-authored failure-path nudges. Fire when the
  // act matches, the named NPC is present, and the condition holds. An array
  // instruction escalates with how long the player has been stalled here.
  const TURNS_PER_RUNG = 2;
  for (const net of story.actSafetyNets) {
    if (net.act !== session.currentAct) continue;
    if (!net.when(session)) continue;
    const present = npcsPresent.find(n => n.npcId === net.requiresNpcPresent);
    if (!present) continue;
    const rungs = Array.isArray(net.instruction) ? net.instruction : [net.instruction];
    const rung = Math.min(
      Math.floor(session.turnsAtLocationWithoutProgress / TURNS_PER_RUNG),
      rungs.length - 1,
    );
    npcScriptedLines.push({ npcId: present.npcId, label: present.label, instruction: rungs[rung] });
  }
```

- [ ] **Step 5: Update the validator**

In `scripts/qa-validate.ts` (around line 620), add a check that array instructions are non-empty and contain only non-empty strings, alongside the existing NPC and act-range checks:

```ts
  const rungs = Array.isArray(net.instruction) ? net.instruction : [net.instruction];
  if (rungs.length > 0 && rungs.every(r => typeof r === 'string' && r.trim().length > 0)) {
    pass(`actSafetyNets: act ${net.act} instruction has ${rungs.length} usable rung(s)`);
  } else {
    fail(`actSafetyNets: act ${net.act} has an empty or blank instruction rung`);
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm run lint && npx tsx scripts/qa-engine.ts 2>&1 | grep -A9 "Escalating safety nets" && npx tsx scripts/qa-validate.ts
```

Expected: seven `[PASS]` lines from the ladder test, `qa-validate` exit 0.

- [ ] **Step 7: Commit**

```bash
git add engine/stories/types.ts engine/narrationContext.ts scripts/qa-validate.ts scripts/qa-engine.ts && git commit --no-gpg-sign -m "feat(engine): safety nets escalate as the player stalls"
```

---

# Phase B — Act 0 story data

All prose in this phase is authored in `docs/act0-bank-holiday-spec.md`. Lift it; do not paraphrase.

---

## Task 6: Objects, containers and Mrs. Kemp's arrival

**Files:**
- Modify: `engine/stories/whitechapel-1888/locations.ts` (baker_street `interactables`, `OBJECT_DISPLAY_NAMES`, the two new tables)
- Modify: `engine/stories/whitechapel-1888/clues.ts` (`ATMOSPHERIC_NOTES`, `TAKEABLE_OBJECTS`, `DOCUMENT_TEXT`, `CLUE_TRIGGERS`)
- Modify: `engine/stories/whitechapel-1888/events.ts` (the arrival event)
- Modify: `engine/stories/whitechapel-1888/npcs.ts` (`mrs_kemp.presenceRequiresFlag`)

- [ ] **Step 1: Add the objects to the location**

In `locations.ts`, `baker_street.interactables` becomes:

```ts
    interactables: [
      'pawn_ticket', 'nells_boots', 'nells_workbox', 'nells_letters', 'charity_card',
      'concluded_case_file', 'holmes_chemistry_table', 'violin_case',
    ],
```

- [ ] **Step 2: Add display names**

In `locations.ts`, `OBJECT_DISPLAY_NAMES` gains:

```ts
  nells_boots: "Nell's Boots",
  nells_workbox: "Nell's Workbox",
  nells_letters: "Nell's Letters",
  charity_card: 'A Subscriber\'s Card',
```

`charity_card`'s display name must not name the charity or Marchant. Watson is meant to read straight past it (spec §D).

- [ ] **Step 3: Fill the visibility and container tables**

Replace the empty tables added in Task 2 Step 5:

```ts
export const OBJECT_VISIBILITY: Record<string, string> = {
  // Mrs. Kemp carries these up the stairs; they do not exist before she arrives.
  pawn_ticket: 'world_event_kemp_arrives',
  nells_boots: 'world_event_kemp_arrives',
  nells_workbox: 'world_event_kemp_arrives',
  // Inside the workbox.
  nells_letters: 'opened_baker_street_nells_workbox',
  charity_card: 'opened_baker_street_nells_workbox',
};

export const CONTAINER_CONTENTS: Record<string, string[]> = {
  nells_workbox: ['nells_letters', 'charity_card'],
};
```

- [ ] **Step 4: Author the arrival as a world event**

Act 0 starts at `canonicalMinutes: 1230`. The cheapest action costs 1 minute, so an event at 1231 fires on the player's first substantive turn. In `events.ts`, add:

```ts
  {
    id: 'kemp_arrives',
    act: 0,
    atClockMinutes: 1231, // the first substantive turn after Holmes spots her
    text: '<the arrival beat — Mrs. Kemp brought up the stairs, still gloved, setting down a pair of worn-out boots and a closed tin workbox, keeping the pawn ticket in her hand. Written from docs/act0-bank-holiday-spec.md §B>',
  },
```

Write that `text` from spec §B ("The account"), in Watson's first-person past tense. It must establish all three objects, because the visibility flag it sets makes them examinable the same turn.

- [ ] **Step 5: Gate Mrs. Kemp's presence**

In `npcs.ts`, `mrs_kemp` gains:

```ts
    presenceRequiresFlag: 'world_event_kemp_arrives',
```

and her `scheduleByAct` keeps `0: { default: 'baker_street' }`.

- [ ] **Step 6: Author the object descriptions**

In `clues.ts`, `ATMOSPHERIC_NOTES.baker_street` gains entries for `nells_boots`, `nells_workbox`, `nells_letters` and `charity_card`, and `pawn_ticket`'s existing entry is rewritten. Sources in the spec:

| Object | Spec section | Must contain | Must NOT contain |
|---|---|---|---|
| `pawn_ticket` | §C | Dated Monday 30 July, a Pentonville pawnbroker, one pair women's boots, two shillings, redemption stamp today's | The old Thrawl Street / "E. Ward" text, which is superseded |
| `nells_boots` | §C | Twice resoled, uppers gone at the flex, wear on the outer right heel, wet mud in the welt in a dry spell | Any naming of Bermondsey — that is Holmes's reading, not Watson's |
| `nells_workbox` | §D | Tin, japanned black, stiff lid catch, not locked; Mrs. Kemp's "It is her private box" | Any hint of the contents |
| `nells_letters` | §D | Eleven, April to July, chatty and thinning, last three on cheaper paper | Postmark analysis — that is Holmes's |
| `charity_card` | §D | Sixteen weekly shilling entries, last dated 24 July, clerk's copperplate, subscriber Mrs. A. Marchant, a second smaller hand ticking dates on the reverse | Any signal that Marchant matters |

The `nells_workbox` note is read when the box is **closed** — the OPEN resolver writes its own contents note.

- [ ] **Step 7: Set takeables and documents**

In `clues.ts`:

```ts
// TAKEABLE_OBJECTS — pawn_ticket keeps its entry; add:
  charity_card: 'The Subscriber\'s Card',
```

`nells_boots`, `nells_workbox` and `nells_letters` are **not** takeable — the boots leave with Mrs. Kemp (spec §Location table).

Add `DOCUMENT_TEXT` entries for `pawn_ticket` (rewritten to the 30 July Pentonville pledge) and `charity_card` (the ledger face) so both file to the Documents tab.

- [ ] **Step 8: Leave CLUE_TRIGGERS empty**

`CLUE_TRIGGERS.baker_street` keeps `pawn_ticket: []` and gains `nells_boots: []`, `nells_workbox: []`, `nells_letters: []`, `charity_card: []`. Act 0 produces no clues by design (spec §5.6). Nell's evidence must never enter the Ripper casebook.

- [ ] **Step 9: Verify**

```bash
npm run lint && npx tsx scripts/qa-validate.ts
```

Expected: exit 0. The Task 2 Step 9 checks now have real data to validate.

- [ ] **Step 10: Commit**

```bash
git add engine/stories/whitechapel-1888/ && git commit --no-gpg-sign -m "feat(story): Act 0 objects, the workbox, and Mrs Kemp's arrival"
```

---

## Task 7: Facts

**Files:** `engine/stories/whitechapel-1888/facts.ts`

- [ ] **Step 1: Rewrite the mrs_kemp block**

Replace the three existing `mrs_kemp` facts (lines 18-20) with five, per spec §Facts. **`kemp_sister_missing` changes nine days to six** — Nell left Tuesday 31 July, and the Tuesday is load-bearing for "she kept her appointment and did not come home."

| id | topics must include | substance source |
|---|---|---|
| `kemp_sister_missing` | `your sister`, `nell`, `six days`, `why you have come` | Spec §Facts. Six days. Gone since the Tuesday. |
| `kemp_pawn_ticket` | `the ticket`, `the boots`, `the pawnbroker` | She pawned her boots; a woman means to come back for her boots; I fetched them back this morning |
| `kemp_police_wont_look` | `the police`, `what they said` | They took the name down. That was the whole of it. |
| `kemp_sister_sickly_spring` | `her health`, `the spring`, `she was poorly` | Poorly in the mornings through the spring. It was the fish. **The load-bearing dismissal.** |
| `kemp_landlady` | `the landlady`, `mrs pring`, `the room` | Saw her go at six with a bag. Rent lapsed Saturday, room cleared Sunday. |

Remove the old topics `ellen`, `ward`, `nine days`, `thrawl street` — those proper nouns no longer appear anywhere in the act, and a topic pointing at nothing is worse than no topic.

- [ ] **Step 2: Revise holmes_no_case_here**

Keep the id and its gate position. Replace the substance per spec §F: no crime is disclosed; the woman is found and does not wish to be; what her sister does about it is a decision rather than a problem. Flat, reasonable, and wrong. Topics: `mrs kemp`, `the woman who called`, `her sister`.

- [ ] **Step 3: Add four Holmes facts**

All `knownBy: ['holmes'], visibleFromAct: 0`:

| id | topics | substance source |
|---|---|---|
| `holmes_boots_bermondsey` | `the boots`, `the mud`, `bermondsey` | Spec §C. Oak bark, lime, south-bank silt, in a dry August. Four streets in London, all tanyards. |
| `holmes_letters_tuesdays` | `the letters`, `the postmarks`, `tuesday` | Spec §D. Three consecutive Tuesdays in S.E., unmentioned in eleven letters. She left on a fourth. |
| `holmes_honest_object` | `the workbox`, `what she left behind` | Spec §E. Everything she took, she chose. The box is the only honest object in the room. |
| `holmes_mothers_name` | `marchant`, `the name`, `the charity` | Spec §E. She took her mother's name and left the rest of her family behind it. |

- [ ] **Step 4: Add the choice fact**

The "ask first" branch needs something to ask. Add:

```ts
  { id: 'kemp_why_she_hid', knownBy: ['mrs_kemp'], visibleFromAct: 0,
    topics: ['why she hid', 'why she hid herself', 'why she did not tell you', 'whether you know why'],
    statement: '<she does not answer. Spec §F: "Madam, if she has hidden herself from you, do you know why?" She does not answer.>' },
```

Write the statement so the AI stages a silence rather than inventing a reply. This fact is what sets `asked_mrs_kemp_about_kemp_why_she_hid`, the `asked_first` branch of the choice (Task 9).

- [ ] **Step 5: Leave the three surviving Holmes facts alone**

`holmes_crime_grown_dull`, `holmes_concluded_case` and `holmes_invisible_in_a_crowd` keep their current substance. `holmes_crime_grown_dull` is now earned by the reconstruction rather than asserted, but its text does not change.

- [ ] **Step 6: Verify**

```bash
npm run lint && npx tsx scripts/qa-validate.ts
```

Expected: exit 0. `qa:validate` checks that every `asked_*` gate flag names a fact the NPC actually knows and that carries topics.

- [ ] **Step 7: Commit**

```bash
git add engine/stories/whitechapel-1888/facts.ts && git commit --no-gpg-sign -m "feat(story): Act 0 fact graph, six days not nine"
```

---

## Task 8: SHOW interactions and the reconstruction

**Files:** `engine/stories/whitechapel-1888/clues.ts` (`SHOW_INTERACTIONS`)

- [ ] **Step 1: Author the four Holmes shows**

`SHOW_INTERACTIONS` is keyed object id → npc id → `ShowInteraction`. Add:

```ts
  pawn_ticket:   { holmes: { resultNote: '<spec §C, the "note the order, Watson" speech>' } },
  nells_boots:   { holmes: { resultNote: '<spec §C, the oak bark / lime / silt reading>' } },
  nells_letters: { holmes: { resultNote: '<spec §D, the postmarks fanned like cards>' } },
  charity_card:  { holmes: { resultNote: '<spec §E, the full reconstruction>' } },
```

Each `resultNote` is a directorial note for the AI carrying the authored content of that speech. The boots note must keep the spec's honesty caveat: Holmes claims the mud records where the last of a long life was spent, **not** that sixteen Bermondsey trips destroyed the boots. A sharp player will check the arithmetic.

- [ ] **Step 2: Gate the reconstruction**

`showed_charity_card_to_holmes` is the act's reconstruction trigger and its fourth gate flag. Add a `requireFlags` gate so it cannot fire before the box is open:

```ts
  charity_card: {
    holmes: {
      requireFlags: ['opened_baker_street_nells_workbox'],
      blockedNote: '<Watson does not have the card in hand yet>',
      resultNote: '<spec §E>',
    },
  },
```

In practice the card is invisible until the box is open, so this gate is belt and braces. Keep it: it documents the dependency where a reader will look for it.

- [ ] **Step 3: Verify**

```bash
npm run lint && npx tsx scripts/qa-validate.ts
```

- [ ] **Step 4: Commit**

```bash
git add engine/stories/whitechapel-1888/clues.ts && git commit --no-gpg-sign -m "feat(story): Act 0 SHOW readings and the reconstruction"
```

---

## Task 9: The consequential choice

Three typed actions, none reachable by omission.

**Files:**
- Modify: `engine/intentParser.ts` (the `keep` phrasings)
- Modify: `engine/stories/whitechapel-1888/flags.ts` (three literal flags)
- Modify: `engine/stories/whitechapel-1888/clues.ts` (`charity_card` → `mrs_kemp` show)
- Test: `scripts/qa-engine.ts`

- [ ] **Step 1: Write the failing test**

Add to `scripts/qa-engine.ts` before `// ── Main ──`:

```ts
function runKempChoice() {
  console.log('\n=== Act 0 consequential choice ===');

  const base = {
    location: 'baker_street',
    currentAct: 0,
    inventory: ["The Subscriber's Card"],
    flags: {
      world_event_kemp_arrives: true,
      opened_baker_street_nells_workbox: true,
      showed_charity_card_to_holmes: true,
    },
  };

  const gave = gameEngine.resolve(parseIntent('give the card to mrs kemp'), buildSnapshot(base));
  if (gave.actionSuccess && gave.flagsUpdate?.['showed_charity_card_to_mrs_kemp']) {
    pass('giving the card resolves');
  } else {
    fail('giving the card resolves', JSON.stringify(gave.flagsUpdate));
  }

  const asked = gameEngine.resolve(parseIntent('ask mrs kemp why she hid'), buildSnapshot(base));
  if (asked.actionSuccess && asked.flagsUpdate?.['asked_mrs_kemp_about_kemp_why_she_hid']) {
    pass('asking her first resolves');
  } else {
    fail('asking her first resolves', JSON.stringify(asked.flagsUpdate));
  }

  for (const phrase of ['keep the card', 'say nothing']) {
    const kept = gameEngine.resolve(parseIntent(phrase), buildSnapshot(base));
    if (kept.flagsUpdate?.['withheld_address'] === true) {
      pass(`"${phrase}" records the withhold`);
    } else {
      fail(`"${phrase}" records the withhold`, JSON.stringify(kept.flagsUpdate));
    }
  }

  // The withhold must NOT fire before the choice is live.
  const tooEarly = gameEngine.resolve(parseIntent('keep the card'), buildSnapshot({
    location: 'baker_street', currentAct: 0, flags: { world_event_kemp_arrives: true },
  }));
  if (!tooEarly.flagsUpdate?.['withheld_address']) {
    pass('the withhold does not fire before the reconstruction');
  } else {
    fail('the withhold does not fire before the reconstruction', 'fired early');
  }
}
```

Register it in the `try {` block after `runSafetyNetLadder();`:

```ts
  runKempChoice();
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx scripts/qa-engine.ts 2>&1 | grep -A6 "consequential choice"
```

Expected: `[FAIL] "keep the card" is a recognised action — parsed as 'other'`

- [ ] **Step 3: Add the flags**

**One new flag, not three.** Giving the card and asking her first are already recorded by
existing mechanisms (`showed_charity_card_to_mrs_kemp`, `asked_mrs_kemp_about_kemp_why_she_hid`).
Adding `gave_address` and `asked_first` would be state that mirrors state, with no owner and
two ways to disagree. Only the withhold has no other representation, because it is the branch
with no underlying verb.

In `flags.ts`, extend `LiteralFlag` with exactly one entry:

```ts
type LiteralFlag =
  | 'asylum_unlocked'
  | 'deduction_correct'
  | 'true_ending'
  | 'withheld_address'   // Act 0 choice: Watson keeps the card. The other two
                         // branches are recorded by their own SHOW/TALK flags.
  | '__advance_via_correct_deduction_only__';
```

- [ ] **Step 4: Author the give-the-card show**

In `clues.ts`, `SHOW_INTERACTIONS.charity_card` gains an `mrs_kemp` entry: Watson puts the card into her hand. Holmes has given her the district and the nature of the place but not the card. Note for the AI: she takes it without a word, or with one. No absolution either way.

- [ ] **Step 5: Add the keep/say-nothing phrasings**

The simplest parse that reaches a resolver: treat these as a DROP-like deliberate non-action. Add to `DROP_VERBS`? No — `drop the card` means Watson puts it down, which is a different act.

Instead add a small dedicated block to `parseIntent`, immediately after the `// 3b. Wait` block:

```ts
  // 3c. Act 0's withhold branch. A deliberate non-action needs to be a typed
  // action, or "keep it" is only reachable by failing to do anything, and a
  // player who never thought of the choice gets it recorded against them.
  const KEEP_PHRASES = [
    'keep the card', 'keep it', 'keep the subscriber\'s card', 'say nothing',
    'stay silent', 'hold my tongue', 'pocket the card',
  ];
  for (const phrase of KEEP_PHRASES) {
    if (norm === phrase || norm.startsWith(phrase + ' ')) {
      return { type: 'other', targetRaw: phrase, raw: rawInput };
    }
  }
```

Routing to `'other'` reaches `resolveOther` in `meta.ts`, which narrates without state change. That is not enough on its own — the flag must be set. In `resolveOther`, add a narrow branch: when `session.currentAct === 0`, Mrs. Kemp is present, `showed_charity_card_to_holmes` is set, and the intent's `targetRaw` is one of the keep phrases, set `withheld_address` and return an authored `actionResultNote`. Keep the branch small and comment it as act-specific.

- [ ] **Step 6: Confirm the three branches are distinguishable**

The diary variants in Task 11 key off these three, in this order:

| Branch | Flag | Set by |
|---|---|---|
| Gave her the card | `showed_charity_card_to_mrs_kemp` | The SHOW interaction from Step 4 |
| Asked her first | `asked_mrs_kemp_about_kemp_why_she_hid` | The TALK fact from Task 7 Step 4 |
| Kept it | `withheld_address` | The `resolveOther` branch from Step 5 |

A player who gives the card after asking first will have both flags. The diary checks in the
order above, so giving wins — which is correct: what Watson did outranks what he asked.

- [ ] **Step 7: Hold Mrs. Kemp at the door**

She must not leave before the choice lands. Her departure is narrative rather than mechanical (she stays present until the act ends, per spec §NPC), so this needs a safety net rather than a gate. Add to `ACT_SAFETY_NETS` in `manifest.ts`:

```ts
  {
    act: 0,
    requiresNpcPresent: 'mrs_kemp',
    when: s => s.flags['showed_charity_card_to_holmes'] === true
      && !s.flags['showed_charity_card_to_mrs_kemp']
      && !s.flags['asked_mrs_kemp_about_kemp_why_she_hid']
      && !s.flags['withheld_address'],
    instruction: [
      'Mrs. Kemp is at the door and has not gone. Watson is holding the card. Do not resolve this for him.',
      'She is still at the door. The card is still in Watson\'s hand.',
      'She waits. Watson has the card, and Holmes has given her the district but not the address.',
    ],
  },
```

- [ ] **Step 8: Run the tests to verify they pass**

```bash
npm run lint && npx tsx scripts/qa-engine.ts 2>&1 | grep -A6 "consequential choice"
```

Expected: four `[PASS]` lines.

- [ ] **Step 9: Commit**

```bash
git add engine/intentParser.ts engine/resolvers/meta.ts engine/stories/whitechapel-1888/ scripts/qa-engine.ts && git commit --no-gpg-sign -m "feat(story): Act 0's one consequential choice"
```

---

## Task 10: Gate, hints and the window beat

**Files:** `acts.ts`, `hints.ts`, `approaches.ts`

- [ ] **Step 1: Rewrite the gate**

In `acts.ts`, replace `ACT_PROGRESSION[0]`:

```ts
  // Act 0 — the Bank Holiday. NO murder has happened and none may be hinted at.
  // Six flags, five verbs (TALK / EXAMINE / OPEN / SHOW / TAKE), every one
  // motivated by the caller's visit rather than announced as a lesson.
  // No actEpilogues entry — the act IS Baker Street.
  0: {
    name: 'The Bank Holiday',
    requireFlags: [
      'asked_mrs_kemp_about_kemp_sister_missing',    // TALK    — the hook
      'examined_baker_street_pawn_ticket',           // EXAMINE
      'opened_baker_street_nells_workbox',           // OPEN
      'showed_charity_card_to_holmes',               // SHOW    — the reconstruction
      'took_baker_street_pawn_ticket',               // TAKE    — after she goes
      'asked_holmes_about_holmes_crime_grown_dull',  // TALK    — the closing beat
    ],
    advanceTo: 1,
  },
```

Order matters: `computeActEpilogue` treats the last entry as the closing beat. Act 0 declares no epilogue, but keep the convention intact for the acts that will.

- [ ] **Step 2: Rewrite the hint objectives**

In `hints.ts`, replace the four Act 0 entries (lines 46-64) with six, one per gate flag, in gate order. Follow the existing entry shape exactly. Subjects stay neutral and **must not promise a payoff the act withholds** — Nell is never found.

```ts
  // ----- Act 0: The Bank Holiday -----
  { id: 'a0_kemp', act: 0, locationId: 'baker_street', verb: 'talk',
    subject: 'the caller, about why she has come',
    flag: 'asked_mrs_kemp_about_kemp_sister_missing',
    done: s => flag(s, 'asked_mrs_kemp_about_kemp_sister_missing'),
    available: s => npcStep(s, 'baker_street', 'mrs_kemp') },
  { id: 'a0_ticket', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the ticket she has laid on the table',
    flag: 'examined_baker_street_pawn_ticket',
    done: s => flag(s, 'examined_baker_street_pawn_ticket'),
    available: s => flag(s, 'world_event_kemp_arrives') },
  { id: 'a0_workbox', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the tin box she brought with her',
    flag: 'opened_baker_street_nells_workbox',
    done: s => flag(s, 'opened_baker_street_nells_workbox'),
    available: s => flag(s, 'world_event_kemp_arrives') },
  { id: 'a0_card', act: 0, locationId: 'baker_street', verb: 'show',
    subject: 'the printed card from the box, to Holmes',
    flag: 'showed_charity_card_to_holmes',
    done: s => flag(s, 'showed_charity_card_to_holmes'),
    available: s => flag(s, 'opened_baker_street_nells_workbox') && npcStep(s, 'baker_street', 'holmes') },
  { id: 'a0_take_ticket', act: 0, locationId: 'baker_street', verb: 'examine',
    subject: 'the ticket, left behind on the table',
    flag: 'took_baker_street_pawn_ticket',
    done: s => flag(s, 'took_baker_street_pawn_ticket'),
    available: s => flag(s, 'showed_charity_card_to_holmes') },
  { id: 'a0_dull', act: 0, locationId: 'baker_street', verb: 'talk',
    subject: 'Holmes, about the state of modern crime',
    flag: 'asked_holmes_about_holmes_crime_grown_dull',
    done: s => flag(s, 'asked_holmes_about_holmes_crime_grown_dull'),
    available: s => flag(s, 'took_baker_street_pawn_ticket') && npcStep(s, 'baker_street', 'holmes') },
```

`HintVerb` has no `'open'` member. `a0_workbox` uses `'examine'`, which is honest enough for a hint that points at the box without saying what to do with it, and avoids widening the type for one objective. If the hint prose reads wrong in playtest, widening `HintVerb` is a one-line change.

- [ ] **Step 3: Gate the window beat**

In `approaches.ts`, the `holmes_invisible_in_a_crowd` entry (line 129) is Act 0's `actBeat`. It must not fire before Mrs. Kemp has left. Add:

```ts
    requireFlags: ['showed_charity_card_to_holmes', 'took_baker_street_pawn_ticket'],
```

Both flags together mean the reconstruction has happened and the ticket has been picked up off the table after she rose to go, which is exactly the moment spec §G describes.

- [ ] **Step 4: Add the workbox safety net**

Add to `ACT_SAFETY_NETS` in `manifest.ts` — the escalating pointer from spec §Gate:

```ts
  {
    act: 0,
    requiresNpcPresent: 'holmes',
    when: s => s.currentAct === 0
      && s.flags['world_event_kemp_arrives'] === true
      && !s.flags['opened_baker_street_nells_workbox'],
    instruction: [
      'Holmes, without turning round: she has not brought everything she brought for nothing. He does not name the box.',
      'Holmes indicates the table. "The table, Watson." Nothing further.',
      'Holmes, drier: "The box."',
      'Holmes, drier still: "The box is not locked, Watson." He will say versions of this indefinitely and will never open it himself.',
    ],
  },
```

He may name the object and never its contents. An infinitely patient man pointing at a tin box is the joke; do not let the AI resolve it for him.

- [ ] **Step 5: Verify**

```bash
npm run lint && npx tsx scripts/qa-validate.ts && npx tsx scripts/qa-hints.ts
```

Expected: all exit 0. `qa:validate` enforces exactly one `actBeat` per act and that every gate flag is reachable.

- [ ] **Step 6: Commit**

```bash
git add engine/stories/whitechapel-1888/ && git commit --no-gpg-sign -m "feat(story): Act 0 gate, hints, and the window beat"
```

---

## Task 11: Diary

**Files:**
- Create: `engine/stories/whitechapel-1888/diaryActs.ts`
- Modify: `engine/stories/whitechapel-1888/diary.ts`, `diaryDecisions.ts`
- Modify: `hooks/gameState/useDiary.ts` or the act-entry capture site in `hooks/useGameState.ts`

- [ ] **Step 1: Create the authored act-diary table**

Create `engine/stories/whitechapel-1888/diaryActs.ts`:

```ts
/**
 * diaryActs.ts — authored act-closing diary entries.
 *
 * Act-closing reflections are AI-written by default (see diary.ts, kind 'act').
 * An act with an entry here overrides that with authored prose, optionally
 * inflected by a player choice. Act 0's closing entry is authored because the
 * prologue's last words are the one paragraph worth hand-writing.
 */

export interface ActDiaryEntry {
  /** The shared body. `{choice}` is replaced by the matching variant. */
  body: string;
  /** First matching entry wins; the last should be the catch-all. */
  variants: Array<{ whenFlag?: string; text: string }>;
}

export const ACT_DIARY: Record<number, ActDiaryEntry> = {
  0: {
    body: '<the shared reflection. Spec §H and the closing narration: a pleasant enough evening, taken all round. No foreshadowing. Nothing may hint at any murder.>',
    variants: [
      { whenFlag: 'showed_charity_card_to_mrs_kemp', text: '<the two lines for having given her the card>' },
      { whenFlag: 'asked_mrs_kemp_about_kemp_why_she_hid', text: '<the two lines for having asked her first, and got no answer>' },
      { text: '<the two lines for having kept it>' },
    ],
  },
};

export function resolveActDiary(act: number, flags: Record<string, boolean>): string | null {
  const entry = ACT_DIARY[act];
  if (!entry) return null;
  const variant = entry.variants.find(v => !v.whenFlag || flags[v.whenFlag] === true);
  return entry.body.replace('{choice}', variant?.text ?? '');
}
```

Write all four prose blocks from spec §H and §F. The variants are two lines each, not different endings — a different inflection of the same ending.

- [ ] **Step 2: Use it at the capture site**

Find where the act-closing diary entry is captured (`kind: 'act'`, `entry.text` set from the AI's reflection — search `hooks/` for `kind: 'act'`). Before falling back to the AI text, call `resolveActDiary(currentAct, flags)`; if it returns a string, store that as `entry.text` instead.

`diary.ts`'s `resolveDiaryEntry` case `'act'` already renders `entry.text` through `toPlainText`, so authored prose flows through unchanged with no edit to `diary.ts` needed. Verify that is true before assuming it.

- [ ] **Step 3: Rewrite the two decision entries**

In `diaryDecisions.ts`, both existing entries describe a ticket and a refusal that no longer happen as written:

- `read_pawn_ticket` (flag `examined_baker_street_pawn_ticket`) — rewrite for the Pentonville pledge of 30 July, redeemed this morning by the woman sitting in the room. Watson does not yet know what it means.
- `showed_pawn_ticket_to_holmes` — **delete this entry.** The refusal no longer hangs on the ticket. Replace it with an entry keyed on `showed_charity_card_to_holmes`, named for the reconstruction, in Watson's voice: Holmes took a human catastrophe apart and found it arithmetic.

Add a third keyed on `opened_baker_street_nells_workbox` — the first intrusion, one line of discomfort, no moralising (spec §D).

- [ ] **Step 4: Verify**

```bash
npm run lint && npx tsx scripts/qa-validate.ts && npx tsx scripts/qa-diary-leads.ts
```

- [ ] **Step 5: Commit**

```bash
git add engine/stories/whitechapel-1888/ hooks/ && git commit --no-gpg-sign -m "feat(story): authored Act 0 diary, inflected by the card choice"
```

---

## Task 12: Document filing

**Files:** `engine/stories/whitechapel-1888/clues.ts`

- [ ] **Step 1: Confirm the mechanism**

`GameEngine.resolve` already sets `filed_<objectId>` for any `inventoryAdd` whose object has `DOCUMENT_TEXT` (`GameEngine.ts:85-94`), and the Documents tab reads those flags rather than live inventory. So a ticket taken in Act 0 stays on file after it leaves the bag. Nothing to build.

- [ ] **Step 2: Verify both papers file**

Both `pawn_ticket` and `charity_card` need `TAKEABLE_OBJECTS` and `DOCUMENT_TEXT` entries — added in Task 6 Step 7. Confirm with:

```bash
npx tsx -e "import('./engine/stories/whitechapel-1888/clues.js').then(m => console.log({ ticket: !!m.DOCUMENT_TEXT['pawn_ticket'], card: !!m.DOCUMENT_TEXT['charity_card'], takeable: Object.keys(m.TAKEABLE_OBJECTS).filter(k => ['pawn_ticket','charity_card'].includes(k)) }))"
```

Expected: `{ ticket: true, card: true, takeable: [ 'pawn_ticket', 'charity_card' ] }`

- [ ] **Step 3: Drop the items at the act transition**

The spec wants both papers out of inventory at the 0→1 transition. Find where `inventory` is reset or carried on act advance in `hooks/useGameState.ts` and remove these two display names when `newAct === 1`. Their `filed_*` flags persist, so they stay readable in Documents.

- [ ] **Step 4: Commit**

```bash
git add engine/stories/whitechapel-1888/clues.ts hooks/useGameState.ts && git commit --no-gpg-sign -m "feat(story): file Act 0 papers at the act transition"
```

---

# Phase C — UI

---

## Task 13: Nested containers in the sidebar

**Files:** `components/Sidebar.tsx:28-39, 66-69, 161-172`, `App.tsx:235` area

- [ ] **Step 1: Add the flags prop**

In `components/Sidebar.tsx`, add to `SidebarProps`:

```ts
  flags: Record<string, boolean>;
```

Add `flags,` to the destructured parameter list, and pass `flags={gs.flags}` at the `<Sidebar` call site in `App.tsx`.

- [ ] **Step 2: Build the tree**

Replace the `visibleObjects` computation (lines 66-69):

```ts
  // Objects of interest — the same visibility rule the engine uses, so the
  // sidebar can never list something the parser will not resolve. Containers
  // render their revealed contents as children.
  const visibleIds = (LOCATIONS[location]?.interactables || [])
    .filter(id => {
      const gate = OBJECT_VISIBILITY[id];
      return !gate || flags[gate] === true;
    });
  const containedIds = new Set(Object.values(CONTAINER_CONTENTS).flat());
  const visibleObjects = visibleIds
    .filter(id => !containedIds.has(id))
    .map(id => ({
      name: OBJECT_DISPLAY_NAMES[id] || id,
      // A container with no revealed contents is annotated as closed; one with
      // children needs no marker, since the indentation already says it is open.
      closed: !!CONTAINER_CONTENTS[id] && !visibleIds.some(c => CONTAINER_CONTENTS[id].includes(c)),
      children: (CONTAINER_CONTENTS[id] || [])
        .filter(c => visibleIds.includes(c))
        .map(c => OBJECT_DISPLAY_NAMES[c] || c),
    }));
```

Import `OBJECT_VISIBILITY` and `CONTAINER_CONTENTS` from `engine/stories/whitechapel-1888/locations` alongside the existing `LOCATIONS` / `OBJECT_DISPLAY_NAMES` imports.

- [ ] **Step 3: Render it**

Replace the list (lines 161-172):

```tsx
          {visibleObjects.length > 0 ? (
            <ul className="space-y-3">
              {visibleObjects.map((obj, idx) => (
                <li key={idx}>
                  <div className="flex items-center gap-3 text-lb-primary opacity-90">
                    <div className="w-1.5 h-1.5 rounded-full bg-lb-accent" />
                    <span className="font-sans text-md">{obj.name}</span>
                    {obj.closed && (
                      <span className="font-sans text-sm italic text-lb-primary opacity-60">closed</span>
                    )}
                  </div>
                  {obj.children.length > 0 && (
                    <ul className="mt-3 ml-6 space-y-3">
                      {obj.children.map((childName, cIdx) => (
                        <li key={cIdx} className="flex items-center gap-3 text-lb-primary opacity-90">
                          <div className="w-1.5 h-1.5 rounded-full border border-lb-accent" />
                          <span className="font-sans text-md">{childName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-sans text-sm text-lb-primary opacity-70 italic">Nothing here catches the eye.</p>
          )}
```

The child bullet is a hollow ring (`border border-lb-accent`, no fill) against the parent's filled dot, matching the mockup.

- [ ] **Step 4: Verify in the browser**

```bash
npm run dev
```

Then, using the preview tools: start a new investigation, take one action so Mrs. Kemp arrives, and confirm the sidebar lists the boots, ticket and workbox with `closed` on the workbox and no children. Open the workbox and confirm the two contents appear indented beneath it and `closed` disappears. Screenshot both states.

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.tsx App.tsx && git commit --no-gpg-sign -m "feat(ui): nested containers in Objects of Interest"
```

---

## Task 14: Casebook empty states

**Files:** `components/DiaryModal.tsx:66-72, 106-112, 204-210`

- [ ] **Step 1: Rewrite the three empty states**

The current lines read as system messages during a prologue that has no evidence in it by design. Rewrite each in Watson's register, as a statement about the case rather than about the interface. Present tense, first person or close narration to match the surrounding diary voice.

- `EvidencePanel` (line 68): currently "No evidence formally recorded yet."
- `PersonsPanel` (line 108): currently "Watson has no names in his ledger yet."
- `DocumentsPanel` (line 206): currently "Watson has filed no papers yet."

The Persons and Documents lines are already close; the Evidence one is the system-message offender. None may hint that evidence is coming, and none may reference Nell or any murder.

- [ ] **Step 2: Verify in the browser**

Open the casebook during Act 0 and confirm all three panels read deliberately. Screenshot.

- [ ] **Step 3: Commit**

```bash
git add components/DiaryModal.tsx && git commit --no-gpg-sign -m "feat(ui): casebook empty states in Watson's register"
```

---

# Phase D — Verification

---

## Task 15: Full suite, parser baseline, playtest

- [ ] **Step 1: Re-record the parser baseline**

OPEN moved out of `EXAMINE_VERBS`, so every recorded `open X` case changes classification. Run the harness first to see the damage:

```bash
npx tsx scripts/qa-parser.ts
```

Read the failures. Every one should be an `open`/`look inside` case now correctly classifying as `open`. **If any failure is not that, it is a real regression — fix it before re-recording.** Then re-record per whatever mechanism `scripts/qa-parser.ts` documents at the top of the file, and inspect the baseline diff before committing it.

- [ ] **Step 2: Add parser cases for the new verbs**

Add cases covering `open the workbox`, `look inside the workbox`, `look in the box`, `unlatch the workbox`, `keep the card`, `say nothing`, and a regression guard that bare `look` is still a look-around and `look at the boots` is still an examine.

- [ ] **Step 3: Run everything**

```bash
npm run qa:all
```

Expected: exit 0. This runs lint plus every deterministic suite.

- [ ] **Step 4: Run the suites qa:all omits**

```bash
npx tsx scripts/qa-narration-inject.ts
```

Expected: exit 0.

- [ ] **Step 5: Commit the verification work**

```bash
git add scripts/ && git commit --no-gpg-sign -m "test: parser baseline for OPEN, and Act 0 coverage"
```

- [ ] **Step 6: Playtest**

Automated review missed real gaps last time; this act is being rebuilt *because* of a playtest. Play Act 0 start to finish in the browser and check specifically:

- Mrs. Kemp is genuinely absent on turn one, and her arrival reads as an event rather than a pop-in
- The sidebar never lists an object the parser cannot resolve
- `open the workbox` works, and so does `look inside it`
- Holmes's pointer escalates and does not repeat itself flatly
- All three choice options are reachable, and none happens by accident
- The reconstruction lands
- The closing diary entry reflects the choice that was made
- Nothing anywhere hints at a murder. It is 6 August 1888 and nothing has happened.

- [ ] **Step 7: Consider a review subagent**

After the playtest, dispatch `game-reviewer` (blind, no lore) for a player-experience pass and `narrative-consistency-reviewer` for the story-data cross-references. Both are configured in `.claude/agents/`.

---

## Done when

- `npm run qa:all` exits 0
- Act 0 is playable start to finish with all six gate flags reachable
- The three choice branches each produce their own diary inflection
- The casebook is empty throughout Act 0 and says so deliberately
- Nothing in the act hints at any murder
