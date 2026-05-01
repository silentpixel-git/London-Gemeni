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

import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../services/GameRepository';
import {
  PanelLeftClose, PanelLeftOpen, Sun, Moon, User as UserIcon,
  ChevronDown, Save, FolderOpen, LogOut, LogIn, Pencil, RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  connectionStatus: { gemini: boolean | null; supabase: boolean | null };
  onRetryConnection: () => void;
  isSaving: boolean;
  isDark: boolean;
  onToggleDark: () => void;
  user: User | null;
  userProfile: UserProfile | null;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
  onOpenAuth: () => void;
  onOpenEditProfile: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  connectionStatus,
  onRetryConnection,
  isSaving,
  isDark,
  onToggleDark,
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

  const displayName = userProfile?.displayName || user?.user_metadata?.full_name || user?.email;
  const displayRole = userProfile?.role || 'Field Surgeon';

  return (
    <header className="sticky top-0 z-30 px-8 md:px-16 py-4 flex items-center justify-between bg-lb-bg/90 backdrop-blur-sm border-b border-lb-border">

      {/* Left — sidebar toggle + connection dots */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-lb-primary hover:bg-lb-primary/5 rounded-md"
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

      {/* Right — dark mode toggle + profile */}
      <div className="flex items-center gap-2">

        {/* Dark / Light toggle */}
        <button
          onClick={onToggleDark}
          className="p-2 text-lb-muted hover:text-lb-accent hover:bg-lb-primary/5 rounded-md transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Unauthenticated: Sign In pill */}
        {!user && (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 px-4 py-2 bg-lb-primary text-white rounded-full text-xs font-bold tracking-widest uppercase hover:bg-lb-accent transition-colors"
          >
            <LogIn size={14} />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}

        {/* Authenticated: Profile dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(o => !o)}
              className="flex items-center gap-3 text-lb-primary group"
            >
              <div className="text-right hidden sm:block">
                <span className="block text-sm font-bold group-hover:text-lb-accent truncate max-w-[140px]">
                  {displayName}
                </span>
                <span className="text-[10px] uppercase tracking-widest opacity-60">
                  {displayRole}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-lb-primary text-lb-bg flex items-center justify-center overflow-hidden shrink-0">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon size={16} />
                )}
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isProfileMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => { setIsProfileMenuOpen(false); setIsConfirmingNewGame(false); }} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-lb-paper border border-lb-border rounded-lg shadow-xl z-20 overflow-hidden">
                  <div className="p-1">
                    {/* User info */}
                    <div className="px-3 py-2 border-b border-lb-border mb-1">
                      <p className="text-[10px] uppercase tracking-widest text-lb-muted font-bold">Signed In As</p>
                      <p className="text-xs font-medium text-lb-primary truncate">{displayName}</p>
                      <p className="text-[10px] text-lb-muted truncate">{user.email}</p>
                    </div>

                    {/* Edit Profile */}
                    <button
                      onClick={() => { onOpenEditProfile(); setIsProfileMenuOpen(false); setIsConfirmingNewGame(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                    >
                      <Pencil size={14} /><span>Edit Profile</span>
                    </button>

                    <div className="h-px bg-lb-border my-1" />

                    {/* Save / Load */}
                    <button
                      onClick={() => { onSave(); setIsProfileMenuOpen(false); setIsConfirmingNewGame(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                    >
                      <Save size={14} /><span>Save to Cloud</span>
                    </button>
                    <button
                      onClick={() => { onLoad(); setIsProfileMenuOpen(false); setIsConfirmingNewGame(false); }}
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
                            onClick={() => {
                              setIsConfirmingNewGame(false);
                              setIsProfileMenuOpen(false);
                              onNewGame();
                            }}
                            className="flex-1 px-2 py-1.5 bg-lb-primary text-white text-xs font-semibold rounded hover:bg-lb-accent transition-colors"
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
                      onClick={() => { onLogout(); setIsProfileMenuOpen(false); setIsConfirmingNewGame(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded text-left"
                    >
                      <LogOut size={14} /><span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
