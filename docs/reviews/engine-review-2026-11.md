# Engine review, November 2026

Reviewed: `main` at `6af289ae6224adad557292d43b2d2143d537aee0` (the merge of silentpixel-git/London-Gemeni#57). Baseline `npm run qa:all`: 52 passed, 0 failed.

Scope as briefed: `packages/schema`, `packages/engine`, `packages/ai`, `server/turn.ts`, `server/investigationStore.ts`, `api/turn.ts`, migrations 009 and 010, `hooks/useInvestigation.ts`, `services/turnClient.ts`. Every High below was reproduced with a throwaway `npx tsx` script against the engine or the in-process turn handler; the essential part of each script and its output are in the finding. Nothing in engine, server or schema code was changed.

## Summary

Phase 6 can start on this engine. The core is sound: State is a pure fold of the log, the server, `feedOf` and `playerView` all fold with the same `apply`, every random draw is recorded, and the seq series plus the "one turn at a time" rule hold under the races I could construct. I found no replay divergence and no way to read another account's log.

What I did find is a layer of semantic traps between what an author will reasonably write and what the engine does, and none of them produce an error. Four should be fixed before the first act is authored, because each one shapes how every act's Rules are written:

1. **The prover cannot wait.** Time is abstracted to the period, so idle Ticks within a period are pruned as already-seen states. Any goal behind a period boundary that has no `clock` Rule in that act is reported UNREACHABLE (finding H1). A Whitechapel act with "the pub opens at six" and no clock Rule will fail the prover for a reason that is not in the Story.
2. **The prover and the endpoint disagree on what a player can select.** The prover resolves Intents directly; the endpoint confines them to the Candidate Set first. `deduce <absent suspect>` is REACHABLE for the prover and `none` in play; `examine <person>` and `use <object> on <person>` are offered to the model by the prompt and always rejected by the endpoint (H2, H3).
3. **The opening runs no Rules** (H4). `enter` on the opening location and `proximity` for whoever stands there fire on the second turn or on return, while entering any later act does fire `enter` on its anchor.
4. **Delayed `grantFact` counts period boundaries the clock *ticks* through, not the ones an act jump skips** (H5). The stress fixture already shows it: Orrin's rumour, delayed one period, reaches Maud in the evening, two periods after it was told.

Then fix H6 to H9 (ignored `knownBy: ['player']`, a `proximity` Rule that advances the act stranding the typed verb, the gate's number check being void on Tick turns, and the silent turn when the gate rejects twice with no Beats). The Mediums are mostly things an author must *know*; they can be written into `docs/act-authoring-process.md` instead of fixed, and I say which.

Points 1, 2 and 8 of the brief got the most time. The log/replay story (1) is the strongest part of the engine. Rule semantics (2) is where the traps are. The endpoint (8) is correct about state and loses prose in two situations an author cannot prevent.

## Findings

### Critical

None. I found no input that produces a State the log does not justify, no divergence between `resolveTurn`, `replay`, `feedOf` and `playerView`, and no path to another owner's rows.

### High

#### H1. The prover cannot cross a period boundary by waiting: false UNREACHABLE for anything period-gated

`packages/engine/prover.ts:148-161` (`abstractKey` reduces the clock to `currentPeriod`), `prover.ts:124-136` (the only time actions are a 15-minute tick, a 30-minute wait, and "wait until" each pending `clock` Rule of the *current* act).

A tick that stays inside the current period produces a State whose abstract key is identical to its parent, so it is dropped as seen. The only way the prover moves the clock is as a side effect of verbs that change something else (each costs minutes), or a "wait until" action, which exists only when a `clock` Rule is eligible in this act. A location with `openPeriods`, a person whose `byPeriod` schedule puts them somewhere later in the day, a `when.period` condition, or a delayed `grantFact` can all be unreachable for the prover while a player reaches them by pressing wait.

**Reproduced.** The stress fixture with the net loft open only in the evening (act 0 starts at 11:00, no `clock` Rule in act 0) and a Clue granted on entering it:

```ts
const story = variant(r => {
  r.locations.find(l => l.id === 'net_loft').openPeriods = ['evening'];
  r.facts.push({ id: 'loft_fact', statement: '…', knownBy: [], visibleFromAct: 0, topics: ['the nets'] });
  r.clues.push({ id: 'clue_loft', name: 'Dry Nets', fact: 'loft_fact', summary: '…' });
  r.rules.push({ id: 'loft_in_act0', trigger: { kind: 'enter', location: 'net_loft' }, when: { act: [0] }, once: true,
    effects: [{ kind: 'grantFact', person: 'player', fact: 'loft_fact' }] });
});
console.log(formatProof(prove(story, { maxStates: 200000 })));
let s = initialState(story, 1);
while (s.clock < 1020) s = tick(story, s, 15, fixedRng([0])).state;
s = resolveTurn(story, s, { text: 'go', selection: { kind: 'intent', verb: 'move', exit: 'to_loft' } }).state;
console.log(s.location, s.clues);
```
```
explored 40460 states
  UNREACHABLE clue clue_loft
a player who idles 24 ticks on the jetty and walks over: location net_loft, clues ["clue_loft"]
```

Adding one unrelated `clock` Rule to act 0 (`atMinutes: 1025`) flips it to REACHABLE, with the path `wait until 1025 (tick_gulls) → move to_loft`, and the search hits the 200,000-state cap on the way. So the verdict depends on whether some other Rule happens to give the prover a "wait until", not on the Story's logic. A variant whose Clue depends on the delayed rumour (H5) is proven only because enough distinct verb-states accumulate the minutes to cross noon; nothing in the Story guarantees that.

The second half of this: "wait until 1025" is a single six-hour `tick`. A player waits in 15- or 30-minute steps, each a turn with its own proximity cascade and tick draw. The prover's path is therefore also optimistic (REACHABLE assuming nothing happens in between), though I could not build a realistic Story where that produces a wrong REACHABLE.

**Fix.** Give the prover a "wait until the next period boundary" action whenever the current period is not the last of the day, computed from `story.periods` with `minutesUntil`, and make `abstractKey` include the period (it already does) so the resulting state is new. That removes the dependence on `clock` Rules. Keep "wait until <clock Rule>" for the clock Rules themselves. About 15 lines in `actionsFrom`. Separately, state in `docs/act-authoring-process.md` that a "wait until" step in a walkthrough stands for repeated waits.

#### H2. The prover resolves Intents the endpoint would confine to `none`

`packages/engine/prover.ts:117-121` (deduction with `person: r.trigger.suspect`), `prover.ts:96-101` (`use a on b` where `b` may be a present person) versus `packages/ai/selection.ts:12-15` (`target`, `secondary` must be object ids in the set; `person` must be a present person) and `server/turn.ts:184`.

The prover's `intent()` calls `resolveTurn` directly. The endpoint runs `confineSelection` first, and the Candidate Set's `persons` holds only people present. So a `deduction` Rule naming a suspect who is not in the room is REACHABLE for the prover and impossible in play; the walkthrough it prints cannot be followed.

**Reproduced** on the unmodified stress fixture:

```ts
const line = prove(base).lines.find(l => l.goal.id === 'wrong_accusation')!;   // ['deduce maud']
let s = initialState(base, 1);
const set = candidates(base, s);
const sel = { kind: 'intent', verb: 'deduce', facts: [], person: 'maud' };
console.log(set.persons.map(p => p.id), inCandidateSet(sel, set));
```
```
prover path for ending wrong_accusation: [ 'deduce maud' ]
  step "deduce maud" at jetty: persons here = [orrin]; inCandidateSet → false
engine ended the game with: wrong_accusation — but the endpoint would have confined the deduce to none
```

The same gap in the other direction: a Rule `action: examine, target: [<person>]` is UNREACHABLE for the prover (it only examines objects) and, as H3 shows, also dead in play, so at least they agree. `use <object> on <person>` is generated by the prover and dead in play.

**Fix.** Run every prover action through `confineSelection(sel, candidates(story, s))` and skip it when the result is `none`; the prover then proves what the endpoint allows. One import and three lines in `actionsFrom`. Then decide the deduction question (see Design questions): either suspects must be present, or `deduce` may name any person and the confinement check is relaxed for `verb === 'deduce'`.

#### H3. `examine <person>` and `use <object> on <person>` are always rejected by the endpoint, although the prompt offers them

`packages/ai/selection.ts:12-13` requires `target` and `secondary` to be object ids. `packages/ai/prompts.ts:23` tells the model "examine <target>: study one object or person closely", and `packages/engine/verbs.ts:61-63,83-86` resolve both (`isHere(t)`, `isHere(sec)`). The model will return `{verb:'examine', target:'<person id>'}`; the endpoint replaces it with `none`; the player reads "there was nothing of the kind to hand" about someone standing in front of them. Every `action` Rule on examining or using something on a person is dead, and nothing tells the author.

**Reproduced:**

```ts
const s = initialState(story, 1); const set = candidates(story, s);
inCandidateSet({ kind: 'intent', verb: 'examine', target: 'orrin' }, set)                      // false
resolveTurn(story, s, { text: '', selection: { kind: 'intent', verb: 'examine', target: 'orrin' } }).events
// TurnReceived,IntentSelected,Examined,RuleFired,FactLearned,ClueDiscovered,ClockAdvanced  (engine alone resolves it)
inCandidateSet({ kind: 'intent', verb: 'use', target: 'tackle_chest', secondary: 'orrin' }, set) // false
```

**Fix.** In `inCandidateSet`, accept a present person id for `target` when the verb is `examine`, and for `secondary` when the verb is `use`. Teach the prover the same two actions. About 6 lines plus a `qa:core` case. Note that `buildNarrationContext` adds Object beats on `Examined` but nothing for a person (`projections.ts:35`); the person's `beats` are already in `personsPresent`, which is probably enough.

#### H4. The opening runs no Rules: `enter` on the opening location and `proximity` for whoever is there do not fire on turn 0

`server/turn.ts:157-160` appends only `InvestigationStarted`; `packages/engine/rules.ts:23-37` (`firingsFrom`) raises `enter` for `ActEntered` but nothing for `InvestigationStarted`; the prover starts from `initialState` the same way. The first `proximity` cascade runs at the start of turn 1, so a greeting fires one turn late and its Beat lands on whatever the player typed first. An `enter` Rule on the opening location fires only when the player comes back.

**Reproduced:**

```ts
r.rules.push({ id: 'jetty_welcome', trigger: { kind: 'enter', location: 'jetty' }, once: true, effects: [{ kind: 'setFlag', flag: 'welcomed' }] });
r.rules.push({ id: 'orrin_nods', trigger: { kind: 'proximity', person: 'orrin' }, when: { act: [0] }, once: true, effects: [{ kind: 'setFlag', flag: 'nodded' }] });
```
```
after InvestigationStarted: flags {} firedRules {}
turn 1 (look): proximity fires now -> true ; enter jetty fired? false
enter jetty fires only on RETURN -> true
```

This is inconsistent with later acts, where `ActEntered` raises `enter` on the anchor, and with the authoring doc's "Entering the act moves the player to the anchor, which counts as entering that location for `enter` Rules". An author porting Act 0 ("Mrs Hudson meets you in the hall") will write an `enter`/`proximity` Rule and see it fire on turn 1 or never.

**Fix.** Make the opening a turn: have `firingsFrom` raise `enter` for `InvestigationStarted` on `story.opening.location`, and have the server's start path run `cascade` over that firing plus `proximityFirings`, appending the result after `InvestigationStarted`. The prover must do the same from its start state. About 20 lines across `rules.ts`, `turn.ts`, `prover.ts`, plus re-authoring the `qa:turn` recordings (the opening context changes).

#### H5. Delayed `grantFact` ignores the time an act entry skips

`packages/engine/state.ts:161-165` (`ActEntered` sets `clock` but not `boundaries`), `state.ts:155-160` (`boundaries` grows only on `ClockAdvanced`), `rules.ts:127-128` (`maturesAtBoundary: s.boundaries + delayPeriods`).

A rumour told at 11:00 (morning) with `delayPeriods: 1` matures when the counter reaches one. If the act then ends and the next starts at 14:00 (afternoon), the clock has moved past the noon boundary but the counter has not, so the rumour matures at the *evening* boundary. The schema documents `delayPeriods` as "after N time-period boundaries" and the authoring doc as the rumour-hop mechanism; neither says act entries do not count. In the stress fixture this is already the observable behaviour.

**Reproduced** on the unmodified fixture:

```
rumor scheduled: { kind: 'GrantScheduled', person: 'maud', fact: 'cargo_was_barrels', maturesAtBoundary: 1 }
clock 685 morning boundaries 0
after act entry: act 1 clock 840 afternoon boundaries 0 pending [ { maud, cargo_was_barrels, maturesAtBoundary: 1 } ]
maud knows cargo_was_barrels? false
maud learned it after 12 more 15-minute ticks, at clock 1020 (evening)
```

For Whitechapel, where acts are days apart, every rumour that is told late in one act and expected to have spread by the next will instead arrive some hours into the next act, or never if that act is a single period.

**Fix.** Decide the semantics and make `ActEntered` honour it. The simplest: in `apply` for `ActEntered`, count boundaries from the old clock to the new act's start as if the clock had run forward (if the new start is earlier in the day, treat it as the next day), and mature pending grants there too; `advanceClock`'s maturation loop then needs a sibling for act entry, or maturation moves into the reducer path that `advanceClock` reads. About 20 lines plus a `qa:stress` assertion. Also make the prover's `abstractKey` include `boundaries` modulo the delay horizon, or the fix will not be visible to it.

#### H6. `knownBy: ['player']` passes the validator and does nothing

`packages/schema/validate.ts:63` (`needPerson` accepts `'player'`), `validate.ts:175` applies it to `knownBy`; `packages/engine/state.ts:75-80` builds `knows.player = {}` and only reads `knownBy` for persons.

An author who wants the narrator to start knowing something (the date of the first murder, Holmes's address) writes `knownBy: ['player']`, `qa:story` is green, and the Fact is not known: not in `knownFacts` for `deduce`, not a `tell` topic, no Clue.

**Reproduced:**

```
validator ok? true issues mentioning relief_date: []
player knows relief_date at start? false ; knownFacts offered for deduce: []
```

**Fix.** Either honour it (`knows.player` seeded from `knownBy.includes('player')`, with `ClueDiscovered` for any Clue it carries at start, which also needs H4's opening turn) or fail it in the validator. Five lines either way.

#### H7. A `proximity` Rule that advances the act moves the player before the typed verb resolves

`packages/engine/engine.ts:43-46`: the proximity cascade runs after `IntentSelected` and before `resolveVerb`. If it fires `advanceAct`, `ActEntered` relocates the player to the new anchor and resets every person to the new schedule; the verb then resolves against that world.

The plan names `proximity` for "timing and place" puzzles and `advanceAct` as an Effect; "meeting X begins the act" is a natural Rule. The player walks into the room (turn N), the sidebar shows X, they type "ask X about …" (turn N+1); the Selection is valid against that turn's Candidate Set; the Rule fires first; the player is now in the next act's anchor and the ask is rejected with "there is no one like that here", in the same narration as the act opening.

**Reproduced:**

```ts
r.rules.push({ id: 'meet_ines_starts_act2', trigger: { kind: 'proximity', person: 'ines' }, when: { act: [0] }, once: true,
  effects: [{ kind: 'advanceAct', act: 2 }] });
```
```
after the move: act 0 at kitchen present [ 'maud', 'ines' ]
ask ines about the barrels is a valid Selection against this set: intent
TurnReceived,IntentSelected,RuleFired,BeatQueued,RuleFired,ActEntered,IntentRejected
→ act 2 player at lamp_room present [ 'dov' ] ; verb outcome: {"kind":"IntentRejected","reason":"there is no one like that here"}
```

The same shape applies to any proximity Effect that changes what the verb needs: `dismissPerson`, `movePerson`, `hideObject`, `lockExit`.

**Fix.** Either run the proximity cascade at the *end* of the previous turn (after the verb, before the clock) so its Effects are visible in the Candidate Set the player selects from, or treat proximity like `enter`: raise it from `Moved`/`ActEntered` in `firingsFrom` for persons present at the destination, and drop the start-of-turn cascade. The second matches the authoring doc's "arrival" language and removes the one-turn lag. About 15 lines in `engine.ts`/`rules.ts` and the `qa:stress` proximity assertions. Document that a proximity Rule with `once: false` fires every turn the person is present.

#### H8. The invention gate's number check is void on any turn whose Events carry digits, and the player's own text is in the haystack

`packages/ai/gate.ts:39` adds `JSON.stringify(ctx.events)` to the haystack; `gate.ts:62-64` checks each digit run with `hay.includes(m[1])`, a substring test. A Tick's `draw` (`0.7312958…`) contains almost every one- and two-digit number; `ClockAdvanced.minutes` and `TickResolved.minutes` add more. `TurnReceived.text` and `FlavourRequested.subject` are also Events, so any name or number the player typed this turn is accepted in the prose.

**Reproduced:**

```
tick turn, draw 0.7312958
   prose: "The boatman says 29 barrels came in, at 12 past the hour."   inventions: []
same prose, no events
   prose: "The boatman says 29 barrels came in, at 12 past the hour."   inventions: ["29","12"]

player typed "ask about Mary Kelly and the 40 barrels"
   prose: "Orrin spits. \"Mary Kelly? Forty barrels she had off me, 40 at least.\""   inventions: ["Forty"]
same prose without the player text                                           inventions: ["Kelly","40","Forty"]
```

Effect on play: the fabricated-quantity class the gate was ported to catch ("no rain for nine days") passes on every idle Tick, and a player can launder any proper noun into the narration by typing it. The second is the smaller problem (the model is told not to add facts) but it is the mechanism by which "ask about Mary Kelly" becomes a narrator who treats Mary Kelly as real.

**Fix.** Build the haystack from the Events selectively: drop `TickResolved.draw`, `ClockAdvanced.minutes`, `TurnReceived.text`, `FlavourRequested.subject`, and keep the ids (which the regexes never match anyway). Match numbers as whole tokens (`\b29\b`) against a tokenised haystack rather than by substring. About 15 lines in `gate.ts` and two `qa:gate` cases.

#### H9. When the gate rejects twice on a turn with no Beats, the turn is closed with empty prose and the player gets silence

`server/turn.ts:259` (`prose: ctx.beats.join(' ')`), `turn.ts:215-217` (`beatsOnly`, same for stale and failed turns), `packages/engine/state.ts:168` and `view.ts:21` treat an empty `Narrated` as a quiet Tick. Most player turns have no Beats: `take`, `drop`, `open` without a Rule, `talk`, an `ask` that deflects, every `IntentRejected`. For those, the fallback is `''`, the feed shows the player's line with nothing under it, the Transcript records nothing, and the same happens when narration fails or the request dies.

**Reproduced** through `handleTurn` with the memory store and an AI that invents "Lestrade" on every attempt:

```
done.narrated: {"kind":"Narrated","text":"","beats":[]}
done.feed: [{"kind":"player","text":"take the key"}]        ← player line, no prose
on resume, the feed tail: [… {"kind":"player","text":"open the clock"}, {"kind":"prose","text":"…"}, {"kind":"player","text":"take the key"}]
```

The author cannot fix this with Beats, because the turns that have none are exactly the built-in verbs. Two gate rejections in a row is not rare with Gemini on a name-heavy story (see M7).

**Fix.** Give the fallback something to say: a per-Event minimal line built in `beatsOnly`/`narrateGated` from the turn's Events (`Taken` → "You take the <name>.", `IntentRejected` → the reason, `Spoke` → "<label> has nothing to add."), or at least a Story-level `fallbackBeat`. About 30 lines in `turn.ts`, plus a `qa:turn` case for a beat-less double rejection.

### Medium

#### M1. `leave` Rules evaluate `when` against the destination; cascade order is firing order, not Story order

`packages/engine/engine.ts:46-58`: the verb's Events (`Moved`) are applied before the cascade, so for `leave X` the State's `location` is already the destination and `personsPresent` is computed there. `rules.ts:150-163`: firings are processed in order (`action`, then `leave`, then `enter`), and Story order applies only within one firing. `docs/act-authoring-process.md` says "Every eligible Rule fires, in the order the Story lists them".

**Reproduced:**

```
RuleFired order: [ 'jetty_foghorn', 'leave_jetty_plain', 'enter_kitchen_first_in_story' ]   (enter Rule is first in the Story)
leave jetty + when.location [jetty] fired? false
leave jetty + when.personsPresent [orrin] fired? false       (orrin is on the jetty the player just left)
action move + when.location [jetty] fired? false
```

**Fix.** Either evaluate `leave` against the pre-move State (pass the State before the verb's Events into the cascade for `leave` firings) or document it and have the validator fail `leave X` with `when.location` not containing the destination. Fix the doc sentence about ordering either way. Engine change about 10 lines; the doc change is two sentences.

#### M2. A `clock` Rule at or before the act's start time fires a calendar day late

`packages/engine/time.ts:28-34` (`clockTimePassed` is exclusive of `from`), `state.ts:164` (`ActEntered` sets `clock = startClockMinutes` with no `ClockAdvanced`). A Rule "at 14:00 in act 1" where act 1 starts at 14:00 fires when the clock next passes 14:00, which is day 2.

**Reproduced:**

```
entered act 1 at clock 840 ; bell fired on entry? false
bell fired after 96 ticks at absolute clock 2280 = day 1, 14:00
```

Whitechapel acts will not last a day, so these Rules never fire. **Fix.** Validator: fail a `clock` Rule whose `atMinutes` is at or before `startClockMinutes` of every act it can fire in, with the message "use an `enter` Rule on the anchor". Ten lines in `validate.ts`.

#### M3. A person who arrives or leaves by schedule is invisible to the narrator

`packages/engine/state.ts:206-224`: schedule moves are derived, so there is no Event. `server/turn.ts:192-193` correctly refuses to call such a Tick quiet, but `buildNarrationContext` then hands the narrator Events that say nothing about anyone, and `personsPresent` without the person.

**Reproduced** (Orrin's act 0 schedule given `byPeriod: { afternoon: offstage }`, a Tick across noon):

```
11:45, present: [ 'orrin' ]
12:00, present: [] ; tick events: [ 'TickResolved', 'RuleFired', 'BeatQueued', 'ClockAdvanced' ]
what the narrator is given: events = [TickResolved, RuleFired, BeatQueued, ClockAdvanced] ; personsPresent = []
```

The sidebar changes, the prose does not mention it, or the model guesses. **Fix.** Emit a derived `PersonArrived`/`PersonLeft` note into `NarrationContext` (not the log) in `buildNarrationContext` by comparing `personsPresent` before and after the turn's Events, or add `PersonMoved` Events for schedule changes in `advanceClock` (which would also give `proximity` a hook). The first is about 10 lines and needs the before-State passed in; `turn.ts` has it.

#### M4. A client that disconnects mid-stream loses the turn's prose; a killed request locks the Investigation for two minutes

`server/turn.ts:85-117`: `controller.enqueue` throws once the consumer cancels; the throw lands in the catch, which appends a beats-only `Narrated` and the turn is closed with whatever `ctx.beats` held. `STALE_TURN_MS = 120_000` (`turn.ts:52`): if the function dies instead (Vercel `maxDuration`, a crash), the next request within two minutes gets 409 and the UI says "The last turn is still being written".

**Reproduced** (in-process, a narrator that streams one word per 5 ms, the reader cancelled after two deltas):

```
last row: Narrated | text === the Beats joined? true | text: "The housekeeper says the master would not have wanted strangers in the house, …"
the prose the narrator was producing is gone: true
```

The State is right and the next turn works (status 200). The player loses the narration of a turn they did not see finish, which on a phone with a dropped connection will be common. The two-minute lock-out is reasoning only: I cannot kill a Vercel function here. `vercel.json` sets no `maxDuration`; two Gemini calls plus one retry each (`gemini.ts:26,44`) can exceed the Hobby default.

**Fix.** Do not let the client's cancel abort narration: collect the narration without `send` throwing (wrap `send` to swallow after cancel, or detach the narration promise from the stream), append the real `Narrated`, and let the client fetch it on resume. For the lock-out, record a heartbeat (`investigations.updated_at` is already touched on append) and shorten `STALE_TURN_MS` to the real narration ceiling. About 20 lines in `turn.ts`.

#### M5. The `events` line sends the engine's internal Events to the browser, and the client keeps them

`server/turn.ts:91` sends `turn.events` verbatim; `hooks/useInvestigation.ts:70,102` stores them as `lastEvents`; `App.tsx:95,130` reads them for audio cues and the diary flash. `server/TURN.md` says the client never holds anything that would show it the solution.

**Reproduced** on the stress fixture:

```
events line for the ask: [TurnReceived, IntentSelected…, Spoke, FactDisclosed, ClueDiscovered, {"kind":"RuleFired","rule":"orrin_rumor_to_maud"}, {"kind":"GrantScheduled","person":"maud","fact":"cargo_was_barrels","maturesAtBoundary":1}, ClockAdvanced]
events line for the Tick that matured the rumor: [TickResolved {draw…}, RuleFired tick_gulls, BeatQueued…, ClockAdvanced, {"kind":"FactLearned","person":"maud","fact":"cargo_was_barrels"}]
```

Rule ids, flag names, hidden-Object reveals, who knows what, and `GrantScheduled` all read as a spoiler sheet in DevTools. For a Whitechapel story the ids will be `killer_is_…`. **Fix.** Replace the `events` line's payload with what the client uses: `cues: Id[]` and a `diary: boolean`, or a filtered projection (`CuePlayed`, `ClueDiscovered`, `Read`, `GameEnded`). About 15 lines across `turn.ts`, `turnClient.ts`, `useInvestigation.ts`, `App.tsx`.

#### M6. Objects inside a carried container are unreachable, and the validator is silent

`packages/engine/state.ts:249-264`: `visibleObjects` seeds only from Objects placed in the location, then adds contents of open containers that are themselves in that set. A carried container (a bag, a case) is never in the seed, so its contents are in no Candidate Set and no verb reaches them.

**Reproduced:**

```
validator ok? true []
candidate objects: tackle_chest(here) satchel(carried) — the letter is in none of them
read letter → TurnReceived,IntentSelected,IntentRejected
```

Watson's bag is a plausible Phase 6 Object. **Fix.** Seed `visibleObjects` with carried open containers too, or make the validator fail a container with `item: true`. Five lines either way.

#### M7. The gate rejects the time of day, ranks and nationalities, and misses several name shapes

`packages/ai/gate.ts:26-42,54-69`. The haystack has `clock.period` and `weather` but not the clock in words, so "eleven o'clock" is rejected unless some beat says it. "Inspector", "Constable", "Sergeant", "French", "Irish" are rejected mid-sentence unless the Story's `lexicon` or a beat holds them. Names at a sentence start, "McCarthy" (one lowercase letter before a capital), two-letter names and the second half of hyphenated names pass; spelled numbers from thirteen to nineteen, sixty to ninety and "a dozen" pass.

**Reproduced:**

```
"It was eleven o'clock, near enough, when the Inspector and two French sailors came along the jetty."  inventions: ["Inspector","French","eleven"]
"Lestrade stood by. The constable, McCarthy, nodded to Bo and pointed down Heath-road. …"             inventions: ["Heath"]
"Some fourteen barrels, perhaps sixty gallons, a dozen men and ninety yards of rope."                inventions: []
```

Effect on play: each false positive costs a second model call and, on a beat-less turn, the silence of H9; the time of day is something a Ripper story states often. **Fix.** Put the clock in words into the haystack (`clock.minutes` → "eleven", "quarter past"), add ranks and common nationalities to `GENERIC`, extend `SPELLED` to the teens, tens and "dozen", and match `[A-Z][a-zA-Z'-]{1,}`. About 20 lines and `qa:gate` cases.

#### M8. Validator gaps a Phase 6 author will plausibly hit

`packages/schema/validate.ts`, compared with plan §2.7:

- A person with schedule entries for some acts and not others (plan: "every person has a schedule entry for every act they appear in"): only an *empty* schedule warns (`validate.ts:142`). Mrs Hudson missing from act 3 vanishes silently.
- The spoiler scan (`validate.ts:296-311`) skips `Object.document`, `Ending.beats`, `Exit.lockedBeat`, `Location.closedBeat`, `Clue.summary` and `Fact.statement`s of other Facts. A document readable in act 1 can carry an act-3 term.
- `action` triggers with fields the verb never carries (`verb: ['move']` with `target`; `verb: ['examine']` with `person`) can never match (`rules.ts:43-49`) and pass.
- `Introduction.document` naming an Object with no `document` text; `read` still works on it (`verbs.ts:64-68`), so the introduction happens on reading a non-document.
- A `clock` Rule at or before its act's start (M2), a `leave` Rule whose `when.location` excludes the destination (M1), `knownBy: ['player']` (H6), a carried container (M6).
- `minActOfRule` (`validate.ts:198-202`) treats a `flag`-triggered Rule as firable in the first act unless it has `when.act`, so every rumour Rule that grants a later Fact must carry a redundant `when.act` to pass. Conservative, but it will be the first thing every author trips on; the message should say so.

Reasoning only; each is a mechanical check of 3 to 10 lines.

#### M9. A client can append arbitrary rows to its own log, and the server does not validate what it loads

`supabase/migrations/009_event_log.sql:81-90`: the insert policy checks ownership only. `server/investigationStore.ts:88` pushes `r.payload` without `EventPayload.parse`. With their own JWT and the anon key, a client can insert `{kind:'GameEnded'}`, `{kind:'FactLearned', person:'player', fact:'…'}` or `{kind:'Nonsense'}` at the next `seq`; `apply` has no default branch, so an unknown kind makes `replay` return `undefined` and every later request 500s for that Investigation. Other owners' logs are unreachable (both policies require `investigations.owner_id = auth.uid()`; `investigations` is "owner can all"). For a solo project this is cheating at one's own game; the bricking is the part worth a guard.

Reasoning only (no Supabase here). **Fix.** `EventPayload.parse` each row in `load` and answer a clear 500 naming the seq; optionally a `CHECK (payload ? 'kind')` in a later migration. Three lines.

### Low

#### L1. A Tick-triggered `advanceAct` lands the new act at `startClockMinutes + TICK_MINUTES`

`packages/engine/engine.ts:74-84`: `tickInto` calls `advanceClock` unconditionally; the player-turn path (`engine.ts:60`) skips it when `ActEntered` occurred. Reproduced: `entered act 1 clock 855 (act 1 startClockMinutes is 840)` via a tick Rule, `840` via a verb. Three lines.

#### L2. A `start` whose first append fails leaves an Investigation with no `InvestigationStarted`

`server/turn.ts:155-159`: the row is created, then the Event appended. If the append fails, later turns replay an empty log (`initialState` with seed 0), the opening beats are never narrated and `feedOf` never emits the act heading. Reasoning only; wrap the two in one path or delete the row on failure.

#### L3. The prover swallows engine exceptions

`packages/engine/prover.ts:54`: `try { next = a.run(s) } catch { continue; }`. A Story that makes the engine throw (an Effect naming an id the validator did not catch) is reported UNREACHABLE with no reason. Log the first exception per label.

#### L4. The 409 message is reused for the lost seq race

`server/turn.ts:146`: after three `SeqConflict`s the player reads "another turn is still being narrated", which is not what happened. Cosmetic.

## Design questions

1. **`visibleFromAct` gates what people *say*, not what the player can *learn*.** `verbs.ts:64-68` grants a document's Fact on `read` regardless of act, and the `tell` direction (`candidates.ts:25`) ignores it. The stress fixture relies on this (the oil cask's Fact is `visibleFromAct: 2` and read in act 1; the prover's path to `clue_oil` is 10 moves in act 1). `packages/schema/README.md` says "A Fact's `visibleFromAct` is its spoiler gate. A Rule that can fire earlier and grants it fails validation", which overstates it. I would rename the field's intent in the README and GLOSSARY to "earliest act a person will speak of it", and add a separate validator check that a document Object carrying a later-act Fact is `hidden` or placed in a location unreachable before that act. Otherwise an author will trust the README and leak via a letter.

2. **Must a suspect be present to be accused?** The Candidate Set's `persons` are those present, so `deduce` can only name someone in the room (H2). For a mystery that is a real constraint: the accusation scene must bring the suspect on stage, or the ending Rule must be Fact-only. I would add `suspects: Named[]` to the Candidate Set (every person the player has met, by current label) and let `deduce.person` range over it; the prover then proves the same thing the endpoint allows.

3. **The Transcript is every narration while present, not an exchange.** `state.ts:167-174` appends the whole prose of every turn to every present person's transcript, and the player's line only on `Spoke`. Dov, who follows the player, accumulates room descriptions; with a 12-line window, actual dialogue falls out within a few turns of standing in the same room. The GLOSSARY defines the Transcript as "the verbatim recent exchanges between the player and one person". I would append the `Narrated` text only to persons who `Spoke` this turn, or were the `to`/`from` of a `FactDisclosed`.

4. **The prover's "wait until" is one long Tick** (H1, second half). It also means tick-Rule branches are "reachable with the right draw"; a Story where a `tick` Rule with `once: false` can end the game (a plausible "the killer strikes again" clock) is REACHABLE on the branch where it never fires. Worth a sentence in the authoring doc; a `--pessimistic` prover mode that forbids a path from depending on a tick draw would be the fix if it bites.

5. **The `action` firing sees the post-verb State.** `when.location` on `action: move` means the destination, `hasItems: [x]` on `action: take x` is already true. Consistent, and probably right, but it is the opposite of what `leave` makes an author expect (M1). One sentence in "How the engine runs them".

6. **One narration per Tick Rule with `once: false`.** `tick_gulls`-style ambience fires on every idle Tick where it is eligible, and a `BeatQueued` makes the Tick non-quiet, so an idle player in such a room costs one Gemini call every two minutes (`IDLE_TICK_MS`), three times. The plan's "Ticks that resolve to nothing cost nothing" holds only for rooms with no ambient Rule. Either weight in a "nothing" outcome (a reserved `quiet` weight on the Story) or let the server skip narration for Ticks whose only Event of substance is a `BeatQueued` from a Rule marked `ambient: true`.

7. **Cost over time** (brief point 10). Measured on the stress fixture with random legal play and 40-word prose per turn:

| turns | log rows | JSON size | `replay` | `feedOf` | `playerView` | CPU per request (≈2 replays, 2 feeds, 1 view) | PostgREST pages |
|---|---|---|---|---|---|---|---|
| 100 | 662 | 57 KB | 1 ms | 2 ms | 5 ms | 13 ms | 1 |
| 400 | 2,705 | 233 KB | 3 ms | 6 ms | 6 ms | 25 ms | 3 |
| 900 | 6,112 | 530 KB | 4 ms | 11 ms | 8 ms | 39 ms | 7 |
| 1,500 | 10,091 | 876 KB | 4 ms | 8 ms | 8 ms | 32 ms | 11 |

The fold is not the cost; the Whitechapel State will be larger but not by an order of magnitude. The cost is `supabaseStore.load` (`investigationStore.ts:80-91`): one PostgREST round trip per 1,000 rows, so a six-act game of 900 turns loads 7 pages and roughly 1.5 MB (real prose is 90 to 160 words, three times my 40) on every turn and every idle Tick. At 80 to 150 ms per page from Vercel that is 0.5 to 1 s before the selection call starts, against a budget of 700 ms for selection itself. It stops being acceptable around act 3 or 4, not act 6. Cheapest fix: a Postgres function that returns the whole log in one call (or raise the PostgREST max rows for this project), and stop fetching `Narrated` text for requests that do not need it (every player turn needs it only for the Transcript window). The snapshot cache in plan §2.5 is not needed yet.

8. **`STALE_TURN_MS` versus the function's lifetime** (M4). Two minutes is longer than any narration should take and shorter than the worst case with retries. Tie it to a heartbeat rather than a constant.

## What I checked and found sound

- **Determinism and replay.** `Emitter.emit` and `cascade`/`fireRule` apply every Event through `apply`, so the State a turn returns equals `replay(prior + events)`; `feedOf` and `playerView` fold with the same reducer; `number()` folds again to stamp turn numbers. The only randomness is the Tick draw, recorded in `TickResolved` and never re-drawn on replay; `turnRng` derives from `(seed, turn)` so a live turn and a QA turn agree. `ActEntered` resets the clock deterministically and `boundariesCrossed` runs from the new clock. `ObservationRecorded` dedupes by key. A quiet Tick's empty `Narrated` is skipped by the Transcript and the feed. I found no code path that reads `Date.now()` or an unrecorded random into the log.
- **Rule cascade.** Eligibility is evaluated against the State as it changes within a depth, so `flagsNone` exclusions between two Rules on one firing work; `once` is enforced via `RuleFired` applied before Effects, so a Rule cannot re-fire itself; `setFlag` on a set flag raises no `flag` firing (documented "becomes true"); `grantFact` to someone who knows is a no-op; `advanceAct` to the current act and `endGame` after an ending are no-ops; the cascade stops on `GameEnded`. `combine` matches regardless of order. `deduction` matches a superset of the named Facts.
- **Candidate Set and confinement.** Hidden Objects, Objects in closed containers, Facts a person cannot yet tell, people not present and exits of other locations are never in the set; `inCandidateSet` checks every id field including `topic` against the named person and `facts` against `knownFacts`; the verbs re-check reach and presence, so even an unconfined Selection cannot act on a hidden Object or a locked exit. The fast path resolves only `look`/`inventory`/`wait` and exit names authored in the Story, and defers to the model when a bare word is also an Object or person name.
- **Disclosure Ledger and Transcript.** The Ledger is written only from `FactDisclosed`, monotonic, deduplicated, split correctly into `told`/`heard`; `knows` is updated for the receiver only; the engine never emits a person-to-person `FactDisclosed`, so the Ledger cannot be polluted by rumours. A repeated `ask` re-emits `FactDisclosed` but the Ledger already holds it and the prompt forbids re-revealing. The diary's persons and `told` lines derive from the same Ledger.
- **Turn endpoint.** The seq series is consecutive from 0; a lost race is a `SeqConflict` → reload → 409 if the other turn is open; the stale closer is itself raced safely through the primary key; a resume appends nothing and reports `busy`; a quiet Tick appends an empty `Narrated` and no narration call; `mode` and `quiet` are derived from the Events only; the `done` feed is exactly `feedOf(log) − feedOf(prior)`; one turn at a time holds under the `qa:turn` races and the ones I added.
- **Storage and auth.** `events` is select/insert only for the owner, no update or delete; `investigations` is owner-only; `api/turn.ts` builds the client from the caller's JWT and the anon key, with no service role; anonymous users are ordinary `auth.uid()`s and claiming via `updateUser` keeps the id. Migration 010 is idempotent, drops nothing the app reads (no `.from('saves'|'clues'|'logs'|…)` remains outside `supabase/`, the `handle_new_user` trigger touches only `profiles`), keeps `status`, which `supabaseStore.create` still writes, and the app does not depend on it (`InvestigationRepository.list` already filters `story_id is null`). Safe to apply.
- **Client protocol.** One request in flight; `done.feed` appended, `resume` replaces; an `error` line triggers a resync via resume; 409 on a Tick is dropped silently and on a player turn shown; idle Ticks stop after three and after an ending.
- **Prover, where it holds.** Sound on the fixture's own goals; branches every eligible tick Rule by a draw that selects it; includes `once` Rules and pending grants in the abstract key; reports the cap.

## Reproduction scripts

Throwaway scripts, run with `npx tsx` from the repo root against the stress and toy fixtures with the memory store and a scripted `Ai`; not committed. The essential part of each is quoted in its finding. Files: `repro-engine.ts` (H4, H5, H6, M1, M6, L1), `repro-engine2.ts` (H7, M2), `repro-prover.ts` and `repro-prover2.ts` (H1, H2, H3), `repro-gate.ts` (H8, M7), `repro-turn.ts` and `repro-turn2.ts` (H9, M4, M5), `repro-schedule.ts` (M3), `repro-cost.ts` (design question 7).
