---
name: add-npc
description: Adds one person to a London Bleeds Story in the JSON Story schema — a Person entry in persons.json plus the Facts they know in facts.json, with schedule, alias and introduction, disposition, voice beats, topics and spoiler gates — then validates and proves the Story. Use when a signed-off score (see act-authoring) calls for a new person.
disable-model-invocation: false
---

You are adding a person to a Story. A Story is a directory of JSON files (`stories/<id>/`, or a fixture under `packages/schema/fixtures/` when doing engine work); the shapes are `Person` and `Fact` in `packages/schema/story.ts`, `Placement` / `Disposition` in `common.ts`. Read those, `GLOSSARY.md`, and the Story's existing `persons.json` and `facts.json` before writing.

For story content this skill runs inside `act-authoring`: only after the owner's sign-off #2, with the score's person and Fact rows as input. When the Phase 6 story skill exists it calls this skill per person rather than restating it.

## Step 1 — Gather

Take these from the score; ask for anything it leaves open:

1. **id** — snake_case, unique among persons (`[a-z][a-z0-9_]*`).
2. **name** — the real name the player learns.
3. **alias and introduction** (optional) — what the player calls them until they know the name ("the inspector"), and how they learn it: `{ "kind": "self" }` (introduces themself on first talk) or `{ "kind": "document", "object": "<object id>" }` (named once that Object is read). An alias without an introduction can never be lifted; the validator warns on it.
4. **schedule** — for each act they appear in, keyed by the act id as a string: a `default` Place and optional `byPeriod` overrides keyed by the Story's period ids. A Place is `{ "kind": "at", "location": "<id>" }`, `{ "kind": "follows", "person": "player" }` (a companion; or another person's id to trail them), or `{ "kind": "offstage" }`. **An act with no entry means offstage that act**; do not pad every act. Arrivals and exits mid-act are Rules (`summonPerson`, `movePerson`, `dismissPerson`), not schedule entries.
5. **disposition** — `hostile`, `wary`, `neutral`, `warm` or `trusting`. Changes later are `setDisposition` Effects in Rules.
6. **beats** — demeanor and voice notes the narrator receives every turn they are present. These are the person's identity anchors: sex, age, standing, manner of speech, one or two physical particulars. The narrator sees only the current turn's context, so whatever must stay consistent across turns goes here. Never the real name in an alias-gated person's beats.
7. **Facts** — what they can tell the player. Each is a `Fact` in `facts.json`, not a field on the person: knowledge is the Fact graph (`knownBy`), so one Fact can be known by several people and stays consistent.

## Step 2 — Write the person

Append to `persons.json`, matching the file's existing style:

```json
{
  "id": "ferryman",
  "name": "Abel Crane",
  "alias": "the ferryman",
  "introduction": { "kind": "self" },
  "schedule": {
    "0": { "default": { "kind": "at", "location": "jetty" }, "byPeriod": { "night": { "kind": "offstage" } } },
    "2": { "default": { "kind": "at", "location": "boathouse" } }
  },
  "disposition": "wary",
  "beats": ["A broad man in his sixties in an oilskin; answers in as few words as will do."]
}
```

## Step 3 — Write their Facts

One entry per thing they can say, in `facts.json`:

```json
{
  "id": "light_failed_at_two",
  "statement": "The lighthouse lamp went dark a little after two in the morning.",
  "knownBy": ["ferryman"],
  "visibleFromAct": 0,
  "topics": ["the light", "the lamp going out", "last night"],
  "voices": { "ferryman": "Went dark gone two. I was on the water and saw it." },
  "spoilerTerms": []
}
```

- **visibleFromAct** is the spoiler gate for speech: no one tells the player the Fact before that act (ADR-0005). A document or a Rule can still teach it earlier, and the prover lists each such path as EARLY. Anything that gives away the case is gated, and no Object carrying it is readable before its act unless the score says so.
- **topics** are the phrases a player might use. Cover every proper noun or specific the person's own beats and voices say aloud, or the person will deflect on a thing they just mentioned. No phrase may belong to two Facts (`qa:story` fails it); avoid near-synonyms and containment across Facts the same person knows ("the boat" / "the boat's lamp").
- **voices** give how this person phrases it when the plain statement would not do.
- **spoilerTerms** list the words that would leak the Fact in a beat seen earlier; the validator scans beats for them.
- **Numbers**: if a person will be asked for a figure, put it in the statement or voice. The invention gate rejects any number the turn's context does not hold.

If the person should learn something during play (a rumor reaching them), that is a Rule with a `grantFact` Effect and optional `delayPeriods`, not a `knownBy` entry.

## Step 4 — Validate and prove

```bash
npm run qa:story
npx tsx -e "import { Story } from './packages/schema/index.ts'; import { loadStoryDir } from './packages/schema/load.ts'; import { prove, formatProof } from './packages/engine/prover.ts'; console.log(formatProof(prove(Story.parse(loadStoryDir(process.argv[1])))))" stories/<id>
```

`qa:story` checks unknown locations and persons in the schedule, follow cycles, unknown acts and periods, topic collisions and spoiler leaks. The prover confirms nothing the person gates has become unreachable. If you edited a fixture, run `npm run qa:all`, and `npx tsx scripts/qa-turn.ts --author` if `qa:turn`'s recordings no longer match.

## Step 5 — Report

- id, name, alias and how the name is learned
- where they are, act by act and period by period, and when offstage
- each Fact: id, `visibleFromAct`, topics
- validator and prover results
- anything the score implies that still needs a Rule (an arrival, a disposition change, a rumor hop, a proximity scene)
