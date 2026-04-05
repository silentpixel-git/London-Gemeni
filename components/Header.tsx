/**
 * components/Header.tsx
 *
 * Sticky top bar with:
 *   - Sidebar toggle
 *   - Connection status indicators (Engine / Cloud / Saving)
 *   - Dark mode toggle
 *   - Profile dropdown (save, load, sign in/out)
 *
 * Owns isProfileMenuOpen locally — it is purely UI state with no effect
 * on game logic or other components.
 */

import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  PanelLeftClose, PanelLeftOpen, Sun, Moon, User as UserIcon,
  ChevronDown, Save, FolderOpen, LogOut, LogIn,
} from 'lucide-react';

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  connectionStatus: { gemini: boolean | null; supabase: boolean | null };
  isSaving: boolean;
  isDark: boolean;
  onToggleDark: () => void;
  user: User | null;
  authError: string | null;
  onClearAuthError: () => void;
  onSave: () => void;
  onLoad: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  connectionStatus,
  isSaving,
  isDark,
  onToggleDark,
  user,
  authError,
  onClearAuthError,
  onSave,
  onLoad,
  onLogin,
  onLogout,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

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

          {/* Cloud dot */}
          <div
            className="flex items-center gap-1.5"
            title={
              connectionStatus.supabase === true  ? 'Cloud Connected'    :
              connectionStatus.supabase === false ? 'Cloud Disconnected' :
              'Checking Cloud...'
            }
          >
            <div className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus.supabase === true  ? 'bg-green-500' :
              connectionStatus.supabase === false ? 'bg-red-500'   :
              'bg-yellow-500 animate-pulse'
            }`} />
            <span className="text-[9px] uppercase tracking-widest text-lb-muted font-bold">Cloud</span>
          </div>

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

        {/* Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileMenuOpen(o => !o)}
            className="flex items-center gap-3 text-lb-primary group"
          >
            <div className="text-right hidden sm:block">
              <span className="block text-sm font-bold group-hover:text-lb-accent">
                {user ? (user.user_metadata?.full_name || user.email) : 'Dr. John Watson'}
              </span>
              <span className="text-[10px] uppercase tracking-widest opacity-60">
                {user ? 'Cloud Profile' : 'Medical Profile'}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-lb-primary text-white flex items-center justify-center overflow-hidden">
              {user?.user_metadata?.avatar_url ? (
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
              <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-lb-paper border border-lb-border rounded-lg shadow-xl z-20 overflow-hidden">
                <div className="p-1">
                  {user ? (
                    <>
                      <div className="px-3 py-2 border-b border-lb-border mb-1">
                        <p className="text-[10px] uppercase tracking-widest text-lb-muted font-bold">Logged In As</p>
                        <p className="text-xs font-medium text-lb-primary truncate">
                          {user.user_metadata?.full_name || user.email}
                        </p>
                      </div>
                      <button
                        onClick={() => { onSave(); setIsProfileMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                      >
                        <Save size={14} /><span>Save to Cloud</span>
                      </button>
                      <button
                        onClick={() => { onLoad(); setIsProfileMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                      >
                        <FolderOpen size={14} /><span>Load from Cloud</span>
                      </button>
                      <div className="h-px bg-lb-border my-1" />
                      <button
                        onClick={() => { onLogout(); setIsProfileMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded text-left"
                      >
                        <LogOut size={14} /><span>Sign Out</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { onLogin(); setIsProfileMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left font-bold"
                      >
                        <LogIn size={14} /><span>Sign In with Google</span>
                      </button>

                      {authError && (
                        <div className="px-3 py-2 bg-red-50 border border-red-100 rounded mx-2 my-1">
                          <p className="text-[10px] text-red-600 leading-tight">{authError}</p>
                          <button
                            onClick={onClearAuthError}
                            className="text-[9px] text-red-400 underline mt-1"
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      {((import.meta as any).env.VITE_SUPABASE_URL === 'https://itjnzcqapohnoqfnxtat.supabase.co' ||
                        !(import.meta as any).env.VITE_SUPABASE_URL) && (
                        <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded mx-2 my-1">
                          <p className="text-[9px] text-amber-700 leading-tight">
                            Using fallback project. To enable Google Login, please set your own Supabase credentials in Settings.
                          </p>
                        </div>
                      )}

                      <div className="h-px bg-lb-border my-1" />
                      <button
                        onClick={() => { onSave(); setIsProfileMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                      >
                        <Save size={14} /><span>Save Locally</span>
                      </button>
                      <button
                        onClick={() => { onLoad(); setIsProfileMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lb-primary hover:bg-lb-bg rounded text-left"
                      >
                        <FolderOpen size={14} /><span>Load Locally</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
