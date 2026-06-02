# London Bleeds: The Whitechapel Diaries
## Game Design Reference Document

> **Purpose:** Developer reference. Prevents knowledge rot during refactors. Not shown to players.

---

## Premise

Victorian London, November 1888. The player is **Dr. John H. Watson**, investigating the Whitechapel murders alongside **Sherlock Holmes**. The game is a first-person text adventure — Watson's voice, Watson's moral compass, Watson's medical eye.

The murders are real. The culprit is fictional: **Edmund Halward**, Dr. Thomas Bond's quiet medical assistant. His family commits him to a private asylum after the Kelly murder to avoid scandal. The case goes officially unsolved — as it did in history.

---

## Characters

### Player Character
**Dr. John H. Watson** — Military doctor, Afghan campaign veteran. Analytical but empathetic. First-person narrator.

### Companions
**Sherlock Holmes** — Follows Watson everywhere. Makes cryptic observations. Never accuses Edmund until Act VI. His role is to validate Watson's deductions and keep the investigation moving.

**Inspector Abberline** — Scotland Yard's lead detective. Practical, honest, fatigued. Provides procedural context.

### The Suspect
**Edmund Halward** — Dr. Bond's medical assistant. Quiet, polite, unremarkable. Present at every scene. Never speaks unless directly addressed. His ordinariness is his camouflage. He follows Bond (`follows_bond`) through Act V; from Act VI he is committed and remains at the asylum (`followsUntilAct: 5`).

> **Engine rule:** Edmund must remain invisible. He holds lanterns. He nods. He never volunteers information. Holmes does not accuse him until Act VI.

### Other NPCs
| NPC | Role | Location |
|-----|------|----------|
| Dr. Thomas Bond | Police surgeon, forensic expert | Follows the investigation |
| George Lusk | Chairman, Whitechapel Vigilance Committee | `lusk_office` (Acts IV–VI) |
| Louis Diemschutz | Working Men's Club steward, found Stride | `working_mens_club` |
| Asylum Superintendent | Keeper of Edmund's records | `private_asylum` |

---

## Narrative Arc (Prologue + 6 Acts)

> Act names are defined in `ACT_NAMES`; gate flags in `ACT_PROGRESSION` (`engine/stories/whitechapel-1888/acts.ts`). Acts 1–3 are set on 9 November 1888; Acts 4–6 on 10 November 1888 (`ACT_TIME_CONFIG`).

### PROLOGUE: The Baker Street Vigil
**Location:** 221B Baker Street
**Purpose:** Watson reads Holmes's case map and assembles the killer's *profile* (no name yet).
**Gate:** `examined_baker_street_case_files_wall` + `examined_baker_street_telegrams_pile` + `talked_to_holmes_at_baker_street` → Act I

### ACT I: The Last Murder
**Location:** Dorset Street → 13 Miller's Court
**Victim:** Mary Jane Kelly (most brutal murder — extensive mutilation)
**Clues:** The Killer's Patience (burned clothing as light source)
**Gate:** `examined_millers_court` → Act II

### ACT II: The First Victims
**Locations:** Whitechapel Mortuary, Buck's Row, Hanbury Street
**Victims:** Mary Ann Nichols (Buck's Row), Annie Chapman (Hanbury)
**Clues:** The Respectable Stranger, Anatomical Precision, One Pair of Hands, The Hands
**Gate:** `examined_whitechapel_mortuary` + `examined_bucks_row` + `examined_hanbury_street` → Act III

### ACT III: The Double Event
**Locations:** Dutfield's Yard, International Working Men's Club, Mitre Square
**Victims:** Elizabeth Stride (interrupted), Catherine Eddowes (kidney removed)
**Clues:** An Interrupted Man, The Removed Kidney
**Key witness:** Diemschutz (at the Working Men's Club) saw nothing unusual — the killer was calm
**Misdirection:** Holmes entertains, then abandons, a dock-worker / foreign-community theory at the club
**Gate:** `examined_dutfields_yard` + `examined_mitre_square` + `examined_working_mens_club` → Act IV

### ACT IV: The Letter
**Locations:** Goulston Street, George Lusk's Office
**Evidence:** From Hell letter, kidney parcel
**Clues:** The From Hell Letter, The Kidney Parcel
**Key phrase:** *"prasarved"* — idiosyncratic misspelling that will reappear
**Gate:** `examined_lusk_office` → Act V

### ACT V: The Suspicion
**Location:** Dr. Bond's Office
**The reveal:** Edmund's forensic notes contain the word *"prasarved"* — and his name. This is the first time the killer is named.
**Clues:** The 'Prasarved' Note, The Silent Witness, An Incomplete Education
**Gate:** `examined_bond_office` → Act VI

### ACT VI: The Confrontation
**Locations:** The Private Asylum, 221B Baker Street
**Entry requirement:** The asylum is locked until a **correct deduction** sets `asylum_unlocked` (`requiresFlag` on the location). Watson must name Edmund before he can go there.
**The truth:** Edmund is committed. Patient records confirm the kidney evidence. The murders stop.
**Clues:** The Other Half, The Murders Stop
**Deduction:** Naming Edmund (correct) unlocks and ends the game on the asylum visit. Naming a red herring (or anyone else) ends it as a cold case.
**Endings:**
- **Correct** → Holmes agrees. No legal proof. Watson closes the diary knowing the truth.
- **Incorrect** → Cold case. Watson closes the diary without resolution.

> **Note:** The 221B Baker Street *closing* scene (paying off the prologue's blank question-mark card) is not yet authored. The ending is currently delivered through the AI-narrated diary entry in the deduction handler.

---

## Clue System

### Clue Discovery
Clues are triggered by examining specific objects at specific locations (first examination only). Source of truth: `CLUE_TRIGGERS` and the clue definitions in `engine/stories/whitechapel-1888/clues.ts`.

| Clue ID | Name | Trigger Object | Location | Med | Moral |
|---------|------|----------------|----------|-----|-------|
| `clue_00_campaign_timeline` | The Eleven Weeks | `case_files_wall` | Baker Street | 0 | 5 |
| `clue_01_killer_confidence` | The Killer's Patience | `burned_clothing` | Miller's Court | 10 | 5 |
| `clue_01_respectable_approach` | The Respectable Stranger | `cobblestone_roadway` | Buck's Row | 5 | 0 |
| `clue_02_anatomical_knowledge` | Anatomical Precision | `ground_where_body_was_discovered` | Hanbury Street | 10 | 0 |
| `clue_02b_campaign_pattern` | One Pair of Hands | `autopsy_ledger` | Whitechapel Mortuary | 10 | 5 |
| `clue_02c_small_hands` | The Hands | `bonds_desk` | Whitechapel Mortuary | 5 | 0 |
| `clue_03_interrupted_ritual` | An Interrupted Man | `yard_entrance_gate` | Dutfield's Yard | 5 | 5 |
| `clue_04_kidney_removal` | The Removed Kidney | `square_walls` | Mitre Square | 10 | 0 |
| `clue_04b_adjustable_appearance` | A Man of No Fixed Description | `witness_description_wall` | H Division Station | 5 | 0 |
| `clue_05_from_hell_letter` | The From Hell Letter | `from_hell_letter` | Lusk's Office | 5 | 5 |
| `clue_05_human_kidney` | The Kidney Parcel | `kidney_parcel` | Lusk's Office | 10 | 5 |
| `clue_06_prasarved_spelling` | The 'Prasarved' Note | `edmund_forensic_note` | Bond's Office | 10 | 5 |
| `clue_07_edmunds_presence` | The Silent Witness | `medical_reports` | Bond's Office | 5 | 5 |
| `clue_09_medical_background` | An Incomplete Education | `anatomical_texts` | Bond's Office | 5 | 0 |
| `clue_08_preserved_kidney` | The Other Half | `edmund_room_furnishings` | Private Asylum | 10 | 10 |
| `clue_10_asylum_commitment` | The Murders Stop | `patient_records` | Private Asylum | 5 | 10 |

**Deduction threshold:** 5 clues minimum to attempt a solution (`DEDUCTION_THRESHOLD`).

### The Smoking Gun Clue Chain
1. `clue_05_from_hell_letter` reveals the word *"prasarved"* in the From Hell letter (Act IV)
2. `clue_06_prasarved_spelling` reveals the same word — and Edmund's name — in his own hand (Act V)
3. These two clues together are the spine of the correct deduction. The name is deliberately withheld until Act V.

---

## Deduction & Suspects

Resolution is data-driven via `SUSPECT_PROFILES` (`engine/stories/whitechapel-1888/suspects.ts`). The engine matches the player's theory text against each profile's aliases:

| Suspect | Guilty? | Outcome |
|---------|---------|---------|
| Edmund Halward | Yes | Unlocks the asylum, advances to Act VI; game ends on the confirming visit |
| Dr. Bond | No (red herring) | Tailored cold-case rebuttal (his own "no surgical skill" conclusion, alibi, no spelling habit) |
| Inspector Abberline | No (red herring) | Tailored cold-case rebuttal (genuine exhaustion, no anatomical link) |
| Anyone else | — | Generic cold-case ending |

A wrong-but-plausible accusation gets a specific Holmes response (`wrongDeductionNote`) rather than the generic ending.

---

## Player Stats

### Medical Points
Awarded for clinical, forensic, analytical observations. Determines epilogue tone (detached professional vs. haunted witness).

### Moral Points
Awarded for empathy toward victims, social commentary on poverty and inequality, emotional responses. Determines epilogue tone (cold case as systemic failure vs. personal tragedy).

> **Sanity (removed):** Earlier builds tracked a sanity stat that drained on horrific scenes. It has been removed from the live engine — Watson's prose register is now fixed at the professional-composure baseline defined in the AI system prompt. Residual `sanity` references remain only in superseded files (`services/investigationService.ts`, `services/geminiService.ts`), which are no longer in the active path.

---

## Available Commands

| Command | Intent | Notes |
|---------|--------|-------|
| `go [place]` / `enter [place]` | move | Fuzzy-matched to location names; gated by act and `requiresFlag` |
| `look` / `examine` | examine (full mode) | Surveys entire location |
| `examine [object]` / `inspect [object]` | examine | Triggers clues on first use |
| `use [object]` | use | Specific interactions beyond examine |
| `talk to [npc]` / `speak with [npc]` | talk | NPC dialogue (does not award clues) |
| `take [object]` / `pick up [object]` | take | Only takeable objects |
| `inventory` / `my bag` | inventory | Lists Watson's items |
| `notebook` / `notes` / `clues` / `evidence` | notebook | Reviews discovered clues |
| `deduce` / `solve` / `killer is...` / `I believe...` | deduce | Requires 5+ clues; checked before notebook so a theory mentioning "evidence/clues" is not misrouted |
| `help` / `?` / `commands` | help | Lists available commands |

---

## Engine Architecture

```
Player input (free text)
       ↓
intentParser.ts — deterministic verb matching → ParsedIntent
       ↓
GameEngine.ts — resolves against gameData.ts → EngineResult (+ NarrationContext, verified facts only)
       ↓
useGameState.ts — applies state, enriches a copy of the context (STIM, Holmes synthesis)
       ↓
AIService.ts — streams Watson prose using the NarrationContext
```

**Golden rule:** The AI never decides what is true. It only narrates what the engine confirms. The engine's `aiContext` is treated as immutable; NPC introduction flags travel on `EngineResult.introductionFlagsUpdate`, not on the narration context.

---

## Act Gate Logic

Act progression is automatic, checked after every action (`checkActProgression`). Advancing past the final act (no further `ACT_PROGRESSION` entry) ends the game.

| Gate Flags | Set When | Unlocks |
|------------|----------|---------|
| `examined_baker_street_case_files_wall` + `examined_baker_street_telegrams_pile` + `talked_to_holmes_at_baker_street` | Prologue beats at 221B | Act 1 |
| `examined_millers_court` | Examine anything in Miller's Court | Act 2 |
| `examined_whitechapel_mortuary` + `examined_bucks_row` + `examined_hanbury_street` | All three surveyed | Act 3 |
| `examined_dutfields_yard` + `examined_mitre_square` + `examined_working_mens_club` | All three surveyed | Act 4 |
| `examined_lusk_office` | Examine anything in Lusk's Office | Act 5 |
| `examined_bond_office` | Examine anything in Bond's Office | Act 6 |
| `visited_private_asylum` | Enter the asylum (requires `asylum_unlocked` from a correct deduction) | Game ends |

---

## Known Design Decisions

**Why is the case unsolvable in history?**
Because it was. The game acknowledges this — even a correct identification of Edmund has no legal resolution. Holmes agrees but notes the absence of proof. The diary entry reflects this ambiguity.

**Why does Edmund never speak?**
His silence is his characterisation. He is the void at the centre of the investigation. Every time Watson looks at him and sees nothing remarkable, that IS the horror.

**Why no combat?**
This is a detective story. Watson's weapon is observation. Violence is what he is investigating, not participating in.

**Why was sanity removed?**
The stat had no mechanical effect and complicated the AI's prose register. The narration now holds a single, consistent professional-composure voice rather than branching on a sanity tier.

**Why gate the asylum behind a correct deduction?**
The confrontation is the climax. Without the gate, a player could reach Act VI by examining Bond's office and walk into the asylum without ever naming the killer, ending the game with no deduction scene. Naming Edmund is now mandatory.

---

## Post-Phase 3 Roadmap

- Ambient soundscapes (`AudioService`, triggered on move/examine)
- Location illustrations (atmospheric, AI-generated or commissioned)
- Visual deduction board (corkboard-style clue visualiser) — note: clue `connections` already encode the graph, but some connect forward to later-act clues, so gate the board to discovered clues only
- The Act VI 221B Baker Street closing scene (pay off the prologue's question-mark card)
- Branching NPC dialogue (dialogue trees, not free-form)
- Mini-map showing explored locations
- Achievements
- Mobile swipe navigation
