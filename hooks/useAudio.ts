/**
 * hooks/useAudio.ts
 *
 * Thin bridge between what the player can see and the AudioManager singleton:
 * the one-time autoplay unlock, the ambient bed and weather layer the Story names, and
 * one-shot sounds for the latest turn's Events. Story-agnostic: a Story asks
 * for a sound with a Rule's `cue` Effect (a CuePlayed Event); a cue id is the
 * SFX id with underscores (`pages_riffle` → `pages-riffle`), and an id with no
 * file is silent. A few generic Events have their own sound.
 */

import { useEffect } from 'react';
import type { EventPayload } from '../packages/schema/index.js';
import { audioManager } from '../services/AudioManager';
import { SFX_FILES, type SfxId } from '../services/audioManifest';

interface UseAudioArgs {
  /** PlayerView.ambience: the sound ids the Story names. */
  bed: string | null;
  weather: string | null;
  /** The engine Events of the latest turn (empty after a resume, so nothing replays). */
  events: EventPayload[];
  soundEffects: boolean;
  ambientAudio: boolean;
}

const EVENT_SOUNDS: Partial<Record<EventPayload['kind'], SfxId>> = {
  ClueDiscovered: 'clue-discovered',
  Taken: 'item-pickup',
  ActEntered: 'act-bell',
};

function soundsFor(events: EventPayload[]): SfxId[] {
  const ids = new Set<SfxId>();
  for (const e of events) {
    const generic = EVENT_SOUNDS[e.kind];
    if (generic) ids.add(generic);
    if (e.kind === 'CuePlayed') {
      const id = e.sound.replace(/_/g, '-');
      if (id in SFX_FILES) ids.add(id as SfxId);
    }
  }
  return [...ids];
}

export function useAudio({ bed, weather, events, soundEffects, ambientAudio }: UseAudioArgs): void {
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
    soundsFor(events).forEach((id, i) => audioManager.playSfx(id, i * 400));
  }, [events]);
}
