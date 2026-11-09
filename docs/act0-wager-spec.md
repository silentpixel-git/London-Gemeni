# Act 0 — The Wager — narrative spec (port to the rebuilt engine)

**Classification:** port. The story is the Wager of 10 October 2026 (`docs/act0-window-wager.md`, the voice reference, and the previous revision of this file in git history). It was specced, reviewed and prototyped (`docs/act0-prototype.html`) but never built, and no sign-off #1 was recorded for it. The archived engine still holds the Mrs Kemp Act 0, which this replaces. Every mechanism below is written fresh for the rebuilt engine: Story JSON, Rules, the selection model, ADR-0005.
**Scope:** Act 0 only (owner, 2026-11-09). No other act is specced, and nothing here assumes what Act 1 will be.
**Phase:** 1 of `docs/act-authoring-process.md`. Sections A–F and H. Section G (the mechanical score) and I (pre-flight) are phase 2 and not part of this sign-off.
**Owner decisions carried from 10 October:** Holmes's "unremarkable man" thesis stays; the coda's last line stays; saves are not a concern.
**Reviews (2026-11-09):** `story-integrity-reviewer` (17 findings, all folded in below; the ones that need the owner are in the questions at the end) and a `historian` pass (two corrections: the campaign ribbon and the Heath-road dust, both in §C).

---

## What changes from the 10 October spec

The story, the beats, the cast and the canonical facts are unchanged. These change, because the engine did:

| # | Was | Now | Why |
|---|---|---|---|
| 1 | Act 0 hands over to Act 1 through a bridge line | **Act 0 ends the game**, with one of two endings: *The Wager Won* or *The Wager Lost*. The coda is the ending's text. When an Act 1 exists, the closing Rule will advance to it instead | A Story must reach an ending, and Act 1 is out of scope. Two endings also give the win/lose coda a natural home |
| 2 | The opening paragraph is fixed text shown verbatim | The opening is **narrated from its beats**, like every other turn. The narrator carries their substance in Watson's voice | The engine has no verbatim channel. A beat written as a quotation is kept word for word, so Holmes's opening line can stay exact |
| 3 | Gating by `requireFlags` on Facts, `CLUE_GATES`, alias tables, the hint system | Rules with `when` conditions; Holmes **learns** a Fact (a `grantFact`) at the beat where he may speak of it; the selection model reads the player's words; the "Try" chips replace hints | None of the old mechanisms exist |
| 4 | "TALK to Holmes about the figure" commits Watson's reading | **Asking Holmes about a figure** commits it. The ask is what fires the reading Rule; examining a figure only describes it | Same rule, expressed as a `disclosed` trigger on a Fact Holmes is given when he names the figures |
| 5 | The glass returns to the mantel at the act's end | Dropped | The act ends the game, so nothing carries over |
| 6 | `dorset_street` exit, blocked with a refusal | **Baker Street has no exits.** "Leave" is a miss, narrated in character | Nothing else exists in this Story yet |
| 7 | Win/lose diary variant in `diary*.ts` | The diary shows **Clues**: one per reading and one for the result | The diary now shows Clues, documents and what each person told |
| 8 | The closing's "fallback after a few turns" | A **Tick Rule**: if the player sits still after the verdict, Holmes closes anyway | Ticks are the engine's way for time to act |
| 9 | Every proper noun askable as a topic | Same rule, plus the gate's **lexicon**: words the narrator may use freely (Bank Holiday, London, West End). Listed in §C | The gate rejects a capitalised word the turn's context does not hold |
| 10 | The glass lies on the mantel from the start | It starts **in Holmes's hand**; the demonstration puts it on the mantel | Otherwise the player can take it before Holmes reads through it |
| 11 | The closing and the coda in one beat | **Two turns**: the closing, then the ending on the player's next action (or a Tick) | One turn's 160 words cannot carry the thesis and the coda |
| 12 | "The old soldier" as the figure's name | "**The old man by the cab rank**" | The name did Watson's reading for him in the sidebar. "The clergyman" stays: it is the trap |

---

## A. Act identity

| Field | Value |
|---|---|
| Story | `whitechapel_1888`, directory `stories/whitechapel_1888/` (the directory name must equal the id). Title *London Bleeds: The Whitechapel Diaries* |
| Act id / `name` | 0 — **The Wager** |
| `dateLabel` | "Monday, 6 August 1888" — the August Bank Holiday |
| `startClockMinutes` | **1170** (7:30 PM). The act runs through dusk; sunset is about 7:40 PM, and 1888 had no summer time |
| Periods (declared by the Story) | dawn 5:00, morning 7:00, afternoon 12:00, evening 17:00, night 20:00, the small hours 23:00. The act starts in the **evening** and crosses into **night** at 8:00 PM |
| `weather` | `clear_warm`, "Warm, clear" |
| `anchorLocation` / opening | `baker_street`. The game opens here in Act 0 |
| Act-entry beat | The opening (§B). Narrated in `opening` mode (220 words) |
| How the act ends | The closing Rule (§B) ends the game with *The Wager Won* or *The Wager Lost* |
| Prover goals this act adds | the two endings; the Clues of §F |
| Narrator | **Watson**, first person, past tense, writing in his diary afterwards. Aliases: "Dr Watson", "John Watson". Voice lines are set in the score with the `narration-voice-check` skill |

## B. The case

There is no case, by design. Act 0 is the tutorial and the calm before. It teaches looking (`examine`), asking (`ask`, `talk`), taking (`take`) and using one thing on another (`use … on`).

- **One-line premise:** On the Bank Holiday evening, Holmes, bored at the window, bets Watson that he cannot read two strangers in the street the way Holmes reads them.
- **Opening event:** the holiday, the heat, both windows up, Holmes at the window after a failed afternoon at the bench, **a little opera glass in his hand**. His first line is kept exact: *"London has taken a holiday from wickedness, Watson. I find I resent it more than I can easily express."*
- **Demonstration** (first beat the player drives: talk to Holmes, or examine the window or the crowd): Holmes reads the licensed victualler and his daughter, and the man who walked in from Hampstead with Heath-road dust on his boots, separating what is observed from what is inferred. He reads the boots **through his opera glass and sets it down on the mantel**: the glass is shown in use before it matters, and only from now can it be taken. Asking Holmes about anything in the demonstration is answered, and does not move the act on.
- **The wager** (talk to Holmes after the demonstration; or, if the player does nothing, Holmes proposes it anyway after a short wait): Watson calls it a parlour trick, and Holmes proposes the bet and names the two figures, *the old fellow on the kerb by the cab rank* and *the clergyman outside the chemist's*. **He states the rule of the game in his own words: "When you have your man, give me your reading, and I shall hold you to it."** From this beat both figures can be seen and examined, and Holmes can be asked about each.
- **Investigation:** the player reads each figure, in either order.
  - **The commit rule.** Examining a figure only describes it: Watson's observations, never a conclusion. **Asking Holmes about the figure** is when Watson speaks his reading and Holmes judges it. Asking before examining is allowed and reads in the same beat (owner question 6). Talking to Holmes with no subject while a reading is outstanding gets a prompt, never a dead turn: *"Well? Which of them will you give me?"*
  - **The clergyman's examine beats end on what cannot be made out at this distance**: the print of the book in his hand, something at his hairline in the failing light. They state no conclusion. This, and the glass's own beat ("it brings the far kerb to arm's length"), are the only cues to use it; there is no hint system.
  - **The old man by the cab rank** (the soldier). Watson's reading is medical and always right: infantry bearing, Indian service, an old fracture of the left thigh healed short, probably a sergeant. Holmes concedes it, and adds the one thing Watson missed: he is watching for a grandchild. *A point to Watson.*
  - **The clergyman.** If the player has looked at him through the opera glass before asking, Watson finds the greasepaint at the hairline and the script in his hand himself: an actor between performances. *A point to Watson.* Otherwise Watson reads a poor country curate and is wrong; Holmes bids him look again, through the glass this time (true whether Watson is holding it or not), points to the greasepaint and the script, and names the error: *you saw a black coat and stopped looking.* *A point to Holmes.* Each reading turn's beats carry the whole sequence in order: Watson's reading first, then Holmes's answer.
  - **Looking through the glass** counts however it is done: using the glass on the figure (either way round), or examining the figure while holding the glass. Using the glass while it still lies on the mantel picks it up. So holding the glass is what makes looking look through it, which is what `take` teaches here.
  - **The glass works on everything in the street.** On the soldier it shows a regimental button sewn on as a coat button, but does not change his reading; on the crowd or the window it gives texture. It never answers "nothing happens", so a player who tries it early is encouraged. Uses with nothing in particular as the subject (Holmes, the violin, the glass alone) get an authored line too; the score lists every case.
- **Conclusion (the verdict):** on the second reading, whichever it is, Holmes settles the wager and **restates its terms: both, or nothing**, so a point each reads as the loss it is. Lines that only work last ("I begin to think I shall have to find another occupation"; "one to me") belong to the verdict, not to the reading. Watson wins only with both readings right, which means the glass was used on the clergyman before his reading.
- **Debrief (the closing):** the lamps are lit. Holmes asks Watson to describe anyone else of the some hundreds who have passed under the window, and Watson cannot. *"We see what asks to be seen. A man who asks nothing of anybody… might pass under this window every evening for a year and never once be looked at."* The game's thesis, stated in August as a complaint about tedium. It goes into the diary as a Clue, *What Asks to Be Seen*, the act's real payoff.
  - **The closing never takes over a question.** It does not fire on a turn where the player asks Holmes something specific, so follow-ups after the verdict (the grandchild, the actor, the greasepaint) are answered. It fires on the player's next action after the verdict that is not a specific question, or on a Tick if the player waits. Its first line has Holmes speaking before Watson has well begun whatever he was doing.
- **Coda, as the ending,** one turn after the closing, on the player's next action or a Tick: *won*: Holmes takes up the violin, looks at it, puts it down, and keeps his word until midnight; *lost*: Holmes lays the monograph on the ashes of the various tobaccos in Watson's lap, and he reads it, plates and all. Both end on the open windows: *the last evening of that summer on which it did not occur to me to close them.* When an Act 1 exists, the coda moves into the closing's beats and the endings go; note it then so the win/lose coda is not lost.
- **The choice:** none. The outcome is a **skill branch**, reached by omission (not using the glass). The template forbids omission for choices; this is accepted **for the tutorial only**, because the omission is the act's lesson and the glass is shown in use on the first beat. Not a precedent.
  - Won → flag set at the clergyman's reading when the glass was used first → read by the closing Rule (which ending) and the result Clue.
  - Lost → the other ending and Clue.

## C. Canonical facts block

| Fact | Canonical value |
|---|---|
| Date | Monday 6 August 1888, the August Bank Holiday |
| Clock at start | 7:30 PM; sunset about 7:40; the lamplighter passes during the wager |
| Holmes's afternoon | a chemical experiment that failed: it "went black and stank", a little after seven |
| How long they have known each other | **seven years** (met 1881) |
| The victualler | a licensed victualler with his daughter, kept out "an hour past the time her mother allowed" |
| The Hampstead man | walked in from Hampstead that morning to save the fare; the pale sandy dust of the Heath road white to the ankle (Hampstead Heath is sand and gravel, not chalk); about **four miles** |
| The crowd | "a hundred thousand people" in the streets (the opening); "some hundreds" passed under the window during the wager (the closing) |
| The old soldier | **about sixty**; coat too heavy for August; stick in the left hand; infantry; Indian service, not recent; old fracture of the left thigh, healed short; probably a sergeant; waiting for a grandchild; through the glass, a regimental button sewn on as a coat button (veterans of the 1880s wore their medals on occasions, not a ribbon on everyday dress) |
| Watson's reference | the base hospital at **Peshawar** (canon, *A Study in Scarlet*) |
| The "clergyman" | an actor in costume, black coat and white tie, between the matinée and the evening performance; learning new lines from a thin paper script in a coloured wrapper; a line of greasepaint at the hairline beside the ear |
| The theatre | unnamed: "a West End house", a melodrama with a clergyman in it; he is not wanted until the second act |
| The opera glass | Holmes's; French, bought for the opera and used for everything else; set on the mantel after the demonstration |
| Watson's wound | **never located** in this act (canon contradicts itself) |
| Win stake | Holmes will not touch the violin before **midnight**; he has been at it "on and off since Saturday" |
| Lose stake | Watson reads Holmes's monograph on the ashes of the various tobaccos, "**a hundred and forty** varieties", plates included |
| Historical boundary | No Whitechapel murder has happened. Martha Tabram is killed about 2:30 AM on Tuesday 7 August. Nobody in this act knows or hints at it |
| Clock at the close | idle Ticks can carry the evening past nine; beats after the wager say "the lamps were lit", never a time |
| Lexicon (words the narrator may use without a turn naming them) | London, Bank Holiday, Baker Street, West End, the Park (the opening's "towards the Park": one form everywhere), England, English, Indian, Afghan, French. **Not** ranks or canon names. Finalised in the score |

## D. Locations and Objects

One location, **`baker_street`**, named "221B Baker Street". Its beats: late daylight going to dusk, both windows up to the holiday noise, the bench just "gone black and stank", the mantel, the violin in its case, the monograph. The glass is named in Holmes's hand by the opening and on the mantel by the demonstration. Every Object the player needs is named before it matters. **No exits**; "leave" gets the narrator's in-character miss, and the old authored refusal is not kept. Object order matters: the "Try" chips list the first four unexamined Objects, so after the wager the glass and the two figures come first.

| Object id | `name` | Placement | Visible | `item` | Verbs it answers | Notes |
|---|---|---|---|---|---|---|
| `open_window` | the open window | baker_street | start | no | examine, use glass on | the demonstration's way in |
| `crowd` | the holiday crowd | baker_street | start | no | examine, use glass on | the closing's way in |
| `street_soldier` | the old man by the cab rank | baker_street | hidden until the wager | no | examine, use glass on | a figure, not a person: never spoken to. Not named "soldier": that is Watson's reading to make |
| `street_clergyman` | the clergyman | baker_street | hidden until the wager | no | examine, use glass on | as above |
| `opera_glass` | the opera glass | **in Holmes's hand**; on the mantel after the demonstration | from the demonstration | **yes** | examine, take, use … on | held, it makes examining a figure look through it (§B) |
| `holmes_violin` | the violin | baker_street | start | no | examine | a named stake |
| `tobacco_monograph` | the monograph | baker_street | start | no | examine, read | a named stake; may carry a short `document` (its title page) |

The chemistry bench is in the opening only, not an Object. Name collisions ("the glass", "the crowd", "the soldier" as both an Object and a topic) are swept in the score.

## E. Characters

```
id: holmes
name: Sherlock Holmes (no alias: Watson knows him)
schedule, act 0: at baker_street
disposition at start: neutral; warm once the wager is struck
beats (sent every turn): tall, lean, in shirtsleeves in the heat; at the window with his hands
  behind him; bored and contemptuous of the holiday's harmlessness until offered a diversion,
  then playful and competitive, and generous when beaten. Smokes a pipe. Speaks precisely.
```

**The cast is Holmes and Watson only.** Watson is the narrator and the player, not a person in the Story. Every street figure is an Object. Mrs Hudson does not appear.

## F. Facts and topics

All `visibleFromAct: 0`. "Given at" is the beat at which the Fact is granted by a Rule: to Holmes, which is when he can first be asked about it, or to the player. Only the "start" rows are `knownBy: ['holmes']`; the rest start with no one knowing them. Each Fact's `statement` is the knowledge alone; how Holmes says it on a reading turn (a concession, a correction) is its `voices.holmes`. Topic phrases are a starting list, swept for collisions in the score.

| Fact | Gist | Given at | Topics (as typed) |
|---|---|---|---|
| `holmes_holiday_dull` | London has taken a holiday from wickedness; nothing in the street needs explaining | start | the holiday, bank holiday, boredom, wickedness |
| `holmes_opera_glass` | a good French glass, bought for the opera; "the eye is the instrument, the glass merely brings the street nearer" | start | the opera glass, your glass |
| `holmes_heath_road_dust` | the Heath-road dust and the four miles; why Hampstead and not "somewhere north" | demonstration | heath road, hampstead, the dust, the man from hampstead |
| `holmes_victualler_deduction` | the victualler's coat and his daughter's step | demonstration | the victualler, the publican, his daughter |
| `holmes_observation_vs_inference` | the dust is observed; the walk is inferred | demonstration | observation, inference, the difference, your method |
| `holmes_the_wager` | the terms: two readings; the violin until midnight against the monograph | wager | the wager, the bet, the terms |
| `holmes_violin_stake` | at the violin since Saturday; he keeps his word | wager | the violin, midnight |
| `holmes_monograph` | the monograph on tobacco ashes, a hundred and forty varieties, with plates | wager | the monograph, tobacco ash |
| `holmes_soldier_grandchild` | he watches at a child's height: waiting for a grandchild. **Asking about it is the soldier's reading** | wager | the old man, the man by the cab rank, the soldier, the grandchild |
| `holmes_actor_reading` | greasepaint, the script, a West End melodrama, not wanted until the second act. **Asking about it is the clergyman's reading** | wager | the clergyman, the curate, the man outside the chemist's, the actor, greasepaint, the script, the theatre, the second act |
| `holmes_watsons_service` | he knew Watson for an Afghan man the day they met; never says where Watson was wounded | soldier read | afghanistan, peshawar, india, your service |
| `holmes_invisible_in_a_crowd` | "we see what asks to be seen" | closing, **to the player** (and to Holmes, for the turn before the ending) | being noticed, what asks to be seen |
| `wager_won` | Watson read both men and won the wager | verdict, to the player | (none asked) |
| `wager_lost` | Holmes took the wager: the black coat | verdict, to the player | (none asked) |

**Clues** (the diary), one line each, discovered when the player learns the Fact:
- *The Old Soldier* — Watson's reading, and the grandchild he missed (on the soldier's reading).
- *The Actor* — the greasepaint and the script (on the clergyman's reading, either branch; the summary is branch-neutral).
- *The Wager* — won or lost: `wager_won` or `wager_lost`, each with its own Clue, granted at the verdict.
- *What Asks to Be Seen* — the thesis, granted to the player at the closing; connected to *The Actor*.

**Every proper noun in this act's prose must be askable or in the lexicon:** Hampstead, Heath road, Peshawar, India, Afghanistan are topics above; London, Bank Holiday, Baker Street, West End, the Park are lexicon.

## H. Boundaries — what must not appear

- **Nothing sealed is a spoiler:** no murder, no Whitechapel, no Tabram, no "Ripper", no police in the scene. Holmes's crowd thesis names no one; its general "nor could any constable on any beat in London" stays only if the owner keeps it (question 7). The coda's darkness is Watson in hindsight, in the last line only.
- **The cast is closed:** Holmes and Watson. No Mrs Hudson, no Billy, no client, no telegram. The street figures do not speak and are not named. The lamplighter is scenery in a beat.
- **History:** high summer, no fog, no cold; gas lamps; Holmes smokes a pipe. No Moriarty, no Irene Adler, no Mary Morstan (*The Sign of Four* is September); the tobacco monograph already exists.
- **Flavour that reads as a clue:** none needed; there is no case. The figures' beats state what is there, so the narrator has no gap to fill.
- **Within reach but not covered:** leaving 221B (no exits: an in-character miss); talking to the street figures (they are Objects: a miss); the violin and the monograph are examinable but change nothing.

---

## Open questions for the owner (part of sign-off #1)

1. **The Wager is Act 0.** It replaces the Mrs Kemp Act 0 of the archive. Confirm.
2. **Act 0 ends the game, for now** (change 1). The player sees an ending, *The Wager Won* or *The Wager Lost*, and the investigation is over. When Act 1 is written, the closing advances to it instead. The alternative is to leave the act open after the coda, with nothing more to do; I advise against it. Related: should *The Wager Lost* invite the player to start a new investigation? It is the only "failure" in a 5–10 minute game.
3. **Verbatim text.** The engine narrates every turn from beats; only a beat written as a quotation is kept word for word. So Holmes's first line stays exact, but the opening paragraph and **the coda's last line** ("the last evening of that summer…") would be the narrator's, in substance. Keeping either verbatim needs a general engine mechanism (a verbatim Beat), which is separate work. Accept "in substance", or ask for the mechanism first.
4. **The skill branch by omission** (§B, the choice) is accepted for the tutorial only. This was the recommendation on 10 October; it was never confirmed.
5. **Holding the glass and examining a figure counts as looking through it** (§B). Recommended: yes. Without it, "look at the clergyman through the glass" can lose the wager for a player who did the right thing.
6. **Asking Holmes about a figure before examining it** still commits the reading (the 10 October rule). On the clergyman that loses the wager for a player who was only asking which man was meant. The alternative: Holmes deflects ("look at him first") until the figure has been examined or looked at through the glass. I recommend the alternative; it reverses a 10 October decision, so it is yours.
7. **The constable line** in Holmes's closing ("Nor could any constable on any beat in London"). It names no police in the scene and is general, but §H says "no police". Keep it (my recommendation) or cut it.
8. **New games start on Act 0** once it is built, instead of the stress fixture (`VITE_DEFAULT_STORY`). The stress fixture stays as a test fixture.

## Carried to the mechanical score

From the story-integrity review; no owner decision needed:
- **The closing's trigger:** an `action` Rule on every verb except `ask`, gated on the verdict; never a `flag` or `disclosed` trigger (either would fire on the verdict turn itself). `wait` is covered by a Tick Rule; every ambient Tick Rule carries `flagsNone` on the verdict so the closing's Tick cannot lose the draw. The glass and figure Rules also stop at the verdict.
- **The wager's trigger:** `talk` to Holmes after the demonstration (an `action` trigger cannot filter by topic, so it is not on `ask`), a Tick safety net, optionally examining the window or crowd again.
- **The verdict:** separate Rules on the second reading's `disclosed` trigger, each with `flagsAll` on the other figure's read flag, so either order lands.
- **The lose branch's glass line:** reads true whether Watson holds the glass or not; or two Rules split by Story order.
- **Every unauthored use of the glass** (no subject, on Holmes, the violin, the monograph) gets a row; a fallback `use` Rule is excluded from the specific ones by a flag or by Story order.
- **A reading typed as a conclusion** ("I conclude he is a curate") can select `deduce`; a Rule between the wager and the verdict turns it into the prompt.
- **Budgets:** the demonstration and the clergyman's lose turn are the longest; each turn's beats are cut to fit 160 words alongside what else the turn carries.
