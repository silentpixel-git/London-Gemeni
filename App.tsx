/**
 * App.tsx — layout shell
 *
 * Owns:
 *   - isSidebarOpen (affects root layout; both Sidebar and Header need it)
 *   - SupabaseProvider / ErrorBoundary wrappers
 *
 * Everything else lives in hooks/useGameState.ts and the focused components.
 */

import React, { useState } from 'react';
import { SupabaseProvider, useSupabase } from './components/SupabaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Notification } from './components/Notification';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NarrativeFeed } from './components/NarrativeFeed';
import { CommandInput } from './components/CommandInput';
import { useGameState } from './hooks/useGameState';

// ── Inner app (has access to Supabase context) ──────────────────────────────

const AppContent: React.FC = () => {
  const { user, isAuthReady, authError, loginWithGoogle, logout, clearAuthError } = useSupabase();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const gs = useGameState({ user, isAuthReady });

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans selection:bg-lb-accent selection:text-white bg-lb-bg text-lb-primary">

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
      />

      <div className="flex-1 flex flex-col h-full relative w-full transition-all duration-300">
        <Header
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(s => !s)}
          connectionStatus={gs.connectionStatus}
          isSaving={gs.isSaving}
          isDark={gs.isDark}
          onToggleDark={() => gs.setIsDark(d => !d)}
          user={user}
          authError={authError}
          onClearAuthError={clearAuthError}
          onSave={() => gs.handleSaveGame()}
          onLoad={gs.handleLoadGame}
          onLogin={loginWithGoogle}
          onLogout={logout}
        />

        <NarrativeFeed
          history={gs.history}
          isGameOver={gs.isGameOver}
          actualLastUserIdx={gs.actualLastUserIdx}
          lastUserMessageRef={gs.lastUserMessageRef}
          scrollRef={gs.scrollRef}
          onScroll={gs.handleScroll}
        />

        <CommandInput
          isLoading={gs.isLoading}
          isGameOver={gs.isGameOver}
          isConsultingHolmes={gs.isConsultingHolmes}
          history={gs.history}
          onAction={gs.handleAction}
          onConsultHolmes={gs.handleConsultHolmes}
        />
      </div>
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
