import { aiService } from '../../services/AIService';
import { needsAiParse, buildParseCandidates } from '../../engine/parseFallback';
import { needsTopicAiParse, buildTopicCandidates } from '../../engine/topicFallback';
import { WHITECHAPEL_MANIFEST } from '../../engine/stories/whitechapel-1888/manifest';
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

// ── TALK-topic AI fallback ───────────────────────────────────────────────────
// The subject after "about" is matched by pure string containment (matchTopic),
// which cannot cover every natural phrasing an author didn't anticipate — and a
// miss there is worse than an object miss, because the NPC answers by denying
// knowledge of a subject they may have raised themselves. This recovers the
// miss by mapping the player's phrasing onto an authored topic, then rewriting
// topicRaw to that authored phrase so the engine resolves it deterministically,
// exactly as if the player had typed it. Same kill switch as the action parser.
const parseTopicCache = new Map<string, string | null>();

export async function resolveTopicWithAI(
  intent: ParsedIntent,
  npcId: string | undefined,
  npcLabel: string,
  currentAct: number,
  flags: Record<string, boolean>,
): Promise<ParsedIntent> {
  const facts = WHITECHAPEL_MANIFEST.facts;
  if (!AI_PARSER_ENABLED) return intent;
  if (!npcId || !needsTopicAiParse(facts, intent, npcId, currentAct, flags)) return intent;

  const phrase = intent.topicRaw!.trim();
  // Flags participate in the key: the same phrase can be a miss before a gate
  // opens and a hit after it, so caching on npc+act alone would pin the wrong
  // answer for the rest of the session.
  const gateKey = Object.keys(flags).filter(f => flags[f]).sort().join(',');
  const key = `topic::${npcId}::${currentAct}::${gateKey}::${phrase.toLowerCase()}`;

  let authored: string | null;
  if (parseTopicCache.has(key)) {
    authored = parseTopicCache.get(key)!;
  } else {
    const candidates = buildTopicCandidates(facts, npcId, currentAct, flags);
    const match = await aiService.parseTopic(phrase, npcLabel, candidates);
    authored = match?.phrase ?? null;
    parseTopicCache.set(key, authored);
  }
  // null = no confident match → leave topicRaw alone so the engine produces its
  // ordinary in-character deflection.
  return authored ? { ...intent, topicRaw: authored } : intent;
}
