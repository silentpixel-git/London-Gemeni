---
status: accepted
---

# Pinned Rule semantics before the first act is scored

The engine review of November 2026 (`docs/reviews/engine-review-2026-11.md`) found that several Rule semantics were either undecided or decided by accident, and that none of the surprises raised an error. Every act will be scored and authored against these semantics, so they are pinned here before Phase 6 starts. Each decision is enforced by the engine and asserted in `qa:core`, `qa:stress` (section "pinned"), `qa:prove` and `qa:turn`.

1. **The opening counts as entering an act.** Starting an Investigation is a turn: `InvestigationStarted`, the Clues of any Fact the player starts knowing, then the cascade that entering the opening location sets off. `enter` Rules on the opening location fire, and so do arrival Rules for everyone standing there. Before this, the opening ran no Rules, while every later act entry fired `enter` on its anchor.

2. **Proximity fires on arrival, not on every turn.** A `proximity` Rule fires when the player and the person come to share a location: the player walks in, a Rule moves or summons the person, a schedule brings them at a period change, an act entry puts them together, or the game opens with them together. It does not fire again while they stay together. The firing happens in the turn that caused the arrival, so its Effects are visible before the player types the next command.

3. **An act boundary is time enough for every rumour.** Entering an act delivers every delayed `grantFact` still in flight, emitted as `FactLearned` right after `ActEntered`. The engine cannot tell whether the next act starts an hour or a week later, since `dateLabel` is free text. A rumour meant to land partway through the next act is an ordinary Rule gated on that act. Two smaller rules go with this: a `clock` Rule set exactly at an act's start time fails validation, because the clock starts there and never passes it; and a Tick that enters an act adds no Tick minutes, as a player turn already did not.

4. **A `leave` Rule judges its conditions from the room being left.** Its `when` sees the world as it is, with the player still in the location being left, so `location` and `personsPresent` mean what an author expects. Every other trigger sees the world after the action. Firing order is the action, then `leave`, then `enter`, then arrivals, then whatever those set off; Story order applies only among the Rules of one firing.

5. **The prover proves only what a player can select.** Every prover action passes the same Candidate Set check the turn endpoint applies (`inCandidateSet`, now in `packages/schema/candidates.ts`). Two consequences for what a player can select:
   - A deduction may accuse anyone the player has met, present or not. The Candidate Set carries them as `suspects`, by the label the player knows them by.
   - `examine` may target a person present, and `use` may take a person present as its secondary.

   The prover can also always wait until the next period, so content gated by a period (a room, a schedule, a delayed grant) is reachable whether or not some `clock` Rule happens to exist. "wait until X" in a walkthrough stands for as many waits as it takes.

6. **`visibleFromAct` gates speech, not learning.** It is the earliest act in which a person will tell the player the Fact. A document or a Rule may teach it earlier; the prover reports the first such path as EARLY, and the validator warns on a `grantFact` to the player that can fire earlier. Granting it early to a person is not reported: they still cannot tell it before its act.

7. **`knownBy: ["player"]` is honoured.** The player starts knowing the Fact, may name it in a deduction or tell it to others, and finds its Clue on the opening turn.

## Considered options

- **Proximity at the start of every turn (the previous behaviour).** Rejected: a greeting lands one turn late, a repeatable proximity Rule fires on every turn, and a proximity Rule that changes the world (enters an act, dismisses someone) does so after the player has chosen a command against the old world.
- **Count the period boundaries an act jump skips, as if the clock had run forward.** Rejected: the engine does not know how much time passes between acts, so the result would depend on whether the next act starts earlier or later in the day, which is not what an author means.
- **Evaluate `leave` against a frozen copy of the pre-move State.** Rejected: two `leave` Rules on one exit could no longer exclude each other with `flagsNone`. Judging from the room left, with flags live, keeps that pattern working.
- **Suspects must be present.** Rejected: every accusation scene would have to bring the suspect on stage.
- **`visibleFromAct` as a hard gate on all learning.** Rejected: it would forbid the deliberate early clue, a letter read before anyone will talk about it. The prover's EARLY report catches the accidental one.
- **Fail a `clock` Rule at any time before its act's start.** Rejected: overnight Rules (midnight bells in an evening act) are normal. The validator fails only the exact start time and warns when the first firing would come more than twelve hours after the act starts.

## Consequences

- Saves from before this change replay to a different State (a greeting moves from turn 1 to the opening, rumours mature at act entry). Start a fresh Investigation.
- `qa:turn` recordings were re-authored, since the opening narration context and the Candidate Set changed.
- A score's **Trigger** column for `proximity` describes an arrival. Ambient chatter while someone stays present is a `tick` Rule with `personsPresent`.
- What remains of the review is independent of these decisions and can be fixed in any order: the invention gate, the endpoint's handling of disconnects and double gate rejections, the `events` line sent to the browser, the validator gaps, and the cost of loading the log.
