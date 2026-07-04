# Phase 3 — Tool-Calling Parse Fallback (Design)

**Date:** 2026-07-04
**Backlog item:** H2 (tool-calling turn loop), Phase 3 of the strangler-fig rebuild.
**Decisions made during brainstorm:** hybrid fast-path posture; QA corpus as the
cutover gate; client-orchestrated candidates (Approach A).

## Goal

Free-text like "peer beneath the bedframe" or "have a word with the fellow who
found the body" resolves to a real engine action instead of falling through to
atmospheric narration — without adding a model call to clean-command turns, and
without weakening the engine-resolves/AI-narrates contract.

## Posture: hybrid fast-path

The deterministic parser (`engine/intentParser.ts`) remains the first and only
parse for every input. It is instant, offline, and free. The new AI path fires
**only on a miss**. Clean commands never pay latency or tokens. Full H2 (one
model call per turn, parser deleted) is explicitly deferred; this phase makes
the AI path trustworthy and measurable first.

## Architecture

```
player text
  → parseIntent()                      (regex/alias/fuzzy — unchanged)
  → miss? → resolveIntentWithAI()      (NEW, behind flag; else resolveTargetWithAI)
              ↳ client builds spoiler-safe candidate lists
              ↳ POST /api/ai { op: 'parseAction', ... }
              ↳ server: forced function call, args enum-validated
              ↳ returns ParsedIntent or null (null → keep regex intent)
  → gameEngine.resolve(intent, snapshot)   (unchanged)
  → narration stream                       (unchanged)
```

The new gateway op lives in `server/aiCore.ts` beside `resolveTargetObject` and
inherits its contract: constrained, non-narration, never throws into the turn
loop, `null` on no-confident-match. Worst case on any failure (gateway down,
timeout, invalid tool args) is exactly today's behavior: the original regex
intent proceeds and the engine gives its in-character miss.

## Miss conditions (when the AI parse fires)

- `intent.type === 'other'` — the regex parser understood nothing.
- `intent.type === 'unresolved_target'` — object-like phrase, no id.
- Any verb intent (`move`, `talk`, `take`, `examine`, `use`, `show`, `read`,
  `drop`) with a non-empty `targetRaw` but no resolved `targetId`
  (for `show`/`use`, a missing primary target).
- **Soft miss** (carried over from `resolveTargetWithAI`): an `examine` whose
  resolved object id is not present at this location and not carried.

`query` inputs do **not** route here — world questions stay with narration.
This set is a strict superset of what `resolveTargetWithAI` handles today, so
the new path subsumes it; the old function is deleted at cutover.

Note one asymmetry: every other miss condition above is the AI filling in a
`targetId` on the SAME intent type the regex parser already chose. The
`no_action(question)` case is the exception — it lets the AI *reclassify* a
`type: 'other'` miss into `type: 'query'`, a different intent category
entirely. This is safe (query is narration-only, never a state mutation) and
intentional, but it's worth naming explicitly since it's the one place the AI
changes more than just a target.

## Tool surface

One function declaration per verb, plus an escape hatch:

| Tool | Args (all enum-constrained) |
|---|---|
| `move` | `destination`: location ids |
| `examine` | `target`: present interactables + carried items |
| `talk` | `person`: present NPC ids |
| `take` | `object`: present interactables |
| `use` | `object` (+ optional `with`): present interactables + carried items |
| `show` | `item`: carried items; `person`: present NPC ids |
| `read` | `document`: present interactables + carried items |
| `drop` | `item`: carried items |
| `deduce` | none (raw text passes through as `deductionText`) |
| `no_action` | `reason`: `question` \| `atmospheric` \| `unintelligible` |

`no_action(question)` maps to intent type `query` (narration answers in
character); `atmospheric`/`unintelligible` keep the original regex intent.

## Candidate lists (client-built, spoiler-safe)

The client builds and sends the candidate lists — this is Approach A, chosen
because presence, introduction, and alias state already live client-side:

- **Objects:** current location `interactables` + inventory, as
  `{ id, name }` with display names.
- **People:** `getPresentNpcIds(...)` for this location/act; **alias-masked
  when unintroduced** (`npc.alias` / `aliasDescription`), reusing the exact
  logic in `resolveTargetWithAI` so an unintroduced NPC's real name never
  enters a prompt.
- **Locations:** all location ids + display names (names are public — they
  appear in the sidebar; the engine still rejects illegal moves itself).

The server validates every returned argument against the supplied lists. An id
outside the list → `null` result, never a passthrough. The engine then
re-validates everything again in `resolve()` — two locked doors.

## Gateway call shape

- `api/ai.ts`: new `case 'parseAction'`.
- `server/aiCore.ts`: `parseAction(rawInput, candidates) → ParsedIntent | null`.
  Forced function calling (`toolConfig` mode `ANY`), `thinkingBudget: 0`, same
  `GEMINI_MODEL_ID` env config as every other op. No narration, no story
  knowledge in the prompt beyond the candidate lists.
- `services/AIService.ts`: thin `parseAction` client method, catch-all → `null`.
- Client memoization: reuse the per-session cache pattern, keyed
  `parse::${location}::${act}::${normalised input}`.

## Feature flag

`VITE_AI_PARSER` (Vite env, so per-environment control on Vercel; on in dev via
`.env.local`, off in production until the QA gate passes). Flag on → misses
route to `parseAction`; flag off → current `resolveTargetWithAI` path,
byte-for-byte. No player-facing UI (restraint principle). Cutover = corpus gate
green + one manual playthrough, then: default the flag on in production, and in
a separate commit delete `resolveTargetWithAI` and the flag's off-branch.

## Verification — extend `npm run qa:parser`

`scripts/qa-parser.ts` already measures phrasing→object accuracy in two passes
(deterministic offline; hybrid via `resolveTargetObject` when `GEMINI_API_KEY`
is set). Phase 3 extends it rather than adding a parallel script:

1. **Full-intent fixtures.** New fixture section with whole *commands*, not
   bare nouns — `{ input, sessionState, expected: { type, targetId, ... } }` —
   covering every tool, including move/show/use phrasings and `no_action`
   escapes ("what a dreadful fog" must not become an action).
2. **Tool-call pass** (gateway tier, needs `GEMINI_API_KEY`): routes
   deterministic misses through `parseAction`, asserts expected tool + args,
   and reports combined lift the way the hybrid pass does today.
3. **Fast-path guard** (offline tier): asserts every clean-command fixture
   resolves via regex alone — i.e. would never trigger the AI path — so the
   free path can't silently regress into paid calls.
4. **Zero enum-validation failures** across the run (any tool call returning
   an id outside its candidate list is a hard failure).

Cutover gate: tool-call pass accuracy ≥ the hybrid pass baseline it replaces,
plus items 3 and 4 green, plus one manual playthrough.

## Change scope

| File | Change |
|---|---|
| `server/aiCore.ts` | + `parseAction` op (~100 lines, mirrors `resolveTargetObject`) |
| `api/ai.ts` | + 1 case |
| `services/AIService.ts` | + 1 client method |
| `hooks/useGameState.ts` | + `resolveIntentWithAI` with flag branch at the `resolveTargetWithAI` call site |
| `scripts/qa-parser.ts` | + full-intent fixtures, tool-call pass, fast-path guard |

**Not touched:** `engine/GameEngine.ts`, `engine/intentParser.ts` (shrinking it
is post-cutover work), the narration path, story data files. The manifest's
Phase 3 scaffolding fields (`convergenceFlag`, `playerNpcId`, `hintObjectives`)
are not needed by this design and remain scaffolding; their comments in
`engine/stories/types.ts` should be updated to say "future phases" rather than
"Phase 3" as part of this work.

Reminder for any new `server/` or `api/` imports: relative imports need
explicit `.js` extensions (native ESM loader on Vercel — see the Phase 1
gotcha, PR #18).

## Error handling

- Gateway/network/model failure → `parseAction` resolves `null` → turn
  proceeds with the regex intent (in-character miss). Never blocks a turn.
- Model returns malformed or out-of-enum args → server returns `null` (and the
  QA harness counts it as a hard failure so it can't hide).
- Flag off → zero behavioral change anywhere.
