# London Bleeds: The Whitechapel Diaries

A text-adventure game set in 1888 London, during the Jack the Ripper murders. You play as Dr. John H. Watson, assisting Sherlock Holmes in an investigation that takes you through Whitechapel — examining crime scenes, interviewing witnesses, and piecing together a theory before it's too late.

**Live:** [london-gemeni.vercel.app](https://london-gemeni.vercel.app)

---

## How It Works

The game is built on a strict separation of concerns: a deterministic TypeScript engine resolves every player action against canonical world data, and the Gemini AI is only ever asked to write narrative prose for outcomes that have already been decided.

The AI cannot hallucinate a clue, invent an exit, or move an NPC — it receives a fully resolved `EngineResult` and narrates it. This keeps gameplay consistent while making each turn feel like it was written by a Victorian novelist.

### Architecture

```
Player input
    │
    ▼
intentParser.ts        — classifies free text into a typed intent
    │                    (move / examine / talk / take / use / deduce / query / …)
    ▼
GameEngine.ts          — resolves intent against gameData.ts (no AI)
    │                    returns EngineResult: state changes + NarrationContext
    ▼
useGameState.ts        — applies state changes, injects STIM + Holmes synthesis
    │
    ▼
AIService.ts           — streams narrative prose from Gemini
    │                    (3 prompt modes: opening / full / compact)
    ▼
NarrativeFeed.tsx      — renders streamed markdown with typewriter animation
```

### Game Engine

`engine/gameData.ts` is the single source of truth for all world data: locations, NPCs, clues, objects, act progression, and suspect profiles. Nothing in this file changes at runtime.

`engine/GameEngine.ts` enforces rules deterministically:
- Movement validates exits from the current location
- Clue discovery is triggered by examining specific objects
- NPC movement follows data-driven rules (`followsNpcId`)
- Deduction checks the player's theory against `SUSPECT_PROFILES`
- Natural-language questions (`what is…`, `describe…`) route to `resolveQuery` — Watson answers in-character with no state change

### AI Narration

`services/AIService.ts` wraps the Google Gemini API with three narration modes:

| Mode | Used for | Word limit |
|------|----------|-----------|
| `opening` | Game start | 130 words, 2 paragraphs, mystery hook |
| `full` | Movement / look-around | 220 words, Act header + atmosphere + scene |
| `compact` | All other actions | 100 words, action-focused |

Sanity affects prose style. Below 70 sanity Watson's text shows strain; below 40 it fragments — short broken sentences, intrusive thoughts, unreliable perception.

When new clues are found, `consultHolmesMultiClue` fires a non-streaming call that synthesises all discovered evidence into a cross-case Holmesian deduction. This is injected into the narration prompt so Holmes's commentary advances meaningfully with each discovery.

### Cloud Save (Supabase)

Players can sign in with Google OAuth or an email magic link. Progress is saved to Supabase and syncs across devices. All tables use Row Level Security — players can only access their own data.

The Supabase connection uses a direct `fetch` to GoTrue's `/auth/v1/health` endpoint for connectivity checks, bypassing the SDK's Web Locks mechanism which can cause false "disconnected" readings during token refresh.

---

## Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)

### Install

```bash
git clone https://github.com/silentpixel-git/London-Gemeni.git
cd London-Gemeni
npm install
```

### Environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### Database

Run the migrations in order in your Supabase SQL Editor:

```
supabase/migrations/001_schema_update.sql
supabase/migrations/002_profile_role_theme.sql
```

### Run locally

```bash
npm run dev
```

### Deploy

```bash
npm run build
vercel --prod
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS (build-time, PostCSS) |
| Animation | Motion (Framer Motion) |
| AI | Google Gemini (`@google/genai`) |
| Auth + DB | Supabase (PostgreSQL + GoTrue) |
| Bundler | Vite 6 |
| Hosting | Vercel |

---

## Project Structure

```
├── engine/
│   ├── gameData.ts          # All world data (locations, NPCs, clues, suspects)
│   ├── GameEngine.ts        # Deterministic rule resolver
│   └── intentParser.ts      # Free-text → typed intent
├── services/
│   ├── AIService.ts         # Gemini narration (streaming + Holmes synthesis)
│   ├── GameRepository.ts    # Supabase data access
│   └── geminiService.ts     # Low-level Gemini wrapper
├── hooks/
│   └── useGameState.ts      # All game state, effects, and handlers
├── components/
│   ├── AuthModal.tsx        # Sign in / create account
│   ├── EditProfileModal.tsx # Display name + Victorian role picker
│   ├── Header.tsx           # Connection status, profile dropdown
│   ├── NarrativeFeed.tsx    # Streamed story output
│   ├── Sidebar.tsx          # Location, inventory, journal
│   └── CommandInput.tsx     # Player text input
└── supabase/
    └── migrations/          # Database schema
```
