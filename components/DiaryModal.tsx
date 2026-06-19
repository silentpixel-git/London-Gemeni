/**
 * components/DiaryModal.tsx
 *
 * Watson's casebook. A browsable, read-only record of the important events the
 * engine auto-captures (clue discoveries, act milestones, major decisions),
 * grouped by act. The current act is expanded; earlier acts collapse.
 *
 * Entries store only a reference; the Watson-voiced text is resolved from
 * authored story data via resolveDiaryEntry(). Built entirely from lb-* theme
 * tokens so it adapts to light/dark mode.
 */

import React, { useEffect, useState } from 'react';
import { X, BookOpen, Search, Gavel, MessageSquare, Milestone, MapPin, ChevronDown, type LucideIcon } from 'lucide-react';
import type { DiaryEntry } from '../types';
import { resolveDiaryEntry, ACT_NAMES } from '../engine/gameData';

interface DiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: DiaryEntry[];
  currentAct: number;
}

const KIND_ICON: Record<DiaryEntry['kind'], LucideIcon> = {
  clue: Search,
  act: Milestone,
  decision: Gavel,
  revelation: MessageSquare,
  location: MapPin,
};

const actLabel = (act: number): string => {
  const name = ACT_NAMES[act];
  if (act === 0) return name || 'Prologue';
  return name ? `Act ${act} — ${name}` : `Act ${act}`;
};

export const DiaryModal: React.FC<DiaryModalProps> = ({ isOpen, onClose, entries, currentAct }) => {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  // Lock body scroll; ESC to close (mirrors SaveSlotsModal)
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

  if (!isOpen) return null;

  // Group by act, newest-first within each act, acts in descending order.
  const byAct = new Map<number, DiaryEntry[]>();
  for (const e of entries) {
    const list = byAct.get(e.actNumber) ?? [];
    list.push(e);
    byAct.set(e.actNumber, list);
  }
  const actNumbers = Array.from(byAct.keys()).sort((a, b) => b - a);

  const isCollapsed = (act: number) =>
    act === currentAct ? collapsed[act] === true : collapsed[act] !== false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-lb-primary/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-lb-paper border border-lb-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-lb-border">
          <div className="flex items-center gap-2 text-lb-accent">
            <BookOpen size={18} />
            <span className="font-serif text-lg font-bold text-lb-primary">Watson's Diary</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-bg rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {actNumbers.length === 0 ? (
            <p className="text-sm text-lb-muted font-serif italic py-8 text-center">
              Watson has yet to commit anything to his diary.
            </p>
          ) : (
            actNumbers.map(act => {
              const collapsedNow = isCollapsed(act);
              const actEntries = [...byAct.get(act)!].sort((a, b) => b.sequence - a.sequence);
              return (
                <div key={act} className="mb-5 last:mb-0">
                  <button
                    onClick={() => setCollapsed(c => ({ ...c, [act]: !collapsedNow }))}
                    className="w-full flex items-center justify-between gap-2 mb-2 group"
                  >
                    <span className={`uppercase tracking-widest text-xs font-bold ${act === currentAct ? 'text-lb-accent' : 'text-lb-muted'}`}>
                      {actLabel(act)}
                      {act === currentAct && <span className="ml-2 normal-case tracking-normal text-[10px] opacity-70">· current</span>}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-lb-muted transition-transform ${collapsedNow ? '-rotate-90' : ''}`}
                    />
                  </button>

                  {!collapsedNow && (
                    <div className="space-y-3">
                      {actEntries.map(entry => {
                        const resolved = resolveDiaryEntry(entry);
                        if (!resolved) return null;
                        const Icon = KIND_ICON[entry.kind];
                        return (
                          <div key={entry.id} className="flex gap-3">
                            <Icon size={16} className="text-lb-accent mt-1 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-lb-primary">{resolved.title}</p>
                              {resolved.body && (
                                <p className="mt-1 text-sm font-serif text-lb-primary/90 leading-relaxed">
                                  {resolved.body}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
