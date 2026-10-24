/**
 * hooks/useAudio.ts
 *
 * Thin bridge between React game state and the AudioManager singleton. Most SFX
 * are fired directly from event emission points in useGameState; this hook
 * drives the state-based ambient layer, the one-time autoplay unlock, and the
 * scene cues the Act 0 prototype established: the bed dipping as an act closes,
 * fading out under the curtain, and the lamplighter heard through the window
 * early in the Prologue.
 */

import { useEffect, useRef } from 'react';
import { audioManager } from '../services/AudioManager';

interface UseAudioArgs {
  location: string;
  weatherCondition: string | undefined;
  currentAct: number;
  /** Commands the player has entered this session. */
  playerTurns: number;
  /** The act's closing beat is on screen (an act transition is pending). */
  isActClosing: boolean;
  isCurtainPlaying: boolean;
  soundEffects: boolean;
  ambientAudio: boolean;
}

export function useAudio({
  location, weatherCondition, currentAct, playerTurns, isActClosing, isCurtainPlaying, soundEffects, ambientAudio,
}: UseAudioArgs): void {
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
    if (!isActClosing && !isCurtainPlaying) audioManager.setAmbient(location, weatherCondition, currentAct);
  }, [soundEffects, ambientAudio, location, weatherCondition, currentAct, isActClosing, isCurtainPlaying]);

  // The act closing: the bed sinks under its last lines, then fades out under
  // the curtain; the next act's bed fades in when Watson arrives.
  useEffect(() => {
    if (isCurtainPlaying) audioManager.fadeOutAmbient(3000);
    else if (isActClosing) audioManager.dipBed();
  }, [isActClosing, isCurtainPlaying]);

  // The lamplighter, once, a little way into the Prologue at Baker Street —
  // dusk arriving in the street below. Presentation only: nothing is saved.
  const lamplighterPlayed = useRef(false);
  useEffect(() => {
    if (lamplighterPlayed.current || currentAct !== 0 || location !== 'baker_street' || playerTurns < 2) return;
    lamplighterPlayed.current = true;
    audioManager.playSfx('lamplighter', 250);
  }, [currentAct, location, playerTurns]);
}
