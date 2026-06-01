---
name: add-npc
description: Scaffolds a complete new NPC for London Bleeds, touching npcs.ts and gameData.ts. Prompts for all required fields and writes a valid NPCDefinition including canonicalLocationByAct for all 6 acts and a knowledgeEnvelope.
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
6. **Personality traits** — 3–4 words (e.g. `['Civic', 'Suspicious', 'Weary']`)
7. **Public knowledge** — 3–6 bullet points: what this NPC will tell Watson if questioned
8. **Following rule** — `'location_based'` (NPC stays at their canonical location) or `'follows_watson'` (NPC follows the player). Default: `'location_based'`
9. **followsNpcId** — only if following rule is `'follows_watson'` or similar; usually omit
10. **Canonical location per act** — where this NPC is found in each of the 6 acts. Valid location IDs are in `engine/stories/whitechapel-1888/locations.ts`. Ask the user to specify or suggest sensible defaults based on the story.
11. **Knowledge envelope** (optional) — clue IDs this NPC privately holds. Leave empty `[]` if none.

## Step 2 — Read existing files

Before writing, read:
- `engine/stories/whitechapel-1888/npcs.ts` — to understand the existing pattern and avoid ID collisions
- `engine/stories/whitechapel-1888/locations.ts` — to validate the location IDs the user provided
- `engine/gameData.ts` — to find where NPC IDs are registered (look for NPC_IDS or similar registry)

## Step 3 — Write the NPC

Add the new NPC entry to `engine/stories/whitechapel-1888/npcs.ts` following the exact structure of existing NPCs:

```typescript
new_npc_id: {
  id: 'new_npc_id',
  displayName: 'Display Name',
  role: 'Role',
  description: 'Description.',
  speakingStyle: 'Speaking style.',
  personality: ['Trait1', 'Trait2', 'Trait3'],
  publicKnowledge: [
    'Knowledge point 1',
    'Knowledge point 2',
  ],
  followingRule: 'location_based',
  canonicalLocationByAct: {
    1: 'location_id',
    2: 'location_id',
    3: 'location_id',
    4: 'location_id',
    5: 'location_id',
    6: 'location_id',
  },
  knowledgeEnvelope: [],
},
```

## Step 4 — Register in gameData.ts

Search `engine/gameData.ts` for where NPC IDs are referenced or registered. Add the new NPC ID in the same pattern.

## Step 5 — Confirm

After writing both files, run `npm run lint` to verify no TypeScript errors were introduced. Report the result to the user.

Then summarise what was added:
- NPC ID and display name
- Which locations they appear in across acts
- Any knowledge envelope entries
- Whether any additional wiring is needed (e.g. atmosphere entries, dialogue triggers)
