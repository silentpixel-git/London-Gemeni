import { useState, useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { GameRepository } from '../../services/GameRepository';
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
  // Bumps on each capture during play (never on a load), so the UI can announce new notes.
  const [diaryCaptureCount, setDiaryCaptureCount] = useState(0);

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
      setDiaryCaptureCount(n => n + 1);
      if (user && activeInvestigation) {
        GameRepository.addDiaryEntries(activeInvestigation.id, created);
      }
    },
    [user, activeInvestigation],
  );

  return { diaryEntries, setDiaryEntries, diarySeqRef, captureDiaryEntries, diaryCaptureCount };
}
