# London Bleeds — Phase 1 Reweave Spec

*Status: design-locked, ready to build. Phase 2 (World Expansion) is scoped separately at the end.*

---

## Context

The current game has three suspects (Edmund guilty; Bond and Abberline as red herrings) and seven NPCs. With a cast this small, and with Edmund spotlighted by scripted dramatic-irony lines, an attentive player identifies the killer almost immediately. The QA difficulty pass confirmed it: red-herring differentiation is weak, and the solution can feel unearned.

This reweave keeps **Edmund as the definitive answer** (the solve should satisfy) but **buries him in a crowd of louder, historically real suspects** so that arriving at him requires genuine deduction. The design thesis:

> **You are hunting a monster. Monsters look like clerks.**

The player chases the lurid suspects history actually chased — the mad American doctor, the foreign scapegoat, the vanishing gentleman — and only at the end realises the answer was the man taking notes in the corner the entire time. This is also the historical truth of the Ripper: never caught because he was unremarkable.

The reweave is **largely additive** — it reuses existing locations and gates, adding new NPCs, clue chains, and a calendar restructure rather than rebuilding the map.

---

## Scope boundary (Phase 1 vs Phase 2)

**Phase 1 (this spec):** the suspect choreography, new suspect/witness NPCs, the two-week calendar, the clue chains that triangulate Edmund, notebook/journal tracking, Edmund's recession, and the locked ending. Plus the one new load-bearing location the mystery requires (**London Hospital**) and new scenes in existing rooms.

**Phase 2 (deferred):** exploration locations (doss house, Toynbee Hall, docks/opium den, music hall, newspaper office) and the richer interaction verbs (WAIT / NPC schedules, ASK-ABOUT topic dialogue, optional environmental clues). Phase 1 makes the mystery *work*; Phase 2 makes the world *breathe*.

---

## The governing mechanic: the moving spotlight

Each act foregrounds one loud suspect theory that **rises** (the player can build a case via motive/means/opportunity) and **falls** (exculpatory evidence eliminates them). Crucially — **every elimination's exculpatory evidence is simultaneously a pointer toward Edmund.** Clearing the wrong man doesn't reset the board; it triangulates the right one. The player has every piece; they keep staring at the loud men.

Edmund is the one suspect with **no loud evidence to build on**. His alibi is invisibility ("he was with Dr. Bond" — true every time). If the player tries to accuse him early, Holmes refuses: *"On what grounds, Watson? We do not hang men for being forgettable."* The quiet forensic thread that actually convicts him does not resolve until Act 5.

---

## Calendar restructure (two-week November window)

The "present" investigation expands from a tight 3-day window to **~9–22 November 1888**, letting the real suspects appear live and in historical order.

| Act | Dates 1888 | Location cluster | Loud theory | Real event landing here |
|---|---|---|---|---|
| 0 | eve. 8 Nov | Baker Street | — | Warren resigns (8 Nov); Kelly murdered overnight |
| 1 | 9–11 Nov | Miller's Court | **The Stranger** | Hutchinson's statement (12 Nov) |
| 2 | 11–13 Nov | Mortuary, police station, London Hospital | **The Mad Doctor** | Tumblety in custody (arrested 7 Nov) |
| 3 | 13–16 Nov | Berner St, Mitre Sq, Goulston St | **The Foreigner** | Leather Apron panic; graffiti erasure |
| 4 | 16–19 Nov | Lusk's office | **The Vanishing Gentleman** | Tumblety jumps bail & flees (~16 Nov) |
| 5 | 19–22 Nov | Bond's office | **The Quiet Man** | (recession complete) |
| 6 | ~22 Nov | Private asylum | — | The confrontation |
| Coda | Spring 1891 | Baker Street | — | The letter (weeks before Reichenbach) |

**Implementation:** update `ACT_TIME_CONFIG` in `acts.ts` with the new dates. Act names may stay or gain a theory subtitle (e.g. `1: 'The Last Murder'` → carries "The Stranger"). Existing act gate flags (`examined_*`) can remain largely intact; the reweave layers suspect content on top.

---

## Suspect roster & lifecycles

The headline design: **each red herring's exoneration hands a fragment to Edmund.**

### Loud suspects (new)

**Francis Tumblety — "The Mad Doctor"** *(Act 2 peak; flees Act 4)*
- *Historically:* American quack, arrested 7 Nov 1888 on gross-indecency charges, collected anatomical specimens including uteri, virulent misogynist, jumped bail ~16 Nov and fled to France then the USA. A genuine, documented Ripper suspect.
- *Rises:* specimen collection (uteri match the organ removals), misogyny, medical knowledge, in custody as a real suspect.
- *Falls:* his specimens are purchased curios crudely preserved; his "anatomy" is a showman's, not a practitioner's; he flees a *gross-indecency* charge, not murder.
- **→ Edmund pointer:** the Lusk kidney was preserved in laboratory spirit-of-wine at *mortuary concentration* — not a quack's method. *Who prepares specimens that way? The man who preps Dr. Bond's.*

**John Pizer / "Leather Apron" — "The Foreigner"** *(Act 3)*
- *Historically:* Jewish bootmaker, arrested 10 Sep 1888, alibied and released; the "Leather Apron" panic was largely press-manufactured.
- *Rises:* local, leather-working knife, a menacing reputation, the anti-Semitic panic, the Goulston Street graffiti.
- *Falls:* solid alibi (lodging-house witnesses); the graffiti was incitement Warren erased to prevent a pogrom; the panic was manufactured.
- **→ Edmund pointer:** the killer moves through every scene *unremarked* not because he's a hidden outsider but because he *belongs* there — a professional whose presence raises no eyebrow. Holmes names the prejudice plainly: *deduction, not a scapegoat.*

**George Hutchinson — "The Witness Who Might Be a Suspect"** *(Act 1)*
- *Historically:* gave an extraordinarily detailed statement (12 Nov) describing a prosperous man with Kelly — suspiciously precise.
- *Rises:* the too-detailed statement; admits loitering outside Miller's Court that night; came forward late.
- *Falls:* his detail checks out against other sightings; no medical connection; he loitered because he knew Kelly and hoped she'd shelter him — a lonely, sad man.
- **→ Edmund pointer:** establishes the witness/suspect duality and primes the player to scrutinise *everyone* — making the failure to scrutinise the assistant the cruelest oversight.

**The Vanishing Gentleman (Druitt-type) — "The Respectable One"** *(Act 4 loose end)*
- *Historically:* Montague Druitt, barrister/schoolmaster, dismissed from his post for unspecified "serious trouble," drowned in the Thames early Dec 1888; named by Macnaghten. Treated here as a **referenced file-lead / minor NPC**, not a full on-screen character (his disappearance falls just after the game window).
- *Rises:* troubled barrister of good family, erratic, about to vanish — the respectable-man-with-a-secret archetype.
- *Falls:* timing doesn't fit the murders; his "trouble" was personal scandal; a tragic suicide.
- **→ Edmund pointer:** flatters then punishes the "it's always the respectable one" instinct — and the *respectable* tell quietly transfers to a different well-bred young man no one is looking at: the physician's son.

### Supporting (new)

**Dr. George Bagster Phillips** *(Act 2)* — H-Division police surgeon. Disagrees with Bond about the killer's skill (a real historical dispute). Dismantles the "only a trained surgeon could do this" assumption.
- **→ Edmund pointer:** practical, *self-taught* anatomy — the knowledge of a man who has transcribed hundreds of post-mortems without ever holding a qualification.

### Existing herrings (retained)

**Dr. Thomas Bond** — cleared by his documented dinner alibi on the double-event night (already in data).
**Inspector Abberline** — cleared by his ruinous sincerity (already in data).

### Referenced, not full NPCs

Sir Charles Warren (resignation, graffiti erasure), Aaron Kosminski (quiet background figure the police have "looked at" — *not* named as a live suspect, since his naming is post-1888), Israel Schwartz & Joseph Lawende (contradictory witness testimony as document objects).

### The Quiet Man

**Edmund Halward** — no loud evidence; the alibi of invisibility. His convicting thread resolves only at Act 5: preservation knowledge, the *prasarved* spelling, presence at every scene, self-taught anatomy, and the eye for light. Every loud elimination above triangulates him.

---

## New & changed NPCs

Add to `engine/stories/whitechapel-1888/npcs.ts` (follow the existing `NPCDefinition` shape: `displayName`, `alias`/`aliasDescription`, `requiresIntroduction`, `role`, `description`, `speakingStyle`, `personality`, `publicKnowledge`, `followingRule`, `canonicalLocationByAct`). Add display names/aliases to the relevant maps and `constants.ts` `INITIAL_NPC_STATES`.

| NPC id | Introduced? | Canonical home (by act) | Notes |
|---|---|---|---|
| `tumblety` | known by reputation | police custody (`h_division_station` holding scene), Acts 2–3; absent (fled) Acts 4+ | Loud herring. `publicKnowledge` must stay within documented facts; his guilt is false. |
| `phillips` | known | `whitechapel_mortuary` / `london_hospital`, Acts 2–3 | Second medical voice; disputes Bond. |
| `pizer` | alias "Leather Apron" until cleared | Jewish quarter / lodging context off `dorset_street`, Act 3 | Foreigner herring; exonerated. |
| `hutchinson` | known | `whitechapel_pub` (Ten Bells), Acts 1–2 | Witness/suspect duality. |

**Edmund's existing `scriptedLines` get rewritten** to be rarer and more ambiguous — sinister only on a second playthrough (see "Edmund's recession" below).

---

## New & changed locations

Edit `engine/stories/whitechapel-1888/locations.ts`.

- **`london_hospital`** *(new, load-bearing)* — Whitechapel Road. Stages the Phillips/Bond skill dispute and dilutes "only a surgeon could do this" (anatomical knowledge is common among students). Reachable from `dorset_street` or `whitechapel_pub`. Act 2+.
- **`h_division_station`** — add a **holding-cell scene/interactable** for the Tumblety interrogation (Act 2).
- **`whitechapel_pub` (Ten Bells)** — add Hutchinson and witness-texture content (Act 1–2).
- Existing crime-site locations gain **new interactables** for the suspect clue chains (below).

---

## Clue chains

Edit `engine/stories/whitechapel-1888/clues.ts` (`CLUE_DEFINITIONS`, `CLUE_TRIGGERS`, and the `SHOW_INTERACTIONS` / `USE_COMBINATIONS` maps already added). Each loud suspect needs **incriminating** clue(s) and **exculpatory** clue(s); each exculpatory clue's `holmesDeduction` should carry the **Edmund pointer**.

Representative pattern (one per suspect):

| Suspect | Incriminating clue (where) | Exculpatory clue (where) | Edmund pointer embedded |
|---|---|---|---|
| Tumblety | specimen collection / arrest record (police station) | preservation-method mismatch (Lusk kidney vs his crude curios) | "mortuary-concentration spirit-of-wine — who preps Bond's specimens?" |
| Pizer | Leather Apron reputation + graffiti (Goulston St) | lodging-house alibi (Act 3) | "the killer belongs at the scenes — a professional, unremarked" |
| Hutchinson | over-detailed statement + loitering (Ten Bells) | corroboration + no medical link | "witness and suspect blur — scrutinise everyone" |
| Gentleman | troubled-barrister file-lead (police records) | timing mismatch / personal scandal | "the respectable tell — a physician's son" |
| "only a surgeon" | — | Phillips/Bond dispute (London Hospital / mortuary) | "self-taught anatomy from transcribing post-mortems" |

The existing `clue_06_prasarved_spelling` remains the **smoking gun** required for the correct Edmund deduction (already enforced in `resolveDeduce`). The reweave adds the *triangulating* clues that make reaching it feel earned.

Use the **SHOW/USE mechanics** for theory-testing: `show preservation notes to Phillips`, `show witness sketch to Hutchinson`, etc. Each is a build-a-theory → test-it → watch-it-collapse loop.

---

## Deduction system changes

Edit `engine/stories/whitechapel-1888/suspects.ts` and `engine/GameEngine.ts` (`resolveDeduce`).

- **Expand `SUSPECT_PROFILES`** with `tumblety`, `pizer`, `hutchinson`, and the `gentleman` as `isGuilty: false`, each with a tailored `wrongDeductionNote` (sombre cold-case rebuttal, matching the existing Bond/Abberline pattern).
- **Retain** Edmund as `isGuilty: true` and the `clue_06` smoking-gun requirement.
- **Early-accusation gate:** if the player names Edmund before the Act 5 forensic convergence (i.e. without `clue_06` and the triangulating clues), Holmes refuses with the "we do not hang men for being forgettable" beat — already partially implemented via the smoking-gun block; extend the blocked-reason copy.

---

## Edmund's recession (the craft)

- Rewrite `edmund.scriptedLines` to be **rarer and more ambiguous** — each line innocent on first read, damning only in retrospect.
- **Alibi of invisibility:** examining/talking to Edmund yields flat, helpful, profile-less responses; his whereabouts are always "with Dr. Bond."
- **Holmes's refusal** gate (above) makes the game almost *dare* the player to dismiss him.

---

## Threads to seed

- **The Halward family** (respectability + means) — seed in Acts 2 and 4 (a passing note that the assistant is a physician's son, well-bred, "above suspicion"). Sets up the end-game extraction so it is *paid off, not sprung*.
- **The light motif** — Edmund's signature. Act 1 (burned clothing, exists) → Act 2 (a quiet remark on how light falls on tissue) → Act 6 ("I have always had an eye for light") → Coda (light off the East River). Thread one small light/seeing beat per Edmund scene.
- **Holmes's theme** — brilliant and confident through the middle, so the ending's powerlessness lands. Plant one mid-game line: *"To catch a man and to prove it are not the same act."* The coda collects on it.

---

## The ending (locked)

**Act 6 — Confrontation → apparent justice.** Deduce Edmund (satisfying solve) → he is committed to a *private* asylum.

**The rug-pull.** The respectable Halward family quietly extracts him abroad before the truth can surface; the asylum cell was always a courtesy, never a confinement. **Theme: class and money protect the monster.** Watson — honest, correct in every deduction — is powerless against a family with the means to make their son vanish.

**The coda — one letter.** Spring 1891, **weeks before Holmes leaves for Reichenbach**, postmarked **New York**. Reserved **only for players who correctly deduced Edmund** (cold-case endings keep their existing sombre diary entries — no letter).

- *Register:* serene and oblique — never says "I killed"; leaves no doubt.
- *Content:* references the **East River Hotel** ("the woman who showed it to me" — the real Carrie Brown murder, April 1891, which the press blamed on the Ripper); hints at travelling to **Chicago for the World's Fair** — the H.H. Holmes / World's Fair Hotel dread, left **entirely unstated** (Watson in 1891 cannot know what Chicago will become; only the historically-literate player feels it).
- *No spelling tell reused.* What proves it is the **voice** — the eye for light, the serenity, the fact that he knows exactly who unmasked him.
- *Addressed to Holmes via Watson:* "Tell him he was right. Tell him it changed nothing."

**Holmes's reaction.** Cold realist fury — the craftsman whose faultless work was made worthless by forces outside the craft. *Not* the wounded pride of Irene Adler; this time the killer escaped through circumstance, not a contest of wits. His line: *"To know a thing and to mend it are not the same act."* Holmes **keeps** the letter — a cold fact, filed. Three weeks later he is gone to the Continent; the Ripper-that-got-away becomes the last unfinished weight he carries to the Falls.

**The frame closes.** The player does not act on the letter — it concludes the game. Watson is stunned into silence, and we understand the diary the player just read **is** his only confession. Final line: *"I think of him now."*

**Implementation:**
- `acts.ts` / engine: the asylum-commitment beat, then the extraction state.
- `services/AIService.ts`: a coda-letter generation path (correct-deduction branch only); Holmes's realist reaction; the frame-closing Watson line. Gate strictly on the correct-Edmund ending.
- The cold-case branches reuse existing `wrongDeductionNote` epilogues.

---

## Notebook & journal (tracking without new UI)

Choice: **narration + notebook only** — no suspect-board UI.

- **Notebook:** extend with a **"Persons of Interest"** section whose one-line statuses update as theories die (*"Tumblety — fled the country, 16 Nov"*, *"Pizer — alibi confirmed, released"*). Render in the existing notebook component.
- **Act-closing Watson journal** (already exists via `AIService.generateJournalEntry`): use it to record the **shifting conviction** each act — the emotional ledger of the moving spotlight (*"I was certain this morning that the American was our man…"*).
- **Holmes's dialogue** does the active eliminating in-scene.

---

## Files affected

| File | Change |
|---|---|
| `engine/stories/whitechapel-1888/npcs.ts` | New NPCs (tumblety, phillips, pizer, hutchinson); rewrite Edmund's `scriptedLines`; family-thread `publicKnowledge` |
| `engine/stories/whitechapel-1888/locations.ts` | New `london_hospital`; holding-cell scene at `h_division_station`; Hutchinson content at `whitechapel_pub`; new interactables for clue chains |
| `engine/stories/whitechapel-1888/clues.ts` | Incriminating + exculpatory clue chains; Edmund-pointer `holmesDeduction`s; SHOW/USE theory-testing interactions |
| `engine/stories/whitechapel-1888/suspects.ts` | Expand `SUSPECT_PROFILES` (tumblety, pizer, hutchinson, gentleman) with `wrongDeductionNote`s |
| `engine/stories/whitechapel-1888/acts.ts` | New `ACT_TIME_CONFIG` calendar (9–22 Nov); optional act-name subtitles; gate review |
| `engine/GameEngine.ts` | Early-accusation gate copy; asylum-extraction + coda branching |
| `services/AIService.ts` | Coda-letter path (correct-deduction only); Holmes realist reaction; journal-as-theory-tracker prompting |
| `constants.ts` | `INITIAL_NPC_STATES` for new NPCs; display-name/alias maps |
| `components/` (notebook, ending) | "Persons of Interest" section; coda rendering |
| `scripts/qa-engine.ts`, `scripts/qa-narration.ts` | New scenarios (below) |

---

## Verification

1. **Engine tests** (`npx tsx scripts/qa-engine.ts`): existing 115 pass, plus new scenarios —
   - each loud suspect's incriminating + exculpatory clue chain fires correctly
   - naming each red herring at deduction returns `actionSuccess: false` + tailored cold-case note
   - early Edmund accusation (pre-convergence) is blocked
   - correct Edmund deduction still requires `clue_06`
   - the new calendar advances acts on the existing gate flags
2. **Narration tests** (`scripts/qa-narration.ts` + `qa-playthrough` agent): historical accuracy of the new NPCs (Tumblety arrest/flight, Phillips/Bond dispute, Pizer alibi, Hutchinson statement, Warren resignation), spoiler containment (loud suspects must not leak Edmund early), the coda letter's voice and the unstated Chicago dread.
3. **Difficulty re-rating:** confirm the spotlight choreography moves Edmund from "obvious" to "earned," and that every red herring is fairly raised and fairly eliminated.

---

## Phase 2 — World Expansion (deferred)

For its own brainstorm-and-spec later:

- **Exploration locations:** common lodging house (Crossingham's / Flower & Dean St), Toynbee Hall, the docks & an opium den (Holmes-canon nod), Spitalfields Market, a music hall, the *Star* newspaper office.
- **Richer interaction verbs:** WAIT / time-of-day NPC schedules (Infocom *Deadline* style), ASK-ABOUT topic dialogue, optional environmental clues (also fixes the "nothing useful here" dead-end frustration).
- **Goal:** turn 1888 London into a place the player *wanders*, not just *traverses* — and roughly double playtime from the current ~60 minutes.
