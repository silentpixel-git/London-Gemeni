# Watson's Diary Lead Marking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `ACT_PROGRESSION` gate flag produces a Watson's-Diary entry when it fires (filling in the silent ones with AI-generated text), and entries that were progression-critical are visually marked as a "Lead" — distinct from the existing "New" indicator.

**Architecture:** A new pure module (`diaryLeads.ts`) computes, from data already in the codebase, which gate flags a turn just satisfied with no existing diary text, and supplies the neutral hint-objective context (reused from `hints.ts`) that grounds an async AI call. `useGameState.ts` wires this into its existing capture/generation steps — synchronously stamping `isLead` on every capture path, and asynchronously filling silent flags after the turn's narration resolves, mirroring the existing act-journal pattern. `DiaryModal.tsx` renders the stored `isLead` flag as a pill, and simplifies the existing "new" dot to plain text.

**Tech Stack:** TypeScript, React 19, `@google/genai` (Gemini), Vite. No test framework — QA is hand-rolled `tsx` scripts in `scripts/` (see `qa-hints.ts`), run with `npx tsx`.

---

## Background facts (verified in code — do not re-derive)

- `DiaryEntry` ([types.ts:334](../../../types.ts)): `{ id, kind, refId, actNumber, sequence, text?, timeLabel? }`. `kind` is one of `clue | act | decision | revelation | location`.
- Gate flags live in `ACT_PROGRESSION[act].requireFlags` ([acts.ts:125](../../../engine/stories/whitechapel-1888/acts.ts)). Only Act 5's is a never-set sentinel (`__advance_via_correct_deduction_only__`); every other act has 3-5 real flags.
- Existing diary coverage for a gate flag: a clue trigger (`CLUE_DEFINITIONS[id]` has `diaryNote`, `locationFound`, `triggerObject` — [clues.ts](../../../engine/stories/whitechapel-1888/clues.ts)) whose gate flag follows the naming convention `examined_<locationFound>_<triggerObject>` (verified: `clue_00_campaign_timeline` → `locationFound: 'baker_street'`, `triggerObject: 'case_files_wall'` → real flag `examined_baker_street_case_files_wall`), OR a `DECISION_BY_FLAG[flag]` entry ([diaryDecisions.ts](../../../engine/stories/whitechapel-1888/diaryDecisions.ts)).
- Verified Prologue gap: of the 4 gate flags, `examined_baker_street_case_files_wall` (clue) and `showed_newspaper_pile_to_holmes` (decision "The Press Hoax") already have coverage; `talked_to_holmes_at_baker_street` and `examined_baker_street_telegrams_pile` have none.
- `hints.ts`'s `OBJECTIVES` table ([hints.ts:59](../../../engine/stories/whitechapel-1888/hints.ts)) already has one entry per gate flag (`done: s => flag(s, 'exact_flag_name')`) carrying a neutral, spoiler-safe `verb`/`subject` — reused here instead of inventing a second "what does this flag mean" table. `Act 6`'s `visited_private_asylum` is **not** an arrival flag despite its name — it's that location's `locationExaminedFlag` ([locations.ts:178](../../../engine/stories/whitechapel-1888/locations.ts)), the same mechanism as `examined_baker_street` elsewhere, set by examining any object there. It has no existing diary coverage and is treated like any other silent gate flag.
- Capture site, "STEP 5b" ([useGameState.ts:1289-1315](../../../hooks/useGameState.ts)): synchronously, in the same tick as the engine result, loops `result.discoveredClueIds` (→ `kind: 'clue'`) and `result.flagsUpdate` (→ `kind: 'decision'` when `DECISION_BY_FLAG[flag]` exists), builds `captured: Array<Omit<DiaryEntry,'id'|'sequence'>>`, then calls `captureDiaryEntries(captured)` ([useGameState.ts:278-291](../../../hooks/useGameState.ts) — stamps `id`/`sequence`, appends to state, persists if signed in).
- Async generation precedent, "STEP 8" ([useGameState.ts:1428-1461](../../../hooks/useGameState.ts)): `pendingJournalSummary` is queued earlier in the turn (before STEP 5, [useGameState.ts:1242](../../../hooks/useGameState.ts)); after STEP 7's narration stream completes, it's passed to `aiService.generateJournalEntry()`, and the result is manually pushed as a new `DiaryEntry` once resolved. The turn already returned control to the player before this runs.
- The final narration text is only in scope inside the STEP 7 streaming loop, as `parsed.markdownOutput` inside `if (isComplete && parsed)` ([useGameState.ts:1358-1368](../../../hooks/useGameState.ts)) — it must be captured into an outer-scoped variable to be usable at STEP 8b.
- The "new since last opened" indicator is computed entirely outside `useGameState.ts`, in `App.tsx` ([App.tsx:59-66](../../../App.tsx)): `diaryNewIds` is a plain array-length slice (`gs.diaryEntries.slice(diarySeenCount)`) taken when the diary is opened. It needs **no changes** — any entry appended to `diaryEntries`, sync or async, is automatically picked up.
- `resolveDiaryEntry()` ([diary.ts](../../../engine/stories/whitechapel-1888/diary.ts)) turns a stored entry into `{ title, body }` for the UI. Its `decision` case currently does `const d = DECISION_DIARY[entry.refId]; if (!d) return null;` — AI-generated decision entries won't be in `DECISION_DIARY`, so this needs a fallback branch reading `entry.text`.
- `DiaryModal.tsx` ([DiaryModal.tsx:167-206](../../../components/DiaryModal.tsx)) renders each entry's title with the current "new" dot (`isNew && <span className="inline-block w-1.5 h-1.5 ... rounded-full bg-lb-accent" />`). This is being replaced with plain italic "New" text; a new "Lead" pill (dot + text, matching the header's `leads` pip shape) is added alongside it, driven by `entry.isLead`.
- No test framework — QA is `tsx` scripts in `scripts/` (`npx tsx scripts/qa-*.ts`, exits 1 on any failure). `qa-hints.ts` is the existing example for `hints.ts`; this plan extends it and adds a new `scripts/qa-diary-leads.ts` for the new module.
- `npm run lint` runs `tsc --noEmit` — the project's only compile-check command.

## File structure

- **Modify** `types.ts`: add `isLead?: boolean` to `DiaryEntry`; fix two now-inaccurate doc comments on that block.
- **Modify** `engine/stories/whitechapel-1888/diary.ts`: `resolveDiaryEntry()` gains a fallback branch for AI-generated `decision` entries.
- **Modify** `engine/stories/whitechapel-1888/hints.ts`: add optional `flag?: string` to `HintObjective`; populate it on the 22 objectives that map 1:1 onto a real `requireFlags` gate.
- **Create** `engine/stories/whitechapel-1888/diaryLeads.ts`: pure module — `isRequiredFlag`, `clueGateFlag`, `leadContextFor`, `detectSilentLeadFlags`. New file (not named in the design spec) because it's the only way to unit-test this logic without a running React tree, and mirrors the codebase's existing pattern of small, focused pure modules (`hints.ts`, `diary.ts`, `diaryDecisions.ts`).
- **Modify** `services/AIService.ts`: add `generateLeadDiaryEntry`.
- **Modify** `hooks/useGameState.ts`: STEP 5b gains `isLead` stamping + silent-flag detection; STEP 7 captures the final narration text; a new STEP 8b generates and captures the AI diary entries.
- **Modify** `components/DiaryModal.tsx`: render the "Lead" pill; replace the "new" dot with plain "New" text.
- **Create** `scripts/qa-diary-leads.ts`: deterministic tests for `diary.ts`'s new branch and all of `diaryLeads.ts`, including the drift guard.
- **Modify** `scripts/qa-hints.ts`: one new check verifying every added `flag` on an objective matches a real `ACT_PROGRESSION` flag for that act, with no duplicates.

---

### Task 1: `isLead` on `DiaryEntry`

**Files:**
- Modify: `types.ts:317-342`

- [ ] **Step 1: Add the field and fix the stale comments**

In `types.ts`, the `DiaryEntry` block currently reads:

```ts
/**
 * Watson's auto-captured casebook. An append-only record of important events the
 * engine already tracks (clue discoveries, act milestones, major decisions). For
 * 'clue'/'decision' entries we store only a refId — the displayed Watson line is
 * looked up from authored story data at render time. 'act' entries carry the
 * reflective prose verbatim so it stays re-readable in the diary.
 */
export type DiaryEntryKind = 'clue' | 'act' | 'decision' | 'revelation' | 'location';

export interface DiaryEntry {
  id: string;            // uuid — also the dedupe key for persistence
  kind: DiaryEntryKind;
  refId: string;         // clueId, decision id, beat id, or actNumber-as-string
  actNumber: number;     // which act this was captured in (drives grouping)
  sequence: number;      // monotonic order within the game
  text?: string;         // 'act' entries only: the reflective act-closing prose
  timeLabel?: string;    // in-game clock when logged (e.g. "10:41 PM"); absent on pre-006 entries
}
```

Replace it with:

```ts
/**
 * Watson's auto-captured casebook. An append-only record of important events the
 * engine already tracks (clue discoveries, act milestones, major decisions). For
 * hand-authored 'clue'/'decision' entries we store only a refId — the displayed
 * Watson line is looked up from authored story data at render time. 'act' entries,
 * and AI-generated 'decision' entries with no hand-authored match, carry their
 * prose verbatim in `text` so they stay re-readable in the diary.
 */
export type DiaryEntryKind = 'clue' | 'act' | 'decision' | 'revelation' | 'location';

export interface DiaryEntry {
  id: string;            // uuid — also the dedupe key for persistence
  kind: DiaryEntryKind;
  refId: string;         // clueId, decision id (or flag, for AI-generated leads), beat id, or actNumber-as-string
  actNumber: number;     // which act this was captured in (drives grouping)
  sequence: number;      // monotonic order within the game
  text?: string;         // 'act' entries; AI-generated 'decision' entries store "title\nbody" here
  timeLabel?: string;    // in-game clock when logged (e.g. "10:41 PM"); absent on pre-006 entries
  isLead?: boolean;      // true when this entry corresponds to an ACT_PROGRESSION gate flag
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS (no errors — `isLead` is optional, so nothing that constructs a `DiaryEntry` today needs to change).

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat(diary): add isLead field to DiaryEntry"
```

---

### Task 2: `resolveDiaryEntry` fallback for AI-generated decisions

**Files:**
- Modify: `engine/stories/whitechapel-1888/diary.ts`
- Create: `scripts/qa-diary-leads.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/qa-diary-leads.ts`:

```ts
/**
 * scripts/qa-diary-leads.ts
 * Deterministic QA for Watson's diary lead-marking / gap-filling. No AI, no
 * browser, no Supabase.
 * Run: npx tsx scripts/qa-diary-leads.ts   (exit code 1 on any FAIL)
 */
import { resolveDiaryEntry } from '../engine/stories/whitechapel-1888/diary';

let passes = 0, fails = 0;
function pass(l: string) { console.log(`[PASS] ${l}`); passes++; }
function fail(l: string, d?: string) { console.error(`[FAIL] ${l}${d ? ` — ${d}` : ''}`); fails++; }

// 1) resolveDiaryEntry: hand-authored DECISION_DIARY entry still resolves as before.
{
  const authored = resolveDiaryEntry({ kind: 'decision', refId: 'showed_dear_boss_to_holmes' });
  authored?.title === 'The Press Hoax'
    ? pass('resolveDiaryEntry: hand-authored decision entry resolves via DECISION_DIARY')
    : fail('resolveDiaryEntry broke the hand-authored decision path', JSON.stringify(authored));
}

// 2) resolveDiaryEntry: AI-generated decision entry (no DECISION_DIARY match) parses
//    title/body from entry.text ("title\nbody").
{
  const generated = resolveDiaryEntry({
    kind: 'decision',
    refId: 'talked_to_holmes_at_baker_street',
    text: 'A Word with Holmes\nHe would not be drawn beyond what the wall already told us.',
  });
  (generated?.title === 'A Word with Holmes'
    && generated?.body === 'He would not be drawn beyond what the wall already told us.')
    ? pass('resolveDiaryEntry: AI-generated decision entry parses title/body from text')
    : fail('resolveDiaryEntry did not parse the AI-generated entry correctly', JSON.stringify(generated));
}

// 3) resolveDiaryEntry: a decision entry with neither a DECISION_DIARY match nor
//    stored text returns null (matches every other "can't resolve" case).
{
  const empty = resolveDiaryEntry({ kind: 'decision', refId: 'no_such_flag' });
  empty === null
    ? pass('resolveDiaryEntry: unresolvable decision entry returns null')
    : fail('resolveDiaryEntry should return null with no match and no text', JSON.stringify(empty));
}

console.log(`\n${passes} passed, ${fails} failed`);
if (fails > 0) process.exit(1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/qa-diary-leads.ts`
Expected: Check 1 PASSes (unrelated to this change); checks 2 and 3 FAIL — check 2 because `resolveDiaryEntry` currently returns `null` for any `refId` not in `DECISION_DIARY` regardless of `text`, so `generated` is `null` and `generated?.title` is `undefined`; check 3 happens to already return `null`, but only because the branch hasn't been split yet — re-run after Step 3 to confirm both 2 and 3 are correct for the right reason.

- [ ] **Step 3: Implement the fallback branch**

In `engine/stories/whitechapel-1888/diary.ts`, the `decision` case currently reads:

```ts
    case 'decision': {
      const d = DECISION_DIARY[entry.refId];
      if (!d) return null;
      return { title: d.name, body: d.diaryNote };
    }
```

Replace it with:

```ts
    case 'decision': {
      const d = DECISION_DIARY[entry.refId];
      if (d) return { title: d.name, body: d.diaryNote };
      // AI-generated lead entry (no hand-authored DECISION_DIARY match): the
      // capture site stored "title\nbody" in entry.text.
      if (!entry.text) return null;
      const sep = entry.text.indexOf('\n');
      if (sep === -1) return { title: entry.text.trim(), body: '' };
      return { title: entry.text.slice(0, sep).trim(), body: entry.text.slice(sep + 1).trim() };
    }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx scripts/qa-diary-leads.ts`
Expected: `3 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add engine/stories/whitechapel-1888/diary.ts scripts/qa-diary-leads.ts
git commit -m "feat(diary): resolve AI-generated decision entries from stored text"
```

---

### Task 3: Tag `hints.ts` objectives with their gate flag

**Files:**
- Modify: `engine/stories/whitechapel-1888/hints.ts`
- Modify: `scripts/qa-hints.ts`

- [ ] **Step 1: Write the failing test**

In `scripts/qa-hints.ts`, append after check 7 (before the final `console.log`/`process.exit` lines):

```ts
// 8) Every objective's optional `flag` — where present — matches a real gate
//    flag for that act, and no two objectives in the same act share one.
{
  const seenPerAct = new Map<number, Set<string>>();
  let bad = 0;
  for (const o of OBJECTIVES) {
    if (!o.flag) continue;
    const gate = ACT_PROGRESSION[o.act];
    if (!gate || !gate.requireFlags.includes(o.flag)) {
      fail(`objective ${o.id} has flag "${o.flag}" not in ACT_PROGRESSION[${o.act}].requireFlags`);
      bad++;
      continue;
    }
    const seen = seenPerAct.get(o.act) ?? new Set<string>();
    if (seen.has(o.flag)) {
      fail(`duplicate flag "${o.flag}" tagged on two objectives in act ${o.act}`);
      bad++;
    }
    seen.add(o.flag);
    seenPerAct.set(o.act, seen);
  }
  bad === 0 && pass('every tagged objective.flag matches a real, unique gate flag for its act');
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/qa-hints.ts`
Expected: FAIL to even run — `Property 'flag' does not exist on type 'HintObjective'` (TypeScript error from `tsx`), since `flag` hasn't been added to the interface yet.

- [ ] **Step 3: Add the field and populate it**

In `engine/stories/whitechapel-1888/hints.ts`, the `HintObjective` interface currently reads:

```ts
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
```

Add one field:

```ts
export interface HintObjective {
  id: string;
  act: number;
  locationId: string;
  verb: HintVerb;
  /** Neutral, player-facing noun phrase. MUST NOT reveal clue content. */
  subject: string;
  /** The exact ACT_PROGRESSION gate flag this objective's `done` tracks, when
   *  it maps 1:1 onto one (most do). Absent for prerequisite-only steps (e.g.
   *  examining the newspaper pile before it can be shown) and for objectives
   *  whose `done` isn't a single-flag check (Act 5's inventory-based steps). */
  flag?: string;
  done: (s: HintState) => boolean;
  available: (s: HintState) => boolean;
}
```

Then add `flag: '...'` to the 22 objectives below (every objective is otherwise unchanged — only the new field is added to each object literal):

- `a0_casewall` → `flag: 'examined_baker_street_case_files_wall',`
- `a0_holmes` → `flag: 'talked_to_holmes_at_baker_street',`
- `a0_newspile_show` → `flag: 'showed_newspaper_pile_to_holmes',`
- `a0_telegrams` → `flag: 'examined_baker_street_telegrams_pile',`
- `a1_hutchinson` → `flag: 'talked_to_hutchinson_at_dorset_street',`
- `a1_clothing` → `flag: 'examined_millers_court_burned_clothing',`
- `a1_bed` → `flag: 'examined_millers_court_the_bed',`
- `a1_bond` → `flag: 'talked_to_bond_at_millers_court',`
- `a2_mortuary` → `flag: 'examined_whitechapel_mortuary',`
- `a2_bucks` → `flag: 'examined_bucks_row',`
- `a2_hanbury` → `flag: 'examined_hanbury_street',`
- `a2_tumblety` → `flag: 'talked_to_tumblety_at_h_division_station',`
- `a2_holmes` → `flag: 'talked_to_holmes_at_h_division_station',`
- `a3_dutfields` → `flag: 'examined_dutfields_yard',`
- `a3_pizer` → `flag: 'talked_to_pizer_at_working_mens_club',`
- `a3_mitre` → `flag: 'examined_mitre_square',`
- `a3_goulston` → `flag: 'examined_goulston_street',`
- `a3_holmes` → `flag: 'talked_to_holmes_at_goulston_street',`
- `a4_lusk` → `flag: 'examined_lusk_office',`
- `a4_abberline` → `flag: 'talked_to_abberline_at_lusk_office',`
- `a4_holmes` → `flag: 'talked_to_holmes_at_lusk_office',`
- `a6_edmund` → `flag: 'talked_to_edmund_at_private_asylum',`

`a0_newspile_examine` (prerequisite-only, no real gate flag), `a5_letter`/`a5_note`/`a5_convergence`/`a5_deduce` (inventory/sentinel-based `done`, not a single flag check), and `a6_records` (its `done` flag `visited_private_asylum` **is** a real gate — tag it too) are the ones to double-check. Concretely, `a6_records` reads today:

```ts
  { id: 'a6_records', act: 6, locationId: 'private_asylum', verb: 'examine',
    subject: 'the patient records at the asylum',
    done: s => flag(s, 'visited_private_asylum'),
    available: s => locationReachable(s, 'private_asylum') },
```

Change to:

```ts
  { id: 'a6_records', act: 6, locationId: 'private_asylum', verb: 'examine',
    subject: 'the patient records at the asylum',
    flag: 'visited_private_asylum',
    done: s => flag(s, 'visited_private_asylum'),
    available: s => locationReachable(s, 'private_asylum') },
```

(same pattern for the other 21 — insert `flag: '<value>',` immediately after the `subject:` line of each listed objective).

Also add the import needed by the new test check — at the top of `scripts/qa-hints.ts`, the imports currently read:

```ts
import { OBJECTIVES, selectHint, HintState } from '../engine/stories/whitechapel-1888/hints';
import { ACT_PROGRESSION } from '../engine/stories/whitechapel-1888/acts';
```

`ACT_PROGRESSION` is already imported — no import changes needed in `qa-hints.ts`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx scripts/qa-hints.ts`
Expected: all checks `[PASS]`, ending `... passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add engine/stories/whitechapel-1888/hints.ts scripts/qa-hints.ts
git commit -m "feat(hints): tag gate-flag objectives with their exact flag name"
```

---

### Task 4: `diaryLeads.ts` — the pure detection module

**Files:**
- Create: `engine/stories/whitechapel-1888/diaryLeads.ts`
- Modify: `scripts/qa-diary-leads.ts`

- [ ] **Step 1: Write the failing tests**

In `scripts/qa-diary-leads.ts`, add these imports at the top (alongside the existing `resolveDiaryEntry` import):

```ts
import { ACT_PROGRESSION } from '../engine/stories/whitechapel-1888/acts';
import { CLUE_DEFINITIONS } from '../engine/stories/whitechapel-1888/clues';
import { DECISION_BY_FLAG } from '../engine/stories/whitechapel-1888/diaryDecisions';
import {
  isRequiredFlag,
  clueGateFlag,
  leadContextFor,
  detectSilentLeadFlags,
} from '../engine/stories/whitechapel-1888/diaryLeads';
```

Then append these checks before the final `console.log`/`process.exit` lines:

```ts
const SENTINEL = '__advance_via_correct_deduction_only__';

// 4) Drift guard: every real gate flag either has existing diary coverage
//    (a clue trigger or a DECISION_DIARY entry) or has hint-objective context
//    available for AI generation — nothing falls through with no way to
//    describe itself.
for (const [actStr, cond] of Object.entries(ACT_PROGRESSION)) {
  const act = Number(actStr);
  for (const f of cond.requireFlags) {
    if (f === SENTINEL) continue;
    const hasDecision = Boolean(DECISION_BY_FLAG[f]);
    const hasClue = Object.values(CLUE_DEFINITIONS).some(def => clueGateFlag(def) === f);
    const hasHintContext = leadContextFor(act, f) !== null;
    (hasDecision || hasClue || hasHintContext)
      ? pass(`gate has a diary path: act ${act} ${f}`)
      : fail('gate has NO diary coverage and NO hint context for AI generation', `act ${act} ${f}`);
  }
}

// 5) isRequiredFlag: true only for real gate flags of the given act; excludes
//    the Act 5 sentinel and flags belonging to other acts.
{
  isRequiredFlag(0, 'talked_to_holmes_at_baker_street')
    ? pass('isRequiredFlag: true for a real Prologue gate flag')
    : fail('isRequiredFlag should be true for a real Prologue gate flag');
  isRequiredFlag(5, SENTINEL)
    ? fail('isRequiredFlag should exclude the Act 5 sentinel')
    : pass('isRequiredFlag: sentinel excluded');
  isRequiredFlag(0, 'talked_to_hutchinson_at_dorset_street')
    ? fail('isRequiredFlag should not match a flag belonging to a different act')
    : pass('isRequiredFlag: cross-act flag correctly excluded');
}

// 6) clueGateFlag: matches the real Prologue flag for clue_00_campaign_timeline.
{
  const def = CLUE_DEFINITIONS['clue_00_campaign_timeline'];
  clueGateFlag(def) === 'examined_baker_street_case_files_wall'
    ? pass('clueGateFlag: clue_00_campaign_timeline maps to its real gate flag')
    : fail('clueGateFlag mismatch', clueGateFlag(def));
}

// 7) detectSilentLeadFlags: a Prologue turn setting all four gate flags at once
//    excludes the clue-covered and decision-covered ones, returning exactly the
//    two currently-silent leads.
{
  const silent = detectSilentLeadFlags({
    actNumber: 0,
    flagsUpdate: {
      examined_baker_street_case_files_wall: true,
      talked_to_holmes_at_baker_street: true,
      showed_newspaper_pile_to_holmes: true,
      examined_baker_street_telegrams_pile: true,
    },
    priorFlags: {},
    discoveredClueIds: ['clue_00_campaign_timeline'],
  });
  const set = new Set(silent);
  (set.size === 2
    && set.has('talked_to_holmes_at_baker_street')
    && set.has('examined_baker_street_telegrams_pile'))
    ? pass('detectSilentLeadFlags: Prologue turn returns exactly the 2 uncovered leads')
    : fail('detectSilentLeadFlags returned the wrong set', silent.join(','));
}

// 8) detectSilentLeadFlags: a flag already true before this turn is never re-queued.
{
  const silent = detectSilentLeadFlags({
    actNumber: 0,
    flagsUpdate: { talked_to_holmes_at_baker_street: true },
    priorFlags: { talked_to_holmes_at_baker_street: true },
    discoveredClueIds: [],
  });
  silent.length === 0
    ? pass('detectSilentLeadFlags: already-true flags are not re-queued')
    : fail('detectSilentLeadFlags re-queued an already-true flag', silent.join(','));
}

// 9) detectSilentLeadFlags: a non-gate flag (not in requireFlags) is ignored.
{
  const silent = detectSilentLeadFlags({
    actNumber: 0,
    flagsUpdate: { examined_baker_street_newspaper_pile: true },
    priorFlags: {},
    discoveredClueIds: [],
  });
  silent.length === 0
    ? pass('detectSilentLeadFlags: non-gate flags are ignored')
    : fail('detectSilentLeadFlags picked up a non-gate flag', silent.join(','));
}

// 10) leadContextFor: Act 6's location-level examine gate (visited_private_asylum)
//     resolves to hint context — it is that location's locationExaminedFlag, the
//     same mechanism as examined_baker_street, not an arrival flag.
{
  leadContextFor(6, 'visited_private_asylum') !== null
    ? pass('leadContextFor: Act 6 location-examine gate resolves to hint context')
    : fail('leadContextFor: visited_private_asylum should resolve (examine gate, not arrival)');
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/qa-diary-leads.ts`
Expected: fails to run — `Cannot find module '../engine/stories/whitechapel-1888/diaryLeads'`.

- [ ] **Step 3: Implement `diaryLeads.ts`**

Create `engine/stories/whitechapel-1888/diaryLeads.ts`:

```ts
/**
 * diaryLeads.ts — identifies ACT_PROGRESSION gate flags that fire with no
 * existing diary coverage (no clue trigger, no DECISION_DIARY entry), and
 * supplies the neutral hint-objective context used to ground their
 * AI-generated diary text. Pure, no I/O — testable without a running game.
 */
import type { HintVerb } from '../../../types';
import type { ClueDefinition } from '../types';
import { ACT_PROGRESSION } from './acts';
import { CLUE_DEFINITIONS } from './clues';
import { DECISION_BY_FLAG } from './diaryDecisions';
import { OBJECTIVES } from './hints';

/** True when `flag` is one of the real (non-sentinel) gate flags for `actNumber`. */
export function isRequiredFlag(actNumber: number, flag: string): boolean {
  const gate = ACT_PROGRESSION[actNumber];
  if (!gate) return false;
  return gate.requireFlags.includes(flag) && !flag.startsWith('__');
}

/** The gate flag a clue's triggering examine action sets, by naming convention. */
export function clueGateFlag(def: ClueDefinition): string {
  return `examined_${def.locationFound}_${def.triggerObject}`;
}

export interface LeadContext {
  verb: HintVerb;
  subject: string;
}

/** Neutral, spoiler-safe verb+subject for a gate flag, reused from the hint objective table. */
export function leadContextFor(actNumber: number, flag: string): LeadContext | null {
  const objective = OBJECTIVES.find(o => o.act === actNumber && o.flag === flag);
  return objective ? { verb: objective.verb, subject: objective.subject } : null;
}

/**
 * Flags that just became true this turn, gate progression for `actNumber`, and
 * have no existing diary-producing path (clue trigger or DECISION_DIARY entry).
 * These are the candidates for AI-generated lead entries.
 */
export function detectSilentLeadFlags(params: {
  actNumber: number;
  flagsUpdate: Record<string, boolean>;
  priorFlags: Record<string, boolean>;
  discoveredClueIds: string[];
}): string[] {
  const { actNumber, flagsUpdate, priorFlags, discoveredClueIds } = params;

  const clueCoveredFlags = new Set(
    discoveredClueIds
      .map(id => CLUE_DEFINITIONS[id])
      .filter((d): d is ClueDefinition => Boolean(d))
      .map(clueGateFlag),
  );

  return Object.entries(flagsUpdate)
    .filter(([f, value]) =>
      value === true
      && !priorFlags[f]
      && isRequiredFlag(actNumber, f)
      && !DECISION_BY_FLAG[f]
      && !clueCoveredFlags.has(f),
    )
    .map(([f]) => f);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsx scripts/qa-diary-leads.ts`
Expected: all checks `[PASS]`, ending `... passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add engine/stories/whitechapel-1888/diaryLeads.ts scripts/qa-diary-leads.ts
git commit -m "feat(diary): add diaryLeads pure module for silent-gate detection"
```

---

### Task 5: `generateLeadDiaryEntry` in `AIService`

**Files:**
- Modify: `services/AIService.ts`

- [ ] **Step 1: Add the method**

In `services/AIService.ts`, `generateJournalEntry` currently ends at:

```ts
    return response.text?.trim() || '';
  }

  /**
   * Constrained target resolver (NOT narration). Runs only when the deterministic
```

Insert a new method between them:

```ts
    return response.text?.trim() || '';
  }

  /**
   * Non-streaming call that fills in Watson's diary for a progression-gate flag
   * that has no hand-authored text (no clue trigger, no DECISION_DIARY entry).
   * Runs async, after the turn's narration has already completed — never blocks
   * the turn. `context` is deterministic, spoiler-safe, engine-supplied (reused
   * from the hint objective table); the AI only phrases it in Watson's voice,
   * grounded in what actually happened this turn.
   */
  async generateLeadDiaryEntry(context: {
    actName: string;
    verb: HintVerb;
    subject: string;
    narrationText: string;
  }): Promise<{ title: string; body: string }> {
    const verbCue: Record<string, string> = {
      examine: 'examined',
      talk: 'spoke with',
      show: 'showed',
      use: 'made use of',
      deduce: 'drew his conclusion about',
      reflect: 'turned over in his mind',
      travel: 'made his way to',
    };

    const prompt = `Watson has just ${verbCue[context.verb] || 'attended to'} ${context.subject}, during Act "${context.actName}".

What actually happened, in the turn's narration:
${context.narrationText}

Write a short diary entry recording this. First-person past tense, Watson's voice. A short evocative title (3-6 words, like a diary heading, no ending punctuation) and a body of 1-2 sentences. Ground the body in the narration above — do not invent details it doesn't contain. Never state a conclusion or name a suspect.`;

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_ID,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction:
            "You are Dr. John H. Watson recording a private diary entry. First-person past tense. Reflective, understated, historically authentic Victorian prose. Never reveal conclusions or the killer's identity.",
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'A short evocative diary heading, 3-6 words.' },
              body: { type: Type.STRING, description: "Watson's diary prose, 1-2 sentences." },
            },
            required: ['title', 'body'],
          },
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      return {
        title: (parsed.title || '').trim(),
        body: (parsed.body || '').trim(),
      };
    } catch {
      return { title: '', body: '' };
    }
  }

  /**
   * Constrained target resolver (NOT narration). Runs only when the deterministic
```

`HintVerb` and `Type` are both already imported at the top of this file — no import changes needed.

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add services/AIService.ts
git commit -m "feat(ai): add generateLeadDiaryEntry for silent progression leads"
```

---

### Task 6: Wire it into `useGameState.ts`

**Files:**
- Modify: `hooks/useGameState.ts`

- [ ] **Step 1: Import the new pieces**

No `gameData` import changes are needed — `ACT_PROGRESSION` membership is checked inside `diaryLeads.ts`, not directly in this file.

Just under the existing `import { selectHint } from '../engine/stories/whitechapel-1888/hints';` line, add:

```ts
import { isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags } from '../engine/stories/whitechapel-1888/diaryLeads';
```

- [ ] **Step 2: Declare the two new turn-scoped variables**

`pendingJournalSummary` is declared at [useGameState.ts:1242](../../../hooks/useGameState.ts):

```ts
      // Capture journal data before resetting per-act tracking (if act is advancing)
      let pendingJournalSummary: ActJournalSummary | null = null;
```

Add two more declarations right after it:

```ts
      // Capture journal data before resetting per-act tracking (if act is advancing)
      let pendingJournalSummary: ActJournalSummary | null = null;
      // Gate flags this turn satisfied with no existing diary text — filled in
      // asynchronously below (STEP 8b), once the turn's narration is known.
      let pendingLeadFlags: string[] = [];
      // The turn's final narration text, captured inside the STEP 7 stream loop —
      // used to ground STEP 8b's AI-generated diary prose.
      let finalNarrationText = '';
```

- [ ] **Step 3: Stamp `isLead` on the existing captures, and detect silent flags**

STEP 5b currently reads (`useGameState.ts:1289-1315`):

```ts
      // STEP 5b: Capture Watson's diary entries for clue discoveries and major
      // decisions. Deterministic — only a reference is stored; the authored
      // Watson line is resolved from story data at render time. Runs for guests
      // too (in-memory); persists only when signed in. (Act milestones are
      // captured later, once the reflective entry has been generated; act-boundary
      // arrivals are captured in beginNextAct.)
      {
        const captured: Array<Omit<DiaryEntry, 'id' | 'sequence'>> = [];
        if (result.discoveredClueIds) {
          for (const clueId of result.discoveredClueIds) {
            if (CLUE_DEFINITIONS[clueId]) captured.push({ kind: 'clue', refId: clueId, actNumber: currentAct, timeLabel: captureTimeLabel });
          }
        }
        if (result.flagsUpdate) {
          for (const [flag, value] of Object.entries(result.flagsUpdate)) {
            const decisionId = DECISION_BY_FLAG[flag];
            if (value === true && !flags[flag] && decisionId) {
              captured.push({ kind: 'decision', refId: decisionId, actNumber: currentAct, timeLabel: captureTimeLabel });
            }
          }
        }
        captureDiaryEntries(captured);
        // First arrival at a new location within the act.
        if (result.newLocation && !advancingAct) {
          captureLocationArrival(result.newLocation, currentAct, captureTimeLabel);
        }
      }
```

Replace it with:

```ts
      // STEP 5b: Capture Watson's diary entries for clue discoveries and major
      // decisions. Deterministic — only a reference is stored; the authored
      // Watson line is resolved from story data at render time. Runs for guests
      // too (in-memory); persists only when signed in. (Act milestones are
      // captured later, once the reflective entry has been generated; act-boundary
      // arrivals are captured in beginNextAct.)
      {
        const captured: Array<Omit<DiaryEntry, 'id' | 'sequence'>> = [];
        if (result.discoveredClueIds) {
          for (const clueId of result.discoveredClueIds) {
            const def = CLUE_DEFINITIONS[clueId];
            if (def) {
              captured.push({
                kind: 'clue',
                refId: clueId,
                actNumber: currentAct,
                timeLabel: captureTimeLabel,
                isLead: isRequiredFlag(currentAct, clueGateFlag(def)),
              });
            }
          }
        }
        if (result.flagsUpdate) {
          for (const [flag, value] of Object.entries(result.flagsUpdate)) {
            const decisionId = DECISION_BY_FLAG[flag];
            if (value === true && !flags[flag] && decisionId) {
              captured.push({
                kind: 'decision',
                refId: decisionId,
                actNumber: currentAct,
                timeLabel: captureTimeLabel,
                isLead: isRequiredFlag(currentAct, flag),
              });
            }
          }
        }
        captureDiaryEntries(captured);
        // First arrival at a new location within the act.
        if (result.newLocation && !advancingAct) {
          captureLocationArrival(result.newLocation, currentAct, captureTimeLabel);
        }
        // Gate flags with no existing diary coverage — filled in async, STEP 8b.
        if (result.flagsUpdate) {
          pendingLeadFlags = detectSilentLeadFlags({
            actNumber: currentAct,
            flagsUpdate: result.flagsUpdate,
            priorFlags: flags,
            discoveredClueIds: result.discoveredClueIds || [],
          });
        }
      }
```

- [ ] **Step 4: Capture the final narration text in STEP 7**

The `if (isComplete && parsed)` block in STEP 7 currently opens like this (`useGameState.ts:1368-1370`):

```ts
        if (isComplete && parsed) {
          // Anti-repetition memory: remember this narration's opening sentence
          const opening = extractOpeningSentence(parsed.markdownOutput);
```

Add one line at the top of the block:

```ts
        if (isComplete && parsed) {
          finalNarrationText = parsed.markdownOutput;

          // Anti-repetition memory: remember this narration's opening sentence
          const opening = extractOpeningSentence(parsed.markdownOutput);
```

- [ ] **Step 5: Add STEP 8b — generate and capture the silent leads**

STEP 8 currently ends and STEP 9 begins like this (`useGameState.ts:1459-1466`):

```ts
        // No diary to type out → reveal the Begin button immediately (no softlock).
        if (!appendedJournal) setIsActBreakReady(true);
      }

      // STEP 9: The true ending's scripted coda — authored verbatim, never
      // AI-generated. Fires once, after the final narration completes.
      // (Cold-case endings keep their AI diary epilogue from the main stream.)
      if (result.gameOver && result.endingType === 'true_ending') {
```

Insert a new block between them:

```ts
        // No diary to type out → reveal the Begin button immediately (no softlock).
        if (!appendedJournal) setIsActBreakReady(true);
      }

      // STEP 8b: Fill any progression-gate flags this turn left with no diary
      // text. Async, after narration — mirrors STEP 8, never blocks the turn.
      if (pendingLeadFlags.length > 0) {
        const actName = ACT_NAMES[currentAct] || `Act ${currentAct}`;
        for (const leadFlag of pendingLeadFlags) {
          const context = leadContextFor(currentAct, leadFlag);
          if (!context) continue; // no hint objective mapped to this flag — skip rather than guess
          try {
            const { title, body } = await aiService.generateLeadDiaryEntry({
              actName,
              verb: context.verb,
              subject: context.subject,
              narrationText: finalNarrationText,
            });
            if (title && body) {
              captureDiaryEntries([{
                kind: 'decision',
                refId: leadFlag,
                actNumber: currentAct,
                timeLabel: captureTimeLabel,
                text: `${title}\n${body}`,
                isLead: true,
              }]);
            }
          } catch {
            // Lead prose is bonus content — never block the game on failure
          }
        }
      }

      // STEP 9: The true ending's scripted coda — authored verbatim, never
      // AI-generated. Fires once, after the final narration completes.
      // (Cold-case endings keep their AI diary epilogue from the main stream.)
      if (result.gameOver && result.endingType === 'true_ending') {
```

- [ ] **Step 6: Verify it compiles**

Run: `npm run lint`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

```bash
git add hooks/useGameState.ts
git commit -m "feat(diary): stamp isLead on captures and fill silent gate flags async"
```

---

### Task 7: `DiaryModal.tsx` — the "Lead" pill and plain "New" text

**Files:**
- Modify: `components/DiaryModal.tsx:177-190`

- [ ] **Step 1: Replace the title block**

The entry title block currently reads:

```tsx
                                <div className="flex items-baseline justify-between gap-3">
                                  <p className={`text-sm text-lb-primary ${isReflection ? 'font-sans italic font-semibold' : 'font-semibold'}`}>
                                    {resolved.title}
                                    {isNew && (
                                      <span
                                        className="inline-block w-1.5 h-1.5 ml-2 rounded-full bg-lb-accent align-middle"
                                        title="New since you last opened your diary"
                                      />
                                    )}
                                  </p>
                                  {entry.timeLabel && (
                                    <span className="shrink-0 text-[11px] text-lb-muted tabular-nums">{entry.timeLabel}</span>
                                  )}
                                </div>
```

Replace it with:

```tsx
                                <div className="flex items-baseline justify-between gap-3">
                                  <p className={`text-sm text-lb-primary flex items-center flex-wrap gap-x-2 ${isReflection ? 'font-sans italic font-semibold' : 'font-semibold'}`}>
                                    <span>{resolved.title}</span>
                                    {entry.isLead && (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-lb-accent/50 bg-lb-accent/10 text-lb-accent text-[9px] font-bold tracking-wider uppercase">
                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />Lead
                                      </span>
                                    )}
                                    {isNew && (
                                      <span className="text-lb-accent text-xs font-bold italic" title="New since you last opened your diary">New</span>
                                    )}
                                  </p>
                                  {entry.timeLabel && (
                                    <span className="shrink-0 text-[11px] text-lb-muted tabular-nums">{entry.timeLabel}</span>
                                  )}
                                </div>
```

No prop or import changes needed — `entry.isLead` comes from the `DiaryEntry` type already imported, and `isNew` is the existing local variable two lines above this block.

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add components/DiaryModal.tsx
git commit -m "feat(diary): render the Lead pill and simplify the New indicator"
```

---

### Task 8: End-to-end manual verification (Prologue)

This step needs a running dev server and a real `GEMINI_API_KEY` (per [dev-env-quirks](../../../CLAUDE.md) — the app blank-pages without one). No code changes.

- [ ] **Step 1: Start the app and play the Prologue up to the silent leads**

Run: `npm run dev`, open the app, start a new game (or continue an existing Prologue save).

- [ ] **Step 2: Talk to Holmes**

Action: `talk to holmes`. Expected: normal narration, no visible delay change. Open Watson's Diary (the book icon) — after a short pause the "A Word with Holmes" entry (exact wording will vary — it's AI-generated) appears under **The Baker Street Vigil**, with a **Lead** pill next to its title and, since it's the newest entry, plain italic **New** text next to that.

- [ ] **Step 3: Examine the telegrams pile**

Action: `examine telegrams`. Expected: same as Step 2 — an entry with a **Lead** pill appears in the diary a moment after the turn resolves.

- [ ] **Step 4: Confirm the already-covered leads are unaffected**

Open the diary and check the existing entries for examining the case-files wall ("The Silence Since September") and showing the newspaper pile ("The Press Hoax") — both should now also show the **Lead** pill (they always were leads; this is the first time it's visibly marked), with their existing hand-authored text unchanged.

- [ ] **Step 5: Confirm the leads pip matches**

The act header's `● ● ● ●  leads` pip count (found/total) should equal the number of **Lead**-pilled entries currently showing as done for the Prologue — by the time all four are complete, 4/4.

- [ ] **Step 6: Confirm flavor entries are unaffected**

The "221B Baker Street" location-arrival entry should show neither a Lead pill nor (once you're a couple of entries past it) the New text — confirming flavor entries stay untouched.

- [ ] **Step 7: Report results**

If any step doesn't match, note which one and what was observed instead — do not proceed past a mismatch, since later Prologue/Act 1 leads reuse the exact same mechanism.

---

## Self-review notes

- **Spec coverage:** every numbered section of the design spec has a task — data model (Task 1), gap-detection + async generation (Tasks 3, 4, 5, 6), visual treatment (Task 7). The spec's testing section (drift guard, `isLead` correctness, no double-logging, async doesn't block) is covered by Task 4's drift guard/detection tests and Task 6's manual verification (async non-blocking is inherently exercised by the STEP 8b placement, and is why the plan bothers threading `finalNarrationText` through a turn-scoped `let` rather than reading it after the fact).
- **Corrected during planning:** the design spec's original exclusion of `visited_<loc>`-style flags (treating them as arrival-covered flavor) was based on a wrong premise — `visited_private_asylum` is a location-level examine flag, not an arrival flag, and `captureLocationArrival` doesn't correlate with any gate flag at all. The spec was corrected before this plan was written; Task 3/Task 4 tag and test `a6_records`/`visited_private_asylum` as a normal silent-lead candidate, not an excluded one.
- **Type consistency check:** `detectSilentLeadFlags`'s return type (`string[]`) matches how Task 6 consumes it (`for (const leadFlag of pendingLeadFlags)`); `leadContextFor`'s `LeadContext` shape (`{ verb: HintVerb; subject: string }`) matches exactly what `generateLeadDiaryEntry`'s `context` parameter expects; `generateLeadDiaryEntry`'s return shape (`{ title: string; body: string }`) matches how Task 6 destructures it and how Task 2's `resolveDiaryEntry` branch expects `text` to be formatted (`"title\nbody"`, joined at the Task 6 call site, split at the Task 2 branch).
- **No placeholders:** every step has complete, copy-pasteable code; no task says "add validation" or "handle edge cases" without showing exactly what that means.
