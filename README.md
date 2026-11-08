# London Bleeds: The Whitechapel Diaries

A text adventure set in London in November 1888, during the Whitechapel murders. You play Dr. John H. Watson, assisting Sherlock Holmes through an investigation told in acts.

**Live:** [london-gemeni.vercel.app](https://london-gemeni.vercel.app)

> **Status:** the engine has been rebuilt (see [`docs/engine-rebuild-plan.md`](docs/engine-rebuild-plan.md)). The Whitechapel story has not yet been re-authored for the new engine, so new games start on a story-neutral test story, *The Saltmarsh Light*. The previous engine and the Whitechapel story as TypeScript are preserved on the `archive/pre-phase4-engine` branch.

---

## How it works

**The engine decides; the AI narrates.** A deterministic TypeScript engine resolves every player action against a Story authored as data. Gemini is used twice per turn, and neither use can change the world:

1. **Selection.** The player's free text is mapped onto one action, chosen from the *Candidate Set* — everything the player could mean right now: things here and carried, people present, exits, subjects the addressed person can speak to. The model can only pick from that list or decline; a few exact commands (`look`, `inventory`, `wait`, compass directions) skip it.
2. **Narration.** The engine's resolved outcome — this turn's Events, the authored Beats, the Facts that may be said — goes to the narrator, which writes prose. It may improvise *Flavour* (texture that carries no fact), which is recorded as an *Observation* so later turns repeat it. A server-side *invention gate* rejects any name or number the turn's context did not supply.

Only the engine creates *Facts*: a clue, an exit, where a thing or person is, who knows what. People remember what they have said because the engine keeps a *Disclosure Ledger* of every Fact they have told the player, rather than asking the model to remember.

Each game (an *Investigation*) is an append-only log of Events on the server; the current state is the replay of that log. Resuming, on any device, is replay, and any bug is reproducible from its log. The browser never holds the Story or the state, either of which would show it the solution: it receives a player view (location, people, objects, exits, inventory, diary) and the feed.

Stories are JSON validated by a schema. Puzzles, scripted scenes, timed happenings and ambient life are all *Rules*: a Trigger (an action on an object, entering a place, a flag, a clock time, an idle Tick, combining items, a fact being told, someone being near, an accusation) paired with Effects. A build-blocking validator checks every reference, and a reachability prover walks the real engine to show every act, clue and ending can be reached.

The vocabulary is defined in [`GLOSSARY.md`](GLOSSARY.md); the decisions behind it are in [`docs/adr/`](docs/adr/).

### A turn

```
browser                     api/turn.ts → server/turn.ts                    packages/
  text / tick / resume ──▶  load log → replay → Candidate Set → exact         engine: reducer, verbs, Rules, Ticks,
  ◀── NDJSON: events,       command or ai.select → resolve → append Events    prover, projections (no I/O, no AI)
      prose, view + feed    → narrate → invention gate → append narration     ai: select/narrate seam, Gemini adapter
                                                                              schema: Zod contracts, validator
```

The turn endpoint's contract is [`server/TURN.md`](server/TURN.md).

---

## Project structure

```
├── packages/
│   ├── schema/        # Zod contracts (Story, Rule, Event, Candidate Set, narration, player view), validator, test fixtures
│   ├── engine/        # Pure engine: reducer, verbs, Rules, Ticks, projections, reachability prover
│   └── ai/            # select/narrate seam, prompts, invention gate, Gemini and recorded adapters
├── server/            # turn.ts (the one turn endpoint), investigationStore.ts (memory / Supabase)
├── api/turn.ts        # Vercel function wrapping server/turn.ts
├── stories/           # Stories as JSON (from Phase 6; until then fixtures under packages/schema/fixtures/)
├── hooks/             # useInvestigation (client game state), useAudio, gameState/*
├── services/          # turnClient (NDJSON), InvestigationRepository, GameRepository (profiles), audio
├── components/        # React UI: feed, sidebar, diary, command input, auth, settings
├── scripts/           # qa-*.ts harnesses
└── supabase/migrations/
```

---

## Setup

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project with **anonymous sign-in enabled** (guests play as anonymous users; signing in by magic link claims the account)
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)

### Install

```bash
git clone https://github.com/silentpixel-git/London-Gemeni.git
```

```bash
cd London-Gemeni && npm install
```

### Environment

Copy `.env.example` to `.env` and fill it in. `GEMINI_API_KEY` is server-only and never reaches the browser bundle. The AI model for each job, and the Story new games start on (`VITE_DEFAULT_STORY`), are configurable there.

### Database

Apply `supabase/migrations/*.sql` in order in the Supabase SQL editor.

### Run locally

```bash
npm run dev
```

Vite serves the app on port 3000 and mounts `POST /api/turn` through a dev middleware, so no separate server is needed.

### Check

```bash
npm run qa:all
```

Type-checking plus every deterministic harness: story validation, the engine's behavioural spec, the reachability prover, the stress story, the invention gate, the turn endpoint with recorded AI, and the Vercel function's import graph. None needs an API key. `npx tsx scripts/qa-browser.ts` plays the real app in Chromium; `scripts/smoke-gemini.ts` makes one live call to each model.

### Deploy

```bash
vercel --prod
```

`npm run build` validates every Story before building and fails on an invalid one.

---

## Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS (build-time, PostCSS) |
| Animation | Motion |
| Audio | Howler |
| Schemas | Zod |
| AI | Google Gemini (`@google/genai`) |
| Auth + DB | Supabase (PostgreSQL + GoTrue, row-level security) |
| Bundler | Vite 6 |
| Hosting | Vercel |
