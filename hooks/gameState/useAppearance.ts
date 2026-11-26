import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { upsertProfile, type UserProfile } from '../../services/GameRepository';
import type { ThemeMode } from '../../types';

/** The auto theme's palette at an in-game clock (absolute minutes); a Story's own Periods are not needed for that. */
function autoTheme(clock: number | undefined): 'light' | 'evening' | 'night' {
  if (clock === undefined) return 'evening';
  const h = Math.floor((((clock % 1440) + 1440) % 1440) / 60);
  if (h < 5 || h >= 20) return 'night';
  if (h < 7 || h >= 17) return 'evening';
  return 'light';
}

/** A setting kept in localStorage under `key`; `decode` maps the stored string (null when absent) to the value. */
function useStored<T extends string | boolean>(key: string, decode: (raw: string | null) => T) {
  const [value, setValue] = useState<T>(() => {
    try { return decode(localStorage.getItem(key)); } catch { return decode(null); }
  });
  useEffect(() => {
    try { localStorage.setItem(key, typeof value === 'boolean' ? (value ? 'on' : 'off') : value); } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

export function useAppearance({ user, userProfile, clock }: { user: User | null; userProfile: UserProfile | null; clock: number | undefined }) {
  // Single appearance choice — defaults to light.
  const [themeMode, setThemeMode] = useStored<ThemeMode>('lb-theme-mode', r => (r === 'dark' || r === 'auto' ? r : 'light'));
  // Atmosphere audio — default off.
  const [soundEffects, setSoundEffects] = useStored('lb-sound-effects', r => r === 'on');
  const [ambientAudio, setAmbientAudio] = useStored('lb-ambient-audio', r => r === 'on');
  // "Try" suggestion chips above the command line — default on.
  const [showSuggestions, setShowSuggestions] = useStored('lb-show-suggestions', r => r !== 'off');
  const theme = themeMode === 'auto' ? autoTheme(clock) : themeMode;

  // Apply the active data-theme. In 'auto' the palette follows the in-game clock
  // (evening/night); 'light' and 'dark' apply that palette directly. Because it's
  // one choice, a manual dark selection can never be silently overridden.
  useEffect(() => {
    // Crossfade the whole page atomically via the View Transitions API.
    // Per-element CSS color transitions can't do this cleanly: `color`
    // inherits, so every inheriting node runs its own transition and snaps
    // back to its parent's still-animating value when it finishes — a visible
    // bounce. A snapshot crossfade has no per-element dynamics (and also
    // smooths gradients and scrollbars, which color transitions never covered).
    // Skipped on first mount (nothing to fade from), under reduced motion,
    // and in browsers without the API — those get an instant switch.
    const isFirstTheme = document.documentElement.dataset.theme === undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isFirstTheme || reduceMotion || !document.startViewTransition) {
      document.documentElement.dataset.theme = theme;
    } else {
      document.startViewTransition(() => {
        document.documentElement.dataset.theme = theme;
      });
    }
  }, [theme]);

  // Sync the appearance choice to the profile when logged in (user accessed via closure — intentionally omitted from deps).
  useEffect(() => {
    if (user) {
      upsertProfile(user.id, { themePreference: themeMode });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  // Load appearance preference from cloud when user profile becomes available
  useEffect(() => {
    const pref = userProfile?.themePreference;
    if (pref === 'light' || pref === 'dark' || pref === 'auto') {
      setThemeMode(pref);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]); // only fire when user identity changes, not on every profile update

  return { themeMode, setThemeMode, soundEffects, setSoundEffects, ambientAudio, setAmbientAudio, showSuggestions, setShowSuggestions };
}

export type Appearance = ReturnType<typeof useAppearance>;
