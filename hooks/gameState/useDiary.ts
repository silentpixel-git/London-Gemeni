import { useState, useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { GameRepository } from '../../services/GameRepository';
import { LOCATION_DIARY } from '../../engine/gameData';
import { DiaryEntry, Investigation } from '../../types';

export interface DiaryDeps {
  user: User | null;
  activeInvestigation: Investigation | null;
}

export function useDiary(deps: DiaryDeps) {
  const { user, activeInvestigation } = deps;

  // ── Watson's diary (auto-captured casebook) ───────────────────────────────
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const diarySeqRef = useRef(0); // next monotonic sequence number for new entries
  // Locations already recorded — dedupes arrival entries across reloads/paths.
  const loggedLocationsRef = useRef<Set<string>>(new Set());

  // Append diary entries: stamp id + sequence, update state, persist if signed in.
  const captureDiaryEntries = useCallback(
    (items: Array<Omit<DiaryEntry, 'id' | 'sequence'>>) => {
      if (items.length === 0) return;
      const created: DiaryEntry[] = items.map(it => ({
        ...it,
        id: crypto.randomUUID(),
        sequence: diarySeqRef.current++,
      }));
      setDiaryEntries(prev => [...prev, ...created]);
      if (user && activeInvestigation) {
        GameRepository.addDiaryEntries(activeInvestigation.id, created);
      }
    },
    [user, activeInvestigation],
  );

  // Record the first arrival at a location (authored Watson line, once per place).
  const captureLocationArrival = useCallback(
    (locationId: string, actNumber: number, timeLabel: string) => {
      if (!LOCATION_DIARY[locationId]) return;
      if (loggedLocationsRef.current.has(locationId)) return;
      loggedLocationsRef.current.add(locationId);
      captureDiaryEntries([{ kind: 'location', refId: locationId, actNumber, timeLabel }]);
    },
    [captureDiaryEntries],
  );

  return { diaryEntries, setDiaryEntries, diarySeqRef, loggedLocationsRef, captureDiaryEntries, captureLocationArrival };
}
