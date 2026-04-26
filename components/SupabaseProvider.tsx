
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { User, Session } from '@supabase/supabase-js';
import { GameRepository, UserProfile } from '../services/GameRepository';

interface SupabaseContextType {
  user: User | null;
  session: Session | null;
  isAuthReady: boolean;
  authError: string | null;
  isNewUser: boolean;
  userProfile: UserProfile | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  refreshProfile: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const loadProfile = async (userId: string) => {
    const profile = await GameRepository.getProfile(userId);
    setUserProfile(profile);
    // Treat as new user if no display name has been set yet
    setIsNewUser(!profile?.displayName);
  };

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthReady(true);
      if (session?.user) {
        loadProfile(session.user.id);
      }
    });

    // Listen for auth state changes (token refresh, sign-in/out, etc.)
    // Do NOT set isAuthReady here — it is set exactly once in getSession() above.
    // Calling setIsAuthReady(true) on every TOKEN_REFRESHED event would re-trigger
    // any [isAuthReady]-dependent effects on each automatic token renewal.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setUserProfile(null);
        setIsNewUser(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      if (error.message.includes('provider is not enabled')) {
        setAuthError('Google sign-in is not enabled. Please check your Supabase project settings.');
      } else {
        setAuthError(error.message);
      }
    }
  };

  const loginWithEmail = async (email: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
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
  };

  const clearAuthError = () => setAuthError(null);

  const refreshProfile = async () => {
    if (!user) return;
    const profile = await GameRepository.getProfile(user.id);
    setUserProfile(profile);
    if (profile?.displayName) setIsNewUser(false);
  };

  return (
    <SupabaseContext.Provider value={{
      user, session, isAuthReady, authError,
      isNewUser, userProfile,
      loginWithGoogle, loginWithEmail, logout,
      clearAuthError, refreshProfile,
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
