/**
 * components/DiaryModal.tsx
 *
 * Watson's casebook. A browsable, read-only record of the important events the
 * engine auto-captures (clue discoveries, act milestones, major decisions),
 * grouped by act. Acts behave as an accordion — exactly one is open, defaulting
 * to the current act; earlier acts collapse.
 *
 * Each act header shows a progress pill: the current act displays "leads" as
 * pips (its ACT_PROGRESSION gate — every action needed to advance), and finished
 * acts read as Complete. Entries store only a reference; the Watson-voiced text
 * is resolved from authored story data via resolveDiaryEntry(). Built entirely
 * from lb-* theme tokens so it adapts to light/dark mode.
 */

import React, { useEffect, useState } from 'react';
import { X, BookOpen, Search, Gavel, MessageSquare, Feather, MapPin, ChevronDown, Check, type LucideIcon } from 'lucide-react';
import type { DiaryEntry } from '../types';
import { resolveDiaryEntry, ACT_NAMES, ACT_PROGRESSION } from '../engine/gameData';

interface DiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: DiaryEntry[];
  currentAct: number;
  flags: Record<string, boolean>;
  newEntryIds?: Set<string>;
}

const KIND_ICON: Record<DiaryEntry['kind'], LucideIcon> = {
  clue: Search,
  act: Feather,
  decision: Gavel,
  revelation: MessageSquare,
  location: MapPin,
};

const actLabel = (act: number): string => {
  const name = ACT_NAMES[act];
  if (act === 0) return name || 'Prologue';
  return name ? `Act ${act} — ${name}` : `Act ${act}`;
};

/**
 * Per-act progress = the act's advancement gate (ACT_PROGRESSION.requireFlags) —
 * every action needed to push the story forward. Sentinel flags (Act 5's
 * deduction gate, prefixed `__`) are excluded; acts with no real gate flags
 * return null (no pill). Returns how many of those flags are currently set.
 */
const actLeads = (
  actNumber: number,
  flags: Record<string, boolean>,
): { found: number; total: number } | null => {
  const gate = ACT_PROGRESSION[actNumber];
  if (!gate) return null;
  const real = gate.requireFlags.filter(f => !f.startsWith('__'));
  if (real.length === 0) return null;
  return { found: real.filter(f => flags[f]).length, total: real.length };
};

export const DiaryModal: React.FC<DiaryModalProps> = ({ isOpen, onClose, entries, currentAct, flags, newEntryIds }) => {
  // Accordion: exactly one act open at a time; defaults to the current act.
  const [openAct, setOpenAct] = useState<number | null>(null);

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

  // Open the current act each time the diary is opened.
  useEffect(() => {
    if (isOpen) setOpenAct(currentAct);
  }, [isOpen, currentAct]);

  if (!isOpen) return null;

  // Group by act, newest-first within each act, acts in descending order.
  const byAct = new Map<number, DiaryEntry[]>();
  for (const e of entries) {
    const list = byAct.get(e.actNumber) ?? [];
    list.push(e);
    byAct.set(e.actNumber, list);
  }
  const actNumbers = Array.from(byAct.keys()).sort((a, b) => b - a);

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

        {/* Entries — scroll region with a soft bottom fade cueing more content */}
        <div className="relative flex-1 min-h-0 flex">
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {actNumbers.length === 0 ? (
              <p className="text-sm text-lb-muted font-serif italic py-8 text-center">
                Watson has yet to commit anything to his diary.
              </p>
            ) : (
              actNumbers.map(act => {
                const expanded = openAct === act;
                const actEntries = [...byAct.get(act)!].sort((a, b) => b.sequence - a.sequence);
                const leads = actLeads(act, flags);
                const complete = act < currentAct || (leads != null && leads.found >= leads.total);
                return (
                  <div key={act}>
                    <button
                      onClick={() => setOpenAct(prev => (prev === act ? null : act))}
                      className="sticky top-0 z-10 w-full flex items-center justify-between gap-3 py-3 bg-lb-paper text-left"
                    >
                      <span className={`flex-1 min-w-0 uppercase tracking-widest text-xs font-bold ${act === currentAct ? 'text-lb-accent' : 'text-lb-muted'}`}>
                        {actLabel(act)}
                        {act === currentAct && <span className="ml-2 normal-case tracking-normal text-[10px] opacity-70">· current</span>}
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        {complete ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-lb-accent/50 bg-lb-accent/10 text-lb-accent text-[11px] font-semibold">
                            <Check size={12} /> Complete
                          </span>
                        ) : leads ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-lb-accent/40 bg-lb-accent/10 text-lb-accent text-[11px] font-semibold"
                            title={`${leads.found} of ${leads.total} leads followed`}
                          >
                            <span className="flex items-center gap-1">
                              {Array.from({ length: leads.total }).map((_, i) => (
                                <span
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full border border-current ${i < leads.found ? 'bg-current' : ''}`}
                                />
                              ))}
                            </span>
                            <span className="text-[10px] tracking-wide">leads</span>
                          </span>
                        ) : null}
                        <ChevronDown
                          size={16}
                          className={`text-lb-muted transition-transform ${expanded ? '' : '-rotate-90'}`}
                        />
                      </span>
                    </button>

                    {expanded && (
                      <div className="space-y-3 pt-1 pb-5">
                        {actEntries.map(entry => {
                          const resolved = resolveDiaryEntry(entry);
                          if (!resolved) return null;
                          const Icon = KIND_ICON[entry.kind];
                          const isReflection = entry.kind === 'act';
                          const isNew = newEntryIds?.has(entry.id) ?? false;
                          return (
                            <div key={entry.id} className="flex gap-3">
                              <Icon size={16} className="text-lb-accent mt-1 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-baseline justify-between gap-3">
                                  <p className={`text-sm text-lb-primary flex items-center flex-wrap gap-x-2 ${isReflection ? 'font-sans italic font-semibold' : 'font-semibold'}`}>
                                    <span>{resolved.title}</span>
                                    {entry.isLead && (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-lb-accent/50 bg-lb-accent/10 text-lb-accent text-[9px] font-bold tracking-wider uppercase">
                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />Lead
                                      </span>
                                    )}
                                    {isNew && (
                                      <span className="text-lb-accent text-xs font-bold italic" title="New since you last opened your diary">New</span>
                                    )}
                                  </p>
                                  {entry.timeLabel && (
                                    <span className="shrink-0 text-[11px] text-lb-muted tabular-nums">{entry.timeLabel}</span>
                                  )}
                                </div>
                                {resolved.body && (
                                  isReflection ? (
                                    <p className="mt-1.5 border-l-2 border-lb-accent/45 pl-3.5 font-sans italic text-sm text-lb-primary/90 leading-relaxed">
                                      {resolved.body}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-sm font-sans text-lb-primary/90 leading-relaxed">
                                      {resolved.body}
                                    </p>
                                  )
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-lb-paper to-transparent rounded-b-xl" />
        </div>
      </div>
    </div>
  );
};
