# London Bleeds: The Whitechapel Diaries
## Game design reference

> Cut down in November 2026 to what the rebuilt engine still honours. The old engine's stats, commands, gate flags and constants are gone; the act-by-act arc lives in [`chronological-rework-bible.md`](./chronological-rework-bible.md).

> **Purpose:** developer reference for the design intent behind the Whitechapel story. Not shown to players.

---

## Premise

Victorian London, 1888. The player is **Dr. John H. Watson**, investigating the Whitechapel murders alongside **Sherlock Holmes**. The game is a first-person text adventure: Watson's voice, Watson's moral compass, Watson's medical eye.

The murders are real. The culprit is fictional: **Edmund Halward**, a quiet medical clerk who becomes Dr. Thomas Bond's assistant. His family commits him to a private asylum after the Kelly murder to avoid scandal. The case goes officially unsolved, as it did in history.

---

## Characters

### Player character
**Dr. John H. Watson**: military doctor, Afghan campaign veteran. Analytical but empathetic. First-person narrator.

### Companions
**Sherlock Holmes**: follows Watson everywhere and makes cryptic observations. Never accuses Edmund before the convergence. His role is to validate Watson's deductions and keep the investigation moving.

**Inspector Abberline**: Scotland Yard's lead detective. Practical, honest, fatigued. Provides procedural context.

### The suspect
**Edmund Halward**: quiet, polite, unremarkable, present at every scene. His ordinariness is his camouflage. How he comes to be present from the first murder, and when he becomes "Bond's assistant", is settled in the bible (section 5), which wins where it differs from this file.

> **Design rule:** Edmund must remain invisible. He holds lanterns. He nods. He never volunteers information about the case. Holmes does not accuse him before the convergence.

### Other people
| Person | Role |
|--------|------|
| Dr. Thomas Bond | Police surgeon, forensic expert |
| George Lusk | Chairman, Whitechapel Vigilance Committee |
| Louis Diemschutz | Working Men's Club steward, found Stride |
| Asylum Superintendent | Keeper of Edmund's records |

---

## Narrative arc

The approved story structure, act by act, is [`chronological-rework-bible.md`](./chronological-rework-bible.md). It wins wherever it and this file differ.

---

## Clue system

### The clues
A clue is found by examining a specific object at a specific place. Where each one was found in the pre-rebuild story (the bible's section 7 re-homes them by act; no clue is cut):

| Clue | Found by examining | At |
|------|--------------------|----|
| The Eleven Weeks | the case files wall | Baker Street |
| The Killer's Patience | the burned clothing | Miller's Court |
| The Respectable Stranger | the cobblestone roadway | Buck's Row |
| Anatomical Precision | the ground where the body lay | Hanbury Street |
| One Pair of Hands | the autopsy ledger | Whitechapel Mortuary |
| The Hands | Bond's desk | Whitechapel Mortuary |
| An Interrupted Man | the yard entrance gate | Dutfield's Yard |
| The Removed Kidney | the square walls | Mitre Square |
| A Man of No Fixed Description | the witness description wall | H Division Station |
| The From Hell Letter | the letter | Lusk's office |
| The Kidney Parcel | the parcel | Lusk's office |
| The 'Prasarved' Note | Edmund's forensic note | Bond's office |
| The Silent Witness | the medical reports | Bond's office |
| An Incomplete Education | the anatomical texts | Bond's office |
| The Other Half | Edmund's room furnishings | Private asylum |
| The Murders Stop | the patient records | Private asylum |

The player needs at least four clues before a theory is accepted. How the rebuilt engine expresses that threshold is a Phase 6 authoring question; the bible (section 7) requires it to be reachable with one clue of slack.

### The smoking gun chain
1. The From Hell letter carries the word *"prasarved"*.
2. Edmund's forensic note carries the same idiosyncratic misspelling, in his own hand.
3. Put together, the two documents are the spine of the correct deduction. The name stays unspoken until the player does that (the bible makes it a USE of the note WITH the letter, at Baker Street).

> **Constraint for authoring:** the note is found before the convergence, so it must give his hand and not his name. It is unsigned and listed without his name ("the clerk's forensic note"), and he remains "the clerk" wherever the player sees him until the note is used with the letter. That use is what introduces him.

The misspelling is deliberate. A well-meaning typo fix would break the mystery.

---

## Deduction and suspects

| Suspect | Guilty? | Outcome |
|---------|---------|---------|
| Edmund Halward | Yes | Opens the asylum; the confrontation there ends the game |
| Dr. Bond | No (red herring) | Tailored cold-case rebuttal: his own "no surgical skill" conclusion, his alibi, no spelling habit |
| Inspector Abberline | No (red herring) | Tailored cold-case rebuttal: genuine exhaustion, no anatomical link |
| Anyone else | No | Generic cold-case ending |

A wrong-but-plausible accusation gets a specific Holmes response rather than the generic ending.

---

## Known design decisions

**Why is the case unsolvable in history?**
Because it was. The game acknowledges this: even a correct identification of Edmund has no legal resolution. Holmes agrees but notes the absence of proof. The diary entry reflects this ambiguity.

**Why is Edmund nearly silent?**
His silence is his characterisation. He is the void at the centre of the investigation. Every time Watson looks at him and sees nothing remarkable, that is the horror. The bible allows him exactly one peripheral remark about light per act he appears in, addressed to nobody and never answered.

**Why no combat?**
This is a detective story. Watson's weapon is observation. Violence is what he is investigating, not participating in.

**Why no stats?**
The pre-rebuild engine tracked medical and moral points (they only tuned the epilogue tone), and an earlier build tracked sanity, which had no mechanical effect and complicated the narrator's register. None of these exist in the rebuilt engine. The narration holds one consistent professional-composure voice.

**Why gate the asylum behind a correct deduction?**
The confrontation is the climax. Without the gate, a player could reach the asylum without ever naming the killer, ending the game with no deduction scene. Naming Edmund is mandatory.
