/**
 * components/DiaryModal.tsx
 *
 * Watson's casebook. A browsable, read-only record of the investigation,
 * organized into four tabs behind a desktop spine / mobile ribbon:
 *
 *  - Journal: the auto-captured act accordion (clue discoveries, act
 *    milestones, major decisions), unchanged from the diary's original form.
 *    Acts behave as an accordion — exactly one is open, defaulting to the
 *    current act; earlier acts collapse. Each act header shows a progress
 *    pill: the current act displays "leads" as pips (its ACT_PROGRESSION
 *    gate — every action needed to advance), and finished acts read as
 *    Complete. Entries store only a reference; the Watson-voiced text is
 *    resolved from authored story data via resolveDiaryEntry().
 *  - Evidence: a ledger of discovered clues.
 *  - Persons: a suspect ledger mirroring the engine's NOTEBOOK verb.
 *  - Documents: papers Watson is carrying, verbatim.
 *
 * Read-only throughout. Built entirely from lb-* theme tokens so it adapts
 * across all theme palettes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X, Search, Gavel, MessageSquare, Feather, MapPin, ChevronDown, Check, type LucideIcon } from 'lucide-react';
import { ModalBackdrop } from './ModalBackdrop';
import { Tooltip } from './Tooltip';
import { overlayPresence, zoomFadeVariants, DUR_PANEL, DUR_EXIT, EASE_OUT_EXPO } from './motionTokens';
import type { DiaryEntry } from '../types';
import { resolveDiaryEntry, ACT_NAMES, ACT_PROGRESSION } from '../engine/gameData';

interface DiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: DiaryEntry[];
  currentAct: number;
  flags: Record<string, boolean>;
  inventory: string[];
  newEntryIds?: Set<string>;
}

type DiaryTab = 'journal' | 'evidence' | 'persons' | 'documents';

const TABS: { id: DiaryTab; label: string }[] = [
  { id: 'journal',   label: 'Journal' },
  { id: 'evidence',  label: 'Evidence' },
  { id: 'persons',   label: 'Persons' },
  { id: 'documents', label: 'Documents' },
];

// --- Panel stubs -----------------------------------------------------------
// Placeholders only. Real implementations land in later tasks; do not build
// out Evidence/Persons/Documents logic here.
const EvidencePanel: React.FC<{ entries: DiaryEntry[] }> = () => null;
const PersonsPanel: React.FC<{ flags: Record<string, boolean> }> = () => null;
const DocumentsPanel: React.FC<{ inventory: string[] }> = () => null;

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

export const DiaryModal: React.FC<DiaryModalProps> = ({ isOpen, onClose, entries, currentAct, flags, inventory, newEntryIds }) => {
  const reducedMotion = useReducedMotion();
  // Accordion: exactly one act open at a time; defaults to the current act.
  const [openAct, setOpenAct] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DiaryTab>('journal');

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

  // Open the current act, and always land on Journal, each time the diary is opened.
  useEffect(() => {
    if (isOpen) {
      setOpenAct(currentAct);
      setActiveTab('journal');
    }
  }, [isOpen, currentAct]);

  // Swipe-down-to-close on the mobile bottom sheet — drag from the handle or
  // header follows the finger; releasing past the distance threshold OR with
  // a quick flick (velocity) closes, otherwise it snaps back.
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragStartTime = useRef(0);
  const handleDragStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 640) return;
    dragStartY.current = e.touches[0].clientY;
    dragStartTime.current = Date.now();
  };
  const handleDragMove = (e: React.TouchEvent) => {
    if (dragStartY.current == null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragY(dy);
  };
  const handleDragEnd = () => {
    if (dragStartY.current == null) return;
    dragStartY.current = null;
    const elapsed = Date.now() - dragStartTime.current;
    const velocity = elapsed > 0 ? dragY / elapsed : 0;
    if (dragY > 120 || (dragY > 20 && velocity > 0.11)) onClose();
    setDragY(0);
  };

  // Mobile: bottom sheet sliding from the screen edge, following the finger
  // while dragging (duration 0 = instant follow, then an animated snap-back).
  // Desktop (sm+): the standard modal card variants. Both are driven by the
  // overlayPresence wrapper's 'visible'/'hidden' variant state.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const sheetVariants = isMobile
    ? {
        visible: {
          ...(reducedMotion ? { opacity: 1 } : {}),
          y: dragY,
          transition: dragY > 0 ? { duration: 0 } : { duration: DUR_PANEL, ease: EASE_OUT_EXPO },
        },
        hidden: reducedMotion
          ? { opacity: 0, transition: { duration: DUR_EXIT } }
          : { y: '100%', transition: { duration: DUR_PANEL, ease: EASE_OUT_EXPO } },
      }
    : zoomFadeVariants(reducedMotion);

  // Group by act, newest-first within each act, acts in descending order.
  const byAct = new Map<number, DiaryEntry[]>();
  for (const e of entries) {
    const list = byAct.get(e.actNumber) ?? [];
    list.push(e);
    byAct.set(e.actNumber, list);
  }
  const actNumbers = Array.from(byAct.keys()).sort((a, b) => b - a);

  const tabCount = (tab: DiaryTab): string => {
    switch (tab) {
      case 'journal':   return `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
      case 'evidence':  return '';   // filled in a later task
      case 'persons':   return '';   // filled in a later task
      case 'documents': return '';   // filled in a later task
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...overlayPresence}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={onClose}
        >
          <ModalBackdrop />
          <motion.div
            variants={sheetVariants}
            className="relative w-full max-w-3xl max-h-[94dvh] sm:max-h-[88vh] flex flex-col bg-lb-paper border border-lb-border rounded-t-2xl sm:rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle (mobile bottom sheet) */}
            <div
              className="flex sm:hidden justify-center pt-2.5"
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <div className="w-10 h-1 rounded-full bg-lb-border" />
            </div>
            {/* Mobile header (drag target) */}
            <div
              className="flex sm:hidden items-center justify-between px-6 py-4 border-b border-lb-border"
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <span className="font-serif text-xl font-bold text-lb-primary">Watson's Diary</span>
              <button onClick={onClose} className="p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-bg rounded-md transition-colors" aria-label="Close">
                <X size={22} />
              </button>
            </div>

            {/* Mobile tab ribbon */}
            <div className="flex sm:hidden border-b border-lb-border overflow-x-auto" role="tablist">
              {TABS.map(t => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`shrink-0 px-4 py-3 uppercase tracking-widest text-[11px] font-bold border-b-2 -mb-px transition-colors ${
                    activeTab === t.id ? 'text-lb-accent border-lb-accent' : 'text-lb-muted border-transparent hover:text-lb-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Desktop spine */}
              <div className="hidden sm:flex w-44 shrink-0 flex-col border-r border-lb-border bg-lb-primary/[0.04] pt-6 pb-4">
                <div className="px-5 pb-5">
                  <h2 className="font-serif text-2xl font-bold leading-tight text-lb-primary">Watson's<br />Diary</h2>
                  <p className="mt-2 uppercase tracking-[0.2em] text-[10px] text-lb-muted">Whitechapel · 1888</p>
                </div>
                <div className="flex flex-col" role="tablist">
                  {TABS.map(t => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={activeTab === t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`text-left px-5 py-3 border-l-[3px] uppercase tracking-widest text-[11px] font-bold transition-colors ${
                        activeTab === t.id
                          ? 'text-lb-primary border-lb-accent bg-lb-paper'
                          : 'text-lb-muted border-transparent hover:text-lb-primary'
                      }`}
                    >
                      {t.label}
                      <span className="block normal-case tracking-normal font-normal text-[11px] opacity-70 mt-0.5">
                        {tabCount(t.id)}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-auto px-5 pt-4 text-[11px] italic text-lb-muted leading-relaxed">
                  What he notices here is his own affair.
                </p>
              </div>

              {/* Panel */}
              <div className="relative flex-1 min-h-0 flex flex-col">
                <button
                  onClick={onClose}
                  className="hidden sm:block absolute top-3 right-3 z-20 p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-bg rounded-md transition-colors"
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
                <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-5 sm:pt-6">
                  {activeTab === 'journal' && (
                    <>
                {actNumbers.length === 0 ? (
                  <p className="text-[15px] text-lb-muted font-serif italic py-8 text-center">
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
                          className="sticky top-0 z-10 w-full flex items-center justify-between gap-3 py-3.5 bg-lb-paper text-left"
                        >
                          <span className={`flex-1 min-w-0 uppercase tracking-widest text-[13px] font-bold ${act === currentAct ? 'text-lb-accent' : 'text-lb-muted'}`}>
                            {actLabel(act)}
                            {act === currentAct && <span className="ml-2 normal-case tracking-normal text-[11px] opacity-70">· current</span>}
                          </span>
                          <span className="flex items-center gap-3 shrink-0">
                            {complete ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-lb-accent/50 bg-lb-accent/10 text-lb-accent text-xs font-semibold">
                                <Check size={13} /> Complete
                              </span>
                            ) : leads ? (
                              <Tooltip label={`${leads.found} of ${leads.total} leads followed`}>
                                <span
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-lb-accent/40 bg-lb-accent/10 text-lb-accent text-xs font-semibold"
                                  aria-label={`${leads.found} of ${leads.total} leads followed`}
                                >
                                  <span className="flex items-center gap-1">
                                    {Array.from({ length: leads.total }).map((_, i) => (
                                      <span
                                        key={i}
                                        className={`w-2 h-2 rounded-full border border-current ${i < leads.found ? 'bg-current' : ''}`}
                                      />
                                    ))}
                                  </span>
                                  <span className="text-[11px] tracking-wide">leads</span>
                                </span>
                              </Tooltip>
                            ) : null}
                            <ChevronDown
                              size={18}
                              className={`text-lb-muted transition-transform ${expanded ? '' : '-rotate-90'}`}
                            />
                          </span>
                        </button>

                        <div
                          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          }`}
                        >
                          <div className="overflow-hidden">
                          <div className="space-y-5 pt-1 pb-6">
                            {actEntries.map(entry => {
                              const resolved = resolveDiaryEntry(entry);
                              if (!resolved) return null;
                              const Icon = KIND_ICON[entry.kind];
                              const isReflection = entry.kind === 'act';
                              const isNew = newEntryIds?.has(entry.id) ?? false;
                              return (
                                <div key={entry.id} className="flex gap-3.5">
                                  <Icon size={20} className="text-lb-accent mt-0.5 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-3">
                                      <p className={`text-base text-lb-primary flex items-center flex-wrap gap-x-2 ${isReflection ? 'font-sans italic font-semibold' : 'font-semibold'}`}>
                                        <span>{resolved.title}</span>
                                        {entry.isLead && (
                                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-lb-accent/50 bg-lb-accent/10 text-lb-accent text-[10px] font-bold tracking-wider uppercase">
                                            <span className="w-1.5 h-1.5 rounded-full bg-current" />Lead
                                          </span>
                                        )}
                                        {isNew && (
                                          <span className="text-lb-accent text-xs font-bold italic" title="New since you last opened your diary">New</span>
                                        )}
                                      </p>
                                      {entry.timeLabel && (
                                        <span className="shrink-0 text-xs text-lb-muted tabular-nums">{entry.timeLabel}</span>
                                      )}
                                    </div>
                                    {resolved.body && (
                                      isReflection ? (
                                        <p className="mt-2 border-l-2 border-lb-accent/45 pl-4 font-sans italic text-[15px] text-lb-primary/90 leading-relaxed">
                                          {resolved.body}
                                        </p>
                                      ) : (
                                        <p className="mt-1.5 text-[15px] font-sans text-lb-primary/90 leading-relaxed">
                                          {resolved.body}
                                        </p>
                                      )
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                    </>
                  )}
                  {activeTab === 'evidence' && <EvidencePanel entries={entries} />}
                  {activeTab === 'persons' && <PersonsPanel flags={flags} />}
                  {activeTab === 'documents' && <DocumentsPanel inventory={inventory} />}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-lb-paper to-transparent sm:rounded-b-xl" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
