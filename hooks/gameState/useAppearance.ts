import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { GameRepository, UserProfile } from '../../services/GameRepository';
import { ThemeMode, TimePeriod } from '../../types';

export interface AppearanceDeps {
  user: User | null;
  userProfile: UserProfile | null;
  currentTimePeriod: TimePeriod;
}

export function useAppearance(deps: AppearanceDeps) {
  const { user, userProfile, currentTimePeriod } = deps;

  // Single appearance choice — defaults to light. Reads the new key first, then
  // falls back to the legacy lb-theme / lb-atmospheric-theme pair so existing
  // players keep their setting (atmospheric → 'auto', dark → 'dark').
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('lb-theme-mode');
      if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
      if (localStorage.getItem('lb-atmospheric-theme') === 'on') return 'auto';
      if (localStorage.getItem('lb-theme') === 'dark') return 'dark';
    } catch {}
    return 'light';
  });
  // Atmosphere audio — default off, persisted to localStorage (POC).
  const [soundEffects, setSoundEffects] = useState<boolean>(() => {
    try { return localStorage.getItem('lb-sound-effects') === 'on'; } catch { return false; }
  });
  const [ambientAudio, setAmbientAudio] = useState<boolean>(() => {
    try { return localStorage.getItem('lb-ambient-audio') === 'on'; } catch { return false; }
  });

  // Apply the active data-theme. In 'auto' the palette follows the in-game clock
  // (evening/night); 'light' and 'dark' apply that palette directly. Because it's
  // one choice, a manual dark selection can never be silently overridden.
  useEffect(() => {
    let theme: string;
    if (themeMode === 'auto') {
      theme = (currentTimePeriod === 'night' || currentTimePeriod === 'lateNight') ? 'night'
            : (currentTimePeriod === 'evening' || currentTimePeriod === 'dawn')   ? 'evening'
            : 'light';
    } else {
      theme = themeMode; // 'light' | 'dark'
    }
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
  }, [themeMode, currentTimePeriod]);

  // Persist the appearance choice — localStorage + Supabase cloud sync.
  useEffect(() => {
    try { localStorage.setItem('lb-theme-mode', themeMode); } catch {}
    // Sync to cloud when logged in (user accessed via closure — intentionally omitted from deps)
    if (user) {
      GameRepository.upsertProfile(user.id, { themePreference: themeMode });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  // Persist the atmosphere audio toggles — localStorage only for the POC.
  useEffect(() => {
    try { localStorage.setItem('lb-sound-effects', soundEffects ? 'on' : 'off'); } catch {}
  }, [soundEffects]);
  useEffect(() => {
    try { localStorage.setItem('lb-ambient-audio', ambientAudio ? 'on' : 'off'); } catch {}
  }, [ambientAudio]);

  // Load appearance preference from cloud when user profile becomes available
  useEffect(() => {
    const pref = userProfile?.themePreference;
    if (pref === 'light' || pref === 'dark' || pref === 'auto') {
      setThemeMode(pref);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]); // only fire when user identity changes, not on every profile update

  return { themeMode, setThemeMode, soundEffects, setSoundEffects, ambientAudio, setAmbientAudio };
}
