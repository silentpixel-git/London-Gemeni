# Act &lt;N&gt; — spec template

Copy to `docs/act<N>-<slug>-spec.md` and fill every field. Process and gates:
`docs/act-authoring-process.md`. Shape rules: `docs/act-structure-design-doc.md`.

**A blank cell is an undesigned decision.** Act 0's fix commits came from blanks —
first from undesigned *state* (timing, flags, visibility), then from undesigned
*words* (what the player types, what the prose names, what the model invents).
Sections F–I exist because of the second kind and are the newest part of this
template; do not skip them because they look like paperwork.

Each field notes the check that enforces it. If a field has a check, filling it
in wrong is cheap to discover. If it says *(no check — judgement)*, that field is
only as good as the author.

---

## A. Act identity

| Field | Value |
|---|---|
| Number / name | |
| In-game date + day of week | |
| Canonical clock start (`ACT_TIME_CONFIG`) | |
| Weather (`ACT_WEATHER`) | |
| Entry anchor location (`ACT_ANCHORS`) | |
| Bridge line (`ACT_BRIDGES`) — Watson's voice, why he is here | |
| Gate flags that end the act (`ACT_PROGRESSION`) | |

> Authored prose lives in **story data only** (`acts.ts`, `diary*.ts`, `storyEvents.ts`).
> Never in a hook or component. The Act 0 opening line existed in two files, drifted,
> and an edit landed in the dead copy and appeared to do nothing.

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
  - Branch A → flag: … → downstream reads:
  - Branch B → flag: … → downstream reads:

---

## C. Canonical facts block

Every date, duration, quantity, sum and proper name the act uses, stated **once
here**. Prose elsewhere cites this block rather than restating it.

| Fact | Canonical value |
|---|---|
| | |

> **Quantities are load-bearing.** If a figure is deliberately vague, write it with
> *no number at all* — not "well over a week". A vague quantity invites the model
> to supply the precision it implies; that is exactly how "no rain for nine days"
> got fabricated. Either state the figure or omit the measure.
> *Check: `qa:invention` flags numeric specifics absent from the turn's context.*

---

## D. Locations and objects

One row per object. Aliases are not optional — they are how the player reaches it.

| Object id | Display name | Aliases | Visible once (flag) | Verbs | Container? | Clue? |
|---|---|---|---|---|---|---|
| | | | | | | |

- **Alias sweep:** every display name and alias checked against `intentParser.ts`
  aliases *and* the display-name substring scan. This is what catches
  `open the box` resolving to an Act 4 parcel.
- **Scenery discipline:** an object with no verb, no clue and no story consequence
  is clutter. Act 0 shipped three and later cut them. Prefer 4–5 real objects.
- Objects removed from a location must also leave `CLUE_TRIGGERS`.
  *Check: `qa:validate`.*

---

## E. Characters

One block per NPC in this act. Existing NPCs: note only what **changes**.

```
id:
Display name / alias (if requiresIntroduction):
Bio (authoring metadata — NOT sent to the AI):
Role line (IS sent — one sentence, carries how they must read on stage):
Speaking style (IS sent):
Personality (IS sent, 3–5 traits):
Presence: scheduleByAct entry, or presenceRequiresFlag / presenceForbidFlag
Introduction: how their real name is learned, if gated
```

> `description` is authoring metadata and never reaches the model. Anything the
> narration **must** obey belongs in `role`, `speakingStyle` or `personality`.
> Mrs Kemp kept being written as a housekeeper until her clothing moved into `role`.

---

## F. Facts and topics *(new — the Heath-road class)*

One row per askable fact.

| Fact id | Statement | knownBy | visibleFromAct | requireFlags | Topic phrases |
|---|---|---|---|---|---|
| | | | | | |

**The standing rule:** *every proper noun the act's own prose puts in front of the
player must be askable.* If Holmes says "Heath-road" aloud, "ask holmes about heath
road" cannot hit silence. This applies to prose in **fact statements, story-event
beats and clue descriptions** alike.

- Write topic phrases as *the player would type them*, not as you named the fact.
- A fact reachable by only one or two phrasings is acceptable — the `parseTopic`
  AI tier covers the tail. Do not pad synonyms defensively; over-padding is how
  `"the work"` collided with `"the dock workers"`.
- Beware **short topics**: a bare entity name (`nell`) matches any question merely
  mentioning it. The specificity gate defers those to the AI tier, but prefer a
  distinguishing phrase where the subject is genuinely different.

*Checks: `qa:validate` (proper-noun coverage in beats; partial-match theft),
`qa:topics` (every authored phrase reaches its own fact, gated at 100%).*

---

## G. Story events / mechanical score *(one row per beat)*

| Column | Pins down |
|---|---|
| **Trigger** — intent + target/NPC/topic, and the flag it sets | timing |
| **Trigger phrasings** — every natural wording, incl. short forms | *dead scenes* |
| **Turn window** — earliest/latest, requireFlags / forbidFlags | timing |
| **Narration mode** + word budget (raise it if a beat carries a mandatory reveal) | dropped reveals |
| **NPCs on stage** — and what the **sidebar** may show | surface disagreement |
| **Objects visible** — display name *and* aliases | parser collision |
| **Subjects made askable** — proper nouns this beat introduces → topic phrases | *silence on a named thing* |
| **Identity anchors** — how this beat's own text establishes who each unnamed person is | *misgendering / conflation* |
| **Quantities** — every number stated, or explicitly `none` | *fabricated precision* |
| **Diary / Documents consequence** | chronology drift |

> **Beats must be self-contained.** Each narration call is single-shot — the model
> has **no memory of previous turns**. If a beat refers to someone established two
> turns ago, restate who they are *in this beat's own text*. Holmes called Mrs Kemp
> "a man of wavering resolution" because the bell-ringing beat named no gender and
> the model guessed.
>
> **Acknowledge the player.** `playerInput` now reaches every prompt, but if a beat
> *overtakes* the player's action ("Mrs Hudson beats him to the stairs"), the beat
> must show the attempt beginning first.

Event contract format (compact turns only — never attach to `full`/`opening`):

```md
Event id:
Trigger(s): resolved intent + target/NPC/topic; aliases beside the local trigger
Prerequisites: required flags, forbidden flags, location and presence rules
Semantic effects: one-shot event flag + every story/inventory/presence effect
Narration: max words, then numbered semantic beats in required order
Fallback: none, or why silence would block the player; eligible actions + threshold
```

---

## H. Boundaries — what must NOT appear *(new)*

Explicit, because the model will otherwise fill gaps from its own knowledge.

- **Spoilers sealed this act:** (facts/names that must not surface yet)
- **Cast is closed:** only the NPCs in section E exist. No invented servants,
  page-boys, cabmen. *The wider Conan Doyle canon is not a source* — "Billy",
  Holmes's real page-boy, appeared out of nowhere because he is canonically
  plausible.
- **Historical boundary:** what has and has not happened by this date.
- **Anything the player can reach but the act does not cover:**

*Check: `qa:invention` flags proper nouns absent from the turn's context.*

---

## I. Pre-flight *(all mechanical — run before calling the act done)*

- [ ] `npm run qa:all` green (includes `qa:topics`, `qa:validate`, the act's golden)
- [ ] Golden scenario written from the score, **red first**, asserting negatives
      (not-present-before, not-askable-before) — the bug classes live in negatives
- [ ] `npx tsx scripts/qa-narration.ts` — read the report; check the
      **invented-specifics warnings** and reword any beat that invites a number
- [ ] Every trigger phrasing from section G actually resolves (`parseIntent` probe)
- [ ] Blind playtest (`game-reviewer`) **and** an owner run against the score

> **Playtest is not optional.** Every bug in the Act 0 polish sessions was found by
> playing, not by a harness — the harnesses were green throughout. Goldens verify
> the path *the author chose to write*; they cannot tell you a player would word it
> differently. That is the entire reason `qa:topics` exists.

---

## Triage

- **Spec violation** — behaviour contradicts the score. Fix order: score first
  (was it wrong?), then the golden assertion, then the code. Never patch code
  against an unamended score.
- **Taste** — the score is honoured, the experience needs polish. One deliberate
  polish cycle per act is normal, not churn.
