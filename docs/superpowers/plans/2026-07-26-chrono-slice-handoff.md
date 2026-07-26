# Chronological Rework — Acts 0–1 Slice: Handoff

**Branch:** `claude/notebooklm-access-bd7372` (all work pushed; PR #45 open, draft)
**Last commit:** `ff4b985`
**State:** everything below the data layer is built and green. **No story data has been
written yet.** The next session starts by authoring Act 0.

Read in this order: this file → the slice spec → the bible if a decision needs context.

- Spec: `docs/superpowers/specs/2026-07-26-chrono-acts-0-1-slice-design.md`
- Bible: `docs/chronological-rework-bible.md`

---

## Where things stand

**Staging is option A** — rewrite acts 0–1 in place in `whitechapel-1888`; acts 2–6 stay on
the reweave until authored. The game is knowingly incoherent between the slice and the old
acts until all eight land. Saves break, and per `CLAUDE.md` that needs no migration.

### Shipped this session

| Commit | What |
|---|---|
| `dad4767` | **NPC approaches actually fire.** They were invisible in play — a vignette veto starved every full-mode turn, and compact turns burned the one-shot flag without rendering the prose. Now full-mode only, own paragraph, own word allowance. Adds `actBeat`: one guaranteed designed beat per act, cooldown-exempt. |
| `c32bca2` | **TALK is topic-scoped.** `ask bond about mary kelly` resolves against `topics` on `StoryFact` and sets `asked_<npc>_about_<factId>`. Bare TALK is an opening exchange that gates nothing. All 10 act gates, the suspect clearing beats, two scripted-line triggers and two rumor triggers migrated. |
| `bfa4222` | **Act-epilogue auto-cut.** `computeActEpilogue` cuts Watson to the act's summation location once its field work is done. `actEpilogues` is optional per act — this is what makes in-place staging safe. |
| `ff4b985` | **Multi-day acts + summer weather.** `resolveActDay` derives an act's current day from flags; `clear-warm` and `close` added to `WeatherCondition`. |

### Green as of handoff

`npm run qa:all` → 309 engine · 30 validate · 34 hints · 35 diary-leads, 0 failures.
`npx tsx scripts/qa-narration-inject.ts` → 43/43. `npm run lint` clean.

`qa:narration` and the `qa:parser` AI pass were **not** run — no `GEMINI_API_KEY` in a cloud
container (see `CLAUDE.md`). Report as skipped, not blocked.

---

## Next actions, in order

### 1. Author Act 0 — The Bank Holiday (spec §2)

Mon 6 Aug 1888, 8:30 PM (`canonicalMinutes: 1230`), `clear-warm`.

- `mrs_kemp` NPC — the caller, `fixed` at `baker_street`, act 0 only.
- `baker_street` re-dressed: add `pawn_ticket` (takeable, document text) and
  `concluded_case_file`; **retire** the case-files wall, telegrams pile and
  newspaper-clipping chain — there is no campaign to chart in August.
- Facts: `kemp_sister_missing`, `kemp_pawn_ticket`, `kemp_police_wont_look`,
  `holmes_crime_grown_dull`, `holmes_no_case_here`, `holmes_concluded_case`,
  `holmes_invisible_in_a_crowd` — all with `topics`.
- Gate: ask Kemp → examine ticket → show ticket to Holmes → ask Holmes about crime grown
  dull (closing beat). **No `actEpilogues` entry** — the act *is* Baker Street.
- Act 0 `actBeat`: Holmes at the window, the hundred thousand in the streets. Displaces
  `holmes_watson_revolver`, which moves to Act 1 as ambient.

### 2. Author Act 1 — The Soldier (spec §3)

Tue 7 – Wed 15 Aug, opens 5:30 AM (`canonicalMinutes: 330`), `close`.

- New locations: `george_yard_buildings`, `old_montague_street_mortuary`,
  `wellington_barracks`.
- New NPCs: `reid` (**surname-only, forename never written**), `pearly_poll`, `pc_barrett`,
  `killeen`. `edmund` gains an act-1 mortuary entry.
- Day steps: 9 Aug on Poll coming forward, 15 Aug on the barracks parade — each needs a
  `transitionNote`.
- Spotlight: Barrett's sighting + Poll's account raise it, the parade tests it, Killeen's
  two-blade finding clears it.
- Clues: `clue_a1_no_one_heard`, `clue_a1_two_blades`. The staircase gaslight is
  **atmosphere, not a clue** — making it a clue spends the Act 7 payoff five acts early.
- Act 1 `actBeat`: Edmund's first light sounding at the mortuary.
- `ACT_EPILOGUES: { 1: 'baker_street' }`, closing on `holmes_frenzy_no_pattern`.

### 3. Then

- Rewrite the acts 0–1 leg of `runWinningPath` in `qa-engine.ts`; acts 2–6 steps should
  still pass untouched.
- Rewrite the `a0_*` / `a1_*` hint objectives.
- `qa:parser` baseline re-record (new NPC and object vocabulary).
- `npm run qa:all` green, then `npm run story:map`.
- **Blind `game-reviewer` playthrough of acts 0–1.** Ask it three things explicitly:
  1. Did it know what to ask people about? (topic discoverability is unmeasurable by
     deterministic QA and is the highest open risk)
  2. Did the clerk stand out? (Edmund holds the guaranteed act beat in every act he is in)
  3. Did the unresolved Nell thread read as haunting or as a loose end?

---

## Things a fresh session will not otherwise know

- **`qa:validate` needs a Reid forename guard** (spec §1.1). Not yet written — it is part
  of authoring Reid, not a separate task.
- **The bible's §8 "the only one" claim is stale** and already corrected: there are three
  engine deltas now (epilogue cut, multi-day acts, weather vocabulary).
- **`CLAUDE.md` overstates the engine's story-agnosticism.** `parseFallback.ts:67` uses the
  concrete manifest for real logic and `gameData.ts` is a barrel re-export of story data.
  Only matters if someone revisits the parallel-manifest idea.
- **Two Kelly-era locations stay wrong on purpose.** `millers_court` and `dorset_street`
  remain `act: 1` and reachable in August until Act 6 is authored. `qa:validate` checks
  referential integrity, not chronology, so it will stay green straight through this.
- **The 13 Aug Tower parade is deliberately not modelled** — two collapsing parades is one
  beat twice. Registered as a compression bend.
- **Do not monitor PRs.** Repo owner is the only developer (`CLAUDE.md`).
