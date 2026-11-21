# Open ideas

Ideas that are neither built nor rejected. Nothing here is scheduled. Each entry says what the idea is and why it might be worth doing. When one is built or ruled out, delete it.

## Engine and AI

- **Real per-turn token and cost logging.** Read actual usage from the provider instead of estimating. It would show what a turn costs and whether the Story-prefix cache the plan calls for is paying off.
- **A fallback model chain.** `AI_NARRATE_MODEL` and `AI_SELECT_MODEL` can be swapped, but nothing falls through to a second model when the first is unavailable or a preview is withdrawn. A fallback would come before the beats-only close.

## Tooling and QA

- **An LLM-judged narration pass.** Score sampled live narration against the voice, spoiler, anachronism and repetition rubric, and keep the report as a generated file. `qa:gate` catches invented names and numbers but not a flat voice or a repeated opening. The `qa-narration` flow the plan names in Phase 3 does not exist in `scripts/`.
- **A guard on the "prasarved" misspelling.** When Phase 6 authors the From Hell letter and Edmund's note, a validator check that the exact misspelling survives in both would stop a well-meant spelling fix from breaking the crown puzzle.

## Player-facing

- **Search and filter in the diary.** By act and text. Diaries get long over a full playthrough.
- **Punctuation-aware typewriter pacing.** The reveal already skips on click; it does not yet pause at full stops or move faster through dialogue. Small, but it is the prose's first impression.
- **A diegetic evidence board.** A corkboard or desk of discovered clues and their connections, framed as Watson's desk. The Clue data already holds the connections. It strains the UI restraint principles, which `game-direction` lists as an open question, so it needs the owner's decision first.
- **Pre-generated location plates.** Period-styled illustrations, gated by act, never generated at runtime. Adds atmosphere without touching the engine.
- **A turn-failure screen.** The approved 2026-08 design was written for the deleted hook and is obsolete in mechanism: the server now records a turn even when narration fails, so retrying can no longer re-run the engine. Its intent survives:
  - Say plainly, in the game's voice and not in a toast that vanishes, whether the action stood and only the prose is missing. Today the client shows "The narration failed; the turn was recorded without it." as a notification and re-reads the feed, which then holds the Beats alone.
  - Offer to ask again for the missing narration of an already-resolved turn. That needs a server path to narrate an existing turn, such as a compensating `Narrated` Event, because a beats-only close is final today.
  - When a turn never reached the server (network, 5xx), halt input and show the connection state, so the player sees whether the fault is local.
  - Keep raw error text out of the prose, in a quiet footer that is clearly outside the fiction.
  - Hold the original accessibility constraints: `--lb-muted` is not a text colour on any theme, accent is for borders and focus rings only, status is stated in words as well as colour, and motion honours reduced-motion.

## Story content

- **A closing scene at 221B after the asylum.** The pre-rebuild story never authored its final Watson and Holmes exchange; the arc ended on the diary entry. The bible's Act 0 now opens with Mrs. Kemp's pawn ticket for her missing sister, a mistake the story spends seven acts paying for, and it has no closing beat that returns to it. A short fireside scene could pay that off and give the true ending its last exchange. A Phase 6 decision, through `act-authoring`.
- **Four clues the bible's table does not place.** The Hands (small hands, found at Bond's desk), The Respectable Stranger (how the killer approached, at Buck's Row), The Eleven Weeks (the span of the campaign) and The Murders Stop (the asylum records showing the killings ended with Edmund's commitment). The bible says no clue is cut, so each needs an act and a place in its section 7, or an explicit decision to cut it. `docs/game-design.md` lists where each was found before the rebuild.
- **Two character notes the bible does not carry.** Diemschutz, who found Stride, "saw nothing unusual": the point of his testimony is that the killer was calm, and the bible uses him only for the cart that interrupts. The Asylum Superintendent is the keeper of Edmund's records and has no counterpart in the bible's cast.
