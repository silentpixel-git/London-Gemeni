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

**London Bleeds: The Whitechapel Diaries** — a text adventure set in 1888 London during the Jack the Ripper murders. React + TypeScript SPA (Vite), Gemini for narration, Supabase for auth and storage, Vercel for hosting.

The engine is mid-rebuild (`docs/engine-rebuild-plan.md`). Phases 0–4 are done: a story-agnostic engine runs on the server and the UI renders what it says. The Whitechapel story is not yet authored for it (Phase 6), so new games start on the stress fixture, "The Saltmarsh Light". The last commit with the old engine and the Whitechapel story as TypeScript is on the `archive/pre-phase4-engine` branch; Phase 6 reads its source material from there.

Read before touching `packages/`, `server/` or `api/`, in this order: `GLOSSARY.md` (the vocabulary: Story, Fact, Flavour, Rule, Event, Investigation, Candidate Set), the plan, `docs/adr/0001`–`0004`, `server/TURN.md` (the turn endpoint's contract), `packages/schema/README.md`.

**The invariant:** the engine decides, the AI narrates. Every Fact (a clue, an exit, where a thing or person is, who knows what) is created only by the engine. The narrator may improvise Flavour, which is recorded as an Observation, and the server-side invention gate rejects names and numbers the turn's context does not hold. The engine stays general: content that does not fit asks "what general mechanism is missing?", never for a story-shaped special case.

## Commands

```bash
npm run dev       # Vite on :3000; apiDevGateway in vite.config.ts serves POST /api/turn
npm run build     # qa:story, then vite build
npm run lint      # tsc --noEmit, the only lint step
npm run qa:all    # lint + every deterministic suite; run before calling engine or story work done
```

There is no unit-test framework; correctness is `tsc` plus scripted `qa:*` harnesses (`npx tsx scripts/qa-*.ts`, exit 1 on any FAIL). Run the relevant ones yourself after a change.

| Suite | What it guards |
|---|---|
| `qa:story` | Story schema and referential integrity (`packages/schema/validate.ts`) over the fixtures and every `stories/*`. Build-blocking |
| `qa:core` | The engine's behavioural spec: every verb and Trigger kind on the toy Story, exact replay. Change it only when the behaviour is meant to change |
| `qa:prove` | The reachability prover: every act, Clue and ending of the toy REACHABLE; the `unsolvable` fixture UNREACHABLE on exactly the goals its missing key gates |
| `qa:stress` | The story-neutral stress fixture: behaviour the toy cannot reach (companion, closed periods, delayed rumor, rule-unlocked paths, timing) |
| `qa:gate` | The invention gate (`packages/ai/gate.ts`) |
| `qa:turn` | `server/turn.ts` in-process with the memory store and recorded AI: NDJSON order, seq, view and feed, resume, quiet Ticks, the fast path, one-turn-at-a-time. Recordings are keyed by a hash of the AI's input, so any engine, projection or schema change needs `npx tsx scripts/qa-turn.ts --author` and the rewritten recordings committed |
| `qa:lambda-imports` | `api/turn.ts` runs as native Node ESM, file by file: every relative import reachable from it must be `.js`-suffixed or type-only, or the function dies at load. Nothing else catches this |
| `qa:browser` | Phase 4 acceptance: the real app in Chromium plays Acts 0–I of the stress fixture through the real `handleTurn`; a second browser and a reload must render an identical feed and sidebar. Supabase and the AI are stood in for in-process. Needs Playwright + Chromium; not in `qa:all` |
| `scripts/smoke-gemini.ts` | One live select and narrate against Gemini. Needs `GEMINI_API_KEY`; in a cloud session run it with `NODE_USE_ENV_PROXY=1` |

## Architecture

```
browser                     api/turn.ts → server/turn.ts                  packages/
  text / tick / resume ──▶  load log → replay → candidates → exactSelection   engine: reducer, verbs, Rules, Ticks,
  ◀── NDJSON: events,       or ai.select → resolveTurn → append Events          prover, projections (no I/O, no AI)
      text*, done{view,feed} → narrate → gate → append Narrated/Observations  ai: select/narrate seam, Gemini adapter
                                                                            schema: Zod contracts, validator
```

- **`packages/`** is the engine. `engine` imports only `schema`; nothing in `engine` imports `ai`. A Story is data (`packages/schema/fixtures/*`, later `stories/*`), validated by `schema`.
- **`server/turn.ts`** is the one writer of an Investigation's Event log (`server/investigationStore.ts`: memory for QA, Supabase under the caller's RLS for the app). One turn at a time per Investigation; the contract, including 409 and stale-turn recovery, is in `server/TURN.md`.
- **The client never holds a Story or the State** (either would show it the solution). It receives a `PlayerView` and `FeedItem`s (`packages/schema/view.ts`), built server side by `playerView` / `feedOf` from the log. `hooks/useInvestigation.ts` is the client's game state; `services/turnClient.ts` speaks NDJSON; `services/InvestigationRepository.ts` lists and deletes Investigations. New cross-cutting client state gets its own hook, as `hooks/gameState/` does.
- **Auth:** guests are Supabase anonymous users; magic-link sign-in from a guest claims the account in place (`updateUser`, same user id). `services/GameRepository.ts` is now profiles only.

## Stale tooling

These still describe the old engine (`engine/`, `useGameState`, `aiCore`, the Whitechapel TypeScript story) and need rewriting before they are trusted: the agents `engine-logic-reviewer`, `narrative-consistency-reviewer`, `story-integrity-reviewer`, `qa-playthrough` and `engineering-reviewer` in `.claude/agents/`, and the skills `act-authoring`, `add-npc` and `narration-voice-check` in `.claude/skills/`. `game-reviewer`, `game-direction` and `historian` are engine-independent. README.md also predates the rebuild.

## Environment

`.env.example` lists every variable. Two rules it cannot state:
- `GEMINI_API_KEY` is server-only and never reaches the browser bundle. In cloud sessions the key may be a network secret the proxy injects: give it any placeholder value.
- Supabase schema lives in `supabase/migrations/*.sql`, applied in order by the owner in the SQL editor; write migrations, do not apply them.

Path alias `@/*` → repo root (`tsconfig.json`, mirrored in `vite.config.ts`).
