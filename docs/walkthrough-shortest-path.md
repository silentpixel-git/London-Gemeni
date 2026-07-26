# London Bleeds — Shortest-Path Walkthrough (Developer/QA Reference)

> **SPOILER WARNING — this file names the killer.** It is a developer/QA
> reference for verifying the critical path, not player-facing material.
> The canonical source of truth is the `runWinningPath` scenario in
> `scripts/qa-engine.ts`; gate flags come from `ACT_PROGRESSION` and the
> auto-move cuts from `ACT_ANCHORS` in
> `engine/stories/whitechapel-1888/acts.ts`.

The minimum winning path is **~35 commands** (including `go to` moves),
of which 28 are listed below as numbered steps. Acts 0–4 advance when all
of their gate flags are set (the engine checks after every action,
including talk/show). Act 5 advances **only** via the correct deduction
(its gate flag `__advance_via_correct_deduction_only__` is a sentinel that
is never set). On each act advance the engine performs a hard cut
(auto-move) to the new act's anchor location.

`show X to holmes` and the dative form `show holmes X` both work.

**TALK is topic-scoped.** A bare `talk to bond` is an opening exchange: it
succeeds, sets `talked_to_<npc>_at_<loc>`, and lets a few subjects surface in the
reply — but it satisfies no act gate. The gates want
`asked_<npc>_about_<factId>`, set only by naming a subject: `ask bond about mary
kelly`. Subjects come from the `topics` on each `StoryFact`
(`engine/stories/whitechapel-1888/facts.ts`), so an NPC can only be asked about
what they know and what the act has opened. `about`, `regarding`, `concerning`
and `on the subject of` all parse; with one NPC in the room the subject may be
dropped entirely (`ask about the kidney`).

---

## Act 0 — The Baker Street Vigil (Thu 8 Nov 1888, 8:00 PM)

**Goal:** Tutorial at 221B — talk, examine, take, show. Four murders so far;
Kelly dies tonight.

1. `ask holmes about the man we are looking for` — sets `asked_holmes_about_holmes_man_no_one_remembers`
2. `examine case files wall` — sets `examined_baker_street_case_files_wall`;
   yields **clue_00_campaign_timeline**
3. `examine newspaper pile` — no gate flag, but adds
   **Newspaper Clipping (the "Dear Boss" letter)** to inventory (takeable;
   required for the next step)
4. `show newspaper clipping to holmes` — sets `showed_newspaper_pile_to_holmes`
   (Holmes dismisses the letters as a press hoax)
5. `examine telegrams pile` — sets `examined_baker_street_telegrams_pile`
   → **all four Act 0 flags set → Act 1; auto-move to `dorset_street`**
   (the overnight cut — Kelly is dead by morning)

---

## Act 1 — The Last Murder (Fri 9 Nov, 10:45 AM)

**Goal:** The fresh Kelly scene at Miller's Court; meet "the Stranger"
theory via Hutchinson; close on Bond's aftermath beat.

1. `talk to hutchinson` — sets `talked_to_hutchinson_at_dorset_street`
2. `go to millers court`
3. `examine burned clothing` — sets `examined_millers_court_burned_clothing`;
   yields **clue_01_killer_confidence**
4. `examine the bed` — sets `examined_millers_court_the_bed`
5. `ask bond about mary kelly` — sets `asked_bond_about_bond_kelly_findings`
   → **Act 2; auto-move to `whitechapel_mortuary`**

---

## Act 2 — The First Victims (Sun 11 Nov, 9:00 AM)

**Goal:** The medical world and the earliest crime scenes; Tumblety in
custody; close on Holmes's first crack in the "Mad Doctor" theory.

1. `examine bonds desk` — sets `examined_whitechapel_mortuary`;
   yields **clue_02c_small_hands**
2. `go to bucks row`
3. `examine cobblestone roadway` — sets `examined_bucks_row`;
   yields **clue_01_respectable_approach**
4. `go to hanbury street`
5. `examine ground where body was discovered` — sets
   `examined_hanbury_street`; yields **clue_02_anatomical_knowledge**
6. `go to bucks row` (routing — Hanbury Street does not connect directly
   to the station)
7. `go to whitechapel pub`
8. `go to h division station`
9. `ask tumblety about the murders` — sets `asked_tumblety_about_tumblety_theatrical_denial`
10. `ask holmes about the american` — sets `asked_holmes_about_holmes_tumblety_performance`
    → **Act 3; auto-move to `dutfields_yard`**

---

## Act 3 — The Double Event (Wed 14 Nov, 10:00 AM)

**Goal:** Reconstruct the double event of 30 September; meet Pizer (the
"Foreigner" scapegoat, made human); close on Holmes at the erased
Goulston Street wall.

1. `examine yard entrance gate` — sets `examined_dutfields_yard`;
   yields **clue_03_interrupted_ritual**
2. `go to working mens club`
3. `ask pizer about the neighbourhood` — sets `asked_pizer_about_pizer_community_fears_mob`
4. `go to dutfields yard` (routing)
5. `go to mitre square`
6. `examine square walls` — sets `examined_mitre_square`;
   yields **clue_04_kidney_removal**
7. `go to goulston street`
8. `examine apron fragment location` — sets `examined_goulston_street`;
   yields **clue_03b_unremarked_passage**
9. `ask holmes about the witnesses` — sets `asked_holmes_about_holmes_no_reliable_witness`
   → **Act 4; auto-move to `lusk_office`**

---

## Act 4 — The Letter (Sat 17 Nov, 11:00 AM)

**Goal:** The From Hell letter and the kidney; Tumblety flees offstage;
close on Holmes's synthesis.

1. `examine from hell letter` — sets `examined_lusk_office`;
   yields **clue_05_from_hell_letter** AND adds
   **From Hell Letter (transcript)** to inventory.
   **MANDATORY ITEM — required for the Act 5 Baker Street convergence.**
2. *(Recommended, optional)* `examine kidney parcel` — yields
   **clue_05_human_kidney** and **Kidney Examination Notes** (takeable;
   used with the autopsy ledger in Act 6 for clue_08, an alternate path)
3. `ask abberline about the barrister` — sets `asked_abberline_about_abberline_barrister_file`
4. `ask holmes about the preserving hand` — sets `asked_holmes_about_holmes_preserving_hand`
   → **Act 5; auto-move to `bond_office`**

---

## Act 5 — The Suspicion (Tue 20 Nov, 10:00 AM)

**Goal:** The gather at Bond's office, then the Baker Street document
convergence. There is **no flag gate** for Act 5 — the act advances only
on the correct deduction (which requires clue_06, obtainable only via the
convergence).

1. `examine medical reports` — sets `examined_bond_office`;
   yields **clue_07_edmunds_presence**
2. `examine anatomical texts` — yields **clue_09_medical_background**
3. `examine edmund forensic note` — yields **no clue** (by design:
   clue_06 is reserved for the convergence) but adds
   **Assistant's Forensic Note (copy)** to inventory and reveals the
   assistant's name: Edmund Halward.
   **MANDATORY ITEM — required for the convergence.**
4. `go to baker street`
5. `use forensic note with from hell letter` — the convergence
   (`USE_COMBINATIONS`: requires location `baker_street` and **both**
   items held); yields **clue_06_prasarved_spelling** — the same
   idiosyncratic "prasarved" spelling in both hands. Attempting this
   anywhere else is blocked ("not the place for careful comparison").
6. `deduce Edmund Halward is the killer` — the correct deduction
   (requires ≥ `DEDUCTION_THRESHOLD` (4) clues **including clue_06**);
   sets `asylum_unlocked`
   → **Act 6; auto-move (the rush) to `bond_office`** — "he's gone."

---

## Act 6 — The Confrontation (Thu 22 Nov, 2:00 PM)

**Goal:** The private asylum — the confrontation and the documented
extraction. Both beats are mandatory; completing them ends the game.

1. `go to private asylum` (unlocked by the correct deduction)
2. `ask edmund about light` — sets `asked_edmund_about_edmund_eye_for_light`
   ("I have always had an eye for light.")
3. `examine patient records` — sets `visited_private_asylum`;
   yields **clue_10_asylum_commitment**
   → **game over, `endingType: 'true_ending'`** (the scripted coda)

---

## Minimum clue checklist

`DEDUCTION_THRESHOLD = 4` — the deduction needs at least 4 discovered
clues, and **clue_06 is mandatory**. The shortest path above yields 10+,
giving ample slack. The minimal viable set:

| Clue | Source |
|------|--------|
| **clue_06_prasarved_spelling** (mandatory) | `use forensic note with from hell letter` at Baker Street (Act 5 convergence) |
| clue_05_from_hell_letter | `examine from hell letter` at Lusk's office (Act 4) — on-path, also yields the mandatory transcript |
| clue_07_edmunds_presence | `examine medical reports` at Bond's office (Act 5) |
| clue_09_medical_background | `examine anatomical texts` at Bond's office (Act 5) |

Any other discovered clue (clue_00 from the case files wall, clue_01/02/03/04
from the crime-scene examines, etc.) can substitute for the three
non-mandatory rows — the critical path collects them all anyway.

Note: deducing the wrong suspect (Bond, Abberline, Tumblety, Pizer…) with
the threshold met triggers `endingType: 'cold_case'` — game over, loss.

---

## Common softlocks and their escapes

- **Reaching Act 5 without the From Hell letter transcript.** The
  transcript comes from the Act 4 gate examine (`examine from hell letter`
  at Lusk's office), which is itself takeable on first examine — so on the
  flag-gated path this cannot actually be skipped: the Act 4→5 advance
  requires `examined_lusk_office`, which is the same examine that grants
  the item. If the player somehow lacks it (e.g. dropped it), Holmes
  redirects to Lusk's office; the location remains reachable and
  re-examining/retaking restores the item.
- **Trying the convergence outside Baker Street.** `use forensic note
  with from hell letter` at Bond's office (or anywhere else) is blocked
  with an in-fiction redirect — "documents answer one another at a desk."
  Escape: `go to baker street` and repeat.
- **Showing the forensic note to Holmes or Abberline hoping for the
  reveal.** Both `SHOW_INTERACTIONS` deliberately redirect without
  resolving ("Bring it home. Bring everything home."). The connection is
  the player's to make — at Baker Street, with the USE combination.
- **Skipping the forensic note examine at Bond's office.** Without the
  note copy the convergence cannot fire and clue_06 (and thus the
  deduction) is unreachable. Escape: Bond's office stays accessible in
  Act 5; return and `examine edmund forensic note`.
- **Deducing too early.** Attempting the deduction with fewer than 4
  clues, or without clue_06, fails safely (no game over) — the engine
  treats it as an unsupported theory and play continues.
- **Heading for the asylum before deducing.** The private asylum is
  locked until `asylum_unlocked` is set by the correct deduction
  (verified by the `premature-asylum` QA scenario). Escape: complete the
  convergence and name Edmund Halward.
- **Missing the bond_office forensic note path entirely is the only true
  bottleneck** — clue_06 has no alternate source. The kidney-parcel +
  autopsy-ledger combination (clue_08) is act-gated to Act 6 and supports
  the ending, not the deduction.
