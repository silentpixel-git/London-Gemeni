/**
 * App.tsx — layout shell
 *
 * Owns:
 *   - isSidebarOpen (affects root layout; both Sidebar and Header need it)
 *   - isAuthModalOpen / isEditProfileOpen / isFirstRunProfile (modal orchestration)
 *   - SupabaseProvider / ErrorBoundary wrappers
 *
 * Everything else lives in hooks/useGameState.ts and the focused components.
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { SupabaseProvider, useSupabase } from './components/SupabaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Notification } from './components/Notification';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NarrativeFeed } from './components/NarrativeFeed';
import { CommandInput } from './components/CommandInput';
import { AuthModal } from './components/AuthModal';
import { EditProfileModal } from './components/EditProfileModal';
import { SaveSlotsModal } from './components/SaveSlotsModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { ActBreakCurtain } from './components/ActBreakCurtain';
import { useGameState } from './hooks/useGameState';

// ── Inner app (has access to Supabase context) ──────────────────────────────

const AppContent: React.FC = () => {
  const { user, isAuthReady, isNewUser, isPasswordRecovery, userProfile, logout } = useSupabase();
  // Open by default on desktop (lg+); closed on smaller devices where the
  // sidebar is an overlay drawer that would otherwise cover the game.
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1024,
  );
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isFirstRunProfile, setIsFirstRunProfile] = useState(false);
  const [isSlotMenuOpen, setIsSlotMenuOpen] = useState(false);

  const gs = useGameState({ user, isAuthReady, userProfile });

  // On login, show the slot-select menu instead of auto-loading the last game.
  useEffect(() => {
    if (!user || !isAuthReady) return;
    setIsAuthModalOpen(false);
    // A password-recovery session must set a new password first — the reset modal
    // takes precedence; don't open the slot menu or first-run profile underneath it.
    if (isPasswordRecovery) {
      setIsSlotMenuOpen(false);
      return;
    }
    gs.refreshSlots();
    setIsSlotMenuOpen(true);
    if (isNewUser) {
      setIsFirstRunProfile(true);
      setIsEditProfileOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isNewUser, isAuthReady, isPasswordRecovery]);

  const openSlotMenu = () => {
    gs.refreshSlots();
    setIsSlotMenuOpen(true);
  };

  const handleOpenEditProfile = () => {
    setIsFirstRunProfile(false);
    setIsEditProfileOpen(true);
  };

  const handleCloseEditProfile = () => {
    setIsEditProfileOpen(false);
    setIsFirstRunProfile(false);
  };

  return (
    <div className="flex h-screen h-dvh w-full overflow-hidden font-sans selection:bg-lb-accent selection:text-white bg-lb-bg text-lb-primary">

      {/* Mobile overlay — closes sidebar on outside tap */}
      <div
        className={`fixed inset-0 bg-lb-primary/50 z-40 lg:hidden transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {gs.notification && (
        <Notification
          message={gs.notification.message}
          type={gs.notification.type}
          onClose={() => gs.setNotification(null)}
        />
      )}

      <AnimatePresence>
        {gs.isCurtainPlaying && gs.pendingActTransition && (
          <ActBreakCurtain
            key="act-curtain"
            fromAct={gs.pendingActTransition.fromAct}
            toAct={gs.pendingActTransition.toAct}
          />
        )}
      </AnimatePresence>

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        location={gs.location}
        inventory={gs.inventory}
        currentAct={gs.currentAct}
        npcStates={gs.npcStates}
        journalNotes={gs.journalNotes}
        isUpdatingJournal={gs.isUpdatingJournal}
        onUpdateJournal={gs.handleUpdateJournal}
        displayTime={gs.displayTime}
        displayDate={gs.displayDate}
        weather={gs.weather}
      />

      <div className="flex-1 flex flex-col h-full relative w-full transition-all duration-300">
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(s => !s)}
          connectionStatus={gs.connectionStatus}
          onRetryConnection={gs.retryConnections}
          isSaving={gs.isSaving}
          isDark={gs.isDark}
          onToggleDark={() => gs.setIsDark(d => !d)}
          user={user}
          userProfile={userProfile}
          onSave={() => gs.handleSaveGame()}
          onLoad={openSlotMenu}
          onNewGame={openSlotMenu}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenEditProfile={handleOpenEditProfile}
          onLogout={logout}
        />

        <NarrativeFeed
          history={gs.history}
          isGameOver={gs.isGameOver}
          actualLastUserIdx={gs.actualLastUserIdx}
          lastUserMessageRef={gs.lastUserMessageRef}
          scrollRef={gs.scrollRef}
          onScroll={gs.handleScroll}
          onJournalDone={gs.handleJournalTypewriterDone}
          pendingActTransition={gs.pendingActTransition}
          isActBreakReady={gs.isActBreakReady}
          onBeginAct={gs.beginNextAct}
        />

        <CommandInput
          isLoading={gs.isLoading || gs.pendingActTransition !== null || gs.isCurtainPlaying}
          isGameOver={gs.isGameOver}
          isConsultingHolmes={gs.isConsultingHolmes}
          history={gs.history}
          onAction={gs.handleAction}
          onConsultHolmes={gs.handleConsultHolmes}
        />
      </div>

      {/* Modals */}
      <SaveSlotsModal
        isOpen={isSlotMenuOpen}
        slots={gs.slots}
        onSelect={(inv) => { gs.handleSelectSlot(inv); setIsSlotMenuOpen(false); }}
        onStartInSlot={(n) => { gs.handleStartInSlot(n); setIsSlotMenuOpen(false); }}
        onContinue={() => { gs.handleContinue(); setIsSlotMenuOpen(false); }}
        onDelete={(inv) => gs.handleDeleteSlot(inv)}
        onClose={() => setIsSlotMenuOpen(false)}
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
