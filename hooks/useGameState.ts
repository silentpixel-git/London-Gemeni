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
import { gameEngine, SessionSnapshot, computeTimePeriod, resolveActDay } from '../engine/GameEngine';
import { WHITECHAPEL_MANIFEST } from '../engine/stories/whitechapel-1888/manifest';
import { resolveActDiary } from '../engine/stories/whitechapel-1888/diaryActs';
import { audioManager } from '../services/AudioManager';
import { parseIntent } from '../engine/intentParser';
import { CLUE_DEFINITIONS, ACT_NAMES, ACT_TIME_CONFIG, ACT_WEATHER, TRUE_ENDING_CODA, DECISION_BY_FLAG, formatGameClock, TAKEABLE_OBJECTS, DOCUMENT_OBJECT_IDS } from '../engine/gameData';
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
import { GameHistoryItem, Investigation, NPCState, STIMEntry, ActJournalSummary, NarrationContext, PendingActTransition, DiaryEntry, TimePeriod, ThemeMode, RumorEvents } from '../types';
import { stripLeadingActHeading } from '../services/narrationFormat';
import { AI_PARSER_ENABLED, resolveIntentWithAI } from './gameState/aiParse';
import { extractOpeningSentence } from './gameState/narration';
import { useConnections } from './gameState/useConnections';
import { useAppearance } from './gameState/useAppearance';
import { useDiary } from './gameState/useDiary';
import { useSceneStreams } from './gameState/useSceneStreams';
import { usePersistence } from './gameState/usePersistence';
import { useActBreak } from './gameState/useActBreak';

// ── Destructure hints and diary leads from the story manifest ────────────────
const { selectHint } = WHITECHAPEL_MANIFEST;

// Inventory display names for every document-bearing takeable — an item
// gained from this set is "filed" (see GameEngine.resolve), not merely
// picked up, and the pickup notice should say so.
const DOCUMENT_ITEM_NAMES = new Set(DOCUMENT_OBJECT_IDS.map(id => TAKEABLE_OBJECTS[id]));
const { isRequiredFlag, clueGateFlag, leadContextFor, detectSilentLeadFlags } = WHITECHAPEL_MANIFEST.diaryLeads;

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
  const { diaryEntries, setDiaryEntries, diarySeqRef, loggedLocationsRef, captureDiaryEntries, captureLocationArrival } =
    useDiary({ user, activeInvestigation });
  const [currentAct, setCurrentAct] = useState(INITIAL_ACT);
  const [stim, setStim] = useState<Record<string, STIMEntry>>({});
  const [turnCount, setTurnCount] = useState(0);
  // NPC introduction tracking — IDs of NPCs whose real names Watson now knows.
  // Pre-seeded with professional acquaintances Watson already knows at game start.
  const [introducedNpcs, setIntroducedNpcs] = useState<string[]>(INITIAL_INTRODUCED_NPCS);

  // In-game clock — minutes elapsed since act's canonical start time
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  // In-game clock value of the last NPC approach — drives the 30-minute
  // cooldown (see engine/approaches.ts). Undefined = no approach yet this game.
  const [lastApproachAtMinutes, setLastApproachAtMinutes] = useState<number | undefined>(undefined);
  // Phase 4b — rumor-event log: when each rumor's trigger flag first fired
  const [rumorEvents, setRumorEvents] = useState<RumorEvents>({});
  // How many times Watson has visited each location
  const [locationVisitCounts, setLocationVisitCounts] = useState<Record<string, number>>({});
  // First sentences of the last few narrations — anti-repetition memory for the AI
  const [recentOpenings, setRecentOpenings] = useState<string[]>([]);

  // Proactive Holmes nudge — turns at current location without discovering a clue
  const [turnsAtLocationWithoutProgress, setTurnsAtLocationWithoutProgress] = useState(0);
  // Who was in the room at the end of the previous turn, so the engine can
  // report arrivals and departures. A ref, not state: it must be read and
  // rewritten within a single turn's async body, where a state value would
  // still hold the previous render's contents.
  const previousNpcIdsRef = useRef<string[] | undefined>(undefined);
  // Procedural act journals — clue IDs accumulated since last act advance
  const [cluesFoundThisAct, setCluesFoundThisAct] = useState<string[]>([]);

  // ── Act-break curtain ─────────────────────────────────────────────────────
  const [pendingActTransition, setPendingActTransition] = useState<PendingActTransition | null>(null);
  const [isActBreakReady, setIsActBreakReady] = useState(false);   // diary finished typing → show Begin
  const [isCurtainPlaying, setIsCurtainPlaying] = useState(false); // cinematic overlay animating

  // ── Journal / sidebar ───────────────────────────────────────────────────
  // journalNotes still persists to the legacy investigations.journal_notes column
  // but is no longer surfaced anywhere — Watson's diary is now the diaryEntries
  // casebook below. Kept only to avoid a destructive DB migration.
  const [journalNotes, setJournalNotes] = useState(INITIAL_JOURNAL);
  const [isConsultingHolmes, setIsConsultingHolmes] = useState(false);

  // ── Persistence / UI ────────────────────────────────────────────────────
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const { connectionStatus, checkConnections } = useConnections({ isAuthReady, setNotification });

  // ── Refs ─────────────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  // True while per-turn cloud persists are failing — dedupes the failure toast
  // to once per streak instead of once per turn during an outage.
  const cloudPersistFailedRef = useRef(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const lastUserMsgIdx = [...history].reverse().findIndex(m => m.role === 'user');
  const actualLastUserIdx = lastUserMsgIdx === -1 ? -1 : history.length - 1 - lastUserMsgIdx;

  // In-game time-of-day phase — drives atmospheric theming and (later) audio.
  // resolveActDay: a multi-day act's clock base moves with its authored
  // day-steps (see engine/time.ts), so the base is derived from flags, never
  // read straight off the act config.
  const actDay = resolveActDay(ACT_TIME_CONFIG[currentAct] ?? ACT_TIME_CONFIG[1], flags);
  const currentTimePeriod = computeTimePeriod(actDay.canonicalMinutes + elapsedMinutes);

  const { themeMode, setThemeMode, soundEffects, setSoundEffects, ambientAudio, setAmbientAudio } =
    useAppearance({ user, userProfile, currentTimePeriod });

  const { hasGeneratedOpening, generateOpeningScene, streamResumeScene, streamArrivalScene } =
    useSceneStreams({
      user,
      activeInvestigation,
      inventory,
      flags,
      npcStates,
      medicalPoints,
      moralPoints,
      introducedNpcs,
      locationVisitCounts,
      turnCount,
      setHistory,
      setIsLoading,
      setIsAutoScrollLocked,
      setFlags,
      scrollRef,
      captureLocationArrival,
      previousNpcIdsRef,
    });

  // ── Effects ───────────────────────────────────────────────────────────────

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

  // ── Persistence (save/load/slots/realtime sync) ─────────────────────────────
  const {
    isSaving,
    slots,
    handleSaveGame,
    handleSaveGameRef,
    handleLoadGame,
    refreshSlots,
    handleSelectSlot,
    handleContinue,
    handleStartInSlot,
    handleDeleteSlot,
  } = usePersistence({
    user,
    activeInvestigation,
    setActiveInvestigation,
    history,
    location,
    inventory,
    medicalPoints,
    moralPoints,
    npcStates,
    flags,
    journalNotes,
    stim,
    introducedNpcs,
    currentAct,
    rumorEvents,
    setLocation,
    setInventory,
    setMedicalPoints,
    setMoralPoints,
    setCurrentAct,
    setElapsedMinutes,
    setLastApproachAtMinutes,
    setRumorEvents,
    setIsGameOver,
    setFlags,
    setJournalNotes,
    setIntroducedNpcs,
    setNpcStates,
    setStim,
    setTurnCount,
    setHistory,
    setIsLoading,
    setNotification,
    setPendingActTransition,
    setIsActBreakReady,
    setIsCurtainPlaying,
    diaryEntries,
    setDiaryEntries,
    diarySeqRef,
    loggedLocationsRef,
    hasGeneratedOpening,
    generateOpeningScene,
    streamResumeScene,
  });

  const { isAdvancingAct, beginNextAct, handleJournalTypewriterDone } = useActBreak({
    pendingActTransition,
    isCurtainPlaying,
    setPendingActTransition,
    setIsActBreakReady,
    setIsCurtainPlaying,
    setCurrentAct,
    setLocation,
    setLocationVisitCounts,
    setElapsedMinutes,
    setLastApproachAtMinutes,
    setNpcStates,
    setInventory,
    setIsLoading,
    captureLocationArrival,
    streamArrivalScene,
    handleSaveGameRef,
  });

  // Generate opening scene for fresh unauthenticated starts
  useEffect(() => {
    if (!user && isAuthReady && history.length === 0) {
      generateOpeningScene();
    }
  }, [isAuthReady, user, generateOpeningScene, history.length]);

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

      // STEP 2.5: AI parse fallback — only when the deterministic parse missed.
      // Resolves the whole input against THIS location's candidates so the
      // engine can fire. No-op (and no latency) on hits. VITE_AI_PARSER='off'
      // is the emergency kill switch (regex-only parsing).
      if (AI_PARSER_ENABLED) {
        intent = await resolveIntentWithAI(intent, location, inventory, npcStates, currentAct, introducedNpcs, elapsedMinutes, flags);
      }

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
        // 1-based: this is the Nth player action, not the count of completed
        // ones. The scene-entry renders (opening / act arrival / resume) pass 0,
        // so a beat scheduled for turn 1 fires on the player's first real action
        // and never on the opening scene, which shares the pre-increment value.
        turnCount: turnCount + 1,
        rumorEvents,
        lastApproachAtMinutes,
        previousNpcIds: previousNpcIdsRef.current,
      };

      // STEP 3: Engine resolves — no AI yet
      const result = gameEngine.resolve(intent, snapshot);
      previousNpcIdsRef.current = result.aiContext.npcsPresent.map(n => n.npcId);

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
      const newRumorEvents = result.rumorEventsUpdate
        ? { ...rumorEvents, ...result.rumorEventsUpdate }
        : rumorEvents;

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
      if (result.rumorEventsUpdate) setRumorEvents(newRumorEvents);
      if (result.gameOver) {
        setIsGameOver(true);
        if (result.endingType) setEndingType(result.endingType);
      }
      // No advancingAct gate needed — selectApproach() suppresses on any
      // newAct/gameOver turn, so approachAtMinutes is always undefined here
      // whenever advancingAct would be true.
      if (result.approachAtMinutes !== undefined) {
        setLastApproachAtMinutes(result.approachAtMinutes);
      }
      // A multi-day act stepped to a later day: the new day carries its own
      // clock base, so elapsed time resets exactly as it does on an act change.
      // The approach cooldown is cleared for the same reason it is cleared on an
      // act transition — a stamp from the previous day's clock space would read
      // as deeply in the past and wrongly suppress.
      if (result.dayStepAdvanced !== undefined) {
        setElapsedMinutes(0);
        setLastApproachAtMinutes(undefined);
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
        move: 10, talk: 5, deduce: 5, examine: 2, open: 2,
        use: 2, take: 1, inventory: 0, query: 1, help: 0, other: 2,
      };
      // On an act-advance the clock persists at the new act's canonical start (0);
      // React's elapsedMinutes stays held until Begin (see the hold comment above).
      const actionMinutes = result.minutesAdvanced ?? ACTION_TIME_MINUTES[result.actionType] ?? 2;
      const newElapsedMinutes = advancingAct ? 0 : elapsedMinutes + actionMinutes;
      if (!advancingAct) setElapsedMinutes(newElapsedMinutes);
      // Mirrors newElapsedMinutes's override scheme: result.approachAtMinutes
      // is architecturally always undefined on an advancing turn, so without
      // this explicit null the DB's last_approach_at_minutes would never be
      // cleared on the transition turn and a reload/resync before (or after)
      // Begin Act N would pull the previous act's stale stamp straight back in.
      const newLastApproachAtMinutes = advancingAct ? null : result.approachAtMinutes;
      // Clock label for any diary entries captured this turn. Use the held clock
      // (current act + this action's time), not the next act's reset — entries
      // captured this turn belong to the current act even on an advancing turn.
      const captureTimeLabel = formatGameClock(currentAct, elapsedMinutes + actionMinutes, flags);
      setTurnCount(t => t + 1);

      // Hour-bell clock event — fires when the turn crosses an hour boundary
      const actStartMinutes = actDay.canonicalMinutes;
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
        const persisted = await GameRepository.applyEngineResult(activeInvestigation.id, result, {
          location, inventory, medicalPoints, moralPoints, currentAct, flags, rumorEvents,
        }, newElapsedMinutes, newLastApproachAtMinutes);
        // Await the NPC-position write alongside Watson's own so a dropped
        // npc_states upsert is caught, not silent: otherwise a follower (Holmes)
        // could be left a location behind in the DB and, since resume trusts the
        // stored position, appear to abandon Watson on the next reload.
        const npcPersisted = result.npcUpdates
          ? await GameRepository.applyNPCUpdates(activeInvestigation.id, result.npcUpdates)
          : true;
        // A reload before the next successful write would lose this turn's
        // sparse fields (location, act, inventory) or NPC positions, so the
        // player must know either way.
        if (persisted && npcPersisted) {
          cloudPersistFailedRef.current = false;
        } else if (!cloudPersistFailedRef.current) {
          cloudPersistFailedRef.current = true;
          setNotification({ message: 'Cloud sync failed — recent progress may not be saved online.', type: 'error' });
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
      // Documents are "filed" (and stay filed after the bag empties); every
      // other takeable is plainly "picked up".
      const filedItems = itemsPickedUp.filter(i => DOCUMENT_ITEM_NAMES.has(i));
      const plainItems = itemsPickedUp.filter(i => !DOCUMENT_ITEM_NAMES.has(i));
      const pickupClauses = [
        filedItems.length > 0 ? `**You filed:** ${filedItems.join(', ')}` : null,
        plainItems.length > 0 ? `**You picked up:** ${plainItems.join(', ')}` : null,
      ].filter(Boolean);
      const pickupNote = pickupClauses.length > 0 ? `\n\n${pickupClauses.join('\n\n')}` : '';

      // Location header — full-mode turns (successful move / target-less look)
      // surface the engine-verified location name as feed chrome above the
      // prose (see NarrativeFeed's SceneHeader). Compact turns get no header.
      if (aiContext.narrationMode === 'full') {
        const locationLabel = aiContext.locationName;
        setHistory(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], location: locationLabel };
          return next;
        });
      }

      // STEP 7: Stream AI narration
      for await (const update of aiService.stream(aiContext)) {
        const { narrative, isComplete, parsed } = update;
        // Defensive: full-mode prompts no longer ask for a heading, but strip
        // any the model still emits (compact mode never produced one).
        const cleaned = aiContext.narrationMode === 'full' ? stripLeadingActHeading(narrative) : narrative;
        const displayText = isComplete ? cleaned + pickupNote : cleaned;

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
            }
          }

          // In-memory NPC continuity (feeds npcRecentMemory into the next prompt)
          // — runs for guests too, same as STIM below; only the Supabase mirror
          // above is gated on being signed in.
          if (parsed.npcMemoryUpdate && Object.keys(parsed.npcMemoryUpdate).length > 0) {
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
            // An authored act-closing entry (diaryActs.ts) overrides the AI
            // journal text for the archived diary only.
            const authoredActText = resolveActDiary(pendingJournalSummary.actNumber, flags);
            const actEntry: DiaryEntry = {
              id: crypto.randomUUID(),
              kind: 'act',
              refId: String(pendingJournalSummary.actNumber),
              actNumber: pendingJournalSummary.actNumber,
              sequence: diarySeqRef.current++,
              text: authoredActText ?? journalText,
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
  }, [isLoading, user, activeInvestigation, location, inventory, flags, npcStates, currentAct, medicalPoints, moralPoints, introducedNpcs, elapsedMinutes, lastApproachAtMinutes, handleSaveGame, captureDiaryEntries, captureLocationArrival]);

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

    displayTime: formatGameClock(currentAct, elapsedMinutes, flags),

    displayDate: actDay.displayDate,

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
