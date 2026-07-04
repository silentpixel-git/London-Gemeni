/**
 * hooks/useGameState.ts
 *
 * Custom hook that owns all London Bleeds game state, refs, effects, and
 * handlers. App.tsx becomes a thin layout shell — it passes slices of this
 * hook's return value down to focused UI components.
 *
 * State ownership:
 *  - isSidebarOpen   → AppContent  (affects root layout, needed by Sidebar + Header)
 *  - isProfileMenuOpen → Header    (purely local UI state)
 *  - input (text field) → CommandInput (purely local UI state)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { GameRepository, UserProfile } from '../services/GameRepository';
import { aiService } from '../services/AIService';
import { injectAfterHeading } from '../services/narrationFormat';
import { gameEngine, SessionSnapshot, computeTimePeriod, getPresentNpcIds } from '../engine/GameEngine';
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';
import { audioManager } from '../services/AudioManager';
import { parseIntent, type ParsedIntent } from '../engine/intentParser';
import { needsAiParse, buildParseCandidates } from '../engine/parseFallback';
import { LOCATIONS, CLUE_DEFINITIONS, ACT_NAMES, ACT_BRIDGES, ACT_TIME_CONFIG, ACT_WEATHER, TRUE_ENDING_CODA, ITEM_SPENT_AFTER_ACT, DECISION_BY_FLAG, LOCATION_DIARY, OBJECT_DISPLAY_NAMES, TAKEABLE_OBJECTS, NPCS, formatGameClock } from '../engine/gameData';
import type { ActWeather } from '../engine/gameData';
import {
  INITIAL_LOCATION,
  INITIAL_ACT,
  INITIAL_INVENTORY,
  INITIAL_NPC_STATES,
  INITIAL_JOURNAL,
  INITIAL_INTRODUCED_NPCS,
  NPC_DISPLAY_NAMES,
} from '../constants';
import { GameHistoryItem, GameState, Investigation, NPCState, STIMEntry, ActJournalSummary, NarrationContext, PendingActTransition, DiaryEntry, TimePeriod, ThemeMode } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey, isSupabaseConfigured } from '../supabase';

// ── Destructure hints and diary leads from the story manifest ────────────────
const { selectHint } = WHITECHAPEL_MANIFEST;
const { isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags } = WHITECHAPEL_MANIFEST.diaryLeads;

// ── AI fallback target resolution ─────────────────────────────────────────────
// The deterministic parser is strict about NOUNS (exact name / alias / fuzzy
// only — no semantic understanding). When a parse fails to land on a target
// that is actually present here, we ask the AI to pick from THIS location's
// entities — objects for EXAMINE, people for TALK. Constrained to that list →
// it can never invent an entity or grant a clue; the engine still owns every
// clue and introduction decision. Only fires on a genuine miss, so clean inputs
// keep the instant offline fast-path.

// Per-session memo: `${kind}::${location}::${normalised raw}` → resolved id (or null).
const targetResolveCache = new Map<string, string | null>();

async function resolveTargetWithAI(
  intent: ParsedIntent,
  location: string,
  inventory: string[],
  npcStates: Record<string, NPCState>,
  currentAct: number,
  introducedNpcs: string[],
): Promise<ParsedIntent> {
  // ── NPC branch: a TALK whose person the parser could not resolve. Map the
  // phrase against the people actually present (alias-aware, so an unintroduced
  // NPC's real name never enters the prompt). Catches semantic references that
  // fuzzy matching cannot — "the witness who saw Mary", "that eager fellow".
  if (intent.type === 'talk' && !intent.targetId) {
    const raw = (intent.targetRaw || '').trim();
    const presentNpcIds = getPresentNpcIds(WHITECHAPEL_MANIFEST.npcs, location, npcStates, currentAct);
    if (!raw || presentNpcIds.length === 0) return intent;

    const key = `npc::${location}::${raw.toLowerCase()}`;
    let npcId: string | null;
    if (targetResolveCache.has(key)) {
      npcId = targetResolveCache.get(key)!;
    } else {
      const candidates = presentNpcIds.map(id => {
        const npc = NPCS[id];
        const introduced = !npc.requiresIntroduction || introducedNpcs.includes(id);
        const name = introduced
          ? `${npc.displayName} — ${npc.role}`
          : `${npc.alias ?? 'a stranger'} — ${npc.aliasDescription ?? npc.role}`;
        return { id, name };
      });
      ({ objectId: npcId } = await aiService.resolveTargetObject(raw, 'talk', candidates, 'person'));
      targetResolveCache.set(key, npcId);
    }
    return npcId ? { ...intent, targetId: npcId } : intent;
  }

  const present = LOCATIONS[location]?.interactables ?? [];

  // A resolved object that is a real object id but not actionable here (not in
  // this room and not a copy Watson carries) is treated as a soft miss —
  // typically a fuzzy/alias slip onto an object that lives elsewhere.
  const tid = intent.targetId;
  const resolvedButAbsent =
    !!tid &&
    !!OBJECT_DISPLAY_NAMES[tid] &&
    !present.includes(tid) &&
    !(TAKEABLE_OBJECTS[tid] && inventory.includes(TAKEABLE_OBJECTS[tid]));

  const isMiss =
    intent.type === 'unresolved_target' ||
    (intent.type === 'examine' && resolvedButAbsent);
  if (!isMiss) return intent;

  const raw = (intent.targetRaw || '').trim();
  if (!raw || present.length === 0) return intent;

  const key = `${location}::${raw.toLowerCase()}`;
  let objectId: string | null;
  if (targetResolveCache.has(key)) {
    objectId = targetResolveCache.get(key)!;
  } else {
    const candidates = present.map(id => ({ id, name: OBJECT_DISPLAY_NAMES[id] ?? id }));
    ({ objectId } = await aiService.resolveTargetObject(raw, 'examine', candidates));
    targetResolveCache.set(key, objectId);
  }
  if (!objectId) return intent;

  // Re-target as a normal examine so the engine runs its standard deterministic
  // clue lookup against the resolved object. Keep the player's original raw text.
  return { ...intent, type: 'examine', targetId: objectId };
}

// ── Phase 3: tool-calling parse fallback ─────────────────────────────────────
// When the deterministic parse misses, route the WHOLE input through the
// constrained parseAction op — every verb, not just examine/talk targets.
// Flag-gated: VITE_AI_PARSER='on' uses this path; anything else keeps
// resolveTargetWithAI byte-for-byte. Deleted-at-cutover: the old path.
// Plain (non-optional-chained) access: Vite's define replaces the exact token
// `import.meta.env.VITE_AI_PARSER`, same pattern as supabase.ts.
const AI_PARSER_ENABLED = (import.meta.env.VITE_AI_PARSER ?? '') === 'on';

// Per-session memo, same pattern as targetResolveCache above.
const parseActionCache = new Map<string, ParsedIntent | null>();

async function resolveIntentWithAI(
  intent: ParsedIntent,
  location: string,
  inventory: string[],
  npcStates: Record<string, NPCState>,
  currentAct: number,
  introducedNpcs: string[],
): Promise<ParsedIntent> {
  if (!needsAiParse(intent, location, inventory)) return intent;
  const raw = intent.raw.trim();
  if (!raw) return intent;

  const key = `parse::${location}::${currentAct}::${raw.toLowerCase()}`;
  let resolved: ParsedIntent | null;
  if (parseActionCache.has(key)) {
    resolved = parseActionCache.get(key)!;
  } else {
    const candidates = buildParseCandidates(location, inventory, npcStates, currentAct, introducedNpcs);
    ({ intent: resolved } = await aiService.parseAction(raw, candidates));
    parseActionCache.set(key, resolved);
  }
  // null = no confident match → keep the regex intent (engine misses in character).
  return resolved ?? intent;
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface GameStateReturn {
  // Narrative
  history: GameHistoryItem[];
  isLoading: boolean;
  isAutoScrollLocked: boolean;
  isGameOver: boolean;
  endingType: 'cold_case' | 'true_ending' | null;
  isConsultingHolmes: boolean;
  actualLastUserIdx: number;

  // World state
  location: string;
  inventory: string[];
  medicalPoints: number;
  moralPoints: number;
  currentAct: number;
  flags: Record<string, boolean>;
  npcStates: Record<string, NPCState>;
  introducedNpcs: string[];
  activeInvestigation: Investigation | null;
  slots: Investigation[];

  // In-game clock
  displayTime: string;
  displayDate: string;
  weather: ActWeather;

  // UI / persistence
  diaryEntries: DiaryEntry[];
  isSaving: boolean;

  // Appearance + atmosphere settings. themeMode is the single appearance choice
  // (light / dark / auto-by-the-hour); 'auto' follows timePeriod.
  themeMode: ThemeMode;
  setThemeMode: React.Dispatch<React.SetStateAction<ThemeMode>>;
  timePeriod: TimePeriod;
  soundEffects: boolean;
  setSoundEffects: React.Dispatch<React.SetStateAction<boolean>>;
  ambientAudio: boolean;
  setAmbientAudio: React.Dispatch<React.SetStateAction<boolean>>;
  notification: { message: string; type: 'success' | 'error' } | null;
  setNotification: React.Dispatch<React.SetStateAction<{ message: string; type: 'success' | 'error' } | null>>;
  connectionStatus: { gemini: boolean | null; supabase: boolean | null };
  retryConnections: () => Promise<void>;

  // Refs
  scrollRef: React.RefObject<HTMLDivElement>;
  lastUserMessageRef: React.RefObject<HTMLDivElement>;

  // Act-break curtain
  pendingActTransition: PendingActTransition | null;
  isActBreakReady: boolean;
  isCurtainPlaying: boolean;
  isAdvancingAct: boolean;
  beginNextAct: () => Promise<void>;
  handleJournalTypewriterDone: () => void;

  // Handlers
  handleAction: (userAction: string) => Promise<void>;
  handleSaveGame: (silent?: boolean) => Promise<void>;
  handleLoadGame: () => Promise<void>;
  handleConsultHolmes: () => Promise<void>;
  handleScroll: () => void;

  // Save slots
  refreshSlots: () => Promise<void>;
  handleSelectSlot: (investigation: Investigation) => Promise<void>;
  handleContinue: () => Promise<void>;
  handleStartInSlot: (slotNumber: number) => Promise<void>;
  handleDeleteSlot: (investigation: Investigation) => Promise<void>;
}

const CURTAIN_HOLD_MS = 4500; // enter animation eats ~1s; this leaves ~3.5s to read the act title

const OPENING_FALLBACK_NARRATIVE =
  "> *221B Baker Street. November 1888. The sitting room is no longer quite a sitting room.*\n\nHolmes paces before the fire, his pipe cold in his hand. The case files are everywhere — pinned, spread, stacked. Five murders. Eleven weeks. Scotland Yard is floundering.\n\n**Sherlock Holmes** is here.\n**Objects of interest:** Case Files Wall, Newspapers, Chemistry Table, Watson's Armchair.\n**Possible exits:** Dorset Street.";

// Extract the first prose sentence of a narration (skipping act headers and
// blockquotes) — used as anti-repetition memory for the AI.
function extractOpeningSentence(markdown: string): string | null {
  const line = markdown
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('**'));
  if (!line) return null;
  const sentence = line.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? line;
  return sentence.length > 90 ? sentence.slice(0, 90) + '…' : sentence;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGameState({ user, isAuthReady, userProfile }: { user: User | null; isAuthReady: boolean; userProfile: UserProfile | null }): GameStateReturn {

  // ── Narrative state ─────────────────────────────────────────────────────
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoScrollLocked, setIsAutoScrollLocked] = useState(true);

  // ── World state ─────────────────────────────────────────────────────────
  const [location, setLocation] = useState(INITIAL_LOCATION);
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [medicalPoints, setMedicalPoints] = useState(0);
  const [moralPoints, setMoralPoints] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  // Which ending fired ('cold_case' | 'true_ending') — drives the epilogue/coda rendering
  const [endingType, setEndingType] = useState<'cold_case' | 'true_ending' | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [npcStates, setNpcStates] = useState<Record<string, NPCState>>(
    INITIAL_NPC_STATES as Record<string, NPCState>
  );
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);
  const [slots, setSlots] = useState<Investigation[]>([]);
  const [currentAct, setCurrentAct] = useState(INITIAL_ACT);
  const [stim, setStim] = useState<Record<string, STIMEntry>>({});
  const [turnCount, setTurnCount] = useState(0);
  // NPC introduction tracking — IDs of NPCs whose real names Watson now knows.
  // Pre-seeded with professional acquaintances Watson already knows at game start.
  const [introducedNpcs, setIntroducedNpcs] = useState<string[]>(INITIAL_INTRODUCED_NPCS);

  // In-game clock — minutes elapsed since act's canonical start time
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  // How many times Watson has visited each location
  const [locationVisitCounts, setLocationVisitCounts] = useState<Record<string, number>>({});
  // First sentences of the last few narrations — anti-repetition memory for the AI
  const [recentOpenings, setRecentOpenings] = useState<string[]>([]);

  // Proactive Holmes nudge — turns at current location without discovering a clue
  const [turnsAtLocationWithoutProgress, setTurnsAtLocationWithoutProgress] = useState(0);
  // Procedural act journals — clue IDs accumulated since last act advance
  const [cluesFoundThisAct, setCluesFoundThisAct] = useState<string[]>([]);

  // ── Act-break curtain ─────────────────────────────────────────────────────
  const [pendingActTransition, setPendingActTransition] = useState<PendingActTransition | null>(null);
  const [isActBreakReady, setIsActBreakReady] = useState(false);   // diary finished typing → show Begin
  const [isCurtainPlaying, setIsCurtainPlaying] = useState(false); // cinematic overlay animating
  // True only while the NEW act's opening scene is streaming, after the curtain
  // has closed. Distinguishes this (much longer) generation from a normal turn
  // so the command bar can show a dedicated message instead of a generic one.
  const [isAdvancingAct, setIsAdvancingAct] = useState(false);

  // ── Journal / sidebar ───────────────────────────────────────────────────
  // journalNotes still persists to the legacy investigations.journal_notes column
  // but is no longer surfaced anywhere — Watson's diary is now the diaryEntries
  // casebook below. Kept only to avoid a destructive DB migration.
  const [journalNotes, setJournalNotes] = useState(INITIAL_JOURNAL);
  const [isConsultingHolmes, setIsConsultingHolmes] = useState(false);

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

  // ── Persistence / UI ────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    gemini: boolean | null;
    supabase: boolean | null;
  }>({ gemini: null, supabase: null });
  // Single appearance choice — defaults to light. Reads the new key first, then
  // falls back to the legacy lb-theme / lb-atmospheric-theme pair so existing
  // players keep their setting (atmospheric → 'auto', dark → 'dark').
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('lb-theme-mode');
      if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
      if (localStorage.getItem('lb-atmospheric-theme') === 'on') return 'auto';
      if (localStorage.getItem('lb-theme') === 'dark') return 'dark';
    } catch {}
    return 'light';
  });
  // Atmosphere audio — default off, persisted to localStorage (POC).
  const [soundEffects, setSoundEffects] = useState<boolean>(() => {
    try { return localStorage.getItem('lb-sound-effects') === 'on'; } catch { return false; }
  });
  const [ambientAudio, setAmbientAudio] = useState<boolean>(() => {
    try { return localStorage.getItem('lb-ambient-audio') === 'on'; } catch { return false; }
  });

  // ── Refs ─────────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const hasGeneratedOpening = useRef(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const lastUserMsgIdx = [...history].reverse().findIndex(m => m.role === 'user');
  const actualLastUserIdx = lastUserMsgIdx === -1 ? -1 : history.length - 1 - lastUserMsgIdx;

  // In-game time-of-day phase — drives atmospheric theming and (later) audio.
  const currentTimePeriod = computeTimePeriod(
    (ACT_TIME_CONFIG[currentAct] ?? ACT_TIME_CONFIG[1]).canonicalMinutes + elapsedMinutes,
  );

  // ── Effects ───────────────────────────────────────────────────────────────

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

  // Full connection check (Supabase + Gemini) — used on mount and manual retry
  const checkConnections = useCallback(async () => {
    setConnectionStatus({ gemini: null, supabase: null });

    const supabaseOk = await pingSupabase();
    setConnectionStatus(prev => ({ ...prev, supabase: supabaseOk }));
    if (!supabaseOk) {
      setNotification({ message: 'Cloud unavailable — progress will save locally.', type: 'error' });
    }

    try {
      const test = await aiService.ping();
      setConnectionStatus(prev => ({ ...prev, gemini: test.toLowerCase().includes('ok') }));
    } catch {
      setConnectionStatus(prev => ({ ...prev, gemini: false }));
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

  // Apply the active data-theme. In 'auto' the palette follows the in-game clock
  // (evening/night); 'light' and 'dark' apply that palette directly. Because it's
  // one choice, a manual dark selection can never be silently overridden.
  useEffect(() => {
    let theme: string;
    if (themeMode === 'auto') {
      theme = (currentTimePeriod === 'night' || currentTimePeriod === 'lateNight') ? 'night'
            : (currentTimePeriod === 'evening' || currentTimePeriod === 'dawn')   ? 'evening'
            : 'light';
    } else {
      theme = themeMode; // 'light' | 'dark'
    }
    document.documentElement.dataset.theme = theme;
  }, [themeMode, currentTimePeriod]);

  // Persist the appearance choice — localStorage + Supabase cloud sync.
  useEffect(() => {
    try { localStorage.setItem('lb-theme-mode', themeMode); } catch {}
    // Sync to cloud when logged in (user accessed via closure — intentionally omitted from deps)
    if (user) {
      GameRepository.upsertProfile(user.id, { themePreference: themeMode });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  // Persist the atmosphere audio toggles — localStorage only for the POC.
  useEffect(() => {
    try { localStorage.setItem('lb-sound-effects', soundEffects ? 'on' : 'off'); } catch {}
  }, [soundEffects]);
  useEffect(() => {
    try { localStorage.setItem('lb-ambient-audio', ambientAudio ? 'on' : 'off'); } catch {}
  }, [ambientAudio]);

  // Load appearance preference from cloud when user profile becomes available
  useEffect(() => {
    const pref = userProfile?.themePreference;
    if (pref === 'light' || pref === 'dark' || pref === 'auto') {
      setThemeMode(pref);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]); // only fire when user identity changes, not on every profile update

  // Scroll to active turn when new assistant placeholder appears
  const scrollToActiveTurn = useCallback(() => {
    if (lastUserMessageRef.current) {
      lastUserMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const lastMsg = history[history.length - 1];
    if (
      lastMsg?.role === 'assistant' &&
      lastMsg.text === '' &&
      history.length > 1 &&
      history[history.length - 2].role === 'user'
    ) {
      requestAnimationFrame(() => scrollToActiveTurn());
    }
  }, [history.length, scrollToActiveTurn]);

  // ── Scroll helpers ────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setIsAutoScrollLocked(scrollHeight - scrollTop - clientHeight < 100);
    }
  }, []);

  const scrollToBottom = useCallback(
    (force = false) => {
      if (scrollRef.current && (isAutoScrollLocked || force)) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    },
    [isAutoScrollLocked]
  );

  // The "look"-based scene generators (opening / act arrival / resume) render
  // one-shot vignettes but, unlike a normal turn in handleAction, never commit
  // the engine's flagsUpdate — so the vignette's `vignette_*` guard flag was
  // never recorded and the vignette re-fired on every arrival/resume. Commit just
  // those keys (NOT location/progression flags, which gate act advancement) so a
  // vignette fires at most once. `baseFlags` is the freshest known flag set for
  // the cloud write; persistence is skipped when no investigation id is available.
  const commitVignetteFlags = useCallback((
    flagsUpdate: Record<string, boolean> | undefined,
    baseFlags: Record<string, boolean>,
    investigationId?: string,
  ) => {
    if (!flagsUpdate) return;
    const vig = Object.fromEntries(
      Object.entries(flagsUpdate).filter(([k]) => k.startsWith('vignette_'))
    );
    if (Object.keys(vig).length === 0) return;
    setFlags(prev => ({ ...prev, ...vig }));
    if (user && investigationId) {
      GameRepository.updateInvestigation(investigationId, { globalFlags: { ...baseFlags, ...vig } });
    }
  }, [user]);

  // ── Opening scene ─────────────────────────────────────────────────────────

  const generateOpeningScene = useCallback(async () => {
    if (hasGeneratedOpening.current) return;
    hasGeneratedOpening.current = true;
    // Seed the diary with the opening locale so it is never empty on a fresh start.
    captureLocationArrival(INITIAL_LOCATION, INITIAL_ACT, formatGameClock(INITIAL_ACT, 0));
    setIsLoading(true);
    setHistory([{ role: 'assistant', text: '' }]);

    try {
      const intent = parseIntent('look');
      const snapshot: SessionSnapshot = {
        location: INITIAL_LOCATION,
        inventory: INITIAL_INVENTORY,
        flags: {},
        npcStates: INITIAL_NPC_STATES as Record<string, NPCState>,
        currentAct: INITIAL_ACT,
        medicalPoints: 0,
        moralPoints: 0,
        discoveredClueIds: [],
        investigationId: undefined,
        turnsAtLocationWithoutProgress: 0,
        elapsedMinutes: 0,
        introducedNpcs: INITIAL_INTRODUCED_NPCS,
        locationVisitCounts: {},
        turnCount: 0,
      };
      const result = gameEngine.resolve(intent, snapshot);
      commitVignetteFlags(result.flagsUpdate, {}, activeInvestigation?.id);

      const OPENING_FIXED_LINE = "I arrived at Baker Street on the evening of the eighth of November, 1888 - three months after the Jack the Ripper murders had begun, and the day before it concluded.\n\n";
      let lastText = '';
      for await (const update of aiService.stream({ ...result.aiContext, narrationMode: 'opening', blockquoteHint: 'none' })) {
        if (update.narrative) {
          lastText = update.narrative;
          setHistory([{ role: 'assistant', text: injectAfterHeading(lastText, OPENING_FIXED_LINE) }]);
        }
      }
      if (!lastText) setHistory([{ role: 'assistant', text: OPENING_FIXED_LINE + OPENING_FALLBACK_NARRATIVE }]);
    } catch (error) {
      console.error('Opening scene generation failed:', error);
      setHistory([{ role: 'assistant', text: OPENING_FALLBACK_NARRATIVE }]);
    } finally {
      setIsLoading(false);
    }
  }, [captureLocationArrival, commitVignetteFlags]);

  // ── Save / load ───────────────────────────────────────────────────────────

  // Stream a single fresh "look" when RESUMING a saved game. The loaded
  // authoritative snapshot is the source of truth — we do NOT replay the stored
  // transcript; the diary carries the durable record. Takes the loaded values as
  // explicit args (the loader's setX calls haven't flushed to closure state yet),
  // builds a look at the SAVED location/act (not an act anchor), and starts the
  // feed clean. Mirrors streamArrivalScene minus the act-entry concerns.
  const streamResumeScene = useCallback(async (resume: {
    location: string;
    act: number;
    inventory: string[];
    flags: Record<string, boolean>;
    npcStates: Record<string, NPCState>;
    medicalPoints: number;
    moralPoints: number;
    introducedNpcs: string[];
    elapsedMinutes: number;
    investigationId?: string;
  }) => {
    setHistory([{ role: 'assistant', text: '' }]);
    setIsAutoScrollLocked(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
    try {
      const intent = parseIntent('look');
      const snapshot: SessionSnapshot = {
        location: resume.location,
        inventory: resume.inventory,
        flags: resume.flags,
        npcStates: resume.npcStates,
        currentAct: resume.act,
        medicalPoints: resume.medicalPoints,
        moralPoints: resume.moralPoints,
        discoveredClueIds: [],
        investigationId: resume.investigationId,
        turnsAtLocationWithoutProgress: 0,
        elapsedMinutes: resume.elapsedMinutes,
        introducedNpcs: resume.introducedNpcs,
        locationVisitCounts: {},
        turnCount: 0,
      };
      const result = gameEngine.resolve(intent, snapshot);
      commitVignetteFlags(result.flagsUpdate, resume.flags, resume.investigationId);
      let last = '';
      for await (const update of aiService.stream({ ...result.aiContext, narrationMode: 'full', blockquoteHint: 'world_event' })) {
        if (update.narrative) {
          last = update.narrative;
          setHistory(prev => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], text: last };
            return next;
          });
        }
      }
    } catch (e) {
      console.error('Resume scene failed', e);
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], text: `### ${ACT_NAMES[resume.act] ?? `Act ${resume.act}`}` };
        return next;
      });
    }
  }, [commitVignetteFlags]);

  // Hydrate all React state from a cloud investigation (a save slot).
  // Shared by the slot menu (handleSelectSlot) and the anonymous-fallback loader.
  const loadInvestigationIntoState = useCallback(async (investigation: Investigation) => {
    const inv = (investigation as any).inventory || INITIAL_INVENTORY;
    // Use ?? not || — Act 0 (the prologue) is a valid act and must not fall back to 1.
    const act = (investigation as any).currentAct ?? INITIAL_ACT;
    // Strip inert pre-refactor reload markers so old saves don't carry dead flags.
    const loadedFlags = Object.fromEntries(
      Object.entries(investigation.globalFlags as Record<string, boolean>)
        .filter(([k]) => !k.startsWith('__pending_act_to_'))
    );
    const loadedIntroduced = (investigation as any).introducedNpcs?.length
      ? ((investigation as any).introducedNpcs as string[])
      : INITIAL_INTRODUCED_NPCS;
    const loadedElapsed = (investigation as any).elapsedMinutes ?? 0;

    setLocation(investigation.currentLocation);
    setInventory(inv);
    setMedicalPoints(investigation.medicalPoints || 0);
    setMoralPoints(investigation.moralPoints || 0);
    setCurrentAct(act);
    setIsGameOver(investigation.status === 'solved');
    setFlags(loadedFlags);
    setJournalNotes(investigation.journalNotes || INITIAL_JOURNAL);
    setIntroducedNpcs(loadedIntroduced);
    setElapsedMinutes(loadedElapsed);
    setActiveInvestigation(investigation);

    // Load Watson's diary casebook for this investigation.
    const loadedDiary = await GameRepository.getDiaryEntries(investigation.id);
    setDiaryEntries(loadedDiary);
    diarySeqRef.current = loadedDiary.reduce((m, e) => Math.max(m, e.sequence), -1) + 1;
    loggedLocationsRef.current = new Set(loadedDiary.filter(e => e.kind === 'location').map(e => e.refId));

    const npcMap = await GameRepository.getAllNPCStates(investigation.id);
    const loadedNpcStates: Record<string, NPCState> = Object.keys(npcMap).length > 0
      ? { ...(INITIAL_NPC_STATES as Record<string, NPCState>), ...npcMap }
      : (INITIAL_NPC_STATES as Record<string, NPCState>);
    setNpcStates(loadedNpcStates);

    setStim((investigation as any).stim || {});

    // The resume look replaces the opening; clear any held transition.
    setPendingActTransition(null);
    setIsActBreakReady(false);
    setIsCurtainPlaying(false);

    // A brand-new slot (untouched prologue) keeps the authored dated intro.
    const isFreshSlot = act === INITIAL_ACT
      && investigation.currentLocation === INITIAL_LOCATION
      && Object.keys(loadedFlags).length === 0
      && loadedDiary.length === 0;

    if (isFreshSlot) {
      hasGeneratedOpening.current = false;
      setHistory([]);
      generateOpeningScene();
      return;
    }

    // Resume: do NOT replay the stored transcript — open with one fresh look at
    // the saved location/act. The diary holds the durable record of clues/objects.
    hasGeneratedOpening.current = true;
    setIsLoading(true);
    try {
      await streamResumeScene({
        location: investigation.currentLocation,
        act,
        inventory: inv,
        flags: loadedFlags,
        npcStates: loadedNpcStates,
        medicalPoints: investigation.medicalPoints || 0,
        moralPoints: investigation.moralPoints || 0,
        introducedNpcs: loadedIntroduced,
        elapsedMinutes: loadedElapsed,
        investigationId: investigation.id,
      });
    } finally {
      setIsLoading(false);
    }
    setNotification({ message: 'Investigation Resumed!', type: 'success' });
  }, [generateOpeningScene, streamResumeScene]);

  const handleSaveGame = useCallback(async (silent = false) => {
    setIsSaving(true);

    const gameState: GameState = {
      history,
      location,
      inventory,
      medicalPoints,
      moralPoints,
      npcStates,
      flags,
      journalNotes,
      diaryEntries,
      introducedNpcs,
      currentAct,
      timestamp: new Date().toLocaleString(),
    };

    try {
      localStorage.setItem('londonBleedsSave', JSON.stringify(gameState));

      if (user && activeInvestigation) {
        const updated = await GameRepository.updateInvestigation(activeInvestigation.id, {
          currentLocation: location,
          medicalPoints,
          moralPoints,
          currentAct,
          inventory,
          globalFlags: flags,
          journalNotes,
          stim,
          introducedNpcs,
        });
        if (updated) setActiveInvestigation(updated as Investigation);
        // Safety net: upsert the whole diary (idempotent by id) so any entry
        // captured before activeInvestigation was set still reaches the DB.
        if (diaryEntries.length > 0) {
          GameRepository.addDiaryEntries(activeInvestigation.id, diaryEntries);
        }
        if (!silent) setNotification({ message: 'Game Saved to Cloud!', type: 'success' });
      } else {
        if (!silent) setNotification({ message: 'Game Saved Locally!', type: 'success' });
      }
    } catch (e) {
      console.error('Save failed', e);
      if (!silent) setNotification({ message: 'Failed to save game.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeInvestigation, history, location, inventory, medicalPoints, moralPoints, npcStates, flags, journalNotes, diaryEntries, currentAct, introducedNpcs]);

  // Always-fresh handle to handleSaveGame so async flows (e.g. beginNextAct) can
  // persist the LATEST committed state rather than a stale closure snapshot.
  const handleSaveGameRef = useRef(handleSaveGame);
  useEffect(() => { handleSaveGameRef.current = handleSaveGame; }, [handleSaveGame]);

  // Stream Watson's arrival into a new act's anchor location. Mirrors
  // generateOpeningScene but for a committed act transition. `npcUpdates` are the
  // act-entry NPC movements — merged in so the arrival sees the NEW act's positions
  // (the captured npcStates is still the pre-commit Act-N-1 snapshot).
  const streamArrivalScene = useCallback(async (
    toAct: number,
    anchor: string,
    npcUpdates: Record<string, Partial<NPCState>>,
  ) => {
    const arrivalNpcStates = { ...npcStates };
    Object.entries(npcUpdates).forEach(([id, upd]) => {
      arrivalNpcStates[id] = {
        ...(arrivalNpcStates[id] || { npcId: id, disposition: 50, status: 'alive' }),
        ...upd,
      } as NPCState;
    });
    // Mirror the act-boundary bag prune so the arrival narration never references
    // an item Watson just dropped (e.g. the spent "Dear Boss" clipping).
    const arrivalInventory = inventory.filter(item => {
      const spentAfter = ITEM_SPENT_AFTER_ACT[item];
      return spentAfter === undefined || toAct <= spentAfter;
    });
    // Fresh feed for the new act — clear the prior act's transcript and pin to
    // the top so it reads as a clean start (masthead + the act's opening scene).
    setHistory([{ role: 'assistant', text: '' }]);
    setIsAutoScrollLocked(false);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
    try {
      const intent = parseIntent('look');
      const snapshot: SessionSnapshot = {
        location: anchor,
        inventory: arrivalInventory,
        flags,
        npcStates: arrivalNpcStates,
        currentAct: toAct,
        medicalPoints,
        moralPoints,
        discoveredClueIds: [],
        investigationId: activeInvestigation?.id,
        turnsAtLocationWithoutProgress: 0,
        elapsedMinutes: 0,
        introducedNpcs,
        locationVisitCounts,
        turnCount,
      };
      const result = gameEngine.resolve(intent, snapshot);
      commitVignetteFlags(result.flagsUpdate, flags, activeInvestigation?.id);
      // Authored bridge ("why we are here") injected after the AI's act heading,
      // mirroring the opening's fixed line. Empty for any act without one.
      const bridge = ACT_BRIDGES[toAct] ? ACT_BRIDGES[toAct] + '\n\n' : '';
      let last = '';
      for await (const update of aiService.stream({ ...result.aiContext, narrationMode: 'full', blockquoteHint: 'world_event' })) {
        if (update.narrative) {
          last = update.narrative;
          setHistory(prev => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], text: injectAfterHeading(last, bridge) };
            return next;
          });
        }
      }
    } catch (e) {
      console.error('Arrival scene failed', e);
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], text: `### Act ${toAct}` };
        return next;
      });
    }
  }, [inventory, flags, npcStates, medicalPoints, moralPoints, activeInvestigation, introducedNpcs, locationVisitCounts, turnCount, commitVignetteFlags]);

  // Player clicked "Begin Act N": play the cinematic curtain, commit the held
  // state behind it, then stream the arrival scene.
  const beginNextAct = useCallback(async () => {
    const pending = pendingActTransition;
    if (!pending || isCurtainPlaying) return;

    setIsCurtainPlaying(true);
    setIsActBreakReady(false);

    // Hold the curtain a beat (matches ActBreakCurtain's enter+hold animation).
    await new Promise(res => setTimeout(res, CURTAIN_HOLD_MS));

    const { toAct, newLocation, npcUpdates } = pending;

    // Commit the four held pieces — sidebar flips to the new act now (behind the overlay).
    setCurrentAct(toAct);
    audioManager.playSfx('act-bell');
    setLocation(newLocation);
    setLocationVisitCounts(prev => ({ ...prev, [newLocation]: (prev[newLocation] ?? 0) + 1 }));
    captureLocationArrival(newLocation, toAct, formatGameClock(toAct, 0)); // diary: arriving in the new act's locale at its canonical start
    setElapsedMinutes(0);
    if (Object.keys(npcUpdates).length > 0) {
      setNpcStates(prev => {
        const next = { ...prev };
        Object.entries(npcUpdates).forEach(([id, upd]) => {
          next[id] = { ...(next[id] || { npcId: id, disposition: 50, status: 'alive' }), ...upd } as NPCState;
        });
        return next;
      });
    }

    // Bag hygiene — time has moved on, so drop any carried item whose authored
    // "spent" act has now passed (keeps only what later beats still need).
    setInventory(prev => prev.filter(item => {
      const spentAfter = ITEM_SPENT_AFTER_ACT[item];
      return spentAfter === undefined || toAct <= spentAfter;
    }));

    setPendingActTransition(null);
    setIsCurtainPlaying(false);

    // Clear the prior act and stream the new act's opening fresh (see
    // streamArrivalScene). Lock input across the stream so a command can't race
    // with / clobber it.
    setIsLoading(true);
    setIsAdvancingAct(true);
    try {
      await streamArrivalScene(toAct, newLocation, npcUpdates);
    } finally {
      setIsLoading(false);
      setIsAdvancingAct(false);
    }

    // Persist the committed Act-N state via the fresh ref (flags now marker-free).
    handleSaveGameRef.current(true);
  }, [pendingActTransition, isCurtainPlaying, streamArrivalScene, captureLocationArrival]);

  const handleLoadGame = useCallback(async () => {
    // Hydrate authoritative state from a local (guest) save and open with one
    // fresh look — the stored transcript is ignored (diary carries continuity).
    // Local saves don't store currentAct/elapsedMinutes, so the act is derived
    // from the saved location and the clock starts at the act's canonical time.
    const resumeFromLocalSave = async (state: GameState) => {
      // Prefer the saved act; fall back to location-derived for older local saves
      // (ambiguous for shared anchors, e.g. bond_office serves Act 5 and Act 6).
      const guestAct = state.currentAct ?? LOCATIONS[state.location]?.act ?? INITIAL_ACT;
      const guestNpcStates = state.npcStates || (INITIAL_NPC_STATES as Record<string, NPCState>);
      const guestIntroduced = state.introducedNpcs?.length ? state.introducedNpcs : INITIAL_INTRODUCED_NPCS;
      setLocation(state.location);
      setInventory(state.inventory);
      setMedicalPoints(state.medicalPoints || 0);
      setMoralPoints(state.moralPoints || 0);
      setCurrentAct(guestAct);
      setElapsedMinutes(0);
      setFlags(state.flags || {});
      setJournalNotes(state.journalNotes || INITIAL_JOURNAL);
      setNpcStates(guestNpcStates);
      setIntroducedNpcs(guestIntroduced);
      if (state.diaryEntries) {
        setDiaryEntries(state.diaryEntries);
        diarySeqRef.current = state.diaryEntries.reduce((m, e) => Math.max(m, e.sequence), -1) + 1;
        loggedLocationsRef.current = new Set(state.diaryEntries.filter(e => e.kind === 'location').map(e => e.refId));
      }
      setPendingActTransition(null);
      setIsActBreakReady(false);
      setIsCurtainPlaying(false);
      hasGeneratedOpening.current = true;
      setIsLoading(true);
      try {
        await streamResumeScene({
          location: state.location,
          act: guestAct,
          inventory: state.inventory,
          flags: state.flags || {},
          npcStates: guestNpcStates,
          medicalPoints: state.medicalPoints || 0,
          moralPoints: state.moralPoints || 0,
          introducedNpcs: guestIntroduced,
          elapsedMinutes: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    try {
      if (user) {
        const investigation = await GameRepository.getActiveInvestigation(user.id);
        if (investigation) {
          await loadInvestigationIntoState(investigation);
        }
        return;
      }

      // Local fallback (not logged in)
      const savedData = localStorage.getItem('londonBleedsSave');
      if (savedData) {
        const state = JSON.parse(savedData) as GameState;
        setNotification({ message: `Local Save Loaded! (${state.timestamp})`, type: 'success' });
        await resumeFromLocalSave(state);
      }
    } catch (e) {
      console.error('Load failed', e);

      // Cloud unreachable — attempt local save fallback so the game is never stuck
      try {
        const savedData = localStorage.getItem('londonBleedsSave');
        if (savedData) {
          const state = JSON.parse(savedData) as GameState;
          if (state.location) {
            setNotification({ message: 'Cloud unavailable — local save loaded.', type: 'error' });
            await resumeFromLocalSave(state);
            return;
          }
        }
      } catch {}

      // No local save either — generate a fresh opening scene so the screen is never blank
      setNotification({ message: 'Cloud unavailable — starting fresh locally.', type: 'error' });
      if (history.length === 0) {
        hasGeneratedOpening.current = false;
        generateOpeningScene();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, generateOpeningScene, loadInvestigationIntoState, streamResumeScene]);

  // ── Save slots ──────────────────────────────────────────────────────────────
  // On login the app shows a slot-select menu (see App.tsx) instead of auto-loading,
  // so the player is never dropped straight back into their last location.

  const refreshSlots = useCallback(async () => {
    if (!user) { setSlots([]); return; }
    const list = await GameRepository.listActiveSlots(user.id);
    setSlots(list);
  }, [user]);

  const handleSelectSlot = useCallback(async (investigation: Investigation) => {
    await loadInvestigationIntoState(investigation);
  }, [loadInvestigationIntoState]);

  const handleContinue = useCallback(async () => {
    if (slots.length === 0) return;
    const mostRecent = [...slots].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
    await loadInvestigationIntoState(mostRecent);
  }, [slots, loadInvestigationIntoState]);

  // Generate opening scene for fresh unauthenticated starts
  useEffect(() => {
    if (!user && isAuthReady && history.length === 0) {
      generateOpeningScene();
    }
  }, [isAuthReady, user, generateOpeningScene, history.length]);

  // Real-time Supabase sync
  useEffect(() => {
    if (!user || !activeInvestigation) return;

    const channel = supabase
      .channel(`investigation-${activeInvestigation.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'investigations',
        filter: `id=eq.${activeInvestigation.id}`,
      }, (payload) => {
        const data = payload.new as any;
        // Apply all incoming DB updates — subscription only fires on genuine changes.
        setLocation(data.current_location);
        setInventory(data.inventory || []);
        setMedicalPoints(data.medical_points);
        setMoralPoints(data.moral_points);
        setCurrentAct(data.current_act ?? INITIAL_ACT);
        if (data.elapsed_minutes !== undefined) setElapsedMinutes(data.elapsed_minutes ?? 0);
        setFlags(data.global_flags || {});
        setJournalNotes(data.journal_notes || INITIAL_JOURNAL);
        setActiveInvestigation(prev =>
          prev
            ? {
                ...prev,
                currentLocation: data.current_location,
                medicalPoints: data.medical_points,
                moralPoints: data.moral_points,
                globalFlags: data.global_flags,
                journalNotes: data.journal_notes,
                updatedAt: data.updated_at,
              }
            : null
        );
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'npc_states',
        filter: `investigation_id=eq.${activeInvestigation.id}`,
      }, (payload) => {
        const data = payload.new as any;
        setNpcStates(prev => {
          const existing = prev[data.npc_id];
          if (
            existing &&
            existing.lastInteraction === data.last_interaction &&
            existing.status === data.status
          ) {
            return prev;
          }
          return {
            ...prev,
            [data.npc_id]: {
              npcId: data.npc_id,
              disposition: data.disposition,
              currentLocation: data.current_location,
              status: data.status,
              lastInteraction: data.last_interaction,
              memory: data.memory,
            },
          };
        });
      })
      // NOTE: no logs-INSERT handler. The feed is a clean per-session view (resume
      // opens with a fresh look; the diary carries continuity), so injecting logged
      // rows from another tab would reintroduce stale cross-session prose. Only the
      // authoritative investigations/npc_states sync across tabs.
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // Only recreate channel when investigation identity changes, not on every save.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeInvestigation?.id]);

  // ── Main action handler ────────────────────────────────────────────────────

  const handleAction = useCallback(async (userAction: string) => {
    if (!userAction.trim() || isLoading) return;

    setIsLoading(true);
    setIsAutoScrollLocked(false);

    setHistory(prev => [...prev, { role: 'user', text: userAction }]);
    setHistory(prev => [...prev, { role: 'assistant', text: '' }]);

    // Persist user action to log
    if (user && activeInvestigation) {
      GameRepository.addLogEntry(activeInvestigation.id, {
        timestamp: new Date().toISOString(),
        type: 'action',
        content: userAction,
      });
    }

    try {
      // STEP 1: Parse intent deterministically
      let intent = parseIntent(userAction);

      // STEP 2.5: AI fallback — only when the deterministic parse missed a target.
      // Resolves a natural-language/paraphrased object (examine) or person (talk)
      // against THIS location's entities so the engine can fire. No-op (and no
      // latency) on hits. With VITE_AI_PARSER='on', the Phase 3 tool-calling parse
      // handles ALL miss types instead.
      intent = AI_PARSER_ENABLED
        ? await resolveIntentWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs)
        : await resolveTargetWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs);

      // STEP 2: Build session snapshot from current React state
      const discoveredClueIds = user && activeInvestigation
        ? await GameRepository.getDiscoveredClueIds(activeInvestigation.id)
        : [];

      const snapshot: SessionSnapshot = {
        location,
        inventory,
        flags,
        npcStates,
        currentAct,
        medicalPoints,
        moralPoints,
        discoveredClueIds,
        investigationId: activeInvestigation?.id,
        turnsAtLocationWithoutProgress,
        elapsedMinutes,
        introducedNpcs,
        locationVisitCounts,
        turnCount,
      };

      // STEP 3: Engine resolves — no AI yet
      const result = gameEngine.resolve(intent, snapshot);

      // STEP 3b: Process NPC introduction flags (alias system)
      // Extract npc_introduced_* keys and update introducedNpcs[] state.
      const introFlags = result.introductionFlagsUpdate;
      if (introFlags) {
        const newIntros = Object.keys(introFlags)
          .filter(k => k.startsWith('npc_introduced_') && introFlags[k])
          .map(k => k.replace('npc_introduced_', ''));
        if (newIntros.length > 0) {
          setIntroducedNpcs(prev => {
            const next = [...prev];
            for (const npcId of newIntros) {
              if (!next.includes(npcId)) next.push(npcId);
            }
            return next;
          });
        }
      }

      // STEP 4: Apply state changes optimistically
      const newLocation  = result.newLocation || location;
      const newInventory = (() => {
        let inv = [...inventory];
        if (result.inventoryAdd)    inv = [...inv, ...result.inventoryAdd.filter(i => !inv.includes(i))];
        if (result.inventoryRemove) inv = inv.filter(i => !result.inventoryRemove!.includes(i));
        return inv;
      })();
      const newMedicalPoints = result.medicalPointsDelta ? medicalPoints + result.medicalPointsDelta : medicalPoints;
      const newMoralPoints   = result.moralPointsDelta   ? moralPoints  + result.moralPointsDelta   : moralPoints;
      const newFlags         = result.flagsUpdate        ? { ...flags, ...result.flagsUpdate }      : flags;

      const advancingAct = !!result.newAct && !result.gameOver;

      // On an act-advance we HOLD the sidebar-visible state (location, act, npcs,
      // clock) in React until the player clicks "Begin Act N" — so the cinematic
      // (journal beat → Begin button) reads against the old act. The DB, however,
      // is committed to the NEW act this turn (STEP 5) so a mid-curtain reload
      // resumes correctly in the new act.
      if (!advancingAct) {
        setLocation(newLocation);
        if (result.newLocation) {
          setLocationVisitCounts(prev => ({
            ...prev,
            [result.newLocation!]: (prev[result.newLocation!] ?? 0) + 1,
          }));
        }
      }
      setInventory(newInventory);
      setMedicalPoints(newMedicalPoints);
      setMoralPoints(newMoralPoints);
      setFlags(newFlags);
      if (result.gameOver) {
        setIsGameOver(true);
        if (result.endingType) setEndingType(result.endingType);
      }

      if (result.npcUpdates && !advancingAct) {
        setNpcStates(prev => {
          const next = { ...prev };
          Object.entries(result.npcUpdates!).forEach(([id, upd]) => {
            next[id] = { ...(next[id] || { npcId: id, disposition: 50, status: 'alive' }), ...upd } as NPCState;
          });
          return next;
        });
      }

      // Update turns-without-progress counter (for Holmes nudge)
      const madeProgress = !!(result.newLocation || result.newAct ||
        (result.discoveredClueIds && result.discoveredClueIds.length > 0));
      if (madeProgress) {
        setTurnsAtLocationWithoutProgress(0);
      } else {
        setTurnsAtLocationWithoutProgress(prev => prev + 1);
      }

      // Advance in-game clock. Compute the new value locally so it can be both
      // set in state and persisted this turn (see applyEngineResult below).
      // The clock resets to the new act's canonical start only at Begin (commit).
      // On an act-advance turn we keep advancing Act I's clock normally so the
      // held sidebar stays coherent until the curtain.
      const ACTION_TIME_MINUTES: Partial<Record<typeof result.actionType, number>> = {
        move: 10, talk: 5, deduce: 5, examine: 2,
        use: 2, take: 1, inventory: 0, query: 1, help: 0, other: 2,
      };
      // On an act-advance the clock persists at the new act's canonical start (0);
      // React's elapsedMinutes stays held until Begin (see the hold comment above).
      const actionMinutes = ACTION_TIME_MINUTES[result.actionType] ?? 2;
      const newElapsedMinutes = advancingAct ? 0 : elapsedMinutes + actionMinutes;
      if (!advancingAct) setElapsedMinutes(newElapsedMinutes);
      // Clock label for any diary entries captured this turn. Use the held clock
      // (current act + this action's time), not the next act's reset — entries
      // captured this turn belong to the current act even on an advancing turn.
      const captureTimeLabel = formatGameClock(currentAct, elapsedMinutes + actionMinutes);
      setTurnCount(t => t + 1);

      // Hour-bell clock event — fires when the turn crosses an hour boundary
      const actStartMinutes = (ACT_TIME_CONFIG[currentAct] ?? ACT_TIME_CONFIG[1]).canonicalMinutes;
      const prevHour = Math.floor((actStartMinutes + elapsedMinutes) / 60);
      const newHour  = Math.floor((actStartMinutes + newElapsedMinutes) / 60);
      const clockEvent = !result.newAct && newHour > prevHour
        ? (() => {
            const hour12 = ((newHour % 12) === 0 ? 12 : newHour % 12);
            return `A church bell, streets away, counts ${hour12} — work it into the prose as a passing detail, one clause at most.`;
          })()
        : undefined;

      // Capture journal data before resetting per-act tracking (if act is advancing)
      let pendingJournalSummary: ActJournalSummary | null = null;
      // Gate flags this turn satisfied with no existing diary text — filled in
      // asynchronously below (STEP 8b), once the turn's narration is known.
      let pendingLeadFlags: string[] = [];
      // The turn's final narration text, captured inside the STEP 7 stream loop —
      // used to ground STEP 8b's AI-generated diary prose.
      let finalNarrationText = '';
      if (result.newAct) {
        const allActClueIds = [
          ...cluesFoundThisAct,
          ...(result.discoveredClueIds || []),
        ];
        pendingJournalSummary = {
          actNumber: currentAct,
          actName: ACT_NAMES[currentAct] || `Act ${currentAct}`,
          cluesFound: allActClueIds
            .map(id => CLUE_DEFINITIONS[id])
            .filter(Boolean)
            .map(c => ({ name: c.name, description: c.description })),
        };
        setCluesFoundThisAct([]); // reset for the new act
      } else if (result.discoveredClueIds && result.discoveredClueIds.length > 0) {
        setCluesFoundThisAct(prev => [...prev, ...result.discoveredClueIds!]);
      }

      // On an act-advance, stash the held pieces for the UI-only curtain. The
      // sidebar-visible React state stays on the old act until Begin; the DB is
      // committed to the new act below (STEP 5).
      if (advancingAct) {
        setPendingActTransition({
          fromAct: currentAct,
          toAct: result.newAct!,
          newLocation: result.newLocation!,
          npcUpdates: result.npcUpdates ?? {},
        });
        setIsActBreakReady(false);
      }

      // STEP 5: Persist engine result to Supabase. On an act-advance we persist the
      // RAW result (new act, anchor location, reset clock, act-entry NPC positions)
      // so a mid-curtain reload reads the committed new act and resume-looks there.
      if (user && activeInvestigation) {
        await GameRepository.applyEngineResult(activeInvestigation.id, result, {
          location, inventory, medicalPoints, moralPoints, currentAct, flags,
        }, newElapsedMinutes);
        if (result.npcUpdates) {
          GameRepository.applyNPCUpdates(activeInvestigation.id, result.npcUpdates);
        }
        if (result.discoveredClueIds && result.discoveredClueIds.length > 0) {
          GameRepository.addDiscoveredClues(activeInvestigation.id, result.discoveredClueIds);
        }
      }

      // STEP 5b: Capture Watson's diary entries for clue discoveries and major
      // decisions. Deterministic — only a reference is stored; the authored
      // Watson line is resolved from story data at render time. Runs for guests
      // too (in-memory); persists only when signed in. (Act milestones are
      // captured later, once the reflective entry has been generated; act-boundary
      // arrivals are captured in beginNextAct.)
      {
        const captured: Array<Omit<DiaryEntry, 'id' | 'sequence'>> = [];
        if (result.discoveredClueIds) {
          for (const clueId of result.discoveredClueIds) {
            const def = CLUE_DEFINITIONS[clueId];
            if (def) {
              captured.push({
                kind: 'clue',
                refId: clueId,
                actNumber: currentAct,
                timeLabel: captureTimeLabel,
                isLead: isRequiredFlag(currentAct, clueGateFlag(def)),
              });
            }
          }
        }
        if (result.flagsUpdate) {
          for (const [flag, value] of Object.entries(result.flagsUpdate)) {
            const decisionId = DECISION_BY_FLAG[flag];
            if (value === true && !flags[flag] && decisionId) {
              captured.push({
                kind: 'decision',
                refId: decisionId,
                actNumber: currentAct,
                timeLabel: captureTimeLabel,
                isLead: isRequiredFlag(currentAct, flag),
              });
            }
          }
        }
        captureDiaryEntries(captured);
        // First arrival at a new location within the act.
        if (result.newLocation && !advancingAct) {
          captureLocationArrival(result.newLocation, currentAct, captureTimeLabel);
        }
        // Gate flags with no existing diary coverage — filled in async, STEP 8b.
        if (result.flagsUpdate) {
          pendingLeadFlags = detectSilentLeadFlags({
            actNumber: currentAct,
            flagsUpdate: result.flagsUpdate,
            priorFlags: flags,
            discoveredClueIds: result.discoveredClueIds || [],
          });
        }
      }

      // STEP 6: Enrich a copy of the engine's context with hook-owned data
      // (STIM, Holmes synthesis, anti-repetition memory). The engine's aiContext
      // is treated as immutable.
      const aiContext: NarrationContext = {
        ...result.aiContext,
        stim,
        recentOpenings: recentOpenings.length > 0 ? recentOpenings : undefined,
        clockEvent,
      };

      // STEP 6a: Holmes multi-clue synthesis — before Watson narrates
      if (result.discoveredClueIds && result.discoveredClueIds.length > 0) {
        audioManager.playSfx('clue-discovered');
        const allDiscoveredIds = [...discoveredClueIds, ...result.discoveredClueIds];
        const allClueObjects = allDiscoveredIds
          .map(id => CLUE_DEFINITIONS[id])
          .filter(Boolean)
          .map(c => ({ name: c.name, description: c.description, holmesDeduction: c.holmesDeduction }));
        const newClueNames = result.discoveredClueIds
          .map(id => CLUE_DEFINITIONS[id]?.name)
          .filter(Boolean) as string[];
        try {
          aiContext.holmesSynthesis = await aiService.consultHolmesMultiClue(
            allClueObjects,
            newClueNames,
            aiContext.act,
          );
        } catch {
          // Graceful fallback — Watson narrates with the hardcoded holmesDeduction per clue
        }
      }

      // Engine-verified pickup notice — items the player actually gained this
      // turn (examine can silently grant documents; the player must be told).
      const itemsPickedUp = (result.inventoryAdd ?? []).filter(i => !inventory.includes(i));
      if (itemsPickedUp.length > 0) audioManager.playSfx('item-pickup');
      const pickupNote = itemsPickedUp.length > 0
        ? `\n\n**You picked up:** ${itemsPickedUp.join(', ')}`
        : '';

      // STEP 7: Stream AI narration
      for await (const update of aiService.stream(aiContext)) {
        const { narrative, isComplete, parsed } = update;
        const displayText = isComplete ? narrative + pickupNote : narrative;

        setHistory(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], text: displayText };
          return next;
        });

        if (isComplete && parsed) {
          finalNarrationText = parsed.markdownOutput;

          // Anti-repetition memory: remember this narration's opening sentence
          const opening = extractOpeningSentence(parsed.markdownOutput);
          if (opening) {
            setRecentOpenings(prev => [opening, ...prev].slice(0, 4));
          }

          if (user && activeInvestigation) {
            GameRepository.addLogEntry(activeInvestigation.id, {
              timestamp: new Date().toISOString(),
              type: 'narration',
              content: parsed.markdownOutput + pickupNote,
            });

            if (parsed.npcMemoryUpdate && Object.keys(parsed.npcMemoryUpdate).length > 0) {
              GameRepository.updateNPCMemory(
                activeInvestigation.id,
                parsed.npcMemoryUpdate,
                npcStates
              );
              setNpcStates(prev => {
                const next = { ...prev };
                Object.entries(parsed.npcMemoryUpdate!).forEach(([npcId, summary]) => {
                  const existing = next[npcId]?.memory || [];
                  next[npcId] = {
                    ...(next[npcId] || { npcId, disposition: 50, status: 'alive' }),
                    memory: [summary, ...existing].slice(0, 5),
                  } as NPCState;
                });
                return next;
              });
            }
          }

          // Handle STIM updates (session memory — first observation wins, never overwrite)
          if (parsed.stimUpdate && Object.keys(parsed.stimUpdate).length > 0) {
            setStim(prev => {
              const next = { ...prev };
              (Object.entries(parsed.stimUpdate!) as [string, STIMEntry][]).forEach(([id, entry]) => {
                if (!next[id]) {
                  next[id] = { ...entry, turnCreated: turnCount };
                }
              });
              // Evict oldest beyond 15 (token diet: STIM is serialized into
              // every compact prompt — keep only the freshest observations)
              const sorted = (Object.entries(next) as [string, STIMEntry][])
                .sort(([, a], [, b]) => b.turnCreated - a.turnCreated)
                .slice(0, 15);
              return Object.fromEntries(sorted);
            });
          }

          // Silent auto-save after every completed turn. Skipped on an act-advance
          // turn: this closure still holds the OLD currentAct (React is held until
          // Begin), so saving here would clobber the new act the DB already committed
          // in STEP 5. beginNextAct persists the reconciled state at Begin.
          if (!advancingAct) handleSaveGame(true);
        }
      }

      // STEP 8: Generate act journal after narration stream completes (act advance only)
      if (pendingJournalSummary) {
        let appendedJournal = false;
        try {
          const journalText = await aiService.generateJournalEntry(pendingJournalSummary);
          if (journalText) {
            setHistory(prev => [
              ...prev,
              { role: 'assistant', text: journalText, type: 'journal' },
            ]);
            appendedJournal = true;

            // Also save the reflective entry into Watson's diary as the act's
            // closing note (the in-feed beat stays; this makes it re-readable).
            const actEntry: DiaryEntry = {
              id: crypto.randomUUID(),
              kind: 'act',
              refId: String(pendingJournalSummary.actNumber),
              actNumber: pendingJournalSummary.actNumber,
              sequence: diarySeqRef.current++,
              text: journalText,
              timeLabel: captureTimeLabel, // the clock at the act's close
            };
            setDiaryEntries(prev => [...prev, actEntry]);
            if (user && activeInvestigation) {
              GameRepository.addDiaryEntries(activeInvestigation.id, [actEntry]);
            }
          }
        } catch {
          // Journal is bonus content — never block the game on failure
        }
        // No diary to type out → reveal the Begin button immediately (no softlock).
        if (!appendedJournal) setIsActBreakReady(true);
      }

      // STEP 8b: Fill any progression-gate flags this turn left with no diary
      // text. Async, after narration — mirrors STEP 8, never blocks the turn.
      if (pendingLeadFlags.length > 0) {
        const actName = ACT_NAMES[currentAct] || `Act ${currentAct}`;
        for (const leadFlag of pendingLeadFlags) {
          const context = leadContextFor(currentAct, leadFlag);
          if (!context) continue; // no hint objective mapped to this flag — skip rather than guess
          try {
            const { title, body } = await aiService.generateLeadDiaryEntry({
              actName,
              verb: context.verb,
              subject: context.subject,
              narrationText: finalNarrationText,
            });
            if (title && body) {
              captureDiaryEntries([{
                kind: 'decision',
                refId: leadFlag,
                actNumber: currentAct,
                timeLabel: captureTimeLabel,
                text: `${title}\n${body}`,
                isLead: true,
              }]);
            }
          } catch {
            // Lead prose is bonus content — never block the game on failure
          }
        }
      }

      // STEP 9: The true ending's scripted coda — authored verbatim, never
      // AI-generated. Fires once, after the final narration completes.
      // (Cold-case endings keep their AI diary epilogue from the main stream.)
      if (result.gameOver && result.endingType === 'true_ending') {
        setHistory(prev => [
          ...prev,
          { role: 'assistant', text: TRUE_ENDING_CODA, type: 'journal' },
        ]);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('handleAction error:', errorMsg, error);
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          text: `> *The connection to the investigation archives was momentarily lost. Please try again.*\n\n> *(Debug: ${errorMsg})*`,
        };
        return next;
      });
    } finally {
      setIsLoading(false);
      setIsAutoScrollLocked(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, activeInvestigation, location, inventory, flags, npcStates, currentAct, medicalPoints, moralPoints, introducedNpcs, elapsedMinutes, handleSaveGame, captureDiaryEntries, captureLocationArrival]);

  // Fired by NarrativeFeed when the act-closing diary finishes typing.
  // NOTE: do NOT scroll here — NarrativeFeed anchors the diary to the top of the
  // viewport on append, so the player reads it from line one. Jumping to the
  // bottom to reveal the Begin button would clip the top of a long diary.
  const handleJournalTypewriterDone = useCallback(() => {
    if (!pendingActTransition) return;
    setIsActBreakReady(true);
  }, [pendingActTransition]);

  // ── Holmes hint ───────────────────────────────────────────────────────────

  const handleConsultHolmes = useCallback(async () => {
    if (isConsultingHolmes || isLoading) return;
    setIsConsultingHolmes(true);
    setIsLoading(true);

    try {
      const target = selectHint({ currentAct, location, flags, inventory, npcStates, locationVisitCounts });
      const hint = await aiService.getWatsonHint(target);

      setHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `> *A thought surfaced, unbidden.*\n\n${hint}`,
        },
      ]);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error('Hint failed', error);
    } finally {
      setIsConsultingHolmes(false);
      setIsLoading(false);
    }
  }, [isConsultingHolmes, isLoading, currentAct, location, flags, inventory, npcStates, locationVisitCounts, scrollToBottom]);

  // ── New Game (start a fresh investigation in a given save slot) ─────────────

  const handleStartInSlot = useCallback(async (slotNumber: number) => {
    // If the target slot is already occupied, archive that game first so the
    // partial unique index (owner_id, save_slot) stays satisfied. Its data is
    // preserved, just freed from the slot.
    if (user) {
      const occupant = slots.find(s => s.saveSlot === slotNumber);
      if (occupant) {
        try {
          await GameRepository.archiveSlot(occupant.id);
        } catch (e) {
          console.error('Could not archive slot occupant:', e);
        }
      }
    }

    // Clear local save slot
    try { localStorage.removeItem('londonBleedsSave'); } catch {}

    // Reset all game state to initial values
    setHistory([]);
    setLocation(INITIAL_LOCATION);
    setInventory(INITIAL_INVENTORY);
    setMedicalPoints(0);
    setMoralPoints(0);
    setIsGameOver(false);
    setFlags({});
    setNpcStates(INITIAL_NPC_STATES as Record<string, NPCState>);
    setCurrentAct(INITIAL_ACT);
    setElapsedMinutes(0);
    setStim({});
    setTurnCount(0);
    setIntroducedNpcs(INITIAL_INTRODUCED_NPCS);
    setJournalNotes(INITIAL_JOURNAL);
    setDiaryEntries([]);
    diarySeqRef.current = 0;
    loggedLocationsRef.current = new Set();
    setActiveInvestigation(null);

    // Create a fresh investigation for logged-in users
    if (user) {
      try {
        const newInv = await GameRepository.createInvestigation(user.id, {
          currentLocation: INITIAL_LOCATION,
          inventory: INITIAL_INVENTORY,
          currentAct: INITIAL_ACT,
          globalFlags: {},
          journalNotes: INITIAL_JOURNAL,
          saveSlot: slotNumber,
        });
        setActiveInvestigation(newInv);
      } catch (e) {
        console.error('Could not create new investigation:', e);
      }
    }

    // Trigger fresh opening scene (diary starts empty — player writes manually)
    hasGeneratedOpening.current = false;
    generateOpeningScene();

    setNotification({ message: 'New Investigation Started!', type: 'success' });
    refreshSlots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, slots, generateOpeningScene, refreshSlots]);

  // Delete (archive) a slot, freeing it. Returns the refreshed slot list.
  const handleDeleteSlot = useCallback(async (investigation: Investigation) => {
    try {
      await GameRepository.archiveSlot(investigation.id);
    } catch (e) {
      console.error('Could not delete slot:', e);
    }
    if (activeInvestigation?.id === investigation.id) {
      setActiveInvestigation(null);
    }
    await refreshSlots();
  }, [activeInvestigation?.id, refreshSlots]);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    history,
    isLoading,
    isAutoScrollLocked,
    isGameOver,
    endingType,
    isConsultingHolmes,
    actualLastUserIdx,

    location,
    inventory,
    medicalPoints,
    moralPoints,
    currentAct,
    flags,
    npcStates,
    introducedNpcs,
    activeInvestigation,
    slots,

    displayTime: formatGameClock(currentAct, elapsedMinutes),

    displayDate: (ACT_TIME_CONFIG[currentAct] ?? ACT_TIME_CONFIG[1]).displayDate,

    weather: ACT_WEATHER[currentAct] ?? ACT_WEATHER[1],

    diaryEntries,
    isSaving,
    themeMode,
    setThemeMode,
    timePeriod: currentTimePeriod,
    soundEffects,
    setSoundEffects,
    ambientAudio,
    setAmbientAudio,
    notification,
    setNotification,
    connectionStatus,
    retryConnections: checkConnections,

    scrollRef,
    lastUserMessageRef,

    pendingActTransition,
    isActBreakReady,
    isCurtainPlaying,
    isAdvancingAct,
    beginNextAct,
    handleJournalTypewriterDone,

    handleAction,
    handleSaveGame,
    handleLoadGame,
    handleConsultHolmes,
    handleScroll,

    refreshSlots,
    handleSelectSlot,
    handleContinue,
    handleStartInSlot,
    handleDeleteSlot,
  };
}
