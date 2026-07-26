# Chronological Rework — Acts 0–1 Vertical Slice (Design)

**Date:** 2026-07-26
**Bible:** `docs/chronological-rework-bible.md` (approved; nine decisions settled in §9)
**Staging:** option A — rewrite acts 0–1 in place in `whitechapel-1888`, leave acts 2–6
on the reweave until authored. The game is knowingly incoherent between the slice and the
old acts until all eight land.

**Prerequisite, already shipped:** the act-epilogue auto-cut (`computeActEpilogue`,
commit `bfa4222`). `actEpilogues` is optional per act, which is what makes in-place
staging safe.

## What this slice is for

Acts 0–1 go through the entire pipeline — spec → historian pass → data → QA green →
blind playthrough — before acts 2–7 are authored, because they are the first exercise of
the rework's three novel moving parts:

1. **The act-epilogue cut** — Act 1 is the first act to author an `actEpilogues` entry.
2. **The bridge-carried murder opening** — Act 1 opens on a murder hours old, with the
   police present, rather than a scene reconstructed weeks later.
3. **The Edmund clerk placement** — his Act 1 mortuary appearance and the first sounding
   of the light motif.

If any of the three is wrong, it is far cheaper to learn it here than in Act 6.

---

## 1. Three things settled before authoring

All three resolved in review on 26 July 2026. Recorded here as decisions of record.

### 1.1 Two Edmunds — SETTLED: Reid is surname-only

The murderer is **Edmund Halward**, and his given name is the reveal the whole game is
built toward. H Division's real inspector was **Edmund Reid**. Putting Reid on stage from
Act 1 means the story carries two Edmunds, and the wrong one is famous.

The collision is mostly latent — Reid would be "Inspector Reid" in every line of prose,
and Halward is only ever "the clerk" until Act 7 — but it lands exactly where it hurts:
a player who has picked up Reid's forename anywhere meets the name Edmund at the
confrontation with the wrong association already attached.

**Decision: Reid is surname-only; his forename is never written.** `displayName:
'Inspector Reid'`, and "Edmund" appears in no fact, clue, document, approach text or idle
beat belonging to him. `qa:validate` gains a guard mirroring the existing Halward spoiler
check: any Reid-owned authored string containing his forename fails.

Rejected: renaming the murderer (load-bearing in prose already written, and touches every
act, the convergence puzzle, `suspects.ts`, `endings.ts` and both skills docs), and
substituting a different H Division officer (Reid genuinely ran H Division CID and
genuinely handled Tabram — a factual bend traded for a naming inconvenience).

### 1.2 Weather vocabulary — SETTLED: add `clear-warm` and `close`

`WeatherCondition` is `foggy | drizzle | pouring | overcast | clear-night | clear-cold` —
authored when the game spanned 8–22 November. The rework opens on the August Bank
Holiday. Act 0 is a warm night with the windows open; nothing in the union says that.

**Decision: add `'clear-warm'` and `'close'`** to the union. `clear-warm` for the Act 0
Bank Holiday night; `close` (humid, oppressive) for August nights and again for the
murder-free October lull. A one-line union change plus labels in `ACT_WEATHER`.

Note the condition string drives more than the sidebar label — `pickAtmosphericSeed`
reads it — so `ATMOSPHERIC_SEEDS` needs entries for both new conditions, or August will
silently draw on November's cold-night imagery. That is part of the slice's work.

### 1.3 The five light soundings — SETTLED: each is its act's `actBeat`

This is the slice's most consequential structural question, and it reaches forward to the
endgame. The Act 7 gate is `asked_edmund_about_edmund_eye_for_light` — **the player must
think to ask Edmund about light.** They will only think of it if the five peripheral
soundings actually reached them. Under the old ambient-approach behaviour, a sounding
could be missed entirely, which would leave the confrontation unaskable in practice.

**Decision: each sounding is that act's `actBeat`** — guaranteed, one-shot,
cooldown-exempt, already enforced by `qa:validate`. The motif becomes reliable enough for
the Act 7 gate to rest on it.

Rejected: `scriptedLines` (they fire on *every* turn at their location once their
conditions hold, so a glancing motif would repeat until the player left the room), and
relaxing `actBeat` to two per act (keeps the cast visible in the guaranteed slot, at the
cost of the invariant and a busier act).

**Accepted cost, to be watched:** in every act where Edmund is present, the act's designed
beat is his. The recession rule survives — it says he must not be *excluded* from
initiating contact — but an approach system where the murderer is always the designed beat
is its own kind of tell. Ambient approaches from the rest of the cast still fire underneath.
The blind playthrough must be asked directly whether the clerk stood out.

### 1.4 Multi-day acts — SETTLED: Act 1 spans 7–15 August

Historian finding: the identification parades were **13 and 15 August**, nine days after
the murder. Poll came forward on the **9th**. An Act 1 confined to the dawn of the 7th
cannot contain its own spotlight — the theory is raised on day one and tested on day nine.

**Decision: Act 1 covers 7–15 August as one investigative episode**, with the barracks
parade late in it.

This is a **second engine delta**, beyond the epilogue cut — the bible's §8 called that
"the only one", and that is no longer true. `ActTimeConfig` carries a single
`displayDate`, so an act cannot currently change date. Two things are needed:

```ts
interface ActTimeConfig {
  canonicalMinutes: number;
  dayOfWeek: string;
  displayDate: string;
  // NEW — authored day-steps within one act. Index 0 is the act's opening day
  // (the fields above). A step's date takes effect when its flag is set.
  days?: Array<{ dayOfWeek: string; displayDate: string; advancedByFlag: string }>;
}
```

Day advance is **flag-driven, never clock-driven**. The player will not spend eight days
of turn cost, and time should not silently drift; the story moves the calendar when a beat
lands. Setting `advancedByFlag` jumps the act's date to that step and resets the
time-of-day to the step's `canonicalMinutes` equivalent, exactly as an act entry does.

For Act 1:

| Step | Date | Advanced by |
|---|---|---|
| 0 | Tue 7 Aug, 5:30 AM | act entry |
| 1 | Thu 9 Aug | `asked_pearly_poll_about_poll_the_soldiers` — Poll comes forward |
| 2 | Wed 15 Aug | `examined_wellington_barracks_identification_parade` |

Every later act wants this too — the rework's murders are three weeks apart, and Act 5's
October lull is a month of documents. Building it here is the slice earning its keep.

---

## 2. Act 0 — The Bank Holiday

**Mon 6 August 1888, evening, 221B.** `canonicalMinutes: 1230` (8:30 PM), warm and clear,
windows open to the holiday noise.

No murder has happened. This is the calm before, and the only act in the game that is
purely safe. Its last line of narration should let the warm night feel briefly,
unrepeatably safe — the audience knows what tomorrow is; Watson does not.

**Situation.** Holmes is concluding another case — **unnamed, and with no treasure and no
wronged lady** (revised from bible §9.8; see below). A matter referred to only in the
abstract: papers returned, a client satisfied, the thing already boring him. He is in the
post-case trough: restless, contemptuous of the holiday's noise, complaining that crime
has grown dull and small.

**Why not the *Sign of Four* allusion** (historian finding, overriding §9.8): that story
is canonically **September 1888**, a month *after* this act — and, more damagingly,
concluding it leaves Watson newly engaged to Mary Morstan and on the point of leaving
Baker Street. The whole premise of Act 0 and of Reid's pre-dawn message is that Watson is
resident and available. The case was always scenery; making it unnamed costs nothing
dramatically and removes both problems. *The Cardboard Box* (canonically August 1888) was
considered and rejected — its parcel of human remains pre-echoes the Lusk kidney and would
show the game's hand five acts early.

### Location: `baker_street` (revised, act 0)

Existing location, re-dressed. The reweave's case-files wall — four victims and a suspect
landscape — **cannot exist in August**; nothing has happened yet. It is replaced for the
slice:

| Object | Purpose |
|---|---|
| `concluded_case_file` | The unnamed concluded matter. EXAMINE tutorial. Document text, no clue — deliberately dull reading, which is the joke. |
| `evening_paper` | TAKE tutorial. Bank Holiday copy — crowds, heat, a dull column of petty crime. |
| `holmes_chemistry_table` | Existing. Idle texture, no gate. |
| `violin_case` | Existing. Holmes's boredom made physical. |

The case-files wall, telegrams pile and newspaper-clipping chain belong to the November
material and are **retired from Act 0**, not re-homed — under the reworked chronology
there is no campaign to pin to a wall until Act 3 at the earliest.

### Gate

```
0: requireFlags: [
     'examined_baker_street_concluded_case_file',   // EXAMINE tutorial
     'showed_evening_paper_to_holmes',              // TAKE + SHOW tutorial chain
     'asked_holmes_about_holmes_crime_grown_dull',  // TALK tutorial — and the closing beat
   ],
   advanceTo: 1
```

Three flags, teaching four verbs (TAKE is implied by the SHOW chain, exactly as the
current Act 0 teaches it). **No `actEpilogues` entry** — the act *is* Baker Street, so
there is nowhere to cut to. The bridge to Act 1 is the knock before dawn.

### New facts

| id | act | topics | substance |
|---|---|---|---|
| `holmes_crime_grown_dull` | 0 | `the criminal classes`, `crime`, `your boredom` | The great cases are done; what remains is squalid and small. The irony the act is built on. |
| `holmes_concluded_case` | 0 | `the case you have just closed`, `your last case` | Concluded, unremarkable, already forgotten. Names nothing and no one; deflects if pressed. |

---

## 3. Act 1 — The Soldier

**Tue 7 – Wed 15 August 1888.** Opens `canonicalMinutes: 330` (5:30 AM, period `dawn`) —
Reid's message reaches Baker Street after the body is found at 4:45 AM. The act then
steps to 9 and 15 August on its authored day-flags (§1.4).

**The murder.** Martha Tabram, killed ~2:30 AM on the first-floor landing of George Yard
Buildings, found 4:45 AM by John Reeves. 39 stab wounds. Dr. Timothy Killeen's examination
suggests two blades, one consistent with a dagger or bayonet. No mutilation — this is a
frenzy, not yet the thing the case becomes.

**The hook (§9.2).** Inspector Reid sends to Baker Street for a quiet, unofficial opinion:
a frenzied attack, no witnesses, a building full of people who heard nothing. Explicitly
off the books — Reid wants a reading, not a consultant of record.

**PC Thomas Barrett** (historian finding, added to the spec): Barrett saw a grenadier
loitering in George Yard at about 2 AM and attended a parade himself, identifying a man
who was then alibied. He is an *independent* second source for the soldier theory. This
matters dramatically as well as factually — resting the loud theory solely on Poll makes
its collapse read as "the drunk witness was unreliable", which is both unkind and the
wrong lesson. With a constable's own sighting behind it too, the theory is genuinely
reasonable, and its failure teaches what the act is for: *the loud theory is not the
answer, even when the evidence for it is sound.*

### Locations

| id | act | notes |
|---|---|---|
| `george_yard_buildings` | 1 | **New.** The first-floor landing. Interior, `timeframe: 'present'`. The stairwell gaslight lives here — the motif's invisible planting, an atmospheric note, **not a clue**. |
| `old_montague_street_mortuary` | 1 | **New.** The workhouse mortuary shell where Tabram lies. Killeen's examination; Edmund's first sounding. Deliberately *not* `whitechapel_mortuary` — that is Bond's domain and belongs to the November material. |
| `wellington_barracks` | 1 | **New.** Where the soldier theory is tested and dies. |
| `h_division_station` | 1 | Existing, re-dated. Reid's ground. |
| `baker_street` | 0 | Existing. The act's epilogue location. |

### NPCs (new — three, not four)

Llewellyn attends Nichols and belongs to **Act 2**, not this slice.

| id | display | rule | schedule (act 1) | role |
|---|---|---|---|---|
| `reid` | Inspector Reid | `location_based` | `h_division_station`, `byPeriod: { dawn: 'george_yard_buildings' }` | The door into the case. Onstage acts 1–2, hands over to Abberline in Act 2. |
| `pearly_poll` | Pearly Poll | `location_based` | `whitechapel_pub`; `wellington_barracks` on day-step 2 | Mary Ann Connelly. Comes forward on the 9th (day-step 1), raises the soldier theory, then fails to identify anyone at the parade. |
| `pc_barrett` | PC Barrett | `location_based` | `george_yard_buildings` dawn → `h_division_station` | The constable who saw a grenadier in George Yard at ~2 AM. Second, independent source for the theory. |
| `killeen` | Dr. Killeen | `fixed` | `old_montague_street_mortuary` | The two-blade finding. Young, careful, out of his depth and honest about it. |

`edmund` gains an act-1 schedule entry: `old_montague_street_mortuary`. `holmes` follows
Watson as ever. Every other NPC has **no act-1 entry** and is therefore offstage — which
is correct, and is the mechanism that keeps November's cast out of August.

### The spotlight — the soldier (three beats, on-screen)

The act teaches the game's grammar: *the loud theory is not the answer.*

1. **Raised** (7 Aug, then 9 Aug). PC Barrett's sighting of a grenadier at ~2 AM, and
   then Poll coming forward on the 9th with the night's account.
   `asked_pc_barrett_about_barrett_saw_a_soldier` → `asked_pearly_poll_about_poll_the_soldiers`
   *(the second flag is Act 1's day-step 1 trigger)*
2. **Tested** (15 Aug). The Wellington Barracks parade collapses — Poll picks nobody, then
   the wrong men; Barrett's man is alibied.
   `examined_wellington_barracks_identification_parade` *(day-step 2 trigger)*
3. **Cleared.** Holmes reads the wounds against a bayonet's geometry and finds the theory
   wanting — at the mortuary, against Killeen's finding.
   `asked_killeen_about_killeen_two_blades`

### Clues

| id | where | trigger | substance |
|---|---|---|---|
| `clue_a1_no_one_heard` | `george_yard_buildings` | `the_landing` | A building of some thirty-odd tenants. 39 blows. Nobody heard anything. |
| `clue_a1_two_blades` | `old_montague_street_mortuary` | `killeens_notes` | Two weapons, or one man changing his grip — the first crack in the soldier theory. |

The staircase gaslight is **atmosphere, not a clue** (bible §4: "first, *invisible*
planting"). Making it a clue would announce the motif on its first appearance and spend
the Act 7 payoff five acts early.

### Edmund's presence — first sounding

At the mortuary, taking notes for the divisional surgeon. No name, no alias beyond "the
clerk". Watson barely registers him. He remarks, to nobody, that the staircase gaslight
would have been poor at that hour.

Authored as Act 1's `actBeat` approach (per §1.3(a)), so it cannot be missed.

### Gate and epilogue

```
1: requireFlags: [
     'examined_george_yard_buildings_the_landing',
     'asked_pc_barrett_about_barrett_saw_a_soldier',       // raise (a)
     'asked_pearly_poll_about_poll_the_soldiers',          // raise (b) — day-step 1
     'examined_wellington_barracks_identification_parade', // test    — day-step 2
     'asked_killeen_about_killeen_two_blades',             // clear
     'asked_holmes_about_holmes_frenzy_no_pattern',        // ← closing beat, at the epilogue
   ],
   advanceTo: 2

ACT_EPILOGUES: { 1: 'baker_street' }
```

The first five are field work. When all four are set, `computeActEpilogue` cuts Watson to
Baker Street with Holmes carried along, and the summation is the fifth flag: Holmes at the
fire, dissatisfied — the frenzy is real but the pattern is not visible yet. He files it.
Bridge to Act 2: three quiet weeks, then Buck's Row.

### New facts

| id | act | knownBy | topics | substance |
|---|---|---|---|---|
| `holmes_frenzy_no_pattern` | 1 | holmes | `george yard`, `the frenzy`, `what you make of it` | Rage without design; nothing to reason from yet. The act's closing thought. |
| `reid_off_the_books` | 1 | reid | `why you sent for us`, `the arrangement` | Wants a reading, not a consultant of record. |
| `reid_building_heard_nothing` | 1 | reid | `the tenants`, `what the neighbours heard` | Thirty-odd people, no one heard a thing. |
| `reid_no_witnesses` | 1 | reid | `the witnesses`, `what you have` | Nothing but Poll, and Poll has been drinking. |
| `poll_the_soldiers` | 1 | pearly_poll | `the soldiers`, `the grenadier`, `who she was with` | Two soldiers, the four of them, and they parted. |
| `poll_last_saw_tabram` | 1 | pearly_poll | `martha`, `that night`, `when you last saw her` | The last hour, told plainly and with grief under it. |
| `poll_cannot_identify` | 1 | pearly_poll | `the parade`, `identifying him` | She could not pick a man out and will not pretend otherwise. |
| `barrett_saw_a_soldier` | 1 | pc_barrett | `the soldier you saw`, `your sighting`, `what you saw` | A grenadier loitering in George Yard about 2 AM, waiting for someone. |
| `barrett_his_man_alibied` | 1 | pc_barrett | `the man you picked out`, `the parade` | He identified a man at the parade; the man's account held. Barrett does not enjoy saying so. |
| `killeen_39_wounds` | 1 | killeen | `the wounds`, `how many` | 39, distributed without pattern. |
| `killeen_two_blades` | 1 | killeen | `the blades`, `two weapons`, `the bayonet` | One wound differs from the other thirty-eight. |
| `killeen_no_mutilation` | 1 | killeen | `mutilation`, `what was not done` | Nothing was taken, nothing arranged. |

---

## 4. Act config changes

```ts
ACT_TIME_CONFIG:
  0: { canonicalMinutes: 1230, dayOfWeek: 'Monday',  displayDate: '6 August 1888' }
  1: { canonicalMinutes: 330,  dayOfWeek: 'Tuesday', displayDate: '7 August 1888' }

ACT_WEATHER:
  0: { condition: 'clear-warm', label: 'Warm, Clear' }        // needs §1.2
  1: { condition: 'close',      label: 'Close, Overcast' }     // needs §1.2

ACT_ANCHORS:   1: 'george_yard_buildings'   // was dorset_street
ACT_EPILOGUES: 1: 'baker_street'            // new map
ACT_NAMES:     0: 'The Bank Holiday'  1: 'The Soldier'
```

---

## 5. What this breaks in acts 2–6, and how it is handled

Audited, not guessed. Everything below is a known consequence of staging option A, and
each item is either fixed in the slice or explicitly deferred.

| Breakage | Handling |
|---|---|
| `millers_court` + `dorset_street` are act-1 locations holding the Kelly material | **Deferred.** Re-dated to Act 6 when that act is authored. Until then they stay at `act: 1` and are reachable in August — incoherent, and accepted. |
| `hutchinson` schedules into act 1 | **Fixed now.** His act-1 entry is removed; he returns in Act 6. |
| `bond`, `abberline`, `edmund` have act-0/1 schedules pointing at November places | **Fixed now** for acts 0–1 only. |
| Act 1's `actBeat` is `hutchinson_dorset_weather` | **Fixed now.** Replaced by Edmund's first sounding at the mortuary. |
| `clue_01_killer_confidence` (Miller's Court burned clothing), `clue_11_account_outruns_light` (the witness test) | **Deferred** with their locations. Both are Act 6 material chronologically. |
| `clue_00_campaign_timeline` (the case-files wall) | **Retired from Act 0.** Re-authored for a later act when a campaign exists to chart. |
| `clue_06_prasarved_spelling` lives at `baker_street` — the crown puzzle | **Untouched.** It is act-gated by the convergence flag, not by Act 0's dressing. |
| World events `act0_midnight_bells`, `act1_lord_mayors_show` | **Re-dated or retired.** The Lord Mayor's Show is 9 November and cannot fire in August. |
| Hint objectives `a0_*` (5) and `a1_*` (6) | **Rewritten now** against the new gates. |
| `qa-engine` winning path acts 0–1 | **Rewritten now.** Acts 2–6 steps unchanged and still expected to pass. |
| Suspect roster `requiresFlag: 'talked_to_hutchinson_at_dorset_street'` (poi_stranger, poi_hutchinson) | **Deferred.** Both are Act 6 theories under the new chronology; they simply become unreachable until then, which `qa:validate` tolerates because the flag remains settable in principle. |

**Saves break.** Act numbering, gates, locations and NPC schedules all change; existing
investigations will not resume coherently. Per `CLAUDE.md` this is fine and needs no
migration — but you may want a fresh investigation after the slice lands.

---

## 6. QA plan

- `qa:validate` after every data file — referential integrity, the new topics, the act
  beat invariants, and the asked_ gate answerability check.
- `qa:engine` — winning path rewritten for acts 0–1; the epilogue cut asserted against
  **real** data for the first time (it currently only has synthetic coverage).
- `qa:parser` — baseline re-recorded: three new NPCs and a new object vocabulary.
- `qa:hints` / `qa:diary-leads` — coverage for every new gate.
- `qa:all` green before the act is called done.
- `game-reviewer` blind playthrough of acts 0–1. **Ask it specifically** whether it knew
  what to ask people about, and whether the clerk stood out — those are the two risks
  deterministic QA cannot see.
- `qa:narration` if a key is available in the session; otherwise reported as skipped.

## 7. Historian pass — findings of record

Run 26 July 2026, after structure was agreed.

**Confirmed, no change needed:**

- Bank Holiday Monday was 6 August 1888.
- Tabram found ~4:45 AM, 7 August, first-floor landing of George Yard Buildings, by John
  Saunders Reeves on his way to work. Killeen examined her around 5:30 and put death near
  2:30 AM. 39 wounds.
- **"Bayonet" is Killeen's own word**, not the press's — his inquest testimony held that 38
  wounds were consistent with a penknife while one, to the breastbone, suggested a dagger
  or bayonet. The spec's "two blades" is a fair reading of a real finding, and Holmes's
  clearing beat can argue against Killeen's own stated alternative rather than a straw man.
- Tabram's body went to the Old Montague Street workhouse mortuary — the same mortuary
  that later received Nichols.
- Reid ran H Division CID and handled the Tabram inquiry.
- A building of poor families where nobody admitted hearing 39 blows is well attested.

**Corrected in this spec:**

- The parade timeline (§1.4) — Poll came forward on the 9th; Tower parade the 13th, where
  she identified nobody; Wellington Barracks the 15th, where she picked two men who were
  alibied. Act 1 now spans 7–15 August.
- PC Thomas Barrett added (§3) as an independent second source for the soldier theory.
- The Act 0 concluded case is now unnamed (§2), overriding bible §9.8.

**Deliberately not modelled:** the 13 August Tower parade. Two collapsing parades is one
beat twice; Wellington Barracks is the one where she actually picked men out, so it is the
dramatic version of the same fact. Registered as a compression bend.

**Skill gap to close as part of this slice:** `.claude/skills/historian` has no August 1888
material — no Tabram, Reid, Poll, Killeen, Barrett, George Yard Buildings, or Old Montague
Street mortuary. It was written for the November game. Every act of this rework will hit
that gap, so the skill needs an August–October section covering the earlier murders and
their investigators before Act 2 is authored.
