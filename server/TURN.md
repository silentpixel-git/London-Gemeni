# The turn endpoint (plan §2.2, ADR-0001)

`POST /api/turn` — one request per player turn or Tick. Deployed as `api/turn.ts` (Vercel Node function, `.js`-suffixed relative imports; `qa:lambda-imports` must walk it too) and mounted on the Vite dev server exactly as `/api/ai` is.

## Request
```json
{ "investigationId": "uuid", "text": "look at the clock" }      // a player turn
{ "investigationId": "uuid", "tick": true }                       // an idle Tick from the UI (TICK_MINUTES)
{ "start": { "storyId": "locked_study", "name": "My first game" } } // creates an Investigation, returns its id and the opening narration
```
Auth: the client's Supabase JWT in `Authorization: Bearer …` (anonymous users included). The server builds a Supabase client with that token so RLS applies; no service role key.

## Response
NDJSON stream, one object per line, in this order:
1. `{ "kind": "events", "events": [...EventPayload], "seqFrom": n }` — everything the engine appended for this turn, before narration.
2. `{ "kind": "text", "delta": "..." }` repeated while prose streams.
3. `{ "kind": "done", "narrated": { ...Narrated event }, "observations": [...], "state": { "act", "location", "clock", "period", "weather", "inventory": [ids], "personsPresent": [ids], "ended" } }` — a small view for the sidebar; the client never needs the full State.
Errors: a single `{ "kind": "error", "message": "..." }` line and HTTP 4xx/5xx before any stream starts; after the stream has started, an `error` line and a closed stream.

## Server steps
1. Load the Investigation's Events (ordered by `seq`), `replay` them with the Story loaded from `stories/<storyId>` (fall back to `packages/schema/fixtures/<storyId>` so the toy is playable before real content exists).
2. Player turn: `candidates(story, state)` → `ai.select({ text, candidates, recentTexts })` → validate the Selection against the set → `resolveTurn`. Tick: `tick(story, state)`.
3. Append the new Events in one insert with consecutive `seq`; update `investigations.last_event_seq`. Emit the `events` line.
4. `buildNarrationContext(story, newState, turnEvents, mode)` with mode `opening` on the first turn, `flavour` for FlavourRequested, `compact` when the turn produced no Fact, Beat, Clue or move, else `full`. `ai.narrate(ctx)`, streaming `text` lines.
5. `gateNarration(ctx, result)`. On rejection, narrate once more with `ctx.beats` prefixed by a line naming the rejected inventions; on a second rejection use `ctx.beats.join(' ')` as prose.
6. Append `Narrated{text, beats}` and one `ObservationRecorded` per Observation (same seq series), emit `done`.

## Persistence
Migration `supabase/migrations/009_event_log.sql` (idempotent, in the house style):
- `investigations`: add `story_id text`, `name text`, `last_event_seq integer not null default -1`. Existing columns stay until Phase 4 removes them.
- `events (investigation_id uuid references investigations on delete cascade, seq integer, turn integer, payload jsonb, created_at timestamptz default now(), primary key (investigation_id, seq))` with RLS: owner of the investigation can select/insert; no update or delete.
- Anonymous sign-in must be enabled in the Supabase dashboard (note it in the migration header; it is not SQL). Claiming an account later is `supabase.auth.linkIdentity` / email upgrade on the client; the `owner_id` is unchanged, so nothing moves.

## Out of scope here
The prompts (`packages/ai/prompts.ts`), the gate (`packages/ai/gate.ts`) and any UI. The endpoint must work end to end with the `recorded` provider and the toy fixture, driven by `scripts/qa-turn.ts`.
