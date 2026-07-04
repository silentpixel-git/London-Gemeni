# London Bleeds — Rebuild-from-Scratch Brainstorm & Improvement Backlog

## Context

Brainstorming exercise (no code). Question: if London Bleeds were rebuilt from scratch, what would we do differently across three axes — (1) modern AI integration, (2) a more dynamic/easily changeable story, (3) a more alive, explorable world — plus a candid pros/cons assessment of the current setup and a ranked list of low-hanging fruit for the *current* game.

Based on a full codebase exploration: `engine/GameEngine.ts` (~1,600 lines), `engine/intentParser.ts` (~750), `hooks/useGameState.ts` (~1,730), `services/AIService.ts` (~790), story data in `engine/stories/whitechapel-1888/` (~2,600 lines / 196 KB across 13 files), Supabase persistence, Gemini 3 Flash narration, Vercel hosting.

---

## Part 1 — Pros and cons of the current setup

### Pros (things worth keeping in any rebuild)

1. **The engine/AI contract.** Engine resolves deterministically; AI narrates verified facts only. This is the single best decision in the codebase — no hallucinated exits, no AI-granted clues, testable without API calls. Any rebuild should keep this as the load-bearing wall.
2. **Structured narration context.** Typed `NarrationContext` + JSON-schema output + static system prompt (prefix caching) is a genuinely modern, cost-conscious prompt architecture.
3. **Anti-repetition machinery.** STIM observations, recent-openings memory, NPC memory, rotating idle behaviors — this is ahead of most AI-narrated games.
4. **Graceful degradation.** Local-storage fallback when Supabase is down; fast deterministic parser path with AI only as fallback.
5. **Design discipline.** The game-direction principles (restraint in UI, silent mechanics, no system voice) are consistently applied and documented.

### Cons (structural weaknesses)

1. **Story is compiled into the app.** All content lives in TS constants; every typo fix is a redeploy. The engine hardcodes Whitechapel imports (`gameData.ts` barrel, `selectHint` direct import, `follows_watson`/`follows_bond` special cases) — a second story needs engine surgery, not just data.
2. **Magic-string flag state machine.** Progression, introductions, and gates all hinge on exact string matches (`examined_millers_court_burned_clothing`). A typo = silent gate failure. No type safety, no startup validation.
3. **No automated consistency checking.** Dangling clue `connections`, spoiler leakage into NPC `publicKnowledge`, missing `canonicalLocationByAct` entries, trigger-object name mismatches — all only caught by playtesting. Authoring one clue touches 3–5 files.
4. **God files.** `GameEngine.ts` and `useGameState.ts` each own too much (all resolvers; all state + orchestration + persistence + act-break choreography). Hard to test in isolation.
5. **Knowledge duplicated as prose.** NPC knowledge envelopes are hand-written prose arrays with ~40% overlap between NPCs; adding a clue means manually editing several envelopes and hoping nothing contradicts.
6. **Static world within an act.** NPCs snap to one canonical location per act; nothing moves or happens unless Watson acts. Revisit prose and vignettes soften this, but the world is fundamentally a stage set that reconfigures only at act breaks.
7. **AI-fallback parser latency.** Paraphrased input ("look at the ashes") misses the regex parser and costs a 2–3s Gemini round-trip; if Gemini is down, the turn blocks.
8. **Known bugs/risks.** NPC memory is persisted but not rehydrated on session resume (NPCs forget you); `GEMINI_API_KEY` is injected via Vite `define`, which bakes it into the client bundle (needs verification, but there is no server layer in this SPA); model pinned to a preview ID (`gemini-3-flash-preview`) with no fallback; no rate limiting.

---

## Part 2 — If rebuilding from scratch: key changes, ranked

### HIGH impact / would fundamentally change the game

**H1. Server-side AI gateway (edge function) instead of client-direct Gemini.**
All LLM calls go through a thin serverless layer (Vercel function or Supabase Edge Function). Buys: secret stays server-side, per-user rate limiting, response caching, token metering, provider swap without redeploying the client, and server-side prompt logging for QA. This is table stakes for a modern AI app and unlocks most other AI ideas below.

**H2. One AI turn with tool/function calling instead of parse→resolve→narrate pipeline.**
Modern models handle structured tool use natively. The turn becomes: player text → model call with tools like `move(location)`, `examine(object)`, `ask(npc, topic)` constrained to engine-verified enums → engine executes the tool deterministically → same call (or a chained one) streams the narration of the *engine's* result. The engine/AI contract survives intact — the AI still can't invent state, because tool arguments are validated against the world — but you delete ~750 lines of regex/fuzzy parser, the AI-fallback latency path, and the entire class of "parser didn't understand me" friction. Free-text like "check under the bed" or "ask Bond about the kidney" just works. Cost: one model call per turn instead of zero on the happy path — mitigated by a fast/cheap model tier for parsing and caching.

**H3. Story as validated data, engine as generic runtime.**
Story content in JSON/YAML (or TS that compiles to it) with a schema (e.g., Zod): locations, NPCs, clues, acts, gates, endings. Engine loads a story manifest at runtime; nothing Whitechapel-specific in engine code (follow rules, hints, deduction mechanics all declared per-story). A build-time validator enforces referential integrity (every clue connection resolves, every trigger object exists, every gate flag is settable, every NPC has a location for every act) and a **spoiler linter** (facts tagged with earliest-act visibility; the validator refuses knowledge that leaks early). This makes the story *changeable by editing data*, enables a second story, and kills the largest current bug class.

**H4. Structured fact/knowledge graph instead of prose knowledge envelopes.**
Model world knowledge as atomic facts: `{ id, statement, knownBy: [npcIds], visibleFromAct, spoilerLevel, relatedClues }`. NPC envelopes are *derived views* (facts where `knownBy` includes the NPC and act gate passes), rendered into the prompt per turn. One edit updates all NPCs consistently; spoiler gating becomes mechanical; the reweave-style "who knows what when" choreography becomes queryable instead of hand-maintained prose. This also enables retrieval: pick the 8 most relevant facts for a question by embedding similarity instead of keyword matching.

**H5. NPC schedules + a light simulation tick (the living-world core).**
Replace `canonicalLocationByAct` with time-of-day schedules (`abberline: 09:00 h_division, 14:00 dorset_street, ...`). The in-game clock already advances per action — let it drive the world: NPCs move, a WAIT verb becomes meaningful, arriving at the mortuary at night finds it locked with the attendant at the pub. Add a small scripted-event scheduler (an inquest at 2pm, a newspaper edition at dawn, a crowd gathering after a rumor) that fires world events into the narration as blockquotes whether or not Watson is "on time." Crucially this stays deterministic and silent — it serves the fiction (Principle 4: works without a tutorial) and creates the feeling that Whitechapel exists when Watson isn't looking.

### MID impact / strong upgrades, same game shape

**M1. Rumor/knowledge propagation.** When Watson tells (or shows) something to an NPC, that fact enters the fact graph as `knownBy` them — and select facts diffuse along declared social edges over in-game time (Lusk hears what the pub heard). NPCs reacting to what Watson did yesterday is the cheapest way to make the world feel alive, and it's pure engine logic (H4 makes it nearly free).

**M2. AI as director, not just narrator.** A low-frequency "director" call (every N turns or at act boundaries) that picks from *authored* options: which vignette to play, which ambient thread to advance, when Edmund gets a presence beat. Engine still gates everything; the AI chooses among safe options for pacing. This deepens replay variety without loosening the no-hallucination rule.

**M3. Provider-agnostic AI layer.** Build on an abstraction (e.g., Vercel AI SDK) rather than the Gemini SDK directly: model per task (cheap/fast for target resolution and hints, stronger for narration and Holmes synthesis), configured fallback chain, no pinned preview IDs.

**M4. Event-sourced game state.** Persist an append-only event log (`ClueDiscovered`, `ActAdvanced`, `NpcTold`, ...) with state derived from it, instead of a mutable flag bag. Buys: replayable sessions for QA, trivially correct save/resume, time-travel debugging of narration issues, and the diary becomes a *rendering* of the event log instead of a fourth parallel data source.

**M5. Automated narration QA in CI.** LLM-as-judge harness scoring sampled narrations against the existing rubric (voice, spoilers, anachronisms, repetition), plus a scripted full playthrough. The manual `qa-narration-report.md` becomes a generated artifact. Protects the game's core asset — prose quality — during content changes.

**M6. Topic-based dialogue (ASK ABOUT) built on the fact graph.** Already scoped in Phase 2 docs; in a rebuild it falls out of H4 naturally — topics are fact clusters, "what can this NPC say about X" is a query.

### LOW impact / nice-to-have in a rebuild

- **L1. Authoring/preview tool.** A simple internal web editor over the story schema with live validation and "narrate this scene" preview. Only worth it once a second story is real.
- **L2. Ambient audio driven by world state** (weather/time/location already exist as data; wire them to the audio manifest declaratively).
- **L3. Multi-model narration variety** — e.g., distinct model/temperature profiles for Watson prose vs. NPC voices.
- **L4. Visual deduction board** (corkboard of clue connections — the `connections` data already exists). Flagged low because it strains the UI-restraint principle; would need a diegetic framing (Watson's desk).
- **L5. Illustrations** (pre-generated, act-gated location plates; consistent with the period aesthetic; never runtime-generated).

### What a rebuild should NOT change

- The engine-resolves/AI-narrates contract.
- The restraint principles: no minimaps, no progress bars, no system voice, silent mechanics.
- The contained six-act structure — dynamic ≠ procedural. The murder, murderer, and clue chain stay authored; dynamism goes into *texture* (schedules, rumors, pacing), not plot generation. AI-generated plot would destroy the literary-detective identity.

---

## Part 3 — Low-hanging fruit for the CURRENT game, ranked

### HIGH (bugs, security, or big payoff for small effort)

1. **Verify and fix the Gemini API key exposure.** `vite.config.ts` injects `GEMINI_API_KEY` via `define`, which compiles it into the shipped client bundle of a public Vercel site. If confirmed: move Gemini calls behind a Vercel serverless function or Supabase Edge Function (also enables rate limiting). Highest priority item on this list.
2. **Fix NPC memory rehydration on resume.** `npc_states.memory` is written to Supabase but not loaded back in `loadInvestigationIntoState` (`hooks/useGameState.ts`) — NPCs forget all prior conversations after a reload. Small fix, direct player-facing continuity win.
3. **Build a story-data validator** (`npm run qa:validate`, matching the existing `qa:*` script pattern): every clue `connection` resolves; every `triggerObject` exists in its location's `interactables`; every `ACT_PROGRESSION` flag is derivable from engine naming conventions; every NPC has `canonicalLocationByAct` coverage for acts they appear in; every `scriptedLines.triggerFlag` is settable; no NPC `publicKnowledge` references act-gated spoilers. This mechanically kills the top authoring-error class before the Phase 1 reweave lands (which doubles the NPC count and multiplies these risks).
4. **Unpin the model ID.** `gemini-3-flash-preview` is hardcoded in `AIService.ts`; move to env config with a stable fallback so a Google preview sunset doesn't brick the live game.

### MID (clear wins, a bit more work)

5. **Type-safe flags via TypeScript template literal types.** Flags follow conventions (`examined_${LocationId}_${ObjectId}`, `talked_to_${NpcId}_at_${LocationId}`) — encode them as template-literal types over the existing ID unions so typos become compile errors. No runtime change, large error-class eliminated.
6. **Cheapen the AI-fallback resolver path.** Add a synonym/paraphrase alias table for common nouns ("ashes" → `burned_clothing`) and raise fuzzy-match tolerance before falling through to the 2–3s Gemini call; make the fallback non-blocking with a clean in-character miss ("I could find no such thing") when the API is unavailable.
7. **Delete legacy `services/geminiService.ts`** (old schemas, duplicated JSON-escape state machine; only the connectivity ping is still used — move it into `AIService`). Pure debt removal.
8. **Split the god files.** Extract `GameEngine.ts` resolvers into per-action modules and pull persistence + act-break choreography out of `useGameState.ts`. No behavior change; makes everything after it (including the reweave) safer.
9. **Author the Act VI closing scene at 221B.** Already flagged as missing in `docs/game-design.md` — the true ending currently lacks its final Watson/Holmes exchange. Content-only, high narrative payoff.
10. **Consolidate diary sources.** Diary content lives in four files (`diary.ts`, `diaryLocations.ts`, `diaryDecisions.ts`, `diaryLeads.ts`) plus `clues.ts` — merge behind one lookup module so editing an entry doesn't require knowing which file owns it.

### LOW (polish)

11. **Diary search/filter** in `DiaryModal` (by act, entry kind, text) — playthrough diaries get long.
12. **Token metering** via the SDK's `countTokens` instead of the 4-chars-per-token heuristic; log real per-turn cost.
13. **Variable typewriter cadence** (pause at punctuation, faster in dialogue) or a "skip animation" setting.
14. **Mobile swipe to open/close the sidebar.**
15. **Guard the "prasarved" smoking gun.** The intentional misspelling appears in 4+ places and a well-meaning typo fix would break the mystery — add a comment at each site or a validator check asserting the misspelling is intact (pairs with item 3).

---

## Part 4 — How to proceed: rebuild in place, not a new project

**Decision: incremental rebuild inside the existing repo (strangler-fig), keeping the UI as-is.** A fresh repo would re-create working infrastructure (UI, Supabase auth/saves, audio) for no gain, risk losing accumulated fixes, and leave the game unplayable during the port. The existing typed seams — `EngineResult` (engine→UI) and `NarrationContext` (engine→AI) — let the backend be replaced piece by piece behind stable interfaces while the game stays shippable.

### Phasing (each phase ships independently; game playable throughout)

- **Phase 0 — Safety net.** Story-data validator (`qa:validate`), engine regression tests, fix the API-key exposure and NPC-memory-rehydration bugs. Protects everything after.
- **Phase 1 — AI gateway.** All Gemini calls behind a serverless function (Vercel function or Supabase Edge Function). No gameplay change; unlocks rate limiting, caching, metering, model swapping.
- **Phase 2 — Story as data + fact graph.** Extract Whitechapel content into schema-validated data (H3) with the atomic-fact knowledge model (H4); engine becomes a generic runtime. Phase 0 validator proves the migration lost nothing.
- **Phase 3 — Tool-calling turn loop (H2).** New parser path behind a feature flag alongside the old regex parser; compare on real inputs before cutover. In-place refactoring elsewhere, but this phase runs old/new in parallel.
- **Phase 4 — Living world (H5, M1).** NPC time-of-day schedules, simulation tick, scripted world events, rumor propagation.

UI stays untouched throughout; the LOW-tier UI polish items (diary search, diegetic deduction board, typewriter cadence) can slot in anytime without blocking backend phases.

## Verification

Brainstorming/strategy only — no code to verify yet. When Phase 0 starts: confirm the key is present in the built `dist/` bundle; run the new `qa:validate` script against current story data (it will likely surface real dangling references immediately); reproduce the NPC-memory loss by saving, reloading, and asking an NPC about a prior conversation.