# Act 0 — The Wager — mechanical score

**Phase 2 of `act-authoring`.** Scored against the signed-off narrative spec,
`docs/act0-wager-spec.md` (sign-off #1, 2026-11-28, all seven decisions as recommended). The engine adds
`grantFact { from }` for decision 7 (ADR-0005 §9).

- **What it does:** pins every Rule, Object, Fact, phrase and number Act 0 needs, in the shape the
  JSON will take.
- **What it is not:** the JSON. Nothing in `stories/` is written until sign-off #2.
- **Spec amendments:** where the score could not follow the spec to the letter, it says so in §8.
  Those amendments are part of this sign-off.

---

## 0. Conventions used throughout

1. **Beats stage; Holmes's Facts speak.** A scene's `playBeat` lines carry action and staging:
   - what Holmes does;
   - what Watson sees;
   - the line or two protected as quotations.

   What Holmes *says* arrives as a Fact granted to the player `from: holmes`. The narrator renders
   that "in their own words; where a voice is given, that is how they put it". This keeps each scene
   inside its word budget, never says a thing twice, and puts every speech in Holmes's Ledger and the
   diary's Persons tab. Every Rule with such a grant names `personsPresent [holmes]`: the validator
   warns otherwise, and an absent teller's grant is recorded unattributed (ADR-0005 §9). Holmes is
   always present in Act 0, so the condition costs nothing.
2. **Quotations are carried as written.** A Beat that is a quotation (in double quotes) is reproduced
   verbatim by the narrator. The protected lines are marked **[Q]**.
3. **File order is load-bearing.** Rules fire in file order and see each other's flags at once. A
   later scene's trigger Rules are listed **before** the scene that unlocks them, so one action can
   never play two scenes. Every Rule in §5 is in file order, and the golden asserts the
   negatives (§7).
4. **Trigger Rules and scene Rules.** Where a scene can be set off two ways (an action or an idle
   Tick), two small trigger Rules set one world-state flag. One scene Rule on that flag carries the
   Effects, so they are written once.
5. **Verbs that never start a scene:** `look` and `inventory` (meta). `ask` never starts the closing
   or the coda (spec: never take over a question). `deduce` never starts the closing or the coda
   (it is a commit).
6. **Budgets:** every scene below lands in `full` (160 words), because a Beat is queued. The opening
   lands in `opening` (220). Word counts given are for the Beats plus the Facts' statements or
   voices, which is what the narrator must carry.

---

## 1. Story scaffold — `stories/whitechapel_1888/story.json`

| Field | Value |
|---|---|
| `id` / `title` | `whitechapel_1888` / "The Whitechapel Diaries" |
| `periods` | `late_night` 0, `dawn` 300, `morning` 420, `afternoon` 720, `evening` 1020, `night` 1200 |
| `weathers` | `clear_warm` "Warm, Clear", `ambience: still_air` |
| `acts[0]` | `id 0`, `name "The Wager"`, `anchorLocation baker_street`, `startClockMinutes 1170`, `dateLabel "Monday 6 August 1888 (Bank Holiday)"`, `weather clear_warm`, `ambience { baker_street: holiday_street }` |
| `opening` | `act 0`, `location baker_street`, beats §1.1 |
| `narrator` | `name "Watson"`, `aliases ["John H. Watson", "Dr Watson"]`. Voice lines from `narration-voice-check` (first person, past tense, a doctor's eye, writing in hindsight, period diction) are written at implementation; they don't change any Rule |
| `quietWeight` | absent. An idle Tick fires whichever single tick Rule is eligible; there is never more than one (§5) |
| `lexicon` | `London`, `English`, `French` |
| `endings` | `prologue_end`, name **"The Windows Left Open"**, beats `["\"It was, I believe, the last evening of that summer on which it did not occur to me to close them.\""]` **[Q]** |

### 1.1 Opening beats (`opening`, 220 words)

1. **[Q]** "It had been a close and airless bank holiday, the sort of day that empties London of
   everyone who can afford to be emptied and leaves the rest of us to sit in our shirtsleeves and
   resent them."
2. Both windows of the sitting room stand open to Baker Street. The holiday comes up off the
   pavement: barrel-organs, a brass band somewhere off, and under it the murmur of a hundred
   thousand people with nothing to do.
3. Holmes's afternoon at the chemistry bench ended a little after seven, when something on it went
   black and stank.
4. Holmes stands at the open window with his hands behind him and **his little opera glass in one
   of them**, looking down into the crowd. **He has not yet said a word.**

- **Quantities:** "a hundred thousand", "seven". Both are in the beat, so the gate finds them in the
  turn's context.
- **Proper nouns:** London (lexicon), Baker Street (location), Holmes (person).

---

## 2. Location and Objects

### 2.1 `baker_street` — name "221B Baker Street"

- **beats:**
  - Late daylight going to dusk; both windows open to the street; the heat of the room.
  - The chemistry bench under the far window, blackened and stinking from the afternoon.
  - The mantelpiece, the violin case on the chair beside it, a monograph on the shelf.
- **exits:** none.
- **ambience:** `baker_street` (overridden to `holiday_street` in act 0).

### 2.2 Objects

The sidebar lists Objects by `name`. Aliases don't reach the selection model, so each Object's
beats carry the words a player would use.

| id | `name` | aliases | placement | hidden | item | beats (gist) |
|---|---|---|---|---|---|---|
| `open_window` | the open window | window, the street | `baker_street` | no | no | Baker Street below, packed with the holiday; the cab rank, the pillar box, the chemist's across the way |
| `crowd` | the holiday crowd | crowd, the people | `baker_street` | no | no | straw hats, children, a sailor; a licensed victualler by the pillar box with his daughter; a man under the lamp, his boots white to the ankle with dust |
| `street_soldier` | the old fellow by the cab rank | old man, soldier | `baker_street` | **yes**, until the wager | no | about sixty; heels together, chin up; a coat too heavy for August; a stick in his left hand he leans on; the left leg swung stiff from the hip; neck burned brick-colour; **under the window, close** |
| `street_clergyman` | the clergyman across the street | curate, parson | `baker_street` | **yes**, until the wager | no | **across the street outside the chemist's**; long black coat, white tie; coat shiny at the seams, cuffs turned, a good hat gone to the bad; a small book open in his hand, lips moving, looks up over the crowd as a man repeating something to himself; **face half-lost under the hat brim in the failing light**. *By eye, nothing in these beats points past the curate* (spec decision 6) |
| `opera_glass` | Holmes's opera glass | opera glass, glass | **`person: holmes`** | no | **yes** | a small French opera glass, good lenses, brass worn bright with use |
| `holmes_violin` | the violin | violin case, fiddle | `baker_street` | no | no | in its open case on the chair; Holmes has been at it, on and off, since Saturday |
| `tobacco_monograph` | the monograph | tobacco monograph | `baker_street` | no | no | on the shelf: Holmes's monograph upon the ashes of the various tobaccos, a hundred and forty varieties, with plates |
| `chemistry_bench` | the chemistry bench | bench, experiment | `baker_street` | no | no | the afternoon's failure: a blackened retort, a smell that has not left the room |
| `mantel` | the mantelpiece | mantel | `baker_street` | no | no | clock, pipe-rack, the Persian slipper, and from the demonstration on, the opera glass (the glass's own placement shows it in the sidebar) |

- **The glass's placement is the only moving part.** It starts with `person: holmes`, which keeps it
  out of the Candidate Set and the sidebar. The demonstration moves it to `baker_street` (rule
  `demonstration`). A glass Rule's `giveItem` puts it in Watson's hand. The lose verdict's
  `moveObject` puts it back.
- **"The Persian slipper"** is a canon object at the mantel. It is a proper adjective, so it must be
  in context wherever the narrator uses it, and the mantel's beats carry it. If that adds risk for no
  return, cut it at implementation; it is scenery.

---

## 3. Holmes — `persons.json`

| Field | Value |
|---|---|
| `id` / `name` | `holmes` / "Sherlock Holmes". No alias, no introduction |
| `schedule` | `{"0": {"default": {"kind": "at", "location": "baker_street"}}}` |
| `disposition` | `neutral`; `setDisposition warm` in the wager scene |
| `beats` | (1) A tall, lean man in shirtsleeves in the heat, at the open window, a pipe within reach. (2) Bored and contemptuous of the holiday's harmlessness; once challenged, playful, competitive and generous when beaten. (3) Precise; separates what he observes from what he infers. (4) Calls Watson "Watson" |

---

## 4. Facts and Clues — `facts.json`, `clues.json`

- Everything is `visibleFromAct: 0`.
- `voices.holmes` is how he says it. It is quoted in the diary's Persons tab and given to the
  narrator as his phrasing.
- "Holmes knows" says how he comes to know it. "via `from`" means the grant that tells it to the
  player also teaches him, so it needs no `knownBy`.

| id | statement | Holmes knows | topics | voice (holmes) |
|---|---|---|---|---|
| `holmes_holiday_dull` | Holmes resents the holiday: London has taken a holiday from wickedness, and nothing in the street needs explaining. | `knownBy` | the holiday, bank holiday, boredom | "London has taken a holiday from wickedness, Watson. I find I resent it." |
| `holmes_opera_glass` | Holmes's opera glass is French and good; he bought it for the opera and uses it for everything else. | `knownBy` | the opera glass, your glass | "The eye is the instrument, Watson. The glass merely brings the street nearer." |
| `holmes_violin` | Holmes has been at the violin on and off since Saturday. | `knownBy` | the violin, your playing | — |
| `holmes_monograph` | Holmes's monograph upon the ashes of the various tobaccos describes a hundred and forty varieties, with plates. | `knownBy` | the monograph, tobacco ash | — |
| `holmes_watsons_service` | Holmes knew Watson for a man back from Afghanistan the day they met, seven years ago. It says nothing of where Watson was wounded. | `knownBy` | afghanistan, peshawar, india, your service | — |
| `holmes_heath_road_dust` | The man under the lamp walked in from Hampstead to save the fare: his boots are white to the ankle with the dust of the Heath road, about four miles of it. | via `from` (demonstration) | hampstead, heath road, his boots | "His boots are white to the ankle with the dust of the Heath road. That is a fact." |
| `holmes_victualler` | The licensed victualler by the pillar box has kept his daughter out an hour past the time her mother allowed. | via `from` (demonstration) | the victualler, the publican, his daughter | — |
| `holmes_observation_vs_inference` | That the boots are dusty is observed; that the man walked is inferred. Nobody else in London notes the difference. | via `from` (demonstration) | observation, inference, your method | "You will note the difference between those two things, Watson, because nobody else in London does." |
| `holmes_the_wager` | The wager: two strangers read correctly, and Holmes will not touch the violin before midnight; fail, and Watson reads the tobacco monograph, plates and all. Holmes holds him to his first answer. | via `from` (wager) | the wager, the bet, the stakes | "Tell me when you have him. I shall hold you to your first answer." **[Q]** |
| `watson_reading_soldier` | The old fellow by the cab rank: an infantryman by his stance; Indian service, and not lately; an old fracture of the left thigh, set in a hurry and healed short; a sergeant, by the look of him, long out of the army and still standing like one. | via the commit | the old soldier, the man by the cab rank | — |
| `watson_reading_clergyman` | Watson's reading of the clergyman across the street, given to Holmes as his answer in the wager. | via the commit | the clergyman, the curate | — |
| `holmes_soldier_grandchild` | The old soldier is waiting for a grandchild: he watches the crowd at the height of a child's head, not a man's. | via `from` (soldier verdict) | the grandchild | "I should only have added that he is waiting for a grandchild." |
| `holmes_actor_reading` | The clergyman is an actor in costume between the matinée and the evening performance at a West End house, in a melodrama with a clergyman in it; greasepaint at the hairline, new lines in a thin script; he is not wanted until the second act. | via `from` (either clergyman verdict) | the actor, greasepaint, the theatre, the second act | — |
| `actor_found_through_glass` | Watson saw the greasepaint through the glass before he gave his answer, and read the actor correctly. Holmes conceded it. | via `from` (win) | the point you conceded | "You have it exactly." |
| `actor_shown_through_glass` | Watson read a poor country curate; Holmes put the glass in his hand, and he saw the greasepaint. A point to Holmes. | via `from` (loss) | the point you won | "You saw a black coat and stopped looking." **[Q]** |
| `holmes_invisible_in_a_crowd` | We see what asks to be seen. A man who asks nothing of anybody might pass under the window every evening for a year and never once be looked at. | via `from` (closing) | being noticed, what asks to be seen | "We see what asks to be seen." **[Q]** |

- **`knownBy` at the start:** holmes for the first five; `player` for none. The two `watson_reading_*`
  Facts reach the player by plain `grantFact` (no `from`) in the wager scene.

| Clue id | name | fact | summary |
|---|---|---|---|
| `clue_old_soldier` | The Old Soldier | `holmes_soldier_grandchild` | An infantryman, India long ago, the left thigh healed short; read correctly. Holmes added that he waits for a grandchild. |
| `clue_actor_found` | The Actor | `actor_found_through_glass` | Not a curate: an actor between performances. I found the greasepaint through the glass before I spoke. |
| `clue_actor_shown` | The Actor | `actor_shown_through_glass` | Not a curate: an actor between performances. I saw a black coat and stopped looking; Holmes put the glass in my hand. |
| `clue_what_asks_to_be_seen` | What Asks to Be Seen | `holmes_invisible_in_a_crowd` | Holmes, at the window: we see what asks to be seen. I could not describe one other person who had passed. |

---

## 5. Rules — `rules.json`, in file order

Each row gives:

| Column | Holds |
|---|---|
| Trigger | the trigger kind and its fields |
| When | the conditions |
| once | whether the Rule fires once |
| Effects | in order |
| Narration | the mode and word count (§0.6) |
| Q | the quantities stated |
| Diary | what it adds to the diary |

### 5.1 The coda (listed first so the closing's turn can't also play it)

| # | id | Trigger | When | once | Effects |
|---|---|---|---|---|---|
| 1 | `evening_ends_on_action` | action, verbs **examine, read, take, drop, open, close, use, combine, show, give, talk, move** | `flagsAll [closing_heard]` | yes | `setFlag evening_over` |
| 2 | `evening_ends_on_tick` | tick (weight 1) | `flagsAll [closing_heard]`, `flagsNone [evening_over]` | yes | `setFlag evening_over` |

### 5.2 The closing

| # | id | Trigger | When | once | Effects |
|---|---|---|---|---|---|
| 3 | `closing` | action, same verbs as #1 | `flagsAll [soldier_read, clergyman_read]`, `personsPresent [holmes]` | yes | `playBeat` §5.9-C; `grantFact player holmes_invisible_in_a_crowd from holmes`; `cue lamplighter`*; `setFlag closing_heard` |

- **Narration:** about 140 words. Beats about 95, the thesis voice about 10.
- **Quantities:** "some hundreds" (in the beat).
- **Diary:** *What Asks to Be Seen*.
- *The lamplighter **is** the clock Rule #18 if it hasn't fired yet. #3 carries no lamplighter cue;
  that is decided in §8 (A4).

### 5.3 The verdicts (on the commit: the player tells Holmes a reading)

| # | id | Trigger | When | once | Effects |
|---|---|---|---|---|---|
| 4 | `soldier_verdict` | disclosed `watson_reading_soldier` from `player` to `holmes` | `personsPresent [holmes]` | yes | `playBeat` §5.9-S; `grantFact player holmes_soldier_grandchild from holmes`; `setFlag soldier_read` |
| 5 | `clergyman_verdict_won` | disclosed `watson_reading_clergyman` from `player` to `holmes` | `flagsAll [clergyman_seen_through_glass]`, `personsPresent [holmes]` | yes | `playBeat` §5.9-W; `grantFact player holmes_actor_reading from holmes`; `grantFact player actor_found_through_glass from holmes`; `setFlag wager_won`; `setFlag clergyman_read` |
| 6 | `clergyman_verdict_lost` | as #5 | `flagsNone [clergyman_seen_through_glass]`, `personsPresent [holmes]` | yes | `playBeat` §5.9-L; `moveObject opera_glass → location baker_street`; `grantFact player holmes_actor_reading from holmes`; `grantFact player actor_shown_through_glass from holmes`; `setFlag clergyman_read` |
| 7 | `deduce_soldier` | deduction, `facts [watson_reading_soldier]` | `flagsNone [soldier_read]`, `personsPresent [holmes]` | yes | `grantFact holmes watson_reading_soldier from player` (raises #4) |
| 8 | `deduce_clergyman` | deduction, `facts [watson_reading_clergyman]` | `flagsNone [clergyman_read]`, `personsPresent [holmes]` | yes | `grantFact holmes watson_reading_clergyman from player` (raises #5 or #6) |

- **#4:** about 150 words, including the reading's statement. Quantities: "Peshawar". Diary: *The Old
  Soldier*.
- **#5:** about 130 words. Quantities: none. Diary: *The Actor* (found).
- **#6:** about 150 words. Quantities: none. Diary: *The Actor* (shown).
- **#7 and #8** narrate with their verdict.

### 5.4 The glass (reading through it)

| # | id | Trigger | When | once | Effects |
|---|---|---|---|---|---|
| 9 | `glass_on_clergyman` | combine `[opera_glass, street_clergyman]` | `flagsNone [clergyman_read]` | yes | `setFlag clergyman_seen_through_glass` |
| 10 | `clergyman_examined_with_glass` | action, examine, target `street_clergyman` | `hasItems [opera_glass]`, `flagsNone [clergyman_read]` | yes | `setFlag clergyman_seen_through_glass` |
| 11 | `clergyman_through_glass` | flag `clergyman_seen_through_glass` | — | yes | `giveItem opera_glass`; `playBeat` §5.9-G |
| 12 | `glass_on_soldier` | combine `[opera_glass, street_soldier]` | — | yes | `giveItem opera_glass`; `playBeat ["Through the glass, a faded campaign ribbon shows on the old fellow's coat, worn so long it has gone the colour of the cloth."]` |
| 13 | `glass_on_crowd` | combine `[opera_glass, crowd]` | — | **no** (texture; repeats) | `giveItem opera_glass`; `playBeat ["The glass brings the street up close: straw hats, a child on a man's shoulders, a sailor arguing with a cabman."]` |
| 14 | `glass_on_window` | combine `[opera_glass, open_window]` | — | **no** | `giveItem opera_glass`; `playBeat ["Through the glass the far side of Baker Street jumps forward: the chemist's window, a lamp-post, a dog asleep in a doorway."]` |

- **#11:** about 60 words. Quantities: none.
- **#12–#14:** about 30 words each, in `full`. Quantities: none.

### 5.5 The wager

| # | id | Trigger | When | once | Effects |
|---|---|---|---|---|---|
| 15 | `wager_on_exchange` | action, verbs **talk, ask**, person `holmes` | `flagsAll [demonstration_given]`, `flagsNone [wager_offered]` | yes | `setFlag wager_offered` |
| 16 | `wager_on_tick` | tick (weight 1) | `flagsAll [demonstration_given]`, `flagsNone [wager_offered]` | yes | `setFlag wager_offered` |
| 17 | `wager` | flag `wager_offered` | `personsPresent [holmes]` | yes | `playBeat` §5.9-WG; `revealObject street_soldier`; `revealObject street_clergyman`; `setDisposition holmes warm`; `grantFact player holmes_the_wager from holmes`; `grantFact player watson_reading_soldier`; `grantFact player watson_reading_clergyman` |

- **#17:** about 150 words. Quantities: "midnight", "a hundred and forty" (in the terms beat).

### 5.6 Dusk

| # | id | Trigger | When | once | Effects |
|---|---|---|---|---|---|
| 18 | `lamplighter` | clock `atMinutes 1185` (7:45 PM), `act [0]` | — | yes | `playBeat ["Across the street the lamplighter comes down the row with his pole, and the gas goes up one lamp at a time."]`; `cue lamplighter` |

- **#18:** one sentence. It joins whatever turn passes 7:45 (§6).

### 5.7 The demonstration (listed last of the scenes, so the wager can't fire on the same action)

| # | id | Trigger | When | once | Effects |
|---|---|---|---|---|---|
| 19 | `holmes_turns_on_action` | action, verbs **examine, read, take, drop, open, close, use, combine, show, give, talk, ask, deduce, move** | `flagsNone [demonstration_given]` | yes | `setFlag demonstration_given` |
| 20 | `holmes_turns_on_tick` | tick (weight 1) | `flagsNone [demonstration_given]` | yes | `setFlag demonstration_given` |
| 21 | `demonstration` | flag `demonstration_given` | `personsPresent [holmes]` | yes | `moveObject opera_glass → location baker_street`; `cue glass_down`; `playBeat` §5.9-D; `grantFact player holmes_victualler from holmes`; `grantFact player holmes_heath_road_dust from holmes`; `grantFact player holmes_observation_vs_inference from holmes` |

- **#21:** about 150 words: Beats about 60, plus three short voices or statements. Quantities: "four"
  (Heath road), "an hour".

### 5.8 The ending (after the coda trigger)

| # | id | Trigger | When | once | Effects |
|---|---|---|---|---|---|
| 22 | `coda_won` | flag `evening_over` | `flagsAll [wager_won]` | yes | `playBeat ["Holmes took up the violin from its case, looked at it, and put it down again; and he kept his word until midnight, which was more than I had dared expect."]`; `endGame prologue_end` |
| 23 | `coda_lost` | flag `evening_over` | `flagsNone [wager_won]` | yes | `cue pages_riffle`; `playBeat ["Holmes took down the monograph upon the ashes of the various tobaccos and laid it in my lap with great tenderness, and I read it, plates and all, until the street was quiet."]`; `endGame prologue_end` |

- **#22 / #23:** about 90 words, `full`. The `GameEnded` event lands the ending's beat, the open
  windows **[Q]**. Quantities: "midnight" (won), none (lost).

### 5.9 Scene Beats

**D — the demonstration** (#21):
1. Holmes speaks without turning from the window.
2. He reads the street for Watson: the victualler and his daughter, the man under the lamp. *(The
   attributed Facts carry what he says.)*
3. He lowers the opera glass and sets it on the mantel.
4. Watson says, with some feeling, that it is a very good parlour trick, and that any man might do
   it who had nothing else to do with his evening.

**WG — the wager** (#17):
1. Holmes turns from the window at "parlour trick". Restate the jab: the Beat must stand alone.
2. Holmes proposes a wager: two people in the street, read correctly. *(Terms in `holmes_the_wager`.)*
3. Watson's thought: that is a prize worth having, the violin silent until midnight. The monograph
   upon the ashes of a hundred and forty tobaccos is the forfeit.
4. Holmes gestures at the window as a man holds open a door: the old fellow on the kerb by the cab
   rank, just under the window, and the clergyman across the street outside the chemist's, his face
   half-lost under his hat brim.
5. **[Q]** "Take your time. I have nothing whatever else to do."

**S — the soldier verdict** (#4):
1. Watson gives his reading aloud *(its statement, `watson_reading_soldier`)*, adding that he knew
   that walk from the base hospital at Peshawar.
2. Holmes is silent a moment, then: "Admirable." He concedes every word, and the leg better than he
   could have seen it.
3. He adds the one thing Watson missed *(`holmes_soldier_grandchild`)*. "One to you, Watson."

**G — through the glass** (#11):
1. Watson takes Holmes's opera glass from the mantel *(if he doesn't already hold it)* and looks
   across the street.
2. Along the clergyman's hairline, beside the ear, a faint brownish line, too even to be dirt. The
   book isn't a prayer-book: a thin paper volume in a coloured wrapper, the lines set out in short,
   uneven lengths.

**W — the clergyman, won** (#5):
1. Watson: no curate, Holmes; that is greasepaint at his hairline, and he is learning a part, not a
   lesson. An actor between performances, still in his costume.
2. Holmes looks at him so long Watson fears some fresh error, then confirms it *(the
   `holmes_actor_reading` Fact)*, sits down rather heavily, and says **[Q]** "I begin to think I
   shall have to find another occupation."

**L — the clergyman, lost** (#6):
1. Watson gives his reading: a curate, a poor parish somewhere in the country, getting tomorrow's
   lesson by heart.
2. **[Q]** "Ah," said Holmes, very gently. "Look again — through the glass this time. Not at his
   coat. At the line of his hair beside the ear, and at the book."
3. Watson looks through the glass and sees the greasepaint and the thin paper script. "Greasepaint,"
   he says, and feels foolish.
4. Holmes explains *(`holmes_actor_reading`)*, takes the glass back to the mantel, and gives the
   rebuke *(`actor_shown_through_glass`, voice [Q])*. "One to me."

**C — the closing** (#3):
1. The light is going; the crowd below has thickened as holiday crowds do once the public-houses
   are the only places still open. Holmes has gone back to the window.
2. **[Q]** "You did very well, Watson. Better than you know." Then: how many people have passed under
   this window since you began? Watson: "Some hundreds." Describe one, any one I did not point out.
3. Watson can't: straw hats, a great many children, a sailor; not one face.
4. **[Q]** "Nor could I. Nor could any constable on any beat in London. We see what asks to be seen.
   A man who asks nothing of anybody — who dresses as the street dresses and walks as the street
   walks — might pass under this window every evening for a year and never once be looked at."
5. He lets the curtain fall, and smiles at Watson's answer that London may be forgiven a little
   dullness once a year, and doesn't reply.

The protected thesis is carried whole in beat 4. The Fact (`holmes_invisible_in_a_crowd`) records it
in the Ledger and the diary.

---

## 6. Turn windows and the clock

The start is 7:30 PM (1170). Costs come from the engine:

| Action | Minutes |
|---|---|
| talk, ask | 5 |
| examine, use, combine | 3 |
| take | 1 |
| deduce | 10 |
| `wait` (a Tick) | 30 |
| idle Tick | 15 |

**Shortest win:**

| Turn | Action | Clock | What fires |
|---|---|---|---|
| — | (opening) | 7:30 | the opening |
| 1 | talk to Holmes | 7:35 | #19 → #21 demonstration |
| 2 | talk to Holmes | 7:40 | #15 → #17 wager |
| 3 | use the glass on the clergyman | 7:43 | #9 → #11 |
| 4 | tell Holmes about the old soldier | 7:48 | #4; and #18 lamplighter as the clock passes 7:45 |
| 5 | tell Holmes about the clergyman | 7:53 | #5 won |
| 6 | examine the crowd | 7:56 | #3 closing |
| 7 | anything (or a Tick) | 7:59–8:00 | #1 → #22 coda (won) → the ending |

- **Shortest loss:** turns 1, 2, then the two tells, then the closing and the coda. Six actions,
  ending about 7:56.
- **The lamplighter** lands between turns 3 and 5 on any short path. On a long path (more examining
  first) it lands on an earlier, quieter turn. Its single sentence fits either way.
- **The period boundary at 8:00 PM (`night`)** may fall on the coda turn. Nothing reads the period
  in Act 0.

**Turn windows, as negatives the golden asserts:**
- **Turn 1:** demonstration yes, wager no (#15 is listed before #19, so it sees the flag unset).
  The glass is not in the Candidate Set before turn 1, and is after it.
- **Turn 2:** the wager. The figures were hidden before it and are visible after. The tell topics
  are absent before it and present after.
- **Telling Holmes:** commits. Examining doesn't. Examining the clergyman *without* the glass in hand
  doesn't set `clergyman_seen_through_glass`.
- **The second verdict's turn:** the closing never fires (its verb is `ask`).
- **The closing's turn:** the coda never fires (#1 is listed before #3).
- **Each branch:** exactly one actor Clue. `wager_won` only on the glass path.

---

## 7. Pre-checks

| Check | Result |
|---|---|
| **Schema fit** | Every row uses existing Triggers (`action`, `flag`, `disclosed`, `deduction`, `combine`, `clock`, `tick`), Effects (`setFlag`, `playBeat`, `grantFact` with `from`, `revealObject`, `moveObject`, `giveItem`, `setDisposition`, `cue`, `endGame`) and Conditions (`flagsAll`, `flagsNone`, `hasItems`). Nothing story-shaped is needed beyond `grantFact.from`, which is already built |
| **Flags** | Set and read: `demonstration_given` (19/20 → 15/16/21), `wager_offered` (15/16 → 17), `clergyman_seen_through_glass` (9/10 → 5/6/11), `soldier_read` (4 → 3/7), `clergyman_read` (5/6 → 3/8/9/10), `wager_won` (5 → 22/23), `closing_heard` (3 → 1/2), `evening_over` (1/2 → 22/23). None is set without being read, and none is read without being set. All describe world state |
| **Presence** | Holmes is at `baker_street` all act. Every Rule with an attributed grant (#3–#8, #17, #21) names him in `personsPresent`. The figures are Objects |
| **Chronology** | Stated once, in the spec's §C. The Beats above cite it: "a little after seven", "about sixty", "a hundred and forty", "midnight", "Saturday". Nothing restates a date |
| **Spoilers** | Act 0 is the first act. No later Fact exists yet, so nothing to list. Act 1's Facts will list Tabram, Whitechapel and George Yard as `spoilerTerms`; Act 0's beats contain none of them |

**Name collisions** (Candidate Set from the wager on: 9 Objects, plus Holmes):

| Pair | Verdict |
|---|---|
| "glass" vs "window" | different words; "the window glass" isn't a phrase anyone types |
| "the old fellow …" vs "the man under the lamp" (crowd beats) | different Objects, different words. "The man" alone resolves by context (the selection model's tie answer is `none`, which is a clean miss) |
| "the mantelpiece" vs "Holmes's opera glass" (on it) | no shared word |
| "the monograph" (Object) vs `holmes_monograph` (topic) | different candidate kinds: an Object to examine, a topic to ask. No clash |
| "the violin" (Object) vs `holmes_violin` (topic) | as above |

**Topic collisions** (exact duplicates fail `qa:story`; near-synonyms are judged for the same
person):

| Phrases | Verdict |
|---|---|
| `watson_reading_soldier` "the old soldier" vs `holmes_soldier_grandchild` "the grandchild" | distinct |
| `watson_reading_clergyman` "the clergyman" vs `holmes_actor_reading` "the actor" | distinct |
| `actor_found_through_glass` "the point you conceded" vs `actor_shown_through_glass` "the point you won" | near each other, but only one ever exists |
| `holmes_violin` "the violin" vs `holmes_the_wager` "the stakes" | distinct |
| Sweep of every phrase against every other | no exact duplicate; no containment between Facts Holmes knows at the same time |

**Every proper noun the prose puts in front of the player:**

| Name | Where it is |
|---|---|
| London | lexicon |
| Baker Street | location |
| Holmes, Watson | the person, the narrator |
| Hampstead, Heath road | #21's Fact |
| Peshawar | #4's Beat and `holmes_watsons_service` |
| India, Afghanistan | `watson_reading_soldier`, `holmes_watsons_service` |
| West End | `holmes_actor_reading` |
| French | lexicon |
| Persian | mantel beats (see §2.2) |
| Saturday, August, Bank Holiday | calendar words, or `dateLabel` |

**Phrasings that must reach the right verb:**

| Phrase | Must reach |
|---|---|
| "look at the clergyman through the glass" | `use opera_glass` on `street_clergyman` (#9) |
| "examine the clergyman closely" (glass in hand) | #10 |
| "tell Holmes about the soldier" | `ask holmes` with tell topic `watson_reading_soldier` |
| "I think the clergyman is an actor" | `deduce` (#8) or `ask` (tell); either commits |

All four go to the live `select` check at pre-flight (§I of the spec template).

---

## 8. Spec amendments in this score (part of sign-off #2)

**Accepted by the owner, 2026-11-28: A1–A4 as written.**

- **A1. `holmes_soldier_reading` is dropped.**
  - The spec added it so "ask Holmes about the soldier" is answered after the verdict.
  - The engine already does that: once told, Watson's reading is a Fact Holmes *knows*, so it
    becomes askable from him.
  - So `watson_reading_soldier` now carries the full reading. A separate Holmes Fact would collide
    with it.
  - For the clergyman, Watson's reading stays neutral, because its content differs by branch.
    `holmes_actor_reading` answers after the verdict.
- **A2. The lose verdict has one line for both cases.**
  - The spec has Holmes hand Watson the glass, or say "use the glass" if Watson already holds it.
  - The engine has no "not carrying" condition, so the score writes one line that is true either
    way: "Look again — through the glass this time."
  - The glass goes back to the mantel in the same Rule.
- **A3. The closing has no fallback.** It fires on any non-question action. A player who only asks
  questions keeps getting answers, and the act waits. The coda keeps its Tick fallback. The spec left
  this to the score.
- **A4. The lamplighter is a clock Rule at 7:45 PM, not a closing beat.** The voice reference puts
  him in the closing. The spec says "on a `clock` Rule as dusk falls". On short paths he arrives one
  or two turns before the closing, which still reads as "the light was going".
- **A5. Two Objects the spec didn't list: none.** The mantel and the bench were already added in the
  spec.

## 9. Risks the golden can't see (for the playtest)

- **The glass is invisible on the very first turn.** If the player's first line is about the glass
  ("take the opera glass"), the selection model may answer flavour or none. A rejected or flavour
  turn fires no Rule, so the demonstration waits for the next action. Holmes's beats carry the
  glass, so "examine Holmes" or "talk to Holmes" lands it, and the first idle Tick fires it anyway.
  This is a playtest item: one turn of "you can't" against a glass the opening showed.
- **The commit by "tell".** The selection prompt says topics marked "tell" mean the player would be
  telling. "What do you make of the clergyman, Holmes?" may also map to the tell topic and commit.
  The terms beat ("I shall hold you to your first answer") is the fiction's warning. Watch it in
  play.
- **The two `full`-mode verdicts run close to 160 words.** The gate's fallback is the Beats alone,
  joined. Each Beat list above reads as prose bare.

---

## 10. Next (after sign-off #2)

1. **Golden, red:**
   - `scripts/qa-whitechapel.ts` drives both shortest paths with explicit Selections, plus every
     negative in §6.
   - It runs the prover on `stories/whitechapel_1888` and checks the goals are UNREACHABLE (the
     Story is absent).
   - It is added to `qa:all`.
2. **Implement:** the JSON, until `qa:story`, the golden, the prover (Act 0, the four Clues, the
   ending REACHABLE) and `qa:all` are green. Then `narrative-consistency-reviewer`.
3. **Playtest:**
   - `game-reviewer` (blind);
   - `qa-playthrough` (live narration);
   - your own run, on a deploy with `VITE_DEFAULT_STORY=whitechapel_1888`.
