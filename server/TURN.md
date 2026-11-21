# The turn endpoint (plan §2.2, ADR-0001)

`POST /api/turn` — one request per player turn or Tick. Deployed as `api/turn.ts` (Vercel Node function, `.js`-suffixed relative imports; `qa:lambda-imports` walks it) and mounted on the Vite dev server by `apiDevGateway` in `vite.config.ts`.

## Request
```json
{ "investigationId": "uuid", "text": "look at the clock" }      // a player turn
{ "investigationId": "uuid", "tick": true }                       // an idle Tick from the UI (TICK_MINUTES)
{ "start": { "storyId": "stress", "name": "My first game" } }   // creates an Investigation, returns its id and the opening narration; storyId is the Story's directory name
{ "investigationId": "uuid", "resume": true }                     // reads only: the whole feed and the current view
```
Auth: the client's Supabase JWT in `Authorization: Bearer …` (anonymous users included). The server builds a Supabase client with that token so RLS applies; no service role key.

## Response
NDJSON stream, one object per line, in this order:
1. `{ "kind": "turn", "investigationId": "uuid", "cues": ["clue-discovered", ...], "diary": true }` — sent once the engine's Events are appended, before narration. `investigationId` is how a `start` request learns the id it created; `cues` are the sound ids to play (the client plays the ones it has a file for); `diary` is true when this turn added to the diary (a Clue, or a Read of a document). **The client holds no engine Events**: they would show it Rule ids, flags and who knows what, so it gets only these two derived values (`clientCues` in `server/turn.ts`).
2. `{ "kind": "text", "delta": "..." }` repeated while prose streams.
3. `{ "kind": "done", "narrated": { ...Narrated event }, "observations": [...], "view": PlayerView, "feed": FeedItem[] }` — `view` is the sidebar and diary (names and labels only, `packages/schema/view.ts`); `feed` is this turn's feed blocks, which replace whatever streamed. The client never holds the Story or the State: both would show it the solution.

A resume answers one line, `{ "kind": "resume", "investigationId", "name", "feed": FeedItem[], "view": PlayerView, "busy": boolean }`, with nothing appended. `feed` is built by the same `feedOf` as each turn's `done.feed`, so a second browser renders exactly what the first one saw; `busy` means a turn is still being narrated.
Errors: a single `{ "kind": "error", "message": "..." }` line and HTTP 4xx/5xx before any stream starts; after the stream has started, an `error` line and a closed stream.
- **409** means another turn on this Investigation is still being narrated, or (after three lost races for the next seq) that another request got there first; the two have their own messages. A client sends one turn at a time; an idle Tick that gets 409 is simply dropped.
- **Time limits.** `api/turn.ts` has `maxDuration` 60 s (`vercel.json`); `STALE_TURN_MS` is 75 s, just above it, so a turn still open past that belongs to a dead request and the next one closes it. A client that disconnects mid-stream does not lose the turn: the server stops sending, finishes narrating and appends the real `Narrated`; the client's resume gets it.

## Server steps
0. Start: create the Investigation, then append the opening turn from `startInvestigation(story, seed)`: `InvestigationStarted`, the Clues of any Fact the player starts knowing, and the Rules the opening sets off (`enter` on the opening location, arrivals for everyone there; ADR-0005). It is narrated in `opening` mode.
1. Load the Investigation's Events (ordered by `seq`), `replay` them with the Story loaded from `stories/<storyId>` (fall back to `packages/schema/fixtures/<storyId>` so the toy is playable before real content exists).
   If the log's last row is not `Narrated`/`ObservationRecorded`, a turn is open: answer 409, unless the newest row is older than `STALE_TURN_MS` (the request that owned it died), in which case close it first with a fallback `Narrated` and carry on.
2. Player turn: `candidates(story, state)` → `exactSelection(text, set)` (look, inventory, wait, an exit by an authored name or compass abbreviation, ADR-0003) or else `ai.select({ text, candidates, recentTexts })` → validate the Selection against the set → `resolveTurn`. Tick: `tick(story, state)`.
3. Append the new Events in one call with consecutive `seq`, which also updates `investigations.last_event_seq` and `updated_at` (`append_events`, migration 011). Emit the `turn` line. If another request took that `seq` first (`SeqConflict`, the primary key's 23505), start again from step 1, up to three times, then 409. A `start` whose opening append fails removes the Investigation it just created before answering 500.
4. `buildNarrationContext(story, newState, turnEvents, mode)` with mode `opening` on the first turn, `flavour` for FlavourRequested, `compact` when the turn produced no Fact, Beat, Clue or move, else `full`. `ai.narrate(ctx)`, streaming `text` lines.
5. `gateNarration(ctx, result)`. On rejection, narrate once more with `ctx.beats` prefixed by a line naming the rejected inventions; on a second rejection use the fallback prose: the turn's Beats, then one plain second-person line per Event of substance built from the Story's own names (`fallbackProse`, `packages/engine/projections.ts`; "You take the brass key."). A turn is never silent unless it is quiet.
   A Tick that changed nothing the player can see (no Fact, Beat, Clue, move, act or ending, and the same people present) is **quiet**: no narration call, and an empty `Narrated{text: '', beats: []}` closes it. It costs nothing and adds nothing to the feed or the Transcript.
6. Append `Narrated{text, beats}` and one `ObservationRecorded` per Observation (same seq series), emit `done`. If narration or this append fails, append a `Narrated` holding that fallback prose so the turn closes, then emit `error`.

**Why one turn at a time.** A `Narrated` row belongs to the turn it follows: its row's turn number, and the Transcript of whoever is present at that point in the log, both come from its position. A second turn appended between a turn's engine rows and its `Narrated` would take that narration as its own, so turns are serialised by the log itself rather than retried around each other.

## Persistence
Migration `supabase/migrations/009_event_log.sql` (idempotent, in the house style):
- `investigations`: add `story_id text`, `name text`, `last_event_seq integer not null default -1`. Migration `010_drop_snapshot_engine.sql` (Phase 4) then deletes the old save slots, drops the snapshot columns and the old per-investigation tables, and makes `story_id` and `name` required.
- `events (investigation_id uuid references investigations on delete cascade, seq integer, turn integer, payload jsonb, created_at timestamptz default now(), primary key (investigation_id, seq))` with RLS: owner of the investigation can select/insert; no update or delete.
- Migration `011_log_rpc.sql` adds two `SECURITY INVOKER` functions (so the caller's RLS still decides; granted to `authenticated`, which anonymous users are): `load_investigation(p_id uuid)` returns story id, name, head time and the whole log, ordered by `seq`, as one jsonb value (one row, so PostgREST's row cap does not apply; NULL when missing or not visible), and `append_events(p_id uuid, p_events jsonb)` inserts the batch and sets `last_event_seq` / `updated_at` in one transaction (a duplicate `seq` is still 23505). `supabaseStore` uses these; it also validates every loaded row's payload against `EventPayload` and throws, naming the investigation and `seq`, on a corrupt one. `InvestigationStore.remove` deletes an Investigation (its events cascade).
- Anonymous sign-in must be enabled in the Supabase dashboard (note it in the migration header; it is not SQL). Claiming an account later is `supabase.auth.linkIdentity` / email upgrade on the client; the `owner_id` is unchanged, so nothing moves.

## Out of scope here
The prompts (`packages/ai/prompts.ts`), the gate (`packages/ai/gate.ts`) and any UI. The endpoint must work end to end with the `recorded` provider and the toy fixture, driven by `scripts/qa-turn.ts`.
