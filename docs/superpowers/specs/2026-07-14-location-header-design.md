# Location Header in Narrative Output — Design

**Date:** 2026-07-14
**Status:** Approved approach; pending spec review

## Problem

When the player moves to a new location within the same act, the narration
re-opens with the act heading (`### ACT I: …`), because every `full`/`opening`
mode prompt instructs the AI to begin with it. During playtesting this read as
a bug ("why is the act starting again?"). Meanwhile nothing in the feed states
*where* Watson now is — the location name only lives in the sidebar.

## Goal

Render a deterministic **location header** (pin icon + location name) above
the narration whenever the scene changes or is re-surveyed:

- on every move to a new location,
- on every `look`,
- at the start of an act (opening scene, act-arrival scene, resume scene).

The **act heading** appears *only* on scene-entry narrations (opening, act
arrival, resume) — never on ordinary moves/looks. At act start the visual
order matches the mockup: act heading, then location header, then prose.

## Approach (chosen: structured header, rendered by the feed)

Headings become UI chrome owned by the client, not prose owned by the AI.
This extends the project's core contract — the AI narrates; verified facts
(here, the location name from `NarrationContext.locationName`) are rendered
deterministically.

Rejected alternatives: a `@@location:` marker line spliced into the markdown
(pollutes transcripts, flashes half-typed during the typewriter), and a
server-side prepend in `aiCore` like the verified-data footer (only lands when
the stream completes, and puts a display concern on the server).

## Design

### 1. Data model (`types.ts`)

`GameHistoryItem` gains two optional fields, set only on assistant items:

```ts
export interface GameHistoryItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
  type?: 'journal';
  actHeading?: string;   // e.g. "Prologue: The Baker Street Vigil" — scene-entry only
  location?: string;     // e.g. "221B Baker Street" — any full/opening-mode turn
}
```

History is not persisted/replayed across sessions (resume streams a fresh
look), so no migration is needed.

### 2. Rendering (`NarrativeFeed.tsx`)

For assistant messages (both the typewriting latest and static previous ones,
excluding journal entries), render above the prose:

- `actHeading` (when set): current `###` visual style — small caps, tracking,
  `text-lb-primary` at reduced opacity.
- `location` (when set): one line, `MapPin` (lucide) in `text-lb-accent` +
  location name in bold `text-lb-primary`, spacing per the mockup.

Headers render instantly; the prose typewrites below them.

### 3. Producers

- **`hooks/gameState/useSceneStreams.ts`** — all three scene generators set
  `actHeading` + `location` on the history item they create:
  - `generateOpeningScene`
  - `streamArrivalScene`
  - `streamResumeScene`

  The heading string is computed client-side from existing data
  (`ACT_NAMES`, act number → "Prologue" / "Act N" formatting, mirroring what
  `aiCore` used to put in the `###` line). The location name comes from
  `result.aiContext.locationName`. Error fallbacks that currently write
  `### Act N` into `text` switch to setting `actHeading` instead.

- **`hooks/useGameState.ts` (`handleAction`)** — when
  `result.aiContext.narrationMode === 'full'` (exactly the move/look turns;
  examine/talk/take/etc. are `compact`), set `location` on the assistant
  history item for the turn. No `actHeading`.

### 4. Prompt changes (`server/aiCore.ts`)

- Remove `Begin with: ### ${actHeader}: ${ctx.actName}` from both the
  **opening** and **full** mode prompts; replace with an explicit "Do NOT
  begin with a heading" instruction so the model doesn't improvise one.
- Word budgets stay as-is.

### 5. Defensive strip (`services/narrationFormat.ts`)

New pure helper `stripLeadingActHeading(text)`: removes a leading `### …`
line (including a partial one mid-stream) from streamed narration. Applied by
the stream consumers *before* `injectAfterHeading`, so a disobedient
generation can't produce a doubled heading. `injectAfterHeading` itself is
unchanged — with no heading present it prepends, which yields the correct
order (chrome headers above, fixed line/bridge first in the prose).

`StoryRenderer`'s `###` branch stays as a rendering fallback.

### 6. Error handling

- Stream failure on opening: fallback narrative renders under the structured
  headers (fields are set on the item regardless of stream outcome).
- Resume/arrival stream failure: item keeps `actHeading`/`location`; `text`
  fallback no longer needs a `###` line.

### 7. Testing / verification

- `npm run qa:narration-inject` — extend with cases for
  `stripLeadingActHeading` (full heading, partial mid-stream heading, no
  heading, strip-then-inject composition).
- `npm run qa:all` — regression net (engine/parser untouched, but cheap).
- `npx tsx scripts/qa-narration.ts` (needs `GEMINI_API_KEY`) — confirm the
  prompt change doesn't degrade prose and the model stops emitting headings.
- Live dev-server check: opening scene matches the mockup; move within an act
  shows pin header only; `look` shows pin header; act transition shows act
  heading + pin header.

## Out of scope

- Sidebar location display (unchanged).
- Diary/journal entries (never get headers).
- Cloud log entries (`GameRepository.addLogEntry`) keep storing the AI's raw
  `markdownOutput` — no header text added.
