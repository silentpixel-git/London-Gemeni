/**
 * hooks/useAudio.ts
 *
 * Thin bridge between React game state and the AudioManager singleton. SFX are
 * fired directly from event emission points in useGameState; this hook only
 * drives the state-based ambient layer and the one-time autoplay unlock.
 */

import { useEffect } from 'react';
import { audioManager } from '../services/AudioManager';

interface UseAudioArgs {
  location: string;
  weatherCondition: string | undefined;
  soundEffects: boolean;
  ambientAudio: boolean;
}

export function useAudio({ location, weatherCondition, soundEffects, ambientAudio }: UseAudioArgs): void {
  // Unlock the audio context on the first user gesture (autoplay policy).
  useEffect(() => {
    const onGesture = () => audioManager.unlock();
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  // Push settings + the current ambient scene. setEnabled runs first so that
  // toggling ambient on immediately starts the bed for the current location.
  useEffect(() => {
    audioManager.setEnabled({ sfx: soundEffects, ambient: ambientAudio });
    audioManager.setAmbient(location, weatherCondition);
  }, [soundEffects, ambientAudio, location, weatherCondition]);
}
