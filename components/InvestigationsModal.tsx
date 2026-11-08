/**
 * components/InvestigationsModal.tsx
 *
 * Lists the player's named investigations (each an event log on the server),
 * lets them open, delete (with inline confirm) or begin a new one.
 * When `canClose` is false no investigation is open yet, so the modal
 * cannot be dismissed.
 */

import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X, Play, Trash2, Clock } from 'lucide-react';
import type { InvestigationSummary } from '../services/InvestigationRepository';
import { ModalBackdrop } from './ModalBackdrop';
import { overlayPresence, zoomFadeVariants } from './motionTokens';

interface InvestigationsModalProps {
  isOpen: boolean;
  investigations: InvestigationSummary[];
  activeId: string | null;
  isGuest: boolean;
  /** False when no investigation is open yet: the modal cannot be dismissed. */
  canClose: boolean;
  isBusy?: boolean;
  onOpen: (id: string) => void;
  onStart: (name: string) => void;
  onDelete: (id: string) => void;
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

export const InvestigationsModal: React.FC<InvestigationsModalProps> = ({
  isOpen,
  investigations,
  activeId,
  isGuest,
  canClose,
  isBusy = false,
  onOpen,
  onStart,
  onDelete,
  onClose,
}) => {
  const reducedMotion = useReducedMotion();
  const headingId = useId();
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [name, setName] = useState('');

  const defaultName = `Investigation ${investigations.length + 1}`;

  // Lock body scroll; ESC to close (only when dismissible)
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canClose) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, canClose, onClose]);

  // Reset transient state and prefill the name each time the modal opens
  useEffect(() => {
    if (!isOpen) {
      setConfirmingDelete(null);
      return;
    }
    setName(defaultName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || isBusy) return;
    onStart(trimmed);
  };

  const tryClose = () => {
    if (canClose) onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div {...overlayPresence} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={tryClose}>
          <ModalBackdrop />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            variants={zoomFadeVariants(reducedMotion)}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-lb-paper border border-lb-border rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {canClose && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-bg rounded-md pressable pressable-icon"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            )}

            <div className="p-6 sm:p-8">
              <h2 id={headingId} className="text-2xl font-bold text-lb-primary tracking-tight">Investigations</h2>
              <p className="text-sm text-lb-muted mt-1">
                {investigations.length === 0
                  ? 'No investigations yet.'
                  : 'Choose an investigation to continue, or begin anew.'}
              </p>

              {investigations.length > 0 && (
                <ul className="mt-6 space-y-3">
                  {investigations.map(inv => {
                    const isActive = inv.id === activeId;
                    const isConfirming = confirmingDelete === inv.id;
                    return (
                      <li
                        key={inv.id}
                        className={`w-full flex items-center gap-4 px-4 py-4 border rounded-lg bg-lb-bg/50 ${isActive ? 'border-lb-accent' : 'border-lb-border'}`}
                      >
                        <button
                          onClick={() => onOpen(inv.id)}
                          disabled={isBusy}
                          className="flex-1 min-w-0 text-left disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-bold text-lb-primary truncate">{inv.name}</span>
                            {isActive && (
                              <span className="text-[10px] uppercase tracking-widest font-bold text-lb-accent shrink-0">Current</span>
                            )}
                          </span>
                          <span className="flex items-center gap-1 mt-0.5 text-[11px] text-lb-muted">
                            <Clock size={11} /> Last played {formatLastPlayed(inv.updatedAt)}
                          </span>
                        </button>

                        {isConfirming ? (
                          <div className="flex items-center gap-2 shrink-0 animate-in fade-in duration-150">
                            <span className="text-xs text-lb-muted">Delete?</span>
                            <button
                              onClick={() => { onDelete(inv.id); setConfirmingDelete(null); }}
                              disabled={isBusy}
                              className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 pressable disabled:opacity-50"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingDelete(null)}
                              className="px-2.5 py-1.5 border border-lb-border text-lb-primary text-xs font-semibold rounded hover:bg-lb-bg pressable"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
                            <button
                              onClick={() => onOpen(inv.id)}
                              disabled={isBusy}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-lb-primary text-lb-bg text-xs font-bold rounded hover:bg-lb-accent pressable disabled:opacity-50"
                            >
                              <Play size={13} /> Open
                            </button>
                            <button
                              onClick={() => setConfirmingDelete(inv.id)}
                              disabled={isBusy}
                              className="p-1.5 text-lb-muted hover:text-red-600 hover:bg-red-50 rounded pressable pressable-icon disabled:opacity-50"
                              aria-label={`Delete ${inv.name}`}
                              title="Delete investigation"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {isGuest && (
                <p className="mt-4 text-xs text-lb-muted">
                  Playing as a guest. Sign in from the menu to keep these investigations on any device.
                </p>
              )}

              <form
                className="mt-6 flex items-center gap-2"
                onSubmit={e => { e.preventDefault(); submit(); }}
              >
                <label htmlFor={`${headingId}-name`} className="sr-only">New investigation name</label>
                <input
                  id={`${headingId}-name`}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={80}
                  autoComplete="off"
                  className="flex-1 min-w-0 px-3 py-2 bg-lb-bg border border-lb-border rounded-lg text-sm text-lb-primary placeholder:text-lb-muted focus:outline-none focus:border-lb-accent"
                />
                <button
                  type="submit"
                  disabled={isBusy || !name.trim()}
                  className="px-4 py-2 bg-lb-primary text-lb-bg rounded-lg text-sm font-bold tracking-widest uppercase hover:bg-lb-accent pressable disabled:opacity-50"
                >
                  Begin
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
