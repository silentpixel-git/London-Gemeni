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
**Dr. John H. Watson** — Military doctor, Afghan campaign veteran. Analytical but empathetic. First-person narrator. His sanity erodes as the horror accumulates.

### Companions
**Sherlock Holmes** — Follows Watson everywhere. Makes cryptic observations. Never accuses Edmund until Act VI. His role is to validate Watson's deductions and keep the investigation moving.

**Inspector Abberline** — Scotland Yard's lead detective. Practical, honest, fatigued. Provides procedural context.

### The Suspect
**Edmund Halward** — Dr. Bond's medical assistant. Quiet, polite, unremarkable. Present at every scene. Never speaks unless directly addressed. His ordinariness is his camouflage.

> **Engine rule:** Edmund must remain invisible. He holds lanterns. He nods. He never volunteers information. Holmes does not accuse him until Act VI.

### Other NPCs
| NPC | Role | Fixed Location |
|-----|------|----------------|
| Dr. Thomas Bond | Police surgeon, forensic expert | Follows investigation |
| George Lusk | Chairman, Whitechapel Vigilance Committee | `lusk_office` |
| Louis Diemschutz | Working Men's Club steward, found Stride | `dutfields_yard` |
| Asylum Superintendent | Keeper of Edmund's records | `private_asylum` |

---

## Narrative Arc (6 Acts)

### ACT I: The Last Murder
**Location:** Dorset Street → 13 Miller's Court
**Victim:** Mary Jane Kelly (most brutal murder — extensive mutilation)
**Clues:** Killer's patience (burned clothing as light source), killer's confidence
**Sanity cost:** Examining the bed and bloodstained sheets
**Gate:** Examine Miller's Court → Act II unlocks

### ACT II: Reconstructing the Murders
**Locations:** Buck's Row, Hanbury Street
**Victims:** Mary Ann Nichols (Nichols Row), Annie Chapman (Hanbury)
**Clues:** Respectable appearance of killer, anatomical precision of organ removal
**Pattern:** Killer is unthreatening, medically knowledgeable
**Gate:** Examine both locations → Act III unlocks

### ACT III: The Double Event
**Locations:** Dutfield's Yard, International Working Men's Club, Mitre Square
**Victims:** Elizabeth Stride (interrupted), Catherine Eddowes (kidney removed)
**Clues:** Interrupted ritual (compulsion, not completion), kidney removed surgically
**Key witness:** Diemschutz saw nothing unusual — killer was calm
**Gate:** Examine Dutfield's Yard and Mitre Square → Act IV unlocks

### ACT IV: The Letter
**Locations:** Goulston Street, George Lusk's Office
**Evidence:** From Hell letter, kidney parcel, apron fragment
**Clues:** Letter sent with half a kidney — writer is educated but makes specific spelling errors
**Key phrase:** *"prasarved"* — idiosyncratic misspelling that will reappear
**Gate:** Examine Lusk's Office → Act V unlocks

### ACT V: The Suspicion
**Location:** Dr. Bond's Office
**The reveal:** Edmund's forensic notes contain the word *"prasarved"*
**Clues:** Same hand wrote both documents; Edmund is present at every scene; anatomical texts obsessively annotated
**Gate:** Examine Bond's Office → Act VI unlocks

### ACT VI: The Confrontation
**Locations:** The Private Asylum, 221B Baker Street
**The truth:** Edmund is committed. Patient records confirm kidney evidence. The murders stop.
**Deduction trigger:** Player must name Edmund (correct) or another suspect (cold case)
**Endings:**
- **Correct** → Holmes agrees. No legal proof. Watson closes the diary knowing the truth.
- **Incorrect** → Cold case. Watson closes the diary without resolution.

---

## Clue System

### Clue Discovery
Clues are triggered by examining specific objects at specific locations (first examination only).

| # | Clue | Trigger | Location | Med | Moral |
|---|------|---------|----------|-----|-------|
| 1a | The Respectable Stranger | cobblestone_roadway | Buck's Row | 5 | 0 |
| 1b | The Killer's Patience | burned_clothing | Miller's Court | 10 | 5 |
| 2 | Anatomical Precision | ground_where_body_was_discovered | Hanbury Street | 10 | 0 |
| 3 | An Interrupted Man | yard_entrance_gate | Dutfield's Yard | 5 | 5 |
| 4 | The Removed Kidney | square_walls | Mitre Square | 10 | 0 |
| 5a | The From Hell Letter | from_hell_letter | Lusk's Office | 5 | 5 |
| 5b | The Kidney Parcel | kidney_parcel | Lusk's Office | 10 | 5 |
| 6 | The 'Prasarved' Note | edmund_forensic_note | Bond's Office | 10 | 5 |
| 7 | Edmund's Proximity | medical_reports | Bond's Office | 5 | 5 |
| 8 | The Other Half | patient_records | Private Asylum | 10 | 10 |
| 9 | An Incomplete Education | anatomical_texts | Bond's Office | 5 | 0 |
| 10 | The Murders Stop | superintendent | Private Asylum | 5 | 10 |

**Deduction threshold:** 5 clues minimum to attempt a solution.

### The Smoking Gun Clue Chain
1. Clue 5a reveals the word *"prasarved"* in the From Hell letter
2. Clue 6 reveals the same word in Edmund's handwriting
3. These two clues together are the spine of the correct deduction

---

## Player Stats

### Sanity (0–100, starts at 100)
Decreases when examining particularly horrific scenes (first time only):

| Object | Location | Penalty |
|--------|----------|---------|
| The Bed | Miller's Court | −10 |
| Bloodstained Sheets | Miller's Court | −8 |
| Burned Clothing | Miller's Court | −5 |
| Ground (body) | Hanbury Street | −5 |
| Square Walls | Mitre Square | −8 |
| Alleyways | Mitre Square | −3 |
| Kidney Parcel | Lusk's Office | −8 |
| Patient Records | Private Asylum | −10 |
| Superintendent | Private Asylum | −5 |

Sanity has no mechanical effect on gameplay currently — it is narrative context for the AI.

### Medical Points
Awarded for clinical, forensic, analytical observations. Determines epilogue tone (detached professional vs. haunted witness).

### Moral Points
Awarded for empathy toward victims, social commentary on poverty and inequality, emotional responses. Determines epilogue tone (cold case as systemic failure vs. personal tragedy).

---

## Available Commands

| Command | Intent | Notes |
|---------|--------|-------|
| `go [place]` / `enter [place]` | move | Fuzzy-matched to location names |
| `look` / `examine` | examine (full mode) | Surveys entire location |
| `examine [object]` / `inspect [object]` | examine | Triggers clues on first use |
| `use [object]` | use | Specific interactions beyond examine |
| `talk to [npc]` / `speak with [npc]` | talk | NPC dialogue |
| `take [object]` / `pick up [object]` | take | Only takeable objects |
| `inventory` / `my bag` | inventory | Lists Watson's items |
| `deduce` / `solve` / `killer is...` | deduce | Requires 5+ clues |
| `help` / `?` / `commands` | help | Lists available commands |

---

## Engine Architecture

```
Player input (free text)
       ↓
intentParser.ts — deterministic verb matching → ParsedIntent
       ↓
GameEngine.ts — resolves against gameData.ts → EngineResult + NarrationContext
       ↓
AIService.ts — streams Watson prose using NarrationContext
       ↓
Verified footer appended (NPCs, objects, exits) — cannot be hallucinated
```

**Golden rule:** The AI never decides what is true. It only narrates what the engine confirms.

---

## Act Gate Logic

Act progression is automatic, checked after every action:

| Gate Flag | Set When | Unlocks |
|-----------|----------|---------|
| `examined_millers_court` | Examine anything in Miller's Court | Act 2 |
| `examined_bucks_row` + `examined_hanbury_street` | Both locations surveyed | Act 3 |
| `examined_dutfields_yard` + `examined_mitre_square` | Both locations surveyed | Act 4 |
| `examined_lusk_office` | Examine anything in Lusk's Office | Act 5 |
| `examined_bond_office` | Examine anything in Bond's Office | Act 6 |
| `visited_private_asylum` | Enter Private Asylum | Game ends (if correct deduction made) |

---

## Known Design Decisions

**Why is the case unsolvable in history?**
Because it was. The game acknowledges this — even a correct identification of Edmund has no legal resolution. Holmes agrees but notes the absence of proof. The diary entry reflects this ambiguity.

**Why does Edmund never speak?**
His silence is his characterisation. He is the void at the centre of the investigation. Every time Watson looks at him and sees nothing remarkable, that IS the horror.

**Why no combat?**
This is a detective story. Watson's weapon is observation. Violence is what he is investigating, not participating in.

**Why sanity but no mechanics?**
Sanity is narrative texture for the AI. Future roadmap: low sanity could alter Watson's inner thought paragraphs (more fragmented, more haunted). Not implemented yet.

---

## Post-Phase 3 Roadmap

- Ambient soundscapes (`AudioService`, triggered on move/examine)
- Location illustrations (atmospheric, AI-generated or commissioned)
- Visual deduction board (corkboard-style clue visualiser)
- Branching NPC dialogue (dialogue trees, not free-form)
- Mini-map showing explored locations
- Achievements
- Mobile swipe navigation
