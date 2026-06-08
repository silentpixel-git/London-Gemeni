
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
  isPasswordRecovery: boolean;
  userProfile: UserProfile | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  signUpWithPassword: (email: string, password: string) => Promise<'session' | 'confirm' | 'error'>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  clearPasswordRecovery: () => void;
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // A password-recovery link establishes a temporary session and fires this
      // event. Flag it so the app shows a "set new password" form instead of
      // dropping the player straight into the game.
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer the profile fetch out of this callback. The callback runs while
        // GoTrue holds its internal auth lock; calling another Supabase method
        // (getProfile -> getSession) synchronously here deadlocks operations
        // that also need the lock — most visibly updateUser() during password
        // recovery, which would hang forever. setTimeout(0) releases the lock
        // first. (Supabase's documented guidance for this callback.)
        const uid = session.user.id;
        setTimeout(() => { loadProfile(uid); }, 0);
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

  // Map Supabase's terse auth errors to player-facing copy.
  const friendlyAuthError = (message: string): string => {
    const m = message.toLowerCase();
    if (m.includes('invalid login credentials')) return "That email and password don't match.";
    if (m.includes('already registered') || m.includes('already been registered')) {
      return 'An account with this email already exists — try signing in.';
    }
    if (m.includes('password') && (m.includes('at least') || m.includes('should be') || m.includes('weak'))) {
      return 'Password must be at least 6 characters.';
    }
    if (m.includes('email') && m.includes('invalid')) return 'Please enter a valid email address.';
    return message;
  };

  const loginWithPassword = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(friendlyAuthError(error.message));
      return false;
    }
    return true;
  };

  const signUpWithPassword = async (
    email: string,
    password: string,
  ): Promise<'session' | 'confirm' | 'error'> => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setAuthError(friendlyAuthError(error.message));
      return 'error';
    }
    // With "Confirm email" disabled, a session is returned and onAuthStateChange
    // logs the player straight in. If it's still enabled, no session comes back
    // and the caller should prompt the player to check their inbox.
    return data.session ? 'session' : 'confirm';
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setAuthError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setAuthError(friendlyAuthError(error.message));
      return false;
    }
    return true;
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    setAuthError(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setAuthError(friendlyAuthError(error.message));
      return false;
    }
    setIsPasswordRecovery(false);
    return true;
  };

  const clearPasswordRecovery = () => setIsPasswordRecovery(false);

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
    setIsPasswordRecovery(false);
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
      isNewUser, isPasswordRecovery, userProfile,
      loginWithGoogle, loginWithEmail,
      loginWithPassword, signUpWithPassword, resetPassword,
      updatePassword, clearPasswordRecovery,
      logout,
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
