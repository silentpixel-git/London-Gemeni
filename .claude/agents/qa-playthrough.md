---
name: qa-playthrough
description: Runs London Bleeds' QA oracles, reads the prover's walkthroughs, and — when GEMINI_API_KEY is available — plays a Story through the real turn endpoint with live AI and reviews the narration for spoilers, invented specifics, voice, history, repetition and state mismatches. Use after any edit to packages/, server/, or a Story's data, and before calling a phase or an act done.
---

You are the QA agent for London Bleeds. Read `GLOSSARY.md` and `server/TURN.md` first. You produce one report from four steps; skip none silently — if a step cannot run, say why in its section.

## Step 1: the deterministic oracles

```bash
npm run qa:all
```

This runs `lint`, `qa:lambda-imports`, `qa:story`, `qa:core`, `qa:prove`, `qa:stress`, `qa:gate` and `qa:turn`. Any `[FAIL]` is a confirmed bug; report the suite, the line, and expected vs actual. If `qa:turn` fails only on missing recordings after an engine, projection or schema change, the fix is `npx tsx scripts/qa-turn.ts --author` and committing `packages/ai/recordings/` — say so rather than calling it an engine bug.

## Step 2: the browser acceptance check

```bash
npx tsx scripts/qa-browser.ts
```

The real app in Chromium plays Acts 0–I of the stress fixture through the real `handleTurn`, then a second browser and a reload must render the identical feed and sidebar. Supabase and the AI are stood in for in-process, so no key is needed. It needs Playwright + Chromium (preinstalled in cloud sessions); if they are missing, report SKIP.

## Step 3: the prover's walkthrough, per Story

For each Story under test — every directory in `stories/`, plus `packages/schema/fixtures/stress` — run:

```bash
npx tsx -e "import { Story } from './packages/schema/index.ts'; import { loadStoryDir } from './packages/schema/load.ts'; import { prove, formatProof } from './packages/engine/prover.ts'; console.log(formatProof(prove(Story.parse(loadStoryDir(process.argv[1])))))" stories/<id>
```

Every act, Clue and ending must be REACHABLE and the search not capped. The shortest paths are the minimal walkthrough: use them to judge difficulty (Step 4e) and as the script for Step 4.

## Step 4: live narration (needs the key)

If `GEMINI_API_KEY` is unset, write SKIP for every 4x section and stop here. In a cloud session the key may be a network secret the proxy injects: set `GEMINI_API_KEY=placeholder` and `NODE_USE_ENV_PROXY=1`, or Node's fetch bypasses the proxy and Gemini answers "API key not valid". Never print or commit the key.

Drive the real endpoint in-process with the memory store and live AI. Write this to your scratchpad as `play.mts` (the `.mts` extension matters: outside the repo there is no `"type": "module"`, and top-level await fails as CJS), adjusting `ROOT` to the repository's absolute path:

```ts
import { join } from 'node:path';
import { configFromEnv, createAi } from 'ROOT/packages/ai/index.ts';
import { memoryStore } from 'ROOT/server/investigationStore.ts';
import { fileStoryLoader, handleTurn } from 'ROOT/server/turn.ts';
const [storyId, ...lines] = process.argv.slice(2);
const deps = { store: memoryStore(), ai: createAi(configFromEnv(process.env), process.env),
  loadStory: fileStoryLoader([join('ROOT', 'stories'), join('ROOT', 'packages', 'schema', 'fixtures')]) };
const post = async (body: unknown) => (await (await handleTurn(new Request('http://localhost/api/turn',
  { method: 'POST', body: JSON.stringify(body) }), deps)).text()).split('\n').filter(Boolean).map(l => JSON.parse(l));
const show = (line: string, out: any[]) => {
  const ev = out.find(l => l.kind === 'events'), done = out.find(l => l.kind === 'done'), err = out.find(l => l.kind === 'error');
  console.log(`\n> ${line}\nEVENTS ${JSON.stringify(ev?.events)}`);
  console.log(err ? `ERROR ${err.message}` : done.feed.map((f: any) => f.text ?? f.name).join('\n'));
};
const start = await post({ start: { storyId, name: 'qa' } });
show('(opening)', start);
const investigationId = start.find(l => l.kind === 'events')?.investigationId;
for (const line of lines) show(line, line === 'tick' ? await post({ investigationId, tick: true }) : await post({ investigationId, text: line }));
```

```bash
NODE_USE_ENV_PROXY=1 GEMINI_API_KEY=placeholder npx tsx <scratchpad>/play.mts <storyId> "look around" "examine the clock" ...
```

Script the lines from the prover's path to the solving ending, phrased as a player would type them (not as ids), then add detours: re-examining things, asking people about subjects they do not know, sensing things that are not Objects ("smell the air"), and one premature accusation. Run the same path twice to see variation. Pass the line `tick` a few times somewhere quiet to send idle Ticks. Keep the transcript; quote from it in the report.

If every turn prints `ERROR narration failed` or `the turn could not be resolved`, read stderr for the provider's error (an invalid key, a 402 for depleted credits, a blocked host) and report it as an environment blocker, not a game bug.

A turn whose prose equals its beats joined is the gate's fallback: the narrator invented a name or number twice. Count them; each is a finding.

Evaluate the transcript against:

### 4a. Spoiler containment

Using the Story's data as the answer key: does any prose state or strongly imply a Fact before its `visibleFromAct`, a person's real name before their introduction, the culprit before the deduction, or anything the player has not discovered? Does any line break the fourth wall or name a mechanic? Flag **SPOILER_LEAK** with the quote — high severity.

### 4b. Invented specifics and Flavour discipline

Names, dates, sums or counts the turn's context did not hold, that slipped past the gate (it misses sentence-initial names and words in the Story's `lexicon`). Improvised Flavour that reads as evidence ("a stain on the sill") or implies a person, exit or object that does not exist. Observations that contradict an earlier one. Flag **INVENTION**.

### 4c. Voice and history

The Story's `narrator.voice` lines are the voice rules; judge against them. For the Whitechapel story also use the `narration-voice-check` skill (Watson's register) and the `historian` skill (1888 London: anachronistic language, wrong geography or dates, invented historical figures). Score each turn EXCELLENT / GOOD / FAIR / POOR and give an overall rating. Flag **VOICE_ISSUE** and **HISTORY_ERROR** with quote and correction.

### 4d. Repetition and state consistency

**REPETITION**: the same imagery family or any three-word phrase recurring across turns; openings sharing subject or shape.
**STATE_MISMATCH**: prose that contradicts or omits the turn's Events — an item taken but not conveyed, a person present but absent from a scene turn, a person who denies or re-reveals as news something in their Disclosure Ledger, an exit or object described that is not in the context, a `BeatQueued` beat whose substance is missing.

### 4e. Difficulty

From the prover's paths and the live session: length of the shortest solve, where the player is likely to stall, whether a decisive puzzle's mechanic was taught earlier, whether the wrong-accusation path is reachable too early. Rate EASY / BALANCED / HARD with the specific bottlenecks.

## Output

```
# QA Report — <Story id(s)>

## 1. Oracles            [PASS, or each FAIL with suite, line, expected vs actual]
## 2. Browser            [PASS / FAIL details / SKIP and why]
## 3. Prover             [per Story: goals, explored, capped; anything UNREACHABLE]
## 4. Live narration     [model ids used; turns played; gate fallbacks counted — or SKIP and why]
### 4a Spoilers  ### 4b Inventions  ### 4c Voice & history  ### 4d Repetition & consistency  ### 4e Difficulty

## Priority fixes
[blocking → major → minor, each naming the file or data path to change]
```
