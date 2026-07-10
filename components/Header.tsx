/**
 * components/Header.tsx
 *
 * Sticky top bar with:
 *   - Sidebar toggle
 *   - Connection status indicators (Engine / Cloud / Saving)
 *   - Dark mode toggle
 *   - Profile dropdown (save, load, edit profile, sign out)
 *   - "Sign In" pill button when unauthenticated
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../services/GameRepository';
import {
  PanelLeftClose, PanelLeftOpen, User as UserIcon,
  ChevronDown, ChevronLeft, ChevronRight, Save, FolderOpen, LogOut, LogIn, Pencil, RefreshCw,
  Settings, BookOpenText,
} from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';
import type { ThemeMode } from '../types';

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  connectionStatus: { gemini: boolean | null; supabase: boolean | null };
  onRetryConnection: () => void;
  onOpenDiary: () => void;
  diaryUnreadCount: number;
  isSaving: boolean;
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  soundEffects: boolean;
  onToggleSound: () => void;
  ambientAudio: boolean;
  onToggleAmbient: () => void;
  user: User | null;
  userProfile: UserProfile | null;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
  onOpenAuth: () => void;
  onOpenEditProfile: () => void;
  onLogout: () => void;
}

/**
 * Two-page slide-over used by both the guest and signed-in dropdown menus
 * (profile/settings sub-page). The viewport height animates to match
 * whichever page is showing, so the closed menu never leaves empty space
 * under a shorter page.
 */
const TwoPageDropdown: React.FC<{ page1: React.ReactNode; page2: React.ReactNode; showPage2: boolean }> = ({
  page1, page2, showPage2,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const target = showPage2 ? page2Ref.current : page1Ref.current;
    if (target && viewportRef.current) {
      viewportRef.current.style.height = `${target.offsetHeight}px`;
    }
  }, [showPage2]);

  return (
    <div ref={viewportRef} className="overflow-hidden transition-[height] duration-300 ease-in-out">
      <div className={`flex w-[200%] items-start transition-transform duration-300 ease-in-out ${showPage2 ? '-translate-x-1/2' : ''}`}>
        <div ref={page1Ref} className="w-1/2">{page1}</div>
        <div ref={page2Ref} className="w-1/2">{page2}</div>
      </div>
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  connectionStatus,
  onRetryConnection,
  onOpenDiary,
  diaryUnreadCount,
  isSaving,
  themeMode,
  onSetThemeMode,
  soundEffects,
  onToggleSound,
  ambientAudio,
  onToggleAmbient,
  user,
  userProfile,
  onSave,
  onLoad,
  onNewGame,
  onOpenAuth,
  onOpenEditProfile,
  onLogout,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isConfirmingNewGame, setIsConfirmingNewGame] = useState(false);
  // Settings sub-page within the profile dropdown (slide-over, iOS-style).
  const [settingsView, setSettingsView] = useState(false);
  // Guest menu mirrors the signed-in dropdown: a Sign In button in place of
  // the account info, plus the same Settings sub-page.
  const [isGuestMenuOpen, setIsGuestMenuOpen] = useState(false);
  const [guestSettingsView, setGuestSettingsView] = useState(false);

  const displayName = userProfile?.displayName || user?.user_metadata?.full_name || user?.email;

  const closeProfileMenu = () => {
    setIsProfileMenuOpen(false);
    setIsConfirmingNewGame(false);
    setSettingsView(false);
  };

  const closeGuestMenu = () => {
    setIsGuestMenuOpen(false);
    setGuestSettingsView(false);
  };

  // Shared between the guest and signed-in layouts below — a plain JSX
  // value (not a nested component) so it doesn't remount on every render.
  const hasNewDiaryEntries = diaryUnreadCount > 0;
  const diaryButton = (
    <button
      onClick={onOpenDiary}
      className="relative w-10 h-10 rounded-full border border-lb-primary/30 text-lb-primary flex items-center justify-center shrink-0 hover:border-lb-accent hover:text-lb-accent transition-colors"
      title="Read Watson's Diary"
      aria-label={hasNewDiaryEntries ? `Read Watson's Diary — ${diaryUnreadCount} new ${diaryUnreadCount === 1 ? 'entry' : 'entries'}` : "Read Watson's Diary"}
    >
      <BookOpenText size={20} />
      {hasNewDiaryEntries && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-lb-accent text-white text-[10px] font-bold leading-none">
          {diaryUnreadCount > 9 ? '9+' : diaryUnreadCount}
        </span>
      )}
    </button>
  );

  return (
    <header className="sticky top-0 z-30 px-8 md:px-16 py-4 flex items-center justify-between bg-lb-bg/90 backdrop-blur-sm border-b border-lb-border">

      {/* Left — sidebar toggle + connection dots */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="w-10 h-10 flex items-center justify-center text-lb-primary hover:bg-lb-primary/5 rounded-full shrink-0"
        >
          {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>

        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-lb-paper/50 rounded-full border border-lb-border/50">
          {/* Engine dot */}
          <div
            className="flex items-center gap-1.5"
            title={
              connectionStatus.gemini === true  ? 'Engine Connected'    :
              connectionStatus.gemini === false ? 'Engine Disconnected' :
              'Checking Engine...'
            }
          >
            <div className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus.gemini === true  ? 'bg-green-500' :
              connectionStatus.gemini === false ? 'bg-red-500'   :
              'bg-yellow-500 animate-pulse'
            }`} />
            <span className="text-[9px] uppercase tracking-widest text-lb-muted font-bold">Engine</span>
          </div>

          <div className="w-px h-3 bg-lb-border/50" />

          {/* Cloud dot — clickable to retry when disconnected */}
          <button
            type="button"
            onClick={connectionStatus.supabase === false ? onRetryConnection : undefined}
            disabled={connectionStatus.supabase !== false}
            className={`flex items-center gap-1.5 ${connectionStatus.supabase === false ? 'cursor-pointer hover:opacity-70' : 'cursor-default'}`}
            title={
              connectionStatus.supabase === true  ? 'Cloud Connected'           :
              connectionStatus.supabase === false ? 'Cloud Disconnected — click to retry' :
              'Checking Cloud...'
            }
          >
            <div className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus.supabase === true  ? 'bg-green-500' :
              connectionStatus.supabase === false ? 'bg-red-500'   :
              'bg-yellow-500 animate-pulse'
            }`} />
            <span className={`text-[9px] uppercase tracking-widest font-bold ${
              connectionStatus.supabase === false ? 'text-red-400' : 'text-lb-muted'
            }`}>Cloud</span>
            {connectionStatus.supabase === false && (
              <RefreshCw size={8} className="text-red-400" />
            )}
          </button>

          {/* Saving dot */}
          {isSaving && (
            <>
              <div className="w-px h-3 bg-lb-border/50" />
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[9px] uppercase tracking-widest text-orange-500 font-bold">Saving</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right — settings + profile */}
      <div className="flex items-center gap-2">

        {/* Unauthenticated: guest dropdown mirrors the signed-in menu — a Sign In
            button where the account info sits when signed in, plus the same
            Settings sub-page. */}
        {!user && (
          <div className="flex items-center gap-3">
            {diaryButton}
            <div className="relative">
              <button
                onClick={() => { setIsGuestMenuOpen(o => !o); setGuestSettingsView(false); }}
                className="flex items-center gap-2 text-lb-primary group"
                aria-expanded={isGuestMenuOpen}
                aria-label="Account menu"
              >
                <div className="w-10 h-10 rounded-full bg-lb-primary text-lb-bg dark:bg-lb-accent dark:text-white flex items-center justify-center shrink-0">
                  <LogIn size={18} />
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isGuestMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isGuestMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={closeGuestMenu} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-lb-paper border border-lb-border rounded-lg shadow-xl z-20 overflow-hidden">
                    <TwoPageDropdown
                      showPage2={guestSettingsView}
                      page1={
                        <div className="p-1">
                          {/* Sign In */}
                          <div className="px-3 pt-2 pb-3 border-b border-lb-border mb-1">
                            <p className="text-[10px] uppercase tracking-widest text-lb-muted font-bold mb-2">Playing As Guest</p>
                            <button
                              onClick={() => { onOpenAuth(); closeGuestMenu(); }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-lb-primary text-lb-bg dark:bg-lb-accent dark:text-white rounded-md text-xs font-bold tracking-widest uppercase hover:bg-lb-accent dark:hover:bg-lb-accent/80 transition-colors"
                            >
                              <LogIn size={14} /><span>Sign In</span>
                            </button>
                            <p className="mt-2 text-[10.5px] text-lb-muted text-center leading-snug">Keep your investigation safe in the cloud.</p>
                          </div>

                          {/* Settings — slides to the sub-page */}
                          <button
                            onClick={() => setGuestSettingsView(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                          >
                            <Settings size={14} /><span>Settings</span>
                            <ChevronRight size={14} className="ml-auto opacity-50" />
                          </button>
                        </div>
                      }
                      page2={
                        <div>
                          <button
                            onClick={() => setGuestSettingsView(false)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-lb-primary border-b border-lb-border hover:bg-lb-bg text-left"
                          >
                            <ChevronLeft size={16} /><span>Settings</span>
                          </button>
                          <SettingsPanel
                            themeMode={themeMode}
                            onSetThemeMode={onSetThemeMode}
                            soundEffects={soundEffects}
                            onToggleSound={onToggleSound}
                            ambientAudio={ambientAudio}
                            onToggleAmbient={onToggleAmbient}
                          />
                        </div>
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Authenticated: Profile dropdown */}
        {user && (
          <div className="flex items-center gap-3">
            {diaryButton}
            <div className="relative">
              <button
                onClick={() => { setIsProfileMenuOpen(o => !o); setIsConfirmingNewGame(false); setSettingsView(false); }}
                className="flex items-center gap-2 text-lb-primary group"
              >
                <div className="w-10 h-10 rounded-full bg-lb-primary text-lb-bg dark:bg-lb-accent dark:text-white flex items-center justify-center overflow-hidden shrink-0">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon size={18} />
                  )}
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isProfileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={closeProfileMenu} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-lb-paper border border-lb-border rounded-lg shadow-xl z-20 overflow-hidden">
                    <TwoPageDropdown
                      showPage2={settingsView}
                      page1={
                        <div className="p-1">
                          {/* User info */}
                          <div className="px-3 py-2 border-b border-lb-border mb-1">
                            <p className="text-[10px] uppercase tracking-widest text-lb-muted font-bold">Signed In As</p>
                            <p className="text-xs font-medium text-lb-primary truncate">{displayName}</p>
                            <p className="text-[10px] text-lb-muted truncate">{user.email}</p>
                          </div>

                          {/* Edit Profile */}
                          <button
                            onClick={() => { onOpenEditProfile(); closeProfileMenu(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                          >
                            <Pencil size={14} /><span>Edit Profile</span>
                          </button>

                          {/* Settings — slides to the sub-page */}
                          <button
                            onClick={() => setSettingsView(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                          >
                            <Settings size={14} /><span>Settings</span>
                            <ChevronRight size={14} className="ml-auto opacity-50" />
                          </button>

                          <div className="h-px bg-lb-border my-1" />

                          {/* Save / Load */}
                          <button
                            onClick={() => { onSave(); closeProfileMenu(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                          >
                            <Save size={14} /><span>Save to Cloud</span>
                          </button>
                          <button
                            onClick={() => { onLoad(); closeProfileMenu(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                          >
                            <FolderOpen size={14} /><span>Load from Cloud</span>
                          </button>

                          <div className="h-px bg-lb-border my-1" />

                          {/* New Game */}
                          {isConfirmingNewGame ? (
                            <div className="px-3 py-2">
                              <p className="text-xs text-lb-muted mb-2">Archive current progress and start fresh?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setIsConfirmingNewGame(false); closeProfileMenu(); onNewGame(); }}
                                  className="flex-1 px-2 py-1.5 bg-lb-primary text-lb-bg text-xs font-semibold rounded hover:bg-lb-accent transition-colors"
                                >
                                  Yes, start fresh
                                </button>
                                <button
                                  onClick={() => setIsConfirmingNewGame(false)}
                                  className="flex-1 px-2 py-1.5 border border-lb-border text-lb-primary text-xs font-semibold rounded hover:bg-lb-bg transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setIsConfirmingNewGame(true)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                            >
                              <RefreshCw size={14} /><span>New Game</span>
                            </button>
                          )}

                          <div className="h-px bg-lb-border my-1" />

                          {/* Sign out */}
                          <button
                            onClick={() => { onLogout(); closeProfileMenu(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded text-left"
                          >
                            <LogOut size={14} /><span>Sign Out</span>
                          </button>
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
                          <SettingsPanel
                            themeMode={themeMode}
                            onSetThemeMode={onSetThemeMode}
                            soundEffects={soundEffects}
                            onToggleSound={onToggleSound}
                            ambientAudio={ambientAudio}
                            onToggleAmbient={onToggleAmbient}
                          />
                        </div>
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
