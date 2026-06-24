import { Howl, Howler } from 'howler';
import { AMBIENT_MAP, WEATHER_MAP, SFX_MAP, SfxEvent } from './soundAssets';

class SoundManager {
  private ambientHowl: Howl | null = null;
  private weatherHowl: Howl | null = null;
  private currentAmbientKey = '';
  private currentWeatherKey = '';
  private ambientEnabled = false;
  private sfxEnabled = false;

  private static FADE_MS = 1500;

  setAmbientEnabled(on: boolean) {
    this.ambientEnabled = on;
    if (!on) this.stopAmbient();
  }

  setSfxEnabled(on: boolean) {
    this.sfxEnabled = on;
  }

  playAmbient(locationId: string, weatherCondition?: string) {
    if (!this.ambientEnabled) return;

    const ambientSrc = AMBIENT_MAP[locationId];
    if (ambientSrc && ambientSrc !== this.currentAmbientKey) {
      this.crossfade(this.ambientHowl, ambientSrc, (howl) => {
        this.ambientHowl = howl;
        this.currentAmbientKey = ambientSrc;
      });
    }

    const weatherSrc = weatherCondition ? WEATHER_MAP[weatherCondition] : undefined;
    const weatherKey = weatherSrc || '';
    if (weatherKey !== this.currentWeatherKey) {
      if (this.weatherHowl) {
        const old = this.weatherHowl;
        old.fade(old.volume(), 0, SoundManager.FADE_MS);
        old.once('fade', () => old.unload());
        this.weatherHowl = null;
      }
      if (weatherSrc) {
        const howl = new Howl({ src: [weatherSrc], loop: true, volume: 0 });
        howl.play();
        howl.fade(0, 0.3, SoundManager.FADE_MS);
        this.weatherHowl = howl;
      }
      this.currentWeatherKey = weatherKey;
    }
  }

  playSfx(event: SfxEvent) {
    if (!this.sfxEnabled) return;
    const src = SFX_MAP[event];
    if (src) new Howl({ src: [src], volume: 0.6 }).play();
  }

  stopAll() {
    this.stopAmbient();
    if (this.weatherHowl) { this.weatherHowl.unload(); this.weatherHowl = null; }
    this.currentAmbientKey = '';
    this.currentWeatherKey = '';
  }

  private stopAmbient() {
    if (this.ambientHowl) { this.ambientHowl.unload(); this.ambientHowl = null; }
    if (this.weatherHowl) { this.weatherHowl.unload(); this.weatherHowl = null; }
    this.currentAmbientKey = '';
    this.currentWeatherKey = '';
  }

  private crossfade(old: Howl | null, src: string, onReady: (h: Howl) => void) {
    if (old) {
      old.fade(old.volume(), 0, SoundManager.FADE_MS);
      old.once('fade', () => old.unload());
    }
    const howl = new Howl({ src: [src], loop: true, volume: 0 });
    howl.play();
    howl.fade(0, 0.5, SoundManager.FADE_MS);
    onReady(howl);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    Howler.mute(document.hidden);
  });
}

export const soundManager = new SoundManager();
