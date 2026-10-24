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
import { AMBIENT_BEDS, ACT_BEDS, WEATHER_LAYERS, SFX_FILES, SFX_TRIM, SfxId } from './audioManifest';

const FADE_MS = 1200;
// The Act 0 prototype's mix: beds well under the prose, one-shots at about half
// the bed (docs/audio-prompts.md), and a dip as an act closes.
const BED_VOLUME = 0.35;
const BED_DIP = 0.2;
const SFX_VOLUME = BED_VOLUME * 0.5;

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

  /** Play a one-shot, optionally after a delay so it lands with the prose it belongs to. */
  playSfx(id: SfxId, delayMs = 0): void {
    if (delayMs > 0) { window.setTimeout(() => this.playSfx(id), delayMs); return; }
    if (!this.sfxEnabled) return;
    const file = SFX_FILES[id];
    if (!file) return;
    let howl = this.sfxCache.get(id);
    if (!howl) {
      howl = new Howl({ src: [file], volume: SFX_VOLUME * (SFX_TRIM[id] ?? 1), preload: true });
      this.sfxCache.set(id, howl);
    }
    howl.play();
  }

  /** The act is closing: let the bed sink under the last lines. */
  dipBed(): void {
    if (this.bed) this.bed.fade(this.bed.volume(), BED_DIP, 1500);
  }

  /** The curtain: the whole ambience fades to silence; the next act's bed fades in on arrival. */
  fadeOutAmbient(ms: number): void {
    for (const h of [this.bed, this.weather]) if (h) h.fade(h.volume(), 0, ms);
  }

  /** Cross-fade to the bed + weather layer for the current location/weather (and act). */
  setAmbient(locationId: string, weatherCondition: string | undefined, act?: number): void {
    if (!this.ambientEnabled) return;
    this.setBed(locationId, act);
    this.setWeather(weatherCondition);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private setBed(locationId: string, act?: number): void {
    const file = (act !== undefined ? ACT_BEDS[`${act}:${locationId}`] : undefined) ?? AMBIENT_BEDS[locationId];
    if (!file) { this.fadeOut(this.bed); this.bed = null; this.bedKey = null; return; }
    if (this.bedKey === file && this.bed) {
      // Same bed: restore its level after a dip or a curtain fade.
      if (this.bed.volume() < BED_VOLUME) this.bed.fade(this.bed.volume(), BED_VOLUME, FADE_MS);
      return;
    }
    this.fadeOut(this.bed);
    this.bed = this.fadeIn(file, BED_VOLUME);
    this.bedKey = file;
  }

  private setWeather(condition: string | undefined): void {
    const layer = condition ? WEATHER_LAYERS[condition] : undefined;
    if (!layer) { this.fadeOut(this.weather); this.weather = null; this.weatherKey = null; return; }
    const key = `${condition}:${layer.volume}`;
    if (this.weatherKey === key && this.weather) {
      if (this.weather.volume() < layer.volume) this.weather.fade(this.weather.volume(), layer.volume, FADE_MS);
      return;
    }
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
    // A bed started before the first gesture (ambient remembered as on) is
    // refused by the autoplay policy: Howler's documented retry is to play
    // again once it reports the audio unlocked.
    howl.once('playerror', () => howl.once('unlock', () => { howl.play(); howl.fade(0, volume, FADE_MS); }));
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
