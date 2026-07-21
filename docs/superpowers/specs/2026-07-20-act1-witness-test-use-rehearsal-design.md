# Design: Act 1 "Test the Witness" chain + Act 4 USE rehearsal

**Date**: 2026-07-20
**Status**: Approved (brainstorm with author)
**Motivation**: Audit of the game against the revised `game-direction` skill found two gaps: (1) the fair-play teaching rule is violated — USE X WITH Y decides Act 5 (the Baker Street convergence) but is never taught earlier; (2) Acts 1–4 gates are flat single-step examine/talk checklists, the exact failure mode the direction doc names. This design addresses both: the Act 1 witness-test pilot puzzle (per-act puzzle roadmap) rehearses the convergence verb in the first act, and an Act 4 refresher keeps it warm one act before it matters.

## 1. Act 1 — "Test the Witness" (gating chain)

The Act 1 gate flag `talked_to_hutchinson_at_dorset_street` is replaced by a four-step chain at Dorset Street. Doubting the Stranger *is* Act 1's dramatic turn, so per the direction doc this gates act progression.

1. **TALK to Hutchinson** — unchanged: his over-detailed account of the astrakhan man plus the loitering admission. Sets `talked_to_hutchinson_at_dorset_street` (kept as a flag; no longer the gate).
2. **TAKE his account** — new interactable `hutchinson_account` at `dorset_street` ("Watson's note of Hutchinson's statement"). Takeable only after the talk flag is set, via the new flag-gated takeable capability (§3). Yields inventory item **"Hutchinson's Account (Watson's note)"**.
3. **USE the account WITH the court archway** — new `USE_COMBINATIONS` entry, `requiresLocation: 'dorset_street'`. Watson reads the statement against the ground: gas lamp, distance, that night's drizzle — a passing glance could not have yielded spats, a tie-pin, and a parcel in the left hand. Grants new clue **"The Account Outruns the Light"** (deduction material; the Stranger begins to dissolve).
4. **SHOW the account TO Hutchinson** — new `SHOW_INTERACTIONS` entry, gated on the step-3 clue via the new flag-gated SHOW capability (§3): without the sightline insight Watson has nothing to put to him, and the show is blocked with a redirecting narrator note. Watson reads his words back to him. Hutchinson breaks into loneliness, not guilt: he embroidered the description so someone would believe him; the loitering was true — he knew Kelly, had nowhere to sleep, half-hoped she'd take him in. Sets `showed_hutchinson_account_to_hutchinson` — the **new Act 1 gate flag** — and is his on-screen clearing beat (red-herring rule).

Supporting details:

- The account item is spent after Act 1 (`ITEM_SPENT_AFTER_ACT` entry), like the Act 0 clipping.
- Hint objectives cover all four steps in the Act 1 block, same predicate style as the Act 5 convergence ladder (each step `available` only when its prerequisites hold).
- Hutchinson's `facts.ts` block already carries the needed knowledge (`hutchinson_over_detailed`, `hutchinson_why_loitered`) — no fact-graph changes.
- Examining the un-taken account object before the talk deflects naturally (Watson's not-yet-written note).

## 2. Act 4 — USE refresher at Lusk's office

One new `USE_COMBINATIONS` entry: **USE kidney examination notes (`kidney_parcel`) WITH the From Hell letter (`from_hell_letter`)**. Both items are obtainable at `lusk_office` in Act 4.

- **Payoff**: surfaces the fact currently buried in Abberline's improvised dialogue — the kidney detail was never published. Whoever wrote the letter handled the organ; the letter stops being press noise and becomes the killer's own hand.
- **Clue granted**: new clue **"The Letter Knows Too Much"**, connected to the existing From Hell letter clue group.
- **Spoiler containment**: the result note establishes only that the writer handled the kidney. It must NOT touch the preservation-method-matches-Bond's-lab territory (that is the SHOW-to-Bond beat) and must not gesture at Edmund or the asylum.
- **Gating**: none — optional-rewarded, deliberately friction-free (no act-lock: both items are Act 4-obtainable anyway; no location-lock). Act 4's progression gate is unchanged.
- One hint objective in the Act 4 block, available once both items are held.

## 3. Engine additions

**Flag-gated takeables (story-agnostic platform capability).** New optional manifest field `takeableRequiresFlag: Record<string, StoryFlag>`, checked in `resolveTake`: if the object has an entry and the flag is unset, the take is blocked through the standard `blocked()` path with a narrator-voice note ("Watson has nothing yet worth setting down — the man has not told his story"). Only `hutchinson_account` uses it initially.

**Flag-gated SHOW interactions (same spirit).** Optional `requireFlags?: StoryFlag[]` on `ShowInteraction`, checked in `resolveShow`: if unmet, the show is blocked through `blocked()` with a redirecting narrator note ("Watson has only the man's own words, unweighed — nothing yet to put to him"). Without this, the Act 1 chain's step 4 would be reachable straight after step 2, bypassing the test that gives the confrontation its grounds. Only the Hutchinson entry uses it initially.

**USE-order symmetry fix.** The possession check in `engine/resolvers/items.ts` (~line 105) requires the first-named object to be an inventory takeable, so "USE archway WITH account" fails while "USE account WITH archway" works. Fix: after the (already symmetric) combination lookup, normalize so whichever side is the inventory item is treated as held, and the other side is checked against the room/inventory. Pure resolver logic, no data change.

## 4. Data touch-list

| File | Change |
|---|---|
| `engine/resolvers/items.ts` | USE-order normalization; `takeableRequiresFlag` check in `resolveTake` |
| `engine/resolvers/npc.ts` | `requireFlags` check in `resolveShow` |
| `engine/stories/types.ts` | `takeableRequiresFlag` optional manifest field; `requireFlags` on `ShowInteraction` |
| `engine/stories/whitechapel-1888/acts.ts` | Act 1 gate: `talked_to_hutchinson_at_dorset_street` → `showed_hutchinson_account_to_hutchinson` |
| `engine/stories/whitechapel-1888/flags.ts` | New flags (`showed_hutchinson_account_to_hutchinson`; use-combination flags are auto-derived) |
| `engine/stories/whitechapel-1888/clues.ts` | 2 new clues; `hutchinson_account` takeable + display name + USE/SHOW entries; `ITEM_SPENT_AFTER_ACT` entry |
| `engine/stories/whitechapel-1888/locations.ts` | Add `hutchinson_account` to `dorset_street` interactables |
| `engine/stories/whitechapel-1888/hints.ts` | 5 new objectives (4 × Act 1 chain, 1 × Act 4 refresher) |
| `engine/stories/whitechapel-1888/manifest.ts` | Wire `takeableRequiresFlag` |

## 5. Verification

- `npm run qa:validate` — referential integrity of new clue/trigger/flag wiring
- `npm run qa:hints` — new objectives
- `npm run qa:engine` — the scripted Act 1 path must be updated to walk the new chain (expected test change, not a regression)
- `npm run qa:parser` — new object names parse
- `npm run qa:all` before considering the work done
- **Live playtest of Act 1** after implementation (per project practice: playtest catches what review can't)

## Out of scope (tracked separately)

- SHOW beats granting clues in Acts 2–5 (audit finding 3)
- READ tutorialization in Act 0 (audit finding 5 / optional)
- Evidence-surface UI questions (open question in game-direction — author conversation pending)
