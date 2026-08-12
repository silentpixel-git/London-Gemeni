# Act Authoring Process

How an act goes from idea to done. The companion skill (`.claude/skills/act-authoring/`) enforces this; this doc is the rationale and the reference.

**Start here:** copy `docs/act-spec-template.md` to `docs/act<N>-<slug>-spec.md` and fill it. This doc explains *why* each field exists; the template is what you actually fill in.

## Why this exists

Act 0 had an approved 400-line narrative spec before a line of code was written — and still took roughly twenty fix commits. The spec specified the *story*; every fix landed in a dimension it never pinned down:

1. **Timing** — content firing on the wrong turn (Mrs Kemp's arrival, facts askable before the puzzle that earns them, a branch skipping the reconstruction).
2. **Surface disagreement** — sidebar and hints showing what the engine gates (presence-gate bypasses, container contents leaking across locations).
3. **Parser collision** — new object names shadowed by existing aliases (`box` → parcel_box, `letter` → from_hell_letter, apostrophe aliases unreachable).
4. **Cross-surface chronology** — one fact stated in several places drifting apart (the pawn ticket's timeline, fixed twice).
5. **Narration-mode interaction** — reveals dropped by word budget; beats needing a full-mode turn that the minimal path never produces.

A narrative spec cannot catch these. A **mechanical score** and a **golden playthrough test** can. Both are cheap next to a playtest-fix cycle.

### The second generation (Act 0 polish, 2026-08-12)

The five classes above are all about **engine state**. A later polish pass produced a distinct family, all about **words** — and the score as originally specified caught none of them:

6. **Trigger phrasing gaps** — `answer the door` was authored; a player typed `answer door` and the scene was simply dead, falling through to the unrecognised-input handler (which then hallucinated a departure). The alias sweep covered object *display names*, never story-event `rawPhrases`.
7. **Silence on a named thing** — Holmes says "Heath-road" aloud, the player asks about it, and he denies knowing it. Any proper noun the act's own prose introduces must be askable.
8. **Topic collision** — one fact's topic phrase silently stealing another's (`the boots`, `the work`). The exact-duplicate check could not see it; the theft is by *partial* match.
9. **Cross-turn identity loss** — Holmes called Mrs Kemp "a man" because that turn's beat named no gender and narration calls are single-shot with no memory of prior turns.
10. **Fabricated specifics** — a beat reading "well over a week" became "no rain for nine days"; a page-boy called "Billy" arrived from the wider Doyle canon.

Classes 6–10 are why `docs/act-spec-template.md` has sections F–I, and why `qa:topics`, the partial-match check in `qa:validate`, and `qa:invention` exist. **Every one of these was found by playing, not by a harness** — `qa:all` was green throughout. Goldens verify the path the author chose to write; they cannot tell you a player would word it differently.

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
| **Trigger phrasings** — every natural wording incl. short forms (`answer door`, not only `answer the door`) | 6 |
| **Subjects made askable** — every proper noun this beat's prose introduces, with its topic phrases | 7, 8 |
| **Identity anchors** — how this beat's *own text* establishes who each not-yet-named person is | 9 |
| **Quantities** — every number stated, or explicitly `none`; never a vague measure that invites precision | 10 |

Plus, once per act: the gate-flag table (flag → verb → scene), the choice and its branches (flags + every downstream read), an NPC schedule row per participant (`scheduleByAct` entry or `presenceRequiresFlag`), and the act-entry anchor + epilogue decision.

## Pre-checks (mechanical, before sign-off #2)

- **Alias sweep** — every proposed display name and alias against `intentParser.ts` object aliases *and* the display-name substring scan. This is the check that would have caught `open the box` resolving to an Act 4 parcel.
- **Flag grammar** — every flag in the score follows a resolver grammar `qa:validate` can see.
- **Presence** — every NPC in a beat has a `scheduleByAct` entry or a `presenceRequiresFlag`, and the score says which.
- **Chronology** — every date/duration stated in the score appears once, in a canonical-facts block; prose in phase 4 cites it rather than restating it.
- **Trigger phrasing probe** — run every wording in the score's *Trigger phrasings* column through `parseIntent` and confirm it reaches the intended event. Class 6; this is the check that would have caught `answer door`.
- **Topic sweep** — `npm run qa:topics` (every authored phrase reaches its own fact, gated at 100%) plus `qa:validate`'s proper-noun coverage and partial-match-theft checks. Classes 7–8.
- **Prose home** — all authored prose lands in story data (`acts.ts`, `diary*.ts`, `storyEvents.ts`), never in a hook or component. The Act 0 opening line lived in two files, drifted, and an edit landed in the dead copy.

## The golden test

`scripts/qa-golden.ts` — one scenario per act, threading real state turn by turn with the **clock and turn counter advancing** (unlike `qa-engine.ts`, whose helpers deliberately freeze time; that's why it forks them). Rules:

- Transcribe the score, don't improvise: each step asserts the flags, presence, visibility, and askability the score's row promises.
- Assert **negatives** too — not-present-before, not-askable-before, examine-does-not-satisfy-open. The bug classes live in the negatives.
- Branches (the act's choice) get their own scenario, including the diary variant each branch selects.
- Goldens run in `qa:all` forever. A later engine change that breaks an act's timeline should fail loudly.

## Action-triggered story events

Use a story event only for a pivotal scene whose timing belongs to a resolved
player action. Timed city broadcasts remain world events; ambient texture,
vignettes and incidental NPC business remain in their existing systems.

Author each event as a compact contract:

```md
Event id:
Trigger(s): resolved intent + target/NPC/topic; list aliases beside the local trigger
Prerequisites: required flags, forbidden flags, location and presence rules
Semantic effects: one-shot event flag plus every story/inventory/presence effect
Narration: compact action turn, maximum words, then numbered semantic beats in required order
Fallback: none, or why silence would block/confuse the player; eligible actions and exact threshold
```

The Act 0 pilot supports compact action turns only. Do not attach this focused
story-event template to `full` or `opening` narration; those modes retain broader
arrival and survey instructions that can compete with the ordered event contract.

Aliases belong beside the event trigger that needs them, not in the global
parser, unless they are genuinely valid for that object or NPC throughout the
story. File order is priority order: the runtime selects at most one main event
per action. A declared fallback may follow as a distinct narration only; it
must not disguise a second main event or apply state twice.

Every event ships with three levels of proof:

- Positive tests for each canonical trigger and supported local alias.
- Negative tests for premature, blocked, unrelated and once-only attempts,
  including fallback exclusions and exact threshold boundaries.
- A golden path that asserts the prerequisites, semantic effects, visibility,
  word budget and branch outcome in the act's real turn order.

Narration-seam QA must also assert that Gemini receives every numbered beat and
the event word ceiling. The beats describe meaning, not copy-ready prose: Gemini
must cover each once and in order within one Watson response.

## Playtest triage

Every playtest finding is one of two things:

- **Spec violation** — behavior contradicts the score. Fix order: score first (was it wrong?), then the golden assertion, then the code. Never patch code against an unamended score.
- **Taste** — the score is honored but the experience needs polish. Budget one deliberate polish cycle per act; this is normal, not churn.
