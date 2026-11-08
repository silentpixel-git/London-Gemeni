---
status: accepted
---

# Bounded narrator improvisation, recorded as canon

The founding rule of the engine was that the AI narrates only engine-verified facts and may invent nothing. That rule made "explore anything and get a proper response" impossible by design: any unlisted target returned "Watson does not see X here". We decided to split what the narrator may say into **Facts** (owned by the engine: clues, exits, where things and people are, who knows what) and **Flavour** (descriptive detail carrying no Fact). The narrator may improvise Flavour, and every improvised detail is written back as an **Observation** so later turns repeat it consistently. It may never create or imply a Fact.

## Considered options

- **Keep the strict contract.** Rejected: zero new spoiler risk, but the exploration freedom the game is for cannot exist.
- **AI-driven world, engine guards plot only.** Rejected: consistency and historical accuracy become prompt-quality problems again and the content-bug class grows.

## Consequences

- The narration output schema distinguishes prose from Observations, and an invention gate rejects proper nouns and numeric specifics that appear in neither the turn context nor existing Observations.
- Observations are Events, so they replay with the Investigation and survive resume.
- Anyone tightening the rule back to "never invent" should know the loosening was deliberate and bounded, not an oversight.
