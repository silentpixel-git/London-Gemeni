// What leaves the server for the player's screen (server/TURN.md): the
// sidebar, the diary and the feed, as names and labels only. The client never
// holds the Story, since the Story holds the solution. Plain types, no Zod:
// the server builds these from validated data and the client only reads them.
import type { Id } from './common.js';

export interface Named { id: Id; name: string }

export interface PlayerView {
  storyTitle: string;
  /** Who tells the story (Story.narrator.name), for chrome such as the diary's title; null when the Story names none. */
  narrator: string | null;
  act: { id: number; name: string; dateLabel: string };
  /** Absolute minutes since midnight of the act's first day; may exceed 1439. */
  clock: number;
  period: Named;
  weather: Named;
  location: Named;
  inventory: Named[];
  /** People here, by the label the player knows them by (alias until introduced). `spokenTo`: the player has talked to them in this location. */
  persons: Array<Named & { spokenTo?: true }>;
  /** Objects here and not carried. `inside` names the open container holding it; `examined`: the player has examined or read it. */
  objects: Array<Named & { closed?: true; inside?: Id; examined?: true }>;
  /** `name` is the exit's first authored name (a command word); `to` the destination's name; `visited`: the player has been there. */
  exits: Array<{ id: Id; name: string; to: string; visited?: true }>;
  ended: Named | null;
  /** Sound ids for the client's ambience: the bed for this location in this act, the layer for this act's weather. Null: silence. */
  ambience: { bed: Id | null; weather: Id | null };
  diary: Diary;
}

/** Only what the player has discovered: no Clue, Fact or document they have not met. */
export interface Diary {
  /** Acts entered so far, in order. */
  acts: Array<{ id: number; name: string; dateLabel: string }>;
  clues: Array<{ id: Id; name: string; summary: string; act: number; clock: number }>;
  /** People met, with every Fact they have told the player (the Disclosure Ledger). */
  persons: Array<Named & { told: string[] }>;
  documents: Array<Named & { text: string }>;
}

/** One block of the feed. A turn yields its player line, then its prose, then any ending. */
export type FeedItem =
  | { kind: 'player'; text: string }
  /** `location` heads a scene entry (opening, move, look, act); `actHeading` an opening or new act. */
  | { kind: 'prose'; text: string; location?: string; actHeading?: string }
  | { kind: 'ending'; name: string };
