// Client-side presentation types. Game data types live in packages/schema
// (view.ts is what the server sends the screen).

/** The auto theme's notion of the hour (App.tsx derives it from the in-game clock). */
export type TimePeriod = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'lateNight';

/** Appearance preference: light, dark, or auto (follows the in-game hour). */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** One block as NarrativeFeed renders it (built from the server's FeedItems by historyFrom). */
export interface GameHistoryItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
  /** Scene-entry chrome (opening / act arrival) — rendered by the feed, never part of the AI text. */
  actHeading?: string;
  /** Engine-verified location name on a scene entry (move / look / act) — rendered as the pin header. */
  location?: string;
}
