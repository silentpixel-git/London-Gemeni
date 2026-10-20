/**
 * components/DiaryModal.tsx
 *
 * Watson's diary — the frame and motion of the Act 0 prototype
 * (docs/act0-prototype.html, docs/diary-design.md) over today's data:
 *
 *  - Spine: "Watson's Diary", a guarded "Private / J. H. Watson, M.D." line,
 *    and vertical tabs with a count line and an amber dot for anything new.
 *    On mobile the spine becomes a title row and a horizontal tab ribbon.
 *  - Panels share one grid cell; a tab change is a direction-aware crossfade
 *    (interruptible CSS transitions), keyboard switches are instant, and on
 *    touch a horizontal swipe follows the finger.
 *  - Desktop: a fixed-size card. Mobile: a bottom sheet that sizes to the
 *    active panel (capped at 86vh), eases between heights, and closes on a
 *    downward drag of its handle.
 *
 *  - Journal: the act accordion of captured entries (clues, decisions, the
 *    act's closing reflection). Entries store only a reference; the
 *    Watson-voiced text is resolved from story data via resolveDiaryEntry().
 *  - Evidence: discovered clues.
 *  - Persons: the suspect ledger mirroring the engine's NOTEBOOK verb.
 *  - Documents: papers Watson has filed, verbatim.
 *
 * Read-only throughout. Built from lb-* theme tokens so it adapts to every palette.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X, ChevronDown } from 'lucide-react';
import { ModalBackdrop } from './ModalBackdrop';
import { overlayPresence, DUR_EXIT, EASE_OUT_EXPO, EASE_OUT_QUINT, EASE_DRAWER } from './motionTokens';
import type { DiaryEntry } from '../types';
import { resolveDiaryEntry, ACT_NAMES, CLUE_DEFINITIONS, LOCATIONS, PERSONS_OF_INTEREST, TAKEABLE_OBJECTS, DOCUMENT_TEXT, DOCUMENT_OBJECT_IDS } from '../engine/gameData';

export type DiaryTab = 'journal' | 'evidence' | 'persons' | 'documents';

interface DiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: DiaryEntry[];
  currentAct: number;
  flags: Record<string, boolean>;
  inventory: string[];
  newEntryIds?: Set<string>;
  /** Tabs with something added since the diary was last opened. */
  newTabs?: Set<DiaryTab>;
}

const TABS: { id: DiaryTab; label: string }[] = [
  { id: 'journal',   label: 'Journal' },
  { id: 'evidence',  label: 'Evidence' },
  { id: 'persons',   label: 'Persons' },
  { id: 'documents', label: 'Documents' },
];

const MOBILE_QUERY = '(max-width: 639px)';
const VELOCITY = 0.11; // px per ms — a flick commits a swipe or closes the sheet

// Location-arrival entries are no longer written; older saves may still hold some.
const journalEntries = (entries: DiaryEntry[]) => entries.filter(e => e.kind !== 'location');
const clueEntries = (entries: DiaryEntry[]) => entries.filter(e => e.kind === 'clue' && CLUE_DEFINITIONS[e.refId]);
const visiblePersons = (flags: Record<string, boolean>) => PERSONS_OF_INTEREST.filter(p => !p.requiresFlag || flags[p.requiresFlag]);
const filedDocuments = (flags: Record<string, boolean>) => DOCUMENT_OBJECT_IDS.filter(id => flags[`filed_${id}`]);

/** How many items each tab holds — App compares these across visits for the tabs' new-dots. */
export const diaryTabTotals = (entries: DiaryEntry[], flags: Record<string, boolean>): Record<DiaryTab, number> => ({
  journal: journalEntries(entries).length,
  evidence: clueEntries(entries).length,
  persons: visiblePersons(flags).length,
  documents: filedDocuments(flags).length,
});

const plural = (n: number, one: string, many: string) => (n === 0 ? 'none yet' : `${n} ${n === 1 ? one : many}`);
/** "7:35 PM" → "7:35" for the journal's time tile. */
const shortTime = (label?: string) => (label ? label.replace(/\s*(AM|PM)$/i, '') : '—');

const KIND_LABEL: Record<DiaryEntry['kind'], string> = {
  clue: 'Clue',
  decision: 'Decision',
  revelation: 'Revelation',
  act: 'Reflection',
  location: 'Arrival',
};

const actLabel = (act: number): string => {
  const name = ACT_NAMES[act];
  if (act === 0) return name || 'Prologue';
  return name ? `Act ${act} — ${name}` : `Act ${act}`;
};

const NewDot: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`w-2 h-2 rounded-full bg-lb-accent shrink-0 ${className}`}><span className="sr-only">new</span></span>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="m-0 italic text-[15px] text-lb-primary/75">{children}</p>
);

// --- Panels ------------------------------------------------------------

const JournalPanel: React.FC<{
  entries: DiaryEntry[];
  currentAct: number;
  openAct: number | null;
  onToggleAct: (act: number) => void;
  newEntryIds?: Set<string>;
}> = ({ entries, currentAct, openAct, onToggleAct, newEntryIds }) => {
  const list = journalEntries(entries);
  if (list.length === 0) return <Empty>Watson has yet to commit anything to his diary.</Empty>;

  const byAct = new Map<number, DiaryEntry[]>();
  for (const e of list) byAct.set(e.actNumber, [...(byAct.get(e.actNumber) ?? []), e]);
  const acts = Array.from(byAct.keys()).sort((a, b) => b - a);
  let fresh = 0; // stagger index across the newly added entries

  return (
    <div className="flex flex-col gap-2">
      {acts.map(act => {
        const expanded = openAct === act;
        // Newest first, except the act's closing reflection, which always reads last.
        const actEntries = [...byAct.get(act)!].sort((a, b) => {
          if (a.kind === 'act' && b.kind !== 'act') return 1;
          if (b.kind === 'act' && a.kind !== 'act') return -1;
          return b.sequence - a.sequence;
        });
        return (
          <section key={act}>
            <button
              type="button"
              onClick={() => onToggleAct(act)}
              aria-expanded={expanded}
              className="w-full flex items-center justify-between gap-3 py-2 text-left"
            >
              <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${act === currentAct ? 'text-lb-accent' : 'text-lb-primary/60'}`}>
                {actLabel(act)}
              </span>
              <ChevronDown size={16} className={`text-lb-primary/50 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out-quint ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <ul className="list-none m-0 p-0 flex flex-col gap-3.5 pt-2 pb-4">
                  {actEntries.map(entry => {
                    const resolved = resolveDiaryEntry(entry);
                    if (!resolved) return null;
                    const isNew = newEntryIds?.has(entry.id) ?? false;
                    const stagger = isNew ? { className: 'lb-stagger', style: { '--i': fresh++ } as React.CSSProperties } : {};
                    if (entry.kind === 'act') {
                      return (
                        <li key={entry.id} {...stagger} className={`mt-1.5 pl-[18px] border-l-2 border-lb-muted/40 ${stagger.className ?? ''}`}>
                          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-lb-primary/60">
                            Reflection{isNew && <NewDot />}
                          </span>
                          <p className="mt-1.5 mb-0 font-playfair italic text-[18px] leading-relaxed text-lb-primary">{resolved.body}</p>
                          <span className="block text-right text-sm text-lb-primary/60 mt-1.5">— J. H. W.</span>
                        </li>
                      );
                    }
                    return (
                      <li key={entry.id} {...stagger} className={`grid grid-cols-[48px_minmax(0,1fr)] sm:grid-cols-[56px_minmax(0,1fr)] gap-x-3 sm:gap-x-4 items-start ${stagger.className ?? ''}`}>
                        <span className="relative grid place-items-center h-11 rounded-lg bg-lb-primary/[0.06] text-sm font-bold tabular-nums">
                          {shortTime(entry.timeLabel)}
                          {isNew && <NewDot className="absolute -top-[3px] -right-[3px] ring-2 ring-lb-paper" />}
                        </span>
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-lb-accent mt-0.5 mb-1">
                            {KIND_LABEL[entry.kind]}
                          </span>
                          <p className="m-0 font-serif text-[17px] leading-snug text-lb-primary">{resolved.title}</p>
                          {resolved.body && (
                            <p className="mt-1 mb-0 text-[15px] leading-relaxed text-lb-primary/85">{resolved.body}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};

const EvidencePanel: React.FC<{ entries: DiaryEntry[]; newEntryIds?: Set<string> }> = ({ entries, newEntryIds }) => {
  const clues = clueEntries(entries).sort((a, b) => b.sequence - a.sequence);
  if (clues.length === 0) return <Empty>Watson has found nothing he would call evidence yet.</Empty>;
  let fresh = 0;
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-3.5">
      {clues.map(entry => {
        const def = CLUE_DEFINITIONS[entry.refId];
        const where = LOCATIONS[def.locationFound]?.name ?? def.locationFound;
        const isNew = newEntryIds?.has(entry.id) ?? false;
        return (
          <li
            key={entry.id}
            className={`flex flex-col gap-1 pb-3.5 border-b border-lb-border last:border-b-0 ${isNew ? 'lb-stagger' : ''}`}
            style={isNew ? ({ '--i': fresh++ } as React.CSSProperties) : undefined}
          >
            <p className="m-0 font-serif text-[19px] text-lb-primary">{def.name}</p>
            <p className="m-0 text-[15px] leading-relaxed text-lb-primary/90">{def.diaryNote}</p>
            <p className="m-0 flex items-center gap-2 text-[13px] text-lb-primary/70">
              {isNew && <NewDot />}— {where}{entry.timeLabel && ` · ${entry.timeLabel}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
};

const PersonsPanel: React.FC<{ flags: Record<string, boolean> }> = ({ flags }) => {
  const visible = visiblePersons(flags);
  if (visible.length === 0) return <Empty>Watson has no names in his ledger yet.</Empty>;
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-3.5">
      {visible.map(p => {
        const cleared = Boolean(p.clearedByFlag && flags[p.clearedByFlag]);
        return (
          <li key={p.id} className="flex flex-col gap-1 pb-3.5 border-b border-lb-border last:border-b-0">
            <p className="m-0 font-serif text-[19px]">
              {cleared ? (
                <s className="text-lb-primary/55 decoration-lb-accent decoration-2">{p.label}</s>
              ) : (
                <span className="text-lb-primary">{p.label}</span>
              )}
            </p>
            <p className={`m-0 text-[15px] leading-relaxed ${cleared ? 'text-lb-primary/65' : 'text-lb-primary/90'}`}>
              {cleared && p.clearedNote ? p.clearedNote : p.detail}
            </p>
          </li>
        );
      })}
    </ul>
  );
};

/** One parsed line of a filed document's text. */
type DocLine =
  | { kind: 'body'; text: string }
  | { kind: 'label'; text: string }    // short *…* caption — date, attribution, signature
  | { kind: 'aside'; text: string };   // long *…* caption — Watson's own annotation

/**
 * Split a document's authored text into a provenance header (the leading
 * run of *…* caption lines — what the paper is, who took it, when) and the
 * lines that follow. Provenance renders as the source line under the title;
 * only a long caption later in the text is a true aside (Watson's voice).
 */
const parseDocumentText = (raw: string): { provenance: string[]; lines: DocLine[] } => {
  const provenance: string[] = [];
  const lines: DocLine[] = [];
  let inHeader = true;
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const caption = trimmed.match(/^\*(.+)\*$/);
    if (caption && inHeader) {
      provenance.push(caption[1]);
    } else if (caption) {
      lines.push(caption[1].length <= 70 ? { kind: 'label', text: caption[1] } : { kind: 'aside', text: caption[1] });
    } else {
      inHeader = false;
      lines.push({ kind: 'body', text: trimmed });
    }
  }
  return { provenance, lines };
};

/** "Watson's note: …" asides get a run-in label; anything else renders plain. */
const ASIDE_LABEL_RE = /^Watson's note:\s*/i;

/**
 * Filed once, kept forever — driven by the engine's `filed_<objectId>` flags,
 * not live inventory. NOTE on colors: secondary text avoids `text-lb-muted`,
 * which fails WCAG AA at body sizes against lb-paper; `text-lb-primary/70+` passes.
 */
const DocumentsPanel: React.FC<{ flags: Record<string, boolean>; inventory: string[] }> = ({ flags, inventory }) => {
  const docs = filedDocuments(flags).map(objectId => ({
    objectId,
    name: TAKEABLE_OBJECTS[objectId],
    carried: inventory.includes(TAKEABLE_OBJECTS[objectId]),
  }));
  if (docs.length === 0) return <Empty>No papers filed yet.</Empty>;
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-3.5">
      {docs.map(doc => {
        const { provenance, lines } = parseDocumentText(DOCUMENT_TEXT[doc.objectId]);
        const source = [...provenance, ...(doc.carried ? [] : ['filed'])].join(' · ');
        return (
          <li key={doc.objectId} className="flex flex-col gap-1 pb-3.5 border-b border-lb-border last:border-b-0">
            <p className="m-0 font-serif text-[19px] text-lb-primary">{doc.name}</p>
            {source && <p className="m-0 text-[13px] text-lb-primary/70">— {source}</p>}
            <div className="mt-2 flex flex-col gap-3">
              {lines.map((line, j) => {
                if (line.kind === 'body') {
                  return <p key={j} className="m-0 font-serif italic text-[16px] text-lb-primary/90 leading-relaxed">{line.text}</p>;
                }
                if (line.kind === 'label') {
                  return <p key={j} className="m-0 uppercase tracking-wider text-[10px] font-bold text-lb-primary/75">{line.text}</p>;
                }
                const noteText = line.text.replace(ASIDE_LABEL_RE, '');
                const hasLabel = noteText !== line.text;
                return (
                  <div key={j} className="bg-lb-accent/[0.12] rounded px-3.5 py-3 text-[14px] text-lb-primary/90 leading-relaxed">
                    {hasLabel && (
                      <span className="uppercase tracking-[0.07em] text-[11px] font-bold text-lb-primary mr-2">Watson's note</span>
                    )}
                    {noteText}
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

// --- Modal -------------------------------------------------------------

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

export const DiaryModal: React.FC<DiaryModalProps> = ({ isOpen, onClose, entries, currentAct, flags, inventory, newEntryIds, newTabs }) => {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [openAct, setOpenAct] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DiaryTab>('journal');
  const [sheetH, setSheetH] = useState<number | null>(null);
  const [animateHeight, setAnimateHeight] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Partial<Record<DiaryTab, HTMLDivElement | null>>>({});
  const tabRefs = useRef<Partial<Record<DiaryTab, HTMLButtonElement | null>>>({});
  const openerRef = useRef<HTMLElement | null>(null);
  const shownTab = useRef<DiaryTab>('journal');   // the panel currently in data-state="active"
  const nextInstant = useRef(true);               // the next panel change skips its animation
  const leaveTimer = useRef<number | undefined>(undefined);

  // Body scroll lock, Esc, and a focus trap. Focus goes into the dialog on open
  // and back to the opener on close. Keyed on isOpen only (onClose via a ref), so
  // parent re-renders never bounce focus while the diary is open.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.focus({ preventScroll: true });
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusable = [...cardRef.current.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]), [href], [tabindex="0"]')]
        .filter(el => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      const inside = cardRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKey);
      openerRef.current?.focus?.();
    };
  }, [isOpen]);

  // Every open lands on Journal with the current act unfolded, without animating there.
  useEffect(() => {
    if (!isOpen) return;
    setOpenAct(currentAct);
    nextInstant.current = true;
    setActiveTab('journal');
    setSheetH(null);
    setAnimateHeight(false);
  }, [isOpen, currentAct]);

  const selectTab = useCallback((tab: DiaryTab, instant = false) => {
    nextInstant.current = instant;
    setActiveTab(tab);
  }, []);

  // Panel states: the incoming panel slides in from the side of the tab it came from.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const prev = shownTab.current;
    const inn = panelRefs.current[activeTab];
    const out = panelRefs.current[prev];
    const instant = nextInstant.current || prev === activeTab;
    nextInstant.current = false;
    shownTab.current = activeTab;
    const set = (el: HTMLDivElement | null | undefined, state: string, vars: Record<string, string> = {}) => {
      if (!el) return;
      Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
      el.dataset.state = state;
    };
    TABS.forEach(t => { if (t.id !== activeTab && t.id !== prev) set(panelRefs.current[t.id], 'idle'); });
    if (instant || !inn || !out) {
      [out, inn].forEach(el => el?.classList.add('lb-no-anim'));
      if (prev !== activeTab) set(out, 'idle');
      set(inn, 'active');
      void inn?.offsetWidth;
      [out, inn].forEach(el => el?.classList.remove('lb-no-anim'));
      return;
    }
    const dir = TABS.findIndex(t => t.id === activeTab) > TABS.findIndex(t => t.id === prev) ? 1 : -1;
    const axis = isMobile ? 'X' : 'Y';
    inn.classList.add('lb-no-anim');
    set(inn, 'idle', { '--off': `translate${axis}(${12 * dir}px)` });
    void inn.offsetWidth;
    inn.classList.remove('lb-no-anim');
    set(out, 'leaving', { '--out': `translate${axis}(${-8 * dir}px)` });
    set(inn, 'active');
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => { if (out.dataset.state === 'leaving') set(out, 'idle'); }, 180);
  }, [activeTab, isOpen, isMobile]);

  // The sliding tab marker: a transform on one element, never a layout property.
  const moveIndicator = useCallback((instant: boolean) => {
    const ind = indRef.current, tab = tabRefs.current[activeTab];
    if (!ind || !tab) return;
    ind.classList.toggle('lb-instant', instant);
    ind.style.transform = isMobile
      ? `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth})`
      : `translateY(${tab.offsetTop}px) scaleY(${tab.offsetHeight})`;
    if (instant) { void ind.offsetWidth; ind.classList.remove('lb-instant'); }
  }, [activeTab, isMobile]);
  const indicatorPlaced = useRef(false);
  useLayoutEffect(() => {
    if (!isOpen) { indicatorPlaced.current = false; return; }
    moveIndicator(!indicatorPlaced.current);
    indicatorPlaced.current = true;
    if (isMobile) tabRefs.current[activeTab]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [isOpen, moveIndicator, isMobile, activeTab, reducedMotion]);

  // Mobile sheet height follows the active panel's content (capped at 86vh).
  // It is set before the sheet slides up, then eases between tabs.
  useLayoutEffect(() => {
    if (!isOpen || !isMobile) { setSheetH(null); return; }
    const panel = panelRefs.current[activeTab];
    const card = cardRef.current, spine = spineRef.current;
    if (!panel || !card || !spine) return;
    const fit = () => {
      const border = card.offsetHeight - card.clientHeight;
      const content = border + spine.offsetHeight + panel.scrollHeight;
      setSheetH(Math.round(Math.min(window.innerHeight * 0.86, Math.max(260, content))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (panel.firstElementChild) ro.observe(panel.firstElementChild);
    window.addEventListener('resize', fit);
    const raf = requestAnimationFrame(() => setAnimateHeight(true));
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); cancelAnimationFrame(raf); };
  }, [isOpen, isMobile, activeTab]);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  // Keyboard: the ARIA tabs pattern. Keyboard switches are instant.
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex(t => t.id === activeTab);
    let j = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % TABS.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = TABS.length - 1;
    if (j < 0) return;
    e.preventDefault();
    selectTab(TABS[j].id, true);
    tabRefs.current[TABS[j].id]?.focus();
  };

  // Swipe between tabs (touch): the panel follows the finger, commits on distance or velocity.
  const drag = useRef<{ id: number; x: number; y: number; t: number; axis: 'x' | 'y' | null; dx: number; el?: HTMLDivElement } | null>(null);
  const onPanelsDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || !e.isPrimary || drag.current) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), axis: null, dx: 0 };
  };
  const onPanelsMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (d.axis === 'y') { drag.current = null; return; } // let the panel scroll
      try { panelsRef.current?.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
      d.el = panelRefs.current[activeTab] ?? undefined;
      d.el?.classList.add('lb-dragging');
    }
    const i = TABS.findIndex(t => t.id === activeTab);
    const hasTarget = dx < 0 ? i < TABS.length - 1 : i > 0;
    d.dx = hasTarget ? dx : dx * 0.25; // rubber band at the ends
    if (d.el && !reducedMotion) {
      d.el.style.transform = `translateX(${d.dx}px)`;
      d.el.style.opacity = String(1 - Math.min(Math.abs(d.dx) / (panelsRef.current?.clientWidth || 1), 1) * 0.35);
    }
  };
  const onPanelsUp = (e: React.PointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.axis || !d.el) return;
    const width = panelsRef.current?.clientWidth || 1;
    const v = Math.abs(d.dx) / Math.max(1, performance.now() - d.t);
    const i = TABS.findIndex(t => t.id === activeTab) + (d.dx < 0 ? 1 : -1);
    const commit = !cancelled && i >= 0 && i < TABS.length && (Math.abs(d.dx) > width * 0.3 || v > VELOCITY);
    d.el.classList.remove('lb-dragging');
    d.el.style.transform = '';
    d.el.style.opacity = ''; // transitions from the dragged position
    if (commit) selectTab(TABS[i].id);
  };

  // Sheet handle (mobile): drag down to close, resistance when pulling up.
  const [sheetDrag, setSheetDrag] = useState<number | null>(null);
  const sheet = useRef<{ id: number; y: number; t: number; dy: number } | null>(null);
  const onGrabDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || sheet.current) return;
    sheet.current = { id: e.pointerId, y: e.clientY, t: performance.now(), dy: 0 };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    setSheetDrag(0);
  };
  const onGrabMove = (e: React.PointerEvent) => {
    const s = sheet.current;
    if (!s || e.pointerId !== s.id) return;
    const dy = e.clientY - s.y;
    s.dy = dy > 0 ? dy : dy * 0.2;
    setSheetDrag(s.dy);
  };
  const onGrabUp = (e: React.PointerEvent) => {
    const s = sheet.current;
    if (!s || e.pointerId !== s.id) return;
    sheet.current = null;
    setSheetDrag(null);
    const v = s.dy / Math.max(1, performance.now() - s.t);
    if (s.dy > (cardRef.current?.offsetHeight ?? 0) * 0.25 || v > VELOCITY) onClose();
  };

  // Open / close. Exits are faster than entrances; reduced motion keeps the fade only.
  const cardVariants = reducedMotion
    ? {
        visible: { opacity: 1, transition: { duration: 0.15 } },
        hidden: { opacity: 0, transition: { duration: DUR_EXIT } },
      }
    : isMobile
      ? {
          visible: { y: 0, transition: { duration: 0.38, ease: EASE_DRAWER } },
          hidden: { y: '100%', transition: { duration: 0.24, ease: EASE_OUT_QUINT } },
        }
      : {
          visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT_EXPO } },
          hidden: { opacity: 0, y: 10, transition: { duration: 0.18, ease: EASE_OUT_QUINT } },
        };

  const totals = diaryTabTotals(entries, flags);
  const persons = visiblePersons(flags);
  const cleared = persons.filter(p => p.clearedByFlag && flags[p.clearedByFlag]).length;
  const counts: Record<DiaryTab, string> = {
    journal: plural(totals.journal, 'entry', 'entries'),
    evidence: plural(totals.evidence, 'recorded', 'recorded'),
    persons: persons.length === 0 ? 'none yet' : `${cleared} cleared, ${persons.length - cleared} open`,
    documents: plural(totals.documents, 'filed', 'filed'),
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
          <motion.div variants={cardVariants} className="relative w-full sm:max-w-[780px]" onClick={e => e.stopPropagation()}>
            <div
              ref={cardRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="diary-title"
              tabIndex={-1}
              className={`relative grid grid-rows-[auto_minmax(0,1fr)] sm:grid-rows-1 sm:grid-cols-[200px_minmax(0,1fr)] overflow-hidden h-[86vh] max-h-[86vh] sm:h-[min(640px,86vh)] bg-lb-paper text-lb-primary border border-lb-border rounded-t-2xl sm:rounded-xl shadow-2xl focus:outline-none ${
                sheetDrag !== null ? '' : animateHeight && !reducedMotion ? 'transition-[height,transform] [transition-duration:320ms] ease-drawer' : 'transition-transform [transition-duration:320ms] ease-drawer'
              }`}
              style={{
                ...(isMobile && sheetH !== null ? { height: sheetH } : {}),
                ...(sheetDrag !== null ? { transform: `translateY(${sheetDrag}px)` } : {}),
              }}
            >
              {/* Grab handle (mobile) */}
              <div
                className="sm:hidden absolute top-0 inset-x-0 h-[22px] z-10 touch-none cursor-grab"
                aria-hidden="true"
                onPointerDown={onGrabDown}
                onPointerMove={onGrabMove}
                onPointerUp={onGrabUp}
                onPointerCancel={onGrabUp}
              >
                <span className="absolute top-2 left-1/2 -ml-[18px] w-9 h-1 rounded-full bg-lb-muted/50" />
              </div>

              <button
                type="button"
                onClick={onClose}
                className="absolute top-3.5 right-3.5 z-20 w-10 h-10 grid place-items-center rounded-full border border-lb-primary/30 bg-lb-paper hover:border-lb-accent hover:text-lb-accent pressable pressable-icon"
                aria-label="Close the diary"
              >
                <X size={18} />
              </button>

              {/* Spine: title, guarded line, tabs */}
              <div
                ref={spineRef}
                className="flex flex-col gap-2.5 sm:gap-6 pt-[18px] sm:pt-7 sm:pb-6 min-w-0 bg-lb-primary/[0.04] border-b sm:border-b-0 sm:border-r border-lb-border"
              >
                <div className="flex flex-row sm:flex-col flex-wrap items-baseline sm:items-start gap-x-3 gap-y-2 pl-5 pr-16 sm:px-6">
                  <h2 id="diary-title" className="m-0 font-serif font-normal text-2xl sm:text-[28px] leading-[1.05]">Watson's Diary</h2>
                  <p className="m-0 flex flex-row sm:flex-col items-baseline sm:items-start gap-2 sm:gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-lb-primary/60">Private</span>
                    <em className="font-playfair text-sm text-lb-primary/70">J. H. Watson, M.D.</em>
                  </p>
                </div>
                <div
                  role="tablist"
                  aria-label="Diary sections"
                  aria-orientation={isMobile ? 'horizontal' : 'vertical'}
                  onKeyDown={onTabKey}
                  className="relative flex flex-row sm:flex-col overflow-x-auto sm:overflow-visible px-2 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {TABS.map(t => {
                    const selected = activeTab === t.id;
                    const isNewTab = newTabs?.has(t.id) ?? false;
                    return (
                      <button
                        key={t.id}
                        ref={el => { tabRefs.current[t.id] = el; }}
                        id={`diary-tab-${t.id}`}
                        role="tab"
                        type="button"
                        aria-selected={selected}
                        aria-controls={`diary-panel-${t.id}`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => selectTab(t.id)}
                        className={`relative shrink-0 text-left block sm:grid gap-0.5 px-[9px] pt-2.5 pb-3 sm:px-6 sm:py-3 transition-colors duration-200 hover:bg-lb-primary/[0.04] active:bg-lb-primary/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lb-accent ${
                          selected ? 'sm:bg-lb-paper' : ''
                        }`}
                      >
                        <span className={`text-[11px] font-bold uppercase tracking-[0.07em] sm:tracking-[0.16em] transition-colors duration-200 ${selected ? 'text-lb-primary' : 'text-lb-primary/55'}`}>
                          {t.label}
                          {isNewTab && <NewDot className="sm:hidden inline-block ml-1.5 align-[2px] w-[7px] h-[7px]" />}
                        </span>
                        <span className="hidden sm:block text-xs text-lb-primary/60 tabular-nums">{counts[t.id]}</span>
                        {isNewTab && <NewDot className="hidden sm:block absolute right-[18px] top-1/2 -mt-[3.5px] w-[7px] h-[7px]" />}
                      </button>
                    );
                  })}
                  <span
                    ref={indRef}
                    aria-hidden="true"
                    className="lb-tab-ind lb-instant absolute pointer-events-none bg-lb-accent origin-top-left left-0 bottom-0 h-0.5 w-px sm:bottom-auto sm:top-0 sm:h-px sm:w-[3px]"
                  />
                </div>
              </div>

              {/* Panels: one grid cell, so switching never resizes the desktop card */}
              <div
                ref={panelsRef}
                className="grid min-h-0 min-w-0 overflow-hidden touch-pan-y"
                onPointerDown={onPanelsDown}
                onPointerMove={onPanelsMove}
                onPointerUp={e => onPanelsUp(e, false)}
                onPointerCancel={e => onPanelsUp(e, true)}
              >
                {TABS.map(t => (
                  <div
                    key={t.id}
                    ref={el => { panelRefs.current[t.id] = el; }}
                    id={`diary-panel-${t.id}`}
                    role="tabpanel"
                    aria-labelledby={`diary-tab-${t.id}`}
                    className="lb-dpanel touch-pan-y"
                  >
                    <div className="px-5 pt-5 pb-[calc(28px+env(safe-area-inset-bottom,0px))] sm:pl-8 sm:pr-16 sm:pt-7 sm:pb-9">
                      {t.id === 'journal' && (
                        <JournalPanel
                          entries={entries}
                          currentAct={currentAct}
                          openAct={openAct}
                          onToggleAct={act => setOpenAct(prev => (prev === act ? null : act))}
                          newEntryIds={newEntryIds}
                        />
                      )}
                      {t.id === 'evidence' && <EvidencePanel entries={entries} newEntryIds={newEntryIds} />}
                      {t.id === 'persons' && <PersonsPanel flags={flags} />}
                      {t.id === 'documents' && <DocumentsPanel flags={flags} inventory={inventory} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
