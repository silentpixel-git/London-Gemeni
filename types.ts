// Client-side presentation types. Game data types live in packages/schema
// (view.ts is what the server sends the screen).

/** Appearance preference: light, dark, or auto (follows the in-game hour). */
export type ThemeMode = 'light' | 'dark' | 'auto';
