# Act 0 — mechanical score (delta rows)

Scored against `0d565d1` (the action-triggered story-event pilot). Covers only the three beats this pass touches; the rest of Act 0 is unscored and stays as the pilot built it.

Process: `docs/act-authoring-process.md`. Narrative intent for these three: approved in chat 2026-08-04.

---

## Row 1 — SHOW the boots routes into the boots event

| Column | Value |
|---|---|
| Trigger | `show` intent, `targetIds: ['nells_boots']`, `npcIds: ['holmes']`, `replacesBlocked: true`, at `baker_street` |
| Sets | `act0_boots_analyzed` — the **same** flag as the existing examine/talk triggers. No new flag. |
| Turn window | Any turn once `world_event_kemp_arrives`; `forbidFlags: ['act0_boots_analyzed']` makes it one-shot |
| Narration | The event's existing four beats, `maxWords: 180`. Unchanged — SHOW joins the existing delivery, it does not get its own prose |
| NPCs on stage | holmes, mrs_kemp. Sidebar unchanged |
| Objects + aliases | Verified: `show the boots to holmes` and `show holmes the boots` both parse to `nells_boots` + `holmes` |
| Facts askable | Unchanged |
| Diary | None |

**Why this shape.** `resolveShow` blocks non-takeables before it ever consults `SHOW_INTERACTIONS`, and the event matcher runs after the verb resolver and can clear a blocked result (`engine/storyEvents.ts:44`, `:199-205`). So the fix is one trigger in story data and **no engine change**. `replacesBlocked: true` is already used five times in this act's own events. Routing SHOW through the event — rather than relaxing `resolveShow` — keeps one source of truth for the Bermondsey reading and guarantees the gate flag is set, so the content cannot be delivered twice.

---

## Row 2 — retire the two superseded SHOW readings

| Column | Value |
|---|---|
| Change | Delete `nells_boots` and `nells_letters` from `SHOW_INTERACTIONS` (`clues.ts:622-632`) |
| Sets | Nothing. Confirmed orphaned: no file reads `showed_nells_boots_to_holmes` or `showed_nells_letters_to_holmes` |
| Turn window | n/a |
| Narration | The boots reading now lives in the event's beats; the letters' Tuesday postmarks now live in `act0_reconstruction`'s beats. No prose is lost |
| Diary | None |

**Why.** Both entries are unreachable today and stay unreachable after Row 1 (the event replaces the blocked result before the interaction lookup is reached). Leaving authored prose that no path can deliver is what hid this bug for so long.

---

## Row 3 — a refused SHOW must not name an object that is not here

| Column | Value |
|---|---|
| Change | In `resolveShow`, when the target is neither carried nor visible at the current location, refuse using the player's own words (`intent.targetRaw`) instead of the absent object's display name |
| Sets | Nothing |
| Turn window | Always |
| Narration | Refusal text only. Also removes the existing double-article bug ("the The From Hell Letter") |
| Objects + aliases | The collision: `show the letters to holmes` parses to `from_hell_letter` via the global `'letter'` alias. `show nell's letters to holmes` and `show the correspondence to holmes` both parse correctly to `nells_letters` |
| Diary | None |

**Why this and not the parser.** The visible defect is a spoiler: in a scene set 6 August, the refusal names the From Hell letter, an October artifact, violating the pilot's own rule that Act 0 carry no murder foreshadowing. Fixing the refusal text closes the leak for **every** present and future alias collision, not just this phrase.

**Deliberately not done here:** adding `show` to `SOFT_MISS_VERBS` so the AI tier could recover the intended object. That would make the phrase actually work, but it also requires widening `server/parseAction.ts`'s show tool beyond carried items, and the two must move together or AI parses fail validation. Since the letters no longer have a standalone reading, a correct refusal is the whole of the fix; the parser work is a separate, optional pass.

---

## Pre-checks

- **Alias sweep** — run against `intentParser.ts`. No new aliases introduced. Existing routes verified by probe (results in the rows above).
- **Flag grammar** — no new flags. Row 1 reuses `act0_boots_analyzed`, already in the `StoryFlag` union and already an `ACT_PROGRESSION[0]` requirement.
- **Presence** — unchanged. No NPC schedule or `presenceRequiresFlag` / `presenceForbidFlag` touched.
- **Chronology** — unchanged; Row 3 removes a chronology violation rather than adding one.

## Golden assertions to write red first

1. `show the boots to holmes` succeeds, sets `act0_boots_analyzed`, and carries the event's beats.
2. Showing the boots after the event has already fired does not re-fire it.
3. `show the letters to holmes` is refused **without** the string "From Hell" anywhere in the refusal.
4. `examine the boots` still sets `act0_boots_analyzed` — the existing path is not regressed.
