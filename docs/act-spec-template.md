# Act &lt;N&gt; — spec template

Copy to `docs/act<N>-<slug>-spec.md` and fill every field. Process, gates and the
rationale for every section: `docs/act-authoring-process.md`. Schema:
`packages/schema/story.ts`, `rule.ts`, `common.ts`. Vocabulary: `GLOSSARY.md`.

**A blank cell is an undesigned decision.** Act 0's fix commits came from blanks:
first from undesigned *state* (timing, flags, visibility), then from undesigned
*words* (what the player types, what the prose names, what the model invents).
The rebuilt engine closes some of those by mechanism (the selection model, the
Disclosure Ledger, the invention gate) and only narrows the rest; the process
doc's table says which. Sections F–I cover the narrowed ones. Do not skip them
because they look like paperwork.

Each field notes the check that enforces it. If a field has a check, filling it
in wrong is cheap to discover. If it says *(no check — judgement)*, that field is
only as good as the author.

**Porting an act** from the `archive/pre-phase4-engine` branch: the old
`acts.ts`, `storyEvents.ts`, `events.ts`, `rumors.ts` and `docs/act*-spec.md` are
source material, not this spec. Fill every section fresh.

---

## A. Act identity

| Field | Value |
|---|---|
| Act id / `name` | |
| `dateLabel` (shown in the sidebar) + day of week | |
| `startClockMinutes` | |
| `weather` (a weather id the Story declares) | |
| `anchorLocation` (entering the act moves the player here; counts as `enter`) | |
| Act-entry Beat: Watson's voice, why he is here (a Rule on `enter` the anchor, or on the gate flag) | |
| Gate: the Rule whose `advanceAct` ends the act, and its full trigger + `when` | |
| Prover goals this act adds (act id, Clue ids, ending ids) | |

> All prose lives in Story JSON: location, Object, person and ending `beats`, Fact
> `statement` and `voices`, Clue `summary`, `document` text, `playBeat` lines. The
> engine knows no story, so there is no second home for it to drift into.
> *Check: none needed — there is nowhere else to put it.*

---

## B. The case

Per the episodic structure: **opening event → investigation → specific conclusion
→ Baker Street debrief → one choice.**

- **One-line premise:**
- **Opening event** (what happens *to* Watson to start the act):
- **Investigation** (the middle — what the player actually does):
- **Conclusion** (specific, not "the act ends"):
- **Debrief** (what Holmes/Watson make of it):
- **The choice** (exactly one; both branches must be *typed actions*, never reached by omission):
  - Branch A → Rule: … → flag: … → downstream reads (Rules and `when` conditions):
  - Branch B → Rule: … → flag: … → downstream reads:

*Check: `qa:story` fails a flag read but never set; the golden runs each branch.*

---

## C. Canonical facts block

Every date, duration, quantity, sum and proper name the act uses, stated **once
here**. Beats, Fact statements and Clue summaries cite this block rather than
restating it.

| Fact | Canonical value |
|---|---|
| | |

> **Quantities are load-bearing.** If a figure is deliberately vague, write it with
> *no number at all* — not "well over a week". A vague quantity invites the model
> to supply the precision it implies; that is how "no rain for nine days" got
> fabricated. The invention gate now rejects a number absent from the turn's
> context, but a rejected turn costs a regeneration and, on a second rejection,
> falls back to the bare Beats. Either state the figure or omit the measure.
> *Check: the invention gate (`packages/ai/gate.ts`) on every live narration.*

---

## D. Locations and Objects

One row per Object. The `name` is what the selection model matches.

| Object id | `name` | `aliases` | Placement | `hidden` until (Rule) | `item` | `container` / lock | `document` | `fact` / Clue |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

New or changed locations: `name`, `beats`, each exit's `names` and `to`, any
`lock` (flag or key Item) and `lockedBeat`, `openPeriods` and `closedBeat`.

- **Name collisions:** every `name` and alias checked against every Object, person
  and exit name that can share a Candidate Set with it (here, carried, present).
  Two that fit a phrase equally make the selection model answer `none`. The
  Candidate Set carries `name` only today (`packages/engine/candidates.ts`), so
  `aliases` do not rescue a name the player would not type.
- **Scenery discipline:** an Object with no verb, no Fact and no Rule is clutter.
  Act 0 shipped three and later cut them. Prefer 4–5 real Objects.
- **One identity:** an Object carried, in a container or on a table is the same
  Object. Never author a second Object for "the letter, now in hand".

*Checks: `qa:story` (dangling placement, locks, exits, containers); the golden
(visibility before and after each `revealObject`).*

---

## E. Characters

One block per person in this act. Existing people: note only what **changes**.

```
id:
name / alias (alias is shown until the introduction condition is met):
introduction: self (first talk) | document <object id>
schedule for this act: default + byPeriod → at <location> | follows <person> | offstage
arrivals by Effect: summonPerson / movePerson / dismissPerson, and which Rule
  (entering the next act clears these: the person returns to that act's schedule)
disposition at act start, and any setDisposition:
beats (IS sent, every turn the person is present):
```

> A person's `beats` reach the narrator on **every** turn they are present, so they
> are where identity must live: sex, standing, dress, manner. A beat that names
> Mrs Kemp's sex only in the scene where she arrives is lost on the next turn;
> that is how Holmes came to call her "a man". The alias is shown everywhere
> until introduction: make it carry who they are ("the woman at the door").
> *Checks: `qa:story` (alias with no introduction; schedule refers to real acts,
> periods, locations; follow cycles).*

---

## F. Facts and topics *(the Heath-road class)*

One row per askable Fact.

| Fact id | `statement` | `knownBy` | `visibleFromAct` | `topics` | `voices` | `spoilerTerms` | Clue? |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

**The standing rule:** *every proper noun the act's own prose puts in front of the
player must be askable.* If Holmes says "Heath-road" in a `playBeat`, "ask holmes
about heath road" must find a Fact he knows whose topics cover it. The Disclosure
Ledger stops a person denying a Fact they told; it cannot help with a name that
was only ever a Beat. This applies to `playBeat` lines, location, Object and
person `beats`, Fact statements and Clue summaries alike.

- Write topic phrases as *the player would type them*, not as you named the Fact.
  The selection model matches the player's subject against the phrases offered
  for the person addressed, so one or two good phrases are enough. Do not pad
  synonyms defensively; padding is how `"the work"` collided with `"the dock workers"`.
- No near-synonyms between Facts the **same person** knows. The model will pick
  one, perhaps the wrong one, or answer `none`.
- A person can speak to a Fact only once they know it and the act has reached its
  `visibleFromAct`. A Fact learned mid-act arrives by `grantFact` (optionally with
  `delayPeriods`, for a rumor; entering any act delivers it at once). The player
  may learn a Fact before its act from a document or a Rule: the prover lists each
  such path as EARLY, and the score says which are deliberate (ADR-0005).
- `knownBy: ["player"]` means the player starts knowing the Fact.
- A Clue is discovered the moment the player learns its Fact by any route: told,
  read (an Object's `fact`), or `grantFact` to `player`.

*Checks: `qa:story` (a phrase shared by two Facts; a warning on a `grantFact` to the
player that can fire before `visibleFromAct`; spoiler terms in earlier beats); the
prover's EARLY lines; the golden (askable
before/after via `candidates(...).topics`). Near-synonyms: no check — judgement.*

---

## G. Rules and the mechanical score *(one row per beat)*

| Column | Pins down |
|---|---|
| **Trigger** — kind and fields; for `action`, *every* verb the player might reach for ("answer the door" may be `open` or `use`); `once`; Effects in order | timing; *dead scenes* |
| **Turn window** — `when`: act, location, period, weather, flagsAll / flagsNone, hasItems, personsPresent, factsKnown | timing |
| **Narration** — mode (`full` 160 whenever a Beat is queued, `opening` 220 on the first turn) and what shares the budget | dropped reveals |
| **People on stage** — and the label the sidebar shows (alias until introduced) | surface disagreement |
| **Objects** — `name`, `aliases`, `hidden` until which Rule; what else shares the Candidate Set | name collisions |
| **Facts newly askable** — ids from section F | timing; topic collisions |
| **Subjects made askable** — every proper noun this beat says → the Fact whose topics cover it, or "deflects, intended" | *silence on a named thing* |
| **Identity anchors** — how this beat's own text or the person's `beats` establishes who each unnamed person is | *misgendering / conflation* |
| **Quantities** — every number stated, or explicitly `none` | *fabricated precision* |
| **Diary** — the Clue or document this beat adds | chronology drift |

Rule contract, one per Rule that carries a scene:

```md
Rule id:
Trigger: kind + fields; for `action`, every verb, target ids, person
When: act / location / period / flagsAll / flagsNone / hasItems / personsPresent / factsKnown
once: true, or false and why it may repeat
Effects, in order: setFlag …, revealObject …, summonPerson …, playBeat [numbered beats]
Narration: mode and budget, and what else shares it this turn
Read bare: the beats joined still read as prose (the gate's fallback)
```

> **Every eligible Rule fires**, in file order, and Effects cascade into further
> Rules (to a depth of 8). Two Rules on the same action both fire unless
> `flagsNone` excludes one.
>
> **Beats must be self-contained.** The narrator sees this turn's context, the
> persons' `beats`, the Ledger and a Transcript window, never the prose of
> earlier turns. If a beat refers to someone established two turns ago, restate
> who they are in this beat, or make sure their `beats` do.
>
> **Acknowledge the player.** If a beat *overtakes* the player's action ("Mrs
> Hudson beats him to the stairs"), the beat shows the attempt beginning first.

*Checks: `qa:story` (every id resolves; flags set and read; tick Rules have a
weight); the golden (positives per verb, negatives, the path).*

---

## H. Boundaries — what must NOT appear

Explicit, because the model will otherwise fill gaps from its own knowledge.

- **Spoilers sealed this act:** (Facts and names that must not surface yet; each
  later Fact lists them as `spoilerTerms`)
- **Cast is closed:** only the people in section E exist. No invented servants,
  page-boys, cabmen. *The wider Conan Doyle canon is not a source* — "Billy",
  Holmes's real page-boy, appeared out of nowhere because he is canonically
  plausible. The invention gate rejects such a name unless the context or the
  Story's `lexicon` carries it; do not add canon names to the lexicon to quiet it.
- **Flavour that reads as a clue:** the gate cannot catch an improvised "bloodstain
  on the sill". Beats for clue-bearing Objects state what is there, so the
  narrator has no gap to fill.
- **Historical boundary:** what has and has not happened by this date.
- **Anything the player can reach but the act does not cover:**

*Checks: the invention gate (proper nouns and numbers absent from context);
`qa:story` (spoiler terms in earlier beats).*

---

## I. Pre-flight *(all mechanical — run before calling the act done)*

- [ ] `npm run qa:story` green, warnings read
- [ ] Golden in `scripts/qa-<story>.ts`, in `qa:all`, written from the score,
      **red first** for the right reason, asserting negatives (not present
      before, not askable before, `once` not repeated, other branch unset) and
      ending with an exact replay check
- [ ] Prover on the Story: this act's goals UNREACHABLE before implementing,
      every act, Clue and ending REACHABLE after, search not capped
- [ ] `npm run qa:all` green
- [ ] `narrative-consistency-reviewer` on the changed JSON
- [ ] Every phrasing in section G maps to a verb its Rule's trigger lists (against
      the verb glossary in `packages/ai/prompts.ts`; live through `select` if
      `GEMINI_API_KEY` is set)
- [ ] Blind playtest (`game-reviewer`), `qa-playthrough` for live narration, **and**
      an owner run against the score

> **Playtest is not optional.** Every bug in the Act 0 polish sessions was found by
> playing, not by a harness — the harnesses were green throughout. Goldens drive
> explicit Selections; they cannot tell you a player would word it differently,
> or that the selection model would choose what the golden chose.

---

## Triage

- **Spec violation** — behaviour contradicts the score. Fix order: score first
  (was it wrong?), then the golden assertion, then the data. Never patch data
  against an unamended score.
- **Taste** — the score is honoured, the experience needs polish. One deliberate
  polish cycle per act is normal, not churn.
