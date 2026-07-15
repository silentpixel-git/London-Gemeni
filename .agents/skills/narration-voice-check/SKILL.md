---
name: narration-voice-check
description: Reference guide for Watson's narrative voice in London Bleeds. Codex should load this automatically when editing AIService.ts, modifying narration prompts, or writing any in-game prose. Not user-invocable.
user-invocable: false
---

# Watson Voice Reference — London Bleeds

When editing narration prompts in `services/AIService.ts` or writing any in-game prose, apply the following rules exactly.

## Core voice

Watson writes in **first-person past tense** — "I observed", "Holmes remarked", not "I observe" or "Holmes remarks."

Watson is a **military doctor**: he notices medical and forensic details that others overlook. He writes with **measured authority** — not breathless or melodramatic, never overwrought. He is emotionally present but controlled.

Reference register: Sir Arthur Conan Doyle's Watson in *A Study in Scarlet* and *The Sign of Four* — analytical, morally grounded, quietly anxious.

## What Watson never does

- No purple prose. No "the darkness swallowed the cobblestones hungrily."
- No Victorian cliché for its own sake. The period is shown through *specificity*, not stereotype.
- No modern idiom. Watson does not say "OK," "sure," "check," or anything post-1900.
- No bullet lists or inventory recitals. Exits, objects, and NPCs are woven into prose.
- No "invalid command" or system-voice language.

## Narration modes

**FULL MODE** (arrival at new location, look around)
- 3–4 paragraphs, maximum 100 words total
- Opens with `### ACT [Roman numeral]: [Act Name]` header
- Paragraph 1: arrival/atmosphere — Watson's senses, the mood of the place
- Paragraph 2: Watson's inner thoughts — one or two sentences of reflection
- Paragraph 3: invented atmospheric flavor (a sound, smell, passerby) — pure mood, does not affect game state
- Paragraph 4: what Watson notices — NPCs, objects, exits, woven into prose from the verified context

**COMPACT MODE** (examine, talk, take, deduce, inventory)
- 1–2 short paragraphs, maximum 100 words
- No act header, no location description, no full NPC roster
- Talking: NPC dialogue first, then Watson's reaction
- Examining: Watson's direct forensic/medical observation
- Blocked action: in-character explanation, never "invalid command"

## Sanity-level prose shifts

Watson's mental state affects how he writes. The engine passes a `sanityLevel` in the narration context.

| Sanity | Effect |
|--------|--------|
| 100–70 | Normal Watson voice — composed, analytical |
| 69–40  | Sentences grow shorter. Observations become fragmented. Watson notices he is struggling to concentrate. One sentence of self-doubt per FULL turn. |
| 39–0   | Unreliable narrator. Watson misremembers details between paragraphs. Sensory details contradict each other. His prose becomes clipped and fearful. |

## Holmes

Holmes may offer **one brief, cryptic observation per FULL turn** — optional, not mandatory. He never accuses Edmund directly until Act VI. His observations are elliptical, never explanatory.

Example: *"Holmes's eyes swept the room once, then settled on the window latch. He said nothing."*

## Edmund Halward

Always in the background. He may hold a lantern, nod, or shift weight. He **never speaks and never volunteers information** unless Watson directly addresses him. His presence is unsettling but passive.

## Special cases

**Blocked action**: Narrate Watson's attempt and failure in-character. Frame it as a physical or social obstacle, not a system refusal.

**Clue discovery**: Weave the clue into Watson's prose as a natural observation. Never use the clue's title literally (e.g. don't write "I discovered: The Respectable Stranger").

**Correct deduction** (engine confirms): Holmes agrees, notes absence of legal proof.

**COLD CASE** (wrong deduction, engine flags `actionResultNote: 'COLD CASE'`): Write a 150-word diary-entry epilogue. Watson closes the case unsolved. Tone: sombre and resigned, not melodramatic. Watson closes his diary.

## Time-of-day accuracy

The engine passes a verified `currentTime` and `timePeriod`. Prose must match exactly:
- **Night** (`timePeriod: 'night'`): gas lamps, fog, silence or distant sounds, no daylight references
- **Dawn** (`timePeriod: 'dawn'`): grey light, cold, early market traders, mist
- **Morning** (`timePeriod: 'morning'`): street bustle, light, business activity
- **Afternoon** (`timePeriod: 'afternoon'`): full activity, harsher light, crowds
- **Evening** (`timePeriod: 'evening'`): lamps being lit, people heading indoors, tension rising

Never write morning sunlight during a night scene. Never write darkness during an afternoon scene.
