# Watson Hint System — Design Spec

**Date:** 2026-06-24
**Status:** Approved for planning
**Topic:** Replace the cryptic Holmes hint with a clue-aware, Watson-voiced hint that points the player toward the next *available* step needed to advance.

---

## 1. Problem

Today the hint system speaks as **Sherlock Holmes** and is deliberately cryptic. It does not know which clues the player has or hasn't found, so it cannot reliably point at the *right* missing step.

- Trigger: **Consult Holmes** button → `handleConsultHolmes` ([useGameState.ts:1462](../../../hooks/useGameState.ts)) → `getHolmesHint` ([AIService.ts:572](../../../services/AIService.ts)).
- `getHolmesHint` only receives the current location, that location's `criticalPathLead` string, recent history, and stats. **It has no knowledge of discovered vs. undiscovered clues.**
- A second, automatic nudge (`holmesNudge`) fires when the player is stuck ≥4 turns at a location ([GameEngine.ts:153](../../../engine/GameEngine.ts), [GameEngine.ts:206](../../../engine/GameEngine.ts)).

## 2. Goal

Make hints a genuinely useful aid. A hint should:

- Speak in **Watson's** voice (first-person, past tense — consistent with all narration).
- Be a **directed nudge**: name the specific avenue/action to take, but never reveal what it yields.
- Point only at steps that are **available right now** — never at something gated behind an action the player hasn't done yet (e.g. don't say "show Holmes the clipping" before the clipping is in hand).
- When several steps remain, pick one at **random**.
- Be **AI-formulated**, not hardcoded prose — the engine chooses the target; the AI phrases it.

### Non-goals

- No clue-checklist / progress-bar UI (violates game-direction Principle 4 — restraint).
- No changes to clue, act, location, or suspect data.
- No difficulty settings.
- `consultHolmesMultiClue` (the post-discovery Holmes synthesis) is **unchanged** — that is a different feature.

## 3. Key facts grounding the design

Confirmed by code inspection:

- **Act advancement is gated by flags**, listed per act in `ACT_PROGRESSION` ([acts.ts:107](../../../engine/stories/whitechapel-1888/acts.ts)). The unmet flags for the current act are exactly "what the player needs to do to advance."
- Gate flags span multiple verbs, not just clue-yielding examines:
  - `examined_<loc>_<obj>` — examine a specific object.
  - `examined_<loc>` (location-level) — set by examining **any** interactable at that location ([GameEngine.ts:391](../../../engine/GameEngine.ts)).
  - `talked_to_<npc>_at_<loc>` — talk to an NPC present at the location.
  - `showed_<obj>_to_<npc>` — **show requires the item in inventory** ([GameEngine.ts:690](../../../engine/GameEngine.ts)); the item enters inventory by examining the object ([GameEngine.ts:402](../../../engine/GameEngine.ts)). This is a real two-step chain.
  - `visited_<loc>` — location-level visit flag (e.g. `visited_private_asylum`, behind `requiresFlag: asylum_unlocked`).
- Act 5 is special: its gate is the sentinel `__advance_via_correct_deduction_only__`, which is never set. Act 5 advances only via a **correct deduction**, which needs `clue_06` — obtained through a location-locked USE convergence ([clues.ts:332](../../../engine/stories/whitechapel-1888/clues.ts)).
- Readable names exist: `OBJECT_DISPLAY_NAMES`, `NPC_DISPLAY_NAMES`, `LOCATIONS[id].name`.

## 4. Approach (chosen: C)

Considered and rejected:

- **A — Parse flag strings into verb+target.** Brittle (inconsistent flag shapes), and cannot express the show-needs-inventory prerequisite.
- **B — Random undiscovered clue from `CLUE_TRIGGERS`.** Misses talk/show gates (which yield no clue) and would point at optional clues that don't help advancement.

**C — Authored "next-step objectives" table, driven by the act gates.** A small declarative table maps each act's progression to player-facing objectives, each with its own availability predicate. The engine deterministically computes which objectives are unmet **and** actionable now, picks one at random, and hands the AI a neutral target to render in Watson's voice. This honours the engine/AI contract (engine decides *what*, AI decides *how it sounds*), handles all verbs uniformly, and natively models prerequisite chains.

## 5. Detailed design

### 5.1 New module: `engine/stories/whitechapel-1888/hints.ts`

Holds the objective table and the pure selector. No I/O, no AI.

```ts
export type HintVerb = 'examine' | 'talk' | 'show' | 'use' | 'deduce' | 'move';

/** Narrow, read-only view of session state the selector needs. */
export interface HintState {
  currentAct: number;
  location: string;
  flags: Record<string, boolean>;
  inventory: string[];
  discoveredClueIds: string[];
  npcStates: Record<string, { currentLocation?: string; status?: string }>;
}

export interface HintObjective {
  id: string;                         // stable identifier
  act: number;
  locationId: string;
  verb: HintVerb;
  /** Neutral, player-facing noun phrase. MUST NOT contain clue content/spoilers. */
  subject: string;
  /** True when this step is already complete. */
  done: (s: HintState) => boolean;
  /** True when the player could do this step right now. */
  available: (s: HintState) => boolean;
}

export interface HintTarget {
  verb: HintVerb;
  subject: string;
  locationName: string;
  isCurrentLocation: boolean;
}

export function selectHint(s: HintState): HintTarget;
```

**Availability predicate** (`available`) encodes, per objective:

- Location reachable: `LOCATIONS[locationId].act <= currentAct` and any `requiresFlag` on the location is set.
- For `talk`/`show`: the target NPC is present at that location (`canonicalLocationByAct` / live `npcStates`) and not deceased.
- For `show`: the required inventory item is present (which is what makes the prerequisite examine matter).

If an objective is not yet available, it is simply excluded from the pool; a separate prerequisite objective (the examine that unlocks it) surfaces instead.

**Done predicate** (`done`) keys on the relevant gate flag or inventory state.

### 5.2 The objective table

Derived from `ACT_PROGRESSION` so it stays in lock-step with the real gates. One objective per gate flag, **plus** prerequisite objectives where a gate has a hidden first step.

| Act | Objective(s) | Notes |
|----|----|----|
| 0 | examine case-files wall; talk to Holmes; **examine newspaper pile** (prereq); show clipping to Holmes; examine telegrams pile | The show objective is `available` only once the clipping is in inventory; until then the examine-pile prereq surfaces. |
| 1 | talk to Hutchinson (Dorset St); examine burned clothing; examine the bed; talk to Bond (Miller's Court) | |
| 2 | examine the mortuary records; examine Buck's Row; examine Hanbury St; talk to Tumblety (H-Division); talk to Holmes (H-Division) | `examined_whitechapel_mortuary` is location-level — subject points at the concrete key object for a directed nudge. |
| 3 | examine Dutfield's Yard; talk to Pizer (Working Men's Club); examine Mitre Square; examine Goulston St; talk to Holmes (Goulston St) | |
| 4 | examine Lusk's office; talk to Abberline; talk to Holmes (Lusk's office) | |
| 5 | the document convergence (USE combo at its locked location) → then deduce | Act 5 has no flag gate. Objective points at the convergence that yields `clue_06`; once available evidence is in hand, falls through to the `deduce` nudge. |
| 6 | reach/examine the asylum patient records; speak with Edmund at the asylum | Asylum objectives are `available` only when `asylum_unlocked` is set; otherwise the unlocking prerequisite surfaces. |

> Exact `subject` wording, the Act-5 convergence specifics, and the `asylum_unlocked` prerequisite are finalized against the data files during implementation. Subjects stay neutral (name the avenue, never the finding). Edmund is only ever named in Act 6 (game-direction Principle 5).

### 5.3 Selector logic

```
selectHint(s):
  pool = OBJECTIVES.filter(o => o.act === s.currentAct && !o.done(s) && o.available(s))
  if pool is empty:
    return DEDUCE_FALLBACK   // "review what you have and venture a conclusion"
  pick = pool[random]        // Math.random — normal runtime, not a workflow
  loc = LOCATIONS[pick.locationId]
  return { verb, subject, locationName: loc.name, isCurrentLocation: pick.locationId === s.location }
```

Pure and synchronous. Randomness across the whole reachable pool satisfies "random which step," and the advancement-first framing is automatic because the pool *is* the unmet act gates.

### 5.4 AI rendering: `getWatsonHint` (AIService)

Replaces `getHolmesHint`. Signature:

```ts
async getWatsonHint(target: HintTarget): Promise<string>
```

- System prompt: Watson's voice (reuse the narration voice rules), **not** the Holmes persona.
- Directed but non-spoiling: name the avenue/action and where; never state what it reveals.
- First-person past tense, ≤ ~45 words, no preamble.
- Fallback string on AI failure, in Watson's voice.

Example shape of output (illustrative, AI-generated at runtime): *"I realised I had given the autopsy ledger on Bond's desk no proper scrutiny — there was time yet to put that right."*

### 5.5 Integration — both mechanisms unified

Both paths use the same `selectHint`:

- **Manual button** (`handleConsultHolmes` → rename to `handleHint` / `handleReflect`): build a `HintState` from current session fields, call `selectHint`, then `getWatsonHint`, and append the result as a Watson **inner-thought** history item (not a Holmes speaker block). The button is relabelled out of Holmes's name — default **"Gather your thoughts"** (adjustable).
- **Automatic stuck-nudge** ([GameEngine.ts:153](../../../engine/GameEngine.ts)): keep `shouldFireHolmesNudge` as the *trigger condition*. When it fires, replace the `holmesNudge` field on `NarrationContext` with a `watsonHint: HintTarget` (from `selectHint`), and update `buildNarrationPrompt` to weave a brief, non-spoiling Watson reflection into the turn's narration. The old cross-location redirect logic is subsumed by `selectHint` (it already considers all reachable locations).

`NarrationContext.holmesNudge` is removed in favour of `watsonHint`.

### 5.6 Edge cases

- **Objective elsewhere:** `isCurrentLocation === false` → the AI mentions where to go ("there was time yet to return to the mortuary…").
- **No available objective:** `deduce` fallback nudges toward forming a conclusion.
- **Act 5:** convergence objective while evidence is incomplete; `deduce` fallback once it isn't.
- **Stat-flavour:** the existing medical/moral styling can optionally tint Watson's phrasing; not required for correctness.

## 6. Testing (engine tests run without an API key)

1. **Drift guard:** every flag in every `ACT_PROGRESSION[*].requireFlags` (excluding the Act-5 sentinel) is covered by at least one objective whose `done` reflects that flag.
2. **Availability — prerequisite chain:** Act 0, empty inventory → pool excludes "show clipping to Holmes" and includes "examine newspaper pile"; with the clipping in inventory → pool includes "show clipping to Holmes."
3. **Availability — locked location:** an objective whose location is act-gated or `requiresFlag`-gated is excluded until reachable.
4. **Selector never returns unavailable/done objectives** for a range of synthetic sessions.
5. **Empty pool → deduce fallback** (incl. Act 5 with evidence complete).
6. Existing engine + narration-context tests still pass.

## 7. Files touched

- **New:** `engine/stories/whitechapel-1888/hints.ts` (objective table + `selectHint`).
- **New:** test file for the selector / drift guard.
- `services/AIService.ts` — add `getWatsonHint`; retire `getHolmesHint`.
- `hooks/useGameState.ts` — rewire the manual hint handler to `selectHint` + `getWatsonHint`; render as Watson inner-thought.
- `engine/GameEngine.ts` — auto-nudge uses `selectHint`; emit `watsonHint` instead of `holmesNudge`.
- `types.ts` — replace `NarrationContext.holmesNudge` with `watsonHint`.
- UI button label (Holmes → "Gather your thoughts").
