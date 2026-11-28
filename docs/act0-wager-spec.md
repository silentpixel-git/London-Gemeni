# Act 0 — The Wager — narrative spec (rebuilt engine)

**Classification:** port. The first act of the Whitechapel Story written for the rebuilt engine, and
the first act in `stories/`. Phase 1 of `act-authoring` (narrative spec): sections A–F and H. The
mechanical score (section G) and pre-flight (I) are phase 2 and not part of this sign-off.

**Sources:**
- **Story and voice:** `docs/act0-window-wager.md` (the story and its beat map). Where the two
  differ, this spec wins.
- **Previous spec:** written for the old engine on 2026-10-10, committed as "phase 1, pending review"
  and never signed off. It is in this file's git history (`4ddfd72`). Its narrative carries over.
  Its mechanisms (`ACT_TIME_CONFIG`, `CLUE_TRIGGERS`, `requireFlags`, the intent parser,
  `diary*.ts`) no longer exist.
- **Look and sound:** the clickable prototype, `docs/act0-prototype.html`. The audio takes for the
  glass going down and the riffled pages were picked from it and are already in the game.

**Reviews folded in:** `story-integrity-reviewer` (2026-11-28) and a historian pass.

**Owner decisions already taken (chat, 2026-10-10), carried as given:**
- Holmes's "unremarkable man" thesis stays.
- The coda's last line stays.
- Saves are not a concern.

**New in this port:** the seven decisions in "For sign-off" at the end. **All seven were decided by
the owner (chat, 2026-11-28), each as recommended.**

---

## A. Act identity

| Field | Value |
|---|---|
| Story | New directory `stories/whitechapel_1888/`, id `whitechapel_1888`, title **The Whitechapel Diaries**. Act 0 is its only act until Act 1 is authored |
| Narrator | Watson, first person, past tense, writing in hindsight. The voice lines come from `narration-voice-check` (phase 2) |
| `lexicon` | **London, English**: a city and a nationality, which the schema allows. Nothing from the wider canon goes in |
| Act id / `name` | 0 — **The Wager** |
| `dateLabel` | **Monday 6 August 1888** (Bank Holiday) |
| `startClockMinutes` | **1170** (7:30 PM). The act runs through dusk, and the lamplighter and the glass both need failing light |
| Periods (story-wide) | Six, matching the old engine's hours: `late_night` 0:00, `dawn` 5:00, `morning` 7:00, `afternoon` 12:00, `evening` 17:00, `night` 20:00. Act 0 opens in `evening` and crosses into `night` during the wager |
| `weather` | `clear_warm`, "Warm, Clear", with the `still_air` weather layer |
| `anchorLocation` | `baker_street` (the opening places the player there) |
| Ambience | `baker_street` plays the `holiday_street` bed in this act (the prototype's mix). Its own bed for later acts stays `baker_street` |
| Opening | Beats, with its best sentence as a quotation (decision 3): the holiday, the heat, both windows up, the crowd's murmur, Holmes at the window after an afternoon at the bench that ended "a little after seven" when something went black and stank. Two beats are explicit: **Holmes is still holding the opera glass**, and **he has not yet spoken** |
| Gate | The coda Rule, which fires on the action after the closing. It plays the coda for whichever branch was won, then **ends the game with the prologue ending** (decision 2). `endGame` stops the cascade, so the coda Beat comes first. When Act 1 exists, `endGame` becomes `advanceAct 1` |
| Prover goals added | Act 0; Clues *The Old Soldier*, *The Actor* (one per branch), *What Asks to Be Seen*; ending `prologue_end`. Ids are set in the score |

## B. The case

There is no case, by design. Act 0 is the tutorial and the calm before: opening → demonstration →
task (the wager) → conclusion → debrief → coda. There is **no moral choice** (decision 1).

- **One-line premise:** on the bank holiday evening, Holmes is bored at the window and bets Watson he
  cannot read two strangers in the street.
- **Opening event:** the room, the heat, Holmes at the window, the glass in his hand.
- **The demonstration** fires on the player's first action of any kind (not `look`, not
  `inventory`), with a first-Tick fallback.
  - Why it fires so early: while Holmes holds it, the glass is outside the Candidate Set and the
    sidebar (decision 4), so it must not stay in his hand for more than one turn. This matches the
    voice reference, where Holmes speaks first, "without turning".
  - Holmes reads the licensed victualler and his daughter, and the man who walked in from Hampstead.
  - He separates what he observes (the Heath-road dust, white to the ankle) from what he infers (that
    the man walked).
  - **He lowers the opera glass and sets it on the mantel** (decision 4). This is how the glass is
    introduced: the player sees it used before it matters. Watson calls the whole thing a parlour
    trick.
- **The wager** (the next exchange with Holmes, or a Tick: his boredom proposes it unprompted):
  - The wager Beat restates Watson's parlour-trick jab, because beats must be self-contained.
  - **Terms:** two strangers. If Watson reads both, Holmes leaves the violin alone until midnight. If
    he fails, Watson reads the tobacco-ash monograph, plates included.
  - **The commit rule is stated in the fiction:** "Tell me when you have him. I shall hold you to
    your first answer."
  - **The two figures:**
    - the old fellow on the kerb by the cab rank, **under the window**;
    - the clergyman **across the street outside the chemist's**, his face half-lost under his hat
      brim in the failing light.

    The distance and the light are the fiction's only hint that the naked eye won't do for the
    clergyman. There is no hint system.
  - Both figures appear in the street from this point.
- **The task:** read each figure. **EXAMINE only describes; telling Holmes your reading commits it.**
  - EXAMINE gives Watson's observations (the coat, the cuffs, the book, the moving lips) and never a
    conclusion. By eye, the clergyman's description supports only the curate reading. The greasepaint
    and the script's short lines are visible only through the glass.
  - The reading is spoken, and judged, only when the player raises the figure with Holmes: "talk to
    Holmes about the soldier", "tell Holmes about the clergyman".
  - Raising a figure that hasn't been examined is allowed: Watson looks and reads in the same beat,
    without the glass.
  - Either figure can go first.
  1. **The old fellow (a soldier).** Watson's reading is medical and always right: infantry bearing,
     Indian service (not recent), an old fracture of the left thigh healed short, probably a
     sergeant. Holmes concedes it and adds the one thing Watson missed: the man is waiting for a
     grandchild.
  2. **The "clergyman".**
     - *Without the glass*, Watson reads a poor country curate and is wrong. Holmes hands him the
       glass, points to the greasepaint at the hairline and the script in his hand (the man is an
       actor between performances), and takes the glass back. If the player is already holding the
       glass, Holmes says "use the glass" instead of handing it over. A point to Holmes. The rebuke
       is about evidence, not the guess: "you saw a black coat and stopped looking", given as a
       quotation (decision 6).
     - *If the player looked at the clergyman through the glass before giving a reading*, Watson
       finds the greasepaint himself and is right. A point to Watson. "Through the glass" means USE
       the glass on the clergyman, or EXAMINE the clergyman while carrying the glass: a player
       holding the glass who "looks closely" means it.
- **The glass works on everything it can reach.**
  - On the soldier it adds one detail, a faded campaign ribbon, without changing his reading.
  - On the crowd or the window it adds a short piece of texture.
  - It never answers "nothing happens", so a player who tries it early is encouraged to keep using
    it.
  - It works from the mantel. The engine lets USE reach anything here, so the glass Rules don't
    depend on where it lies, and their Beat has Watson take it up.
- **Conclusion:** the wager is settled. Watson wins only if the glass came first.
- **Debrief (the closing):**
  - Holmes asks Watson to describe anyone else who has passed under the window, and Watson can't.
  - "We see what asks to be seen. A man who asks nothing of anybody … might pass under this window
    every evening for a year and never once be looked at." Given as a quotation, so it is carried as
    written.
  - **The closing never takes over a question.** The first specific question after the verdict (the
    actor, the greasepaint, the grandchild) is answered normally.
  - The closing fires on the player's next action that isn't a question to Holmes, nor `look` or
    `inventory`. The exact trigger is set in the score.
- **Coda (narrated, then the ending)**, on the next action or Tick after the closing:
  - It is split from the closing, so neither has to share the 160-word budget with the other. A Tick
    may carry the coda, but never the closing speech: the narrator renders a Tick as one or two
    sentences.
  - **If Watson won:** Holmes leaves the violin in its case.
  - **If Watson lost:** Holmes lays the monograph in Watson's lap (the `pages_riffle` cue).
  - **Both:** the open windows — "the last evening of that summer on which it did not occur to me to
    [close them]." Given as a quotation. It is also the prologue ending's beat.
- **The branch is a skill branch, not a choice.**
  - The win flag is read only by the coda Beat and by which clergyman Clue enters the diary
    (decision 5).
  - Nothing reads it after Act 0. No Effect returns the glass to the mantel at the act's end: while
    the act ends the game, it doesn't matter.

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
| The old fellow (the soldier) | **about sixty**; a coat too heavy for August; stick in the left hand; infantry; Indian service, not recent; old fracture of the left thigh, healed short; probably a sergeant, **long out of the army but still standing like one**; waiting for a grandchild; a faded campaign ribbon (through the glass) |
| Watson's reference | the base hospital at **Peshawar** (canon, *A Study in Scarlet*) |
| The "clergyman" | an actor in costume: black coat, white tie, coat shiny at the seams, cuffs turned; learning new lines from a thin paper script in a coloured wrapper; a line of greasepaint at the hairline beside the ear |
| The theatre | **unnamed** — "a West End house", in a melodrama with a clergyman in it. He isn't wanted until the second act. *(The Princess's was checked and rejected: its summer 1888 bill was* The Still Alarm*.)* |
| The opera glass | Holmes's; French; bought for the opera and used for everything else |
| Watson's wound | **never located** in this act (canon contradicts itself) |
| Win stake | the violin is not touched before **midnight**; Holmes has been at it "on and off since Saturday" |
| Lose stake | the monograph on the ashes of the various tobaccos, **a hundred and forty** varieties, plates included (canon) |
| Historical boundary | No Whitechapel murder has happened. Martha Tabram is killed about 2:30 AM on Tuesday 7 August, about four miles east. Nobody in this act knows of it or hints at it |

- **The soldier's service:** the voice reference's line that he "has not been out of his regiment
  long enough to stop standing to attention" is cut. It contradicts his age and his old service; he
  stands like a soldier from long habit.

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
| `street_soldier` | the old fellow by the cab rank | old man, soldier | `baker_street` | the wager | no |
| `street_clergyman` | the clergyman across the street | curate, parson, man outside the chemist's | `baker_street` | the wager | no |
| `opera_glass` | Holmes's opera glass | opera glass, glass | **held by Holmes**, then the mantel after the demonstration | — | yes |
| `holmes_violin` | the violin | violin case, fiddle | `baker_street` | — | no |
| `tobacco_monograph` | the monograph | tobacco monograph | `baker_street` | — | no |
| `chemistry_bench` | the chemistry bench | bench, experiment | `baker_street` | — | no |
| `mantel` | the mantelpiece | mantel | `baker_street` | — | no |

**Changes from the old spec:**
- **The glass starts in Holmes's hand** (decision 4).
- **The bench and the mantel are now Objects.** The old spec kept the bench as scenery. But the
  opening names it, the glass lies on the mantel, and CLAUDE.md's coherence rule says whatever the
  prose shows must resolve to something.
- **The soldier isn't called "the old soldier" on screen.** The sidebar shows Object names from the
  wager onward, and "soldier" would give away Watson's reading. Aliases don't reach the selection
  model, so his beats carry "the old fellow" too.

**Covered without Objects of their own:**
- **The victualler and the Hampstead man** are written into the crowd's and the window's beats. So
  "examine the man from Hampstead" resolves to the crowd, and Holmes's Facts answer questions about
  either.
- **The lamplighter** is scenery inside a Beat.

**Name collisions to sweep in phase 2:**
- "glass" against "window" (a window glass);
- "the man …" against the soldier;
- "the mantel" against the glass that lies on it.

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
| `holmes_violin` | his violin; he has been at it on and off since Saturday (**no stake**) | from the start | the violin |
| `holmes_monograph` | his monograph on the ashes of the various tobaccos, a hundred and forty varieties, with plates (**no stake**) | from the start | the monograph, tobacco ash |
| `holmes_watsons_service` | he knew Watson for an Afghan man the day they met, seven years ago. **Never says where Watson was wounded** | from the start | afghanistan, peshawar, india, your service |
| `holmes_heath_road_dust` | the Hampstead man's boots, white to the ankle with Heath-road dust; he walked the four miles to save the fare | demonstration | hampstead, heath road, the dust, his boots |
| `holmes_victualler` | the licensed victualler kept his daughter out an hour past her mother's time | demonstration | the victualler, the publican, his daughter |
| `holmes_observation_vs_inference` | the dust is observed; that he walked is inferred; "nobody else in London" notes the difference | demonstration | observation, inference, your method |
| `holmes_the_wager` | the terms: two readings; the violin until midnight against the monograph; **he holds Watson to his first answer** | wager | the wager, the bet, the stakes |
| `holmes_soldier_reading` | the old fellow: infantry, India and not lately, the left thigh healed short, a sergeant | soldier read | the old fellow, the soldier, the leg |
| `holmes_soldier_grandchild` | he watches the crowd at the height of a child's head: he is waiting for a grandchild | soldier read | the grandchild |
| `holmes_actor_reading` | **neutral, true in either branch:** greasepaint, the script, a West End melodrama with a clergyman in it, not wanted until the second act | clergyman read | the actor, greasepaint, the theatre, the second act |
| `holmes_invisible_in_a_crowd` | "we see what asks to be seen" | closing | being noticed, what asks to be seen |

- The rebuke ("you saw a black coat and stopped looking") lives only in the lose verdict's Beat, so a
  winning player who asks about the actor is never scolded for a mistake they didn't make.
- The stakes live only in `holmes_the_wager`, so the violin and the monograph are askable from the
  start without it sounding as if the wager were already struck.

**What Watson can tell** (the commit rule):

| Fact id | Statement (neutral) | Player knows it | Topics |
|---|---|---|---|
| `watson_reading_soldier` | Watson's reading of the old fellow at the kerb | the wager | the old fellow, the man by the cab rank |
| `watson_reading_clergyman` | Watson's reading of the clergyman outside the chemist's | the wager | the clergyman, the curate |

**How the commit rule works:**
- Telling Holmes one of these Facts is the commit. The engine offers a Fact the player knows and
  Holmes doesn't as a "tell" topic. "talk to Holmes about the clergyman" becomes a disclosure from
  the player to Holmes, and a `disclosed` Rule plays the verdict.
- Once Holmes knows it, the "tell" topic is gone and the figure's phrases fall to Holmes's own Fact
  (`holmes_soldier_reading`, `holmes_actor_reading`). So "ask Holmes about the soldier" after the
  verdict is answered, never deflected.
- The verdict's words differ by branch, so the statement stays neutral and the branch lives in the
  Rule.
- "I deduce the clergyman is an actor" reaches `deduce`, which needs its own Rule or a phrasing row.
  That goes in the score.

**Diary (Clues):**
- A Clue enters when the player learns its Fact. Each Clue's Fact is granted at its verdict **to both
  the player and Holmes**, never known by anyone at the start. Holmes knowing it keeps it askable;
  nobody knowing it at the start means the win Clue can't be had by asking.

| Clue | Its Fact | Entered when |
|---|---|---|
| **The Old Soldier** | `holmes_soldier_grandchild` | the soldier is read |
| **The Actor** | a win Fact: "found through the glass, before I spoke" | the clergyman is read, win |
| **The Actor** | a lose Fact: "Holmes put the glass in my hand" | the clergyman is read, loss |
| **What Asks to Be Seen** | `holmes_invisible_in_a_crowd` | the closing |

- The two actor Clues share a name; exactly one ever enters the diary (decision 5). Their Facts need
  distinct topic phrases, because `qa:story` fails an exact duplicate even when only one can be
  known. Ids and phrases are set in the score.
- **Holmes under Persons:** the diary lists what each person has *told* the player. In this engine
  that is only what came out of an `ask`. Everything Holmes says in Beats (the demonstration, the
  wager, the verdicts, the closing) is not recorded as told by him. See decision 7.

**Every proper noun this act's prose puts in front of the player is askable or in the lexicon:**

| Name | Covered by |
|---|---|
| Hampstead, Heath road | `holmes_heath_road_dust` |
| Peshawar, Afghanistan, India | `holmes_watsons_service` (from the start), and `holmes_soldier_reading` for India |
| Baker Street | the location |
| the West End | `holmes_actor_reading` |
| London; "English" | the `lexicon` |
| Saturday, August | calendar words, which the gate allows |
| "the Park" | **cut from the prose** (direction only) |

## H. Boundaries — what must not appear

- **Nothing later is sealed into this act:** no murder, no Whitechapel, no Tabram, no "Ripper", no
  police. Holmes's crowd thesis is general and names no one. The coda's darkness is Watson writing in
  hindsight, and only in the last line.
- **The cast is closed:** Holmes and Watson. No Mrs Hudson, no Billy, no client, no telegram. The
  street figures don't speak and aren't named. **Nothing from the wider canon goes into the
  `lexicon`** to quiet the invention gate.
- **Flavour that reads as a clue:** not a risk here, since nothing is a case clue. Still, the
  figures' Beats state exactly what is there (the greasepaint is visible only through the glass), so
  the narrator has no gap to fill.
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

From the reviews and from this port. None of these needs an owner decision now.
- **The closing's trigger:** an action Rule on every verb except `ask` to Holmes, `look` and
  `inventory`, gated on both readings.
  - If the player only asks, the coda's Tick fallback still ends the act, but the closing needs one
    non-question action to land.
  - The score pins whether the closing also gets a fallback. If so, its Beat must fit a Tick.
- **Phrasings that must reach the right verb:**
  - "look at the clergyman through the glass" must reach USE glass WITH clergyman;
  - "tell Holmes my reading" must reach the tell topic;
  - "I deduce he is an actor" must reach `deduce`.
- **Budgets** (`full` is 160 words, `opening` 220). These all run long in the voice reference, so the
  score splits or trims each:
  - the demonstration (about 200 words);
  - the wager (about 180);
  - the clergyman verdict (about 250 in the lose branch);
  - the closing (about 250).

  The opening must fit 220.
- **Numbers the invention gate must find in each turn's context:** sixty, four, seven, a hundred and
  forty, a hundred thousand, midnight. Each goes in a Beat or Fact of that turn, never only in an
  earlier one.
- **Who hears it:** when the demonstration fires on "examine the window", the turn doesn't involve
  Holmes. His lines then enter neither his transcript nor his ledger (decision 7 covers the ledger).
- **Cues:**
  - `glass_down` when Holmes sets the glass on the mantel;
  - `lamplighter` on a `clock` Rule as dusk falls;
  - `pages_riffle` in the lose coda;
  - the clue chime comes from the engine.
- **Coverage of the verbs:** the shortest path is talk and tell only, and never uses EXAMINE, TAKE or
  USE. "It teaches EXAMINE, TAKE and USE" is an invitation, not a requirement. The score records it.
- **Default Story:** new games keep starting on the stress fixture until Act 0 passes its playtest.
  The switch is a one-line env change (`VITE_DEFAULT_STORY`) decided then.

---

## For sign-off #1 — seven decisions

**Decided by the owner, 2026-11-28: all seven as recommended. Spec signed off (sign-off #1), 2026-11-28.** 1 accept for the tutorial; 2 prologue
end card; 3 beats with quoted lines; 4 the glass in Holmes's hand with the early demonstration;
5 two branch Clues; 6 both (a) and (b); 7 make the engine change (`grantFact` with `from`) before any
Act 0 data.

1. **No choice in Act 0.** The template wants one typed moral choice. The wager is a skill branch
   whose losing side is reached by omission (not using the glass), which the template forbids for
   choices.
   - **Recommendation: accept it for the tutorial only**, as a recorded one-time deviation. The
     omission is the lesson ("you saw a black coat and stopped looking"). The glass is shown in use
     before it matters, the clergyman stands too far off in failing light to be read by eye, and
     Holmes's terms say the first answer counts.
   - The alternative, a trivial typed choice at the close, would cheapen the last line.
2. **The act ends the game for now.** With no Act 1 in the new engine, the coda ends the
   Investigation with a "prologue" ending: an end card carrying the open-windows line, under a name
   that doesn't read as "The End". When Act 1 is authored, `endGame` becomes `advanceAct 1` and the
   ending is removed.
   - **Recommendation: yes.** A placeholder Act 1 would be content nobody approved.
3. **The opening is paraphrased, apart from its quoted lines.** The new engine has no channel for
   fixed prose except documents. But the narrator carries a quotation inside a Beat as written. So:
   - the opening is Beats in Watson's voice, within 220 words, with its best sentence quoted;
   - the lines you protected are quoted too, and so carried as written: the coda's last line, "We see
     what asks to be seen …", and "you saw a black coat and stopped looking";
   - everything else is the narrator's own words around the Beats.
   - **Recommendation: accept.**
4. **The glass starts in Holmes's hand.** He sets it on the mantel during the demonstration, with
   the `glass-down` cue. So the player can't pocket it before he has shown what it is for, and the
   sound lands on the moment it describes.
   - The cost: while he holds it, the glass is outside the Candidate Set and the sidebar. So the
     demonstration fires on the player's first action of any kind, and the glass is in his hand for
     one turn at most.
   - **Recommendation: yes, with that trigger.**
5. **The diary records the win.** The new diary holds Clues, not free-form entries. The clergyman
   gets two Clues of the same name, one per branch: "found through the glass, before I spoke" versus
   "Holmes put the glass in my hand". Exactly one is ever entered. With the soldier and the thesis,
   Act 0 puts three Clues in the diary, which also teaches the player the diary exists.
   - **Recommendation: yes.**
6. **The reading is Watson's, not the player's words.** The engine can't read what the player typed
   as their answer. So "tell Holmes the clergyman is an actor learning his lines", typed without the
   glass, still gets Watson's curate reading and Holmes's correction. A sharp player who guessed from
   the moving lips would feel cheated.
   - **Recommendation: both of these.**
     - The naked-eye description supports only the curate reading. A man reciting to himself outside
       a chemist's reads as a curate getting a lesson by heart, and the greasepaint and the script's
       short lines show only through the glass.
     - The verdict's rebuke is about evidence, not the conclusion: you saw a black coat and stopped
       looking.
   - The alternative is to accept the occasional mismatch.
7. **Holmes's spoken lines don't reach the ledger or the diary.** Almost everything Holmes says in
   this act is a Beat. The engine records a person as having *told* the player something only when
   the player asked. So after an act that is nothing but Holmes talking, his entry under Persons is
   nearly empty. And on turns that didn't involve him, the narrator loses the memory that he already
   said it.
   - CLAUDE.md asks, for this kind of gap, what general mechanism is missing. The likely answer is an
     attributed grant: `grantFact` with an optional `from`, recording a disclosure from that person
     exactly as an `ask` does.
   - That is a small, story-neutral engine change, with its own `engine-logic-reviewer` pass and
     `qa:core` coverage, done **before** this act's data and independent of it.
   - **Recommendation: make the engine change.** The alternative is to accept a thin Persons entry
     for Holmes in Act 0, and a narrator who can contradict what Holmes said in a Beat. That cuts
     against the coherence rule.
