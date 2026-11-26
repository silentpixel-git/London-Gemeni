import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import type { User } from '@supabase/supabase-js';
import { getProfile, type UserProfile } from '../services/GameRepository';

interface SupabaseContextType {
  user: User | null;
  /** An anonymous Supabase user: plays and saves, but has not claimed an account (server/TURN.md). */
  isGuest: boolean;
  isAuthReady: boolean;
  authError: string | null;
  isNewUser: boolean;
  userProfile: UserProfile | null;
  loginWithEmail: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  refreshProfile: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Guests play as anonymous users; the turn endpoint needs a JWT for every request.
  const signInAsGuest = async () => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) setAuthError(`Guest play is unavailable: ${error.message}`);
  };

  const loadProfile = async (sessionUser: User) => {
    // A guest has no profile to name; the first-run profile prompt waits for a claimed account.
    if (sessionUser.is_anonymous) { setUserProfile(null); setIsNewUser(false); return; }
    const userId = sessionUser.id;
    const profile = await getProfile(userId);
    setUserProfile(profile);
    // Treat as new user if no display name has been set yet
    setIsNewUser(!profile?.displayName);
  };

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user);
      } else {
        // No session: play as a guest. onAuthStateChange delivers the new user.
        await signInAsGuest();
      }
      setIsAuthReady(true);
    });

    // Listen for auth state changes (token refresh, sign-in/out, etc.)
    // Do NOT set isAuthReady here — it is set exactly once in getSession() above.
    // Calling setIsAuthReady(true) on every TOKEN_REFRESHED event would re-trigger
    // any [isAuthReady]-dependent effects on each automatic token renewal.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer the profile fetch out of this callback. The callback runs while
        // GoTrue holds its internal auth lock; calling another Supabase method
        // (getProfile -> getSession) synchronously here deadlocks operations
        // that also need the lock, such as updateUser(). setTimeout(0) releases the lock
        // first. (Supabase's documented guidance for this callback.)
        const sessionUser = session.user;
        setTimeout(() => { loadProfile(sessionUser); }, 0);
      } else {
        setUserProfile(null);
        setIsNewUser(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithEmail = async (email: string): Promise<boolean> => {
    setAuthError(null);
    // A guest claims their account in place: the email is attached to the anonymous
    // user, so its id (and every Investigation it owns) is kept once the link is confirmed.
    if (user?.is_anonymous) {
      const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: window.location.origin });
      if (!error) return true;
      // The email already has an account: sign in to that one instead; the guest's
      // investigations stay with the guest and are not moved.
      if (!/already/i.test(error.message)) {
        setAuthError(error.message);
        return false;
      }
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setAuthError(error.message);
      return false;
    }
    return true;
  };

  const logout = async () => {
    try {
      // scope: 'local' clears the JWT from localStorage without a network round-trip,
      // so logout works even when Supabase is unreachable.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('signOut network error — forcing local cleanup:', err);
    }
    setUserProfile(null);
    setIsNewUser(false);
    // Signed out is a fresh guest, so the game stays playable.
    await signInAsGuest();
  };

  const clearAuthError = () => setAuthError(null);

  const refreshProfile = async () => {
    if (!user || user.is_anonymous) return;
    const profile = await getProfile(user.id);
    setUserProfile(profile);
    if (profile?.displayName) setIsNewUser(false);
  };

  return (
    <SupabaseContext.Provider value={{
      user, isGuest: !!user?.is_anonymous, isAuthReady, authError, isNewUser, userProfile,
      loginWithEmail, logout, clearAuthError, refreshProfile,
    }}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
