# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Behavioral guidelines

Bias toward caution over speed; use judgment on trivial tasks.

- **Think before coding.** State assumptions explicitly; if multiple interpretations exist, present them instead of picking silently. Stop and ask when something is genuinely unclear.
- **Simplicity first.** Minimum code that solves the problem — no speculative abstractions, no unrequested configurability, no error handling for impossible scenarios.
- **Surgical changes.** Touch only what the task requires. Don't refactor or reformat adjacent code. Match existing style. Remove imports/vars *your* change orphaned; leave pre-existing dead code alone (mention it, don't delete it).
- **Goal-driven execution.** Turn tasks into verifiable checks ("fix the bug" → reproduce with a test, then make it pass) so multi-step work can be looped on independently.
- **Never monitor open PRs.** The repo owner is the only developer — there are no reviewers to wait on and no CI feedback loop to babysit. Don't subscribe to PR activity, don't schedule PR check-in reminders, and don't poll PR/CI status. Push the branch, open the draft PR, report it, and stop. Only revisit a PR when explicitly asked.
- **Solo project — deployed, but not "in production" in any way that constrains design.** The owner is the only player as well as the only developer. Don't hedge for other users, don't write save-migration shims or backward-compatibility layers, don't preserve old flag names for existing saves, and don't stage a breaking change behind a flag to protect a live audience. Breaking saves and rewriting story data wholesale are both fine. Still call out when a change breaks saves — the owner may want to start a fresh investigation — just don't design around avoiding it. This changes only when the owner says other people are playing.

## Project overview

**London Bleeds: The Whitechapel Diaries** — a text-adventure set in 1888 London during the Jack the Ripper murders. The player is Dr. Watson, assisting Holmes through six acts of investigation. React + TypeScript SPA (Vite), Gemini for narration, Supabase for auth/cloud saves.

The core architectural bet: **a deterministic TypeScript engine resolves every player action; the AI only narrates outcomes that are already decided.** It cannot invent a clue, exit, or NPC movement — it receives a fully-resolved result object and writes prose around it. Grasping this contract is the prerequisite for touching `engine/`, `services/AIService.ts`, or `server/`.

## Commands

```bash
npm run dev              # Vite dev server on :3000 (mounts /api/ai via a dev middleware, see below)
npm run build             # Production build
npm run lint               # tsc --noEmit — this repo's only lint step
npm run qa:all             # lint + all deterministic qa:* suites — run before considering engine/story work done
```

Individual QA harnesses (all `npx tsx scripts/qa-*.ts`, exit 1 on FAIL, no browser needed):

| Command | Checks | Needs `GEMINI_API_KEY` |
|---|---|---|
| `npm run qa:engine` | Drives `gameEngine.resolve()` with scripted intents; validates state transitions, act-gate logic, exit graph | No |
| `npm run qa:parser` | Free-text → intent accuracy (exact/alias/typo/paraphrase) against every clue-bearing object; regression-gated against a recorded baseline | No (hybrid AI-fallback pass only if key present) |
| `npm run qa:hints` | The Watson hint selector (`hints.ts` / `selectHint`) | No |
| `npm run qa:diary-leads` | The silent-diary-lead detection system | No |
| `npm run qa:validate` | Story-data referential integrity: dangling clue connections, trigger objects missing from their location, progression flags nothing can set, NPC placement gaps, spoiler leaks into public knowledge | No |
| `npm run qa:narration-inject` | The mechanical seam that splices authored opening/act-bridge lines into streamed narration (`narrationFormat.ts` / `injectAfterHeading`) — **not** part of `qa:all`, run it directly after touching that seam | No |
| `npx tsx scripts/qa-narration.ts` | Generates `qa-narration-report.md` from crafted `NarrationContext` fixtures for manual/agent review of prose quality, historical accuracy, spoiler containment | **Yes** |

There is no unit-test framework (no jest/vitest) — correctness is enforced by `tsc --noEmit` plus these scripted QA harnesses. When changing `engine/`, `intentParser.ts`, or any `engine/stories/whitechapel-1888/*` data file, run the relevant `qa:*` script(s) directly rather than asking the user to.

Specialized review subagents exist in `.claude/agents/` and trigger on specific edits — e.g. `engine-logic-reviewer` and `narrative-consistency-reviewer` after touching engine/story files, `engineering-reviewer` after `services/`/`hooks/` changes. Use them instead of re-deriving their checklists by hand.

## Architecture

### Turn pipeline

```
Player input
    │
    ▼
intentParser.ts        — classifies free text into a typed intent (pure function, no side effects)
    │
    ▼
GameEngine.ts           — resolves intent against the story manifest (no AI, no Supabase)
    │                      returns EngineResult: state changes + NarrationContext
    ▼
useGameState.ts          — applies state changes, injects STIM + Holmes synthesis
    │
    ▼
services/AIService.ts    — client: POSTs to /api/ai, streams narrative prose back
    │
    ▼
NarrativeFeed.tsx         — renders streamed markdown with typewriter animation
```

### The engine/AI contract (the one invariant to never break)

- `engine/GameEngine.ts` resolves *all* game logic and must never call AI or touch Supabase. It is a thin facade (`resolve()`) dispatching to per-verb resolvers in `engine/resolvers/` (`move.ts`, `examine.ts`, `npc.ts`, `items.ts`, `deduce.ts`, `meta.ts`, `support.ts`).
- The AI's `NarrationContext` carries only verified, already-resolved facts (locations, NPCs present, objects, exits, clues found). AI responses may only contain `markdownOutput` prose plus optional `npcMemoryUpdate` / `stimUpdate` — **never** a state mutation like `newLocationId` or `inventoryUpdate`. The one narrow exception is `parseAction()` (see below), which selects from candidate lists rather than mutating anything.
- `hooks/useGameState.ts` is the only place that calls both the engine and the AI service and merges their results into React state.

### Client/server split for the AI key

`GEMINI_API_KEY` must never reach the browser bundle. The actual Gemini prompts, schemas, and calls live in **`server/aiCore.ts`** (imports `@google/genai` directly) and **`server/parseAction.ts`** (pure, offline-testable candidate-validation logic for the tool-calling parse fallback). This runs only where the key is a real server env var: the Vercel function `api/ai.ts`, the Vite dev-server middleware defined in `vite.config.ts` (`aiDevGateway`, mounted at `/api/ai` so `npm run dev` works without `vercel dev`), and the Node `qa:*` scripts.

`services/AIService.ts` (client-side) is a thin `fetch` wrapper around `/api/ai` with the same public method signatures as the server core — never import `server/aiCore.ts` from client code.

### Story data is a swappable manifest

`engine/stories/whitechapel-1888/` holds every fact about this specific story (locations, NPCs, clues, suspects, acts, facts, world events, rumors). Individual files (`locations.ts`, `npcs.ts`, `clues.ts`, `suspects.ts`, `acts.ts`, `facts.ts`, `events.ts`, `rumors.ts`, `hints.ts`, `diaryLeads.ts`, `endings.ts`, `atmosphere.ts`, `diary*.ts`) are composed into one `StoryManifest` object in `manifest.ts`. **No engine file imports whitechapel-1888 data directly** — `GameEngine`'s constructor takes a `StoryManifest`, so the whole story is theoretically pluggable. Shared type contracts for any story live in `engine/stories/types.ts`.

Key systems encoded in that manifest worth knowing before editing story data:
- **Fact graph** (`facts.ts`): world knowledge as atomic `StoryFact`s (`knownBy`, `visibleFromAct`). NPC knowledge envelopes are *derived* from this graph (`engine/stories/knowledge.ts`), so one edit updates every NPC's dialogue consistently and spoiler gating is mechanical, not hand-maintained per NPC.
- **NPC placement**: `scheduleByAct` (act → `{ default, byPeriod? }`) drives where an NPC is each turn; an act with no entry means offstage. `followingRule` (`follows_watson` / `follows_bond` / `location_based` / `fixed`) plus `followsUntilAct` covers companions.
- **NPC introduction/alias system**: NPCs with `requiresIntroduction` show only `alias` until an `introduction` condition (self-introduces on first talk, or a `document` examine) flips it — the narration system prompt hard-enforces never leaking the real name early.
- **Rumor propagation** (`rumors.ts`): fully-authored hop lists — `triggerFlag` fires, then each `spread` entry lands in a recipient NPC's knowledge after `delayPeriods` time-period boundaries. Nothing is generated; every hop is hand-written.
- **World events** (`events.ts`): authored broadcasts that surface as blockquotes once the in-game clock passes `atClockMinutes`, delivered once via a flag.
- **Act progression**: gated by `ACT_PROGRESSION` flag requirements; entering a new act auto-teleports Watson to that act's anchor location (`computeActEntry` in `engine/resolvers/support.ts`) and carries following NPCs along.
- **Time/weather**: `engine/time.ts` computes `TimePeriod` from elapsed minutes; `engine/presence.ts` resolves NPC location and rumor maturation for a given moment. Locations can have `openPeriods` (closed otherwise, with an authored `lockedNote`).

`npm run qa:validate` is the referential-integrity net over all of this — run it after any story-data edit, since these cross-references (clue triggers, flag gates, fact visibility, NPC schedules) are otherwise easy to break silently.

### Narration modes

`server/aiCore.ts` builds one of three prompt shapes per turn (`opening` / `full` / `compact`) depending on `NarrationContext.narrationMode`, each with its own word budget and structure (see `buildNarrationPrompt`). After clue discoveries, `consultHolmesMultiClue` makes a separate non-streaming call synthesizing all evidence, injected into the next narration prompt as `holmesSynthesis`. Note: the sanity mechanic was **removed** from the live engine (see `engine/session.ts` and `docs/game-design.md`) — Watson's register is fixed at the professional-composure baseline; ignore residual sanity references in README.md and the `.claude/skills/` docs.

### Hooks decomposition

`hooks/useGameState.ts` is the orchestrator; it was deliberately split ("god-file split", see recent commit history) into focused hooks under `hooks/gameState/`: `useConnections` (Gemini/Supabase connectivity), `useAppearance` (theme/audio prefs), `useDiary`, `useSceneStreams` (narration streaming), `usePersistence` (save/load), `useActBreak` (act-transition curtain), plus `aiParse.ts` / `narration.ts` helpers. Follow this pattern — new cross-cutting state concerns should be their own hook module, not new bulk added back into `useGameState.ts`.

### Data layer

`services/GameRepository.ts` is the sole Supabase access point (investigations, profiles, save slots, diary entries) — RLS-scoped per user. `supabase.ts` sets up the client; connectivity checks use a direct `fetch` to GoTrue's `/auth/v1/health` rather than the SDK, to avoid false "disconnected" reads during token refresh (see `useConnections.ts`).

## Environment

```env
GEMINI_API_KEY=            # server-only — never exposed to the client
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_AI_PARSER=             # unset/anything but 'off' = AI parse fallback ON; 'off' = pure regex parsing (emergency rollback)
```

**Getting `GEMINI_API_KEY` when a task needs it** (`qa:narration`, the hybrid `qa:parser` pass, any live AI path): copy it from the `.env` on the repo owner's main checkout — don't ask for it. Never paste the key into a tracked file, a commit, a PR body, or terminal output; write it only to a local `.env` (gitignored).

Note for cloud sessions: that `.env` is untracked and local to the owner's machine, so it is *not* reachable from a Claude Code on the web container — `origin/main` carries only `.env.example`. In a cloud session, either the key is set as an environment variable in the remote environment's configuration (preferred — every future session inherits it, nothing to copy) or the key-dependent suites simply can't run there. Every `qa:*` suite except `qa:narration` and the `qa:parser` AI-fallback pass runs fine without it, so report the skip rather than treating it as a blocker.

Path alias `@/*` → repo root (`tsconfig.json`, mirrored in `vite.config.ts`). Supabase schema lives in `supabase/migrations/*.sql`, applied in order via the Supabase SQL editor.
