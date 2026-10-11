# Diary — leads as open questions

Design note for porting the prototype diary (`docs/act0-prototype.html`) into the game. Not yet implemented in `components/` or `engine/`.

## The idea
Watson writes a lead down as a short line the moment it arises, and answers it in one line when it is found. The diary is one page per act:

- **Questions**: the act's leads, in the order they were opened.
  - `●` answered, with the answer in italics underneath.
  - `○` open.
  - `◌` aside (optional lead), tagged "aside".
  - An aside never followed by the end of the act is struck through with "Never taken up." The player sees what they missed only in hindsight, never as a to-do list.
  - Header count: **"N of M answered"**, counting required questions only.
- **Still open**: standing questions the act deliberately leaves unanswered and carries forward. In Act 0: "Who passes under the window and is never looked at?"
- **The evening, in a line**: one authored closing line, chosen per branch.
- **Sections that only appear when an act has them**: persons (cleared or open), papers (documents), evidence. Act 0 has none.

A question is invisible until it is opened, so the diary cannot leak a beat early. There is no AI-written diary text: every question and answer is authored.

## Feedback in play
- Header diary button: an amber badge counting questions *opened or answered* since the diary was last opened.
- A quiet toast, "Noted in my diary", for about 2.5 s whenever a question changes state. Nothing is added to the narration.
- Inside the diary, a 2 px amber rule marks items that changed since the last visit.

## Lead record (proposal for `engine/stories/types.ts`)
```ts
interface StoryLead<F extends string = string> {
  id: string;
  act: number;
  kind: 'required' | 'aside' | 'standing';
  question: string;                       // as Watson writes it; short; a question or a noun phrase
  opensOn: F[];                           // any of these flags opens it ([] = open at act start)
  answers?: Array<{ when: F[]; text: string }>;  // first matching variant wins; omitted for 'standing'
  missedText?: string;                    // asides only; shown struck through after the act's gate fires
}
```
Required leads **are** the act gate. `ACT_PROGRESSION[act].requireFlags` becomes derivable from the answer flags of `kind: 'required'` leads, or is validated against them in `qa:validate`. That gives "lead" one meaning, where today it has two.

## What this replaces
| Today | Becomes |
|---|---|
| Journal / Evidence / Persons / Documents tabs | One page per act; the extra sections appear only when they are non-empty |
| Lead dots (count of required flags) plus LEAD chips on entries, which can disagree (the pawn ticket) | The "N of M answered" counter over required questions |
| AI fill-in entries for silent required flags (`detectSilentLeadFlags`, the `server/aiCore.ts` lead prompt) | Removed. Every required lead has an authored answer |
| Location arrival entries, clue text duplicated in Journal and Evidence | Removed from the journal. Clue text lives once, in the answer or in an evidence section |
| "Watson's reflections" (AI journal text after Act 0) | "The evening, in a line", authored per branch |

`qa:diary-leads` then turns into a coverage check: every required lead has an answer for every branch that can close the act, and every aside has `missedText`.

## Act 0 content (as in the prototype)
| id | kind | Opens | Answered | Answer |
|---|---|---|---|---|
| window | required | act start | demonstration | Boots white with Heath-road dust. He observes, then infers. |
| soldier | required | wager | soldier read | Infantry. India, long ago. A thigh healed short. Waiting for a grandchild. (Adds "A campaign ribbon, faded white." if the glass was used on him) |
| clergyman | required | wager | clergyman read | win: No clergyman. Greasepaint and a script: an actor, still in costume. / lose: An actor. I saw the coat and stopped looking. / guess: An actor, though I guessed it. A guess is not a reading. |
| glass | aside | demonstration | first use of the glass | It brings the street nearer. (Adds "The greasepaint was there to be seen." if used on the clergyman.) Missed: Never taken up. |
| unseen | standing | closing | — | — |
