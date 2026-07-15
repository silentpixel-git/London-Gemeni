---
name: add-npc
description: Scaffolds a complete new NPC for London Bleeds, touching npcs.ts, facts.ts, and constants.ts. Prompts for all required fields and writes a valid NPCDefinition including a scheduleByAct placement and fact-graph knowledge entries.
disable-model-invocation: false
---

You are adding a new NPC to London Bleeds: The Whitechapel Diaries.

## Step 1 — Gather requirements

Ask the user for the following if not already provided in their message:

1. **NPC ID** (snake_case, e.g. `lusk`, `stride_witness`)
2. **Display name** (e.g. "George Lusk")
3. **Role** (e.g. "Chairman, Whitechapel Vigilance Committee")
4. **Brief description** — one or two sentences on who they are and what they know about the case
5. **Speaking style** — one sentence (e.g. "Blunt and civic-minded. Speaks with East End directness.")
6. **Personality traits** — 3–5 words (e.g. `['Civic', 'Suspicious', 'Weary']`)
7. **Knowledge** — 3–6 statements of what this NPC can tell Watson. These become `StoryFact` entries in `facts.ts` (`knownBy: ['<npc_id>']`), NOT a field on the NPC itself — NPC knowledge envelopes are derived from the fact graph (`engine/stories/knowledge.ts`). Ask which act each fact becomes visible from (`visibleFromAct`, 0 = always); spoilers must be act-gated.
8. **Following rule** — `'location_based'` (moves by schedule), `'fixed'` (never moves), or `'follows_watson'` / `'follows_bond'` (companion; needs `followsNpcId`, optionally `followsUntilAct`). Default: `'location_based'`
9. **Schedule** — `scheduleByAct`: for each act 0–6 where the NPC is onstage, a `{ default: '<location_id>' }` entry, optionally with `byPeriod` overrides for time-of-day movement (e.g. evenings at the pub). **An act with no entry means the NPC is offstage that act** — do not pad all seven acts. Valid location IDs are in `engine/stories/whitechapel-1888/locations.ts`.
10. **Introduction** (optional) — does Watson know their name from the start? If not: an `alias` (e.g. "a police inspector"), `aliasDescription`, `requiresIntroduction: true`, and how the name is learned (`introduction` absent = self-introduces on first talk; `{ type: 'document', objectId }` = learned by examining a document).

## Step 2 — Read existing files

Before writing, read:
- `engine/stories/whitechapel-1888/npcs.ts` — the existing pattern; avoid ID collisions. Note the `satisfies Record<string, NPCDefinition>` table and the `NPC_DISPLAY_NAMES` / `NPC_ALIASES` exports at the bottom.
- `engine/stories/types.ts` — the authoritative `NPCDefinition` shape.
- `engine/stories/whitechapel-1888/locations.ts` — to validate the location IDs the user provided.
- `engine/stories/whitechapel-1888/facts.ts` — the fact-graph pattern (order matters: per-NPC envelope order = file order).
- `constants.ts` — `INITIAL_NPC_STATES` and the sidebar's `NPC_DISPLAY_NAMES` copy.

## Step 3 — Write the NPC

Add the new entry to `NPCS_DATA` in `engine/stories/whitechapel-1888/npcs.ts` following the exact structure of existing NPCs:

```typescript
new_npc_id: {
  id: 'new_npc_id',
  displayName: 'Display Name',
  alias: 'Display Name',          // or an alias like 'a police inspector' if requiresIntroduction
  requiresIntroduction: false,
  role: 'Role',
  description: 'Description.',
  speakingStyle: 'Speaking style.',
  personality: ['Trait1', 'Trait2', 'Trait3'],
  followingRule: 'location_based',
  scheduleByAct: {
    2: { default: 'location_id' },
    3: { default: 'location_id', byPeriod: { evening: 'other_location_id' } },
    // acts with no entry = offstage
  },
},
```

Then add their knowledge as `StoryFact` entries in `facts.ts` under a new `── new_npc_id ──` section:

```typescript
{ id: 'new_npc_id_fact_name', statement: 'What they can tell Watson', knownBy: ['new_npc_id'], visibleFromAct: 0 },
```

## Step 4 — Register everywhere the ID is needed

- `npcs.ts`: add to `NPC_DISPLAY_NAMES`; add to `NPC_ALIASES` only if the NPC has a pre-introduction alias.
- `constants.ts`: add an `INITIAL_NPC_STATES` entry (initial location = their first onstage act's default) and a `NPC_DISPLAY_NAMES` entry (the sidebar keeps its own copy).
- If the AI should record memory of interactions with this NPC: add the id to the `npcMemoryUpdate` properties in `NARRATION_SCHEMA` and to the `NpcIds:` line of the narration system prompt, both in `server/aiCore.ts`.

## Step 5 — Confirm

Run `npm run lint` **and** `npm run qa:validate` — the validator checks NPC placement gaps, dangling location IDs, and spoiler leaks in fact statements. Report the results to the user.

Then summarise what was added:
- NPC ID and display name
- Which acts/locations they appear in (and when offstage)
- Fact-graph entries and their `visibleFromAct` gates
- Whether any additional wiring is needed (e.g. scriptedLines, idleBeats, rumor hops in `rumors.ts`, atmosphere entries)
