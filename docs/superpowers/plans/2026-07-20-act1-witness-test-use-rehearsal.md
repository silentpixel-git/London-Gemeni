# Act 1 Witness-Test Chain + Act 4 USE Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the USE X WITH Y verb before the Act 5 convergence via a gating Act 1 witness-test chain (Hutchinson) and an optional Act 4 refresher, plus three small engine changes that support them.

**Architecture:** Deterministic engine resolves everything; AI only narrates (see CLAUDE.md — never blur this). All puzzle content is story-manifest data in `engine/stories/whitechapel-1888/`; the three engine changes (`USE`-order symmetry, flag-gated takeables, flag-gated SHOW) are story-agnostic capabilities configured by manifest data. Spec: `docs/superpowers/specs/2026-07-20-act1-witness-test-use-rehearsal-design.md`.

**Tech Stack:** TypeScript (strict), no unit-test framework — correctness = `npm run lint` (tsc --noEmit) + scripted QA harnesses (`npx tsx scripts/qa-*.ts`, exit 1 on FAIL). The qa-engine script IS the regression test: tasks that change engine behavior land their scripted-intent steps in the same task (repo convention; strict test-first isn't possible until story data exists, so engine tasks verify by lint and are exercised by the Task 7 harness steps).

**Conventions:** Commit with `--no-gpg-sign` (pinentry has no TTY in this shell). All prose in Watson's register — period-correct, no system voice. Never leak Edmund's guilt before Act 5/6 content gates.

---

### Task 1: USE-order symmetry + canonical flag key (engine fix)

The possession check in `resolveUse` requires the *first-named* object to be an inventory takeable, so "USE archway WITH account" fails while "USE account WITH archway" works. Worse, the success flag is built from raw intent order (`used_${targetId}_with_${intent.useWithTargetId}`), so a player who types the Act 5 convergence as "USE letter WITH note" gets the clue but sets `used_from_hell_letter_with_edmund_forensic_note` — and the Act 5 hint ladder (`a5_convergence.done`, `a5_deduce.available` both check `used_edmund_forensic_note_with_from_hell_letter`) silently breaks. Fix both: symmetric accessibility, and the flag always keyed in the **authored** orientation.

**Files:**
- Modify: `engine/resolvers/items.ts:80-148` (the `USE X WITH Y` branch of `resolveUse`)

- [ ] **Step 1: Rewrite the combination branch with symmetric access + canonical flag**

Replace the body of the `if (intent.useWithTargetId && targetId)` block. The lookup already tries both orders; capture which orientation is authored and use it for the flag. Replace the `hasItem`/`item2InLocation`/`item2InInventory` block and the `flagKey` line so the full branch reads:

```ts
  // ── USE X WITH Y (Infocom-style combination) ──────────────────────────────
  if (intent.useWithTargetId && targetId) {
    // The authored orientation decides the flag key, whichever way the player
    // phrased it — "use letter with note" must set the same flag as
    // "use note with letter", or flag-gated content downstream never sees it.
    const forward = story.useCombinations[targetId]?.[intent.useWithTargetId];
    const reverse = story.useCombinations[intent.useWithTargetId]?.[targetId];
    const combination = forward ?? reverse;
    const [authoredA, authoredB] = forward
      ? [targetId, intent.useWithTargetId]
      : [intent.useWithTargetId, targetId];

    if (combination) {
      // Act-locked combinations (spoiler gate — e.g. the kidney cross-reference
      // grants asylum-reveal content and must not fire before Act 6).
      if (combination.requiresAct !== undefined && session.currentAct < combination.requiresAct) {
        return blocked(story, intent, session,
          `Watson sets the two side by side, but the connection between them refuses to form. Something is still missing — the comparison is premature.`,
          `USE combination blocked: ${targetId} + ${intent.useWithTargetId} requires act ${combination.requiresAct} (currently act ${session.currentAct}). Narrate Watson sensing the documents are related but lacking the context to see how. Do NOT reveal what the connection is.`
        );
      }

      // Location-locked combinations (e.g. the document convergence that must
      // happen at Baker Street, against the casefiles).
      if (combination.requiresLocation && session.location !== combination.requiresLocation) {
        const placeName = story.locations[combination.requiresLocation]?.name ?? 'elsewhere';
        return blocked(story, intent, session,
          `Watson holds the two side by side, but this is not the place for careful comparison. Better done at ${placeName}, with room to think.`,
          `USE combination blocked: ${targetId} + ${intent.useWithTargetId} requires location '${combination.requiresLocation}' (currently '${session.location}'). Narrate Watson deciding to make the comparison properly at ${placeName}.`
        );
      }

      // Symmetric accessibility: each side may be in inventory (via its
      // takeable mapping) or present in the room; at least one side must be
      // a held item (Watson brings something TO something).
      const inInventory = (id: string) =>
        story.takeableObjects[id] !== undefined && session.inventory.includes(story.takeableObjects[id]);
      const inLocation = (id: string) => currentLoc.interactables.includes(id);
      const accessible = (id: string) => inInventory(id) || inLocation(id);

      if (accessible(targetId) && accessible(intent.useWithTargetId)
          && (inInventory(targetId) || inInventory(intent.useWithTargetId))) {
        const { newClueIds, newClueDefs } = combination.clueId
          && !session.discoveredClueIds.includes(combination.clueId)
          ? { newClueIds: [combination.clueId], newClueDefs: [{ name: story.clueDefinitions[combination.clueId]?.name ?? combination.clueId, description: story.clueDefinitions[combination.clueId]?.description ?? '', holmesDeduction: story.clueDefinitions[combination.clueId]?.holmesDeduction ?? '' }] }
          : { newClueIds: [], newClueDefs: [] };

        const flagKey = `used_${authoredA}_with_${authoredB}`;
        const allFlags = { ...session.flags, [flagKey]: true };
        const actCheck = checkActProgression(story, session, allFlags);

        return {
          actionSuccess: true,
          actionType: 'use',
          flagsUpdate: { [flagKey]: true, ...(actCheck.flagsUpdate || {}) },
          newAct: actCheck.newAct,
          discoveredClueIds: newClueIds,
          aiContext: buildNarrationContext(story, intent, session, {
            success: true,
            actionDescription: `Watson used ${story.objectDisplayNames[targetId] ?? targetId} with ${story.objectDisplayNames[intent.useWithTargetId] ?? intent.useWithTargetId}.`,
            actionResultNote: combination.resultNote,
            newClueDefs,
          }),
        };
      }

      // Items not accessible
      return blocked(story, intent, session,
        `Watson cannot combine those items here — one or both are not at hand.`,
        `USE combination blocked: ${targetId} + ${intent.useWithTargetId} — item(s) not in inventory or location.`
      );
    }

    // No authored combination
    return blocked(story, intent, session,
      `Watson considers it, but there is nothing useful to be learned from combining those two things.`,
      `No USE combination defined for ${targetId} + ${intent.useWithTargetId}.`
    );
  }
```

- [ ] **Step 2: Verify types**

Run: `npm run lint`
Expected: clean exit (no output, exit 0)

- [ ] **Step 3: Verify no behavioral regression on the existing harness**

Run: `npx tsx scripts/qa-engine.ts`
Expected: PASS (the existing Act 5 step `use forensic note with from hell letter` still sets `used_edmund_forensic_note_with_from_hell_letter`). Reversed-order coverage is added in Task 7.

- [ ] **Step 4: Commit**

```bash
git add engine/resolvers/items.ts
git commit --no-gpg-sign -m "fix(engine): USE X WITH Y works in either phrasing order, flag keyed to authored orientation"
```

---

### Task 2: Flag-gated takeables (engine capability)

**Files:**
- Modify: `engine/stories/types.ts` (StoryManifest, near `takeableObjects` at ~line 313)
- Modify: `engine/resolvers/items.ts` (`resolveTake`, after the interactables check at ~line 25)
- Modify: `engine/stories/whitechapel-1888/manifest.ts` (wire the new field)

- [ ] **Step 1: Add the manifest field**

In `engine/stories/types.ts`, directly under the `takeableObjects` line in `StoryManifest`:

```ts
  takeableObjects: Record<string, string>;
  /** Optional gate: object may only be taken once this flag is set (e.g. a
   *  witness's account that cannot be noted down before he has given it).
   *  Blocked takes go through the standard blocked() path in narrator voice. */
  takeableRequiresFlag: Record<string, string>;
```

- [ ] **Step 2: Enforce it in resolveTake**

In `engine/resolvers/items.ts`, inside `resolveTake`, after the `!currentLoc.interactables.includes(targetId)` block and **before** the `story.takeableObjects[targetId]` lookup:

```ts
  // Flag-gated takeable: the object exists here but is not yet Watson's to take.
  const gateFlag = story.takeableRequiresFlag[targetId];
  if (gateFlag && session.flags[gateFlag] !== true) {
    return blocked(story,
      intent,
      session,
      `Watson considers the ${objectName}, but there is nothing yet for him to set down — something must come first.`,
      `TAKE blocked: "${targetId}" is gated on flag "${gateFlag}" which is not yet set. Narrate Watson recognising the moment is premature, without naming any game mechanism.`
    );
  }
```

- [ ] **Step 3: Wire the (initially empty) table in the manifest**

In `engine/stories/whitechapel-1888/manifest.ts`, next to `takeableObjects: TAKEABLE_OBJECTS,`:

```ts
  takeableRequiresFlag: TAKEABLE_REQUIRES_FLAG,
```

and add `TAKEABLE_REQUIRES_FLAG` to the existing import from `./clues`. In `engine/stories/whitechapel-1888/clues.ts`, directly under `TAKEABLE_OBJECTS` (~line 465):

```ts
// ─────────────────────────────────────────────────────────────────────────────
// TAKEABLE GATES — object may only be taken once this flag is set.
// hutchinson_account: Watson cannot note down an account he has not heard.
// ─────────────────────────────────────────────────────────────────────────────
export const TAKEABLE_REQUIRES_FLAG: Record<string, StoryFlag> = {
  hutchinson_account: 'talked_to_hutchinson_at_dorset_street',
};
```

(`clues.ts` already imports `StoryFlag`? If not: `import type { StoryFlag } from './flags';` — check the file head and add if missing. The `hutchinson_account` ObjectId does not exist until Task 4; **tsc will fail until then**, so Steps 3–5 of this task are completed in sequence with Task 4 if you prefer strict per-task green — acceptable alternative: land this table empty (`{}`) here and fill it in Task 4. Choose the empty-table option to keep every commit green.)

- [ ] **Step 4: Verify types**

Run: `npm run lint`
Expected: clean (with the empty-table option).

- [ ] **Step 5: Commit**

```bash
git add engine/stories/types.ts engine/resolvers/items.ts engine/stories/whitechapel-1888/clues.ts engine/stories/whitechapel-1888/manifest.ts
git commit --no-gpg-sign -m "feat(engine): flag-gated takeable objects (takeableRequiresFlag)"
```

---

### Task 3: Flag-gated SHOW interactions (engine capability)

**Files:**
- Modify: `engine/stories/types.ts:198-201` (`ShowInteraction`)
- Modify: `engine/resolvers/npc.ts:91-113` (`resolveShow`, authored-interaction branch)

- [ ] **Step 1: Extend ShowInteraction**

```ts
export interface ShowInteraction {
  clueId?: string;       // Clue unlocked by this show action (optional)
  resultNote: string;    // Passed to AI as actionResultNote
  /** Optional gate: the interaction only fires once ALL these flags are set.
   *  Unmet → blocked with blockedNote (authored, narrator voice). */
  requireFlags?: string[];
  blockedNote?: string;
}
```

- [ ] **Step 2: Enforce in resolveShow**

In `engine/resolvers/npc.ts`, inside the `if (interaction)` block, **before** the clue computation:

```ts
    if (interaction) {
      const unmet = (interaction.requireFlags ?? []).filter(f => session.flags[f] !== true);
      if (unmet.length > 0) {
        return blocked(story, intent, session,
          interaction.blockedNote ?? `Watson holds the ${inventoryName} half-out of his pocket, then thinks better of it — not yet.`,
          `SHOW gated: ${targetId} → ${npcId} requires flags [${unmet.join(', ')}]. Narrate Watson deciding the moment is premature, without revealing what is missing.`
        );
      }
```

- [ ] **Step 3: Verify types**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add engine/stories/types.ts engine/resolvers/npc.ts
git commit --no-gpg-sign -m "feat(engine): flag-gated SHOW interactions (requireFlags on ShowInteraction)"
```

---

### Task 4: Act 1 story data — the witness-test chain

**Files:**
- Modify: `engine/stories/whitechapel-1888/locations.ts` (dorset_street interactables ~line 34; `OBJECT_DISPLAY_NAMES_DATA` ~line 338)
- Modify: `engine/stories/whitechapel-1888/clues.ts` (clue definition; `CLUE_TRIGGERS.dorset_street`; `ATMOSPHERIC_NOTES.dorset_street`; `TAKEABLE_OBJECTS`; `TAKEABLE_REQUIRES_FLAG`; `ITEM_SPENT_AFTER_ACT`; `USE_COMBINATIONS`; `SHOW_INTERACTIONS`)
- Modify: `engine/stories/whitechapel-1888/acts.ts:126-134` (Act 1 gate)
- Modify: `engine/intentParser.ts:318-375` (object aliases)

- [ ] **Step 1: New objects on Dorset Street**

`locations.ts`, dorset_street `interactables`:

```ts
    interactables: ['police_barricade', 'street_lamps', 'lodging_house_entrances', 'crowd', 'court_archway', 'hutchinson_account'],
```

`OBJECT_DISPLAY_NAMES_DATA`, in the `// Dorset Street` block:

```ts
  court_archway: "Miller's Court Archway",
  hutchinson_account: "Hutchinson's Account",
```

- [ ] **Step 2: Atmospheric notes + empty clue triggers for the new objects**

`clues.ts` — `ATMOSPHERIC_NOTES.dorset_street`, add:

```ts
    court_archway: "The covered passage into Miller's Court is barely three feet wide — a brick throat between two lodging houses, unlit along its length. The nearest lamp stands across the street, its glow arriving as a rumour. Watson stands where a watcher would have stood, opposite, and studies what the light actually reaches: outlines, movement, the pale smudge of a face. No more.",
    hutchinson_account: "Watson's note of Hutchinson's statement, taken down at the man's own eager dictation — the astrakhan trim, the gold chain, the tie-pin, the parcel in the left hand. Read back in daylight, the detail is remarkable. That is precisely what troubles him.",
```

`CLUE_TRIGGERS.dorset_street`, add (no clues fire on plain examine):

```ts
    court_archway: [],
    hutchinson_account: [],
```

- [ ] **Step 3: Takeable + gate + spent-after-act**

`clues.ts`:

```ts
// in TAKEABLE_OBJECTS:
  hutchinson_account: "Hutchinson's Account (Watson's note)",

// TAKEABLE_REQUIRES_FLAG (created empty in Task 2, now filled):
export const TAKEABLE_REQUIRES_FLAG: Record<string, StoryFlag> = {
  hutchinson_account: 'talked_to_hutchinson_at_dorset_street',
};

// in ITEM_SPENT_AFTER_ACT (the account is Act 1 business only):
  "Hutchinson's Account (Watson's note)": 1,
```

- [ ] **Step 4: The clue**

`clues.ts`, after `clue_10_asylum_commitment` in `CLUE_DEFINITIONS_DATA`:

```ts
  // GROUP 11 — The Witness Tested (Act 1 chain: Hutchinson's account laid
  // against the archway and the light. The Stranger begins to dissolve.)
  clue_11_account_outruns_light: {
    id: 'clue_11_account_outruns_light',
    name: 'The Account Outruns the Light',
    diaryNote: "I stood where Hutchinson stood and read his statement against the ground itself. The lamp is across the street; the passage is black as a coal cellar; the rain that night would have doused what little glow there was. Spats, a tie-pin, the trim of a coat — no honest glance could have carried so much away. The account is not a lie entire. But it has been dressed.",
    description: "Watson reads Hutchinson's statement where the man claims to have stood. The gas lamp is across the street; the archway is unlit; the night of the murder was wet. At that distance, in that light, a passing glance yields outline and gait — not spats, not a tie-pin, not a parcel in the left hand. The description has been embroidered after the fact. What remains true is simpler and stranger: a man stood here for three-quarters of an hour, watching.",
    holmesDeduction: "A witness who saw too much, Watson, has usually seen too little and furnished the rest. Strike the astrakhan man's wardrobe and what is left? A figure. Ordinary. Which is to say: our man, if he was here at all, looked like no one — again.",
    locationFound: 'dorset_street',
    // Synthetic label, NOT a physical interactable: granted only via the
    // USE combination (account + archway) — same pattern as document_convergence.
    triggerObject: 'witness_test',
    connections: ['clue_04b_adjustable_appearance'],
    clueGroup: 11,
    medicalPoints: 5,
    moralPoints: 5,
  },
```

Also add the reciprocal connection: in `clue_04b_adjustable_appearance`, append `'clue_11_account_outruns_light'` to its `connections` array (qa:validate checks dangling/one-way connections — mirror whichever convention it enforces; if one-way is accepted, still add it for graph quality).

- [ ] **Step 5: The USE combination (step 3 of the chain)**

`clues.ts`, in `USE_COMBINATIONS`:

```ts
  // USE hutchinson's account WITH the court archway (Act 1 witness test).
  // The USE X WITH Y rehearsal — teaches the convergence's verb at low stakes.
  'hutchinson_account': {
    'court_archway': {
      clueId: 'clue_11_account_outruns_light',
      requiresLocation: 'dorset_street',
      resultNote: "SUCCESS — Watson stands opposite the archway, note in hand, and reads the statement against the scene. The lamp across the street; the unlit passage; the remembered rain. One by one the account's fine details fail the light. What survives is the man himself: three-quarters of an hour, watching a doorway in the wet. The description was dressed. The waiting was real.",
    },
  },
```

- [ ] **Step 6: The gated SHOW (step 4 of the chain)**

`clues.ts`, in `SHOW_INTERACTIONS`:

```ts
  // SHOW the account TO hutchinson — only once the sightline test has armed it.
  // His clearing beat (red-herring rule): he breaks into loneliness, not guilt.
  'hutchinson_account': {
    'hutchinson': {
      requireFlags: ['used_hutchinson_account_with_court_archway'],
      blockedNote: "Watson's hand goes to the note in his pocket, and stops. He has only the man's own words, unweighed — read them back now and Hutchinson need only repeat them. Better first to try the account against the ground it claims to describe.",
      resultNote: "SUCCESS — Watson reads the statement back to him, slowly, and then asks — gently, as one asks a patient — how the lamp across the street showed him a tie-pin. Hutchinson's eagerness collapses by degrees. He did see a man, he says. Well-dressed — he thinks. The rest he... filled in, after, so they would take him seriously at the station. But he stood there the three-quarters of an hour, that part is gospel — he knew Mary three years, she'd have let him sleep on the floor, night like that. He looks at the archway rather than at Watson. 'I keep thinking, if I'd only stopped where I was till morning.' He has nothing else. He is not the man. He is only the last of her friends.",
    },
  },
```

The chain flag `showed_hutchinson_account_to_hutchinson` is set automatically by `resolveShow`; it is a valid `ShowedFlag` because `hutchinson_account` is now an `ObjectId`.

- [ ] **Step 7: Repoint the Act 1 gate**

`acts.ts`, Act 1 entry — replace the Hutchinson flag and update the comment:

```ts
  // Act 1 — "The Stranger". The fresh Kelly scene. Hutchinson's account is a
  // three-beat witness test (talk → USE account WITH archway → SHOW it back):
  // everyone meets the theory, tests it, and clears the man on-screen. The
  // act CLOSES on Bond's aftermath beat — a character exhale, not a cold examine.
  1: {
    name: 'The Last Murder',
    requireFlags: [
      'showed_hutchinson_account_to_hutchinson', // the witness tested + cleared (implies the talk/take/use chain)
      'examined_millers_court_burned_clothing',  // the grate — the killer's use of light
      'examined_millers_court_the_bed',          // the central horror (arms Bond's aftermath beat)
      'talked_to_bond_at_millers_court',         // the emotional capstone — the surgeon's burden
    ],
    advanceTo: 2,
  },
```

- [ ] **Step 8: Parser aliases**

`engine/intentParser.ts`, in `objectAliases` (longest-alias-wins is already implemented, so the multiword entries below safely coexist with the existing short ones):

```ts
    'archway': 'court_archway',
    'court entrance': 'court_archway',
    'passage': 'court_archway',
    'account': 'hutchinson_account',
    'statement': 'hutchinson_account',
    "hutchinson's account": 'hutchinson_account',
    "hutchinson's statement": 'hutchinson_account',
    'witness statement': 'hutchinson_account',
```

- [ ] **Step 9: Verify types + data integrity**

Run: `npm run lint && npx tsx scripts/qa-validate.ts`
Expected: lint clean; qa-validate PASS (clue_11 reachable via use; triggers resolve; gate flag settable). **qa-engine will FAIL at this point** (its Act 1 script still expects the old gate) — that is the Task 7 red state, expected.

- [ ] **Step 10: Commit**

```bash
git add engine/stories/whitechapel-1888/locations.ts engine/stories/whitechapel-1888/clues.ts engine/stories/whitechapel-1888/acts.ts engine/intentParser.ts
git commit --no-gpg-sign -m "feat(story): Act 1 witness-test chain — talk, take, USE-with-archway, gated SHOW; gate repointed"
```

---

### Task 5: Act 4 refresher — USE kidney notes WITH the letter

**Files:**
- Modify: `engine/stories/whitechapel-1888/clues.ts` (clue definition; `USE_COMBINATIONS.kidney_parcel`)

- [ ] **Step 1: The clue**

After `clue_11_account_outruns_light`:

```ts
  // GROUP 12 — The Letter Knows Too Much (Act 4 refresher: the USE verb again,
  // one act before the convergence. Spoiler containment: establishes only that
  // the writer HANDLED the kidney — never the preservation-method-matches-Bond's-
  // lab thread (that is the SHOW-to-Bond beat), never Edmund, never the asylum.)
  clue_12_letter_knows_too_much: {
    id: 'clue_12_letter_knows_too_much',
    name: 'The Letter Knows Too Much',
    diaryNote: "I set Bond's notes on the kidney beside the letter that boasted of it. The papers printed the letter entire — but the organ's condition was never published anywhere. The letter describes what only the hands that took it could know. Whoever wrote those crude lines is no hoaxer. He held the thing.",
    description: "Watson lays the kidney examination notes beside the From Hell letter. The press reprinted the letter in facsimile — half of London has read it. But the notes record what no newspaper ever carried: the organ's condition, the attached inch of renal artery, the state of its preservation. The letter's boast matches the unpublished facts. Its writer did not read about the kidney. He handled it.",
    holmesDeduction: "The hoax letters trade in what the papers printed, Watson. This one trades in what they did not. Strike every letter from the case but this — this one the killer wrote.",
    locationFound: 'lusk_office',
    // Synthetic label — granted only via the USE combination (kidney notes + letter).
    triggerObject: 'letter_kidney_crossref',
    connections: ['clue_05_from_hell_letter', 'clue_05_human_kidney'],
    clueGroup: 12,
    medicalPoints: 5,
    moralPoints: 5,
  },
```

Append `'clue_12_letter_knows_too_much'` to the `connections` of `clue_05_from_hell_letter` and `clue_05_human_kidney` (same reciprocal-connection note as Task 4 Step 4).

- [ ] **Step 2: The combination**

`USE_COMBINATIONS`, inside the existing `'kidney_parcel'` key (alongside its `'autopsy_ledger'` entry):

```ts
    // USE kidney notes WITH the from hell letter (Act 4 refresher — no act or
    // location lock: deliberately friction-free, both items are Act 4 finds).
    'from_hell_letter': {
      clueId: 'clue_12_letter_knows_too_much',
      resultNote: "SUCCESS — Watson reads the letter's boast against Bond's examination notes, line by line. The papers printed every crude word of the letter — but the notes hold what was never published: the organ's condition, the artery, the preservation. The letter describes the kidney as only its taker could. The hoax theory does not survive the comparison.",
    },
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npx tsx scripts/qa-validate.ts`
Expected: both clean/PASS.

- [ ] **Step 4: Commit**

```bash
git add engine/stories/whitechapel-1888/clues.ts
git commit --no-gpg-sign -m "feat(story): Act 4 USE refresher — kidney notes against the From Hell letter"
```

---

### Task 6: Hint-ladder coverage

**Files:**
- Modify: `engine/stories/whitechapel-1888/hints.ts` (inventory-name consts ~line 10; Act 1 block ~line 67; Act 4 block ~line 148)

- [ ] **Step 1: Inventory display-name consts**

Next to `CLIPPING`/`FROM_HELL`/`FORENSIC_NOTE`:

```ts
const HUTCH_ACCOUNT = "Hutchinson's Account (Watson's note)";
const KIDNEY_NOTES = 'Kidney Examination Notes';
```

- [ ] **Step 2: Act 1 chain objectives**

Replace nothing — the existing `a1_hutchinson` talk objective stays. Insert directly after it:

```ts
  { id: 'a1_account_take', act: 1, locationId: 'dorset_street', verb: 'examine',
    subject: "Hutchinson's statement, worth setting down in Watson's own note",
    done: s => hasItem(s, HUTCH_ACCOUNT) || flag(s, 'showed_hutchinson_account_to_hutchinson'),
    available: s => flag(s, 'talked_to_hutchinson_at_dorset_street') && locationReachable(s, 'dorset_street') },
  { id: 'a1_account_test', act: 1, locationId: 'dorset_street', verb: 'use',
    subject: 'his account, tried against the archway and the light where he says he stood',
    done: s => flag(s, 'used_hutchinson_account_with_court_archway'),
    available: s => hasItem(s, HUTCH_ACCOUNT) && locationReachable(s, 'dorset_street') },
  { id: 'a1_account_confront', act: 1, locationId: 'dorset_street', verb: 'show',
    subject: 'the statement, read back to the man who gave it',
    flag: 'showed_hutchinson_account_to_hutchinson',
    done: s => flag(s, 'showed_hutchinson_account_to_hutchinson'),
    available: s => flag(s, 'used_hutchinson_account_with_court_archway') && npcStep(s, 'dorset_street', 'hutchinson') },
```

Note `a1_account_take.done` also passes once the chain is complete — the account is spent after Act 1, so a pure `hasItem` check would resurrect this objective if hints were consulted late (defensive; Act 1 hints can't fire in Act 2, but the predicate should still be truthful).

- [ ] **Step 3: Act 4 refresher objective**

At the end of the Act 4 block, after `a4_holmes`:

```ts
  { id: 'a4_kidney_letter', act: 4, locationId: 'lusk_office', verb: 'use',
    subject: "Bond's notes on the kidney, set against the letter that boasts of it",
    done: s => flag(s, 'used_kidney_parcel_with_from_hell_letter'),
    available: s => hasItem(s, FROM_HELL) && hasItem(s, KIDNEY_NOTES) },
```

(The Act 4 gate does not include this flag — optional-rewarded. `selectHint` filters by `act === s.currentAct`, so it simply joins the Act 4 pool; when all gate objectives are done the act advances anyway, which is fine — the hint pool is guidance, not a gate.)

- [ ] **Step 4: Update the existing a1_hutchinson `flag` field**

`a1_hutchinson` declares `flag: 'talked_to_hutchinson_at_dorset_street'`. Per the `HintObjective.flag` doc-comment, `flag` names "the exact ACT_PROGRESSION gate flag this objective's done tracks" — the talk flag is no longer a gate flag. Remove the `flag:` line from `a1_hutchinson` (it becomes a prerequisite-only step, like `a0_newspile_examine`); `a1_account_confront` above carries the gate flag. **Check `scripts/qa-diary-leads.ts` and `diaryLeads.ts` expectations** — the diary-lead system keys off gate flags (`isRequiredFlag`), so the silent-lead detection for Act 1 shifts from the talk flag to the show flag automatically (it reads ACT_PROGRESSION). Run `npx tsx scripts/qa-diary-leads.ts` and fix any fixture that names the old flag.

- [ ] **Step 5: Verify**

Run: `npm run lint && npx tsx scripts/qa-hints.ts && npx tsx scripts/qa-diary-leads.ts`
Expected: all PASS. If qa-hints has a fixture walking Act 1 to completion via the old flag, update that fixture to walk the new chain (talk → take → use → show).

- [ ] **Step 6: Commit**

```bash
git add engine/stories/whitechapel-1888/hints.ts
git commit --no-gpg-sign -m "feat(story): hint-ladder coverage for the witness-test chain and Act 4 refresher"
```

---

### Task 7: qa-engine scripted coverage (the regression test)

**Files:**
- Modify: `scripts/qa-engine.ts` (~line 202, the Act 1 block; the Act 4 block; the Act 5 block)

- [ ] **Step 1: Rewrite the Act 1 script block**

Replace the single Hutchinson line with the full chain, including three negative steps (gate order enforced) and one reversed-phrasing step (Task 1 symmetry). The step helper already supports `expectSuccess: false`:

```ts
  // Act 1 — "The Stranger". The witness-test chain: the account must be heard,
  // taken down, tried against the ground, and only then read back to its author.
  s = step('Act1', s, 'take the account',        { expectSuccess: false }); // gated: not yet heard
  s = step('Act1', s, 'talk to hutchinson',      { expectSuccess: true, expectFlag: 'talked_to_hutchinson_at_dorset_street' });
  s = step('Act1', s, 'show account to hutchinson', { expectSuccess: false }); // not in inventory yet
  s = step('Act1', s, 'take the account',        { expectSuccess: true });
  s = step('Act1', s, 'show account to hutchinson', { expectSuccess: false }); // gated: sightline test not done
  // Reversed phrasing exercises the Task 1 symmetry fix — flag must still be
  // keyed to the authored orientation (account first).
  s = step('Act1', s, 'use court archway with the account', {
    expectSuccess: true,
    expectFlag: 'used_hutchinson_account_with_court_archway',
    expectClue: 'clue_11_account_outruns_light',
  });
  s = step('Act1', s, 'show account to hutchinson', { expectSuccess: true, expectFlag: 'showed_hutchinson_account_to_hutchinson' });
  s = step('Act1', s, 'go to millers court',     { expectSuccess: true, expectLocation: 'millers_court' });
  s = step('Act1', s, 'examine burned clothing', { expectSuccess: true, expectFlag: 'examined_millers_court_burned_clothing', expectClue: 'clue_01_killer_confidence' });
  s = step('Act1', s, 'examine the bed',         { expectSuccess: true, expectFlag: 'examined_millers_court_the_bed' });
  s = step('Act1', s, 'talk to bond', {
    expectSuccess: true,
    expectFlag: 'talked_to_bond_at_millers_court',
    expectAct: 2,                            // ← the chain + scene flags advance the act
    expectLocation: 'whitechapel_mortuary',  // ← anchor auto-move
  });
```

If the step helper's parse of `'take the account'` / `'use court archway with the account'` misses (check `npx tsx scripts/qa-parser.ts` output for the exact accepted phrasings), adjust wording to the parser's real vocabulary — the aliases from Task 4 Step 8 (`account`, `archway`) are designed to make these parse.

- [ ] **Step 2: Add the Act 4 refresher steps**

In the Act 4 block, after the letter and kidney are taken (the existing script takes both for the Act 5 convergence — verify; if the kidney notes are not currently taken, add `s = step('Act4', s, 'take the kidney', { expectSuccess: true });` first):

```ts
  s = step('Act4', s, 'use the kidney with the letter', {
    expectSuccess: true,
    expectFlag: 'used_kidney_parcel_with_from_hell_letter',
    expectClue: 'clue_12_letter_knows_too_much',
  });
```

- [ ] **Step 3: Run the full engine harness**

Run: `npx tsx scripts/qa-engine.ts`
Expected: PASS end-to-end (Act 0 → true ending). Every failure at this point is either a wording-vs-parser mismatch (fix the step phrasing or add an alias) or a real chain bug (fix the data/engine — do not weaken the assertion).

- [ ] **Step 4: Run the parser harness (baseline check)**

Run: `npx tsx scripts/qa-parser.ts`
Expected: PASS. New objects are new parse targets; if the harness is regression-gated against a recorded baseline and flags the additions, follow the script's own instructions for accepting a new baseline (it is additive coverage, not a regression).

- [ ] **Step 5: Commit**

```bash
git add scripts/qa-engine.ts
git commit --no-gpg-sign -m "test(qa): witness-test chain + Act 4 refresher coverage, incl. gate-order negatives and reversed USE phrasing"
```

---

### Task 8: Full verification + review

- [ ] **Step 1: Full deterministic suite**

Run: `npm run qa:all`
Expected: lint + every qa:* suite PASS. Fix anything red before proceeding; re-run until green.

- [ ] **Step 2: Dispatch the two review subagents (per CLAUDE.md)**

- `engine-logic-reviewer` — over the Task 1–3 resolver/type changes and the acts.ts gate change (unreachable states, dead gates, missing handlers).
- `narrative-consistency-reviewer` — over the Task 4–5 story data (npcs/facts vs. the new Hutchinson beats; spoiler containment on clue_12; period voice).

Address findings per superpowers:receiving-code-review (verify before implementing).

- [ ] **Step 3: Live playtest of Act 1**

Per project practice (playtest catches what review can't): run `npm run dev`, play the prologue through the Act 1 chain as a player would — including wrong phrasings ("read his statement", "compare account with archway", showing the account early) — and confirm the blocked messages redirect in voice, hints surface each step (`hint` command), and the act advances on the show beat. Requires `.env.local` with `GEMINI_API_KEY` (copy from main root if in a worktree).

- [ ] **Step 4: Commit any playtest fixes, then final commit**

```bash
git add -A && git commit --no-gpg-sign -m "fix(story): playtest polish for the witness-test chain"
```

---

## Deviations from the spec

None of substance. Two mechanical notes: (a) the `ShowInteraction` gate gained an authored `blockedNote` field (the spec's "redirecting narrator note" made concrete); (b) Task 1 fixes the flag-orientation bug discovered during planning (reversed USE phrasing set a non-canonical flag) — within the spec's "USE-order symmetry fix" scope.
