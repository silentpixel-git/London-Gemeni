/**
 * services/AudioManager.ts
 *
 * Framework-agnostic audio layer on the Web Audio API. A single instance owns
 * the AudioContext, gates playback on the user's settings, and cross-fades
 * ambient beds. It is pure presentation — it never reads or writes game state
 * or the engine.
 *
 * Two independent layers:
 *   - SFX: fire-and-forget one-shots, decoded once and played from game-event
 *     emission points.
 *   - Ambient: a looping location "bed" plus an optional weather layer on top,
 *     both cross-faded on change. Each streams from an <audio> element through
 *     its own GainNode, so a long file is never decoded whole and fades are
 *     gain ramps (an element's own volume is read-only on iOS).
 */

import { AMBIENT_BEDS, WEATHER_LAYERS, SFX_FILES, SFX_TRIM, type SfxId } from './audioManifest';

const FADE_S = 1.2;
// The Act 0 prototype's mix: beds well under the prose, one-shots at about half
// the bed (docs/audio-prompts.md).
const BED_VOLUME = 0.35;
const SFX_VOLUME = BED_VOLUME * 0.5;

/** A looping layer: a streamed <audio> element through its own gain. */
interface Layer { key: string; el: HTMLAudioElement; gain: GainNode }

class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxEnabled = false;
  private ambientEnabled = false;
  private sfxBuffers = new Map<SfxId, Promise<AudioBuffer>>();
  private bed: Layer | null = null;
  private weather: Layer | null = null;

  /** Made on first use; one made before the first gesture starts suspended until unlock(). */
  private context(): AudioContext {
    return (this.ctx ??= new AudioContext());
  }

  /** Call on the first user gesture to satisfy browser autoplay policy. */
  unlock(): void {
    const ctx = this.context();
    if (ctx.state === 'suspended') void ctx.resume();
    // A bed started before the first gesture (ambient remembered as on) was refused: start it now.
    for (const layer of [this.bed, this.weather]) if (layer?.el.paused) void layer.el.play().catch(() => {});
  }

  setEnabled({ sfx, ambient }: { sfx: boolean; ambient: boolean }): void {
    this.sfxEnabled = sfx;
    this.ambientEnabled = ambient;
    if (!ambient) this.stopAmbient();
  }

  /** Play a one-shot, optionally after a delay so it lands with the prose it belongs to. */
  playSfx(id: SfxId, delayMs = 0): void {
    if (delayMs > 0) { window.setTimeout(() => this.playSfx(id), delayMs); return; }
    const file = SFX_FILES[id];
    // Before the first gesture a one-shot would wait in the suspended context and land late: drop it.
    if (!this.sfxEnabled || !file || this.ctx?.state !== 'running') return;
    const ctx = this.ctx;
    let buffer = this.sfxBuffers.get(id);
    if (!buffer) {
      buffer = fetch(file).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b));
      this.sfxBuffers.set(id, buffer);
    }
    buffer.then(buf => {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = SFX_VOLUME * (SFX_TRIM[id] ?? 1);
      source.connect(gain).connect(ctx.destination);
      source.start();
    }).catch(() => this.sfxBuffers.delete(id));
  }

  /** Cross-fade to the bed and weather layer the Story names (PlayerView.ambience). An unknown or null id is silent. */
  setAmbient(bed: string | null, weather: string | null): void {
    if (!this.ambientEnabled) return;
    const file = bed ? AMBIENT_BEDS[bed] : undefined;
    this.bed = this.swap(this.bed, file ? { key: file, file, volume: BED_VOLUME } : null);
    const layer = weather ? WEATHER_LAYERS[weather] : undefined;
    // `volume` lets one file serve several intensities, so it is part of the key.
    this.weather = this.swap(this.weather, layer ? { key: `${weather}:${layer.volume}`, ...layer } : null);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private swap(current: Layer | null, next: { key: string; file: string; volume: number } | null): Layer | null {
    if (next && current?.key === next.key) {
      // Same layer: restore its level after a dip or a curtain fade.
      this.ramp(current.gain, next.volume);
      return current;
    }
    if (current) this.fadeOut(current);
    return next ? this.fadeIn(next.key, next.file, next.volume) : null;
  }

  private stopAmbient(): void {
    if (this.bed) this.fadeOut(this.bed);
    if (this.weather) this.fadeOut(this.weather);
    this.bed = this.weather = null;
  }

  private fadeIn(key: string, file: string, volume: number): Layer {
    const ctx = this.context();
    const el = new Audio(file);
    el.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    void el.play().catch(() => {}); // refused before the first gesture; unlock() retries
    this.ramp(gain, volume);
    return { key, el, gain };
  }

  private fadeOut(layer: Layer): void {
    this.ramp(layer.gain, 0);
    window.setTimeout(() => { layer.el.pause(); layer.gain.disconnect(); }, FADE_S * 1000);
  }

  private ramp(gain: GainNode, to: number): void {
    const now = this.context().currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + FADE_S);
  }
}

export const audioManager = new AudioManager();
