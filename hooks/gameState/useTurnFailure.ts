import { useCallback, useState } from 'react';
import type { SaveGameOverrides } from './usePersistence';

export type TurnFailureCause = 'ai' | 'network' | 'engine';

export interface TurnFailure {
  cause: TurnFailureCause;
  /** Raw error text — shown in the failure screen's debug footer, never in the feed. */
  debug: string;
  /** 'narration' re-requests prose only; 'turn' re-runs the whole action. */
  retryKind: 'narration' | 'turn';
  retry: () => Promise<void>;
  /** Post-engine values for the turn's skipped autosave. Null when nothing resolved yet. */
  saveOverrides: SaveGameOverrides | null;
  attempts: number;
}

/**
 * Owns the blocking turn-failure screen's state. See
 * docs/superpowers/specs/2026-08-14-turn-failure-screen-design.md.
 */
export function useTurnFailure() {
  const [turnFailure, setTurnFailure] = useState<TurnFailure | null>(null);

  const raiseTurnFailure = useCallback((failure: Omit<TurnFailure, 'attempts'>) => {
    setTurnFailure(prev => ({ ...failure, attempts: (prev?.attempts ?? 0) + 1 }));
  }, []);

  const clearTurnFailure = useCallback(() => setTurnFailure(null), []);

  return { turnFailure, raiseTurnFailure, clearTurnFailure };
}
