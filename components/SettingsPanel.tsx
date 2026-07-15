/**
 * components/SettingsPanel.tsx
 *
 * The shared body of the Settings menu: a single Appearance choice
 * (Light / Dark / Auto) plus the two sound toggles. Rendered inside the
 * profile dropdown's Settings sub-page (signed in) and inside the lone
 * gear popover (signed out), so both states drive the same controls.
 */

import React from 'react';
import { Sun, Moon, Clock, Volume2, Waves, type LucideIcon } from 'lucide-react';
import type { ThemeMode } from '../types';

interface SettingsPanelProps {
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  soundEffects: boolean;
  onToggleSound: () => void;
  ambientAudio: boolean;
  onToggleAmbient: () => void;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; caption: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', caption: 'parchment',   icon: Sun },
  { value: 'dark',  label: 'Dark',  caption: 'candlelit',   icon: Moon },
  { value: 'auto',  label: 'Auto',  caption: 'by the hour', icon: Clock },
];

const Toggle: React.FC<{ on: boolean; onClick: () => void; label: string }> = ({ on, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    role="switch"
    aria-checked={on}
    aria-label={label}
    className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ${on ? 'bg-lb-accent' : 'bg-lb-border'}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`}
    />
  </button>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  themeMode,
  onSetThemeMode,
  soundEffects,
  onToggleSound,
  ambientAudio,
  onToggleAmbient,
}) => (
  <div className="p-3">
    {/* Appearance */}
    <p className="px-1 pb-2 text-[10px] uppercase tracking-widest text-lb-muted font-bold">Appearance</p>
    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-lb-bg border border-lb-border">
      {THEME_OPTIONS.map(({ value, label, caption, icon: Icon }) => {
        const selected = themeMode === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSetThemeMode(value)}
            aria-pressed={selected}
            className={`flex flex-col items-center gap-1 py-2 rounded-md border pressable ${
              selected
                ? 'border-lb-accent bg-lb-paper text-lb-primary'
                : 'border-transparent text-lb-muted hover:text-lb-accent hover:bg-lb-paper/50'
            }`}
          >
            <Icon size={17} className={selected ? 'text-lb-accent' : ''} />
            <span className="text-[11px] font-bold leading-none">{label}</span>
            <span className="text-[9px] text-lb-muted leading-none">{caption}</span>
          </button>
        );
      })}
    </div>

    {/* Sound */}
    <p className="px-1 pt-4 pb-2 text-[10px] uppercase tracking-widest text-lb-muted font-bold">Sound</p>
    <div className="flex items-center justify-between gap-3 px-1 py-2">
      <span className="flex items-center gap-2 text-sm text-lb-primary">
        <Volume2 size={15} className="text-lb-muted" />
        <span className="font-medium">Sound effects</span>
      </span>
      <Toggle on={soundEffects} onClick={onToggleSound} label="Toggle sound effects" />
    </div>
    <div className="flex items-center justify-between gap-3 px-1 py-2">
      <span className="flex items-center gap-2 text-sm text-lb-primary">
        <Waves size={15} className="text-lb-muted" />
        <span className="font-medium">Ambient sound</span>
      </span>
      <Toggle on={ambientAudio} onClick={onToggleAmbient} label="Toggle ambient sound" />
    </div>
  </div>
);
