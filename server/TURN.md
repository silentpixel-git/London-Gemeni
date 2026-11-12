# The turn endpoint (plan §2.2, ADR-0001)

`POST /api/turn` — one request per player turn or Tick. Deployed as `api/turn.ts` (Vercel Node function, `.js`-suffixed relative imports; `qa:lambda-imports` walks it) and mounted on the Vite dev server by `apiDevGateway` in `vite.config.ts`.

## Request
```json
{ "investigationId": "uuid", "text": "look at the clock" }      // a player turn
{ "investigationId": "uuid", "tick": true }                       // an idle Tick from the UI (TICK_MINUTES)
{ "start": { "storyId": "locked_study", "name": "My first game" } } // creates an Investigation, returns its id and the opening narration
{ "investigationId": "uuid", "resume": true }                     // reads only: the whole feed and the current view
```
Auth: the client's Supabase JWT in `Authorization: Bearer …` (anonymous users included). The server builds a Supabase client with that token so RLS applies; no service role key.

## Response
NDJSON stream, one object per line, in this order:
1. `{ "kind": "events", "events": [...EventPayload], "seqFrom": n }` — everything the engine appended for this turn, before narration.
2. `{ "kind": "text", "delta": "..." }` repeated while prose streams.
3. `{ "kind": "done", "narrated": { ...Narrated event }, "observations": [...], "view": PlayerView, "feed": FeedItem[] }` — `view` is the sidebar and diary (names and labels only, `packages/schema/view.ts`); `feed` is this turn's feed blocks, which replace whatever streamed. The client never holds the Story or the State: both would show it the solution.

A resume answers one line, `{ "kind": "resume", "investigationId", "name", "feed": FeedItem[], "view": PlayerView, "busy": boolean }`, with nothing appended. `feed` is built by the same `feedOf` as each turn's `done.feed`, so a second browser renders exactly what the first one saw; `busy` means a turn is still being narrated.
Errors: a single `{ "kind": "error", "message": "..." }` line and HTTP 4xx/5xx before any stream starts; after the stream has started, an `error` line and a closed stream.
- **409** means another turn on this Investigation is still being narrated. A client sends one turn at a time; an idle Tick that gets 409 is simply dropped.

## Server steps
0. Start: create the Investigation, then append the opening turn from `startInvestigation(story, seed)`: `InvestigationStarted`, the Clues of any Fact the player starts knowing, and the Rules the opening sets off (`enter` on the opening location, arrivals for everyone there; ADR-0005). It is narrated in `opening` mode.
1. Load the Investigation's Events (ordered by `seq`), `replay` them with the Story loaded from `stories/<storyId>` (fall back to `packages/schema/fixtures/<storyId>` so the toy is playable before real content exists).
   If the log's last row is not `Narrated`/`ObservationRecorded`, a turn is open: answer 409, unless the newest row is older than `STALE_TURN_MS` (the request that owned it died), in which case close it first with a fallback `Narrated` (step 5) and carry on.
2. Player turn: `candidates(story, state)` → `exactSelection(text, set)` (look, inventory, wait, an exit by an authored name or compass abbreviation, ADR-0003) or else `ai.select({ text, candidates, recentTexts })` → validate the Selection against the set → `resolveTurn`. Tick: `tick(story, state)`.
3. Append the new Events in one insert with consecutive `seq`; update `investigations.last_event_seq`. Emit the `events` line. If another request took that `seq` first (`SeqConflict`, the primary key's 23505), start again from step 1, up to three times, then 409.
4. `buildNarrationContext(story, newState, turnEvents, mode)` with mode `opening` on the first turn, `flavour` for FlavourRequested, `compact` when the turn produced no Fact, Beat, Clue or move, else `full`. `ai.narrate(ctx)`, streaming `text` lines.
5. `gateNarration(ctx, result)`. On rejection, narrate once more with `ctx.beats` prefixed by a line naming the rejected inventions. On a second rejection the prose is the fallback: the Beats when the turn has any; on a turn with none, the Facts it told the player (in the speaker's voice), else the narrator's sentences that pass the gate on their own from an attempt that invented no name, else a fixed miss line for a rejected intent or the names of what the turn touched. Nothing a model wrote that failed the gate, and nothing the selection model wrote, reaches the log. The gate judges against the context's labels, names, places, beats, facts, Observations and the Story's lexicon; the clock's and the elapsed minutes' numbers count only as a time ("gone eight", "fifteen minutes"). It reads nothing the player wrote, and of what a model wrote only Observations, each of which must pass the strict check (its first word too) or is dropped before it becomes canon. Not the turn's Events, and not the Transcript. A declined Selection is logged with the engine's fixed reason, never the selection model's.
   A Tick that changed nothing the player can see (no Fact, Beat, Clue, move, act or ending, and the same people present) is **quiet**: no narration call, and an empty `Narrated{text: '', beats: []}` closes it. It costs nothing and adds nothing to the feed or the Transcript.
6. Append `Narrated{text, beats}` and one `ObservationRecorded` per Observation (same seq series), emit `done`. If narration or this append fails, append the fallback `Narrated` so the turn closes, then emit `error`.

**Why one turn at a time.** A `Narrated` row belongs to the turn it follows: its row's turn number, and the Transcript of whoever is present at that point in the log, both come from its position. A second turn appended between a turn's engine rows and its `Narrated` would take that narration as its own, so turns are serialised by the log itself rather than retried around each other.

## Persistence
Migration `supabase/migrations/009_event_log.sql` (idempotent, in the house style):
- `investigations`: add `story_id text`, `name text`, `last_event_seq integer not null default -1`. Migration `010_drop_snapshot_engine.sql` (Phase 4) then deletes the old save slots, drops the snapshot columns and the old per-investigation tables, and makes `story_id` and `name` required.
- `events (investigation_id uuid references investigations on delete cascade, seq integer, turn integer, payload jsonb, created_at timestamptz default now(), primary key (investigation_id, seq))` with RLS: owner of the investigation can select/insert; no update or delete.
- Anonymous sign-in must be enabled in the Supabase dashboard (note it in the migration header; it is not SQL). Claiming an account later is `supabase.auth.linkIdentity` / email upgrade on the client; the `owner_id` is unchanged, so nothing moves.

## Out of scope here
The prompts (`packages/ai/prompts.ts`), the gate (`packages/ai/gate.ts`) and any UI. The endpoint must work end to end with the `recorded` provider and the toy fixture, driven by `scripts/qa-turn.ts`.
