import React, { useState, useRef, useEffect } from 'react';
import { Settings, Volume2, VolumeX, Palette } from 'lucide-react';

interface SettingsPanelProps {
  ambientSoundEnabled: boolean;
  sfxEnabled: boolean;
  timeThemeEnabled: boolean;
  onToggleAmbient: () => void;
  onToggleSfx: () => void;
  onToggleTimeTheme: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  ambientSoundEnabled,
  sfxEnabled,
  timeThemeEnabled,
  onToggleAmbient,
  onToggleSfx,
  onToggleTimeTheme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(o => !o)}
        className="p-2 text-lb-muted hover:text-lb-accent hover:bg-lb-primary/5 rounded-md transition-colors"
        title="Settings"
        aria-label="Settings"
      >
        <Settings size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-lb-paper border border-lb-border rounded-lg shadow-xl z-20 overflow-hidden">
          <div className="px-3 py-2 border-b border-lb-border">
            <p className="text-[10px] uppercase tracking-widest text-lb-muted font-bold">Settings</p>
          </div>
          <div className="p-2 space-y-1">
            <ToggleRow
              icon={ambientSoundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              label="Ambient Sound"
              checked={ambientSoundEnabled}
              onChange={onToggleAmbient}
            />
            <ToggleRow
              icon={sfxEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              label="Sound Effects"
              checked={sfxEnabled}
              onChange={onToggleSfx}
            />
            <ToggleRow
              icon={<Palette size={14} />}
              label="Time-Based Theme"
              subtitle="Colors shift with in-game time"
              checked={timeThemeEnabled}
              onChange={onToggleTimeTheme}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: () => void;
}> = ({ icon, label, subtitle, checked, onChange }) => (
  <button
    onClick={onChange}
    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
  >
    <span className="text-lb-muted">{icon}</span>
    <div className="flex-1 min-w-0">
      <span className="block">{label}</span>
      {subtitle && <span className="block text-[10px] text-lb-muted">{subtitle}</span>}
    </div>
    <div className={`w-8 h-4 rounded-full relative transition-colors ${checked ? 'bg-lb-accent' : 'bg-lb-border'}`}>
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </div>
  </button>
);
