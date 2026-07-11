# Hansom Cab Travel (Open Act) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Within each act, the whole unlocked map is reachable via a hansom cab — a transient location with a driver — with tiered time costs and closed-destination refusals, leaving the six-act spine untouched.

**Architecture:** The cab is an ordinary `LocationDefinition` (`hansom_cab`) whose authored `exits` list is the full destination set; the existing act-filter in the sidebar and engine makes it grow with the story. `resolveMove` gains a cab fallback (non-adjacent + act-unlocked = ride) and boarding/alighting bookkeeping via one new optional session field. No AI changes — ride narration travels through the existing `actionResultNote`.

**Tech Stack:** TypeScript, existing deterministic engine + qa harnesses (`qa:engine`, `qa:validate`, `qa:parser`). No unit-test framework — correctness is `tsc --noEmit` + qa scripts.

**Spec:** `docs/superpowers/specs/2026-07-11-open-act-cab-and-npc-approaches-design.md`

**Branch:** `feat/hansom-cab-open-act` (create from `main` before Task 1; commit the spec file as the first commit).

---

### Task 1: Location type extensions (`district`, `conveyance`)

**Files:**
- Modify: `engine/stories/types.ts` (LocationDefinition, ~line 10–43)

- [ ] **Step 1: Add the two optional fields to `LocationDefinition`**

Insert after the `lockedNote` field:

```ts
  // Hansom-cab travel: which side of London this location sits on — drives
  // the two-tier ride cost (same district 15 min, cross-district 40 min).
  // qa:validate requires it on every location the cab serves.
  district?: 'west' | 'east';
  // Traversal-only location (the hansom cab): world events, vignettes, and
  // Holmes nudges are suppressed here, and WAIT is refused in-voice.
  conveyance?: boolean;
```

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: PASS (optional fields, nothing consumes them yet)

- [ ] **Step 3: Commit**

```bash
git add engine/stories/types.ts
git commit -m "feat(engine): add district and conveyance fields to LocationDefinition"
```

---

### Task 2: Story data — the `hansom_cab` location, boarding exits, districts

**Files:**
- Modify: `engine/stories/whitechapel-1888/locations.ts`
- Modify: `engine/stories/whitechapel-1888/flags.ts` (add `'examined_hansom_cab'` to the StoryFlag union, alongside the other `examined_*` literals)

- [ ] **Step 1: Add the cab location**

Add to `LOCATIONS_DATA` (after `baker_street`). The `exits` list is the FULL present-day destination list — the existing act filter (sidebar `visibleExits` and `narrationContext.availableExits` both check `exitLoc.act <= currentAct`) hides locked ones, and `resolveMove`'s act gate blocks them:

```ts
  hansom_cab: {
    id: 'hansom_cab',
    name: 'A Hansom Cab',
    shortName: 'A Hansom Cab',
    act: 1,
    timeframe: 'present',
    conveyance: true,
    district: 'east', // never used for pricing (rides price from the boarding point); present for validator uniformity
    atmosphere: 'Creaking leather, the smell of horse and wet oilcloth, London sliding past the window at a trot.',
    description: 'The hansom sways on its springs. Above and behind, the driver waits with the trap open, reins slack in his hand. "Where to, sir?"',
    exits: [
      'baker_street', 'dorset_street', 'millers_court', 'whitechapel_mortuary',
      'h_division_station', 'whitechapel_pub', 'lusk_office', 'bond_office',
      'private_asylum', 'bucks_row', 'hanbury_street', 'dutfields_yard',
      'working_mens_club', 'mitre_square', 'goulston_street',
    ],
    interactables: [],
    locationExaminedFlag: 'examined_hansom_cab',
    timeOfDay: 'afternoon',
  },
```

Interior destinations (Miller's Court, the club) stay in the list deliberately — the cab sets Watson down at the entrance and the narration walks him through; blocking them would refuse "go to Miller's Court" from across town, which violates forward momentum. `private_asylum` keeps its `requiresFlag` gate — the move resolver checks it on every path (Task 4 preserves this).

- [ ] **Step 2: Add `'hansom_cab'` to the exits of exterior locations**

Append `'hansom_cab'` to the `exits` array of exactly these seven locations: `baker_street`, `dorset_street`, `bucks_row`, `hanbury_street`, `dutfields_yard`, `mitre_square`, `goulston_street`. Interiors (mortuary, station, pub, offices, Miller's Court, club, asylum) do NOT board — Watson steps out to a street first.

- [ ] **Step 3: Add `district` to every present-day location**

`'west'`: `baker_street`, `bond_office`, `private_asylum`. `'east'`: every other present-day location (`dorset_street`, `millers_court`, `whitechapel_mortuary`, `h_division_station`, `whitechapel_pub`, `lusk_office`, `bucks_row`, `hanbury_street`, `dutfields_yard`, `working_mens_club`, `mitre_square`, `goulston_street`). (Bond's practice was Westminster — flag the west/east split to the narrative-consistency-reviewer in the PR.)

- [ ] **Step 4: Add the flag literal**

In `flags.ts`, add `'examined_hansom_cab'` next to the other location-examined literals.

- [ ] **Step 5: Typecheck + validate**

Run: `npm run lint && npm run qa:validate`
Expected: lint PASS. qa:validate PASS (new location has no clue/NPC references yet). If qa:validate complains about the cab (e.g. an NPC-placement or hint-coverage rule), read the failure — it must be resolved, not suppressed.

- [ ] **Step 6: Commit**

```bash
git add engine/stories/whitechapel-1888/locations.ts engine/stories/whitechapel-1888/flags.ts
git commit -m "feat(story): add hansom_cab location, boarding exits, and district tags"
```

---

### Task 3: Session + result plumbing for the boarding point

**Files:**
- Modify: `engine/session.ts` (SessionSnapshot)
- Modify: `types.ts` (EngineResult, near `minutesAdvanced` at ~line 212)

- [ ] **Step 1: Add `cabBoardedFrom` to SessionSnapshot**

After `rumorEvents`:

```ts
  // Where Watson hailed the current cab from — set on boarding, cleared on
  // alighting. Prices rides taken from inside the cab. Optional: absent on
  // old saves, in which case rides price at the cross-district tier.
  cabBoardedFrom?: string;
```

- [ ] **Step 2: Add the update channel to EngineResult**

Next to `minutesAdvanced` in `types.ts`:

```ts
  // Hansom-cab boarding point: a string when Watson boards (the location he
  // hailed from), null when he alights, undefined = unchanged.
  cabBoardedFromUpdate?: string | null;
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint` — Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add engine/session.ts types.ts
git commit -m "feat(engine): session + result plumbing for cab boarding point"
```

---

### Task 4: Engine — cab rides in `resolveMove`, WAIT guard, nudge/world-event suppression (TDD)

**Files:**
- Modify: `scripts/qa-engine.ts` (append a new section before the final summary)
- Modify: `engine/resolvers/move.ts`
- Modify: `engine/resolvers/meta.ts` (resolveWait, top)
- Modify: `engine/GameEngine.ts` (shouldFireHolmesNudge)
- Modify: `engine/narrationContext.ts` (world-events block, ~line 289)

- [ ] **Step 1: Write the failing qa:engine tests**

Append a section to `scripts/qa-engine.ts` using the existing `buildSnapshot`/`gameEngine.resolve`/`pass`/`fail` helpers. (Session base: `buildSnapshot({ currentAct: N, location: ..., flags: ... })`; act 2 canonical start is 9:00 AM / morning.)

```ts
// ── Hansom cab travel ────────────────────────────────────────────────────────
console.log('\n── Hansom cab travel ──');
{
  // 1. Boarding: dorset_street → hansom_cab is a plain exit move that records the boarding point.
  let snap = buildSnapshot({ currentAct: 2, location: 'dorset_street' });
  let r = gameEngine.resolve(parseIntent('hail a cab'), snap);
  if (r.actionSuccess && r.newLocation === 'hansom_cab' && r.cabBoardedFromUpdate === 'dorset_street') {
    pass('boarding the cab records cabBoardedFrom');
  } else fail('boarding the cab', JSON.stringify({ ok: r.actionSuccess, loc: r.newLocation, boarded: r.cabBoardedFromUpdate }));

  // 2. Riding from inside: cab → baker_street (east→west) costs 40 and clears the boarding point.
  snap = buildSnapshot({ currentAct: 2, location: 'hansom_cab', cabBoardedFrom: 'dorset_street' });
  r = gameEngine.resolve(parseIntent('go to baker street'), snap);
  if (r.actionSuccess && r.newLocation === 'baker_street' && r.minutesAdvanced === 40 && r.cabBoardedFromUpdate === null) {
    pass('cross-district ride from inside the cab costs 40 and clears boarding point');
  } else fail('ride from cab', JSON.stringify({ ok: r.actionSuccess, loc: r.newLocation, min: r.minutesAdvanced, boarded: r.cabBoardedFromUpdate }));

  // 3. Direct travel fallback: dorset_street → whitechapel_pub is NOT adjacent but both are east → 15 min, one turn.
  snap = buildSnapshot({ currentAct: 2, location: 'dorset_street' });
  r = gameEngine.resolve(parseIntent('go to the ten bells'), snap);
  if (r.actionSuccess && r.newLocation === 'whitechapel_pub' && r.minutesAdvanced === 15) {
    pass('named non-adjacent destination resolves as a local cab ride (15 min)');
  } else fail('direct cab fallback', JSON.stringify({ ok: r.actionSuccess, loc: r.newLocation, min: r.minutesAdvanced }));

  // 4. Adjacent walking move is unchanged (no minutesAdvanced).
  snap = buildSnapshot({ currentAct: 2, location: 'dorset_street' });
  r = gameEngine.resolve(parseIntent('go to millers court'), snap);
  if (r.actionSuccess && r.newLocation === 'millers_court' && r.minutesAdvanced === undefined) {
    pass('adjacent move still walks (no ride cost)');
  } else fail('adjacent move unchanged', JSON.stringify({ min: r.minutesAdvanced }));

  // 5. Act gate holds on the fallback: act-locked destination is refused, not ridden to.
  snap = buildSnapshot({ currentAct: 1, location: 'dorset_street' });
  r = gameEngine.resolve(parseIntent('go to the mortuary'), snap);
  if (!r.actionSuccess && !r.newLocation) pass('cab fallback respects the act gate');
  else fail('cab fallback act gate', JSON.stringify({ ok: r.actionSuccess, loc: r.newLocation }));

  // 6. No cab from an interior: mortuary → pub (non-adjacent, no hansom_cab exit) stays blocked.
  snap = buildSnapshot({ currentAct: 2, location: 'whitechapel_mortuary' });
  r = gameEngine.resolve(parseIntent('go to the ten bells'), snap);
  if (!r.actionSuccess) pass('no cab fallback from interiors');
  else fail('interior should not hail a cab', JSON.stringify({ loc: r.newLocation }));

  // 7. Closed at projected ARRIVAL: at act 2 evening (elapsed such that period is evening),
  //    riding to the mortuary (openPeriods morning/afternoon) is refused at no time cost.
  snap = buildSnapshot({ currentAct: 2, location: 'dorset_street', elapsedMinutes: 500 }); // 9:00 AM + 500 = 5:20 PM (evening)
  r = gameEngine.resolve(parseIntent('go to the mortuary'), snap);
  if (!r.actionSuccess && r.minutesAdvanced === undefined && !r.newLocation) {
    pass('driver refuses a ride to a destination closed at arrival, at no time cost');
  } else fail('closed-at-arrival refusal', JSON.stringify({ ok: r.actionSuccess, min: r.minutesAdvanced, loc: r.newLocation }));

  // 8. Boundary-crossing arrival check: departing at 11:50 AM morning (elapsed 170),
  //    a 15-min local ride arrives 12:05 PM = afternoon; mortuary open both — succeeds.
  snap = buildSnapshot({ currentAct: 2, location: 'dorset_street', elapsedMinutes: 170 });
  r = gameEngine.resolve(parseIntent('go to the mortuary'), snap);
  if (r.actionSuccess && r.newLocation === 'whitechapel_mortuary') pass('openness checked at arrival time across a period boundary');
  else fail('arrival-time openness', JSON.stringify({ ok: r.actionSuccess }));

  // 9. WAIT inside the cab is refused.
  snap = buildSnapshot({ currentAct: 2, location: 'hansom_cab', cabBoardedFrom: 'dorset_street' });
  r = gameEngine.resolve(parseIntent('wait'), snap);
  if (!r.actionSuccess && r.minutesAdvanced === undefined) pass('WAIT is refused inside the cab');
  else fail('WAIT in cab', JSON.stringify({ ok: r.actionSuccess, min: r.minutesAdvanced }));

  // 10. Ride from cab with no recorded boarding point (old save) prices at the safe cross tier.
  snap = buildSnapshot({ currentAct: 2, location: 'hansom_cab' });
  r = gameEngine.resolve(parseIntent('go to the ten bells'), snap);
  if (r.actionSuccess && r.minutesAdvanced === 40) pass('missing boarding point falls back to cross-district pricing');
  else fail('fallback pricing', JSON.stringify({ min: r.minutesAdvanced }));
}
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx tsx scripts/qa-engine.ts 2>&1 | grep -A2 "Hansom cab"`
Expected: FAILs (parser may already resolve targets, but no cab location/fallback exists yet — case 1 fails on `cabBoardedFromUpdate`, 2/3 on blocked moves, etc.). Pre-existing sections must still PASS.

- [ ] **Step 3: Implement the cab logic in `resolveMove`**

Rework `engine/resolvers/move.ts`. Constants at top of file:

```ts
const CAB_ID = 'hansom_cab';
const CAB_COST_LOCAL = 15;   // minutes, same district
const CAB_COST_CROSS = 40;   // minutes, cross-district (also the no-boarding-point fallback)

function cabCost(story: StoryManifest, fromId: string | undefined, toId: string): number {
  const from = fromId ? story.locations[fromId]?.district : undefined;
  const to = story.locations[toId]?.district;
  return from && to && from === to ? CAB_COST_LOCAL : CAB_COST_CROSS;
}
```

Then, replacing the current "no direct path" early-return (keep every check in this order — exit/cab eligibility, act gate, requiresFlag gate, openPeriods at arrival, success):

```ts
  const targetLoc = story.locations[targetId];
  const isAdjacent = currentLoc.exits.includes(targetId);
  const inCab = currentLoc.id === CAB_ID;
  const canHailHere = currentLoc.exits.includes(CAB_ID);
  const boardingCab = targetId === CAB_ID;
  // A ride = leaving the cab for a destination, or a named non-adjacent,
  // present-day destination from a street with a cab stand.
  const isCabRide = !!targetLoc && !boardingCab && targetId !== session.location &&
    (inCab || (!isAdjacent && canHailHere && (targetLoc.timeframe ?? 'present') === 'present'));

  if (!targetLoc || (!isAdjacent && !isCabRide)) {
    const targetName = targetLoc?.name || intent.targetRaw;
    return blocked(story, intent, session,
      `There is no direct path from ${currentLoc.name} to ${targetName} from here.`,
      `Watson attempted to go to "${targetName}" but that exit is not available from ${currentLoc.name}.`);
  }

  const rideOrigin = inCab ? session.cabBoardedFrom : session.location;
  const rideMinutes = isCabRide ? cabCost(story, rideOrigin, targetId) : 0;
```

The existing act gate and `requiresFlag` blocks stay verbatim (they now also guard rides). The openPeriods block changes in exactly one expression — the period becomes the **projected arrival** period:

```ts
  const period = periodOf(story, session, rideMinutes);
```

and when `isCabRide`, the blocked copy is the driver's (replace the two text arguments inside that block only when `isCabRide`):

```ts
    if (isCabRide) {
      return blocked(story, intent, session,
        `The driver shakes his head. "${targetLoc.name}'ll be shut by the time we're there, sir."`,
        `BLOCKED — the cab driver refuses the fare: ${targetLoc.name} will be closed (${period}) on arrival. ` +
        (reopens ? `It opens come ${reopens}.` : '') + keyholderNote +
        ` Convey this as the driver's word from his perch — Watson has NOT travelled and no time has passed. ` +
        `He may wait, or name another destination.`);
    }
```

The success return gains three lines (and the cab-flavoured description when riding):

```ts
  return {
    actionSuccess: true,
    actionType: 'move',
    newLocation: targetId,
    minutesAdvanced: isCabRide ? rideMinutes : undefined,
    cabBoardedFromUpdate: boardingCab ? session.location : (inCab || isCabRide) ? null : undefined,
    npcUpdates: newNpcUpdates,
    flagsUpdate: actCheck.flagsUpdate,
    newAct: actCheck.newAct,
    gameOver: actCheck.gameOver,
    discoveredClueIds: [],
    aiContext: buildNarrationContext(story, intent, session, {
      success: true,
      actionDescription: isCabRide
        ? `Watson took a hansom cab from ${story.locations[rideOrigin ?? session.location]?.name ?? 'the street'} to ${targetLoc.name} (about ${rideMinutes} minutes through the London streets).`
        : `Watson travelled from ${currentLoc.name} to ${targetLoc.name}.`,
      actionResultNote: isCabRide
        ? `SUCCESS — Watson has arrived at ${targetLoc.name} by hansom cab. Mention the ride briefly (a sentence — streets sliding past, the fare paid) before the arrival proper.`
        : `SUCCESS — Watson has arrived at ${targetLoc.name}.`,
      newClueDefs: [],
      targetLocationId: targetId,
      newNpcUpdates,
      extraMinutes: isCabRide ? rideMinutes : undefined,
    }),
  };
```

Note `extraMinutes` — it makes the narration context (present NPCs, time label, weather drift) reflect the arrival moment, exactly as WAIT already does.

- [ ] **Step 4: WAIT guard in `resolveWait`**

Top of `resolveWait` in `engine/resolvers/meta.ts`:

```ts
  if (story.locations[session.location]?.conveyance) {
    return blocked(story, intent, session,
      'The driver clears his throat pointedly from his perch.',
      'BLOCKED — Watson tried to wait inside the hansom with the meter running. The driver makes it politely ' +
      'clear, in a word or a look, that the cab is for riding. Watson should name a destination or step down. ' +
      'No time passes.');
  }
```

(`blocked` is already imported in meta.ts via `buildNarrationContext` — add `blocked` to the existing import from `'../narrationContext'`.)

- [ ] **Step 5: Suppress the Holmes nudge and world events in the cab**

`engine/GameEngine.ts`, first line of `shouldFireHolmesNudge`:

```ts
    if (this.story.locations[session.location]?.conveyance) return false; // never nudge mid-ride
```

`engine/narrationContext.ts`, world-events block (~line 291) — events fire on arrival, not mid-ride; wrap the existing `firedEvents` computation:

```ts
  const firedEvents = loc.conveyance ? [] : story.worldEvents
    .filter(...)
```

(Vignettes need no guard — the cab authors none; the vignette picker finds nothing.)

- [ ] **Step 6: Run the tests**

Run: `npx tsx scripts/qa-engine.ts`
Expected: all 10 new cases PASS; all pre-existing sections PASS. If case 3 fails on parsing ("the ten bells" → `whitechapel_pub`), check `matchLocationId` resolves it (the pub's `name` is "The Ten Bells") before touching the resolver.

- [ ] **Step 7: Typecheck + full suite**

Run: `npm run lint && npm run qa:engine && npm run qa:validate && npm run qa:hints && npm run qa:diary-leads`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add engine/resolvers/move.ts engine/resolvers/meta.ts engine/GameEngine.ts engine/narrationContext.ts scripts/qa-engine.ts
git commit -m "feat(engine): hansom cab rides — boarding, direct-travel fallback, arrival-time openness, WAIT guard"
```

---

### Task 5: Hook + persistence plumbing for `cabBoardedFrom`

**Files:**
- Modify: `hooks/useGameState.ts` (snapshot build + result application — grep `elapsedMinutes` and mirror its flow; the apply site is near `ACTION_TIME_MINUTES`, ~line 480)
- Modify: `hooks/gameState/usePersistence.ts` (save payload + load restore — mirror `elapsedMinutes` at ~lines 80/132/193/215)

- [ ] **Step 1: Add state + snapshot wiring in `useGameState.ts`**

Add a `cabBoardedFrom` state (default `undefined`) beside the `elapsedMinutes` state, include it in the `SessionSnapshot` object handed to `gameEngine.resolve`, and apply the result channel where `minutesAdvanced` is applied:

```ts
      if (result.cabBoardedFromUpdate !== undefined) {
        setCabBoardedFrom(result.cabBoardedFromUpdate ?? undefined);
      }
```

- [ ] **Step 2: Persist and restore**

In `usePersistence.ts`, add `cabBoardedFrom` to the saved investigation payload and restore it on load with `(investigation as any).cabBoardedFrom ?? undefined` — same defensive pattern as `elapsedMinutes` (old saves lack the field; the engine already treats absence as "price at cross tier"). New-game reset sets it back to `undefined`.

If the Supabase `investigations` row schema whitelists columns rather than storing a JSON blob, add a nullable `cab_boarded_from text` column via a new migration in `supabase/migrations/` following the naming pattern of the latest file there; if state is a JSON payload, no migration is needed. Check `services/GameRepository.ts` to see which applies before writing anything.

- [ ] **Step 3: Typecheck + manual smoke**

Run: `npm run lint` — Expected: PASS.
Then `npm run dev`, play to Act 1, "hail a cab", save, reload, "go to baker street" — arrival works and the clock advanced 40 minutes (sidebar clock).

- [ ] **Step 4: Commit**

```bash
git add hooks/useGameState.ts hooks/gameState/usePersistence.ts
git commit -m "feat(hooks): persist cab boarding point through session state and saves"
```

---

### Task 6: Parser — cab phrasings

**Files:**
- Modify: `engine/intentParser.ts` (insert before the Movement branch, ~line 537)
- Modify: `scripts/qa-parser.ts` (fixture corpus, ~line 354 area)

- [ ] **Step 1: Add the cab pre-check in `parseIntent`**

"take a cab to X" currently falls through to TAKE ('take' is a TAKE verb) — so cab phrasings need a branch BEFORE Movement (and before Take):

```ts
  // 3c. Hansom cab phrasings — must run before MOVE/TAKE ("take a cab to X"
  // would otherwise parse as TAKE). With a destination it is a normal move
  // to that destination (the resolver decides it is a ride); bare hailing
  // moves into the cab itself.
  const cabMatch = norm.match(
    /^(?:take|hail|call|flag(?: down)?|catch|hire)\s+(?:a\s+|the\s+)?(?:hansom(?:\s+cab)?|cab|carriage)(?:\s+to\s+(.+))?$/
  );
  if (cabMatch) {
    const dest = cabMatch[1]?.trim();
    if (dest) {
      return { type: 'move', targetId: matchLocationId(dest), targetRaw: dest, raw: rawInput };
    }
    return { type: 'move', targetId: 'hansom_cab', targetRaw: 'hansom cab', raw: rawInput };
  }
```

("go to X" needs nothing — it already parses as move; the resolver now handles non-adjacent targets.)

- [ ] **Step 2: Add qa:parser fixtures**

In the fixture corpus in `scripts/qa-parser.ts` (same shape as the existing entries):

```ts
  { scene: { location: 'dorset_street', act: 2 }, input: 'hail a cab',
    expect: { type: 'move', targetId: 'hansom_cab' } },
  { scene: { location: 'dorset_street', act: 2 }, input: 'take a cab to the mortuary',
    expect: { type: 'move', targetId: 'whitechapel_mortuary' } },
  { scene: { location: 'goulston_street', act: 4 }, input: 'take a hansom to baker street',
    expect: { type: 'move', targetId: 'baker_street' } },
  { scene: { location: 'hansom_cab', act: 2 }, input: 'the ten bells, driver',
    expect: { type: 'other' } }, // free address without a verb stays AI-fallback territory — documents the boundary
```

- [ ] **Step 3: Run qa:parser and reconcile the baseline**

Run: `npm run qa:parser`
Expected: the three deterministic cab cases PASS; the run is regression-gated against a recorded baseline — follow the baseline-update procedure documented in the header of `scripts/qa-parser.ts` for the intentionally-added cases. No previously-passing case may regress.

- [ ] **Step 4: Commit**

```bash
git add engine/intentParser.ts scripts/qa-parser.ts
git commit -m "feat(parser): hansom cab phrasings (hail/take a cab to …)"
```

---

### Task 7: qa:validate rules for the cab graph

**Files:**
- Modify: `scripts/qa-validate.ts` (new section, following the existing `section(...)` conventions)

- [ ] **Step 1: Add the validator section**

```ts
section('Hansom cab graph');
{
  const cab = LOCATIONS['hansom_cab'];
  if (!cab) fail('hansom_cab location exists');
  else {
    for (const dest of cab.exits) {
      if (!locationIds.has(dest)) fail(`cab destination "${dest}" resolves`);
      else if ((LOCATIONS[dest].timeframe ?? 'present') !== 'present') fail(`cab destination "${dest}" is present-day`);
      else if (!LOCATIONS[dest].district) fail(`cab destination "${dest}" has a district tag`);
      else pass(`cab destination "${dest}" ok`);
    }
    if (cab.interactables.length > 0) warn('hansom_cab has interactables', 'conveyance locations should stay empty');
    if (!cab.conveyance) fail('hansom_cab is marked conveyance');
    // Every location that can board must itself be a valid destination-with-district
    for (const [id, loc] of Object.entries(LOCATIONS)) {
      if (id === 'hansom_cab' || !loc.exits.includes('hansom_cab')) continue;
      if (!loc.district) fail(`cab-boarding location "${id}" has a district tag`);
      else pass(`cab-boarding location "${id}" ok`);
    }
  }
}
```

- [ ] **Step 2: Run it**

Run: `npm run qa:validate` — Expected: PASS across the new section.

- [ ] **Step 3: Commit**

```bash
git add scripts/qa-validate.ts
git commit -m "test(qa): validate hansom cab destination graph and district coverage"
```

---

### Task 8: Time-of-day authoring pass (data-only)

**Files:**
- Modify: `engine/stories/whitechapel-1888/locations.ts` (openPeriods)
- Modify: `engine/stories/whitechapel-1888/npcs.ts` (byPeriod enrichment)

- [ ] **Step 1: Author opening hours**

Load the `historian` skill first (period accuracy), then:

- `whitechapel_pub` (The Ten Bells): `openPeriods: ['morning', 'afternoon', 'evening', 'night', 'lateNight']` — shut only at dawn for the floor-scrub and the cellar; `lockedNote: { text: 'The Ten Bells is shuttered, chairs up on the tables; through the glass a potboy works a mop across the sawdust.' }` (no keyholder — it simply opens).
- `lusk_office`: `openPeriods: ['morning', 'afternoon', 'evening']`, `lockedNote: { text: 'Lusk\'s office is dark, the Vigilance Committee\'s notice still pinned to the door.', keyholderNpcId: 'lusk' }` — **only if `lusk` exists as an NPC in npcs.ts; otherwise omit keyholderNpcId.**
- `bond_office`: leave always-open (Bond's schedule already has him there evenings/nights in acts 2–3 — closing the office would contradict his own presence).

- [ ] **Step 2: Enrich two or three NPC schedules**

Extend the existing pattern (Abberline: evenings at the pub) — e.g. give Phillips an evening `byPeriod` away from the mortuary, and one more cast member a plausible evening move. Constraint (spec, forward momentum): do not touch the `default` of any act where the NPC carries a `talked_to_*` gate flag — the existing qa:validate canonical-period rule enforces the floor; keep changes to `byPeriod` only.

- [ ] **Step 3: Full suite + reviewers**

Run: `npm run qa:all`
Expected: PASS — pay attention to qa:validate's gate-NPC rule and qa:hints (hints must not point at a closed location without the redirect machinery covering it — existing behavior, verify no FAIL).

Then dispatch the `narrative-consistency-reviewer` agent over the changed story files, per CLAUDE.md.

- [ ] **Step 4: Commit**

```bash
git add engine/stories/whitechapel-1888/locations.ts engine/stories/whitechapel-1888/npcs.ts
git commit -m "feat(story): opening hours for the Ten Bells and Lusk's office; evening schedule moves"
```

---

### Task 9: Finish line

- [ ] **Step 1: Update the qa-engine header comment**

The location-graph comment at the top of `scripts/qa-engine.ts` (lines 19–34) lists exits — add `hansom_cab` and its edges so the next reader isn't misled.

- [ ] **Step 2: Full verification**

Run: `npm run qa:all && npm run qa:narration-inject`
Expected: PASS everywhere. Then a browser pass per the `verify` skill: dev server, hail a cab, ride cross-town, arrive at a closed pub at dawn, WAIT, enter.

- [ ] **Step 3: Reviews and PR**

Dispatch `engine-logic-reviewer` (engine/ changed) and `engineering-reviewer` (hooks/ changed). Address findings. Then commit any fixes and open a PR titled "feat: hansom cab travel — open-act map within the act spine", body summarizing the spec link and qa evidence.
