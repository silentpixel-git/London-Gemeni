---
name: game-direction
description: Design principles and player experience guidelines for London Bleeds. Claude loads this automatically when making UI decisions, designing new mechanics, writing player-facing text, or evaluating feature proposals.
user-invocable: false
---

# Game Direction — London Bleeds

Load this when making any decision that affects player experience: UI changes, new mechanics, command parsing, feedback text, feature design, or pacing decisions.

---

## Core design intent

London Bleeds is a **literary detective game**, not a puzzle game. The primary experience is *immersion in Watson's perspective* — the feeling of being inside a Conan Doyle story, not the satisfaction of solving an optimisation problem.

The player should feel like they are *investigating*, not *completing*.

---

## The engine/AI contract as a design principle

The strict separation — engine resolves, AI narrates — is not just an architectural choice. It is the design philosophy:

- **Deterministic outcomes**: the player's actions have reliable consequences. Examining an object always works. Moving always works. The game never withholds progress arbitrarily.
- **Atmospheric interpretation**: the AI wraps those reliable outcomes in prose that makes them feel significant. The same clue discovery can feel different at different sanity levels.
- **No hallucination**: Watson never describes an exit that doesn't exist, an NPC that isn't there, or a clue that wasn't found. The prose is rich but the facts are locked.

When evaluating any new feature, ask: *does this belong in the engine (deterministic) or the narration (atmospheric)?* Never blur the line.

---

## Player experience principles

**Principle 1 — Forward momentum above all**
The player should never be stuck without knowing why. If a flag is required for act advancement, the engine must provide an in-character hint. Dead ends feel like bugs; obstacles feel like the game.

**Principle 2 — Trust the player**
Do not over-explain. Watson does not say "you need to examine 5 objects before you can deduce." The game reveals its systems through play. Players who pay attention should feel smart; players who don't should still progress.

**Principle 3 — Failure is part of the story**
The COLD CASE ending (wrong deduction) is not a failure state to avoid — it is an alternate narrative. Watson closes his diary. Design features that make failure feel meaningful, not punishing. Never add "are you sure?" prompts to story-consequential actions.

**Principle 4 — Restraint in UI**
The sidebar shows only what Watson would actually know: location, NPCs present, journal entries, sanity, in-game clock. It does not show a mini-map, a clue checklist, or a progress bar. If a UI element wouldn't exist in Watson's world, it probably shouldn't exist in the game.

**Principle 5 — Edmund is always present**
Edmund Halward is the murderer and he accompanies Watson throughout. His presence should feel natural — not threatening, not highlighted. Design decisions should never accidentally spotlight him (e.g. don't add a "suspicion meter" that lights up near NPCs).

---

## Mechanic evaluation criteria

When a new mechanic is proposed, check:

1. **Does it serve the fiction?** A sanity meter serves the fiction — Watson's mental deterioration is a real narrative force. A combo multiplier does not.
2. **Does it respect the engine/AI split?** Game state changes go in the engine. Atmosphere goes in narration. Never mix.
3. **Does it add friction or tension?** Friction = frustration (avoid). Tension = investment (good).
4. **Does it work silently?** The best mechanics in this game are ones the player experiences without being told about them. The time-of-day system changes the prose without a tutorial.

---

## UI and command design

**Command input**: Free text. The intent parser handles normalisation. Never expose command syntax to the player — no "you must type EXAMINE OBJECT" instruction boxes. Watson doesn't type commands; he acts.

**Feedback text**: All player-facing text (blocked action messages, help, UI labels) should be in Watson's voice or period-appropriate neutral text. Never system voice: no "ERROR", no "INVALID INPUT", no "ACTION UNAVAILABLE."

**Journal**: The journal is Watson's private record, not a game tracker. Entries should read like notes a careful doctor would make, not like achievement unlocks.

**Clock**: The in-game clock is canonical and immersive. It advances with investigation progress, not real time. It should be visible but not prominent — a detail for attentive players, not a pressure mechanic.

**Sanity**: The sanity meter is visible but Watson does not comment on it directly. The prose does the work. Never add a warning popup when sanity drops below a threshold.

---

## Scope guidelines

London Bleeds is a **contained, complete story**. The Whitechapel Diaries is one story: 9–10 November 1888, six acts, one murderer, one case.

- Do not add mechanics that only make sense across multiple stories (skill trees, persistent inventory, reputation systems)
- Do not add locations or NPCs that don't serve the existing narrative
- Do not add difficulty settings — the historical facts are the difficulty
- New story content (an NPC, a clue, a location) is always in scope. New systems require a strong justification against the principles above.
