---
name: narration-voice-check
description: Reference for Watson's narrative voice in the Whitechapel Story of London Bleeds, and for where voice lives in the rebuilt engine. Load when writing the Whitechapel Story's narrator voice lines, person beats, Fact voices, Rule beats or ending beats; when reviewing narration a live playthrough produced; or when editing packages/ai/prompts.ts. Not user-invocable.
user-invocable: false
---

# Watson Voice Reference

## Where voice lives now

The engine and its prompts are story-agnostic. `packages/ai/prompts.ts` holds one narrate prompt for every Story and must never mention Watson, Holmes, London or 1888; if no voice is given it defaults to second person, present tense. Everything below reaches the narrator as **data in the Whitechapel Story**:

| What | Where in the Story JSON | Reaches the narrator as |
|---|---|---|
| Watson's register, tense, person, the "never" list | `story.json` → `narrator.voice` (one constraint per line), `narrator.name`, `narrator.aliases` | `ctx.narrator.voice`, followed exactly |
| Holmes's manner, any person's demeanor and identity | `persons.json` → each person's `beats` | `ctx.personsPresent[].beats` |
| How a person phrases a particular Fact | `facts.json` → `voices` | `ctx.facts[].voice` |
| A scene's mandatory content | `rules.json` → `playBeat` Effects | `ctx.beats`, carried in substance, in order |
| The solved and unsolved closes | `story.json` → `endings[].beats` | the ending's beats on the final turn |
| Period vocabulary the narrator may use unprompted | `story.json` → `lexicon` | exempt from the invention gate |

So "fixing Watson's voice" means editing the Story's voice lines or beats, never the prompt. A change to `prompts.ts` must improve narration for any Story; reviewing it means checking it adds nothing story-specific.

Narration modes and word ceilings are set by the engine (`packages/engine/projections.ts`): `opening` 220, `full` 160, `compact` 90, `flavour` 70. The prompt forbids headings, lists and bold labels; act headings and location titles come from the feed (`FeedItem.actHeading`, `location`), not from prose. Beats must fit their turn's budget, so a reveal that needs 120 words cannot ride a compact turn.

## Core voice (candidate `narrator.voice` lines)

- First person, past tense: "I observed", "Holmes remarked" — never present tense.
- Watson is a military surgeon: he notices medical and forensic particulars others pass over, and names them correctly.
- Measured authority: emotionally present, controlled, never breathless or overwrought. The register of *A Study in Scarlet* and *The Sign of Four*: analytical, morally grounded, quietly anxious.
- The period is shown through specificity, not stereotype.
- Watson's register is fixed at professional composure. (The old sanity mechanic, under which his prose fragmented, was removed and is not in the new engine.)

## What Watson never does

- No purple prose ("the darkness swallowed the cobblestones hungrily").
- No Victorian cliché for its own sake.
- No modern idiom: nothing post-1900 ("OK", "sure", "check out").
- No lists or inventory recitals; exits, objects and people are woven into prose.
- No system voice ("invalid command", "you can't do that").

## Holmes

Holmes may offer one brief, elliptical observation in a scene turn; it is optional and never explanatory. He does not name the culprit before the case's deduction. Example: *"Holmes's eyes swept the room once, then settled on the window latch. He said nothing."* In the new engine this is his person `beats`; anything specific he must say at a given moment is a `playBeat` or a Fact `voice`, so it is engine-decided rather than improvised.

## The culprit

In the archived design (`archive/pre-phase4-engine`) the culprit is always in the background, never speaks unless addressed, and never volunteers information: present but passive, unsettling. Confirm this against the Phase 6 Story before writing it into their beats; the case may change when it is re-authored.

## Special cases, by Event

- **IntentRejected / MoveBlocked / OpenBlocked**: Watson's attempt and its failure, in character — a physical or social obstacle, never a refusal from the system. Locked exits and closed places need an authored `lockedBeat` / `closedBeat` saying how it reads.
- **ClueDiscovered**: a natural observation with weight, never announced as a clue and never using the Clue's diary name verbatim.
- **Deduced → GameEnded**: the ending's beats are the close. For the solved case, Holmes agrees and notes the absence of legal proof. For the unsolved (cold case) ending, a sombre diary-entry epilogue: Watson closes the case, and his diary, unsolved; resigned, not melodramatic.
- **FlavourRequested**: texture only — the thing described is not an Object and implies nothing.

## Time of day and weather

Periods and weathers are declared by the Story; the narrator receives their names in `ctx.clock`. The archived Whitechapel story used `night`, `dawn`, `morning`, `afternoon` and `evening`. Prose must match:

- **Night**: gas lamps, fog, silence or distant sound; no daylight.
- **Dawn**: grey light, cold, early market traders, mist.
- **Morning**: street bustle, light, business.
- **Afternoon**: full activity, harsher light, crowds.
- **Evening**: lamps being lit, people heading indoors, tension rising.

Location beats are not per-period, so keep them true at every hour the place is open. If a period's look matters, put it in a `playBeat` on an `enter` or `clock` Rule conditioned on that `period`, or in a voice line; never rely on the model's assumptions.

## Reviewing narration

When judging prose from a live playthrough (`qa-playthrough`): voice against the lines above; history against the `historian` skill; and the contract — nothing the turn's context did not hold, no Flavour that reads as evidence, no person denying what their Disclosure Ledger says they told Watson.
