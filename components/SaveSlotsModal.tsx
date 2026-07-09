/**
 * components/SaveSlotsModal.tsx
 *
 * Slot-select screen shown on login (and from the header's "Save Slots" item).
 * Each of the 5 slots is an independent investigation/playthrough.
 *
 *   - Filled slot:  act + location + last-played, with Resume / Delete.
 *   - Empty slot:   "Begin a New Investigation".
 *   - Continue:     one-click resume of the most-recently-played slot.
 *
 * Slots are a signed-in feature; this modal is only rendered for logged-in users.
 */

import React, { useEffect, useState } from 'react';
import { X, Play, Trash2, FileText, Clock } from 'lucide-react';
import type { Investigation } from '../types';
import { ACT_NAMES, LOCATIONS } from '../engine/gameData';

const SLOT_COUNT = 5;

interface SaveSlotsModalProps {
  isOpen: boolean;
  slots: Investigation[];
  onSelect: (investigation: Investigation) => void;
  onStartInSlot: (slotNumber: number) => void;
  onContinue: () => void;
  onDelete: (investigation: Investigation) => void;
  onClose: () => void;
}

const formatLastPlayed = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export const SaveSlotsModal: React.FC<SaveSlotsModalProps> = ({
  isOpen,
  slots,
  onSelect,
  onStartInSlot,
  onContinue,
  onDelete,
  onClose,
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Lock body scroll; ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) setConfirmingDelete(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const hasAnyGame = slots.length > 0;
  const bySlot = (n: number) => slots.find(s => s.saveSlot === n);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-lb-paper border border-lb-border rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-bg rounded-md transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-lb-primary tracking-tight">The Whitechapel Diaries</h2>
          <p className="text-sm text-lb-muted mt-1">Choose an investigation to continue, or begin anew.</p>

          {hasAnyGame && (
            <button
              onClick={onContinue}
              className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 bg-lb-primary text-lb-bg rounded-lg text-sm font-bold tracking-widest uppercase hover:bg-lb-accent transition-colors"
            >
              <Play size={16} /> Continue Last Investigation
            </button>
          )}

          <div className="mt-6 space-y-3">
            {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map(n => {
              const inv = bySlot(n);
              const slotLabel = `Slot ${n}`;

              if (!inv) {
                return (
                  <button
                    key={n}
                    onClick={() => onStartInSlot(n)}
                    className="w-full flex items-center gap-4 px-4 py-4 border border-dashed border-lb-border rounded-lg text-left hover:border-lb-accent hover:bg-lb-bg transition-colors group"
                  >
                    <span className="text-[10px] uppercase tracking-widest font-bold text-lb-muted w-12 shrink-0">{slotLabel}</span>
                    <span className="text-sm text-lb-muted group-hover:text-lb-accent font-medium">+ Begin a New Investigation</span>
                  </button>
                );
              }

              const actName = ACT_NAMES[(inv as any).currentAct] || `Act ${(inv as any).currentAct ?? 1}`;
              const locName = LOCATIONS[inv.currentLocation]?.name || inv.currentLocation;
              const isConfirming = confirmingDelete === inv.id;

              return (
                <div
                  key={n}
                  className="w-full flex items-center gap-4 px-4 py-4 border border-lb-border rounded-lg bg-lb-bg/50"
                >
                  <span className="text-[10px] uppercase tracking-widest font-bold text-lb-muted w-12 shrink-0">{slotLabel}</span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-lb-primary truncate">{actName}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5 text-[11px] text-lb-muted">
                      <span className="flex items-center gap-1"><FileText size={11} /> {locName}</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {formatLastPlayed(inv.updatedAt)}</span>
                    </div>
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { onDelete(inv); setConfirmingDelete(null); }}
                        className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(null)}
                        className="px-2.5 py-1.5 border border-lb-border text-lb-primary text-xs font-semibold rounded hover:bg-lb-bg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onSelect(inv)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-lb-primary text-lb-bg text-xs font-bold rounded hover:bg-lb-accent transition-colors"
                      >
                        <Play size={13} /> Resume
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(inv.id)}
                        className="p-1.5 text-lb-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        aria-label="Delete investigation"
                        title="Delete investigation"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
