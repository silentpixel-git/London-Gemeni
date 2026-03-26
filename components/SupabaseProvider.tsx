
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { User, Session } from '@supabase/supabase-js';

interface SupabaseContextType {
  user: User | null;
  session: Session | null;
  isAuthReady: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthReady(true);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    
    if (error) {
      console.error('Error logging in with Google:', error.message);
      if (error.message.includes('provider is not enabled')) {
        setAuthError('Google Login is not enabled in your Supabase project settings.');
      } else {
        setAuthError(error.message);
      }
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error logging out:', error.message);
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <SupabaseContext.Provider value={{ user, session, isAuthReady, authError, loginWithGoogle, logout, clearAuthError }}>
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
