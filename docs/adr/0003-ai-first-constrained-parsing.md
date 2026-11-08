---
status: accepted
---

# AI-first constrained parsing on every turn

The current pipeline parses with ~960 lines of regex, aliases and typo tables and calls a model only on a miss. Most reported content bugs live in that layer, including carried items not being found because the parser's target set was the location's objects and the inventory held display strings. We decided that every turn is parsed by a fast, cheap model that receives the player's text plus the complete **Candidate Set** for this moment (Objects here and carried, people present, exits, topics the addressed person can speak to) and must select from it or answer "none". The engine validates the selection against the set before resolving. A handful of exact commands (compass directions, look, inventory, wait) bypass the call.

## Considered options

- **Regex-first with AI fallback (status quo).** Rejected: zero latency on the happy path, but every new Object needs aliases and the miss class never closes.
- **Regex-first, AI always validates.** Rejected: same latency as AI-first with two parsers to maintain.

## Consequences

- Roughly half a second to a second of added latency and one cheap model call per turn; the selection model and the narration model are configured separately.
- The engine owns the Candidate Set, so the model can only ever name things that exist; the engine/AI contract is intact.
- The regex parser, alias tables, typo tables and the two fallback tiers are deleted rather than ported.
