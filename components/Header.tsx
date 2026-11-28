/**
 * components/Header.tsx
 *
 * Sticky top bar with:
 *   - Sidebar toggle
 *   - An Engine dot, shown only when the turn endpoint stopped answering
 *   - The diary button
 *   - One account menu: Sign In (guest) or the account (signed in), then
 *     Investigations and a Settings sub-page
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../services/GameRepository';
import {
  PanelLeftClose, PanelLeftOpen, User as UserIcon,
  ChevronDown, ChevronLeft, ChevronRight, FolderOpen, LogOut, LogIn, Pencil,
  Settings, BookOpenText,
} from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';
import { Tooltip } from './Tooltip';
import { zoomFade } from './motionTokens';
import type { Appearance } from '../hooks/gameState/useAppearance';

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Whether POST /api/turn answered the last request; null before the first. */
  engineOk: boolean | null;
  onOpenDiary: () => void;
  diaryUnreadCount: number;
  appearance: Appearance;
  /** null for a guest. */
  user: User | null;
  userProfile: UserProfile | null;
  /** The player's investigations: open one, start one, delete one. Every turn is saved as it happens. */
  onOpenInvestigations: () => void;
  onOpenAuth: () => void;
  onOpenEditProfile: () => void;
  onLogout: () => void;
}

/**
 * Two-page slide-over for the account menu (main page / settings sub-page).
 * The viewport height animates to match whichever page is showing, so the
 * closed menu never leaves empty space under a shorter page.
 */
const TwoPageDropdown: React.FC<{ page1: React.ReactNode; page2: React.ReactNode; showPage2: boolean }> = ({
  page1, page2, showPage2,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const target = showPage2 ? page2Ref.current : page1Ref.current;
    const viewport = viewportRef.current;
    if (!target || !viewport) return;
    const syncHeight = () => {
      viewport.style.height = `${target.offsetHeight}px`;
    };
    syncHeight();
    // The active page can grow after mount (e.g. the New Game inline
    // confirmation) — keep the viewport height in sync or it clips.
    const observer = new ResizeObserver(syncHeight);
    observer.observe(target);
    return () => observer.disconnect();
  }, [showPage2]);

  return (
    <div ref={viewportRef} className="overflow-hidden transition-[height] duration-300 ease-out">
      <div className={`flex w-[200%] items-start transition-transform duration-300 ease-out ${showPage2 ? '-translate-x-1/2' : ''}`}>
        <div ref={page1Ref} className="w-1/2">{page1}</div>
        <div ref={page2Ref} className="w-1/2">{page2}</div>
      </div>
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  engineOk,
  onOpenDiary,
  diaryUnreadCount,
  appearance,
  user,
  userProfile,
  onOpenInvestigations,
  onOpenAuth,
  onOpenEditProfile,
  onLogout,
}) => {
  const reducedMotion = useReducedMotion();
  // The diary badge pops (a small scale, never from zero) only when the count goes up.
  const badgeRef = useRef<HTMLSpanElement>(null);
  const lastBadge = useRef(diaryUnreadCount);
  useEffect(() => {
    if (diaryUnreadCount > lastBadge.current && !reducedMotion) {
      badgeRef.current?.animate([{ transform: 'scale(.85)' }, { transform: 'scale(1)' }], { duration: 160, easing: 'cubic-bezier(.23,1,.32,1)' });
    }
    lastBadge.current = diaryUnreadCount;
  }, [diaryUnreadCount, reducedMotion]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [settingsView, setSettingsView] = useState(false);
  // Wrapper around trigger + menu, for outside-press detection.
  const menuWrapRef = useRef<HTMLDivElement>(null);

  const displayName = userProfile?.displayName || user?.email;

  const closeMenu = () => {
    setIsMenuOpen(false);
    setSettingsView(false);
  };

  // Close the menu on any pointer press outside trigger + menu. (A fixed
  // inset-0 click-catcher doesn't work here: the header's backdrop-filter
  // makes it the containing block for fixed descendants, clipping the
  // catcher to the header strip.)
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuWrapRef.current?.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMenuOpen]);

  const hasNewDiaryEntries = diaryUnreadCount > 0;
  const diaryButton = (
    <Tooltip label="Read Watson's Diary">
      <button
        onClick={onOpenDiary}
        className="relative w-10 h-10 rounded-full border border-lb-primary/30 text-lb-primary flex items-center justify-center shrink-0 hover:border-lb-accent hover:text-lb-accent pressable pressable-icon"
        aria-label={hasNewDiaryEntries ? `Read Watson's Diary — ${diaryUnreadCount} new ${diaryUnreadCount === 1 ? 'entry' : 'entries'}` : "Read Watson's Diary"}
      >
        <BookOpenText size={18} />
        {hasNewDiaryEntries && (
          <span ref={badgeRef} className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-lb-accent text-lb-bg text-[10px] font-bold leading-none tabular-nums">
            {diaryUnreadCount > 9 ? '9+' : diaryUnreadCount}
          </span>
        )}
      </button>
    </Tooltip>
  );

  const menuItem = 'w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left';

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 px-4 py-3 desk:px-16 desk:py-4 flex items-center justify-between gap-3 bg-lb-bg/90 backdrop-blur-sm border-b border-lb-border">

      {/* Left — sidebar toggle + engine dot */}
      <div className="flex items-center gap-3 min-w-0" data-flip>
        <Tooltip label={isSidebarOpen ? 'Hide the panel' : 'Show the panel'}>
          <button
            onClick={onToggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-lb-primary/30 text-lb-primary hover:border-lb-accent hover:text-lb-accent shrink-0 pressable pressable-icon"
            aria-label={isSidebarOpen ? 'Hide the panel' : 'Show the panel'}
          >
            {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </Tooltip>

        {/* Shown only when the turn endpoint stopped answering. */}
        {engineOk === false && (
          <div className="flex items-center gap-1.5 min-w-0 px-3 py-1.5 bg-lb-paper/50 rounded-full border border-lb-border" title="Engine Disconnected">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[9px] uppercase tracking-widest text-lb-muted font-bold">Engine</span>
          </div>
        )}
      </div>

      {/* Right — diary + account menu */}
      <div className="flex items-center gap-3">
        {diaryButton}
        <div className="relative" ref={menuWrapRef}>
          <Tooltip label="Account">
            <button
              onClick={() => { setIsMenuOpen(o => !o); setSettingsView(false); }}
              className="flex items-center gap-2 text-lb-primary group pressable"
              aria-expanded={isMenuOpen}
              aria-label="Account menu"
            >
              <div className="w-10 h-10 rounded-full bg-lb-primary text-lb-bg dark:bg-lb-accent dark:text-white flex items-center justify-center shrink-0">
                {user ? <UserIcon size={18} /> : <LogIn size={18} />}
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </Tooltip>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                {...zoomFade(reducedMotion)}
                className="absolute right-0 top-full mt-2 origin-top-right w-56 bg-lb-paper border border-lb-border rounded-lg shadow-xl z-20 max-h-[80vh] overflow-y-auto"
              >
                <TwoPageDropdown
                  showPage2={settingsView}
                  page1={
                    <div className="p-1">
                      {user ? (
                        <>
                          <div className="px-3 py-2 border-b border-lb-border mb-1">
                            <p className="text-[10px] uppercase tracking-widest text-lb-muted font-bold">Signed In As</p>
                            <p className="text-xs font-medium text-lb-primary truncate">{displayName}</p>
                            <p className="text-[10px] text-lb-muted truncate">{user.email}</p>
                          </div>
                          <button onClick={() => { onOpenEditProfile(); closeMenu(); }} className={menuItem}>
                            <Pencil size={14} /><span>Edit Profile</span>
                          </button>
                        </>
                      ) : (
                        <div className="px-3 pt-2 pb-3 border-b border-lb-border mb-1">
                          <p className="text-[10px] uppercase tracking-widest text-lb-muted font-bold mb-2">Playing As Guest</p>
                          <button
                            onClick={() => { onOpenAuth(); closeMenu(); }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-lb-primary text-lb-bg dark:bg-lb-accent dark:text-white rounded-md text-xs font-bold tracking-widest uppercase hover:bg-lb-accent dark:hover:bg-lb-accent/80 pressable"
                          >
                            <LogIn size={14} /><span>Sign In</span>
                          </button>
                          <p className="mt-2 text-[10.5px] text-lb-muted text-center leading-snug">Keep your investigation safe in the cloud.</p>
                        </div>
                      )}

                      {/* Settings — slides to the sub-page */}
                      <button onClick={() => setSettingsView(true)} className={menuItem}>
                        <Settings size={14} /><span>Settings</span>
                        <ChevronRight size={14} className="ml-auto opacity-50" />
                      </button>

                      <div className="h-px bg-lb-border my-1" />

                      <button onClick={() => { onOpenInvestigations(); closeMenu(); }} className={menuItem}>
                        <FolderOpen size={14} /><span>Investigations</span>
                      </button>

                      {user && (
                        <>
                          <div className="h-px bg-lb-border my-1" />
                          <button
                            onClick={() => { onLogout(); closeMenu(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded text-left"
                          >
                            <LogOut size={14} /><span>Sign Out</span>
                          </button>
                        </>
                      )}
                    </div>
                  }
                  page2={
                    <div>
                      <button
                        onClick={() => setSettingsView(false)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-lb-primary border-b border-lb-border hover:bg-lb-bg text-left"
                      >
                        <ChevronLeft size={16} /><span>Settings</span>
                      </button>
                      <SettingsPanel appearance={appearance} />
                    </div>
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
