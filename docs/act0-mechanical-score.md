# Act 0 — The Wager — mechanical score

**Sign-off #2: given by the owner in chat, 2026-11-11. Frozen.** **Phase 2** of `docs/act-authoring-process.md`, for the narrative spec `docs/act0-wager-spec.md` (sign-off #1: owner, 2026-11-11). Once signed off (#2) this score is frozen: any later deviation is made here first. It replaces the Kemp-era delta rows this file held before (git history).

Engine semantics this score relies on: `docs/adr/0005-pinned-rule-semantics.md`. Vocabulary: `GLOSSARY.md`. Canonical facts: spec §C (cited, not restated, below).

---

## 1. The Story's frame (`stories/whitechapel_1888/story.json`)

| Field | Value |
|---|---|
| `id` | `whitechapel_1888` (directory `stories/whitechapel_1888/`) |
| `title` | London Bleeds: The Whitechapel Diaries |
| `periods` | `dawn` 300 "dawn"; `morning` 420 "morning"; `afternoon` 720 "afternoon"; `evening` 1020 "evening"; `night` 1200 "night"; `small_hours` 1380 "the small hours" |
| `weathers` | `clear_warm` "Warm, clear" |
| `acts` | `{ id: 0, name: "The Wager", anchorLocation: "baker_street", startClockMinutes: 1170, dateLabel: "Monday, 6 August 1888", weather: "clear_warm" }` |
| `opening` | `{ act: 0, location: "baker_street", beats: [O1, O2, O3] }` (§3) |
| `narrator` | `name: "Watson"`, `aliases: ["Dr Watson", "John Watson", "John H. Watson"]`, `voice`: §2 |
| `lexicon` | London, Bank Holiday, Baker Street, West End, Park, England, English, Indian, Afghan, French |
| `endings` | `wager_won` "The Wager Won", `wager_lost` "The Wager Lost" (§7) |

## 2. Narrator voice lines

1. First person, past tense: Dr John Watson writing up the evening in his diary afterwards ("I observed", "Holmes remarked"). Never present tense.
2. Watson is a retired army surgeon: he notices bearing, gait, old injuries and complexion, and names them correctly.
3. Measured and dry, fond of Holmes and exasperated by him; emotionally present but controlled, never breathless or overwrought.
4. August 1888, high summer: a warm evening, late light failing to dusk, gas lamps lit at dusk. No fog, no cold.
5. No modern idiom and nothing later than 1888. No lists or inventories: objects and people are woven into the prose.
6. Holmes speaks precisely and briefly; he explains only when he chooses to, and never volunteers what he has not been asked.

## 3. Location, person, Objects

**`baker_street`** — name "221B Baker Street"; `exits: []`.
- L1 "Holmes's sitting room at 221B Baker Street on a warm August evening, the late daylight going to dusk."
- L2 "Both windows stand open to the street, and the noise of the bank-holiday crowd comes up from the pavement."
- L3 "The chemical bench, where the afternoon's experiment went black and acrid; the mantel; the violin in its case; Holmes's monograph on tobacco ash among the papers."

**`holmes`** — name "Sherlock Holmes", no alias, no introduction; schedule `{ "0": { default: { kind: "at", location: "baker_street" } } }`; disposition `neutral`.
- H1 "Sherlock Holmes: tall and lean, in his shirtsleeves for the heat, a pipe to hand; he speaks precisely and briefly."
- H2 "Bored by the holiday's harmlessness until offered a diversion; then playful and competitive, and generous when beaten."
- H3 "Once he has set Watson his wager, he will not hear a reading of a man Watson has not yet looked at: he tells him to look first."

**Objects** (in this order in `objects.json`: the "Try" chips show the first four unexamined, so after the wager the glass and the two figures lead):

| id | `name` | placement | `hidden` | `item` | beats | other |
|---|---|---|---|---|---|---|
| `opera_glass` | the opera glass | `{ person: holmes }`, moved to the room by R3 | no | yes | G1 "A small French opera glass in brass and black enamel, bought for the opera and used for everything else; it brings the far kerb to arm's length." | — |
| `street_soldier` | the old man by the cab rank | baker_street | **yes**, until R8 | no | S1 "About sixty, in a decent coat too heavy for August, standing at the kerb heels together and chin up, as though told to stand there and not yet told to stop." S2 "He leans on the stick in his left hand harder than a man of his years would wish, and when he steps aside for a perambulator the left leg swings stiff from the hip, the knee hardly bending." S3 "His neck, below the line of a cap he no longer wears, is burned a deep brick colour that no English summer gives a man." | observations only, no conclusion |
| `street_clergyman` | the clergyman | baker_street | **yes**, until R8 | no | C1 "A long black coat gone shiny at the seams, the cuffs turned, a white tie, and a good hat gone to the bad." C2 "He reads a small book with his lips moving, and now and then looks up over the crowd as a man does who is repeating something to himself." C3 "At this distance the book is only a small dark thing in his hand, and his face under the hat brim is lost in the failing light." | C3 is the cue to use the glass |
| `open_window` | the open window | baker_street | no | no | W1 "Both sashes are thrown up; below, Baker Street is thick with the holiday crowd, a cab rank along the far kerb and the chemist's window opposite." | — |
| `crowd` | the holiday crowd | baker_street | no | no | K1 "The crowd moves along the pavement in its hundreds, straw hats and children and a sailor among them, and nobody in it looks up." | — |
| `holmes_violin` | the violin | baker_street | no | no | V1 "Holmes's violin in its case on the chair; he has been at it, on and off, since Saturday." | — |
| `tobacco_monograph` | the monograph | baker_street | no | no | M1 "Holmes's monograph upon the ashes of the various tobaccos: a hundred and forty varieties, with coloured plates." | `document`: "Upon the Distinction between the Ashes of the Various Tobaccos. By Sherlock Holmes. With coloured plates." |

## 4. Facts

All `visibleFromAct: 0`, no `spoilerTerms` (nothing later is sealed: there is no later act). "Holmes at start" = `knownBy: ["holmes"]`; every other Fact starts with `knownBy: []` and is granted by the Rule named.

| id | `statement` | known / granted by | `topics` | `voices.holmes` |
|---|---|---|---|---|
| `holmes_holiday_dull` | London has taken a holiday from wickedness, and nothing in the street below requires the smallest explanation. | Holmes at start | the holiday, bank holiday, boredom | — |
| `holmes_opera_glass` | The opera glass is French, bought for the opera and used for everything else; the eye is the instrument, and the glass merely brings the street nearer. | Holmes at start | the opera glass, your glass | — |
| `holmes_heath_road_dust` | The pale sandy dust of the Heath road, white to the ankle, is what four miles of walking in from Hampstead presses into a boot; that is why Holmes named Hampstead and not merely somewhere north. | R3 (Holmes) | heath road, hampstead, the dust, the man from hampstead | — |
| `holmes_victualler_deduction` | The victualler's coat is good cloth kept rather than replaced, a tradesman's economy, and the girl beside him walks with a daughter's easy step: clothes and bearing together, nothing more. | R3 (Holmes) | the victualler, the publican, his daughter | — |
| `holmes_observation_vs_inference` | The dust on a boot is observed, and Watson could have named it himself; that the man walked from Hampstead is inferred, and wants practice before it wants confidence. | R3 (Holmes) | observation, inference, the difference, your method | — |
| `holmes_the_wager` | Two readings, both correct: Holmes will not touch the violin before midnight; one wrong, and Watson reads the monograph on tobacco ash, plates and all. | R8 (Holmes) | the wager, the bet, the terms | — |
| `holmes_violin_stake` | Holmes has been at the violin on and off since Saturday, and he keeps his word. | R8 (Holmes) | the violin, midnight | — |
| `holmes_monograph` | The monograph upon the ashes of the various tobaccos describes a hundred and forty varieties, with coloured plates. | R8 (Holmes) | the monograph, tobacco ash | — |
| `holmes_soldier_grandchild` | The old man by the cab rank is waiting for a grandchild: he watches the crowd at the height of a child's head, not a man's. | R10 / R20 (Holmes) | the old man, the man by the cab rank, the soldier, the grandchild | "Admirable, Watson; every word of it. I should only add that he is waiting for a grandchild: he watches the crowd at the height of a child's head, not a man's." |
| `holmes_actor_reading` | The clergyman is an actor in costume between the matinée and the evening performance at a West End house, in a melodrama with a clergyman in it, not wanted until the second act. | R11 / R16 (Holmes) | the clergyman, the curate, the man outside the chemist's, the actor, greasepaint, the script, the theatre, the second act | — (each reading Rule's beats say how Holmes puts it) |
| `holmes_watsons_service` | Holmes knew Watson for a man back from Afghanistan the day they met, seven years ago. | R24 (Holmes) | afghanistan, peshawar, india, your service | — |
| `holmes_invisible_in_a_crowd` | We see what asks to be seen: a man who asks nothing of anybody might pass under the window every evening for a year and never once be looked at. | R35 (player and Holmes) | being noticed, what asks to be seen | — |
| `wager_won_fact` | Watson won the wager. | R29 (player) | my win | — |
| `wager_lost_fact` | Watson lost the wager. | R30 (player) | my loss | — |

**Clues** (`clues.json`):

| id | `name` | `fact` | `summary` | `connections` |
|---|---|---|---|---|
| `clue_old_soldier` | The Old Soldier | `holmes_soldier_grandchild` | An old infantryman by the cab rank: Indian service, a thigh healed short. Holmes saw he was waiting for a grandchild. | — |
| `clue_actor` | The Actor | `holmes_actor_reading` | The clergyman outside the chemist's was an actor in costume: greasepaint at the hairline, a script for a book. | — |
| `clue_wager_won` | The Wager Won | `wager_won_fact` | Both men read rightly; Holmes will not touch the violin before midnight. | `clue_old_soldier`, `clue_actor` |
| `clue_wager_lost` | The Wager Lost | `wager_lost_fact` | A black coat, and I stopped looking. The monograph, plates and all. | `clue_old_soldier`, `clue_actor` |
| `clue_what_asks` | What Asks to Be Seen | `holmes_invisible_in_a_crowd` | We see what asks to be seen. A man who asks nothing of anybody might never once be looked at. | `clue_actor` |

## 5. Rules, one row per beat

**Story order matters** where two Rules can match one Firing (ADR-0005). The R-numbers are labels, not positions; `rules.json` holds them in exactly this order: **R7, R1, R2, R4, R5, R3, R6, R8, R9–R30, R31–R34, R36, R37, R35, R38–R40.** The four places where order is load-bearing are noted at their tables, and the golden asserts each. Each scene with several ways in is two layers: **trigger Rules** that only set a flag, and one **flag Rule** that plays the scene, so the scene's content exists once. All `once: true` unless the row says otherwise.

Column key: **T** trigger · **W** `when` · **E** Effects in order · **N** narration mode and the beat words this Rule adds (budget: `full` 160, `opening` 220) · **O** Objects and people on stage, and what the sidebar shows · **F** Facts newly askable · **S** subjects made askable (or "deflects, intended") · **I** identity anchors · **Q** quantities · **D** diary.

### Opening (no Rule: `story.opening`)
- O1 "The August Bank Holiday, Monday the sixth: a close and airless day that had emptied London of everyone who could afford to leave it. By half past seven both windows of our sitting room stood open to Baker Street, and the holiday came up off the pavement in waves: barrel-organs, a brass band somewhere towards the Park, and under it the long murmur of a hundred thousand people with nowhere they were obliged to be."
- O2 "Holmes had spent the afternoon in a chemical silence that ended a little after seven, when something on his bench went black and stank. Since then he had stood at the window with his hands behind him and a little opera glass in one of them, looking down on the crowd as a naturalist looks into a pond in which nothing of interest has bred."
- O3 (a quotation, kept verbatim) "\"London has taken a holiday from wickedness, Watson,\" he said, without turning. \"I find I resent it more than I can easily express.\""
- **N** `opening`, about 160 words of beats in a 220 budget. **O** Holmes (sidebar: Sherlock Holmes); window, crowd, violin, monograph visible; the glass is in Holmes's hand, not in the Candidate Set. **F** `holmes_holiday_dull`, `holmes_opera_glass`. **S** Bank Holiday, London, Baker Street, the Park (lexicon); the holiday (topic). **I** H1–H3. **Q** half past seven, a little after seven, a hundred thousand (all in the beats; §C). **D** Holmes met.

### The demonstration
| # | Rule | T | W | E |
|---|---|---|---|---|
| R1 | `wager_on_talk` | action `talk` person `holmes` | flagsAll `holmes_demonstrated`, flagsNone `wager_struck` | setFlag `wager_struck` |
| R2 | `wager_on_street` | action `examine` target `open_window`, `crowd` | flagsAll `holmes_demonstrated`, flagsNone `wager_struck` | setFlag `wager_struck` |
| R4 | `demonstration_on_talk` | action `talk`, `ask` person `holmes` | flagsNone `holmes_demonstrated` | setFlag `holmes_demonstrated` |
| R5 | `demonstration_on_street` | action `examine` target `open_window`, `crowd` | flagsNone `holmes_demonstrated` | setFlag `holmes_demonstrated` |
| R3 | `demonstration` | flag `holmes_demonstrated` | — | moveObject `opera_glass` → location `baker_street`; cue `glass_down`; grantFact holmes `holmes_heath_road_dust`, `holmes_victualler_deduction`, `holmes_observation_vs_inference`; playBeat [D1, D2] |

R1 and R2 come **before** R4 and R5 in `rules.json`: R4/R5 set `holmes_demonstrated` during the very Firing R1/R2 would see, so listed later R1/R2 would start the wager on the same turn. R3 is listed after them (it is a flag Rule; its order does not matter). The golden asserts the negative.

- D1 "Holmes read the street aloud for me: the licensed victualler by the pillar box had kept his daughter out an hour past the time her mother allowed; the man under the lamp had walked in from Hampstead that morning to save the fare, and had spent it since on something he already regretted."
- D2 "When I said he could not know the man had walked, he raised the opera glass once more, then set it down on the mantel: the man's boots were white to the ankle with the pale dust of the Heath road. \"That is a fact. That he walked is an inference, though I should be very much surprised to be wrong. You will note the difference, Watson, because nobody else in London does.\""
- **N** `full`; about 105 words (D1 trimmed in phase 4: the window way in measured 160), plus W1 or K1 (about 30) when the way in was examining the window or the crowd, plus an answer when it was an `ask`. **O** the glass now on the mantel: in the Candidate Set and the sidebar. **F** heath road, victualler, observation. **S** Hampstead, Heath road (topics); the victualler, the daughter (topic). **I** — **Q** an hour, four miles (in the Fact). **D** —

### The wager
| # | Rule | T | W | E |
|---|---|---|---|---|
| R6 | `wager_on_idle` | `tick`, weight 10 | flagsAll `holmes_demonstrated`, flagsNone `wager_struck` | setFlag `wager_struck` |
| R7 | `wager_prompt` (`once: false`) | action `talk` person `holmes` | flagsAll `wager_struck`, flagsNone `verdict_given` | playBeat [P1] |
| R8 | `wager` | flag `wager_struck` | — | revealObject `street_soldier`, `street_clergyman`; grantFact holmes `holmes_the_wager`, `holmes_violin_stake`, `holmes_monograph`; setDisposition holmes `warm`; playBeat [W1, W2, W3] |

R7 is listed **before** R1: the talk that strikes the wager must not also be prompted.

- W1 "I called it a very good parlour trick, which any man might do who had nothing else to do with his evening; and Holmes turned from the window with the look of a man who has been offered a diversion."
- W2 (quotation) "\"Any man. Very well: a wager. Read me two people in that street, who they are and what they are about. Read both correctly and I shall not touch the violin before midnight; fail, and you shall read my monograph upon the ashes of the various tobaccos, all hundred and forty varieties, plates included.\""
- W3 (quotation) "\"The old fellow on the kerb by the cab rank. And the clergyman outside the chemist's. When you have your man, give me your reading, and I shall hold you to it.\""
- P1 "\"Well?\" said Holmes, without turning from the window. \"Which of them will you give me? Look at your man first, Watson, and then tell me.\""
- **N** `full`; about 125 words (R8), trimmed in phase 4 (W1, and A1 to about 17) after the golden measured 185 on the turn the lamplighter also passes, to about 140; the Tick way in (R6) has the same budget. P1 about 25. **O** the two figures appear: the sidebar lists "the old man by the cab rank" and "the clergyman". **F** the wager, the violin, the monograph. **S** the cab rank, the chemist's: covered by the figures' topics once Holmes knows them (R10/R11), deflects before, intended (H3). **I** the figures are Objects, described by their beats. **Q** midnight, a hundred and forty (beat, Fact). **D** —

### Looking at the figures
| # | Rule | T | W | E |
|---|---|---|---|---|
| R9 | `reading_as_deduction` (`once: false`) | action `deduce` | flagsAll `wager_struck`, flagsNone `verdict_given` | playBeat [P2] |
| R10 | `soldier_looked_at` | action `examine` target `street_soldier` | flagsNone `verdict_given` | grantFact holmes `holmes_soldier_grandchild` |
| R11 | `clergyman_looked_at` | action `examine` target `street_clergyman` | flagsNone `verdict_given` | grantFact holmes `holmes_actor_reading` |
| R12 | `clergyman_through_glass` | action `use`, `combine` target `opera_glass` secondary `street_clergyman` | flagsNone `clergyman_read`, `verdict_given` | setFlag `greasepaint_seen` |
| R13 | `clergyman_through_glass_reversed` | action `use`, `combine` target `street_clergyman` secondary `opera_glass` | as R12 | setFlag `greasepaint_seen` |
| R14 | `clergyman_examined_with_glass` | action `examine` target `street_clergyman` | hasItems `opera_glass`; flagsNone `clergyman_read`, `verdict_given` | setFlag `greasepaint_seen` |
| R16 | `greasepaint` | flag `greasepaint_seen` | — | giveItem `opera_glass`; grantFact holmes `holmes_actor_reading`; playBeat [GC] |
| R17 | `soldier_through_glass` | action `use`, `combine` target `opera_glass` secondary `street_soldier` | flagsNone `verdict_given` | setFlag `regimental_button_seen` |
| R18 | `soldier_through_glass_reversed` | action `use`, `combine` target `street_soldier` secondary `opera_glass` | flagsNone `verdict_given` | setFlag `regimental_button_seen` |
| R19 | `soldier_examined_with_glass` | action `examine` target `street_soldier` | hasItems `opera_glass`; flagsNone `verdict_given` | setFlag `regimental_button_seen` |
| R20 | `regimental_button` | flag `regimental_button_seen` | — | giveItem `opera_glass`; grantFact holmes `holmes_soldier_grandchild`; playBeat [GS] |
| R21 | `glass_on_street` (`once: false`) | action `use`, `combine` target `opera_glass` secondary `open_window`, `crowd` | — | giveItem `opera_glass`; playBeat [GW] |
| R22 | `glass_on_street_reversed` (`once: false`) | action `use`, `combine` target `open_window`, `crowd` secondary `opera_glass` | — | giveItem `opera_glass`; playBeat [GW] |
| R23 | `glass_on_room` (`once: false`) | action `use`, `combine` target `opera_glass` secondary `holmes_violin`, `tobacco_monograph` | — | giveItem `opera_glass`; playBeat [GR] |

- P2 "Holmes waved the conclusion away. \"One man at a time, Watson, and only once you have looked at him. Then give me your reading.\""
- GC "Through the glass the clergyman came up close: along his hairline beside the ear, where a careless towel had missed it, a faint brownish line upon the skin, too even to be dirt; and the book was no prayer-book but a thin paper volume in a coloured wrapper, its lines set out in short, uneven lengths that no psalm was ever printed in."
- GS "Through the glass, the old man's coat: among its plain buttons, one brass regimental button, worn smooth, of a pattern I knew. It told me nothing my eye had not told me already."
- GW "Through the glass the street leapt close: a child's paper windmill, a sweating cab horse, a man in a straw hat laughing at nothing; then I lowered it, and the street was far off again."
- GR "I turned the glass on the room, which at four paces is absurd, and lowered it again."
- **N** examine turns are `compact` (90): the figure's beats (about 70) and no Fact, unless R14/R19 add a glass beat, which makes the turn `full`. GC about 70, GS about 35. **O** the glass moves into the inventory on any use (`giveItem`). **F** the reading Facts become askable for Holmes only now (deflect before: H3, owner decision 6). **S** "regimental" (common word), the actor's book: deflects until the reading, intended. **I** — **Q** four paces (beat). **D** —

Using the glass with nothing in particular as its subject ("use the glass", or on Holmes himself) has no Rule: a `Used` with no beat, narrated as flavour. A Rule cannot name a person as `secondary` (the validator requires an Object), and an `action` trigger with no `secondary` would also match every row above. Accepted.

### The readings
| # | Rule | T | W | E |
|---|---|---|---|---|
| R24 | `soldier_reading` | disclosed fact `holmes_soldier_grandchild` from `holmes` to `player` | flagsNone `verdict_given` | setFlag `soldier_read`; grantFact holmes `holmes_watsons_service`; playBeat [SR] |
| R25 | `clergyman_reading_right` | disclosed fact `holmes_actor_reading` from `holmes` to `player` | flagsAll `greasepaint_seen` | setFlag `clergyman_read`; setFlag `clergyman_read_right`; playBeat [CW1, CW2] |
| R26 | `clergyman_reading_wrong` | as R25 | flagsNone `greasepaint_seen` | setFlag `clergyman_read`; playBeat [CL1, CL2, CL3] |

- SR "I gave him my reading of the old man: an infantryman by the way he stood, for cavalrymen stand otherwise; Indian service, and not lately, for the colour had gone into the skin; an old fracture of the left thigh, set in a hurry by a regimental surgeon and healed short, a walk I had watched men learn at the base hospital at Peshawar; and probably a sergeant. Holmes heard me out, and then conceded it."
- CW1 "I gave him my reading of the clergyman: no curate at all, but a man who would like to be thought one. That was greasepaint at his hairline, and he was learning a part, not a lesson: an actor between performances who had not changed out of his costume."
- CW2 "Holmes looked at me for so long that I began to fear some fresh error, and then said I had it exactly: a West End house, a melodrama with a clergyman in it, and he was not wanted until the second act."
- CL1 "I gave him my reading of the clergyman: a curate from a poor country parish, by his coat, up for the holiday and getting tomorrow's lesson by heart."
- CL2 "\"Ah,\" said Holmes, very gently, and bade me look again, through the glass: a brownish line of greasepaint at the hairline, too even to be dirt, and a thin paper script in a coloured wrapper. I felt foolish."
- CL3 "\"You saw a black coat and a white tie, and stopped looking, because you had your answer. It is the commonest error in the world, and the most expensive.\""
- **N** `full`. SR about 85 + the Fact's voice (about 40). CW about 75 + the statement. CL about 105 + the statement (about 35), the act's heaviest turn; on the second reading the verdict (about 20) rides with it, about 160. **Cut during phase 4, as this row allowed:** the golden measured 215 words; CL1–CL3, VL, the actor Fact's statement and the outcome Facts' statements (which only repeat the verdict) were shortened, to about 145 (CL3's last sentence went: the statement carries it). Beats state the order: Watson's reading first, then Holmes. **O** — **F** `holmes_watsons_service` (after the soldier). **S** India, Peshawar, Afghanistan (topics), West End (lexicon). **I** — **Q** none beyond §C. **D** `clue_old_soldier` or `clue_actor` (the player learns the Fact).

### The verdict
| # | Rule | T | W | E |
|---|---|---|---|---|
| R27 | `verdict_after_clergyman` | flag `clergyman_read` | flagsAll `soldier_read` | setFlag `verdict_given` |
| R28 | `verdict_after_soldier` | flag `soldier_read` | flagsAll `clergyman_read` | setFlag `verdict_given` |
| R29 | `wager_won` | flag `verdict_given` | flagsAll `clergyman_read_right` | grantFact player `wager_won_fact`; playBeat [VW] |
| R30 | `wager_lost` | flag `verdict_given` | flagsNone `clergyman_read_right` | grantFact player `wager_lost_fact`; playBeat [VL] |

- VW "\"Both, Watson. Both, and exactly.\" Holmes sat down rather heavily in his chair. \"I begin to think I shall have to find another occupation.\" The wager was mine."
- VL "Both, or nothing: those had been the terms, and the wager was Holmes's."
- **N** rides on the second reading's turn (above). **D** `clue_wager_won` or `clue_wager_lost`.

### The closing and the ending
| # | Rule | T | W | E |
|---|---|---|---|---|
| R31 | `ending_won` | action, every verb **including** `ask` | factsKnown `holmes_invisible_in_a_crowd`; flagsAll `clergyman_read_right` | endGame `wager_won` |
| R32 | `ending_lost` | as R31 | factsKnown `holmes_invisible_in_a_crowd`; flagsNone `clergyman_read_right` | endGame `wager_lost` |
| R33 | `ending_won_on_idle` | `tick`, weight 10 | as R31 | endGame `wager_won` |
| R34 | `ending_lost_on_idle` | `tick`, weight 10 | as R32 | endGame `wager_lost` |
| R36 | `closing_on_action` | action `look`, `examine`, `read`, `take`, `drop`, `open`, `close`, `use`, `combine`, `show`, `give`, `talk`, `deduce`, `inventory` (every verb but `ask`, `wait`, `move`) | flagsAll `verdict_given`, flagsNone `closing_begun` | setFlag `closing_begun` |
| R37 | `closing_on_idle` | `tick`, weight 10 | flagsAll `verdict_given`, flagsNone `closing_begun` | setFlag `closing_begun` |
| R35 | `closing` | flag `closing_begun` | — | grantFact player `holmes_invisible_in_a_crowd`; grantFact holmes `holmes_invisible_in_a_crowd`; playBeat [C1, C2, C3] |

The ending Rules wait on `factsKnown`, which only the closing's flag Rule grants, one cascade depth after the closing's trigger: so the ending can never fire on the closing's own turn, whatever the Story order. `wait` raises no action Firing (it is a Tick), so the idle Rules cover it; `move` is always rejected here (no exits) and raises none either.

- C1 "The lamps were lit, and the crowd below had thickened. Holmes, back at the window, spoke before I had well begun whatever I was about."
- C2 "\"You did very well, Watson. But we chose those two because they were remarkable. Some hundreds have passed under this window since you began: describe one I did not point out.\" I tried, and could not: straw hats, children, a sailor, and not one face."
- C3 "\"Nor could I. Nor could any constable on any beat in London. We see what asks to be seen. A man who asks nothing of anybody might pass under this window every evening for a year and never once be looked at.\" He let the curtain fall."
- **N** `full`; about 120 words plus the thesis Fact's statement (about 27), trimmed in phase 4 after the golden measured 167. Its turn carries whatever the player did as well; C1 subordinates it. **F** `holmes_invisible_in_a_crowd` (askable for the one turn before the ending). **S** "constable" (common word, kept: owner decision 7). **Q** some hundreds (beat), a year (common). **D** `clue_what_asks`.
- **The ending** (`GameEnded`): the ending's beats are the coda (§7); `full`, about 90 words plus the player's action.

### Ambience
| # | Rule | T | W | E |
|---|---|---|---|---|
| R38 | `lamplighter` | clock `atMinutes` 1185, act [0] | — | cue `lamplighter`; playBeat [A1] |
| R39 | `barrel_organ` (`once: false`) | `tick`, weight 1 | flagsAll `wager_struck`, flagsNone `verdict_given` | playBeat [A2] |
| R40 | `monograph_pages` (`once: false`) | action `read` target `tobacco_monograph` | — | cue `pages_riffle` |

- A1 "The lamplighter went down the far pavement, and one by one the gas came up in the lamps."
- A2 "Below the window a barrel-organ struck up a tune, lost it, and found it again."
- R38 fires on whatever turn first passes 7:45 PM (the critical path reaches the verdict no earlier than about 7:52), so the closing's "the lamps were lit" always follows it. R39 is the only ambient Tick and is off once the verdict is given, so the closing's and the ending's Ticks never lose a draw to it.

## 6. Schedule, act fields, the gate

- **Schedule:** Holmes, act 0, every period: `at baker_street`. No one else exists.
- **Act fields:** spec §A. The clock runs from 7:30 PM; the critical path (about ten turns) ends near 8:05; idle Ticks can carry it later, which no beat contradicts ("the lamps were lit", never a time).
- **The gate:** none in the usual sense: the act ends the game. `endGame` is reached by R31–R34 only, after the closing.
- **The choice:** none; the skill branch (spec §B, owner decision 4). `clergyman_read_right` is set by R25 and read by R29, R30, R31–R34.

## 7. Endings (`story.json` → `endings`)

- `wager_won` "The Wager Won": E1 "Holmes took up the violin from its case, looked at it, and put it down again; and he kept his word until midnight, which was more than I had dared to expect." E3.
- `wager_lost` "The Wager Lost": E2 "Holmes took down the monograph upon the ashes of the various tobaccos and laid it in my lap with great tenderness, and I read it, plates and all, until the street was quiet." E3.
- E3 (both) "The windows stood open until past midnight, and the noise of the holiday went on below them, warm and foolish and entirely harmless, and neither of us thought to close them. It was, I believe, the last evening of that summer on which it did not occur to me to do so."

## 8. Outside the Story

- **New games start on Act 0** (owner decision 8): `DEFAULT_STORY` in `hooks/useInvestigation.ts` becomes `whitechapel_1888`. The stress fixture stays a fixture.
- **An ending invites a new investigation** (owner decision 2): when `view.ended` is set, where the command line was, one line in the game's voice ("The diary is closed on this evening.") and a button to begin a new investigation, for either ending. Client only; `engineering-reviewer` after.
- **Sounds:** `glass_down`, `lamplighter`, `pages_riffle` exist (`services/audioManifest.ts`); the holiday-street ambience is already keyed to Act 0 at `baker_street`.

## 9. Verb coverage (what a player types → the Selection → the Rule)

| Player's words | Expected Selection | Rule | If the model picks otherwise |
|---|---|---|---|
| "talk to Holmes", "hello", "what are you looking at?" | `talk holmes`, or `ask holmes` with no topic | R4, then R1 | both verbs covered (R4 lists `talk` and `ask`) |
| "look out of the window", "watch the crowd" | `examine open_window` / `crowd` | R5, then R2 | `flavour` ("look at the street"): no Rule; the next talk or examine starts it |
| "take the glass", "pick up the opera glass" | `take opera_glass` | — (no Rule; makes R14/R19 possible) | — |
| "look at the clergyman through the glass", "use the glass on him", "train the glass on the clergyman" | `use opera_glass street_clergyman` or the reverse, or `combine` | R12, R13 | `examine street_clergyman`: R14 if the glass is held; if it is not held, the look is plain (the player learns from C3 and the glass's beat) |
| "look at the old man", "examine the soldier" | `examine street_soldier` | R10 (R19 if holding the glass) | — |
| "tell Holmes about the old man", "the soldier is an infantryman" | `ask holmes` topic `holmes_soldier_grandchild` | R24 | `deduce`: R9 prompts; before the look: deflects (H3) |
| "tell Holmes the clergyman is a curate", "he's an actor" | `ask holmes` topic `holmes_actor_reading` | R25 / R26 | as above |
| "wait", "z" | `wait` (a Tick) | R6, R33/34, R37, R39 | — |
| anything after the verdict but a question | its verb | R36, then R31/R32 | a rejected or flavour turn does not close: the next one, or a Tick, does |

## 10. Pre-checks

- **Schema fit.** Every row uses existing Trigger, Effect and Condition kinds. No new mechanism is needed. The one gap (a Rule for a glass used on a person) is accepted above.
- **Name collisions.** Candidate Set after the wager: the opera glass, the old man by the cab rank, the clergyman, the open window, the holiday crowd, the violin, the monograph; Sherlock Holmes. No two names share a head noun a player would type alone ("glass" names only the opera glass; "window" only the window; "man" is the old man; the clergyman is "the clergyman"). "The soldier" is not a name: the model must map it to the old man, which it can, being the only figure who fits; the topic "the soldier" also covers asking.
- **Topic collisions.** No exact phrase is shared (`qa:story` will check). Near-synonyms among Holmes's Facts checked by hand: "the old man" / "the man from hampstead" (distinct heads), "the clergyman" / "the curate" (one Fact), "the violin" / "midnight" (one Fact), "the opera glass" (one Fact), "the wager" / "the terms" (one Fact). "my win" and "my loss" are only `tell` topics, offered to Holmes after the verdict.
- **Flags.** Each set and read: `holmes_demonstrated` (R4, R5 → R3, R1, R2, R6); `wager_struck` (R1, R2, R6 → R8, R7, R9, R39); `greasepaint_seen` (R12–R14 → R16, R25, R26); `regimental_button_seen` (R17–R19 → R20); `soldier_read` (R24 → R28, R27); `clergyman_read` (R25, R26 → R27, R28, R12–R14); `clergyman_read_right` (R25 → R29–R34); `verdict_given` (R27, R28 → R29, R30, R36, R37 and many `flagsNone`); `closing_begun` (R36, R37 → R35). Named for the world, not the beat.
- **Presence.** Holmes is scheduled at `baker_street` for act 0 in every period; no Rule moves him.
- **Chronology.** Spec §C is the canonical block; every beat cites it (no new date, time or figure here).
- **Spoilers.** No later act exists, so no Fact needs `spoilerTerms`; every beat above was checked against spec §H (no murder, Whitechapel, Tabram, Ripper; police only in Holmes's general "constable", owner decision 7).

## 11. The golden scenario and the prover goals (phase 3, after sign-off #2)

`scripts/qa-whitechapel.ts`, added to `qa:all`, driving `startInvestigation` / `resolveTurn` / `tick` with explicit Selections. Scenarios:
1. **Lost, soldier first:** the demonstration by talk; the wager by talk, not on the same turn (negative); deflect on asking about the soldier before looking (negative: no `FactDisclosed`); examine, ask; examine the clergyman, ask: wrong reading, verdict lost; the closing on an `examine`, not on a follow-up `ask` (negative); the ending on the next action; diary clues; replay exact.
2. **Won, clergyman first through the glass**, both `use` orders and `examine` while holding; the glass moves to the inventory; verdict won after the soldier.
3. **Idle:** the wager, the closing and the ending each reached by Ticks; the barrel-organ never drawn after the verdict.
4. **Narration budgets:** for each Rule's turn, the narration context's beats counted against the mode's budget.

**Prover goals** (must be UNREACHABLE before the data exists, REACHABLE and uncapped after): endings `wager_won`, `wager_lost`; Clues `clue_old_soldier`, `clue_actor`, `clue_wager_won`, `clue_wager_lost`, `clue_what_asks`. No act goals (one act). No EARLY lines expected.
