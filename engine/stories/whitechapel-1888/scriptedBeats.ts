import type { ScriptedBeat } from '../types';
import type { StoryFlag } from './flags';

/**
 * Act 0's opening, staged one beat per player action — spec phases A and B.
 *
 * The act opens on Holmes silent at the window (see the authored opening line
 * in hooks/gameState/useSceneStreams.ts) and the five beats below carry it
 * through his demonstration, the caller's arrival, and his opening account of
 * her, ending on the line that hands control to the player. Splitting it this
 * way is a deliberate correction: all of this text once landed in the opening
 * turn at once, which met the player with a wall of prose before they had
 * typed anything.
 *
 * All five beats are 'prose' — none uses 'blockquote'. Beats 2-4 were
 * originally blockquote (reported speech, "he says…") on the theory that they
 * were events rather than dialogue; in play this read as evasive and lost the
 * direct-address quality the spec's own dialogue has, so they were rewritten
 * as ordinary attributed prose. The style field stays on the type — a future
 * beat may legitimately want atmosphere-only blockquote — but qa:validate's
 * "blockquote contains quoted speech" guard is what would catch this drifting
 * back by accident.
 *
 * Beat 3 carries a `notice` — the doorbell has no engine-level presence
 * signal the way an NPC arrival does, so the beat supplies its own mechanical
 * line, same register as "**X** has arrived."
 *
 * Beat 4 admits Mrs. Kemp: `world_event_kemp_arrives` is what OBJECT_VISIBILITY
 * gates her belongings on and what her `presenceRequiresFlag` reads, so it must
 * not be set before she is physically in the room.
 */
export const SCRIPTED_BEATS: ScriptedBeat<StoryFlag>[] = [
  {
    id: 'act0_holmes_reads_the_crowd',
    act: 0,
    atTurn: 1,
    style: 'prose',
    // Closes on Watson's own reaction rather than ending flat on Holmes's
    // proof — the model's own paragraph runs BEFORE this beat is appended, so
    // it cannot react to content it doesn't yet know is coming; only the beat
    // itself can land the moment. The last clause also bridges directly into
    // beat 2: his eyes moving on to the next face IS him noticing her.
    text: '"The stout gentleman by the lamp is a licensed victualler," said Holmes, without turning round, "on his one evening of the year, and he is not enjoying it. The girl with him is his daughter and not his wife, or he would not keep looking to see whether she is warm enough. The man behind them has walked from Hampstead to save the fare and will walk back, and has told his companion he did it for the air."\n\n"You cannot possibly know the last of that."\n\n"I know the last of it because his boots are white to the ankle with the dust of the Heath road, and his hat has not been off his head since noon. The rest is inference, and you are at liberty to disbelieve it." He did not turn round. "I did not say it was a mystery. I said it was legible."\n\nI have never quite grown accustomed to it, however many times I have watched him do it, and I said so. He did not appear to hear me — his eyes had already moved on to the next face in the crowd.',
  },
  {
    id: 'act0_holmes_notices_the_caller',
    act: 0,
    atTurn: 2,
    style: 'prose',
    // Restored to direct dialogue (the spec's own form). The earlier
    // reported-speech version ("he says", rendered as a blockquote) read as
    // evasive for a moment this pointed — Holmes noticing her is the hinge
    // the whole arrival turns on, and it plays better as him actually saying it.
    text: '"There," said Holmes. Something in his voice had altered by a degree. "The woman at the area railings: she has come as far as our door twice in seven minutes and turned back twice, and she is doing it a third time. In gloves, on a bank holiday, carrying a bundle she has not once shifted from one arm to the other." He watched her a moment longer. "A respectable woman at the last item on a list she never expected to write, and she does not know how to begin it."',
  },
  {
    id: 'act0_the_bell',
    act: 0,
    atTurn: 3,
    style: 'prose',
    notice: '**Door bell** is ringing.',
    text: 'The bell goes at last, one short pull, as though the hand that made it had been talked into it and might yet be talked out again.',
  },
  {
    id: 'act0_kemp_shown_up',
    act: 0,
    atTurn: 4,
    style: 'prose',
    // Mrs. Hudson has been out all day and has only just come in — hence a
    // landlady on hand at all on a Bank Holiday. The spec had her off entirely,
    // with Watson going down himself; this keeps the holiday true and still
    // gives the house someone to answer the door.
    setsFlag: 'world_event_kemp_arrives',
    // A live playtest caught Holmes reciting specifics (the lapsed rent, the
    // landlady awake to see her go) in beat 5 with nobody having told him
    // anything — beat 5 is turn-indexed and fires regardless of what the
    // player does on turn 5, so if their action isn't specifically "ask her
    // about her sister" the deduction arrives with no visible source. Rather
    // than gate beat 5 on a player action (which would break the one-beat-
    // per-turn guarantee), Mrs. Kemp now states her business herself as part
    // of arriving, so Holmes's assessment is always grounded in something
    // actually said. Kept to two short sentences, matching her established
    // voice (npcs.ts: "does not embroider and she does not weep").
    text: 'Mrs. Hudson, in from her own day out barely a quarter of an hour and still in her good hat, shows the visitor up and withdraws. A woman of about four and thirty, still gloved though the evening is warm, as if dressed for an appointment that never happened and given no thought to her hands since. She sets the bundle on the table without ceremony, a pair of worn-out boots and a closed tin workbox, and holds the pawn ticket a long while before she can bring herself to lay it beside them.\n\n"My sister," she said, before either of us had asked. "Ellen — Nell, we call her. She has not been seen in six days, and I did not know where else to bring it." She said no more, and looked instead at the boots, as though they might finish the sentence for her.',
  },
  {
    id: 'act0_holmes_opening_account',
    act: 0,
    atTurn: 5,
    style: 'prose',
    // Spec phase B: Holmes's flat assessment before the player has examined
    // anything, the six-days exchange, and the line that hands the player the
    // controls.
    //
    // Two corrections from an earlier draft of this beat. First, a chronology
    // error carried over from the source spec text: it has Holmes say Nell
    // "settled her rent to the week's end" — but the canon this rebuild
    // actually shipped (kemp_landlady, and the spec's own "Required bible
    // edits" section) has the rent LAPSE, unpaid, which is the detail that
    // makes the departure look like flight rather than a plan. kemp_landlady
    // is a fact a player can still go ask Mrs. Kemp about directly, so this
    // must not contradict it. Second, every line of dialogue is now
    // explicitly attributed — the unattributed version left three lines of a
    // four-line exchange with no speaker tag, unreadable as an exchange
    // between two people — and "Watson noticed" (third person) is corrected
    // to "I noticed" (this is Watson's own first-person narration throughout).
    text: 'Holmes did not turn from the window. "Your sister rose at six, dressed, packed at leisure, and walked out past a landlady who was awake to watch her go: her rent left to lapse, the room cleared within the day, nothing in it worth the keeping. Madam, that is not a disappearance. That is a departure. The distinction is not a fine one, and I am afraid your constable was right, though I have no doubt he was insufferable about it."\n\n"She has been gone six days," he added, flatly, without emphasis.\n\n"We do not live in each other\'s pockets, Mr. Holmes," said Mrs. Kemp. "We write."\n\n"I did not say otherwise," said Holmes.\n\nHe did not press it further, and I noticed that he did not.\n\n"Watson." He turned from the window at last. "You have been looking at those boots since she set them down. Pray satisfy yourself."',
  },
];
