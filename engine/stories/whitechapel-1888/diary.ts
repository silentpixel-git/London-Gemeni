/**
 * diary.ts — resolves a stored DiaryEntry (kind + refId + optional text) into the
 * authored, Watson-voiced title/body shown in the casebook. Keeps all story-data
 * lookups out of the React layer: the modal only renders what this returns.
 */

import { CLUE_DEFINITIONS } from './clues.js';
import { DECISION_DIARY } from './diaryDecisions.js';
import { LOCATION_DIARY } from './diaryLocations.js';

export type DiaryKind = 'clue' | 'act' | 'decision' | 'revelation' | 'location';

export interface ResolvedDiaryEntry {
  title: string;
  body: string;
}

/**
 * The act-closing reflection is AI-authored prose that may carry markdown (a
 * leading bold heading, occasional emphasis). The diary renders plain text, so
 * strip the markers here — the in-feed beat keeps its formatting untouched.
 */
function toPlainText(s: string): string {
  return (s || '')
    .replace(/^\s*\*\*.*?\*\*\s*[—–-]?\s*/, '') // drop a leading bold heading
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .trim();
}

/**
 * Structural arg — intentionally NOT importing the root DiaryEntry type so the
 * engine stays free of UI/root dependencies.
 */
export function resolveDiaryEntry(entry: {
  kind: DiaryKind;
  refId: string;
  text?: string;
}): ResolvedDiaryEntry | null {
  switch (entry.kind) {
    case 'clue': {
      const def = CLUE_DEFINITIONS[entry.refId];
      if (!def) return null;
      return { title: def.name, body: def.diaryNote };
    }
    case 'act': {
      // Titled distinctly from the act-section header it sits under.
      return { title: "Watson's reflections", body: toPlainText(entry.text || '') };
    }
    case 'decision': {
      const d = DECISION_DIARY[entry.refId];
      if (d) return { title: d.name, body: d.diaryNote };
      // AI-generated lead entry (no hand-authored DECISION_DIARY match): the
      // capture site stored "title\nbody" in entry.text.
      if (!entry.text) return null;
      const sep = entry.text.indexOf('\n');
      if (sep === -1) return { title: entry.text.trim(), body: '' };
      return { title: entry.text.slice(0, sep).trim(), body: entry.text.slice(sep + 1).trim() };
    }
    case 'location': {
      const l = LOCATION_DIARY[entry.refId];
      if (!l) return null;
      return { title: l.name, body: l.diaryNote };
    }
    default:
      return null;
  }
}
