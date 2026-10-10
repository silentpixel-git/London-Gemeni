# Act 0 — The Wager — narrative spec

**Classification:** act rework. Replaces the Mrs Kemp Act 0 ("The Bank Holiday") wholesale.
**Phase:** 1 of the act-authoring pipeline (narrative spec). Sections A–F and H are filled here.
Section G (the beat-by-beat mechanical score) and section I (pre-flight) are phase 2 and are
**not** part of this sign-off.
**Voice reference:** `docs/act0-window-wager.md` (story and beat map). This spec is
authoritative where the two differ.
**Owner decisions already taken (chat, 2026-10-10):** Holmes's "unremarkable man" thesis stays.
The coda's last line stays. The Act 1 transition is deferred until Act 0 is right. Saves are
not a concern.

---

## A. Act identity

| Field | Value |
|---|---|
| Number / name | 0 — **The Wager** (`ACT_NAMES[0]`, currently "The Bank Holiday") |
| In-game date + day of week | Monday 6 August 1888, Bank Holiday — the evening before Martha Tabram is killed |
| Canonical clock start (`ACT_TIME_CONFIG`) | **7:30 PM** (`canonicalMinutes: 1170`), changed from 8:30 PM. Reason: the act runs through dusk; the lamplighter beat and the opera glass both depend on failing light. Sunset in London on 6 Aug is about 7:40 PM GMT, and 1888 had no summer time. |
| Weather (`ACT_WEATHER`) | `clear-warm` / "Warm, Clear" — unchanged |
| Entry anchor location | none — the game starts at `baker_street` (unchanged) |
| Opening (`OPENING_FIXED_LINE`) | Rewritten: the holiday, the heat, both windows up, Holmes at the window after a failed afternoon at the bench. This is the act's only fixed authored text. |
| Bridge line (`ACT_BRIDGES[1]`) | **Deferred** (owner decision 3). The current text is a stale leftover and is out of scope here. |
| Gate flags (`ACT_PROGRESSION[0]`) | The five required beats in §B: demonstration, wager, soldier read, clergyman read, closing. Exact flag names are set in the score. |

## B. The case

There is no case, by design. Act 0 is the tutorial and the calm before. The episodic shape is
kept loosely: opening event → task → conclusion → debrief. There is **no moral choice** (see
the open question at the end).

- **One-line premise:** On the bank holiday evening, Holmes is bored at the window and bets
  Watson that he can't read two strangers in the street the way Holmes reads them.
- **Opening event:** Holmes demonstrates on the victualler and his daughter, and on the
  Hampstead man with Heath-road dust on his boots, separating what is observed from what is
  inferred. **He reads the Hampstead man's boots through his opera glass and puts it down on the
  mantel.** This is the glass's only introduction, and the player sees it in use before it matters.
  Watson calls it a parlour trick.
- **Investigation (the task):** Holmes proposes the wager and names two figures in the street.
  The player reads each one: EXAMINE the figure, then TALK to Holmes about it.

  **The commit rule** (review issue 1): **EXAMINE only describes. TALK to Holmes about the
  figure commits Watson's reading.**
  - EXAMINE narration states Watson's observations (the coat, the cuffs, the book, the moving
    lips) and never voices a conclusion.
  - The reading is spoken, and judged, only when the player raises the figure with Holmes.
  - Using the glass at any point before that TALK counts as "glass first".
  - TALK about a figure not yet examined is allowed: Watson looks and reads in the same beat,
    without the glass.
  - The two figures can be read in either order.
  1. **The old soldier** at the kerb by the cab rank. Watson's reading is medical and always
     correct: infantry bearing, Indian service, an old fracture of the left thigh healed short.
     Holmes concedes it and adds the one thing Watson missed (he is watching for a grandchild).
  2. **The "clergyman"** outside the chemist's. Without the glass, Watson reads a poor country
     curate and is wrong; Holmes hands him the opera glass and points to the greasepaint and
     the script, and he is an actor between performances. If the player TAKEs the opera glass
     from the mantel and USEs it on the clergyman *before* giving a reading, Watson finds the
     greasepaint himself and gets it right.

  **The glass works on every figure** (review issue 2). USE glass WITH the soldier gives one
  extra detail, a faded campaign ribbon on his coat, but doesn't change his reading, which is
  already correct. USE glass WITH the crowd or the window gives a short piece of texture.
  Neither ever returns "nothing happens", so a player who tries the glass early is encouraged
  to keep using it. Natural wordings such as "look at the clergyman through the glass" must reach
  USE; that's a phase 2 trigger-phrasing row. TAKE is genuinely required, because the engine
  needs the glass in inventory for USE…WITH.
- **Conclusion:** the wager is settled. If both readings are right, Watson wins; this happens
  only if the glass was used first.
- **Debrief (closing):** Holmes asks Watson to describe anyone else who has passed under the
  window, and Watson can't. "We see what asks to be seen. A man who asks nothing of anybody…
  might pass under this window every evening for a year and never once be looked at." This is
  the game's thesis, stated in August as a complaint about tedium.

  **The closing must not take over a question** (review issue 3). It never fires on the turn in
  which the player asks a specific question; the first follow-up after the verdict (the actor,
  the greasepaint, the grandchild) is answered normally. It fires on the player's next action
  after the verdict, of any kind, that isn't a specific question to Holmes. That covers
  EXAMINE window or crowd, TALK to Holmes with no topic, or any other action. There is a fallback
  after a few turns. The exact trigger and threshold are set in the score.
- **Coda (narrated):** the wager payoff (Holmes leaves the violin alone, or Watson reads the
  tobacco-ash monograph), then the open windows: "the last evening of that summer on which it
  did not occur to me to [close them]."
- **Branches:** the outcome is a **skill branch, not a choice**.
  - Win → flag along the lines of `act0_wager_won` → read only by the coda line and the diary
    entry.
  - Lose → no flag → read by the same two places.
  - Nothing is read after Act 0.
- **The glass at act end:** the closing returns the glass to the mantel (removed from
  inventory) whether or not the player took it. In the lose branch, if the player is already
  holding it, Holmes says "use the glass" instead of handing it over. The glass never carries
  into Act 1.
- **One-time deviation from the template, recorded:** Act 0 has no typed moral choice. The
  win/lose branch is decided by omission (not using the glass), which the template forbids for
  choices. This is accepted **for the tutorial only**, because the omission is the act's
  lesson and the glass is shown in use on the first turn. It is not a precedent for later
  acts.

## C. Canonical facts block

| Fact | Canonical value |
|---|---|
| Date | Monday 6 August 1888, Bank Holiday |
| Clock at start | 7:30 PM |
| Sunset | about 7:40 PM; the lamplighter passes during the wager |
| Holmes's afternoon | a chemical experiment that failed: "went black and stank", a little after seven |
| How long Holmes and Watson have known each other | **seven years** (met 1881) |
| The victualler | a licensed victualler with his daughter, kept out "an hour past the time her mother allowed" |
| The Hampstead man | walked in from Hampstead that morning to save the fare; Heath-road dust white to the ankle; about **four miles** (the existing fact) |
| The crowd | "a hundred thousand people" in the streets (Watson's narration, in the opening); "some hundreds" have passed under the window during the wager (Watson's answer at the close) |
| The old soldier | **about sixty**; coat too heavy for August; stick in the left hand; infantry; Indian service, not recent; old fracture of the left thigh, healed short; probably a sergeant; waiting for a grandchild |
| Watson's reference | the base hospital at **Peshawar** (canon: *A Study in Scarlet*) |
| The "clergyman" | an actor, still in his costume of black coat and white tie, between the matinée and the evening performance; learning new lines from a thin paper script in a coloured wrapper; a line of greasepaint at the hairline beside the ear |
| The theatre | **unnamed**: "a West End house", a melodrama with a clergyman in it. He is not wanted until the second act, which is why he is still in Baker Street in costume around 7:40. *(The Princess's was checked and rejected: its summer 1888 bill was *The Still Alarm*, a fire-engine melodrama.)* |
| The opera glass | Holmes's. He uses it in the demonstration and sets it on the mantel |
| Watson's wound | **never located** in this act. Canon contradicts itself (shoulder in *A Study in Scarlet*, leg in *The Sign of Four*) |
| Win stake | Holmes will not touch the violin before **midnight**; he has been playing it "on and off since Saturday" |
| Lose stake | Watson reads Holmes's monograph on the ashes of the various tobaccos, "**a hundred and forty** varieties", plates included (canon) |
| Historical boundary | No Whitechapel murder has happened. Martha Tabram is killed about 2:30 AM on Tuesday 7 August, about four miles east. Nobody in this act knows or hints at it. |

## D. Locations and objects

One location: `baker_street`, kept with its atmosphere and description rewritten. **The rewrite
must fix these conflicts in the current entry:**
- `timeOfDay: 'night'` and "warm lamplight": at 7:30 PM the sun is still up, so the entry needs
  late daylight going to dusk.
- "A concluded case bundled": there is no case in this act.
- "Chemistry bench wiped down": the bench has just "gone black and stank".

The description must name **the mantel and the opera glass on it**, and the violin and
monograph, so every object the player needs is named in the room before it matters. All Kemp
objects are removed: `pawn_ticket`, `nells_boots`, `nells_workbox`, `nells_letters`,
`charity_card`, along with their `CLUE_TRIGGERS` and `CLUE_GATES` entries. The alias column is
a starting list; the sweep against `intentParser.ts` is a phase 2 pre-check.

| Object id | Display name | Aliases (candidate) | Visible from | Verbs | Container? | Clue? |
|---|---|---|---|---|---|---|
| `open_window` | the open window (exists) | window, street, view, crowd outside | start | EXAMINE | no | no |
| `crowd` | the holiday crowd (exists) | crowd, people, passers-by, bystanders | start | EXAMINE | no | no |
| `street_soldier` | the old soldier | old man, soldier, veteran, old fellow, man by the cab rank | wager offered | EXAMINE | no | no (deduction object) |
| `street_clergyman` | the clergyman | clergyman, curate, parson, man outside the chemist's | wager offered | EXAMINE, USE glass WITH | no | no (deduction object) |
| `opera_glass` | Holmes's opera glass | opera glass, glass, glasses, field glass, spyglass | start (on the mantel) | EXAMINE, TAKE, USE…WITH | no | no |
| `holmes_violin` | the violin | violin, fiddle, violin case | start | EXAMINE | no | no (wager-stake texture) |
| `tobacco_monograph` | the monograph | monograph, tobacco monograph, ashes | start | EXAMINE | no | no (wager-stake texture) |

Scenery discipline: the chemistry bench is mentioned in the opening only and is **not** an
object. The violin and monograph are kept because both are named stakes the player will
naturally examine. **Alias risk to sweep:** `glass` and `glasses` may collide with other
acts' objects.

## E. Characters

```
id: holmes (existing — Act 0 changes only)
Role line (Act 0): Bored at the open window on the bank holiday evening, contemptuous of the
  holiday's harmlessness; once Watson calls his method a parlour trick he turns playful and
  competitive, and is generous when beaten.
Presence: unchanged (Baker Street, Act 0).
```

The Act 0 cast is **Holmes and Watson only**. `mrs_kemp` is removed from `npcs.ts` and every
schedule, and her facts go too. Every street figure is an **object**, not an NPC: the player
reads them through the glass and the window, never talks to them. Mrs Hudson does not appear.

## F. Facts and topics

All are `knownBy: ['holmes']` and `visibleFromAct: 0`. The topic phrases are a starting list,
written as a player would type them; `qa:topics` and the partial-match sweep happen in phase 2.

| Fact id | Statement (gist) | requireFlags | Topic phrases |
|---|---|---|---|
| `holmes_heath_road_dust` | kept as is | demonstration | heath road, heath-road, hampstead, the dust, his boots, the man from hampstead |
| `holmes_victualler_deduction` | kept as is | demonstration | the victualler, the publican, his daughter, the girl |
| `holmes_observation_vs_inference` | kept as is | demonstration | observation, inference, the difference, your method |
| `holmes_holiday_dull` | **new**, replacing `holmes_crime_grown_dull`: London has taken a holiday from wickedness and he resents it; nothing in the street needs explaining | — | the holiday, bank holiday, crime, boredom, wickedness |
| `holmes_the_wager` | **new**: the terms (two readings; the violin until midnight against the monograph) | wager offered | the wager, the bet, the terms, the stakes |
| `holmes_violin_stake` | **new**: he has been at the violin since Saturday; he keeps his word | wager offered | the violin, your violin, midnight |
| `holmes_monograph` | **new**: the monograph on the ashes of the various tobaccos, a hundred and forty varieties, with plates | wager offered | the monograph, tobacco ash, the ashes, the plates |
| `holmes_soldier_grandchild` | **new**: the soldier watches at a child's height, so he is waiting for a grandchild | soldier read | the grandchild, the old soldier, what i missed |
| `holmes_actor_reading` | **new**: greasepaint, the script, a West End melodrama with a clergyman in it, not wanted until the second act; "you saw a black coat and stopped looking" | clergyman read | the actor, the clergyman, greasepaint, the theatre, the play, the second act |
| `holmes_watsons_service` | **new**, a canon callback: he knew Watson for an Afghan man the day they met. The statement must **not** say where Watson was wounded; Watson's eye for a soldier's leg is the surgeon's, not the detective's | soldier read | afghanistan, peshawar, your service, my wound |
| `holmes_opera_glass` | **new**: a good glass, French, bought for the opera and used for everything else; "the eye is the instrument, Watson, the glass merely brings the street nearer" | — | the opera glass, your glass, the glass |
| `holmes_invisible_in_a_crowd` | **reworded and gated on the closing**: "we see what asks to be seen" | closing | the crowd outside, being noticed, what asks to be seen |

Remove all `kemp_*` facts and Holmes's Kemp-era facts: `holmes_no_case_here`,
`holmes_boots_bermondsey`, `holmes_letters_tuesdays`, `holmes_honest_object`,
`holmes_mothers_name` and `holmes_concluded_case`. The "concluded case" isn't in the new story.
Keep it as "an unnamed case, done with" if Holmes's boredom needs a reason.

**Every proper noun in this act's prose must be askable:** Hampstead, Heath road, Peshawar,
India, Afghanistan, Baker Street. "The Park" (Regent's Park) is
used as a direction only; either cut it from the prose or add it as a topic.

## H. Boundaries — what must not appear

- **Nothing sealed this act is a spoiler:** no murder, no Whitechapel, no Tabram, no
  "Ripper", no police. Holmes's crowd thesis is general and names no one. The coda's darkness
  is *Watson in hindsight*, and only in the last line.
- **The cast is closed:** Holmes and Watson. No Mrs Hudson, no Billy the page-boy, no
  client, no telegram. The street figures don't speak and aren't named. The lamplighter is
  scenery inside a beat, not a person.
- **History:** August 1888 is high summer, with no fog and no cold. Gas lamps. Holmes smokes a
  pipe. No Moriarty and no Irene Adler. *The Sign of Four* hasn't happened (it's September), so
  there's no Mary Morstan, though the tobacco monograph already exists as a canon detail.
- **Within reach but not covered:** the player can't leave 221B in Act 0. `dorset_street` is
  the listed exit today; the score must decide whether it is blocked with an authored
  in-character refusal ("Holmes would never forgive me for leaving with the wager
  unsettled").

---

## Carried to phase 2 (the mechanical score)

From the story-integrity review. These need no owner decision now:
- **Topic collisions to sweep:** "the crowd" (object and closing fact), "the violin" (object
  and fact), "the soldier" and "the clergyman" (each both the trigger for its read and the
  topic of the fact unlocked by that read).
- **`dorset_street` exit:** block it with an authored in-character refusal.
- **`act0_midnight_bells`** (`events.ts`) can never fire, because the clock is capped at
  11:59 PM. Delete it with the rest of the Kemp-era Act 0 data.
- **Win/lose diary variant:** goes in `diary*.ts`, keyed on the win flag.
- **Clock:** the critical path at current time costs is about 30 in-game minutes (7:30 to
  about 8:00 PM), which fits the lamplighter beat.

## Open question for the owner (part of sign-off #1)

**Act 0 has no choice.** The template expects exactly one choice, with both branches reached by
something the player types. The wager is a *skill* branch: the "lose" branch is reached by
**not** using the glass, which is exactly what the template forbids for choices.

My recommendation is to **accept it for the tutorial**, recorded as a one-time deviation
(§B). The story-integrity review agreed, on condition that the glass is shown in use before it
matters and that the moment a reading is committed is unambiguous; both are now in §B. The rule exists so that moral choices
aren't decided by omission. A skill check where omission means "you didn't look closely" *is*
the lesson of the act.

The alternative is to add a trivial typed choice at the close, such as closing the windows or
leaving them open. I'd advise against that: it cheapens the last line.
