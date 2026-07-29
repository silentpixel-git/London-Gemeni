import { aiService } from '../../services/AIService';
import { needsAiParse, buildParseCandidates } from '../../engine/parseFallback';
import { type ParsedIntent } from '../../engine/intentParser';
import { NPCState } from '../../types';

// ── AI parse fallback (Phase 3, default-on) ──────────────────────────────────
// When the deterministic parse misses, route the WHOLE input through the
// constrained parseAction op — every verb. Kill switch: VITE_AI_PARSER='off'
// disables it (pure regex parsing; misses stay in-character engine misses —
// same degraded mode as a Gemini outage, since parseAction returns null on
// any failure and the turn keeps the regex intent).
// Plain (non-optional-chained) access: Vite's define replaces the exact token
// `import.meta.env.VITE_AI_PARSER`, same pattern as supabase.ts.
export const AI_PARSER_ENABLED = (import.meta.env.VITE_AI_PARSER ?? '') !== 'off';

// Per-session memo, same pattern as targetResolveCache above.
const parseActionCache = new Map<string, ParsedIntent | null>();

export async function resolveIntentWithAI(
  intent: ParsedIntent,
  location: string,
  inventory: string[],
  npcStates: Record<string, NPCState>,
  currentAct: number,
  introducedNpcs: string[],
  elapsedMinutes: number,
  flags: Record<string, boolean>,
): Promise<ParsedIntent> {
  if (!needsAiParse(intent, location, inventory, flags)) return intent;
  const raw = intent.raw.trim();
  if (!raw) return intent;

  const key = `parse::${location}::${currentAct}::${raw.toLowerCase()}`;
  let resolved: ParsedIntent | null;
  if (parseActionCache.has(key)) {
    resolved = parseActionCache.get(key)!;
  } else {
    const candidates = buildParseCandidates(location, inventory, npcStates, currentAct, introducedNpcs, elapsedMinutes, flags);
    ({ intent: resolved } = await aiService.parseAction(raw, candidates));
    parseActionCache.set(key, resolved);
  }
  // null = no confident match → keep the regex intent (engine misses in character).
  return resolved ?? intent;
}
