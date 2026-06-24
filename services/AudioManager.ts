/**
 * services/AudioManager.ts
 *
 * Framework-agnostic audio layer. A single instance owns every Howl, gates
 * playback on the user's settings, and cross-fades ambient beds. It is pure
 * presentation — it never reads or writes game state or the engine.
 *
 * Two independent layers:
 *   - SFX: fire-and-forget one-shots, played from game-event emission points.
 *   - Ambient: a looping location "bed" plus an optional weather layer on top,
 *     both cross-faded on change.
 */

import { Howl, Howler } from 'howler';
import { AMBIENT_BEDS, WEATHER_LAYERS, SFX_FILES, SfxId } from './audioManifest';

const FADE_MS = 1200;
const BED_VOLUME = 0.5;

class AudioManager {
  private sfxEnabled = false;
  private ambientEnabled = false;
  private unlocked = false;

  private sfxCache = new Map<SfxId, Howl>();

  private bed: Howl | null = null;
  private bedKey: string | null = null;

  private weather: Howl | null = null;
  private weatherKey: string | null = null;

  /** Call on the first user gesture to satisfy browser autoplay policy. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    const ctx = Howler.ctx;
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  setEnabled({ sfx, ambient }: { sfx: boolean; ambient: boolean }): void {
    this.sfxEnabled = sfx;
    this.ambientEnabled = ambient;
    if (!ambient) this.stopAmbient();
  }

  playSfx(id: SfxId): void {
    if (!this.sfxEnabled) return;
    const file = SFX_FILES[id];
    if (!file) return;
    let howl = this.sfxCache.get(id);
    if (!howl) {
      howl = new Howl({ src: [file], volume: 0.7, preload: true });
      this.sfxCache.set(id, howl);
    }
    howl.play();
  }

  /** Cross-fade to the bed + weather layer for the current location/weather. */
  setAmbient(locationId: string, weatherCondition: string | undefined): void {
    if (!this.ambientEnabled) return;
    this.setBed(locationId);
    this.setWeather(weatherCondition);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private setBed(locationId: string): void {
    const file = AMBIENT_BEDS[locationId];
    if (!file) { this.fadeOut(this.bed); this.bed = null; this.bedKey = null; return; }
    if (this.bedKey === locationId && this.bed) return; // already playing
    this.fadeOut(this.bed);
    this.bed = this.fadeIn(file, BED_VOLUME);
    this.bedKey = locationId;
  }

  private setWeather(condition: string | undefined): void {
    const layer = condition ? WEATHER_LAYERS[condition] : undefined;
    if (!layer) { this.fadeOut(this.weather); this.weather = null; this.weatherKey = null; return; }
    const key = `${condition}:${layer.volume}`;
    if (this.weatherKey === key && this.weather) return;
    this.fadeOut(this.weather);
    this.weather = this.fadeIn(layer.file, layer.volume);
    this.weatherKey = key;
  }

  private stopAmbient(): void {
    this.fadeOut(this.bed);     this.bed = null;     this.bedKey = null;
    this.fadeOut(this.weather); this.weather = null; this.weatherKey = null;
  }

  private fadeIn(file: string, volume: number): Howl {
    const howl = new Howl({ src: [file], loop: true, volume: 0, html5: true });
    howl.play();
    howl.fade(0, volume, FADE_MS);
    return howl;
  }

  private fadeOut(howl: Howl | null): void {
    if (!howl) return;
    howl.fade(howl.volume(), 0, FADE_MS);
    howl.once('fade', () => howl.stop());
  }
}

export const audioManager = new AudioManager();
