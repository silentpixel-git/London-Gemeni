/**
 * hooks/useAudio.ts
 *
 * Thin bridge between what the player can see and the AudioManager singleton:
 * the one-time autoplay unlock, the ambient bed and weather layer the Story names, and
 * one-shot sounds for the latest turn. The server names the sound ids (a cue
 * id is the SFX id with hyphens, `pages-riffle`); an id with no file is silent.
 */

import { useEffect } from 'react';
import { audioManager } from '../services/AudioManager';
import { SFX_FILES, type SfxId } from '../services/audioManifest';

interface UseAudioArgs {
  /** PlayerView.ambience: the sound ids the Story names. */
  bed: string | null;
  weather: string | null;
  /** The sound ids of the latest turn (empty after a resume, so nothing replays). */
  cues: string[];
  soundEffects: boolean;
  ambientAudio: boolean;
}

export function useAudio({ bed, weather, cues, soundEffects, ambientAudio }: UseAudioArgs): void {
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
  // toggling ambient on immediately starts the current bed.
  useEffect(() => {
    audioManager.setEnabled({ sfx: soundEffects, ambient: ambientAudio });
    audioManager.setAmbient(bed, weather);
  }, [soundEffects, ambientAudio, bed, weather]);

  // One-shots for the turn just played, staggered so two never land together.
  useEffect(() => {
    cues.filter((id): id is SfxId => id in SFX_FILES).forEach((id, i) => audioManager.playSfx(id, i * 400));
  }, [cues]);
}
