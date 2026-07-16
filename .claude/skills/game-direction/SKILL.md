---
name: game-direction
description: Design principles and player experience guidelines for London Bleeds. Claude loads this automatically when making UI decisions, designing new mechanics or puzzles, writing player-facing text, or evaluating feature proposals.
user-invocable: false
---

# Game Direction — London Bleeds

Load this when making any decision that affects player experience: UI changes, new mechanics, puzzle design, command parsing, feedback text, feature design, or pacing decisions.

This doc has two layers: **platform direction** (holds for any story built on this engine) and **Whitechapel story direction** (facts and rules specific to The Whitechapel Diaries). Keep them distinct — a story fact is not a platform principle.

---

## Part 1 — Platform direction

### Core identity

London Bleeds is a **literary detective platform**. The primary experience is *immersion* — the feeling of being inside the story's perspective (for Whitechapel: Dr. Watson's, inside a Conan Doyle story). Puzzle-solving is a **first-class servant of that immersion**: a well-made deduction puzzle *is* immersive, because real investigation is puzzle-solving.

The player should feel like they are *investigating* — and *earning insights* — not completing a checklist.

Watch for both failure modes, equally:

- Mechanics that feel like a game imposed on the fiction (combo meters, scores, gamey UI)
- Flat gate-checklists that feel like completing rather than solving (a string of single-step examine/talk flags)

### The engine/AI contract as a design principle

The strict separation — engine resolves, AI narrates — is not just an architectural choice. It is the design philosophy:

- **Deterministic outcomes**: the player's actions have reliable consequences. Examining an object always works. Moving always works. The game never withholds progress arbitrarily.
- **Atmospheric interpretation**: the AI wraps those reliable outcomes in prose that makes them feel significant. The same clue discovery can feel different at different hours, in different weather, at different points in the case.
- **No hallucination**: the narrator never describes an exit that doesn't exist, an NPC that isn't there, or a clue that wasn't found. The prose is rich but the facts are locked.

When evaluating any new feature, ask: *does this belong in the engine (deterministic) or the narration (atmospheric)?* Never blur the line. Puzzles are deterministic engine work — the AI narrates the discovery; it never adjudicates the solution.

### Player experience principles

**Principle 1 — Momentum with resistance**
A main puzzle should slow the player down for minutes, not sessions. Companion hints (Holmes, in Whitechapel) arrive readily and escalate — nudge, stronger nudge, near-solution — so nobody is permanently stuck. The calibration target: *"I saw it myself just before Holmes said it."* Dead ends still feel like bugs; resistance feels like the game. Every gating puzzle ships with hint-ladder coverage (`hints.ts`) before it ships.

**Principle 2 — Trust the player**
Do not over-explain. The narrator does not say "you need to examine 5 objects before you can deduce." The game reveals its systems through play. Players who pay attention should feel smart; players who don't should still progress.

**Principle 3 — Failure is part of the story**
A wrong final deduction is not a failure state to avoid — it is an alternate narrative (Whitechapel's COLD CASE endings: Watson closes his diary). Design features that make failure feel meaningful, not punishing. Never add "are you sure?" prompts to story-consequential actions.

### Puzzle philosophy

The game today is under-mechanized: one true mechanical puzzle (the Baker Street convergence) across seven acts, with nearly every other gate a single-step examine or talk. The direction is to **actively grow the puzzle vocabulary** — USE X WITH Y combinations, SHOW payoffs with mechanical consequence, multi-step chains, location-gated comparisons — rather than defaulting to examine-the-right-object.

- **Fair-play teaching rule**: any verb or mechanic a climactic puzzle depends on must appear at least once earlier in a lower-stakes form. The player must never face a decisive puzzle whose *mechanics* they've had no chance to learn.
- **Gate vs. bonus, decided per act**: gate act progression when the puzzle's insight *is* the act's dramatic turn; make it optional-rewarded when it enriches deduction material or deepens character. Never gate without hint coverage.
- A puzzle's difficulty should come from the fiction (what would an attentive investigator notice?), never from parser guesswork or verb-hunting.

### Mechanic evaluation criteria

When a new mechanic is proposed, check:

1. **Does it serve the fiction?** The time-of-day system changing the prose serves the fiction. A combo multiplier does not.
2. **Does it respect the engine/AI split?** Game state changes go in the engine. Atmosphere goes in narration. Never mix.
3. **Does it add friction or tension?** Friction = frustration (avoid). Tension = investment (good).
4. **Does it work silently?** The best mechanics are experienced without being announced — no tutorials, no popups.
5. **Does it teach or reuse a verb the player already knows?** Prefer deepening the existing vocabulary over inventing parallel one-off interactions.

### UI and command design

**Command input**: Free text. The intent parser handles normalisation. Never expose command syntax to the player — no "you must type EXAMINE OBJECT" instruction boxes. The narrator doesn't type commands; they act.

**Feedback text**: All player-facing text (blocked action messages, help, UI labels) should be in the narrator's voice or period-appropriate neutral text. Never system voice: no "ERROR", no "INVALID INPUT", no "ACTION UNAVAILABLE."

**Journal**: The journal is the narrator's private record, not a game tracker. Entries should read like notes a careful observer would make, not like achievement unlocks.

**Clock**: The in-game clock is canonical and immersive. It advances with investigation progress, not real time. Visible but not prominent — a detail for attentive players, not a pressure mechanic.

### Scope

The engine is a **platform**. The swappable `StoryManifest` boundary is a product commitment, not just engineering hygiene:

- New mechanics should land as story-agnostic engine capabilities configured by manifest data, not hard-coded to one story.
- The active story ships first and remains the proving ground — don't block its needs on speculative generality; but when a mechanic can be made story-agnostic cheaply, do so.
- New story content (an NPC, a clue, a location) is always in scope when it serves the active narrative.

---

## Part 2 — Whitechapel story direction

**One contained case.** The Whitechapel Diaries spans 8–22 November 1888: a prologue plus six acts, one murderer, one case. It is a complete story with an authored true ending.

**Edmund is always present.** Edmund Halward is the murderer and he accompanies Watson (via Bond) throughout. His presence should feel natural — not threatening, not highlighted. Design decisions should never accidentally spotlight him (e.g. don't add a "suspicion meter" that lights up near NPCs).

**The convergence is the crown puzzle.** The "prasarved" comparison at Baker Street (USE forensic note WITH From Hell letter) is the story's one authored aha-moment. New mid-game puzzles should rehearse its verb — USE X WITH Y — at lower stakes before Act 5, per the fair-play teaching rule. Nothing may spoil, shortcut, or pre-announce it.

**Red herrings are raised fairly and cleared on-screen.** Every loud suspect (Tumblety, Pizer, the Stranger, the vanishing gentleman) gets a genuine in-scene clearing beat, not just a profile note. The player may still accuse them — that's what the cold-case endings are for.

**The historical facts are the difficulty.** No difficulty settings. The five canonical murders, the real locations, and the period are fixed; the fiction bends only where the invented culprit requires it.

---

## Open questions — do not treat as settled

**UI restraint vs. puzzle affordances.** The former rule ("the sidebar shows only what Watson would know — no mini-map, no clue checklist, no progress bar") is under review: a puzzle-richer game may need evidence surfaces (journal-as-evidence-board, visible document inventory) for the player to enjoy deducing. This deserves its own design conversation. Until it happens, don't add *or* remove player-facing evidence/progress UI on the strength of the old rule — surface the question to the author instead.
