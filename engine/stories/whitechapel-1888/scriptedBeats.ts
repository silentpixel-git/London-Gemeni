import type { ScriptedBeat } from '../types';
import type { StoryFlag } from './flags';

/**
 * Act 0's opening, staged one beat per player action.
 *
 * The act opens on Holmes silent at the window (see the authored opening line
 * in hooks/gameState/useSceneStreams.ts) and the four beats below carry it to
 * the point where the caller is in the room. Splitting it this way is a
 * deliberate correction: all of this text once landed in the opening turn at
 * once, which met the player with a wall of prose before they had typed
 * anything.
 *
 * Beat 1 is 'prose' because it is dialogue. Beats 2-4 are 'blockquote' because
 * they are events in the room rather than speech — the same register as the
 * world events and vignettes they sit alongside.
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
    text: '"The stout gentleman by the lamp is a licensed victualler," said Holmes, without turning round, "on his one evening of the year, and he is not enjoying it. The girl with him is his daughter and not his wife, or he would not keep looking to see whether she is warm enough. The man behind them has walked from Hampstead to save the fare and will walk back, and has told his companion he did it for the air."\n\n"You cannot possibly know the last of that."\n\n"I know the last of it because his boots are white to the ankle with the dust of the Heath road, and his hat has not been off his head since noon. The rest is inference, and you are at liberty to disbelieve it." He did not turn round. "I did not say it was a mystery. I said it was legible."',
  },
  {
    id: 'act0_holmes_notices_the_caller',
    act: 0,
    atTurn: 2,
    style: 'blockquote',
    // Reported rather than quoted: this renders as a blockquote, and speech set
    // in one reads as a pulled quote.
    text: 'Something in Holmes\' voice alters by a degree. There is a woman at the area railings, he says, who has come as far as the door twice in seven minutes and turned back twice: gloved, on a bank holiday, carrying a bundle she has not once shifted from one arm to the other. A respectable woman at the last item on a list she never expected to write, and she does not know how to begin it. She is standing down there now, deciding.',
  },
  {
    id: 'act0_the_bell',
    act: 0,
    atTurn: 3,
    style: 'blockquote',
    text: 'The bell goes at last, one short pull, as though the hand that made it had been talked into it and might yet be talked out again.',
  },
  {
    id: 'act0_kemp_shown_up',
    act: 0,
    atTurn: 4,
    style: 'blockquote',
    // Mrs. Hudson has been out all day and has only just come in — hence a
    // landlady on hand at all on a Bank Holiday. The spec had her off entirely,
    // with Watson going down himself; this keeps the holiday true and still
    // gives the house someone to answer the door.
    setsFlag: 'world_event_kemp_arrives',
    text: 'Mrs. Hudson, in from her own day out barely a quarter of an hour and still in her good hat, shows the visitor up and withdraws. A woman of about four and thirty, still gloved though the evening is warm, as if dressed for an appointment that never happened and given no thought to her hands since. She sets the bundle on the table without ceremony, a pair of worn-out boots and a closed tin workbox, and holds the pawn ticket a long while before she can bring herself to lay it beside them.',
  },
];
