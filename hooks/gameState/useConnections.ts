import React, { useState, useEffect, useCallback } from 'react';
import { supabaseUrl, supabaseAnonKey, isSupabaseConfigured } from '../../supabase';

export interface ConnectionsDeps {
  isAuthReady: boolean;
  setNotification: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' } | null>>;
}

export function useConnections(deps: ConnectionsDeps) {
  const { isAuthReady, setNotification } = deps;

  const [connectionStatus, setConnectionStatus] = useState<{
    supabase: boolean | null;
  }>({ supabase: null });

  // ── Supabase connectivity ping ────────────────────────────────────────────
  // Uses a direct fetch to GoTrue's public /health endpoint instead of the
  // Supabase SDK. This avoids the SDK's internal storage-lock mechanism, which
  // can block or error during automatic token-refresh cycles and cause false
  // "cloud down" readings even when the project is perfectly healthy.
  const pingSupabase = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: supabaseAnonKey },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // Supabase check — used on mount and manual retry. Whether the turn endpoint
  // answers is known from the turns themselves (useInvestigation's engineOk).
  const checkConnections = useCallback(async () => {
    setConnectionStatus({ supabase: null });

    const supabaseOk = await pingSupabase();
    setConnectionStatus(prev => ({ ...prev, supabase: supabaseOk }));
    if (!supabaseOk) {
      setNotification({ message: 'Cloud unavailable — progress will save locally.', type: 'error' });
    }
  }, [pingSupabase]);

  // Run once when auth state is first known
  useEffect(() => {
    if (isAuthReady) checkConnections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady]);

  // Silent background monitor — re-checks every 60 s so the dot stays accurate
  // throughout the session without needing the user to click retry.
  useEffect(() => {
    if (!isAuthReady) return;
    const monitor = setInterval(async () => {
      const ok = await pingSupabase();
      setConnectionStatus(prev =>
        prev.supabase === ok ? prev : { ...prev, supabase: ok }
      );
    }, 60_000);
    return () => clearInterval(monitor);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, pingSupabase]);

  return { connectionStatus, checkConnections };
}
