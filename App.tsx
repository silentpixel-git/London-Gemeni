/**
 * App.tsx — layout shell
 *
 * Owns:
 *   - isSidebarOpen (affects root layout; both Sidebar and Header need it)
 *   - which modal is open (auth, profile, investigations, diary)
 *   - SupabaseProvider / ErrorBoundary wrappers
 *
 * The game itself is hooks/useInvestigation.ts: the server owns every
 * Investigation (ADR-0001) and the browser renders what it says. Nothing here
 * knows a Story.
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { cssEase, EASE_IN_OUT } from './components/motionTokens';
import { SupabaseProvider, useSupabase } from './components/SupabaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Notification } from './components/Notification';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NarrativeFeed } from './components/NarrativeFeed';
import { CommandInput } from './components/CommandInput';
import { AuthModal } from './components/AuthModal';
import { EditProfileModal } from './components/EditProfileModal';
import { InvestigationsModal } from './components/InvestigationsModal';
import { DiaryModal, diaryTabTotals, type DiaryTab } from './components/DiaryModal';
import { DiaryToast } from './components/DiaryToast';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { useInvestigation } from './hooks/useInvestigation';
import { useAppearance } from './hooks/gameState/useAppearance';
import { useConnections } from './hooks/gameState/useConnections';
import { useAudio } from './hooks/useAudio';
import type { TimePeriod } from './types';

// The `desk` breakpoint (tailwind.config.js) — the width at or above which the
// Sidebar docks beside the game instead of sliding over it as a drawer, as in
// the prototype. Matching the CSS query rather than reading innerWidth keeps
// this in step with the `desk:` classes on the Sidebar itself.
const DESK_QUERY = '(min-width: 901px)';

/** The auto theme follows the in-game hour; a Story's own Periods are not needed for that. */
function themePeriod(clock: number | undefined): TimePeriod {
  if (clock === undefined) return 'evening';
  const h = Math.floor((((clock % 1440) + 1440) % 1440) / 60);
  if (h < 5) return 'lateNight';
  if (h < 7) return 'dawn';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}

const sumTotals = (t: Record<DiaryTab, number>) => t.evidence + t.persons + t.documents;

// ── Inner app (has access to Supabase context) ──────────────────────────────

const AppContent: React.FC = () => {
  const { user, isGuest, isAuthReady, isNewUser, isPasswordRecovery, userProfile, authError, logout } = useSupabase();
  // Open by default on desktop (lg+); closed on smaller devices where the
  // sidebar is an overlay drawer that would otherwise cover the game.
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.matchMedia(DESK_QUERY).matches,
  );

  // Below lg the sidebar covers most of the screen, so it must never be left
  // open once the viewport drops into drawer territory — on rotate, on a
  // desktop window being narrowed, or on a first paint that measured a wider
  // viewport than the one the player ends up with. Widening again deliberately
  // does NOT re-open it: a closed sidebar on desktop is the player's choice.
  useEffect(() => {
    const mq = window.matchMedia(DESK_QUERY);
    const closeIfNarrow = () => { if (!mq.matches) setIsSidebarOpen(false); };
    closeIfNarrow();
    mq.addEventListener('change', closeIfNarrow);
    return () => mq.removeEventListener('change', closeIfNarrow);
  }, []);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isFirstRunProfile, setIsFirstRunProfile] = useState(false);
  const [isInvestigationsOpen, setIsInvestigationsOpen] = useState(false);
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const inv = useInvestigation({ userId: isAuthReady ? user?.id ?? null : null });
  const view = inv.view;
  const appearance = useAppearance({ user, userProfile, currentTimePeriod: themePeriod(view?.clock) });
  const { connectionStatus, checkConnections } = useConnections({ isAuthReady, setNotification });

  // Ambient bed from what the player can see; one-shots from the latest turn's Events.
  useAudio({
    location: view?.location.id ?? '',
    weatherCondition: view?.weather.id,
    currentAct: view?.act.id ?? 0,
    events: inv.lastEvents,
    soundEffects: appearance.soundEffects,
    ambientAudio: appearance.ambientAudio,
  });

  // Turn errors surface as a notification.
  useEffect(() => {
    if (inv.error) setNotification({ message: inv.error, type: 'error' });
  }, [inv.error]);
  useEffect(() => {
    if (authError) setNotification({ message: authError, type: 'error' });
  }, [authError]);

  // ── Diary: unread badge, new-tab dots, and a toast when play records something ──
  const totals = view ? diaryTabTotals(view.diary) : null;
  const [diarySeen, setDiarySeen] = useState<Record<DiaryTab, number> | null>(null);
  const [diaryNewTabs, setDiaryNewTabs] = useState<Set<DiaryTab>>(new Set());
  const [isDiaryToastShown, setIsDiaryToastShown] = useState(false);
  const diaryUnreadCount = totals ? Math.max(0, sumTotals(totals) - (diarySeen ? sumTotals(diarySeen) : 0)) : 0;
  const openDiary = () => {
    if (totals) {
      setDiaryNewTabs(new Set((Object.keys(totals) as DiaryTab[]).filter(t => totals[t] > (diarySeen?.[t] ?? 0))));
      setDiarySeen(totals);
    }
    setIsDiaryToastShown(false);
    setIsDiaryOpen(true);
  };
  const closeDiary = useCallback(() => setIsDiaryOpen(false), []);
  // Another Investigation: the diary starts over, everything in it already "seen".
  useEffect(() => {
    setDiarySeen(inv.view ? diaryTabTotals(inv.view.diary) : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.investigationId]);
  // "Noted in the diary": the latest turn found a Clue or read a document.
  useEffect(() => {
    if (isDiaryOpen || !inv.lastEvents.some(e => e.kind === 'ClueDiscovered' || e.kind === 'Read')) return;
    setIsDiaryToastShown(true);
    const t = window.setTimeout(() => setIsDiaryToastShown(false), 2400);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.lastEvents]);

  const dockRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // A sidebar click puts its command in the input; the nonce re-applies the
  // same command if it is clicked twice.
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const prefillCommand = useCallback((text: string) => setPrefill(p => ({ text, nonce: (p?.nonce ?? 0) + 1 })), []);

  // Desktop sidebar toggle: one layout change, then FLIP each piece that moves
  // ([data-flip]: the sidebar, header controls, title, feed column, command
  // dock). The text column has a fixed max width, so it only glides sideways;
  // animating the width instead reflowed the column on every frame.
  const flipFrom = useRef<Map<Element, number> | null>(null);
  const toggleSidebar = () => {
    if (window.matchMedia(DESK_QUERY).matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const els = [...document.querySelectorAll('[data-flip]')];
      flipFrom.current = new Map(els.map(el => [el, el.getBoundingClientRect().left]));
      els.forEach(el => el.getAnimations().forEach(a => a.cancel()));
    }
    setIsSidebarOpen(s => !s);
  };
  useLayoutEffect(() => {
    const from = flipFrom.current;
    if (!from) return;
    flipFrom.current = null;
    from.forEach((left, el) => {
      const dx = left - el.getBoundingClientRect().left;
      if (dx) el.animate(
        [{ transform: `translateX(${dx}px)` }, { transform: 'none' }],
        { duration: 260, easing: cssEase(EASE_IN_OUT) },
      );
    });
  }, [isSidebarOpen]);

  // Nothing open once the player's investigations are loaded: choose or begin one.
  useEffect(() => {
    if (inv.isReady && !inv.investigationId && !isPasswordRecovery) setIsInvestigationsOpen(true);
  }, [inv.isReady, inv.investigationId, isPasswordRecovery]);

  // A signed-in (not guest) player with no display name yet: the first-run profile prompt, once.
  const firstRunShownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user || isGuest || !isNewUser || isPasswordRecovery || firstRunShownFor.current === user.id) return;
    firstRunShownFor.current = user.id;
    setIsAuthModalOpen(false);
    setIsFirstRunProfile(true);
    setIsEditProfileOpen(true);
  }, [user, isGuest, isNewUser, isPasswordRecovery]);
  // Signing in closes the sign-in modal.
  useEffect(() => { if (user && !isGuest) setIsAuthModalOpen(false); }, [user, isGuest]);

  const openInvestigations = () => {
    void inv.refreshList();
    setIsInvestigationsOpen(true);
  };

  const handleOpenEditProfile = () => {
    setIsFirstRunProfile(false);
    setIsEditProfileOpen(true);
  };

  const handleCloseEditProfile = () => {
    setIsEditProfileOpen(false);
    setIsFirstRunProfile(false);
  };

  // Swipe to open/close the sidebar drawer on mobile (matches the Sidebar's
  // desk:hidden overlay behavior — desktop keeps the sidebar docked, no swipe).
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || window.matchMedia(DESK_QUERY).matches) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0 && start.x < 40 && !isSidebarOpen) {
      setIsSidebarOpen(true);
    } else if (dx < 0 && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  };

  const history = inv.history;
  let lastUserIdx = -1;
  history.forEach((m, i) => { if (m.role === 'user') lastUserIdx = i; });

  return (
    <div
      className="flex h-screen h-dvh w-full overflow-hidden font-sans selection:bg-lb-accent selection:text-white bg-lb-bg text-lb-primary"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* Mobile overlay — closes sidebar on outside tap */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 desk:hidden transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => { setNotification(null); inv.clearError(); }}
        />
      )}

      <DiaryToast show={isDiaryToastShown} />

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        onClose={() => { if (!window.matchMedia(DESK_QUERY).matches) setIsSidebarOpen(false); }}
        onPrefill={prefillCommand}
        view={view}
      />

      <div className="flex-1 flex flex-col h-full relative w-full min-w-0">
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          connectionStatus={{ engine: inv.engineOk, supabase: connectionStatus.supabase }}
          onRetryConnection={checkConnections}
          themeMode={appearance.themeMode}
          onSetThemeMode={appearance.setThemeMode}
          soundEffects={appearance.soundEffects}
          onToggleSound={() => appearance.setSoundEffects(v => !v)}
          ambientAudio={appearance.ambientAudio}
          onToggleAmbient={() => appearance.setAmbientAudio(v => !v)}
          user={isGuest ? null : user}
          userProfile={userProfile}
          onOpenInvestigations={openInvestigations}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenEditProfile={handleOpenEditProfile}
          onLogout={logout}
          onOpenDiary={openDiary}
          diaryUnreadCount={diaryUnreadCount}
        />

        <NarrativeFeed
          history={history}
          actualLastUserIdx={lastUserIdx}
          scrollRef={scrollRef}
          dockRef={dockRef}
        />

        <CommandInput
          isLoading={inv.isBusy || !inv.investigationId}
          isGameOver={!!view?.ended}
          history={history}
          onAction={inv.send}
          dockRef={dockRef}
          prefill={prefill}
        />
      </div>

      {/* Modals */}
      <InvestigationsModal
        isOpen={isInvestigationsOpen}
        investigations={inv.investigations}
        activeId={inv.investigationId}
        isGuest={isGuest}
        canClose={!!inv.investigationId}
        isBusy={inv.isBusy}
        onOpen={async id => { if (await inv.resume(id)) setIsInvestigationsOpen(false); }}
        onStart={async name => { setIsInvestigationsOpen(false); if (!(await inv.start(name))) setIsInvestigationsOpen(true); }}
        onDelete={id => { void inv.remove(id); }}
        onClose={() => setIsInvestigationsOpen(false)}
      />
      <DiaryModal
        isOpen={isDiaryOpen}
        onClose={closeDiary}
        view={view}
        newTabs={diaryNewTabs}
      />
      <ResetPasswordModal isOpen={isPasswordRecovery} />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={handleCloseEditProfile}
        isFirstRun={isFirstRunProfile}
      />
    </div>
  );
};

// ── Root wrapper ─────────────────────────────────────────────────────────────

const App: React.FC = () => (
  <ErrorBoundary>
    <SupabaseProvider>
      <AppContent />
    </SupabaseProvider>
  </ErrorBoundary>
);

export default App;
