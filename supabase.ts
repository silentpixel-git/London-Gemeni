import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase configuration
export const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase configuration is missing. Cloud features will be disabled. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
}

// Supabase JS v2 uses the browser Web Locks API (navigator.locks) to serialize
// auth operations across tabs. In a single-tab game this causes
// NavigatorLockAcquireTimeoutError when several Supabase calls fire concurrently
// at startup (getSession, getProfile, getActiveInvestigation, etc.).
// Replacing it with a simple in-memory sequential queue eliminates all lock
// contention while remaining safe for a single-user, single-tab application.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _lockHolder: Promise<any> = Promise.resolve();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inMemoryLock = <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const next: Promise<R> = _lockHolder.then(fn, fn); // always chain, never reject the queue
  _lockHolder = next.then(() => undefined, () => undefined);
  return next;
};

// Initialize the Supabase client
// If keys are missing, the client will still be created but requests will fail
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      lock: inMemoryLock,
    },
  }
);
