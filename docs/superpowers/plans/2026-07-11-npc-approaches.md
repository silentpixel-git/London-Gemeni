# NPC Approaches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The world initiates contact — authored one-shot beats where a present NPC steps up to Watson with mundane texture or a matured rumor, deterministically selected, never stomping a dramatic turn.

**Architecture:** A new manifest table (`approaches`) modeled on the vignette/rumor pattern; selection happens in `GameEngine.resolve()` *after* act/anchor/ending handling (full visibility of the turn's outcome), delivered on `NarrationContext.npcApproach`, with once-flags on the normal flags channel and the cooldown timestamp in one new optional session field. An approach counts as a first TALK for introductions: self-introduction NPCs give their name in-beat; document-gated NPCs (Edmund) stay alias-masked.

**Tech Stack:** TypeScript, deterministic engine + qa harnesses; one prompt-block addition in `server/aiCore.ts`.

**Spec:** `docs/superpowers/specs/2026-07-11-open-act-cab-and-npc-approaches-design.md`

**Branch:** `feat/npc-approaches` (create from `main` after the cab PR merges — the selector skips `conveyance` locations, which Task 3 references; if the cab branch is not merged yet, branch from it instead and say so in the PR).

---

### Task 1: Types and manifest field

**Files:**
- Modify: `engine/stories/types.ts`
- Modify: `types.ts` (NarrationContext + EngineResult)
- Modify: `engine/session.ts`
- Modify: `engine/stories/whitechapel-1888/manifest.ts`
- Create: `engine/stories/whitechapel-1888/approaches.ts`

- [ ] **Step 1: Add `ApproachDefinition` to `engine/stories/types.ts`**

After the `RumorDefinition` block (~line 145):

```ts
// ── NPC approaches ───────────────────────────────────────────────────────────
// The world initiates contact: authored one-shot beats where a present NPC
// steps up to Watson unprompted — mundane texture, or a matured rumor
// delivered. Fired once via flag `approach_<id>`; at most one per turn,
// first-eligible in file order; the engine suppresses them on dramatic
// turns (see engine/approaches.ts). An approach counts as a first TALK for
// introduction purposes: self-introduction NPCs reveal their name in-beat,
// document-gated NPCs stay alias-masked.
export interface ApproachDefinition<F extends string = string> {
  id: string;                      // unique, snake_case
  npcId: string;
  locationId: string | 'any';      // 'any' = wherever the NPC's schedule has them
  acts?: number[];                 // omit = any act the NPC is onstage
  timePeriods?: TimePeriod[];      // omit = any period
  requireFlags?: F[];
  forbidFlags?: F[];
  kind: 'mundane' | 'rumor';
  // The authored beat — the canonical content spine the AI dresses but never
  // extends. For 'rumor', the delivery framing around the matured statement.
  text: string;
  rumorId?: string;                // required iff kind === 'rumor'
}
```

And add to `StoryManifest` (after `rumors`):

```ts
  // NPC approaches
  approaches: ApproachDefinition[];
```

- [ ] **Step 2: Add the context + result + session fields**

`types.ts` — on `NarrationContext` (near `npcScriptedLines`):

```ts
  // NPC approach — a present NPC initiates contact this turn. `text` is the
  // authored content spine. When introducesSelf, the AI must narrate the
  // name reveal (label → realName), mirroring targetNpcInterview's
  // introducingThisTurn contract.
  npcApproach?: {
    npcId: string;
    label: string;            // alias until introduced, then displayName
    isIntroduced: boolean;
    introducesSelf: boolean;
    realName?: string;        // only when introducesSelf
    kind: 'mundane' | 'rumor';
    text: string;
  };
```

`types.ts` — on `EngineResult` (near `minutesAdvanced`):

```ts
  // Set when an approach fired this turn: the in-game clock value used for
  // the cooldown. The hook stores it into session.lastApproachAtMinutes.
  approachAtMinutes?: number;
```

`engine/session.ts` — on `SessionSnapshot`:

```ts
  // In-game clock value (act canonical start + elapsed) of the last NPC
  // approach — drives the 30-minute cooldown. Optional: absent on old saves.
  lastApproachAtMinutes?: number;
```

- [ ] **Step 3: Create the data file with two seed approaches**

`engine/stories/whitechapel-1888/approaches.ts` — seeds prove both kinds; the full authoring pass is Task 6. **Before writing this file:** open `rumors.ts`, take the first `RumorDefinition`'s `id` and the `npcId` of its first `spread` entry, and use those for the second seed (`rumorId` and `npcId` below); set its `locationId` to a location that NPC's schedule actually reaches (check `scheduleByAct` in `npcs.ts`), or `'any'`. Confirm `hutchinson` exists with a `dorset_street` act-1 schedule for the first seed (it does per the current data — reverify).

```ts
import type { ApproachDefinition } from '../types';
import type { StoryFlag } from './flags';

// Authored NPC approaches — the world initiating contact. Load the historian
// skill before adding entries. Rules (spec 2026-07-11):
// - text must not reference datable happenings unless gated: a world event ⇒
//   requireFlags includes its world_event_<id> flag; an act-specific
//   happening ⇒ acts starts no earlier than that act.
// - Edmund must have mundane approaches like everyone else (recession rule:
//   an approach system where only the innocent initiate contact is a tell).
export const APPROACHES: ApproachDefinition<StoryFlag>[] = [
  {
    id: 'hutchinson_dorset_weather',
    npcId: 'hutchinson',
    locationId: 'dorset_street',
    acts: [1],
    kind: 'mundane',
    text: 'A man detaches himself from the crowd to remark that he has stood this corner half the night, and that the rain has only now thought to stop.',
  },
  {
    // ids sourced from rumors.ts per the Step 3 instruction above
    id: 'rumor_delivery_seed',
    npcId: '<first spread recipient of the first rumor>',
    locationId: 'any',
    kind: 'rumor',
    rumorId: '<first rumor id>',
    text: 'They cross to Watson, voice dropped low, to pass on what has reached them.',
  },
];
```

- [ ] **Step 4: Wire into the manifest**

`engine/stories/whitechapel-1888/manifest.ts`, beside the `RUMORS` import and `rumors:` field:

```ts
import { APPROACHES } from './approaches';
// ...
  approaches: APPROACHES,
```

- [ ] **Step 5: Typecheck**

Run: `npm run lint`
Expected: PASS (the manifest requires the new field; nothing consumes it yet).

- [ ] **Step 6: Commit**

```bash
git add engine/stories/types.ts types.ts engine/session.ts engine/stories/whitechapel-1888/approaches.ts engine/stories/whitechapel-1888/manifest.ts
git commit -m "feat(story): ApproachDefinition type, manifest field, seed approaches"
```

---

### Task 2: Failing qa:engine tests for the selector

**Files:**
- Modify: `scripts/qa-engine.ts` (new section before the summary)

- [ ] **Step 1: Write the tests**

They build a private manifest copy with controlled approaches, so authoring changes never break them. Uses existing helpers (`buildSnapshot`, `pass`, `fail`) plus `GameEngine` and `WHITECHAPEL_MANIFEST` (both already imported). Pick for `SELF_INTRO_NPC` an NPC with `requiresIntroduction: true` and no `introduction` field (see npcs.ts — e.g. hutchinson) and note his act-1 scheduled location; `dorset_street` is assumed below.

```ts
// ── NPC approaches ───────────────────────────────────────────────────────────
console.log('\n── NPC approaches ──');
{
  const SELF_INTRO_NPC = 'hutchinson'; // requiresIntroduction, introduction absent = self
  const mkEngine = (approaches: any[]) =>
    new GameEngine({ ...WHITECHAPEL_MANIFEST, approaches });
  const mundane = {
    id: 'test_mundane', npcId: SELF_INTRO_NPC, locationId: 'dorset_street',
    acts: [1], kind: 'mundane', text: 'TEST BEAT',
  };

  // Full-mode turn at the NPC's location: a look-around ("look") is narrationMode full.
  // dorset_street's authored vignettes are pre-consumed here — an unfired
  // vignette wins over an approach (case 9 proves that with a fresh snapshot).
  const base = buildSnapshot({ currentAct: 1, location: 'dorset_street',
    flags: { vignette_dorset_street_0: true, vignette_dorset_street_1: true } });

  // 1. Fires on an eligible full-mode turn, sets the once-flag and the cooldown stamp.
  let r = mkEngine([mundane]).resolve(parseIntent('look'), base);
  const ap = (r.aiContext as any).npcApproach;
  if (ap && ap.npcId === SELF_INTRO_NPC && ap.text === 'TEST BEAT' &&
      r.flagsUpdate?.['approach_test_mundane'] && typeof r.approachAtMinutes === 'number') {
    pass('approach fires with once-flag and cooldown stamp');
  } else fail('approach fires', JSON.stringify({ ap, flags: r.flagsUpdate, at: r.approachAtMinutes }));

  // 2. Introduction-on-approach: unintroduced self-intro NPC → introducesSelf + npc_introduced flag.
  if (ap && ap.introducesSelf === true && ap.realName &&
      r.introductionFlagsUpdate?.[`npc_introduced_${SELF_INTRO_NPC}`]) {
    pass('self-introduction NPC introduces on approach');
  } else fail('introduction on approach', JSON.stringify({ ap, intro: r.introductionFlagsUpdate }));

  // 3. Document-gated NPC (edmund) never introduces via approach — alias-masked.
  const edmundApproach = { id: 'test_edmund', npcId: 'edmund', locationId: 'any', kind: 'mundane', text: 'TEST EDMUND' };
  // Derive edmund's live act-2 location instead of hard-coding it, so
  // schedule authoring can't silently break this case.
  const edLoc = npcLocationAt(WHITECHAPEL_MANIFEST.npcs, 'edmund', 2,
    timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, 2, 0), {});
  const snapEd = buildSnapshot({ currentAct: 2, location: edLoc });
  r = mkEngine([edmundApproach]).resolve(parseIntent('look'), snapEd);
  const apEd = (r.aiContext as any).npcApproach;
  if (apEd && apEd.introducesSelf === false && !apEd.realName &&
      !(r.introductionFlagsUpdate?.['npc_introduced_edmund'])) {
    pass('document-gated NPC stays alias-masked on approach');
  } else fail('edmund approach masked', JSON.stringify({ apEd, intro: r.introductionFlagsUpdate }));

  // 4. Once-only: fired flag suppresses it.
  r = mkEngine([mundane]).resolve(parseIntent('look'),
    buildSnapshot({ currentAct: 1, location: 'dorset_street', flags: { approach_test_mundane: true } }));
  if (!(r.aiContext as any).npcApproach) pass('fired approach never repeats');
  else fail('once-only');

  // 5. Cooldown: an approach 10 in-game minutes ago suppresses the next.
  const cfg1 = WHITECHAPEL_MANIFEST.actTimeConfig[1];
  r = mkEngine([mundane]).resolve(parseIntent('look'),
    buildSnapshot({ currentAct: 1, location: 'dorset_street', elapsedMinutes: 10,
      lastApproachAtMinutes: cfg1.canonicalMinutes }));
  if (!(r.aiContext as any).npcApproach) pass('cooldown suppresses approaches within 30 in-game minutes');
  else fail('cooldown');

  // 6. Compact-mode turns are suppressed (examining an object is compact).
  r = mkEngine([mundane]).resolve(parseIntent('examine the crowd'), base);
  if (!(r.aiContext as any).npcApproach) pass('no approach on compact-mode turns');
  else fail('compact suppression');

  // 7. NPC not scheduled here → nothing (act 1, wrong location for the NPC).
  r = mkEngine([{ ...mundane, locationId: 'baker_street' }]).resolve(parseIntent('look'),
    buildSnapshot({ currentAct: 1, location: 'baker_street' }));
  if (!(r.aiContext as any).npcApproach) pass('approach requires the NPC actually present');
  else fail('presence check');

  // 8. Rumor kind: never fires before the rumor's trigger has been recorded.
  const rumor0 = WHITECHAPEL_MANIFEST.rumors[0];
  const spread0 = rumor0.spread[0];
  const rumorApproach = {
    id: 'test_rumor', npcId: spread0.npcId, locationId: 'any',
    kind: 'rumor', rumorId: rumor0.id, text: 'TEST RUMOR FRAME',
  };
  // (a) trigger never fired → suppressed, wherever the NPC is.
  const npcLoc1 = npcLocationAt(WHITECHAPEL_MANIFEST.npcs, spread0.npcId, 1,
    timePeriodFor(WHITECHAPEL_MANIFEST.actTimeConfig, 1, 0), {});
  if (npcLoc1 !== 'offstage') {
    r = mkEngine([rumorApproach]).resolve(parseIntent('look'),
      buildSnapshot({ currentAct: 1, location: npcLoc1 }));
    if (!(r.aiContext as any).npcApproach) pass('rumor approach never precedes its trigger');
    else fail('rumor anachronism guard');
    // (b) trigger fired an act ago (act transition matures everything) → fires.
    r = mkEngine([rumorApproach]).resolve(parseIntent('look'),
      buildSnapshot({ currentAct: 1, location: npcLoc1,
        flags: { [rumor0.triggerFlag]: true },
        rumorEvents: { [rumor0.id]: { act: 0, atMinutes: 0 } } }));
    if ((r.aiContext as any).npcApproach?.kind === 'rumor') pass('matured rumor approach fires');
    else fail('matured rumor approach', JSON.stringify((r.aiContext as any).npcApproach));
  } else warn('rumor approach cases skipped', `${spread0.npcId} offstage in act 1 — pick another spread entry`);

  // 9. Vignette wins: a location with an unfired vignette shows no approach that turn.
  //    dorset_street has vignettes; a fresh look-around fires vignette idx 0.
  r = mkEngine([mundane]).resolve(parseIntent('look'), base);
  // (covered by case 1 only if dorset_street's vignettes were already consumed — force it:)
  const freshVignetteSnap = buildSnapshot({ currentAct: 1, location: 'dorset_street' });
  const rv = mkEngine([mundane]).resolve(parseIntent('look'), freshVignetteSnap);
  if ((rv.aiContext as any).vignette ? !(rv.aiContext as any).npcApproach : true) {
    pass('vignette-wins: no approach on a vignette turn');
  } else fail('vignette-wins');
}
```

**Note:** case 5's snapshot needs the same two `vignette_dorset_street_*` flags as `base` (merge them into its `flags` object) — otherwise the vignette, not the cooldown, is what suppresses the approach and the case proves nothing.

- [ ] **Step 2: Run to verify failure**

Run: `npx tsx scripts/qa-engine.ts 2>&1 | grep -A2 "NPC approaches"`
Expected: FAIL on every case (no selector exists; `npcApproach` is always undefined — cases asserting absence, 4/5/6/7, will PASS vacuously; that is acceptable, the firing cases 1/2/3/8b drive the implementation).

- [ ] **Step 3: Commit**

```bash
git add scripts/qa-engine.ts
git commit -m "test(qa): failing engine cases for NPC approach selection"
```

---

### Task 3: The selector and the engine seam

**Files:**
- Create: `engine/approaches.ts`
- Modify: `engine/GameEngine.ts` (in `resolve()`, after the `_rumorAckFlagsUpdate` lift, before the rumor-trigger recording)

- [ ] **Step 1: Write `engine/approaches.ts`**

```ts
/**
 * engine/approaches.ts
 *
 * NPC approach selection — the world initiating contact. Runs in
 * GameEngine.resolve() AFTER act/anchor/ending handling so it can see the
 * whole turn's outcome, and never fires on a dramatic turn. Deterministic:
 * first eligible approach in authored order, at most one per turn.
 */

import type { EngineResult, NarrationContext } from '../types';
import type { StoryManifest, ApproachDefinition } from './stories/types';
import type { SessionSnapshot } from './session';
import { npcLocationAt, maturedSpreadsFor } from './presence';
import { computeTimePeriod } from './time';

export const APPROACH_COOLDOWN_MINUTES = 30;

export interface SelectedApproach {
  npcApproach: NonNullable<NarrationContext['npcApproach']>;
  flagsUpdate: Record<string, boolean>;
  introductionFlagsUpdate?: Record<string, boolean>;
  atMinutes: number;
}

export function selectApproach(
  story: StoryManifest,
  session: SessionSnapshot,
  result: EngineResult,
): SelectedApproach | null {
  // Dramatic-turn suppression (spec): failed actions, act transitions,
  // endings, clue discoveries, deductions, non-full narration, vignette
  // turns, conveyance locations.
  if (!result.actionSuccess) return null;
  if (result.newAct !== undefined || result.gameOver) return null;
  if (result.discoveredClueIds.length > 0) return null;
  if (result.actionType === 'deduce') return null;
  if (result.aiContext.narrationMode !== 'full') return null;
  if (result.aiContext.vignette) return null;

  const locationId = result.newLocation ?? session.location;
  const loc = story.locations[locationId];
  if (!loc || loc.conveyance) return null;

  const cfg = story.actTimeConfig[session.currentAct] ?? story.actTimeConfig[1];
  const now = cfg.canonicalMinutes + session.elapsedMinutes + (result.minutesAdvanced ?? 0);
  if (session.lastApproachAtMinutes !== undefined &&
      now - session.lastApproachAtMinutes < APPROACH_COOLDOWN_MINUTES) return null;
  const period = computeTimePeriod(now);

  for (const a of story.approaches) {
    if (session.flags[`approach_${a.id}`]) continue;
    if (a.locationId !== 'any' && a.locationId !== locationId) continue;
    if (a.acts && !a.acts.includes(session.currentAct)) continue;
    if (a.timePeriods && !a.timePeriods.includes(period)) continue;
    if (a.requireFlags?.some(f => !session.flags[f])) continue;
    if (a.forbidFlags?.some(f => session.flags[f])) continue;

    const npc = story.npcs[a.npcId];
    if (!npc) continue;
    if (session.npcStates[a.npcId]?.status === 'deceased') continue;
    if (npcLocationAt(story.npcs, a.npcId, session.currentAct, period, session.npcStates) !== locationId) continue;

    if (a.kind === 'rumor') {
      const matured = maturedSpreadsFor(story.rumors, session.rumorEvents, a.npcId, session.currentAct, now);
      if (!matured.some(m => m.rumorId === a.rumorId)) continue;
    }

    // Introduction: an approach counts as a first TALK. Self-introduction
    // NPCs reveal their name in-beat; document-gated NPCs stay alias-masked
    // (the document gate is spoiler-critical — never bypassed here).
    const isIntroduced = !npc.requiresIntroduction || session.introducedNpcs.includes(a.npcId);
    const introType = npc.introduction ?? { type: 'self' };
    const introducesSelf = !isIntroduced && introType.type === 'self';
    const label = isIntroduced
      ? npc.displayName
      : (npc.alias ?? story.npcAliases[a.npcId] ?? npc.displayName);

    return {
      npcApproach: {
        npcId: a.npcId,
        label,
        isIntroduced,
        introducesSelf,
        realName: introducesSelf ? npc.displayName : undefined,
        kind: a.kind,
        text: a.text,
      },
      flagsUpdate: { [`approach_${a.id}`]: true },
      introductionFlagsUpdate: introducesSelf
        ? { [`npc_introduced_${a.npcId}`]: true }
        : undefined,
      atMinutes: now,
    };
  }
  return null;
}
```

- [ ] **Step 2: Wire the seam into `GameEngine.resolve()`**

After the four `ctxWithIntro` flag lifts (so the introduction merge is last-write-wins correct), before the rumor-trigger recording block:

```ts
    // NPC approach (see engine/approaches.ts) — after all outcome handling,
    // so suppression rules can see the whole turn.
    const approach = selectApproach(this.story, session, result);
    if (approach) {
      result.aiContext.npcApproach = approach.npcApproach;
      result.flagsUpdate = { ...result.flagsUpdate, ...approach.flagsUpdate };
      if (approach.introductionFlagsUpdate) {
        result.introductionFlagsUpdate = {
          ...result.introductionFlagsUpdate,
          ...approach.introductionFlagsUpdate,
        };
      }
      result.approachAtMinutes = approach.atMinutes;
    }
```

Import at top: `import { selectApproach } from './approaches';`

- [ ] **Step 3: Run the tests**

Run: `npx tsx scripts/qa-engine.ts`
Expected: all "NPC approaches" cases PASS; every pre-existing section still PASS (the two seed approaches from Task 1 exist in the real manifest — if any legacy walkthrough case trips over one, that case's snapshot gains the relevant `approach_<id>` flag, mirroring the vignette-flag convention).

- [ ] **Step 4: Typecheck + commit**

Run: `npm run lint` — Expected: PASS.

```bash
git add engine/approaches.ts engine/GameEngine.ts scripts/qa-engine.ts
git commit -m "feat(engine): deterministic NPC approach selection with introduction-on-approach"
```

---

### Task 4: Hook plumbing + persistence

**Files:**
- Modify: `hooks/useGameState.ts`
- Modify: `hooks/gameState/usePersistence.ts`

- [ ] **Step 1: Session state**

Add `lastApproachAtMinutes` state (default `undefined`) beside `elapsedMinutes` in `useGameState.ts`, include it in the snapshot passed to `gameEngine.resolve`, and apply after each turn:

```ts
      if (result.approachAtMinutes !== undefined) {
        setLastApproachAtMinutes(result.approachAtMinutes);
      }
```

(`introductionFlagsUpdate` and `flagsUpdate` already flow — approach once-flags and name reveals need no new handling.)

- [ ] **Step 2: Persistence**

Mirror `elapsedMinutes` in `usePersistence.ts`: save `lastApproachAtMinutes`, restore with `?? undefined`, reset on new game. Same schema check as the cab plan's Task 5: JSON payload = nothing more; column-whitelisted schema = one nullable migration.

- [ ] **Step 3: Typecheck + commit**

Run: `npm run lint` — Expected: PASS.

```bash
git add hooks/useGameState.ts hooks/gameState/usePersistence.ts
git commit -m "feat(hooks): persist approach cooldown timestamp"
```

---

### Task 5: Narration prompt block

**Files:**
- Modify: `server/aiCore.ts` (`buildNarrationPrompt` — locate the `npcScriptedLines` / vignette prompt sections and add the block beside them, in the same style, for the `full` mode template)

- [ ] **Step 1: Add the prompt block**

Rendered only when `ctx.npcApproach` is present (follow the exact conditional-section pattern the file already uses for `vignette`/`npcScriptedLines`):

```ts
  const approachBlock = ctx.npcApproach ? `
NPC APPROACH — after the main action is narrated, ${ctx.npcApproach.label} approaches Watson unprompted, as their own short beat (2–3 sentences):
${ctx.npcApproach.text}
${ctx.npcApproach.introducesSelf
  ? `They give their name in this beat — ${ctx.npcApproach.realName}. Narrate the introduction naturally (a touch of the hat, a name offered); from this beat on you may use the name.`
  : ctx.npcApproach.isIntroduced
    ? ''
    : `Refer to them ONLY as "${ctx.npcApproach.label}". Their real name must NOT appear.`}
The text above is the complete content of the approach — do not extend what they know, reveal, or claim beyond it. Watson may react briefly; do not open a full dialogue.` : '';
```

- [ ] **Step 2: Prose check with the narration harness**

Load the `narration-voice-check` skill first (prompt-adjacent edit). Then run the fixture report (requires `GEMINI_API_KEY`):

Run: `npx tsx scripts/qa-narration.ts`
Add one `NarrationContext` fixture in that script with an `npcApproach` (self-introducing) and one with an unintroduced document-gated NPC; review `qa-narration-report.md` for: the beat lands after the main action, the name reveal reads naturally, no name leak in the masked case.

- [ ] **Step 3: Commit**

```bash
git add server/aiCore.ts scripts/qa-narration.ts
git commit -m "feat(narration): npcApproach prompt block with introduction handling"
```

---

### Task 6: qa:validate rules + the authoring pass

**Files:**
- Modify: `scripts/qa-validate.ts`
- Modify: `engine/stories/whitechapel-1888/approaches.ts`

- [ ] **Step 1: Validator section**

Follow the file's conventions (`section`/`pass`/`fail`/`warn`, the flag-reachability helper, and the existing spoiler-guard function used on world-event text — reuse it verbatim on approach text):

```ts
section('NPC approaches');
{
  const seen = new Set<string>();
  for (const a of APPROACHES) {
    const label = `approach ${a.id}`;
    if (seen.has(a.id)) fail(`${label} id unique`);
    seen.add(a.id);
    if (!npcIds.has(a.npcId)) { fail(`${label}: npc "${a.npcId}" exists`); continue; }
    if (a.locationId !== 'any' && !locationIds.has(a.locationId)) { fail(`${label}: location resolves`); continue; }
    if ((a.kind === 'rumor') !== !!a.rumorId) fail(`${label}: rumorId iff kind rumor`);
    if (a.rumorId && !RUMORS.some(r => r.id === a.rumorId && r.spread.some(s => s.npcId === a.npcId)))
      fail(`${label}: rumor "${a.rumorId}" has a spread entry for ${a.npcId}`);
    for (const f of [...(a.requireFlags ?? []), ...(a.forbidFlags ?? [])]) {
      const reason = flagUnreachableReason(f);
      if (reason) fail(`${label}: flag "${f}" settable`, reason);
    }
    // The silent break: the NPC must actually be schedulable at the location
    // in at least one (act, period) combination the approach allows.
    if (a.locationId !== 'any') {
      const acts = a.acts ?? Object.keys(NPCS[a.npcId].scheduleByAct).map(Number);
      const periods = a.timePeriods ?? PERIOD_ORDER;
      const reachable = acts.some(act => periods.some(p =>
        npcLocationAt(NPCS, a.npcId, act, p, {}) === a.locationId));
      if (!reachable) fail(`${label}: ${a.npcId} is never at ${a.locationId} in the allowed acts/periods`);
      else pass(`${label}: placement ok`);
    } else pass(`${label}: placement 'any'`);
    // Spoiler guard over the authored text — same guard as world events.
    // (call the existing spoiler-check helper here with a.text)
  }
  const edmundCount = APPROACHES.filter(a => a.npcId === 'edmund' && a.kind === 'mundane').length;
  if (edmundCount < 2) warn('Edmund has fewer than 2 mundane approaches', 'recession rule — the murderer must initiate contact like everyone else');
}
```

Import `APPROACHES` at the top beside `RUMORS`.

- [ ] **Step 2: Run — expect the Edmund warning to drive the authoring**

Run: `npm run qa:validate`
Expected: seed approaches PASS placement; WARN on Edmund count (fixed next step).

- [ ] **Step 3: Author the full approach set**

Load the `historian` skill, then author **8–12 approaches** in `approaches.ts`, honoring the temporal-validity rules in the file header. Coverage targets:

- 2–3 **Edmund mundane** approaches (mortuary/bond_office per his schedule) — flat, warm, unremarkable; recession rule from `game-direction`.
- 2–3 **rumor deliveries** — pick real matured-spread pairs from `rumors.ts` (recipient NPC + rumorId), frame text only.
- 3–4 **mundane texture** across acts/locations (Hutchinson on Dorset Street, Abberline at the station or the pub in the evening, Phillips at the mortuary…), at least one gated on a `world_event_<id>` flag to exercise that rule.
- At least one with `timePeriods` set (an evening-only pub beat) so the period path is exercised in real data.

- [ ] **Step 4: Full suite + reviewers**

Run: `npm run qa:all`
Expected: PASS, including the new validator section with no Edmund warning.

Dispatch `narrative-consistency-reviewer` over `approaches.ts` (timeline anachronisms, voice) — per the spec this is now part of any PR touching that file.

- [ ] **Step 5: Commit**

```bash
git add scripts/qa-validate.ts engine/stories/whitechapel-1888/approaches.ts
git commit -m "feat(story): full NPC approach set with validator coverage"
```

---

### Task 7: Finish line

- [ ] **Step 1: Full verification**

Run: `npm run qa:all && npm run qa:narration-inject`
Expected: PASS. Then a browser pass per the `verify` skill: dev server, walk into Dorset Street in act 1 → Hutchinson approaches and gives his name; check the sidebar reveals his real name the same turn; verify the same location never approaches twice.

- [ ] **Step 2: Reviews and PR**

Dispatch `engine-logic-reviewer` (engine/ changed), `engineering-reviewer` (hooks/, server/ changed), and confirm the `narrative-consistency-reviewer` findings from Task 6 are addressed. Open a PR titled "feat: NPC approaches — the world initiates contact", linking the spec and the qa evidence.
