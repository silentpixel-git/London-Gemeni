# Act Authoring Process

How an act goes from idea to done. The companion skill (`.claude/skills/act-authoring/`) enforces this; this doc is the rationale and the reference.

## Why this exists

Act 0 had an approved 400-line narrative spec before a line of code was written — and still took roughly twenty fix commits. The spec specified the *story*; every fix landed in a dimension it never pinned down:

1. **Timing** — content firing on the wrong turn (Mrs Kemp's arrival, facts askable before the puzzle that earns them, a branch skipping the reconstruction).
2. **Surface disagreement** — sidebar and hints showing what the engine gates (presence-gate bypasses, container contents leaking across locations).
3. **Parser collision** — new object names shadowed by existing aliases (`box` → parcel_box, `letter` → from_hell_letter, apostrophe aliases unreachable).
4. **Cross-surface chronology** — one fact stated in several places drifting apart (the pawn ticket's timeline, fixed twice).
5. **Narration-mode interaction** — reveals dropped by word budget; beats needing a full-mode turn that the minimal path never produces.

A narrative spec cannot catch these. A **mechanical score** and a **golden playthrough test** can. Both are cheap next to a playtest-fix cycle.

## The pipeline

Each phase gates the next. The owner signs off twice; nothing is implemented before sign-off #2.

| # | Phase | Output | Gate |
|---|-------|--------|------|
| 1 | **Narrative spec** | `docs/act<N>-*-spec.md` — case, scene flow, facts, gate, choice (shape rules: `docs/act-structure-design-doc.md`) | story-integrity + historian review → **owner sign-off #1** |
| 2 | **Mechanical score** | `docs/act<N>-mechanical-score.md` — the beat table (below) | pre-checks pass + consistency review → **owner sign-off #2** |
| 3 | **Golden scenario** | new scenario in `scripts/qa-golden.ts`, transcribed from the score — **red** | it fails for the right reason (content absent) |
| 4 | **Implement** | story data in `engine/stories/whitechapel-1888/` | golden green + `npm run qa:all` green |
| 5 | **Playtest** | blind run (game-reviewer) + owner run against the score | findings triaged (below) |
| 6 | **Done** | — | golden stays in `qa:all` permanently |

## The mechanical score

One row per beat. Every column must be filled — a blank cell is an undesigned decision, and undesigned decisions are where Act 0's fix commits came from.

| Column | Pins down bug class |
|--------|--------------------|
| Trigger — exact action + flag it sets (resolver grammar: `examined_<loc>_<obj>`, `opened_`, `took_`, `asked_<npc>_about_<factId>`, `showed_<obj>_to_<npc>`, `beat_<id>`) | 1 |
| Turn window — earliest/latest turn or prerequisite flags | 1 |
| Narration mode required (full / compact) + extra word budget if the beat carries a mandatory reveal | 5 |
| NPCs on stage — and explicitly what the **sidebar** may show | 2 |
| Objects visible — display name **and aliases** | 3 |
| Facts newly askable | 1 |
| Diary / Documents-tab consequence | 4 |

Plus, once per act: the gate-flag table (flag → verb → scene), the choice and its branches (flags + every downstream read), an NPC schedule row per participant (`scheduleByAct` entry or `presenceRequiresFlag`), and the act-entry anchor + epilogue decision.

## Pre-checks (mechanical, before sign-off #2)

- **Alias sweep** — every proposed display name and alias against `intentParser.ts` object aliases *and* the display-name substring scan. This is the check that would have caught `open the box` resolving to an Act 4 parcel.
- **Flag grammar** — every flag in the score follows a resolver grammar `qa:validate` can see.
- **Presence** — every NPC in a beat has a `scheduleByAct` entry or a `presenceRequiresFlag`, and the score says which.
- **Chronology** — every date/duration stated in the score appears once, in a canonical-facts block; prose in phase 4 cites it rather than restating it.

## The golden test

`scripts/qa-golden.ts` — one scenario per act, threading real state turn by turn with the **clock and turn counter advancing** (unlike `qa-engine.ts`, whose helpers deliberately freeze time; that's why it forks them). Rules:

- Transcribe the score, don't improvise: each step asserts the flags, presence, visibility, and askability the score's row promises.
- Assert **negatives** too — not-present-before, not-askable-before, examine-does-not-satisfy-open. The bug classes live in the negatives.
- Branches (the act's choice) get their own scenario, including the diary variant each branch selects.
- Goldens run in `qa:all` forever. A later engine change that breaks an act's timeline should fail loudly.

## Playtest triage

Every playtest finding is one of two things:

- **Spec violation** — behavior contradicts the score. Fix order: score first (was it wrong?), then the golden assertion, then the code. Never patch code against an unamended score.
- **Taste** — the score is honored but the experience needs polish. Budget one deliberate polish cycle per act; this is normal, not churn.
