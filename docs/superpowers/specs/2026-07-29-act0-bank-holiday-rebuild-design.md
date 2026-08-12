# Act 0 rebuilt to the Bank Holiday spec

**Date:** 2026-07-29
**Branch:** `claude/notebooklm-access-bd7372`
**Implements:** `docs/act0-bank-holiday-spec.md`
**Structural context:** `docs/act-structure-design-doc.md` (only the parts Act 0 exercises; the
travelling-debrief machinery is a later pass)

---

## 1. Why

Act 0 shipped with one object, four flags and a refusal. Playtest found what that shape
actually is: the player watches Holmes be dismissive and clicks through it. There is no
puzzle in the tutorial, and the act ends because a counter filled rather than because
anything concluded.

The revised spec gives the act a shape — an opening that is an event, an investigation with
five objects and five verbs, a reconstruction the player triggers, and a conclusion that is
specific. This document is the implementation design for that spec, and for nothing else.

## 2. Scope

**In:** Act 0 rebuilt end to end. The five engine additions it requires. The nested container
display in the sidebar. The empty-state copy pass its empty casebook exposes.

**Out, deliberately, for a later pass:** the exit-release ("I think we are done here,
Watson") and the travelling debrief; Baker Street dressed per act; routes home from the
locations that have none; the `ACT_BRIDGES` rewrite that a Baker-Street departure would
force; and the conclusion, cost beat and one-choice content for Acts 1 through 6.

Act 0 happens entirely at Baker Street, so it needs none of that. Building it first means
the shape gets a playtest before six acts are committed to it.

## 3. Decisions taken

| Question | Decision |
|---|---|
| Scope | Act 0 alone. Generic act machinery follows in a second pass. |
| How the card choice is expressed | Three typed actions. No option reached by omission. |
| Theory-commit beat in Act 0 | None. `SHOW charity_card` is the player's commit. §4.3 of the structure doc gets corrected. |
| Holmes pointing at the unopened box | `ActSafetyNet` gains an escalation ladder. |
| Act-closing diary | Authored for Act 0, with lines swapped by the choice flag. Other acts keep the AI reflection. |
| `UNLOCK` verb | Not now. `open.ts` is shaped so a lock check slots in when there is something locked. |
| Lightbulb / casebook | Hint button behaves normally. The casebook panels get an authored empty-state pass. |
| Containers in the sidebar | Nested display, built now rather than later. Closed state annotated, open state implied by its children. |

## 4. Engine additions

Five, all used by Act 0 rather than built ahead of need. Two of them (§4.2, §4.5) touch
shared machinery rather than act-local data, and carry the bulk of the regression risk.

### 4.1 The OPEN verb

| File | Change |
|---|---|
| `types.ts` | `'open'` joins `IntentType` |
| `engine/intentParser.ts` | Verb entry with aliases: `open`, `look inside`, `lift the lid`, `unlatch`, `undo` |
| `engine/resolvers/open.ts` | New. Resolves the target, sets `opened_<loc>_<obj>`, returns `actionType: 'open'` |
| `engine/GameEngine.ts` | Dispatch case |
| `engine/stories/whitechapel-1888/flags.ts` | `OpenedFlag = opened_${LocationId}_${ObjectId}` |
| `server/parseAction.ts`, `engine/parseFallback.ts` | OPEN candidates for the tool-calling fallback |
| Help text | Verb enumeration |

`look inside X` must resolve to OPEN rather than falling through to EXAMINE; that phrasing
is the most likely thing a player types at a closed box.

Openability is a **lookup, not a hardcoded check** — the resolver asks the manifest whether
this object opens and what it reveals. A locked container later becomes a new branch in an
existing check plus a real verb, rather than a rewrite. No `UNLOCK` verb ships now, and no
speculative `lockedBy` field either.

Non-openable targets take the standard `blocked()` path in narrator voice.

**`qa:parser` baseline must be re-recorded.**

### 4.2 Flag-gated object visibility

Act 0 needs this twice, for the same reason both times: an object that is not in the room
yet must not be examinable, parseable, or mentioned in narration.

- The workbox's contents do not exist until it is opened.
- The boots, the workbox and the ticket do not exist until Mrs. Kemp has carried them up
  the stairs.

One manifest table maps object id to the flag that reveals it. One helper,
`visibleInteractables(story, locationId, flags)`, replaces direct reads of
`LocationDefinition.interactables`.

**This is the widest part of the change — nine call sites, not the three I first assumed:**

| File | Line | What it feeds |
|---|---|---|
| `components/Sidebar.tsx` | 68 | **The objects list the player can see.** Miss this and the workbox contents are listed before it is opened |
| `engine/narrationContext.ts` | 168 | What the AI is told is in the room |
| `engine/parseFallback.ts` | 37, 60 | AI parse candidates |
| `engine/resolvers/meta.ts` | 99 | Look / help object listing |
| `engine/resolvers/examine.ts` | 39, 186 | EXAMINE, and the SHOW presence check |
| `engine/resolvers/items.ts` | 18, 128, 176 | TAKE, USE-combination accessibility, USE |

`scripts/qa-validate.ts` and `scripts/build-story-map.ts` also read `interactables` and
should keep reading the **full** list — they are auditing the story, not playing it.

`qa:validate` gains a check that every gated object's flag is reachable, and that a
container's contents are not also listed flat in `interactables`.

### 4.3 NPC presence gated on a flag

`npcLocationAt` (`engine/presence.ts:70`) is the single source of truth for who is present,
and it derives purely from `scheduleByAct`. Give Mrs. Kemp an Act 0 entry and she is in the
parlour at curtain-up; give her none and she can never arrive. Neither is the scene.

An optional `presenceRequiresFlag` on `NPCDefinition`, checked inside `npcLocationAt`:
offstage until the flag is set, scheduled thereafter. This threads `flags` into
`npcLocationAt` and `getPresentNpcIds` — a signature change through two call sites.

The cheaper alternative (no schedule entry, write `currentLocation` directly on arrival)
works only because Watson never leaves Baker Street during Act 0, and breaks the first time
that stops being true. Not worth the fragility.

**Arrival trigger.** Holmes says "Go down, Watson." The arrival fires on the player's next
action, whatever it is. `go down` or `answer the door` reads as direct obedience; anything
else has Watson's errand happen around it. Either way she is up the stairs one turn after
Holmes spots her at the railings, and the boots, workbox and ticket become visible with her.

### 4.4 Escalating safety nets

`ActSafetyNet.instruction` accepts an array. The engine selects the rung by how many times
that net has fired and holds on the last one thereafter, delivering the spec's ladder:

> "You have not looked at everything she brought." → "The table, Watson." → "The box." →
> "The box is not locked, Watson."

Needs `safetyNetHits: Record<string, number>` on the session, since flags are boolean-only.
Keyed by act and net index. `qa:validate`'s safety-net pass updated for the array form.

Every later act inherits this blocking grammar.

### 4.5 TAKE must set a flag

The spec's gate includes `took_baker_street_pawn_ticket`. **That flag does not exist and
cannot currently be set.** `resolveTake` (`engine/resolvers/items.ts:13`) returns
`inventoryAdd` and no `flagsUpdate` at all — TAKE is the only verb in the game that leaves no
trace in the flag store, which is why the act's current gate reaches the ticket through
`showed_pawn_ticket_to_holmes` instead.

So: `resolveTake` sets `took_<loc>_<obj>` on a successful take, runs `checkActProgression`
against it like every other resolver does, and `flags.ts` gains a `TookFlag` template.

This is a change to a shared verb rather than to Act 0, so it needs a check that no existing
act gate or hint predicate is disturbed by a new flag family appearing. Nothing reads
`took_*` today, so the risk is additive only.

## 5. Story data

### 5.1 Objects at `baker_street`, act 0

| Object | Visible once | Verbs |
|---|---|---|
| `pawn_ticket` | Kemp arrives | EXAMINE, SHOW, TAKE |
| `nells_boots` | Kemp arrives | EXAMINE, SHOW |
| `nells_workbox` | Kemp arrives | OPEN, EXAMINE, SHOW |
| `nells_letters` | Workbox opened | EXAMINE, SHOW |
| `charity_card` | Workbox opened | EXAMINE, SHOW, TAKE |
| `concluded_case_file` | always | EXAMINE (scenery, retained) |
| `holmes_chemistry_table` | always | EXAMINE (scenery, retained) |
| `violin_case` | always | EXAMINE (scenery, retained) |

### 5.2 Facts

Rewrite the `mrs_kemp` block: **six days, not nine** (the Tuesday is load-bearing — she kept
her appointment and did not come home, and nine days back lands on a Saturday). Add
`kemp_sister_sickly_spring` (the load-bearing dismissal) and `kemp_landlady`.

Revise `holmes_no_case_here` to the spec's substance: no crime disclosed, the woman is found
and does not wish to be, what her sister does about it is a decision rather than a problem.
Flat, reasonable, and wrong. The id, gate position and framing all survive.

Add `holmes_boots_bermondsey`, `holmes_letters_tuesdays`, `holmes_honest_object`,
`holmes_mothers_name`.

Keep `holmes_crime_grown_dull`, `holmes_concluded_case`, `holmes_invisible_in_a_crowd`
unchanged in substance. `holmes_crime_grown_dull` is now earned by the reconstruction rather
than asserted.

Every topic list must cover the proper nouns the act's own prose puts in front of the
player. The card names Marchant and Snowsfields; the postmarks name Tuesdays; the boots name
Bermondsey. A player who reads one of those and asks about it must not hit silence.

### 5.3 SHOW interactions

| Show | To | Result |
|---|---|---|
| `pawn_ticket` | `holmes` | Pawned Monday, left Tuesday. Note the order. Two shillings badly spent. |
| `nells_boots` | `holmes` | Oak bark, lime, south-bank silt in a dry August. Bermondsey tanyards. |
| `nells_letters` | `holmes` | Three consecutive Tuesdays in S.E., unmentioned in eleven letters. |
| `charity_card` | `holmes` | **Triggers the reconstruction.** |
| `charity_card` | `mrs_kemp` | The give-the-card branch of the choice. |

`give` is already an alias for SHOW, so `give the card to mrs kemp` parses today.

### 5.4 The choice

Three literal flags — `gave_address`, `withheld_address`, `asked_first` — under
`prologue_kemp_choice`.

| Option | Input | Mechanism |
|---|---|---|
| Give her the card | `give the card to mrs kemp` | Existing SHOW interaction |
| Ask her first | `ask mrs kemp why she hid` | New TALK fact, existing mechanism |
| Keep it | `keep the card` / `say nothing` | The only parser work beyond OPEN |

Mrs. Kemp remains at the door until one of the three lands, so no option is reached by
omission — a player who simply did not think of it cannot have `withheld_address` recorded
against them silently.

No mechanical branching consequence within the act. The entire effect is on tone: two lines
of diary, and a flag feeding the disposition axis.

### 5.5 Gate

Six flags, five verbs, per the spec:

```
asked_mrs_kemp_about_kemp_sister_missing    TALK    — the hook
examined_baker_street_pawn_ticket           EXAMINE
opened_baker_street_nells_workbox           OPEN
showed_charity_card_to_holmes               SHOW    — triggers the reconstruction
took_baker_street_pawn_ticket               TAKE    — after she goes
asked_holmes_about_holmes_crime_grown_dull  TALK    — the closing beat
```

No `actEpilogues` entry. The act is Baker Street; there is nowhere to cut to.

### 5.6 No clues

`clueTriggers` for Act 0 stays empty. Nell's evidence must never enter the Ripper casebook —
she is unfound, unnamed again, and unconnected to anything. The reconstruction lives entirely
in narration, facts and the diary. This is a deliberate withholding, and §6 handles what the
player sees because of it.

### 5.7 Diary

An optional authored act-diary table keyed by act number, with the choice-dependent lines
swapped by flag. Acts with no entry keep today's AI reflection (`kind: 'act'`,
`engine/stories/whitechapel-1888/diary.ts:48`), so nothing else changes.

The two existing `DECISION_DIARY` entries (`read_pawn_ticket`,
`showed_pawn_ticket_to_holmes`) are rewritten — the ticket's meaning has changed completely,
and the second entry describes a refusal that no longer happens where it says it does.

### 5.8 Other story data

- `OBJECTIVES` in `hints.ts` rewritten against the six new gate flags. Subjects stay neutral
  and must not promise a payoff the act withholds.
- The window beat (`holmes_invisible_in_a_crowd`, already the act's `actBeat`) gains
  `requireFlags` so it cannot fire before Mrs. Kemp has left.
- The pawn ticket and, if kept, the charity card file to Documents at the 0→1 transition
  rather than riding along for seven acts.

## 6. UI

### 6.1 Containers in the Objects of Interest list

The sidebar's object list renders containers as parents and their revealed contents as
indented children:

```
OBJECTS OF INTEREST
  • Nell's Boots
  • The Pawn Ticket
  • Nell's Workbox    closed
```

```
OBJECTS OF INTEREST
  • Nell's Boots
  • The Pawn Ticket
  • Nell's Workbox
      ◦ Nell's Letters
      ◦ The Charity Card
```

**A closed container is annotated; an open one is not.** Once the children are nested
beneath it the indentation already says it is open, so a second marker is noise. The
annotation is lowercase, in the panel's existing muted italic, rather than a capitalised
parenthetical — everything else in that sidebar reads in the game's register and a
`(Closed)` tag reads as save-game state.

This is not decoration. It is the cheapest discoverability fix in the rebuild: a list item
that says *closed* is an invitation to type `open`, present at first glance rather than after
the player has already stalled. It demotes the safety-net ladder (§4.4) from primary teacher
to backstop, which is the right order. It also shows the letters and the card *coming out of
the box*, which is the act's own thesis rendered in furniture instead of stated.

**The narration line stays flat.** `**Objects of interest:** …` in the narration context
lists revealed contents as ordinary objects. The sidebar and the narration still agree on
*what* is present; the nesting is presentation only. Asking the AI to render tree structure
buys nothing and gives it something new to get wrong.

Cost: `Sidebar` gains a `flags` prop; `visibleObjects` becomes a two-level build from the
same container table §4.2 already introduces. No new story data.

### 6.2 Casebook empty states

The casebook's three panels already carry empty states (`components/DiaryModal.tsx:66`,
`:106`, `:204`). They were written for a mid-game empty and read as system messages during a
prologue that has no evidence in it by design. An authored copy pass so the prologue's empty
casebook reads deliberately rather than broken.

The lightbulb ("Gather your thoughts", `components/CommandInput.tsx:160`) is unchanged. It
runs `selectHint` against `OBJECTIVES`, not against clues, so an empty casebook does not
affect it.

## 7. Verification

| Suite | Why |
|---|---|
| `npm run lint` | Signature changes in `presence.ts` ripple |
| `npm run qa:validate` | Every story-data edit; plus the new gated-object and safety-net-array checks |
| `npm run qa:parser` | **Baseline re-record.** OPEN cases, `keep the card`, `look inside` |
| `npm run qa:engine` | Act 0 script rewritten. This suite is already red on purpose on this branch and must come back green |
| `npm run qa:hints` | `OBJECTIVES` rewritten |
| `npm run qa:all` | Before calling it done |

Then a live playtest. Automated review and subagent review both missed what a playtest found
in minutes last time; this act in particular is being rebuilt *because* of a playtest.

## 8. Risks

**Saves break.** Every Act 0 object id, flag and gate changes. Stated, not designed around.

**Object visibility is the first change to how the engine decides what is in a room**, and
it is wider than it looks: nine call sites across the engine, the resolvers and the sidebar
(§4.2). Any one missed shows up as an object the AI mentions that the parser cannot resolve,
or an object listed in the sidebar before it exists in the fiction. The sidebar is the one
most likely to be forgotten and the most visible when wrong.

**TAKE gaining a flag family changes a shared verb** for the sake of one act's gate (§4.5).
Nothing reads `took_*` today so it is additive, but it is the kind of change that is easy to
land without noticing it fires on every take in every act.

**Act 0 is unusually satisfying to solve.** The structure doc flags this and it survives
here: a player's first experience of the game's grammar is a full, clean answer, and Act 1
has to spend that expectation down hard. Worth putting to the blind playthrough directly —
does the drop from Act 0 to Act 1 read as the thesis, or as the game changing its mind?
