# Watson's Diary — Lead Marking & Gap-Filling — Design Spec

**Date:** 2026-07-02
**Status:** Approved for planning
**Topic:** Every flag that gates act progression should produce a diary entry, and entries that were progression-critical ("leads") should be visually distinguishable from flavor entries.

---

## 1. Problem

Act progression is gated by `ACT_PROGRESSION[act].requireFlags` ([acts.ts:128](../../../engine/stories/whitechapel-1888/acts.ts)) — every flag needed to advance. Today, only two of the mechanisms that can satisfy a gate flag reliably produce a diary entry:

- **Clue discovery** — `CLUE_DEFINITIONS[id].diaryNote` ([clues.ts](../../../engine/stories/whitechapel-1888/clues.ts)), captured automatically whenever `result.discoveredClueIds` is populated.
- **A small hand-authored allowlist** — `DECISION_DIARY` / `DECISION_BY_FLAG` ([diaryDecisions.ts](../../../engine/stories/whitechapel-1888/diaryDecisions.ts)), keyed by flag, captured in `useGameState.ts` STEP 5b.

Any gate flag not covered by one of these — a `talked_to_<npc>` or `examined_<loc>_<obj>` with no clue trigger and no `DECISION_DIARY` entry — advances the act **silently**: the header's leads pip fills, but Watson's diary records nothing.

Verified against the Prologue's four gate flags:

| Flag | Diary coverage today |
|---|---|
| `examined_baker_street_case_files_wall` | ✅ clue `clue_00_campaign_timeline` |
| `showed_newspaper_pile_to_holmes` | ✅ decision "The Press Hoax" |
| `talked_to_holmes_at_baker_street` | ❌ nothing |
| `examined_baker_street_telegrams_pile` | ❌ nothing |

So 2 of the Prologue's 4 leads are silent. The mechanism is what's broken, not just the Prologue's content — any future act's talk/examine gate with no clue trigger and no hand-authored `DECISION_DIARY` line has this same silent-gap risk, and nothing today prevents or flags it.

Separately: nothing in the diary UI distinguishes a progression-critical entry ("this advanced the case") from flavor (location arrivals, etc.), even though the header already shows a "leads" pip count for the current act.

## 2. Goal

- Every flag in `ACT_PROGRESSION[act].requireFlags` produces a diary entry when it fires — no more silent gates, for the Prologue or any future act.
- Diary entries that correspond to a progression-gate flag are visually marked as a **lead**, distinct from the existing "new since last opened" indicator (which stays independent — an entry can be a lead without being new, or vice versa).

### Non-goals

- No change to `ACT_PROGRESSION` gating logic itself — this only changes what happens (diary-wise) once a gate flag fires.
- No new progress UI beyond the existing leads pip in the act header (already exists, unchanged).
- No change to the act-closing reflection (`kind: 'act'`) mechanism — unrelated.
- No hand-authored `diaryNote`/`DECISION_DIARY` text is being written for `talked_to_holmes_at_baker_street` or `examined_baker_street_telegrams_pile`. Those two — and any future silent gate — are filled by the new AI-generation path by design, not by manually backfilling content now.

## 3. Key facts grounding the design

- **`DiaryEntry`** ([types.ts:334](../../../types.ts)): `{ id, kind, refId, actNumber, sequence, text?, timeLabel? }`. `kind` is one of `clue | act | decision | revelation | location`.
- **Capture site** ([useGameState.ts:1289-1310](../../../hooks/useGameState.ts)) — "STEP 5b": synchronously, in the same tick as the engine result, loops `result.discoveredClueIds` (→ `kind: 'clue'`) and `result.flagsUpdate` (→ `kind: 'decision'` when `DECISION_BY_FLAG[flag]` exists), pushing to `captured[]`, then `captureDiaryEntries(captured)`.
- **Async generation precedent** ([useGameState.ts:1428-1459](../../../hooks/useGameState.ts)) — "STEP 8": after the narration stream completes, `pendingJournalSummary` (queued earlier in the turn) is passed to `aiService.generateJournalEntry()`, and the result is pushed as a new `DiaryEntry{kind:'act'}` once resolved. This is the template for the new async lead-generation flow — the turn already resolves before this runs, so it doesn't block the player.
- **`hints.ts` `OBJECTIVES`** ([hints.ts:57](../../../engine/stories/whitechapel-1888/hints.ts)) — from the already-implemented hint system, this table already has one entry per progression-gate flag (`done: s => flag(s, 'exact_flag_name')`), each carrying a neutral, spoiler-safe `verb` + `subject` (e.g. `talk` / `"Holmes himself, for his reading of the case"`). This is reused as grounding context for the AI prompt below, instead of inventing a second "what does this flag mean" description.
- **`DiaryModal.tsx`** ([DiaryModal.tsx:50-59](../../../components/DiaryModal.tsx)) already computes `actLeads()` — found/total progression flags for the header pip — using the same `requireFlags` (minus `__` sentinels) this feature keys off.
- The existing "new since last opened" dot ([DiaryModal.tsx:180-185](../../../components/DiaryModal.tsx), driven by `newEntryIds`) is untouched and stays independent of the new lead marker.

## 4. Approach (chosen)

**General, self-sustaining fallback**: any `requireFlags` flag without existing hand-authored diary text (no clue trigger, no `DECISION_DIARY` entry) gets an AI-generated entry, asynchronously, the same way the act-closing reflection already works. An explicit `isLead` boolean is stored on the entry at capture time (for *all* paths — clue, decision, and the new AI path), so the UI never has to re-derive "is this a lead" from flag names at render time.

Rejected alternatives:
- **Hand-author a line for every flag** — reintroduces the exact silent-gap risk for every future act unless someone remembers to add one; rejected per user direction (chose AI-generation instead).
- **Derive `isLead` dynamically at render** by reverse-matching `refId`/flag names in `DiaryModal` — fragile (clue entries have no stored flag reference) and duplicates logic already computed once at capture time.

## 5. Detailed design

### 5.1 Data model

- `types.ts`: add `isLead?: boolean` to `DiaryEntry`.
- Computed **once, at capture time**, never re-derived at render:
  - **Decision entries** (STEP 5b, existing loop over `result.flagsUpdate`): `isLead = ACT_PROGRESSION[actNumber].requireFlags.includes(flag)` — the flag is already the loop variable, so this is a one-line addition.
  - **Clue entries**: the flag that fired a clue discovery isn't in the same loop, but follows the existing naming convention `examined_<locationFound>_<triggerObject>` (verified: `clue_00_campaign_timeline` has `locationFound: 'baker_street'`, `triggerObject: 'case_files_wall'`, and the real gate flag is `examined_baker_street_case_files_wall`). `isLead = requireFlags.includes('examined_' + def.locationFound + '_' + def.triggerObject)`.
  - **Location entries** (`captureLocationArrival`): always flavor. `isLead` stays `undefined`/`false`.
  - **New AI-generated entries** (5.3 below): always `isLead: true` — they exist precisely because they *are* an otherwise-uncovered gate flag.

### 5.2 Detecting silent gate flags

In STEP 5b, after the existing clue/decision loops, compute the set of `requireFlags` (excluding `__` sentinels) that just transitioned false→true this turn (`result.flagsUpdate[flag] === true && !flags[flag]`) and are **not** already covered by:
- a `DECISION_BY_FLAG[flag]` entry, or
- the clue naming-convention match in 5.1 (a clue was discovered this same turn whose `examined_<locationFound>_<triggerObject>` equals this flag).

(Note: `captureLocationArrival` is keyed off physically moving to a new place, not off any `requireFlags` gate — there is no overlap to guard against. A location-level examine gate like Act 6's `visited_private_asylum` — despite its name, it's `locationExaminedFlag` on that location, set by examining any object there, functionally identical to `examined_baker_street` elsewhere — has no existing diary coverage and is treated like any other silent lead flag, not excluded.)

Each remaining flag is queued (mirroring `pendingJournalSummary`) as a `pendingLeadFlag: { flag, actNumber, actName }`, one queue entry per flag, processed in a new async step alongside STEP 8.

### 5.3 AI generation

New `AIService` method, modeled directly on `generateJournalEntry` ([AIService.ts:616](../../../services/AIService.ts)):

```ts
async generateLeadDiaryEntry(context: {
  actName: string;
  verb: HintVerb;        // reused from hints.ts OBJECTIVES
  subject: string;       // reused from hints.ts OBJECTIVES — neutral, spoiler-safe
  narrationText: string; // the turn's actual narration, for grounding
}): Promise<{ title: string; body: string }>
```

- Looked up via a new optional `flag?: string` field on `hints.ts`'s `HintObjective` (additive, non-breaking — populated for the objectives that map 1:1 onto a `requireFlags` gate, which is the overwhelming majority per the table already in `hints.ts`). `OBJECTIVES.find(o => o.flag === firedFlag)` supplies `verb`/`subject`.
- Prompt: Watson's voice, first-person past tense (same system instruction family as `generateJournalEntry`/`getWatsonHint`), grounded in the turn's real narration text so it doesn't invent details — asked to return a short evocative title (matching the style of existing hand-authored titles like "The Press Hoax") plus a 1-2 sentence diary body.
- Runs **async, after the turn resolves** (same non-blocking pattern as the act journal) — the player's action returns instantly; the entry appears in the diary, tagged as new, once generation completes.
- No special-case failure fallback: per project direction, the game already assumes AI availability (existing `generateJournalEntry` failure handling — silently skip that one entry — is sufficient; this isn't a new failure mode).
- Resulting entry: `{ kind: 'decision', refId: flag, actNumber, sequence, text: body, timeLabel, isLead: true }`. `sequence` uses the same `diarySeqRef.current++` counter as every other capture path (STEP 8's act-journal push already does this — same pattern). Title is carried via `text` alongside body (mirrors how `kind: 'act'` already stores prose in `text`); `resolveDiaryEntry()` ([diary.ts](../../../engine/stories/whitechapel-1888/diary.ts)) gets a branch: when `kind === 'decision'` and `DECISION_DIARY[refId]` doesn't exist (i.e., this is an AI-generated entry, not a hand-authored one), parse title/body from `entry.text` instead of failing the existing `if (!d) return null` check.
- New id added to `newEntryIds` exactly like every other capture path, so it gets the existing "new" treatment.

### 5.4 Visual design (validated via mockups)

- **Lead marker**: a small outlined pill — a dot (same shape/size as the header's leads pips) + "LEAD" text — placed next to the entry title. Reuses the header pip's dot shape intentionally, so the visual connection between an individual entry and the act's leads-progress counter reads as deliberate rather than coincidental.
- **"New" marker**: plain italic text reading "New" (no exclamation mark, no background box) next to the title, replacing the current small dot (which was easy to confuse with the leads-pip dots once both existed on the same row). Independent of the lead marker — both, either, or neither can appear on a given entry.
- Flavor entries (location arrivals, etc.) get neither marker.
- Both markers are computed from stored entry fields (`isLead`, and the existing `newEntryIds` membership) — no new render-time derivation.

## 6. Testing

1. **Drift guard** (mirrors the existing hint-system test): every flag in every `ACT_PROGRESSION[*].requireFlags` (excluding the Act-5 sentinel) is covered by *some* diary-producing path — a clue, a `DECISION_DIARY` entry, or falls through to the new AI-generation path. No flag is silently dropped.
2. **`isLead` correctness** — for a synthetic turn setting a clue-triggering flag, a `DECISION_BY_FLAG` flag, and a flag with neither, assert the resulting `DiaryEntry.isLead` is `true`, `true`, and (post-generation) `true` respectively; a location-arrival entry is `false`/`undefined`.
3. **No double-logging** — a turn that both discovers a clue and sets its corresponding gate flag produces exactly one diary entry for that action, not two.
4. **Async generation doesn't block the turn** — the engine result / narration returns before `generateLeadDiaryEntry` resolves; the entry appears in `diaryEntries` only after.
5. Existing diary/engine tests still pass (clue capture, decision capture, location arrival, act reflection all unchanged in shape).

## 7. Files touched

- `types.ts` — add `isLead?: boolean` to `DiaryEntry`.
- `hooks/useGameState.ts` — STEP 5b: compute `isLead` on clue/decision captures; detect silent gate flags and queue `pendingLeadFlags`; new async step (alongside STEP 8) calling `generateLeadDiaryEntry` per queued flag and pushing the resulting entries.
- `services/AIService.ts` — add `generateLeadDiaryEntry`.
- `engine/stories/whitechapel-1888/hints.ts` — add optional `flag?: string` to `HintObjective`; populate for gate-flag-mapped objectives.
- `engine/stories/whitechapel-1888/diary.ts` — `resolveDiaryEntry()`: branch for AI-generated `decision` entries (no `DECISION_DIARY[refId]`) to read title/body from `entry.text`.
- `components/DiaryModal.tsx` — render the "LEAD" pill (from `entry.isLead`) and replace the "new" dot with plain "New" text.
