# London Bleeds — Reweave Act Walkthrough

*The connective tissue between the [Phase 1 Reweave Spec](./reweave-phase1-spec.md) and the build. For each act: locations, NPCs, objects, clues, the exact critical path the player follows, and the gate to the next act. Written act-by-act so cohesion can be verified link by link before any code is written.*

*Describes the **target (rewoven) game**, not the current build.*

---

## How to read each act

Every act entry uses the same template:

- **Overview** — theory, date/time, locations, dramatic purpose, player goal
- **Locations & what they hold** — per location: NPCs present, key interactables, what each reveals
- **Clues in this act** — id, name, where/how triggered, what it points to
- **Suspect choreography** — which loud theory rises/falls here, and the Edmund pointer
- **Threads** — Halward-family / light-motif / Holmes-theme beats
- **Critical path** — the numbered minimum sequence of player actions, with resulting state changes, ending at the gate
- **Optional / texture** — non-critical discoveries, red herrings, atmosphere
- **Gate to next act** — the exact flags required to advance
- **Transition out** — how the act *concludes and hands off*: the closing journal beat, the auto-move to the next anchor, and the opening arrival. This is the phase-shift the player feels.
- **Why this act is interesting** — the fun/cohesion check
- **Length** — rough action count / time

> **The act transition (every act):** a three-beat bookend —
> 1. **Closing journal** (Watson's act-closing diary entry — *existing* `AIService.generateJournalEntry`): summarises what was learned, states where suspicion now stands, pulls forward.
> 2. **Auto-move** to the next act's **anchor location** (small engine addition: set `newLocation` to the act anchor on advance).
> 3. **Opening arrival narration** (FULL mode) at the new anchor.
>
> *Look back → cut → look forward.* The journal is the conclusion; the arrival is the new beginning.

> **Historical accuracy (standing process):** every in-game beat that touches real events or dates is checked against the `historian` skill here, on paper, first — and all prose written from this walkthrough is later verified by the `qa-playthrough` agent's historical-accuracy rubric before it ships.

> **End acts on a character beat, not a bare mechanic.** Where possible the final gated action is a *conversation or reaction* (Holmes's word, Bond's weariness), not a cold examine — so the phase closes with human weight before the closing journal. The grislier the act, the more this matters.

> **Edmund is ambient — never a tracked suspect (until Act 5).** He is examinable and talkable like any background figure, but his responses are flat and unremarkable (the alibi of invisibility). He is **never** added to the Persons of Interest list before the Act 5 convergence, and **never** "considered then dismissed" — a strikethrough is a spotlight that makes players suspicious. The *clues* build an abstract profile (a quiet professional who knows what he takes, who belongs at the scenes); the player overlays that profile onto the forgettable assistant only at the reveal. Treat him as *just there* — neither interesting nor pointedly uninteresting.

> **Plant clues whole; let the player make the connection.** Never pre-highlight the specific detail that will later match (a single misspelling, a particular phrase, a handwriting tic). Present the evidence in full and let the *matching* moment be the player's discovery, not the narrator's gift. A link the player makes themselves is the genre's core pleasure; a link handed to them is a spoiler.

> **Engine behaviour — and the reweave fix:** *currently* `resolveTalk` and `resolveShow` do **not** fire act progression — only `resolveExamine` / `resolveMove` do. That means a gate requiring a talk/show flag can soft-lock if the talk happens last. **The reweave fixes this** by firing `checkActProgression` after the talk and show resolvers too, so *any* gate-completing action advances the act. Post-fix, gates may freely require conversations (which the suspect choreography needs), and critical-path ordering no longer matters.

> **Holmes is already with you.** Holmes has `followingRule: 'follows_watson'` — he shadows the player to every location automatically. So the per-act "Holmes capstone" beats work *without* placing him by act; the canonical locations are only fallbacks. **One build caveat:** the hard-cut auto-move (act advance) must also carry `follows_watson` NPCs to the new anchor, or Holmes will lag a location behind.

---

## Act 0 — The Baker Street Vigil *(Prologue)*

### Overview
- **Theory:** none yet — this act establishes the board.
- **Date/time:** Thursday, 8 November 1888, ~8:00 PM (the evening Warren resigned; Kelly will be murdered overnight).
- **Location:** `baker_street` (221B sitting room).
- **Dramatic purpose:** Establish Watson as retrospective narrator; the campaign *so far* — **four** murders over roughly ten weeks (Kelly has **not** yet happened — this is the eve of it); the institutional chaos (Commissioner Warren resigned this very day); the cast of loud suspects already in the public air; and Holmes's method and his single certainty — *the killer is a man no one remembers.* The player believes they are signing on to **reconstruct cold cases** — which is what makes Act 1's fresh murder so shocking. Tutorialises EXAMINE, READ, TALK, and SHOW in the safety of home.
- **Player goal:** Absorb the case, be briefed by Holmes, and set out for Whitechapel.

### Locations & what they hold

**`baker_street` — 221B sitting room** *(present; domestic warmth — the sanctuary register)*
- **NPC:** **Holmes** (introduced). Briefs Watson on the campaign so far and the plan: the official investigation has failed, so they will *reconstruct* the four murders the police botched. Establishes his confidence and method.
- **Interactables:**
  - `case_files_wall` → **clue_00_campaign_timeline**. Holmes's case map: **four** sites, four dates, ~ten weeks, accelerating (the double event the clearest sign). *Reweave addition:* the wall also bears the **suspect landscape** — pinned notes naming the loud men in the public air (the American doctor just taken into custody; "Leather Apron"; a troubled gentleman of rumour). Edmund is **not** named. One note reads, unremarkably, *"Bond — police surgeon — & assistant."* The seed of invisibility, hidden in plain sight. *(Data flag: the existing `clue_00` text lists five victims incl. Kelly — revise to four for the prologue; the wall/understanding updates to five in Act 1.)*
  - `telegrams_pile` → Abberline's telegrams. *Reweave addition:* the **7 Nov note of Francis Tumblety's arrest** (on a gross-indecency charge — a man some at the Yard fancy for the murders) and the **8 Nov chaos of Warren's resignation**. Sets the loud-suspect board so Acts 2–4 don't spring suspects from nowhere.
  - `newspaper_pile` → the press coverage; the "Jack the Ripper" name as a **press invention**. Yields a takeable **`newspaper_clipping`** (the published "Dear Boss" letter) — the object the player SHOWS to Holmes.
  - `whitechapel_map` → the four murder sites in space; optional spatial overview.
  - `holmes_chemistry_table` → texture: Holmes's method and character.
- **READ** (literal document text, via `DOCUMENT_TEXT`): `case_files_wall`, `telegrams_pile`. *Reweave: revise `case_files_wall` text to four victims; revise `telegrams_pile` text to include the Tumblety-arrest and Warren-resignation lines.*
- *(Removed: `watson_armchair` as an object of interest — flavour only, not examinable. It read as filler.)*

### Clues in this act
| Clue | Trigger | Points to |
|---|---|---|
| `clue_00_campaign_timeline` | examine `case_files_wall` | The frame: a *patient, calculating* killer, accelerating in confidence. And the fair-play seed — **no reliable witness in ten weeks of killing**, so the killer is *unremarkable.* |

### Suspect choreography
The prologue **seeds the loud suspects' existence** (the American in custody, the Leather Apron panic, the gentleman rumour) so their later acts feel inevitable, not arbitrary. Edmund is present only as the unnamed "assistant" on one wall note — the player's eye slides past it. The choreography's first move is misdirection by omission.

### Threads
- **Holmes theme:** plant *"the killer is a man no one remembers — that is the only thing we know of him."* Fair-play foreshadowing: the player is told the answer is forgettable, then spends the game ignoring the forgettable man. (The stronger *"to know a thing and to mend it are not the same act"* line is reserved for mid-game.)
- **Light motif:** a faint atmospheric seed — Watson notes the quality of gaslight and fog as he settles in; establishes the motif's vocabulary before Edmund ever embodies it.
- **Halward family:** not yet (first real seed is Act 2).

### Critical path (minimum to advance)
1. `talk to holmes` → sets `talked_to_holmes_at_baker_street`. Holmes briefs Watson: the four murders, the chaos, the reconstruction plan, "the killer is a man no one remembers." *(tutorial: TALK)*
2. `examine case files wall` → discovers `clue_00_campaign_timeline`; sets `examined_baker_street_case_files_wall`. *(tutorial: EXAMINE)*
3. `examine newspaper pile` → reveals the press's "Jack the Ripper" invention and adds **`newspaper_clipping`** to inventory. *(tutorial: TAKE — clipping auto-collected on first examine, per the existing takeable pattern)*
4. `show newspaper clipping to holmes` → Holmes's deduction: the "Dear Boss" letters are a journalist's hoax — *misdirection*, the case's central theme. Sets `showed_newspaper_clipping_to_holmes`. *(tutorial: SHOW + a second NPC exchange)*
5. `examine telegrams pile` → sets `examined_baker_street_telegrams_pile`; reveals Tumblety's arrest + Warren's resignation + the unremarked "Bond & assistant" seed.
→ **Gate met → advance to Act 1.** *(With the talk/show progression fix, gate order is free — see header.)*

### Optional / texture
`examine whitechapel_map`, `examine holmes_chemistry_table`; `read case files wall` / `read telegrams pile` for the literal documents. None gate progress; all build world and character.

### Gate to next act
`examined_baker_street_case_files_wall` **AND** `talked_to_holmes_at_baker_street` **AND** `showed_newspaper_clipping_to_holmes` **AND** `examined_baker_street_telegrams_pile`.

### Transition out → Act 1
*Historically exact: **Kelly is still alive as the prologue ends.** She is killed in the small hours of 9 November and her body is not discovered until ~10:45 AM, by the rent collector Thomas Bowyer. **No word of her can reach Baker Street the evening of the 8th** — so the transition is built on resolve, not a telegram. The prologue's beat is deliberately **light** (the player has only just learned the verbs).*

1. **Closing beat (resolve, not news):** the case absorbed and Holmes briefed, the evening closes on a decision — at first light they will go into Whitechapel to begin reconstructing the four murders. A short diary beat in Watson's hand: dread, and resolve. *Kelly is never mentioned; she is still alive.*
2. **Auto-move + overnight cut:** Watson → **`dorset_street`** (Act 1 anchor — the street outside Miller's Court). The hard cut bridges the night of 8→9 November.
3. **Opening arrival (Act 1):** morning, 9 November. Watson and Holmes reach Whitechapel to find the streets in uproar — a body discovered that morning in Miller's Court. **The cold-case reconstruction they planned is overtaken by a fresh, fifth murder.** FULL-mode arrival narration; the sanctuary of 221B falls away. The stakes invert: this is no longer history — it is happening now.

### Why this act is interesting
It does quadruple duty without feeling like a tutorial: it teaches the verbs (examine, take, talk, show); it makes the player *complicit* in the misdirection (they read the suspect board and skip the assistant; Holmes warns them the published letters are a hoax); it plants the fair-play key — *the killer is unremarkable* — that the ending will detonate; and it sets up the game's sharpest pivot — the player signs on to *reconstruct cold cases*, then a fifth murder erupts that very night and the hunt goes live. The domestic warmth of 221B sets the sanctuary contrast that makes Whitechapel land harder.

### Length
5–7 actions, ~4–6 minutes.

### Build flags (new for this act)
- **Revise `clue_00_campaign_timeline`** to **four** victims (Nichols, Chapman, Stride, Eddowes) — Kelly is not yet dead in the Prologue. The wall/understanding updates to five in Act 1.
- **Revise `DOCUMENT_TEXT`** for `case_files_wall` (four victims) and `telegrams_pile` (add the 7 Nov Tumblety-arrest and 8 Nov Warren-resignation lines).
- **New takeable `newspaper_clipping`** (the published "Dear Boss" letter) from `newspaper_pile` → add to `TAKEABLE_OBJECTS`; auto-collected on examine.
- **New `SHOW_INTERACTION`** `newspaper_clipping` → `holmes` (Holmes calls the letters a press hoax; sets `showed_newspaper_clipping_to_holmes`).
- **Remove `watson_armchair`** as an object of interest (flavour only).
- **Act 0 gate** → `examined_baker_street_case_files_wall` + `talked_to_holmes_at_baker_street` + `showed_newspaper_clipping_to_holmes` + `examined_baker_street_telegrams_pile` (adds the show beat).
- **Engine fix (shared):** fire `checkActProgression` after `resolveTalk`/`resolveShow` (see header).

---

## Act 1 — The Last Murder · *"The Stranger"*

### Overview
- **Theory:** **The Stranger** — a well-dressed, foreign-looking man seen with Kelly the night she died. The player's first loud lead, supplied by the witness George Hutchinson.
- **Date/time:** Friday, 9 November 1888, from ~10:45 AM (the hour Bowyer found the body). The cold-case plan is overtaken by a fresh murder.
- **Locations:** `dorset_street` (anchor — the street in uproar) ↔ `millers_court` (Room 13 — the murder scene).
- **Dramatic purpose:** Deliver the pivot (history becomes live horror); confront the player with the freshest, most brutal scene through Watson's restrained medical eye; introduce **Hutchinson** and the witness/suspect duality; raise the Stranger theory; and slip Edmund into the room — present, useful, unremarked — with his first light beat.
- **Player goal:** Take in the scene and the street, hear the witness, and understand what was done here.

### Locations & what they hold

**`dorset_street` — the street outside Miller's Court** *(present; the public uproar)* — **Act 1 anchor**
- **NPCs:**
  - **Holmes** (introduced) — conferring at the mouth of the court; begins directing the reconstruction; sceptical of the convenient Stranger.
  - **Abberline** (introduced) — harried, sleepless; Warren resigned yesterday and the force is leaderless. Gives the investigation's state and, if asked, mentions *the American the Yard has in custody* (reinforces the Tumblety seed for Act 2).
  - **Hutchinson** *(new NPC; introduced on contact)* — a labourer in the crowd who knew Kelly; gives the **Stranger** account.
- **Interactables (street texture; flag for build):** the gathered crowd, the lodging-house entrances, the court's narrow archway. Atmosphere and optional colour; none gate progress.

**`millers_court` — Room 13** *(present; the murder scene)*
- **NPCs:**
  - **Bond** (introduced) — police surgeon, mid-examination; clinical, reserved. Gives preliminary findings if addressed early; but once Watson has examined the bed, Bond's **aftermath beat** fires (scripted, `triggerFlag: examined_millers_court_the_bed`): a weary, human reckoning from the man who has had to catalogue every one of these — the surgeon's burden, restrained, unforgettable. *This is the act's emotional capstone.*
  - **"Bond's assistant"** = **Edmund** *(alias; NOT introduced)* — taking notes by the grate. His first scripted light beat fires on the burned clothing (see Threads). And in Bond's aftermath beat, Edmund is notably **unmoved** — where Bond is haunted, the assistant is serene, even faintly interested. The player reads it as the steadiness of youth or training. It is not. Easily filed as "the helpful assistant."
- **Interactables:**
  - `burned_clothing` → **clue_01_killer_confidence**. The grate: clothing burned for hours to give light. Sets `examined_millers_court_burned_clothing`.
  - `the_bed` → the central horror; Watson's restrained medical observation of what was done with time and without interruption. Sets `examined_millers_court_the_bed`.
  - `bloodstained_sheets` → forensic texture; Bond's assessment of the blood and the hours involved.
  - `examination_instruments` → texture; Bond's tools, the procedure of the post-mortem.

### Clues in this act
| Clue | Trigger | Points to |
|---|---|---|
| `clue_01_killer_confidence` | examine `burned_clothing` | The killer had **hours**, worked **by firelight**, unhurried and unafraid of discovery — *confidence and access.* (Quietly: a man who *belonged* there, not a panicked intruder.) |

*(The Stranger theory is carried by Hutchinson's dialogue, not a clue object — it is testimony, deliberately less solid than physical evidence.)*

### Suspect choreography
**The Stranger rises.** Hutchinson describes a prosperous, foreign-looking man with a gold watch-chain he saw with Kelly hours before her death — the player's first concrete suspect: outsider, gentleman, foreigner all at once. **And Hutchinson himself wobbles into view:** his account is *extraordinarily* detailed and he admits he loitered outside the court that night. The duality is planted — *is the witness a suspect?* — training the player to scrutinise everyone, which makes the later overlooking of Edmund the crueller.

**Edmund pointer (faint, first beat):** `clue_01` says the killer was unhurried and *belonged* at the scene. No spotlight yet — but the vector ("a man whose presence raised no alarm") is laid down, to be triangulated later.

### Threads
- **Light motif (first embodiment):** the burned clothing — fire kept up for *hours* to work by. Edmund's scripted line fires on examining it: unprompted, he remarks that whoever lit the clothing *understood how long it would burn* — a specific duration, a specific light. Delivered as professional competence; sinister only in retrospect. *(Recession note: keep it flat and easily missed — no narrator emphasis.)*
- **Holmes theme:** Holmes confident and already working; a line dismissing the Stranger — *"Too convenient, Watson. The witness hands us a foreigner in a good coat — precisely the man London wishes to blame."* Plants scepticism toward the loud theory.
- **Recession tell (Bond vs Edmund):** in the aftermath capstone, the *contrast* does the work — Bond, who has catalogued every victim, is visibly broken; his assistant is calm, even faintly absorbed. Sinister only in retrospect.
- **Halward family:** not yet (first seed is Act 2).

### Critical path (minimum to advance)
*(Arrival at `dorset_street` is automatic from the Prologue cut; opening FULL narration: the street in uproar, the crowd, Abberline.)*
1. `talk to hutchinson` → the Stranger account + his loitering admission. Sets `talked_to_hutchinson_at_dorset_street`. *(theory established)*
2. `go to millers court` → enter Room 13; FULL arrival narration (Bond and his assistant within).
3. `examine burned clothing` → discovers `clue_01_killer_confidence`; Edmund's light beat; sets `examined_millers_court_burned_clothing`.
4. `examine the bed` → Watson faces the worst of it; sets `examined_millers_court_the_bed`. This arms Bond's aftermath beat.
5. `talk to bond` → the **emotional capstone**: Bond's weary reckoning with what he has had to record; Edmund unmoved beside him. Sets `talked_to_bond_at_millers_court`.
→ **Gate met → advance to Act 2.** *(The act closes on a human beat, not a cold examine. Order-independent once the talk/show progression fix is in — see header.)*

*(Strongly encouraged, not gated: `talk to abberline` for the investigation's state and the first live mention of the American in custody.)*

### Optional / texture
`examine bloodstained_sheets`, `examine examination_instruments`; talk to Holmes and Abberline; street-level colour at `dorset_street`. None gate progress.

### Gate to next act
`talked_to_hutchinson_at_dorset_street` **AND** `examined_millers_court_burned_clothing` **AND** `examined_millers_court_the_bed` **AND** `talked_to_bond_at_millers_court` *(the capstone)*.

### Transition out → Act 2
*Full closing journal now — Watson has real horror and a real lead to process. The first entry in the moving-spotlight ledger.*
1. **Closing journal (Watson, evening 9 Nov):** the room he will never forget; **Holmes's quiet words on the street as they left** — that the Stranger is too convenient, that the man they want is one no one remembers — woven into Watson's reflection; the flicker of unease about Hutchinson; the resolve to follow the body to the mortuary and to see the American the police hold. **Suspicion stands: *the well-dressed stranger* — though Holmes is unconvinced.**
2. **Auto-move + cut:** Watson → **`whitechapel_mortuary`** (Act 2 anchor). The journal bridges 9 Nov → 11 Nov.
3. **Opening arrival (Act 2):** the mortuary; Bond's post-mortem; the medical world — where the Mad Doctor theory will blaze.

### Persons of Interest (notebook after Act 1)
- **The Stranger** *(Hutchinson's man — well-dressed, foreign-looking, unidentified)* — **active**
- **George Hutchinson** *(the witness — account suspiciously detailed; loitered nearby)* — **watch**
- **The American in custody** *(heard of via Abberline / the telegrams)* — **active, to pursue**

### Why this act is interesting
The pivot detonates here: the player thought they were studying history and walk into a body still warm. The scene is the game's most harrowing, but Watson's restraint keeps it from melodrama. The player gets their first real *suspect* (the Stranger) and their first *doubt about a witness* (Hutchinson) in the same conversation — trained to suspect everyone, the exact instinct the ending punishes. Edmund stands three feet away, useful and forgettable.

### Length
6–9 actions, ~7–10 minutes.

### Build flags (new for this act)
- **New NPC `hutchinson`** — `displayName: 'George Hutchinson'`, introduced-on-contact (no alias), `canonicalLocationByAct: { 1: 'dorset_street', 2: 'whitechapel_pub' }`. `publicKnowledge`: his sighting (a man ~34, dark, "foreign/Jewish appearance," astrakhan-trimmed coat, gold watch-chain), that he loitered outside the court, that he knew Kelly. *Historical: his statement was really given 12 Nov — fine inside the compressed window.*
- **Act 1 gate**: `talked_to_hutchinson_at_dorset_street` + `examined_millers_court_burned_clothing` + `examined_millers_court_the_bed` + `talked_to_bond_at_millers_court` (the capstone).
- **Engine fix** (shared): fire `checkActProgression` after `resolveTalk` and `resolveShow` (see header) — required for the talk-gated advance to be soft-lock-free.
- **Bond `scriptedLine`** at `millers_court`, `triggerFlag: examined_millers_court_the_bed` — the aftermath capstone beat (the surgeon's burden). Pair with an Edmund `scriptedLine`/note conveying his unmoved calm in the same moment.
- **Edmund `scriptedLines`** at `millers_court`: keep the burned-clothing line but flatten its emphasis per the recession.

---

## Act 2 — The First Victims · *"The Mad Doctor"*

### Overview
- **Theory:** **The Mad Doctor** — Francis Tumblety, the American specimen-collector the Yard is holding. The brightest, most seductive red herring; a man who genuinely *fits*.
- **Date/time:** 11–13 November 1888. The longest act — it establishes the **medical world** of the case and reconstructs the two earliest murders (Nichols, Chapman), where anatomical knowledge first showed.
- **Locations:** `whitechapel_mortuary` (anchor — Bond's domain) ↔ `bucks_row` (Nichols, reconstruction) ↔ `hanbury_street` (Chapman, reconstruction) ↔ `h_division_station` (Tumblety in custody). *Optional:* `whitechapel_pub`.
- **Dramatic purpose:** Feed the player's "it was a medical man" instinct (the removals show anatomical knowledge) and then *complicate* it (Phillips's dissent; the preservation method); blaze the Mad Doctor theory with a real, arrested, plausible suspect; plant the first Edmund-pointers — *as exoneration*, so the player files the assistant under "cleared." End on Holmes's first crack in the theory.
- **Player goal:** Reconstruct how the early victims were cut, see the man the Yard suspects, and form (then doubt) the medical theory.

### Locations & what they hold

**`whitechapel_mortuary` — Bond's mortuary** *(present)* — **Act 2 anchor**
- **NPCs:**
  - **Bond** (introduced) — conducting the post-mortems; clinical. *Carries the Halward-family seed* (below), unnamed.
  - **Dr. George Bagster Phillips** *(new NPC; introduced)* — a second police surgeon, consulting. The **real historical dispute** plays here, each man on his documented side: **Phillips** (from the Chapman post-mortem) holds the killer showed *considerable anatomical knowledge*; **Bond** holds he had *no true surgical skill*. The experts disagree — and between them the "only a trained surgeon could have done this" assumption collapses: the knowledge is real, the qualification is not. *(Keep the positions un-swapped: Phillips = knowledge, Bond = no mastery.)*
  - **"Bond's assistant"** = **Edmund** *(alias; NOT introduced — refer to him only as "the assistant," never by name)* — cataloguing at the bench, unobtrusive.
  - **Holmes** present early; he later accompanies Watson to the police station for the Tumblety interview.
- **Interactables:**
  - `bonds_desk` → **clue_02c_small_hands**. Hand-measurement annotations: *small hands, a precise grip-span* — a medical man who knows exactly what he takes. Holmes keeps it **abstract** — *"Bond, perhaps; or any of the medical men who pass through this room"* — without fixing it on a person. **Halward-family seed (ambient):** somewhere in the flow of the mortuary work, Bond mentions his assistant in passing — *a physician's son, meticulous, some trouble at home behind him* — the way one mentions any colleague's man. No name, no suspicion-frame. Sets `examined_whitechapel_mortuary`.
  - `autopsy_ledger` → **clue_02b_campaign_pattern**. The pattern across the victims; escalating confidence.
  - `specimen_cabinet` → *(optional, important seed)* Bond's laboratory preservation practice — spirit-of-wine at a specific concentration. Plants the **preservation method** the Act 4 kidney will match. No clue yet; texture that pays off later.
  - `victim_folders` → texture; the written record.

**`bucks_row` — Nichols's murder site** *(reconstruction)*
- `cobblestone_roadway` → **clue_01_respectable_approach**. Witnesses thought Nichols merely drunk — the killer approached unthreateningly. Sets `examined_bucks_row`.

**`hanbury_street` — Chapman's murder site** *(reconstruction)*
- `ground_where_body_was_discovered` → **clue_02_anatomical_knowledge**. Chapman's uterus removed with evident anatomical familiarity — *the medical angle peaks here.* Sets `examined_hanbury_street`.

**`h_division_station` — Commercial Street station** *(present)*
- **NPCs:** **Abberline** (introduced) — harried; reinforces the Halward seed if asked ("the surgeons and their men have the run of every scene — no one questions a doctor's assistant"). **Tumblety** *(new NPC)* held in custody. **Holmes** joins for the interview.
- `talk to tumblety` → **the Mad Doctor blazes**: flamboyant, contemptuous of women, a collector of anatomical "curiosities." He *fits* — and the player feels it. *The crack (easily missed):* his anatomy is a showman's, his specimens purchased curios crudely kept; he is held on a **gross-indecency** charge, not murder. Sets `talked_to_tumblety_at_h_division_station`.
- *Interactables (texture):* `investigation_board`, `witness_description_wall` (→ `clue_04b_adjustable_appearance`), `case_files_cabinet`.

### Clues in this act
| Clue | Trigger | Points to |
|---|---|---|
| `clue_02c_small_hands` | examine `bonds_desk` | Small hands, a measured grip — *a medical man who knows precisely what he takes.* Points at the **profile**, not a person; the set includes Bond, Phillips, and the men who pass through the room. |
| `clue_02b_campaign_pattern` | examine `autopsy_ledger` | One hand across all victims; escalating method. |
| `clue_01_respectable_approach` | examine `cobblestone_roadway` (Buck's Row) | The killer approached unthreateningly — he *presents well.* |
| `clue_02_anatomical_knowledge` | examine `ground_where_body_was_discovered` (Hanbury St) | Real anatomical knowledge — *a medical man* (the instinct the Mad Doctor exploits). |

### Suspect choreography
**The Mad Doctor blazes.** The medical evidence (Chapman's removal, the ledger) builds "a doctor did this," and then the Yard hands the player an actual mad doctor — arrested, foreign, specimen-collecting. Tumblety is the most *satisfying* suspect so far; the player wants him.

**The cracks (planted, not yet cashed):** Phillips says the hand was practised but **not formally trained**; Tumblety's "anatomy" is theatrical and his specimens are bought curios; the mortuary's specimen practice shows a *specific* preservation method. None of this clears Tumblety yet (he flees in Act 4) — but the discerning player feels the shape is wrong.

**Edmund-pointers (abstract profile only — never attached to the person):**
- *Small hands, a measured grip* (`clue_02c`) — the profile of a medical man who knows what he takes; the player has no reason to fix it on anyone yet.
- *Practical, self-taught anatomy* (Phillips) — a man who learned by watching, not training — but reads as "not our trained-surgeon suspect."
- *The preservation method* (`specimen_cabinet`) — a seed only.

The quiet move: the assistant is **never elevated to a suspect at all.** He is simply *there* — cataloguing at the bench, occasionally helpful, wholly unremarkable. The player's attention has somewhere far louder to go (Tumblety), and the forgettable young man by the specimen jars is exactly that: forgettable. *Invisibility, not dismissal — no strikethrough, no consideration.*

### Threads
- **Halward family (first seed):** dropped as *ambient texture*, not a suspicion beat — in the flow of discussing his work, Bond mentions his assistant is a physician's son, meticulous, with some "trouble at home" behind him. **No name** (alias holds until Act 5) and **no "above suspicion" framing** (which would imply he was ever suspected). The player simply learns who the quiet young man is; the extraction pays off retroactively.
- **Light motif:** dormant this act (Edmund is background; no scripted light beat). A faint optional beat possible at the bench, but not required.
- **Holmes theme:** Holmes assesses Tumblety and delivers the capstone crack — *"He is everything London wishes the murderer to be, Watson — loud, foreign, mad. But the hand that did this was quiet, and patient, and practised. This man is a performance."*
- **Recession:** the recession here is *absence of attention* — the assistant stays furniture, never tracked, never cleared.

### Critical path (minimum to advance)
*(Arrival at `whitechapel_mortuary` is automatic from the Act 1 cut; opening FULL narration: the post-mortem, Bond and Phillips, the assistant at the bench.)*
1. `examine bonds desk` → `clue_02c_small_hands`; the Halward-family seed; sets `examined_whitechapel_mortuary`.
2. `examine autopsy ledger` → `clue_02b_campaign_pattern`. *(Phillips's dissent surfaces around the mortuary beats; an explicit `talk to phillips` deepens it — encouraged, not gated.)*
3. `go to bucks row` → `examine cobblestone roadway` → `clue_01_respectable_approach`; sets `examined_bucks_row`.
4. `go to hanbury street` → `examine ground where body was discovered` → `clue_02_anatomical_knowledge`; sets `examined_hanbury_street`.
5. `go to h division station` *(route: Hanbury → Buck's Row → the pub → the station, or back via Dorset Street)* → `talk to tumblety` → the Mad Doctor blazes; sets `talked_to_tumblety_at_h_division_station`.
6. `talk to holmes` *(at the station, after Tumblety)* → **capstone**: Holmes's synthesis and first crack. Sets `talked_to_holmes_at_h_division_station`.
→ **Gate met → advance to Act 3.** *(Closes on a character beat — Holmes. Order-independent with the talk-progression fix.)*

### Optional / texture
`talk to phillips` (the full medical dissent), `examine specimen_cabinet` (preservation seed), `examine victim_folders`, the police-station board/wall, the `whitechapel_pub` (Ten Bells — Hutchinson lingers here in Act 2; witness colour). None gate progress; several deepen the Edmund-pointers.

### Gate to next act
`examined_whitechapel_mortuary` **AND** `examined_bucks_row` **AND** `examined_hanbury_street` **AND** `talked_to_tumblety_at_h_division_station` **AND** `talked_to_holmes_at_h_division_station` *(capstone)*.

### Transition out → Act 3
*Full closing journal — the Mad Doctor ascendant, the doubt nagging.*
1. **Closing journal (Watson, ~13 Nov):** the medical certainty hardening (Chapman's wounds, the ledger), the satisfaction of Tumblety — *surely him* — and Holmes's stubborn dissent souring it; the assistant noted and dismissed in passing. **Suspicion stands: *the Mad Doctor* — ascendant, but Holmes is unconvinced.**
2. **Auto-move + cut:** Watson → **`dutfields_yard`** (Act 3 anchor). The journal bridges ~13 → ~14 Nov.
3. **Opening arrival (Act 3):** the double-event reconstruction; Berner Street and its immigrant, socialist world — where the Foreigner theory will rise, and the panic with it.

### Persons of Interest (notebook after Act 2)
- **The Mad Doctor** *(Tumblety — in custody; specimens, misogyny; fits the medical evidence)* — **ascendant**
- **The Stranger** *(Hutchinson's man — possibly Tumblety himself?)* — **merging / fading**
- **George Hutchinson** — **watch** (recedes)
- *Note: the "trained surgeon" assumption — challenged by Phillips.*
- *(Bond's assistant is **not** listed — no one considers him; he is part of the mortuary's furniture. The absence is deliberate; see the header principle.)*

### Why this act is interesting
It is the great misdirection engine. The player's instincts are *rewarded* — they reasoned "a medical man," and the game produces one, arrested and dripping with motive. The dopamine of "I've got him" is real. Then Phillips and Holmes apply just enough pressure to keep it from closing — while the quiet assistant simply never registers, furniture beside the blazing Tumblety. Every Edmund-pointer arrives as an abstract profile the player has no reason to attach to anyone. The act ends with the player confident and wrong, which is exactly where a good mystery wants them at the midpoint.

### Length
12–16 actions, ~12–18 minutes. *The longest act — its two halves (reconstruction + the Mad Doctor) are both load-bearing. If playtests run long, Buck's Row is the most trimmable gated beat (Hanbury carries the medical angle).*

### Build flags (new for this act)
- **New NPC `phillips`** — `displayName: 'Dr. George Bagster Phillips'`, introduced, `canonicalLocationByAct: { 2: 'whitechapel_mortuary', 3: 'whitechapel_mortuary' }`. `publicKnowledge` must keep the historical positions un-swapped: **Phillips argues the killer showed considerable anatomical knowledge** (his Chapman finding); **Bond argues no true surgical skill**. The dissent between them — not either man alone — dismantles the trained-surgeon assumption.
- **New NPC `tumblety`** — `displayName: 'Francis Tumblety'` (known by reputation), `canonicalLocationByAct: { 2: 'h_division_station', 3: 'h_division_station' }`; **absent from Act 4 on (fled)**. `publicKnowledge` strictly within documented facts (American, anatomical-specimen collector, arrested on a gross-indecency charge, misogynist, *suspected by some* — never convicted). Guilt is **false**.
- **Holmes** placed at `h_division_station` for the Act 2 capstone (accompanies Watson to the interview).
- **Halward-family seed** via Bond at `bonds_desk` — ambient texture (a physician's son, meticulous, "trouble at home"), **no name** and **no suspicion-frame**. Optionally reinforced by Abberline at the station.
- **`specimen_cabinet`** at the mortuary → a preservation-practice note (no clue) that Act 4's kidney examination references.
- **Act 2 gate** → the five flags above.
- **`clue_02c_small_hands`** `holmesDeduction` points at the abstract profile (small hands, precise measurement; the set of medical men with access) — **not** "an assistant" specifically, and never the name.
- **Edmund is not added to Persons of Interest** in this act (or any act before the Act 5 convergence) — see the header principle.
- **London Hospital** deferred to **Phase 2** (Phillips at the mortuary delivers the medical dissent without a new location — a scope trim versus the spec; noted here intentionally).

---

## Act 3 — The Double Event · *"The Foreigner"*

### Overview
- **Theory:** **The Foreigner** — the anti-Semitic "Leather Apron" panic, embodied by John Pizer. The morally uncomfortable red herring: tempting, ugly, and historically real.
- **Date/time:** 14–16 November 1888. Reconstructs the **double event** of 30 September (Stride, then Eddowes within 45 minutes) and confronts the prejudice that gripped the investigation.
- **Locations:** `dutfields_yard` (anchor — Stride; the Berner Street immigrant world) ↔ `working_mens_club` (the club; Pizer; Abberline) ↔ `mitre_square` (Eddowes) ↔ `goulston_street` (the apron trail and the erased graffiti). *Edmund is **offstage** this act (at the mortuary).*
- **Dramatic purpose:** Let the player *feel the pull* of the easy, ugly suspicion — and then confront them with the wronged scapegoat and Holmes's rebuke. Reconstruct the only night the killer was interrupted, yet killed again. Plant the act's pivotal triangulation: the killer passes unremarked not because he is a hidden outsider, but because he **belongs.**
- **Player goal:** Reconstruct the double event, reckon with the Leather Apron panic, and understand why no one ever stopped the killer.

### Locations & what they hold

**`dutfields_yard` — Stride's murder site / the Berner Street club yard** *(reconstruction)* — **Act 3 anchor**
- **NPCs:** **Diemschutz** (existing; introduced) — the club steward who drove his cart into the yard and found Stride's body; voices the immigrant community's double terror (of the killer, and of the mob that blames them). **Holmes** accompanies the reconstruction.
- `yard_entrance_gate` → **clue_03_interrupted_ritual**. The killer was disturbed mid-act (Diemschutz's pony shied) — and yet, *within the hour, killed again.* Not frenzy: cold control. Sets `examined_dutfields_yard`.
- *Texture:* `cart_path`, `club_doorway`.

**`working_mens_club` — International Working Men's Educational Club** *(present; the immigrant/socialist heart)*
- **NPCs:** **Abberline** (introduced) — confirms the **Leather Apron panic**, the press-manufactured fear, the **Goulston Street graffiti and Warren's erasure**; weary of being pushed to blame the foreign community. **Pizer** *(new NPC)* — "Leather Apron" himself: a Jewish bootmaker arrested in September, alibied, released, now living under a shadow he did not earn.
- `talk to pizer` → **the Foreigner theory made human**: a frightened, wronged man. The xenophobia trap, embodied — the player sees the cost of the easy suspicion. Sets `talked_to_pizer_at_working_mens_club`.
- *Texture:* `club_members`, `posters`, `newspapers` (the socialist/immigrant world; the press panic).

**`mitre_square` — Eddowes's murder site** *(reconstruction; City Police jurisdiction)*
- `square_walls` → **clue_04_kidney_removal**. Eddowes's kidney removed within minutes — surgical efficiency, *practice.* (Quietly threads to the Lusk kidney in Act 4.) Sets `examined_mitre_square`.
- *Texture:* `alleyways`, `police_lanterns`. *Note the jurisdiction seam — Met to City — the killer crossed it unremarked.*

**`goulston_street` — the apron trail and the graffiti** *(reconstruction; moved from Act 4)*
- `apron_fragment_location` → **clue_03b_unremarked_passage** *(new clue)*. Eddowes's apron, dropped here: the killer walked from Mitre Square *through the heart of the Jewish quarter*, discarding evidence, and **no one stopped him.** Not because he hid — because he raised no alarm. Sets `examined_goulston_street`.
- `graffiti_wall` → the **erased message** ("The Juwes are the men that will not be blamed for nothing") and **Warren's order to wipe it before dawn** — to prevent a pogrom. A provocation, almost certainly *not* the killer's hand: misdirection, like the "Dear Boss" letter. (Narration beat; also sets `examined_goulston_street`.)

### Clues in this act
| Clue | Trigger | Points to |
|---|---|---|
| `clue_03_interrupted_ritual` | examine `yard_entrance_gate` (Dutfield's) | Interrupted, yet he killed again within the hour — *cold control, not frenzy.* (Quietly deflates the theatrical Mad Doctor.) |
| `clue_04_kidney_removal` | examine `square_walls` (Mitre Sq) | A kidney taken in minutes — *practised efficiency.* (Threads to the Lusk kidney, Act 4.) |
| `clue_03b_unremarked_passage` *(new)* | examine `apron_fragment_location` (Goulston St) | The killer crossed two jurisdictions and the Jewish quarter **unremarked** — he *belongs*; he is no hunted outsider. **The act's key triangulation** — delivered as profile, not person. |

### Suspect choreography
**The Foreigner rises — and shames.** The graffiti seems to point at the Jewish community; the press has handed London a "Leather Apron" to hate; and the player feels the pull of the easy answer. Then the game makes it *human*: Pizer, wronged and frightened, and Abberline, sick of being pushed to blame the poor and foreign.

**The clearing.** Pizer is alibied; the graffiti is a provocation Warren erased to protect the innocent; the panic is manufactured. **Holmes dismantles it as prejudice dressed as deduction.** *(Pizer/"Leather Apron" was a genuine public suspect — so clearing him in the notebook is fair and pointed, unlike Edmund, who is never listed.)*

**Edmund triangulation (abstract):** clearing the Foreigner reveals *why* the killer was never caught — he is not an outsider who slips through, but a professional whose presence raises no alarm. `clue_03b` carries this as a profile, attached to no one.

**The recession's boldest move:** Edmund is **not even present** this act. While the player chases the loudest, ugliest theory across Whitechapel, the answer is three streets away at a mortuary bench, entirely forgotten.

### Threads
- **Holmes theme:** the capstone, delivered before the erased wall — *"They wiped it to keep the peace, Watson, and so confessed what they feared: not the murderer, but the mob. The hand that wrote there had nothing to do with the hand that killed. We have hunted the man London wishes to hate. But our man is not hated — he is not even noticed."*
- **Misdirection motif:** the graffiti joins the "Dear Boss" letter as a false signpost — the case is littered with noise that points away from the quiet truth.
- **Light motif / Halward family:** dormant (Edmund offstage).

### Critical path (minimum to advance)
*(Arrival at `dutfields_yard` is automatic from the Act 2 cut; opening FULL narration: the cold yard, Diemschutz, the reconstruction.)*
1. `examine yard entrance gate` → `clue_03_interrupted_ritual`; sets `examined_dutfields_yard`.
2. `go to working mens club` → `talk to pizer` → the Foreigner theory made human; Abberline on the panic and the erasure. Sets `talked_to_pizer_at_working_mens_club`.
3. `go to dutfields yard` → `go to mitre square` → `examine square walls` → `clue_04_kidney_removal`; sets `examined_mitre_square`.
4. `go to goulston street` → `examine apron fragment location` → `clue_03b_unremarked_passage`; the graffiti/Warren beat; sets `examined_goulston_street`.
5. `talk to holmes` *(at Goulston Street, before the erased wall)* → **capstone**: the Foreigner theory dismantled; the "belonged / not noticed" pointer planted. Sets `talked_to_holmes_at_goulston_street`.
→ **Gate met → advance to Act 4.** *(Closes on a character beat — Holmes at the wall. Order-independent with the talk-progression fix.)*

### Optional / texture
`examine cart_path` / `club_doorway` (Dutfield's), `club_members` / `posters` / `newspapers` (the club), `alleyways` / `police_lanterns` (Mitre Sq), `graffiti_wall` directly; a return to the mortuary (where the assistant is, flat and unremarkable). None gate progress.

### Gate to next act
`examined_dutfields_yard` **AND** `talked_to_pizer_at_working_mens_club` **AND** `examined_mitre_square` **AND** `examined_goulston_street` **AND** `talked_to_holmes_at_goulston_street` *(capstone)*.

### Transition out → Act 4
*Full closing journal — the ugly theory collapses; shame and a new unease.*
1. **Closing journal (Watson, ~16 Nov):** the double event reconstructed; Watson's discomfort at how readily the easy suspicion took root — in the city, and in himself; Holmes's rebuke at the wall; the dawning sense that the man they want is one who *belongs.* **Suspicion: the Foreigner theory collapses (Pizer cleared); the Mad Doctor still stands — but a colder thought forms.**
2. **Auto-move + cut:** Watson → **`lusk_office`** (Act 4 anchor). The journal bridges ~16 → ~17 Nov.
3. **Opening arrival (Act 4):** Lusk's office, the From Hell letter and the preserved kidney — and word that the American has fled the country.

### Persons of Interest (notebook after Act 3)
- **The Mad Doctor** *(Tumblety — still in custody; about to flee)* — **ascendant**
- **~~The Foreigner / "Leather Apron"~~** *(Pizer — alibied; the panic was prejudice)* — **cleared** *(a real public suspect, fairly dismissed)*
- **The Stranger** *(Hutchinson's man)* — **fading**
- *Insight (profile, not a person): the killer **belongs** at the scenes — no hunted outsider, but a man no one thinks to stop.*

### Why this act is interesting
It is the act with a conscience. The game hands the player the era's ugliest, easiest answer and lets them feel its gravitational pull — then forces them to look the scapegoat in the eye and hear Holmes name the suspicion for what it is. The history is rich and real (the graffiti, Warren's erasure, the two jurisdictions, a community in terror). And it contains the recession's nerviest gamble: the answer isn't even on stage. The player ends the act morally chastened, the Foreigner crossed off, the Mad Doctor still standing — and a new, correct instinct forming that they cannot yet attach to a face.

### Length
10–14 actions, ~10–14 minutes.

### Build flags (new for this act)
- **New NPC `pizer`** — `displayName: 'John Pizer'` (known as "Leather Apron"), introduced, `canonicalLocationByAct: { 3: 'working_mens_club' }`. `publicKnowledge`: bootmaker, arrested ~10 Sep, **alibied and released**, living under the shadow of the accusation; the panic was press-driven. Guilt **false**.
- **Move `goulston_street` from Act 4 → Act 3** (`act: 3`) so the graffiti/apron sit in the Foreigner act. Verify `lusk_office` (Act 4) is still reached via the Act 3→4 auto-move (it is — anchor cut, no walking required).
- **New clue `clue_03b_unremarked_passage`** at `goulston_street.apron_fragment_location` (currently an empty trigger). Carries the "belonged / unremarked" profile pointer. Update `CLUE_TRIGGERS`.
- **`graffiti_wall`** beat: Warren's erasure + the incitement as misdirection (narration; sets `examined_goulston_street`).
- **Holmes** placed at `goulston_street` for the capstone (accompanies the reconstruction).
- **Abberline** at `working_mens_club` (canonical) — the Leather Apron panic, Pizer's alibi, the erasure.
- **Act 3 gate** → the five flags above (replaces the bare `examined_working_mens_club` with `talked_to_pizer_at_working_mens_club`).
- **Edmund deliberately offstage** (canonical `whitechapel_mortuary`) — the recession's invisibility peak; do not place him at the Act 3 locations.
- **Pizer may be a *cleared* Person of Interest** — he was a genuine public suspect; this is distinct from Edmund's never-listed treatment.

---

## Act 4 — The Letter · *"The Vanishing Gentleman"*

### Overview
- **Theory:** **The Vanishing Gentleman** — a troubled barrister of good family (a Druitt-type), behaving erratically and dropping from sight. The "respectable man with a secret." It rises just as the **Mad Doctor collapses** (Tumblety flees).
- **Date/time:** 16–19 November 1888. A focused, single-location act — a deliberate rhythm change after the sprawl of Acts 2–3.
- **Location:** `lusk_office` (anchor — George Lusk's office; the From Hell letter and the preserved kidney). *Edmund is back on stage here (assisting Bond), unremarked.*
- **Dramatic purpose:** Collapse the loudest theory *ambiguously* — Tumblety's flight lets the public (and history) believe the American was the Ripper, the very misdirection the real case suffered. Turn the physical evidence (the kidney's preservation) quietly toward the mortuary-laboratory world — while the player's attention is yanked to a fresh, respectable suspect. And rehearse the ending: teach the player that **a family of standing can make a man disappear.**
- **Player goal:** Examine the letter and the kidney, absorb the collapse of the Mad Doctor, and chase the new gentleman — without noticing where the evidence actually points.

### Locations & what they hold

**`lusk_office` — George Lusk's office** *(present)* — **Act 4 anchor**
- **NPCs:**
  - **Lusk** (existing; introduced) — chairman of the Vigilance Committee; frightened, out of his depth, haunted by the parcel he received.
  - **Bond** (introduced) — examining the kidney; identifies the **preservation method** on the spot (the Edmund-pointer, framed as procedure).
  - **"Bond's assistant"** = **Edmund** *(alias; NOT introduced)* — assisting, unremarked. Back on stage after Act 3; still furniture.
  - **Abberline** (introduced) — brings the day's news: **Tumblety has fled the country**, and a fresh report — the **Vanishing Gentleman** file-lead.
  - **Holmes** — present; delivers the capstone synthesis.
- **Interactables:**
  - `from_hell_letter` → **clue_05_from_hell_letter**. The letter received by Lusk in October, sent with the kidney: crudely spelled *throughout* (a dozen errors), taunting, claiming the deed. Holmes keeps it general — *"A man barely lettered, Watson — or one who wishes us to believe it."* **No single word is singled out;** the player files away *a strange, badly-spelled letter*. (The connection is theirs to make in Act 5.) Sets `examined_lusk_office`.
  - `kidney_parcel` → **clue_05_human_kidney**. Human, female, and preserved in **laboratory spirit-of-wine at mortuary concentration.** Bond identifies it as *his own kind of practice* — "this is how a mortuary keeps a specimen." **The preservation pointer** (profile: mortuary-laboratory hands) *and* the crack that clears Tumblety (whose specimens were crude bought curios).
  - `parcel_box` → texture; the wrapping, the postmark, the awful ordinariness of the delivery.

### Clues in this act
| Clue | Trigger | Points to |
|---|---|---|
| `clue_05_from_hell_letter` | examine `from_hell_letter` | The letter as a whole — *crudely spelled throughout, taunting, claiming the kidney.* Genuine illiteracy, or a performance? A memorable texture, deliberately **not** reduced to one word; the match is the player's to find in Act 5. |
| `clue_05_human_kidney` | examine `kidney_parcel` | Preserved in mortuary-laboratory spirit-of-wine — *laboratory hands.* The preservation pointer (profile) **and** the crack that clears the Mad Doctor. |

### Suspect choreography
**The Mad Doctor collapses — ambiguously.** Tumblety jumps bail and flees. *(Historical compression, deliberate: he was bailed 16 Nov and actually fled to France ~24 Nov — just past our window. The game folds bail-and-flight into one beat; the flight itself, and the public's lasting belief that the fled American was the Ripper, are real.)* His flight *looks* like guilt, and the player may close the case in their head — exactly as the public did. But Holmes notes flight from a *gross-indecency* charge is not flight from murder, and the kidney's careful preservation is nothing like Tumblety's crude curios. The loudest theory dies, leaving a false public "solution" behind it.

**The Vanishing Gentleman rises.** With the American gone, Abberline's file offers a fresh figure: a barrister of good family, lately erratic, dismissed from his post, and now *not to be found.* The player's instinct — *it's always the respectable one with a secret* — flares.

**The quiet swing (the real movement of the act):** the kidney's preservation has pointed, unmistakably, at the **mortuary-laboratory world** — at hands that keep specimens the way Bond's do. The player has the pointer. They are looking the other way, at a vanished gentleman.

**Edmund (ambient):** in the room, assisting, as the evidence describes his exact world. Never named, never noted.

### Threads
- **Halward-family seed (delivered through the Gentleman):** the Vanishing Gentleman teaches the player a *mechanism* — *"a family of standing does not let a son hang; they make the embarrassment disappear."* Holmes or Abberline says it of the barrister. It attaches to no one — and the ending will turn it on Edmund. The extraction is rehearsed here, in plain sight, as someone else's story.
- **Misdirection motif:** Tumblety's flight becomes the era's false solution — another loud signpost pointing away from the quiet truth.
- **Holmes theme:** the capstone — *"Two men have obligingly removed themselves from our view, Watson: one fled, one vanished. The public will pick whichever it prefers. But the hand that preserved that kidney did not flee and did not vanish. It is still here, keeping its specimens, exactly as it always has."*
- **Light motif:** dormant (a faint optional beat possible; not required).

### Critical path (minimum to advance)
*(Arrival at `lusk_office` is automatic from the Act 3 cut; opening FULL narration: Lusk's fear, the letter and the parcel, Bond at work, the assistant beside him.)*
1. `examine from hell letter` → `clue_05_from_hell_letter`; the crude, badly-spelled letter *as a whole* (no single word singled out); sets `examined_lusk_office`.
2. `examine kidney parcel` → `clue_05_human_kidney`; Bond's preservation identification (the pointer + the Tumblety crack).
3. `talk to abberline` → **Tumblety has fled** (Mad Doctor collapses) **+** the Vanishing Gentleman file-lead. Sets `talked_to_abberline_at_lusk_office`.
4. `talk to holmes` → **capstone**: the synthesis — both loud men have removed themselves; the preserving hand is still here. Sets `talked_to_holmes_at_lusk_office`.
→ **Gate met → advance to Act 5.** *(Closes on a character beat — Holmes. Order-independent with the talk-progression fix.)*

### Optional / texture
`examine parcel_box`; `use kidney parcel with autopsy ledger` (if the player carries the ledger notes from Act 2 → `clue_08_preserved_kidney`, a deepening of the preservation match); `read from_hell_letter` (the full crude letter, errors and all — the matching spelling sits among the rest, unremarked). None gate progress.

### Gate to next act
`examined_lusk_office` **AND** `talked_to_abberline_at_lusk_office` **AND** `talked_to_holmes_at_lusk_office` *(capstone)*.

### Transition out → Act 5
*Full closing journal — two theories gone, a cold thread the player can't place.*
1. **Closing journal (Watson, ~19 Nov):** the relief and unease of the American's flight; the seduction of the vanished gentleman; and the kidney that will not leave Watson's mind — preserved by laboratory hands, *here, not fled.* Holmes's certainty that the answer never left. **Suspicion: the Mad Doctor collapses (fled); the Gentleman rises but thin; a cold thread — laboratory hands, constant access — that points nowhere the player is looking.**
2. **Auto-move + cut:** Watson → **`bond_office`** (Act 5 anchor). The journal bridges ~19 → ~20 Nov.
3. **Opening arrival (Act 5):** Bond's office and his forensic records — where the quiet thread finally resolves, and the assistant's note is waiting.

### Persons of Interest (notebook after Act 4)
- **~~The Mad Doctor~~** *(Tumblety — fled the country; the public's chosen culprit — but the preservation does not match)* — **fled; Holmes unconvinced**
- **The Vanishing Gentleman** *(a barrister of good family; erratic, dismissed, not to be found)* — **ascendant**
- **~~The Foreigner~~** *(Pizer — cleared, Act 3)*
- **The Stranger** *(Hutchinson's man)* — **faded**
- *Insight (profile, not a person): laboratory hands; constant access; a man who never left.*

### Why this act is interesting
It is the great misdirection's payoff and renewal in one stroke. The loudest suspect collapses — but *ambiguously*, so the player tastes the false closure history actually swallowed (the fled American "must" have been him). Before that relief can settle, a new respectable suspect appears and pulls the eye. And underneath both, the physical evidence makes its quietest, truest move: the kidney's preservation names the killer's *world* without naming the man. The act even rehearses its own ending — teaching the player, via the gentleman, that wealth makes men vanish — so that when it happens to Edmund, it will feel inevitable rather than arbitrary. The player leaves with two suspects gone, one rising, and the right answer sitting in their notebook as a profile they cannot yet attach to the assistant who stood beside them the whole time.

### Length
6–9 actions, ~7–10 minutes. *A focused single-location act — the pivot.*

### Build flags (new for this act)
- **Canonical-location updates** (because `goulston_street` moved to Act 3): set **Holmes** and **Abberline** act-4 location to `lusk_office` (were `goulston_street`). Bond and Edmund are already `lusk_office` in Act 4.
- **The Vanishing Gentleman** is a **file-lead via Abberline**, *not* a talkable NPC (he is, by design, never met — he vanishes). Deliver as Abberline dialogue + an investigation document at `lusk_office`.
- **New `SUSPECT_PROFILE`** for the Gentleman (`isGuilty: false`, with a tailored `wrongDeductionNote`) so a player can name him at the end and get a proper cold-case rebuttal.
- **Tumblety-flight news** beat via Abberline (Tumblety NPC is already absent from Act 4+ per the Act 2 flags).
- **`kidney_parcel` examine** must carry the **preservation pointer** prominently (Bond identifies mortuary-laboratory spirit-of-wine concentration) — the act's key triangulation.
- **`from_hell_letter`**: present the letter as a *whole* — crudely spelled throughout (a dozen errors), taunting. **Do NOT single out "prasarved"** or any one word in Act 4; spotlighting it pre-empts the player's Act 5 discovery. The literal text (`DOCUMENT_TEXT`) already carries all the errors equally — let them sit. The match is **player-discovered in Act 5** (the same crude spelling/hand jarring inside a clinical forensic note) — see `clue_06` and the `USE forensic_note WITH from_hell_letter` path.
- **Halward-extraction seed** delivered *through the Gentleman* ("a family of standing makes its embarrassments disappear") — attached to no one; the ending turns it on Edmund.
- **Act 4 gate** → `examined_lusk_office` + `talked_to_abberline_at_lusk_office` + `talked_to_holmes_at_lusk_office`.
- **Optional `USE` combo** `kidney_parcel` + `autopsy_ledger` → `clue_08_preserved_kidney` (already in `USE_COMBINATIONS`) as a deepening path.

---

## Act 5 — The Suspicion · *"The Quiet Man"*

### Overview
- **Theory:** none rises — the loud men are gone. The quiet thread converges, but the **decisive connection is made at Baker Street**, where the hunt began — *not* in Bond's office. The recession pays off in the sanctuary, cold and self-made.
- **Date/time:** 19–22 November 1888. Two locations: `bond_office` (the gather) → `baker_street` (the convergence — the bookend).
- **Locations:** `bond_office` (anchor — collect the forensic note and records; Edmund present, ordinary — the player's *unknowing last sight of him*) → `baker_street` (the climax — the documents laid against the casefiles; the realization).
- **Dramatic purpose:** Separate the **gathering** (mundane, standing beside the unsuspected killer) from the **realization** (at Holmes's desk, the documents overlaid) — so the discovery is the player's, made cold, where the hunt began. And spring the family's trap: the instant of certainty triggers the rush — and he is already gone.
- **Player goal:** Collect the last evidence, carry it home, and there see the man who was beside you the whole time.

### Locations & what they hold

**`bond_office` — Dr. Bond's forensic office** *(present)* — **Act 5 anchor (the gather)**
- **NPCs:** **Bond**, **Abberline**, **Holmes**; and **"Bond's assistant"** = **Edmund** *(alias — named here, but not yet known as the killer)*. He is present, composed, ordinary — and lets Watson take a copy of the very document that will damn him without a flicker. *This is their last sight of him as a free, unaccused man — and they do not know it.*
- **Interactables:**
  - `edmund_forensic_note` → obtains the **Assistant's Forensic Note (copy)** to inventory and reveals the name **Edmund Halward** (`npc_introduced_edmund`). The hand is precise, professional — with an odd crudeness to the spelling, *noted but not connected.* **No `clue_06` here** (planted whole; the match waits for Baker Street). Sets `examined_bond_office`.
  - `medical_reports` → **clue_07_edmunds_presence** — the assistant attended and transcribed *every* post-mortem; constant access.
  - `anatomical_texts` → **clue_09_medical_background** — self-taught from the very reports he handled.
  - `specimen_jars` → texture: the laboratory preservation the Lusk kidney bore.

**`baker_street` — 221B** *(present; the sanctuary — the bookend)* — **the convergence**
- **NPC:** **Holmes** — at his desk, on home ground, where he thinks best.
- The climax: with the **letter transcript** (gathered Act 4), the **forensic note copy** (just gathered), and the **casefiles wall** (the campaign and the assistant's presence at every scene), Holmes and Watson lay the evidence together — and it resolves.
  - `use forensic note with from hell letter` → **clue_06** *(THE MATCH — the major clue, discovered here)*: the letter's crude hand **is** the assistant's hand. **The player's own connection**, made cold, at home.
  - `case_files_wall` *(re-examined, new eyes)* → every scene, the assistant present; the wall the hunt began at now names its quarry: **Edmund Halward.**

### Clues in this act
| Clue | Trigger | Points to |
|---|---|---|
| `clue_07_edmunds_presence` | examine `medical_reports` (bond_office) | Present at and transcriber of **every** post-mortem — constant access. |
| `clue_09_medical_background` | examine `anatomical_texts` (bond_office) | Self-taught anatomy from the reports he handled. |
| `clue_06` *(smoking gun)* | the document convergence at **`baker_street`** | The letter's hand **is** the assistant's hand; with the casefiles, it is **Edmund Halward.** The player makes the link, at home. |

### Suspect choreography
- **At `bond_office` (the gather):** the player collects the note and records while standing beside Edmund, who gives no sign. The recession holds — he is still just the assistant; the *name* drops (Edmund Halward), but not the guilt.
- **At `baker_street` (the convergence):** the discovery is the player's, made at home, cold, against the wall where it all began. *He was there every time, and you never looked.* The smoking gun is a connection the player draws, not a line Holmes hands over.
- The **naming** of Edmund (the deduction) is the act's climax *and* its advance — see critical path.

### Threads
- **Recession payoff (the cruelest beat):** their last encounter with Edmund is utterly mundane — and they do not know it is the last. The understanding arrives too late to act in time.
- **The bookend:** the hunt began at the casefiles wall (Prologue) and is *named* there (Act 5). Baker Street, the sanctuary, holds both the question and the answer.
- **Halward family:** the name surfaces — and with it the dawning that a respectable family will fight; unknown to Watson, it is *already moving.* (The extraction mechanism rehearsed via the Gentleman in Act 4 now attaches to Edmund — the Act 6 rug-pull.)
- **Holmes theme (the key plant):** *"To know a thing and to prove it are not the same act, Watson."* The rush about to follow will prove a third thing: knowing is not *stopping.*

### Critical path (minimum to advance)
*(Arrival at `bond_office` is automatic from the Act 4 cut; opening FULL narration: the converged cast, Bond's records, the assistant at his bench.)*
1. `examine medical reports` → `clue_07_edmunds_presence`; sets `examined_bond_office`.
2. `examine anatomical texts` → `clue_09_medical_background`.
3. `examine edmund forensic note` → obtains the copy; **name reveal (Edmund Halward)** (`npc_introduced_edmund`); the odd hand noted, *not connected.* (No `clue_06`.)
4. `go to baker street` → the sanctuary; Holmes at his desk.
5. `use forensic note with from hell letter` → **`clue_06`** — the match — *the realization.* (Re-examining `case_files_wall` reinforces it.)
6. `deduce Edmund Halward` → correct (holds `clue_06`) → `asylum_unlocked` → **advance to Act 6.**
→ The climax is the naming, at home. *(Order-bound: `clue_06` must precede the deduction; the deduction cannot succeed until the Baker Street convergence.)*

### Optional / texture
`examine specimen_jars`; `read` either document; talk to Bond or Abberline at the office (the difficulty of touching a respectable name); re-examine the casefiles at home. None gate progress.

### Gate / advance
The **correct deduction of Edmund** — which requires `clue_06`, obtainable only via the Baker Street convergence — sets `asylum_unlocked` and advances to Act 6. *(There is no bare-examine gate; the naming is the advance, and it cannot fire before the convergence.)*

### Transition out → Act 6
*The realization triggers the rush — and the trap springs.*
1. **Closing beat (the naming):** Holmes names him; they seize their coats. **No long journal here** — the urgency forbids it; the reflection comes after the asylum.
2. **Auto-move + cut:** Watson → **`bond_office`** (Act 6 anchor) — the rush to take him.
3. **Opening (Act 6):** they burst in to arrest Edmund — and he is **gone.** Taken at dawn by his family's arrangement, committed to a private asylum. Certainty achieved; the quarry already spirited away. *(Full structure in Act 6.)*

### Persons of Interest (notebook after Act 5)
- **Edmund Halward** *(the assistant — present at every scene; self-taught anatomy; laboratory hands; the hand of the letter)* — **the answer, named and proven** *(listed only now, at the convergence)*
- **~~The Vanishing Gentleman~~** / **~~The Mad Doctor~~** / **~~The Foreigner~~** / **~~The Stranger~~** — all fallen away
- *Holmes's note: certainty is not proof; proof is not justice.*

### Why this act is interesting
The restructure makes the discovery **cold and self-made.** The player gathers the damning document from the killer's own hand without knowing it, carries it home, and only at Holmes's desk — against the wall where the hunt began — does the truth resolve. The bookend lands; the recession pays off as the player's own oversight; and the instant of triumph becomes the instant of loss, because the family has already moved. The act earns the ending's thesis in the flesh: *knowing was never stopping.*

### Length
6–9 actions (two locations), ~8–11 minutes. The emotional peak.

### Build flags (new for this act)
- **🔴 CRITICAL — rework `ACT_PROGRESSION[5]`.** It currently reads `['examined_bond_office']`, which would auto-advance to Act 6 the instant the player examines *anything* during the gather — cutting to "he's gone" **while Edmund is still in the room**, before the Baker Street convergence and the deduction. **Remove the bare-examine gate; the Act 5→6 advance is the correct deduction** (`asylum_unlocked` / `successAct = 6`). A correct deduction is impossible before the convergence (no `clue_06`), which enforces the path.
- **MOVE `clue_06`'s trigger** off `bond_office.edmund_forensic_note` and **location-lock it to `baker_street`.** The convergence fires only at home — via a second-stage `case_files_wall` examine (or a `USE forensic_note WITH from_hell_letter` that is gated to `baker_street`) while both documents are held. **Note:** the existing `USE_COMBINATIONS` entry is *not* location-locked — gate it to `baker_street` so a player can't trigger the match early at the office and skip the bookend. At `bond_office`, examining the note gives the **copy + name + the *unconnected* odd hand** — never `clue_06`.
- Examining `edmund_forensic_note` still fires **`npc_introduced_edmund`** (name reveal) at `bond_office`.
- Ensure the **letter transcript** is auto-collected in Act 4 and the **forensic note copy** in Act 5 (both via the existing takeable-on-examine behaviour) — both are required for the convergence.
- **Holmes at `baker_street`** for the convergence — no placement change needed (`follows_watson` brings him home with Watson; see header). Just ensure the auto-move/travel carries him.
- **Act 6 anchor = `bond_office`** ("he's gone"); the Act 5→6 cut moves there. Edmund is **absent** from `bond_office` in Act 6 (committed to the asylum) and present at `private_asylum`.
- Update the QA winning-path test for the new convergence location of `clue_06` (Baker Street, not bond_office).

---

## Act 6 — The Confrontation

### Overview
- **Theory:** none — the answer is known and named. This is the reckoning: the rush, the asylum, and the discovery that *catching him was never the same as stopping him.*
- **Date/time:** ~22 November 1888 (the rush and the asylum). The Coda then jumps to **spring 1891.**
- **Locations:** `bond_office` (anchor — "he's gone") → `private_asylum` (the confrontation and the extraction reveal).
- **Reached only by the correct deduction** (Act 5). A *wrong* deduction ended the game at Baker Street as a cold case — see "The two endings."
- **Dramatic purpose:** Convert certainty into powerlessness. The family has already moved; the law cannot touch a respectable name committed to a private asylum; the monster is calm, protected, and — soon — gone. Earn the ending's thesis in full: *to know a thing and to mend it are not the same act.*
- **Player goal:** Confront the man you have named, and learn what your certainty is worth.

### Locations & what they hold

**`bond_office` — the rush** *(present)* — **Act 6 anchor**
- **Arrival (FULL narration):** Watson and Holmes burst in to take Edmund — and he is **gone.** Taken at dawn. **Bond**, ashen, explains: the family came with a private physician, had the young man declared of unsound mind, and committed him to a private asylum *before any charge could be laid.* The speed; the money; the quiet foreclosure of justice.
- **NPC:** **Bond** — devastated. The man he vouched for; the man at his elbow for years. His horror and self-reproach is the act's first character beat. *(strongly-encouraged talk.)*
- **Edmund:** absent (committed).

**`private_asylum` — the confrontation** *(present)*
- **NPCs:** **Edmund** (committed; serene), the **superintendent**, **Holmes**, **Abberline**.
- `talk to edmund` → **THE CONFRONTATION.** He stands at the window and describes Miller's Court — the quality of lamplight through a small window at a particular hour of the morning — *as an aesthete describes a painting.* When Holmes asks how he knows what the light was at that hour, Edmund pauses for exactly one breath: **"I have always had an eye for light."** He returns to his chair. No distress, no denial. The non-confession that confirms everything. Sets `talked_to_edmund_at_private_asylum`. *(Use the existing Edmund asylum scripted line.)*
- `examine patient_records` → **clue_10_asylum_commitment.** The admission notes — and the family's arrangement: a transfer to a private institution *abroad*, imminent. The committal is a courtesy, not a confinement. **The extraction, in writing.** Sets `visited_private_asylum`.
- `examine edmund_room_furnishings` → texture: the comfortable room; he is a guest, not a prisoner.

### Clues in this act
| Clue | Trigger | Reveals |
|---|---|---|
| `clue_10_asylum_commitment` | examine `patient_records` | The family's arrangement — a transfer abroad, imminent; the committal as protection. The extraction, documented. |
*(The confrontation itself is dialogue — the "eye for light" beat — not a clue.)*

### The reckoning (the heart of the act)
There is no chase and no arrest — only a closed door. Edmund is *calm*: not a raving madman but a serene young man in a comfortable room, soon to be moved beyond reach. Holmes's fury is cold and exact — the rage of a craftsman whose faultless work has been made worthless by money and a name, **not** the wounded pride of a man outwitted (this is no Irene Adler; Edmund did not beat Holmes — *circumstance* did). The player, who named the killer correctly, is made to feel that being right has bought them nothing. Justice and detection have come apart in their hands.

### Critical path (minimum to advance)
*(Arrival at `bond_office` is automatic from the Act 5 deduction; opening FULL narration: "he's gone.")*
1. *(strongly encouraged)* `talk to bond` → his devastation and the dawn committal.
2. `go to private asylum` → the asylum (now unlocked by the correct deduction).
3. `talk to edmund` → **the confrontation** — "an eye for light." Sets `talked_to_edmund_at_private_asylum`.
4. `examine patient records` → `clue_10_asylum_commitment`; the extraction reveal. Sets `visited_private_asylum`.
→ **Both flags set → the ending sequence fires (see Coda).**

### Gate / the ending trigger
The ending fires when **`visited_private_asylum` AND `talked_to_edmund_at_private_asylum`** are both set — the player has both confronted Edmund and uncovered the extraction. *(Engine: add `talked_to_edmund_at_private_asylum` to the act-6 `requireFlags` so the confrontation cannot be skipped; relies on the talk-progression fix.)*

### The two endings
- **Correct deduction (named Edmund):** this act + the **Coda** — the truth, and its cost.
- **Wrong deduction (named anyone else):** the game already ended at Baker Street in Act 5 as a **cold case** — Holmes's tailored rebuttal and Watson's ~150-word diary epilogue (existing `wrongDeductionNote` behaviour). No asylum, no letter; the murders go unsolved and the diary closes. **The Coda is reserved for those who earned the truth.**

### Threads (payoffs)
- **Extraction:** the Act 4 "a family of standing makes its embarrassments disappear" mechanism, rehearsed via the Gentleman, lands on Edmund in full — class and money protect the monster.
- **Light motif:** "an eye for light" gathers the burned clothing (Act 1), the aesthete's calm here, and the East River light of the Coda into one signature.
- **Holmes theme:** certainty achieved, justice foreclosed — *knowing is not mending.*
- **The bookend** completes in the Coda, at Baker Street.

### Why this act is interesting
The reckoning refuses the catharsis of capture. The player did everything right — saw what no one saw, named the unremarkable man — and arrives to a comfortable room and a calm young man who will be gone by month's end. The horror is not violence but *impotence*: a closed door, a respectable name, a family faster than the law. It is the most honest ending a case history never solved can have — and it sets the Coda's knife.

### Length
4–6 actions, ~6–9 minutes (plus the Coda).

### Build flags (new for this act)
- **Reached only via the correct Edmund deduction** (`asylum_unlocked`). Wrong deductions end at Act 5 (cold case).
- **Act 6 gate:** `visited_private_asylum` + `talked_to_edmund_at_private_asylum` (add the talk flag so the confrontation can't be skipped; relies on the talk-progression fix).
- **`bond_office` in Act 6:** Edmund **absent**; Bond present and devastated; the arrival narration carries the "he's gone" shock unmissably.
- **Edmund asylum scripted line** (the "eye for light" beat) is the confrontation centerpiece — use/adapt the existing line; keep it serene, no distress.
- **The ending sequence** (powerlessness → time-jump → coda) is a **scripted set-piece** (see Coda) — *not* free AI generation.

---

## Coda — The Letter *(spring 1891)*

*A scripted set-piece, triggered by the Act 6 ending gate. **Correct-deduction path only.** The letter is authored verbatim; this is the one beat that must not be left to free AI generation.*

### The ending sequence

1. **The powerlessness (Nov 1888).** There is no proof that will hold against a respectable family; the committal forecloses a trial; the murders have stopped (Kelly was the last); the public will pin it on the fled American or a foreign madman. Watson and Holmes are left with the truth and no power to use it.

2. **Time jump → spring 1891.** Watson, writing in retrospect, brings the reader forward. A quiet morning at Baker Street.

3. **The letter arrives.** Postmarked New York. No return address. The hand is clinical and precise. Watson reads it aloud. *(Verbatim — authored, not generated:)*

   > *Dr Watson —*
   >
   > *I had thought, when your friend stood before me in that quiet room and named me, that something in me would give way. It did not. I have come to understand that nothing in me is built to break.*
   >
   > *America suits me. I passed some months in New York — there is a hotel by the East River where the rooms are let by the night and no one asks after anyone who climbs the stair. The light there, off the water, at the turning of the morning, was the finest I have seen. I think often of the woman who showed it to me.*
   >
   > *They tell me Chicago is to raise a great Exposition on the lake — a White City out of nothing, with hotels enough for all the world. I find I am very much looking forward to it.*
   >
   > *Remember me to the gentleman with the sharp eyes. Tell him he was right. Tell him it changed nothing.*
   >
   > *— E. H.*

4. **Holmes's reaction (realist fury, not defeat).** He hears it through without a word. Then, at last: *"He is right. It changed nothing."* And, quietly: *"To know a thing and to mend it are not the same act, Watson. I have spent my life pretending otherwise."* He sets the letter aside — and keeps it; a cold fact, filed.

5. **The Reichenbach shadow.** Three weeks later Holmes is gone to the Continent, and the business of Professor Moriarty is upon them. The Ripper-that-got-away is the last unfinished weight he carries to the Falls.

6. **The frame closes.** Watson: *"I did not let myself think of Edmund Halward again for a very long time. I think of him now."* The diary the player has read **is** his confession — the only one he could ever make. Watson is stunned into silence; the player is left holding the same knowledge, and the same impotence.

7. **Game over — the true ending.**

### What the letter does (design notes)
- **Confirms Edmund** for the player who solved it: "that quiet room" = the asylum confrontation; "the gentleman with the sharp eyes" = Holmes. The satisfaction of *being right* and the horror of *it not mattering* land in the same paragraph.
- **Links him to the real Carrie Brown murder** (East River Hotel, Manhattan, April 1891 — a killing the New York press really did blame on the Ripper): *"the woman who showed it to me."* Stated as serenity, never as confession.
- **Hints at Chicago and the World's Fair** (1893) — the H. H. Holmes / World's Fair Hotel dread — **entirely unstated.** Watson in 1891 cannot know what Chicago will become; only the historically-literate player feels the floor drop.
- **No spelling tell reused.** What proves it is the *voice* — the eye for light, the serenity, the knowledge of the asylum scene.
- **Serene and oblique** — never says "I killed"; leaves no doubt. The calm is what stuns Watson.

### Build flags (Coda)
- **Scripted set-piece.** The letter is authored **verbatim** (above). Holmes's reaction and Watson's frame-close are authored or tightly constrained — do not hand the ending to free generation.
- **Correct-deduction path only.** Reached solely via the Act 6 ending gate. Cold-case (wrong) endings end at Act 5 and never see this.
- **Timeline:** spring 1891, weeks before "The Final Problem." Carrie Brown = April 1891; the Chicago Exposition = 1893 (future from the letter's standpoint); Reichenbach = May 1891. Historically coherent — verify the surrounding prose against the `historian` skill (the standing process).
- **Frame:** ensure the closing line (*"I think of him now"*) is the final beat — it recontextualises the whole diary as Watson's confession.
