# Location Header in Narrative Output — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a deterministic pin-icon location header above narration on every move/look/scene-entry, and show the act heading only on scene-entry narrations (opening, act arrival, resume) — per the approved spec at `docs/superpowers/specs/2026-07-14-location-header-design.md`.

**Architecture:** Headings become client-owned UI chrome instead of AI prose. `GameHistoryItem` gains optional `actHeading`/`location` fields set deterministically by the stream producers from engine-verified data (`NarrationContext.locationName`); `NarrativeFeed` renders them above the prose. The `Begin with: ### …` instruction is removed from the AI prompts, with a pure `stripLeadingActHeading` helper as a defensive net.

**Tech Stack:** React + TypeScript (Vite), lucide-react icons, tsx QA harnesses (no jest/vitest — `npm run qa:narration-inject` is the test vehicle for the pure helpers; `tsc --noEmit` via `npm run lint` is the type gate).

**Repo context an implementer needs:**
- Working dir: repo root. All paths below are repo-relative.
- The AI never mutates state; it only narrates. The location name in `NarrationContext` is engine-verified — rendering it client-side is exactly the project's engine/AI contract.
- Engine sets `narrationMode: 'full'` for successful moves and target-less looks, `'compact'` for everything else (`engine/narrationContext.ts:152`). Full/opening turns are exactly the turns that get a location header.
- History is never replayed across sessions (resume streams a fresh look), so the new optional fields need no save-data migration.
- If executing in a git worktree: copy `.env.local` from the main repo root into the worktree first (needed for AI narration in the live playtest; do it proactively).

---

### Task 0: Branch + spec commit

**Files:** none (git only)

- [ ] **Step 0.1: Create the feature branch**

```bash
git checkout -b feat/location-header
```

- [ ] **Step 0.2: Commit the approved spec**

```bash
git add docs/superpowers/specs/2026-07-14-location-header-design.md docs/superpowers/plans/2026-07-14-location-header.md
git commit -m "docs: spec + plan for location header in narrative output"
```

---

### Task 1: Pure helpers — `formatActHeading` + `stripLeadingActHeading` (TDD)

**Files:**
- Modify: `services/narrationFormat.ts`
- Test: `scripts/qa-narration-inject.ts` (this repo's harness for the narration-format seam)

- [ ] **Step 1.1: Add failing assertions to the harness**

In `scripts/qa-narration-inject.ts`, change the narrationFormat import (currently line 22) to:

```ts
import { injectAfterHeading, stripLeadingActHeading, formatActHeading } from '../services/narrationFormat';
```

Then insert the following block immediately after the existing "No heading at all" / "multiple headings" helper-level cases (after the case labelled `multiple headings: line lands after the first only`, before the `── ACT_BRIDGES integration ──` section). `HEADING`, `SCENE`, and `LINE` are the consts already defined at the top of the harness:

```ts
// ── stripLeadingActHeading (defensive net — prompts no longer ask for a heading) ──

// A. Complete heading line is removed along with its trailing blank line(s).
{
  const out = stripLeadingActHeading(HEADING + SCENE);
  check('strip: heading line removed, scene preserved', out === SCENE);
}

// B. Partial mid-stream heading (no newline yet) strips to nothing until the
//    line completes — never show a half-typed heading.
{
  check('strip: partial heading strips to empty',
    stripLeadingActHeading('### ACT I: The La') === '');
}

// C. Text without a heading is untouched.
{
  check('strip: no heading is a no-op', stripLeadingActHeading(SCENE) === SCENE);
}

// D. Strip-then-inject composition — the exact consumer order in useSceneStreams.
{
  const out = injectAfterHeading(stripLeadingActHeading(HEADING + SCENE), LINE);
  check('strip+inject: authored line leads, heading gone', out === LINE + SCENE);
}

// E. Only the leading line goes — a later ### subhead in the body survives.
{
  const body = HEADING + 'Intro.\n\n### A later subhead\n\nMore.';
  check('strip: later subhead untouched',
    stripLeadingActHeading(body) === 'Intro.\n\n### A later subhead\n\nMore.');
}

// ── formatActHeading (feed chrome string — CSS uppercases it) ─────────────────
{
  check('formatActHeading: prologue',
    formatActHeading(0) === 'Prologue: The Baker Street Vigil');
  check('formatActHeading: act 3 roman numeral',
    formatActHeading(3) === 'Act III: The Double Event');
  check('formatActHeading: unknown act degrades gracefully',
    formatActHeading(9) === 'Act 9');
}
```

- [ ] **Step 1.2: Run the harness to verify it fails**

Run: `npm run qa:narration-inject`
Expected: FAIL — tsx errors because `stripLeadingActHeading` / `formatActHeading` are not exported from `services/narrationFormat.ts`.

- [ ] **Step 1.3: Implement the helpers**

In `services/narrationFormat.ts`, update the header comment and add imports + the two functions. The full file becomes:

```ts
// Pure narration-text helpers. No React, no AI, no mutable game state (static
// story constants only) — safe to import from the hook and from the QA
// harness alike.

import { ACT_NAMES } from '../engine/gameData';
import { ACT_ROMAN } from '../constants';

/**
 * Inject an authored line as its own paragraph immediately after a streamed
 * Markdown `### …` heading. Used to splice deterministic, authored prose — the
 * opening's fixed line, and each act's arrival "bridge" — into AI-streamed
 * narration that the model never sees and cannot alter.
 *
 * Mid-stream the heading line may not be terminated by a newline yet; in that
 * case we prepend, and the line snaps into place once the newline arrives. An
 * empty `line` is a no-op, so callers can pass a bridge that may not exist.
 *
 * Since headings became feed chrome (see formatActHeading) the streamed text
 * normally has no heading — callers strip first, so this degrades to a plain
 * prepend; the heading branch remains as a second net.
 */
export function injectAfterHeading(text: string, line: string): string {
  if (!line) return text;
  const match = text.match(/^(###[^\n]*\n\n?)/);
  return match ? match[1] + line + text.slice(match[1].length) : line + text;
}

/**
 * Chrome heading for scene-entry narrations — "Prologue: The Baker Street
 * Vigil", "Act III: The Double Event". Rendered by NarrativeFeed above the
 * prose (its CSS uppercases it), set only by the opening / act-arrival /
 * resume generators, never on ordinary turns.
 */
export function formatActHeading(act: number): string {
  const prefix = act === 0 ? 'Prologue' : `Act ${ACT_ROMAN[act] ?? act}`;
  const name = ACT_NAMES[act];
  return name ? `${prefix}: ${name}` : prefix;
}

/**
 * Defensive net: the prompts no longer ask for a `### ACT …` heading, but a
 * disobedient generation may still emit one. Remove a leading `###` line —
 * including a partial one still streaming (no terminating newline yet), which
 * strips to nothing until the line completes.
 */
export function stripLeadingActHeading(text: string): string {
  if (!text.startsWith('###')) return text;
  const nl = text.indexOf('\n');
  if (nl === -1) return '';
  return text.slice(nl + 1).replace(/^\n+/, '');
}
```

- [ ] **Step 1.4: Run the harness to verify it passes**

Run: `npm run qa:narration-inject`
Expected: PASS — all assertions, including the new strip/format cases.

- [ ] **Step 1.5: Type-check and commit**

Run: `npm run lint`
Expected: clean (exit 0).

```bash
git add services/narrationFormat.ts scripts/qa-narration-inject.ts
git commit -m "feat(narration): add formatActHeading + stripLeadingActHeading helpers"
```

---

### Task 2: Data model + feed rendering

**Files:**
- Modify: `types.ts:14-18` (`GameHistoryItem`)
- Modify: `components/NarrativeFeed.tsx`

- [ ] **Step 2.1: Extend `GameHistoryItem`**

In `types.ts`, replace the interface (lines 14–18) with:

```ts
export interface GameHistoryItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
  type?: 'journal'; // marks act-closing diary entries in the narrative feed
  /** Scene-entry chrome (opening / act arrival / resume only) — rendered by the feed, never part of the AI text. */
  actHeading?: string;
  /** Engine-verified location name, set on full/opening-mode turns (move / look / scene entry) — rendered as the pin header. */
  location?: string;
}
```

- [ ] **Step 2.2: Add the `SceneHeader` component and render it in `NarrativeFeed.tsx`**

Change the lucide import (line 10) to:

```tsx
import { Feather, MapPin } from 'lucide-react';
```

Add this module-level component directly above `export function NarrativeFeed(`:

```tsx
/**
 * Deterministic scene chrome above the narrated prose: the act heading (scene
 * entries only) and the pin + location-name header (any full-mode turn). Data
 * comes from engine-verified fields on the history item — the AI has no hand
 * in it. Renders immediately; the prose typewrites below.
 */
function SceneHeader({ actHeading, location }: { actHeading?: string; location?: string }) {
  if (!actHeading && !location) return null;
  return (
    <div className="mb-6 space-y-4">
      {actHeading && (
        <h4 className="pt-8 text-sm font-bold tracking-[0.2em] uppercase text-lb-primary opacity-80 font-sans">
          {actHeading}
        </h4>
      )}
      {location && (
        <div className="flex items-center gap-2.5">
          <MapPin size={18} className="text-lb-accent shrink-0" />
          <span className="font-sans font-bold text-lb-primary text-[16px] md:text-[18px] lg:text-[20px]">
            {location}
          </span>
        </div>
      )}
    </div>
  );
}
```

(The `h4` classes mirror `StoryRenderer`'s existing `###` styling; the location text sizes mirror the prose body sizes, bold, matching the mockup. `MapPin size={18}` matches the sidebar's usage.)

Then update the two AI-message branches. The latest-message branch (currently `if (isLast && isAI && !isJournal && msg.text !== '')`) becomes — note the widened condition so headers show while the first chunk is still in flight:

```tsx
          // Latest AI message — typewriter animation while streaming
          if (isLast && isAI && !isJournal && (msg.text !== '' || msg.actHeading || msg.location)) {
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8"
              >
                <SceneHeader actHeading={msg.actHeading} location={msg.location} />
                <TypewriterBlock text={msg.text} />
              </motion.div>
            );
          }
```

And the previous-messages branch (currently `if (isAI && !isJournal && msg.text !== '')`) becomes:

```tsx
          // Previous AI messages — static render
          if (isAI && !isJournal && (msg.text !== '' || msg.actHeading || msg.location)) {
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8"
              >
                <SceneHeader actHeading={msg.actHeading} location={msg.location} />
                <StoryRenderer text={msg.text} />
              </motion.div>
            );
          }
```

- [ ] **Step 2.3: Type-check and commit**

Run: `npm run lint`
Expected: clean.

```bash
git add types.ts components/NarrativeFeed.tsx
git commit -m "feat(ui): SceneHeader chrome — act heading + pin location header on history items"
```

---

### Task 3: Prompt changes — stop asking the AI for headings

**Files:**
- Modify: `server/aiCore.ts` (lines ~30, ~176-178, ~248, ~263, ~304)

- [ ] **Step 3.1: Remove the heading instructions**

1. Delete the now-dead `actHeader` const (lines 176–178):

```ts
  const actHeader = ctx.act === 0
    ? `PROLOGUE`
    : `ACT ${ACT_ROMAN[ctx.act] ?? String(ctx.act)}`;
```

2. Remove `ACT_ROMAN` from the import at line 30 (`import { ACT_ROMAN } from '../constants.js';` — that was its only use; delete the whole import line).

3. **Opening mode** (line ~248): replace

```
Write exactly 2 short paragraphs (max 130 words total). Begin with: ### ${actHeader}: ${ctx.actName}
```

with

```
Write exactly 2 short paragraphs (max 130 words total). Do NOT include any Markdown heading — begin directly with the prose.
```

4. **Opening mode closing rules** (line ~263): replace

```
NO blockquote. NO exits listing. NO character roster. NPCs, objects, and exits will be appended separately.
```

with

```
NO Markdown headings. NO blockquote. NO exits listing. NO character roster. NPCs, objects, and exits will be appended separately.
```

5. **Full mode** (line ~304): replace

```
${lengthLine} Begin with: ### ${actHeader}: ${ctx.actName}
```

with

```
${lengthLine} Do NOT include any Markdown heading (no "###" line) — begin directly with the prose.
```

- [ ] **Step 3.2: Verify nothing else referenced the heading**

Run: `grep -n "actHeader\|ACT_ROMAN" server/aiCore.ts`
Expected: no matches.

Run: `npm run lint && npm run qa:narration-inject`
Expected: both clean (the harness's `buildNarrationPrompt` case tests `recentlyHeard`, not headings).

- [ ] **Step 3.3: Commit**

```bash
git add server/aiCore.ts
git commit -m "feat(narration): drop AI-emitted act headings — headings are feed chrome now"
```

---

### Task 4: Scene-entry producers (`useSceneStreams.ts`)

**Files:**
- Modify: `hooks/gameState/useSceneStreams.ts`

- [ ] **Step 4.1: Update imports**

Line 5 becomes:

```ts
import { injectAfterHeading, stripLeadingActHeading, formatActHeading } from '../../services/narrationFormat';
```

Line 8: remove `ACT_NAMES` (its only use, the resume catch fallback, goes away below):

```ts
import { ACT_BRIDGES, ITEM_SPENT_AFTER_ACT, formatGameClock } from '../../engine/gameData';
```

- [ ] **Step 4.2: `generateOpeningScene` — set both header fields, strip before inject**

Replace the body between `setIsLoading(true);` and the `finally` with (changes: `actHeading`/`locationLabel` consts, header fields on every `setHistory`, `stripLeadingActHeading` before `injectAfterHeading`):

```ts
    setIsLoading(true);
    const actHeading = formatActHeading(INITIAL_ACT);
    let locationLabel: string | undefined;
    setHistory([{ role: 'assistant', text: '', actHeading }]);

    try {
      const intent = parseIntent('look');
      const snapshot: SessionSnapshot = {
        location: INITIAL_LOCATION,
        inventory: INITIAL_INVENTORY,
        flags: {},
        npcStates: INITIAL_NPC_STATES as Record<string, NPCState>,
        currentAct: INITIAL_ACT,
        medicalPoints: 0,
        moralPoints: 0,
        discoveredClueIds: [],
        investigationId: undefined,
        turnsAtLocationWithoutProgress: 0,
        elapsedMinutes: 0,
        introducedNpcs: INITIAL_INTRODUCED_NPCS,
        locationVisitCounts: {},
        turnCount: 0,
        rumorEvents: {},
      };
      const result = gameEngine.resolve(intent, snapshot);
      commitVignetteFlags(result.flagsUpdate, {}, activeInvestigation?.id);
      locationLabel = result.aiContext.locationName;

      const OPENING_FIXED_LINE = "I arrived at Baker Street on the evening of the eighth of November, 1888 - three months after the Jack the Ripper murders had begun, and the day before it concluded.\n\n";
      let lastText = '';
      for await (const update of aiService.stream({ ...result.aiContext, narrationMode: 'opening', blockquoteHint: 'none' })) {
        if (update.narrative) {
          lastText = update.narrative;
          setHistory([{
            role: 'assistant',
            text: injectAfterHeading(stripLeadingActHeading(lastText), OPENING_FIXED_LINE),
            actHeading,
            location: locationLabel,
          }]);
        }
      }
      if (!lastText) setHistory([{ role: 'assistant', text: OPENING_FIXED_LINE + OPENING_FALLBACK_NARRATIVE, actHeading, location: locationLabel }]);
    } catch (error) {
      console.error('Opening scene generation failed:', error);
      setHistory([{ role: 'assistant', text: OPENING_FALLBACK_NARRATIVE, actHeading, location: locationLabel }]);
    } finally {
      setIsLoading(false);
    }
```

- [ ] **Step 4.3: `streamResumeScene` — header fields + strip; drop the `###` text fallback**

Changes inside the function:

1. The feed-clearing line (`setHistory([{ role: 'assistant', text: '' }]);`) becomes:

```ts
    const actHeading = formatActHeading(resume.act);
    setHistory([{ role: 'assistant', text: '', actHeading }]);
```

2. Immediately after `commitVignetteFlags(result.flagsUpdate, resume.flags, resume.investigationId);` add:

```ts
      const locationLabel = result.aiContext.locationName;
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], location: locationLabel };
        return next;
      });
```

3. In the stream loop, the text assignment becomes (strip added; the spread already preserves the header fields):

```ts
            next[next.length - 1] = { ...next[next.length - 1], text: stripLeadingActHeading(last) };
```

4. The catch block's `setHistory` (which wrote `### ${ACT_NAMES[resume.act] ?? …}` into `text`) is deleted — the structured header is already on the item. The catch becomes:

```ts
    } catch (e) {
      console.error('Resume scene failed', e);
      // The actHeading/location chrome is already on the history item — the
      // player still sees where they are; no text fallback needed.
    }
```

- [ ] **Step 4.4: `streamArrivalScene` — same pattern for act arrival**

1. The feed-clearing line becomes:

```ts
    const actHeading = formatActHeading(toAct);
    setHistory([{ role: 'assistant', text: '', actHeading }]);
```

2. After `commitVignetteFlags(result.flagsUpdate, flags, activeInvestigation?.id);` add:

```ts
      const locationLabel = result.aiContext.locationName;
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], location: locationLabel };
        return next;
      });
```

3. In the stream loop, the text assignment becomes:

```ts
            next[next.length - 1] = { ...next[next.length - 1], text: injectAfterHeading(stripLeadingActHeading(last), bridge) };
```

4. The catch block's `setHistory` (which wrote `### Act ${toAct}`) is deleted, mirroring Step 4.3:

```ts
    } catch (e) {
      console.error('Arrival scene failed', e);
      // The actHeading/location chrome is already on the history item.
    }
```

- [ ] **Step 4.5: Type-check and commit**

Run: `npm run lint && npm run qa:narration-inject`
Expected: both clean. (If `lint` flags an unused `ACT_NAMES` import you missed Step 4.1's second edit.)

```bash
git add hooks/gameState/useSceneStreams.ts
git commit -m "feat(scenes): opening/arrival/resume set actHeading + location chrome; strip stray AI headings"
```

---

### Task 5: Ordinary turns (`useGameState.ts` `handleAction`)

**Files:**
- Modify: `hooks/useGameState.ts` (import block; ~line 668 before "STEP 7"; the stream loop at ~line 671)

- [ ] **Step 5.1: Import the strip helper**

Add to the imports at the top of `hooks/useGameState.ts`:

```ts
import { stripLeadingActHeading } from '../services/narrationFormat';
```

- [ ] **Step 5.2: Set `location` on full-mode turns**

Immediately before the `// STEP 7: Stream AI narration` comment, add:

```ts
      // Location header — full-mode turns (successful move / target-less look)
      // surface the engine-verified location name as feed chrome above the
      // prose (see NarrativeFeed's SceneHeader). Compact turns get no header.
      if (aiContext.narrationMode === 'full') {
        const locationLabel = aiContext.locationName;
        setHistory(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], location: locationLabel };
          return next;
        });
      }
```

- [ ] **Step 5.3: Strip stray headings from full-mode streams**

In the stream loop, replace:

```ts
      for await (const update of aiService.stream(aiContext)) {
        const { narrative, isComplete, parsed } = update;
        const displayText = isComplete ? narrative + pickupNote : narrative;
```

with:

```ts
      for await (const update of aiService.stream(aiContext)) {
        const { narrative, isComplete, parsed } = update;
        // Defensive: full-mode prompts no longer ask for a heading, but strip
        // any the model still emits (compact mode never produced one).
        const cleaned = aiContext.narrationMode === 'full' ? stripLeadingActHeading(narrative) : narrative;
        const displayText = isComplete ? cleaned + pickupNote : cleaned;
```

(The `setHistory` below it spreads the previous item, so the `location` field set in Step 5.2 survives every stream update. `finalNarrationText`/cloud log keep the raw `parsed.markdownOutput` — per spec, out of scope.)

- [ ] **Step 5.4: Type-check and commit**

Run: `npm run lint`
Expected: clean.

```bash
git add hooks/useGameState.ts
git commit -m "feat(turns): pin location header on full-mode turns; strip stray headings"
```

---

### Task 6: Deterministic QA sweep

**Files:** none (verification only)

- [ ] **Step 6.1: Full suite**

Run: `npm run qa:all`
Expected: every suite passes (engine, parser, hints, diary-leads, validate + lint). Nothing in this change touches engine logic or story data, so failures here mean a regression — stop and fix before proceeding.

- [ ] **Step 6.2: The seam harness once more**

Run: `npm run qa:narration-inject`
Expected: PASS.

---

### Task 7: Live playtest verification (required — see memory: playtest catches what review can't)

**Files:** none (verification only). Needs `GEMINI_API_KEY` in `.env.local` (copy from main repo root if in a worktree).

- [ ] **Step 7.1: Start the dev server and open the game**

Use the browser-preview tooling to start the Vite dev server (`npm run dev`, port 3000) and open it. Play as guest if auth is offered.

- [ ] **Step 7.2: Opening scene matches the mockup**

Verify, in order, in the feed:
1. "PROLOGUE: THE BAKER STREET VIGIL" small-caps heading (chrome, appears instantly).
2. Pin icon + **221B Baker Street** below it.
3. The fixed "I arrived at Baker Street…" line, then AI prose — with **no** `###` heading text inside the prose.
Take a screenshot for the user.

- [ ] **Step 7.3: Compact turn shows no header**

Type `examine case files wall`. Expected: narration renders with NO act heading and NO pin header.

- [ ] **Step 7.4: Look shows the pin header only**

Type `look`. Expected: pin + "221B Baker Street", no act heading, prose below.

- [ ] **Step 7.5: Move shows the pin header only**

Progress the prologue until an exit unlocks (examining the case files wall / talking to Holmes opens Dorset Street), then `go to dorset street`. Expected: pin + "Dorset Street" (exact label from the location data), NO act heading. This is the exact confusion the feature fixes — confirm it reads clearly.

- [ ] **Step 7.6: Act transition shows both headers**

If Act I is reachable in a few more turns, continue through the act break ("Begin Act I" button). Expected: fresh feed with "ACT I: THE LAST MURDER" heading + pin location header, bridge line, then prose. If reaching it takes too long, note that this path uses the identical `SceneHeader` + `formatActHeading` code proven in 7.2 and say so in the report.

- [ ] **Step 7.7: Console check**

Read the browser console for errors/warnings introduced by the change. Expected: none.

- [ ] **Step 7.8: Commit any playtest-driven fixes**

If the playtest surfaced fixes, apply them, re-run `npm run lint && npm run qa:narration-inject`, and commit:

```bash
git add -A && git commit -m "fix(ui): playtest follow-ups for location header"
```

---

### Task 8: AI narration quality pass (needs `GEMINI_API_KEY`)

**Files:** none (verification only)

- [ ] **Step 8.1: Generate the narration report**

Run: `npx tsx scripts/qa-narration.ts`
Expected: `qa-narration-report.md` generated.

- [ ] **Step 8.2: Review the report**

Check the full/opening-mode fixtures' outputs: no `###` heading lines in the prose, word budgets respected, prose quality unchanged. Flag anything off to the user rather than silently accepting it.

---

### Task 9: Finish the branch

- [ ] **Step 9.1:** Use the superpowers:finishing-a-development-branch skill to present merge/PR options to the user (this feature was user-requested UI work; a PR to `main` matches how feat/npc-approaches was landed).
