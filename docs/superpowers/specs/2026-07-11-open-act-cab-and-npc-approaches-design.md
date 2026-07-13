# Open Act — Hansom Cab Travel & NPC Approaches (Design)

> **STATUS UPDATE (2026-07-12):** The hansom cab / open-act travel feature described below was fully implemented, reviewed, and merged to a clean state on `feat/hansom-cab-open-act` (pushed to origin, not merged to main) — then rejected after playtesting: the game is better as a linear experience. That work is archived, not in progress. **Feature 1 (NPC approaches) below is unaffected and is what this document now supports.**

**Date:** 2026-07-11
**Decisions made during brainstorm:** Tier A scope only (the six-act spine, anchors, bridges, and gates are untouched — openness lives *within* each act); cab reaches act-unlocked, present-day locations; the cab is itself a transient location whose Avenues list is the destination picker; a named destination skips the cab scene; NPC approaches are pure world flavor (mundane beats + rumor delivery) — the Watson hint system stays separate and unchanged; Edmund gets approaches like everyone else; an approach counts as a first TALK for introductions (self-introduction NPCs give their name in-beat; document-gated NPCs stay alias-masked); rumor approaches must be non-anachronistic (guaranteed by trigger-flag maturity; mundane text guarded by flag/act gating rules); build order is cab first, approaches second, as two independent branches/PRs.

## Goal

Two features that make the world feel inhabited rather than corridor-shaped:

1. **Hansom cab travel** — within an act, the whole unlocked map is reachable
   from any street. Baker Street becomes a true home base. Time-of-day starts
   to matter: rides burn clock, doors close, people move.
2. **NPC approaches** — the world initiates contact. Authored one-shot beats
   where an NPC steps up to Watson with something mundane, or delivers a
   matured rumor, instead of waiting silently to be addressed.

Both are texture, not plot. Acts still advance on gates; the AI still only
narrates outcomes the engine has already resolved.

## Feature 1 — Hansom cab travel

### The cab is a location, not a verb

A new location `hansom_cab` in the manifest (act: 1 — unavailable during the
Act 0 vigil, free automatically thereafter):

- **Boarding:** street/exterior locations gain `'hansom_cab'` in their
  `exits` array (data-only — the sidebar renders "A hansom cab" as one
  Avenues entry via the existing shortName mechanism, and MOVE into it needs
  no new engine path). Interiors (Miller's Court room, the mortuary, offices,
  the asylum) do not board a cab — step out to the street first.
- **Inside:** authored atmosphere (creaking leather, the driver's silhouette,
  fog past the window) and the driver's beat — "Where to, sir?". The driver
  is a real NPC shell with alias "the cabman", `requiresIntroduction`, no
  gate flags, no knowledge envelope entries in v1.
- **Destinations:** `hansom_cab.exits` is authored as the full destination
  list. The sidebar already filters exits by `act <= currentAct`
  (`Sidebar.tsx` `visibleExits`), and the move resolver applies the same act
  gate — so the destination list grows with the story with zero new UI or
  bookkeeping. Diary/reconstruction sequences are untouched: the cab serves
  the present-day map only.
- **Why this shape:** the long list of destinations only ever appears while
  Watson is sitting in a cab, where it is diegetic and expected. Street
  locations keep their short walking-exit lists plus one constant entry.
  Restraint-in-UI principle preserved: no map, no travel menu.

### Named destinations skip the scene

MOVE to a location that is not an adjacent exit falls through to a cab
journey when: the target is act-unlocked, present-day, and the current
location has cab access. One turn — the narration mentions hailing and the
ride in passing. The cab scene exists for players who want to browse their
options or enjoy the ritual; both paths share one resolver.

From inside the cab, naming any unlocked destination rides there.

### Time cost

Two tiers driven by a `district` tag on locations (`'west'` — Baker Street;
`'east'` — everything in Whitechapel/Spitalfields):

- same district: **15 min**
- cross-district: **40 min**

Returned via the existing `EngineResult.minutesAdvanced` channel (the WAIT
mechanism) — a single clock authority, no new time plumbing.

Riding from inside the cab needs the boarding point for cost computation:
new optional session field `cabBoardedFrom?: string`, set on entering
`hansom_cab`, cleared on arrival. Optional field ⇒ zero save migration.

### Closed destinations — the driver knows

Openness (`openPeriods`) is checked at **projected arrival time** (now +
tier cost). If the destination will be shut, the journey is refused before
departing, at no time cost, with the refusal carried diegetically by the
driver ("The mortuary'll be bolted at this hour, sir") plus the existing
computed next-open-period. This avoids the absurdity of a 40-minute ride to
a locked door — and never dead-ends the player (they can WAIT or go
elsewhere). Walking into a closed adjacent location keeps today's
`lockedNote` behavior unchanged.

### Edge rules

- **WAIT inside the cab** is refused in-voice (the driver, meter running,
  clears his throat) — passing time happens by riding or by waiting
  somewhere real. A ride itself may legitimately cross a period boundary;
  that is the normal clock advancing, handled by the arrival-time rules
  above.
- **No approaches, vignettes, or world-event blockquotes fire while in the
  cab** — it is a corridor, not a scene. (World events pending after a ride
  fire on arrival, per the existing batching rule.)
- **Act transitions cannot fire mid-cab** — the cab has no interactables and
  the driver sets no flags, so no gate can complete there. Asserted in
  qa:engine, not special-cased in code.
- **Save/load mid-cab** is safe: `hansom_cab` is an ordinary location in
  session state (plus `cabBoardedFrom`). qa:engine case, no code.
- **Act anchors unchanged:** act advance still hard-cuts to the anchor and
  carries followers, wherever Watson was.

### Time-of-day authoring pass (data-only companion commit)

The mechanisms all exist (`openPeriods`/`lockedNote`, `scheduleByAct.byPeriod`,
`returnsPeriodFor`); this is authoring:

- `openPeriods` + `lockedNote` for the Ten Bells, Lusk's office, Bond's
  office (H Division and street locations stay always-open).
- Richer `byPeriod` schedules for the main cast so evenings genuinely
  relocate people (the Abberline-at-the-Ten-Bells pattern, extended).
- **Forward-momentum guard:** every gate-flag NPC remains reachable in at
  least one period of each of their acts, and every closed door or absent
  NPC says when to come back (existing redirect machinery). The Phase 4a
  qa:validate rule (gate NPC at `default` during the act's canonical-start
  period) already enforces the floor; schedule authoring must not weaken it.

### Parser surface

- Regex: "hail a cab", "take a cab", "cab to <place>", "hansom" →
  move-to-`hansom_cab` or direct travel when a destination is named.
- The tool-call fallback's candidate builder already lists act-unlocked
  locations as move candidates or gains them; a few qa:parser fixtures join
  the corpus ("take a cab to the mortuary", "go to baker street").

## Feature 2 — NPC approaches

### Data model

New story file `engine/stories/whitechapel-1888/approaches.ts`, exposed on
the manifest as `approaches: ApproachDefinition[]`:

```ts
interface ApproachDefinition {
  id: string;                       // unique; fired flag is approach_<id>
  npcId: string;
  locationId: string | 'any';       // where it can happen
  acts?: number[];                  // omitted = any act the NPC is onstage
  timePeriods?: TimePeriod[];
  requireFlags?: StoryFlag[];
  forbidFlags?: StoryFlag[];
  kind: 'mundane' | 'rumor';
  text: string;                     // authored beat; for 'rumor', the delivery framing
  rumorId?: string;                 // kind 'rumor': the spread entry being delivered
}
```

All approaches are one-shot (vignette pattern: `approach_<id>` flag). The
authored `text` is the canonical content — the AI dresses it, never invents
it.

### Engine seam

In the narration-context build, beside the vignette picker: choose **at most
one** eligible approach per turn. Eligibility:

- NPC present at Watson's location per `npcLocationAt`, not deceased.
- Act/period/flag conditions met; for `kind: 'rumor'`, the referenced spread
  entry has matured for this NPC (`maturedSpreadsFor`) and is not already
  delivered.
- Not already fired; global cooldown satisfied.

Deterministic pick: first eligible in authored order. Delivered on the
context as `npcApproach: { npcId, displayName, kind, text, introducesSelf }`,
with `displayName` routed through the introduction/alias system.

### Introductions on approach

**An approach counts as a first TALK for introduction purposes** — no new
data field, the existing `introduction` machinery decides:

- NPC with `introduction` absent (self-introduces on first talk): the
  approach flips the introduced state exactly as a first conversation would,
  and the context carries `introducesSelf: true` so the narration presents
  the reveal in-beat — the stranger steps up *and gives their name*
  ("Begging your pardon, Doctor — Mulligan, I keep the bar here").
- NPC with a `document` introduction (Edmund): the gate is spoiler-critical
  and an approach never bypasses it. `introducesSelf: false`, alias-masked
  as today ("Bond's assistant"), same hard prompt enforcement against name
  leaks. His mundane approaches are authored to read naturally under the
  alias.

### Suppression rules (the load-bearing part)

An approach never fires on: clue-discovery turns, act-transition turns,
deduction turns, failed/blocked actions, any non-`full` narration mode, the
`hansom_cab` location, or within **30 in-game minutes** of the previous
approach (new optional session field `lastApproachAtMinutes?: number` —
reuses the clock, no turn counter, zero save migration). A turn that shows a
vignette does not also show an approach (one ambient beat per turn, vignette
wins — it was authored for the location).

### Temporal validity — no rumors about things that haven't happened

Two layers, one per approach kind:

- **`kind: 'rumor'` is non-anachronistic by construction.** A rumor spread
  entry only matures after its rumor's `triggerFlag` has actually fired and
  the authored delay has elapsed (`maturedSpreadsFor`) — the underlying
  event has always already happened in this playthrough before any NPC can
  deliver it. No new mechanism needed; a qa:engine case pins it (a rumor
  approach never fires before its trigger flag is set).
- **`kind: 'mundane'` is guarded by authoring rules + validation.** Mundane
  text must not reference datable story happenings (a murder, an arrest,
  Tumblety's flight, a world event) unless the approach is gated behind them:
  reference a world event ⇒ `requireFlags` must include its
  `world_event_<id>` delivered flag; reference an act-specific happening ⇒
  `acts` must start no earlier than that act. qa:validate runs the existing
  spoiler guard over all approach text, and the narrative-consistency-reviewer
  agent reviews mundane approaches for period/timeline anachronisms as part
  of any PR touching `approaches.ts`.

### The Edmund rule

Per game direction, Edmund must never be spotlighted — including by
omission. He receives 2–3 mundane approaches authored with the same warmth
as everyone else's. An approach system where everyone except the murderer
initiates contact is an accidental tell.

### Prompt surface

`buildNarrationPrompt` gains an `npcApproach` block instructing the AI to
weave the NPC initiating contact into the scene, using the authored text as
the content spine, subject to the existing alias/spoiler hard rules. No new
response fields — approaches change nothing about what the AI may return.

## Error handling / failure posture

Everything here is deterministic engine/data logic; there is no AI call to
fail. Refusals (closed destination, WAIT in cab) are authored, in-voice, and
always name a way forward. All new session fields are optional — old saves
load with cab and approaches simply dormant until used.

## Testing

1. **qa:validate (data, no key):**
   - Approach integrity: npc/location/flag/rumor ids resolve; `rumorId`
     required iff `kind: 'rumor'`; ids unique; **the NPC's schedule actually
     places them at `locationId` during the approach's acts/periods** (the
     easy silent break); approach text passes the spoiler guard.
   - Cab graph: every `hansom_cab` destination exists and is present-day;
     every cab-bearing location's `district` is set; every `openPeriods`
     location still has a `lockedNote`.
2. **qa:engine (no key):** tier time costs; closed-destination refusal at
   projected arrival time (including the ride-crosses-a-boundary case);
   direct-travel fallback vs adjacent MOVE unchanged; WAIT-in-cab refusal;
   act-gate assertion (no transition can fire in-cab); save/load mid-cab;
   approach fires once, respects cooldown, suppressed on clue/act/deduction
   turns; a self-introduction NPC's first approach flips the introduced
   state (and never re-fires as unintroduced); a document-gated NPC's
   approach stays alias-masked with the introduction flag untouched; a
   rumor approach never fires before its rumor's trigger flag is set.
3. **qa:parser fixtures:** cab phrasings and named-destination travel.
4. **No-regression gate:** `npm run qa:all` green before either branch is
   considered done; the time-of-day authoring pass lands as its own
   reviewable data-only commit after the cab engine work proves parity.

## Out of scope

- Tier B (alternative evidence paths for act-gate flags) — candidate
  follow-up spec once the open act is playable.
- Tier C (continuous time across the two weeks, no act anchors) — assessed
  and rejected for this story; the act spine is its pacing engine. A future
  second story can be designed hub-first from day one.
- Hint delivery via NPCs (`selectHint` is untouched).
- The cabman as a rumor/approach channel and any cabman knowledge envelope
  — natural v2 once both features exist.
- Events with world effects, new locations, new NPCs beyond the cabman shell.
