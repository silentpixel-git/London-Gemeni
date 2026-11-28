# Act 0 — The Wager — narrative spec (rebuilt engine)

**Classification:** port. The first act of the Whitechapel Story written for the rebuilt engine, and
the first act in `stories/`. Phase 1 of `act-authoring` (narrative spec): sections A–F and H. The
mechanical score (section G) and pre-flight (I) are phase 2 and not part of this sign-off.

**Sources:**
- **Story and voice:** `docs/act0-window-wager.md` (the story and its beat map). Where the two differ,
  this spec wins.
- **Previous spec:** written for the old engine on 2026-10-10, committed as "phase 1, pending review"
  and never signed off. It is in this file's git history (`4ddfd72`). Its narrative carries over. Its
  mechanisms (`ACT_TIME_CONFIG`, `CLUE_TRIGGERS`, `requireFlags`, the intent parser, `diary*.ts`) no
  longer exist.
- **Look and sound:** the clickable prototype, `docs/act0-prototype.html`. The audio takes for the
  glass going down and the riffled pages were picked from it and are already in the game.

**Owner decisions already taken (chat, 2026-10-10), carried as given:**
- Holmes's "unremarkable man" thesis stays.
- The coda's last line stays.
- Saves are not a concern.

**New in this port:** the five decisions in "For sign-off" at the end.

---

## A. Act identity

| Field | Value |
|---|---|
| Story | New directory `stories/whitechapel_1888/`, id `whitechapel_1888`, title **The Whitechapel Diaries**. Act 0 is its only act until Act 1 is authored |
| Narrator | Watson, first person, past tense, writing in hindsight. The voice lines come from `narration-voice-check` (phase 2) |
| Act id / `name` | 0 — **The Wager** |
| `dateLabel` | **Monday 6 August 1888** (Bank Holiday) |
| `startClockMinutes` | **1170** (7:30 PM). The act runs through dusk, and the lamplighter and the glass both need failing light |
| Periods (story-wide) | Six, matching the old engine's hours: `late_night` 0:00, `dawn` 5:00, `morning` 7:00, `afternoon` 12:00, `evening` 17:00, `night` 20:00. Act 0 opens in `evening` and crosses into `night` during the wager |
| `weather` | `clear_warm`, "Warm, Clear", with the `still_air` weather layer |
| `anchorLocation` | `baker_street` (the opening places the player there) |
| Ambience | `baker_street` plays the `holiday_street` bed in this act (the prototype's mix). Its own bed for later acts stays `baker_street` |
| Opening | Beats, not verbatim text (decision 3): the holiday, the heat, both windows up, the crowd's murmur, Holmes at the window with his opera glass after an afternoon at the bench that ended "a little after seven" when something went black and stank |
| Gate | The closing Rule. It plays the coda for whichever branch was won, then **ends the game with the prologue ending** (decision 2). When Act 1 exists, that Effect becomes `advanceAct 1` |
| Prover goals added | Act 0; Clues `the_old_soldier`, `the_actor_found` / `the_actor_shown` (either branch), `what_asks_to_be_seen`; ending `prologue_end` |

## B. The case

There is no case, by design. Act 0 is the tutorial and the calm before: opening → demonstration →
task (the wager) → conclusion → debrief → coda. There is **no moral choice** (decision 1).

- **One-line premise:** on the bank holiday evening, Holmes is bored at the window and bets Watson he
  cannot read two strangers in the street.
- **Opening event:** the room, the heat, Holmes at the window, the glass in his hand.
- **The demonstration** (first exchange with Holmes, or looking out of the window or at the crowd):
  - Holmes reads the licensed victualler and his daughter, and the man who walked in from Hampstead.
  - He separates what he observes (the Heath-road dust, white to the ankle) from what he infers (that
    the man walked).
  - **He lowers the opera glass and sets it on the mantel** (decision 4). This is how the glass is
    introduced: the player sees it used before it matters. Watson calls the whole thing a parlour
    trick.
- **The wager** (the next exchange with Holmes):
  - **Terms:** two strangers. If Watson reads both, Holmes leaves the violin alone until midnight. If
    he fails, Watson reads the tobacco-ash monograph, plates included.
  - **The two figures:** the old fellow at the kerb by the cab rank, and the clergyman outside the
    chemist's. Both appear in the street from this point.
- **The task:** read each figure. **EXAMINE only describes; telling Holmes your reading commits it.**
  - EXAMINE gives Watson's observations (the coat, the cuffs, the book, the moving lips) and never a
    conclusion.
  - The reading is spoken, and judged, only when the player raises the figure with Holmes: "talk to
    Holmes about the soldier", "tell Holmes about the clergyman".
  - Raising a figure that hasn't been examined is allowed: Watson looks and reads in the same beat,
    without the glass.
  - Either figure can go first.
  1. **The old soldier.** Watson's reading is medical and always right: infantry bearing, Indian
     service (not recent), an old fracture of the left thigh healed short, probably a sergeant.
     Holmes concedes it and adds the one thing Watson missed: the man is waiting for a grandchild.
  2. **The "clergyman".**
     - *Without the glass*, Watson reads a poor country curate and is wrong. Holmes hands him the
       glass and points to the greasepaint at the hairline and the script in his hand: the man is an
       actor between performances. A point to Holmes.
     - *If the player took the glass and used it on the clergyman before giving a reading*, Watson
       finds the greasepaint himself and is right. A point to Watson.
- **The glass works on everything it can reach.**
  - On the soldier it adds one detail, a faded campaign ribbon, without changing his reading.
  - On the crowd or the window it adds a short piece of texture.
  - It never answers "nothing happens", so a player who tries it early is encouraged to keep using
    it.
  - Taking it is a real step, because the glass must be carried to be used.
- **Conclusion:** the wager is settled. Watson wins only if the glass came first.
- **Debrief (the closing):**
  - Holmes asks Watson to describe anyone else who has passed under the window, and Watson can't.
  - "We see what asks to be seen. A man who asks nothing of anybody … might pass under this window
    every evening for a year and never once be looked at."
  - **The closing never takes over a question.** The first specific question after the verdict (the
    actor, the greasepaint, the grandchild) is answered normally.
  - The closing fires on the player's next action that isn't a question to Holmes, with a fallback if
    the player only asks. The exact trigger is set in the score.
- **Coda (narrated, then the ending):**
  - **If Watson won:** Holmes leaves the violin in its case.
  - **If Watson lost:** Holmes lays the monograph in Watson's lap.
  - **Both:** the open windows — "the last evening of that summer on which it did not occur to me to
    [close them]."
- **The branch is a skill branch, not a choice.**
  - The win flag is read only by the coda Beat and by which clergyman Clue enters the diary
    (decision 5).
  - Nothing reads it after Act 0.
- **The glass at the act's end:** it goes back to the mantel whether or not the player took it. In
  the lose branch, if the player is already holding it, Holmes says "use the glass" instead of
  handing it over.

## C. Canonical facts block

Every figure and name the act uses, stated once. Beats, statements and Clue summaries cite this
block.

| Fact | Canonical value |
|---|---|
| Date | Monday 6 August 1888, Bank Holiday |
| Clock at start | 7:30 PM |
| Sunset | about **7:45 PM** GMT. 1888 had no summer time; the modern figure is 8:45 PM BST. The lamplighter passes during the wager, as the gas goes up across the street |
| Holmes's afternoon | a chemical experiment that failed, a little after seven: "went black and stank" |
| How long they have known each other | **seven years** (they met in 1881) |
| The victualler | a licensed victualler by the pillar box, with his daughter, kept out "an hour past the time her mother allowed" |
| The Hampstead man | under the lamp; walked in from Hampstead that morning to save the fare; Heath-road dust white to the ankle; **about four miles** |
| The crowd | "a hundred thousand people" in London's streets (opening). "Some hundreds" have passed under the window during the wager (Watson's answer at the closing). No other counts |
| The old soldier | **about sixty**; a coat too heavy for August; stick in the left hand; infantry; Indian service, not recent; old fracture of the left thigh, healed short; probably a sergeant; waiting for a grandchild; a faded campaign ribbon (through the glass) |
| Watson's reference | the base hospital at **Peshawar** (canon, *A Study in Scarlet*) |
| The "clergyman" | an actor in costume: black coat, white tie, coat shiny at the seams, cuffs turned; learning new lines from a thin paper script in a coloured wrapper; a line of greasepaint at the hairline beside the ear |
| The theatre | **unnamed** — "a West End house", in a melodrama with a clergyman in it. He isn't wanted until the second act. *(The Princess's was checked and rejected: its summer 1888 bill was* The Still Alarm*.)* |
| The opera glass | Holmes's; French; bought for the opera and used for everything else |
| Watson's wound | **never located** in this act (canon contradicts itself) |
| Win stake | the violin is not touched before **midnight**; Holmes has been at it "on and off since Saturday" |
| Lose stake | the monograph on the ashes of the various tobaccos, **a hundred and forty** varieties, plates included (canon) |
| Historical boundary | No Whitechapel murder has happened. Martha Tabram is killed about 2:30 AM on Tuesday 7 August, about four miles east. Nobody in this act knows of it or hints at it |

## D. Locations and Objects

One location, **`baker_street`** ("221B Baker Street, the sitting room"). Its beats name everything
the player needs before it matters:
- late daylight going to dusk, both windows open to the holiday;
- the chemistry bench, gone black and stinking;
- the mantel;
- the violin case and the monograph on the shelf.

**No exits in Act 0.** The player can't leave 221B, and the prose never invites them to. Trying gives
the engine's generic refusal (see H).

| Object id | `name` | Aliases (starting list) | Placement | Hidden until | Item |
|---|---|---|---|---|---|
| `open_window` | the open window | window, the street below | `baker_street` | — | no |
| `crowd` | the holiday crowd | crowd, the people, passers-by | `baker_street` | — | no |
| `street_soldier` | the old soldier | old fellow, man by the cab rank | `baker_street` | the wager | no |
| `street_clergyman` | the clergyman | curate, parson, man outside the chemist's | `baker_street` | the wager | no |
| `opera_glass` | Holmes's opera glass | opera glass, glass | **held by Holmes**, then the mantel after the demonstration | — | yes |
| `holmes_violin` | the violin | violin case, fiddle | `baker_street` | — | no |
| `tobacco_monograph` | the monograph | tobacco monograph | `baker_street` | — | no |
| `chemistry_bench` | the chemistry bench | bench, experiment | `baker_street` | — | no |

**Changes from the old spec:**
- **The glass starts in Holmes's hand** (decision 4).
- **The bench is now an Object.** The old spec kept it as scenery. But the opening names it, and
  CLAUDE.md's coherence rule says whatever the prose shows must resolve to something.

**Covered without Objects of their own:**
- **The victualler and the Hampstead man** are written into the crowd's and the window's beats. So
  "examine the man from Hampstead" resolves to the crowd, and Holmes's Facts answer questions about
  either.
- **The lamplighter** is scenery inside a Beat.

**Name collisions to sweep in phase 2:**
- "glass" against "window" (a window glass);
- "the man …" against the soldier;
- "the crowd" against the closing's topic phrase.

## E. Characters

```
id: holmes
name: Sherlock Holmes (no alias, no introduction needed: Watson knows him)
schedule, act 0: default at baker_street
disposition at start: neutral (bored); warm once the wager is struck
beats (sent every turn he is present):
  - a tall, lean man in shirtsleeves in the heat, at the open window, a pipe within reach
  - bored and contemptuous of the holiday's harmlessness; once Watson calls his method a
    parlour trick, playful and competitive, and generous when beaten
  - precise speech; separates what he observes from what he infers
```

- **The cast is Holmes and Watson only.** Watson is the narrator, not a person in the Story.
- **The street figures are Objects.** The player reads them; nobody talks to them.
- **Mrs Hudson does not appear.**

## F. Facts and topics

- All are `visibleFromAct: 0`.
- A Fact Holmes doesn't know at the start reaches him by `grantFact` at the beat that unlocks it.
  This replaces the old `requireFlags`.
- Topic phrases are a starting list, written as a player types them. The collision sweep is phase 2.

**What Holmes can tell:**

| Fact id | Statement (gist) | Holmes knows it | Topics (start) |
|---|---|---|---|
| `holmes_holiday_dull` | London has taken a holiday from wickedness and he resents it; nothing in the street needs explaining | from the start | the holiday, bank holiday, boredom |
| `holmes_opera_glass` | a good French glass, bought for the opera, used for everything else; "the eye is the instrument, the glass merely brings the street nearer" | from the start | the opera glass, your glass |
| `holmes_heath_road_dust` | the Hampstead man's boots, white to the ankle with Heath-road dust; he walked the four miles to save the fare | demonstration | hampstead, heath road, the dust, his boots |
| `holmes_victualler` | the licensed victualler kept his daughter out an hour past her mother's time | demonstration | the victualler, the publican, his daughter |
| `holmes_observation_vs_inference` | the dust is observed; that he walked is inferred; "nobody else in London" notes the difference | demonstration | observation, inference, your method |
| `holmes_the_wager` | the terms: two readings; the violin until midnight against the monograph | wager | the wager, the bet, the stakes |
| `holmes_violin_stake` | at the violin on and off since Saturday; he keeps his word | wager | the violin, midnight |
| `holmes_monograph` | the monograph on the ashes of the various tobaccos, a hundred and forty varieties, with plates | wager | the monograph, tobacco ash |
| `holmes_soldier_grandchild` | the soldier watches the crowd at the height of a child's head: he is waiting for a grandchild | soldier read | the grandchild |
| `holmes_watsons_service` | he knew Watson for an Afghan man the day they met. **Never says where Watson was wounded** | soldier read | afghanistan, peshawar, your service |
| `holmes_actor_reading` | greasepaint, the script, a West End melodrama with a clergyman in it, not wanted until the second act; "you saw a black coat and stopped looking" | clergyman read | the actor, greasepaint, the theatre, the second act |
| `holmes_invisible_in_a_crowd` | "we see what asks to be seen" | closing | being noticed, what asks to be seen |

**What Watson can tell** (the commit rule):

| Fact id | Statement (neutral) | Player knows it | Topics |
|---|---|---|---|
| `watson_reading_soldier` | Watson's reading of the old soldier at the kerb | the wager | the old soldier, the soldier, the man by the cab rank |
| `watson_reading_clergyman` | Watson's reading of the clergyman outside the chemist's | the wager | the clergyman, the curate |

**How the commit rule works:**
- Telling Holmes one of these Facts is the commit. The engine offers a Fact the player knows and
  Holmes doesn't as a "tell" topic. "talk to Holmes about the soldier" becomes a disclosure from the
  player to Holmes, and a `disclosed` Rule plays the verdict.
- The verdict's words differ by branch, so the statement stays neutral and the branch lives in the
  Rule.
- **No engine work is needed.**

**Diary (Clues):**

| Clue | Its Fact | Entered when |
|---|---|---|
| **The Old Soldier** | `holmes_soldier_grandchild` | the soldier is read |
| **The Actor** | `the_actor_found`: "found through the glass, before I spoke" | the clergyman is read, win |
| **The Actor** | `the_actor_shown`: "Holmes put the glass in my hand" | the clergyman is read, loss |
| **What Asks to Be Seen** | `holmes_invisible_in_a_crowd` | the closing |

- The two actor Clues share a name; exactly one ever enters the diary (decision 5).
- Holmes appears under Persons with everything he has told.

**Every proper noun this act's prose puts in front of the player is askable:**

| Name | Askable through |
|---|---|
| Hampstead, Heath road | `holmes_heath_road_dust` |
| Peshawar, Afghanistan | `holmes_watsons_service` |
| India | the soldier's verdict, via `holmes_soldier_grandchild` (phase 2 confirms the phrase) |
| Baker Street | the location |
| the West End | `holmes_actor_reading` |
| "the Park" | **cut from the prose** (direction only) |

## H. Boundaries — what must not appear

- **Nothing later is sealed into this act:** no murder, no Whitechapel, no Tabram, no "Ripper", no
  police. Holmes's crowd thesis is general and names no one. The coda's darkness is Watson writing in
  hindsight, and only in the last line.
- **The cast is closed:** Holmes and Watson. No Mrs Hudson, no Billy, no client, no telegram. The
  street figures don't speak and aren't named. **Nothing from the wider canon goes into the
  `lexicon`** to quiet the invention gate.
- **Flavour that reads as a clue:** not a risk here, since nothing is a case clue. Still, the figures'
  Beats state exactly what is there (the greasepaint is visible only through the glass), so the
  narrator has no gap to fill.
- **History:**
  - High summer: no fog, no cold.
  - Gas lamps. Holmes smokes a pipe.
  - No Moriarty, no Irene Adler. *The Sign of Four* hasn't happened (September), so no Mary Morstan.
    The tobacco monograph already exists in canon.
- **Reachable but not covered:** leaving 221B. There is no exit, so "go downstairs" gets the generic
  refusal. If the owner wants an in-character line ("Holmes would never forgive me for leaving with
  the wager unsettled"), that is a `lockedBeat` on a locked exit to a location that doesn't exist
  yet. Not proposed.

---

## Carried to phase 2 (the mechanical score)

From the old spec's review and from this port. None of these needs an owner decision now.
- **The closing's trigger:**
  - an action Rule on every verb except `ask` to Holmes, gated on both readings;
  - plus a fallback (a `clock` or `tick` Rule). Pinned in the score.
- **Phrasings that must reach the right verb:**
  - "look at the clergyman through the glass" must reach USE glass WITH clergyman;
  - "tell Holmes my reading" must reach the tell topic.
- **Budgets:**
  - The clergyman verdict, as written in the voice reference, runs past the 160-word `full` budget.
    The score splits it across Beats, or trims it.
  - The opening's beats must fit 220 words.
- **Numbers the invention gate must find in each turn's context:** sixty, four, seven, a hundred and
  forty, a hundred thousand, midnight. Each goes in a Beat or Fact of that turn, never only in an
  earlier one.
- **Cues:**
  - `glass_down` when Holmes sets the glass on the mantel;
  - `lamplighter` on a `clock` Rule as dusk falls;
  - `pages_riffle` in the lose coda;
  - the clue chime comes from the engine.
- **Default Story:** new games keep starting on the stress fixture until Act 0 passes its playtest.
  The switch is a one-line env change (`VITE_DEFAULT_STORY`) decided then.

---

## For sign-off #1 — five decisions

1. **No choice in Act 0.** The template wants one typed moral choice. The wager is a skill branch
   whose losing side is reached by omission (not using the glass), which the template forbids for
   choices.
   - **Recommendation: accept it for the tutorial only**, as a recorded one-time deviation. The
     omission is the lesson ("you saw a black coat and stopped looking"), and the glass is shown in
     use before it matters.
   - The alternative, a trivial typed choice at the close, would cheapen the last line.
2. **The act ends the game for now.** With no Act 1 in the new engine, the closing ends the
   Investigation with a "prologue" ending: an end card after the coda. When Act 1 is authored, that
   Effect becomes `advanceAct 1` and the ending is removed.
   - **Recommendation: yes.** A placeholder Act 1 would be content nobody approved.
3. **The opening is no longer verbatim.** The new engine has no channel for fixed prose except
   documents. The opening becomes Beats the narrator must carry, in Watson's voice, within 220 words,
   with the invention gate holding it to them. It reads close to the voice reference, but not word
   for word.
   - **Recommendation: accept.** Adding a verbatim channel is engine work, and nothing else needs it.
4. **The glass starts in Holmes's hand.** He sets it on the mantel during the demonstration, with the
   `glass-down` cue. So the player can't pocket it before he has shown what it is for, and the sound
   lands on the moment it describes.
   - **Recommendation: yes.**
5. **The diary records the win.** The new diary holds Clues, not free-form entries. The clergyman
   gets two Clues of the same name, one per branch: "found through the glass, before I spoke" versus
   "Holmes put the glass in my hand". Exactly one is ever entered. With the soldier and the thesis,
   Act 0 puts three Clues in the diary, which also teaches the player the diary exists.
   - **Recommendation: yes.**
