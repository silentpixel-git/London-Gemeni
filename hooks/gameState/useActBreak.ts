import React, { useState, useCallback } from 'react';
import { audioManager } from '../../services/AudioManager';
import { ITEM_SPENT_AFTER_ACT, formatGameClock } from '../../engine/gameData';
import { NPCState, PendingActTransition } from '../../types';

export interface ActBreakDeps {
  pendingActTransition: PendingActTransition | null;
  isCurtainPlaying: boolean;
  setPendingActTransition: React.Dispatch<React.SetStateAction<PendingActTransition | null>>;
  setIsActBreakReady: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCurtainPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentAct: React.Dispatch<React.SetStateAction<number>>;
  setLocation: React.Dispatch<React.SetStateAction<string>>;
  setLocationVisitCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setElapsedMinutes: React.Dispatch<React.SetStateAction<number>>;
  setLastApproachAtMinutes: React.Dispatch<React.SetStateAction<number | undefined>>;
  setNpcStates: React.Dispatch<React.SetStateAction<Record<string, NPCState>>>;
  setInventory: React.Dispatch<React.SetStateAction<string[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  captureLocationArrival: (locationId: string, actNumber: number, timeLabel: string) => void;
  streamArrivalScene: (toAct: number, anchor: string, npcUpdates: Record<string, Partial<NPCState>>) => Promise<void>;
  handleSaveGameRef: React.MutableRefObject<(silent?: boolean) => Promise<boolean>>;
}

const CURTAIN_HOLD_MS = 4500; // enter animation eats ~1s; this leaves ~3.5s to read the act title

export function useActBreak(deps: ActBreakDeps) {
  const {
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
  } = deps;

  // True only while the NEW act's opening scene is streaming, after the curtain
  // has closed. Distinguishes this (much longer) generation from a normal turn
  // so the command bar can show a dedicated message instead of a generic one.
  const [isAdvancingAct, setIsAdvancingAct] = useState(false);

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
    // canonicalMinutes/elapsedMinutes reset to a new act's own clock space —
    // a stale cooldown stamp from the previous act would otherwise read as
    // hundreds of minutes in the future and wrongly suppress approaches
    // until enough of the new act's runtime had elapsed to outrun it.
    setLastApproachAtMinutes(undefined);
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

  // Fired by NarrativeFeed when the act-closing diary finishes typing.
  // NOTE: do NOT scroll here — NarrativeFeed anchors the diary to the top of the
  // viewport on append, so the player reads it from line one. Jumping to the
  // bottom to reveal the Begin button would clip the top of a long diary.
  const handleJournalTypewriterDone = useCallback(() => {
    if (!pendingActTransition) return;
    setIsActBreakReady(true);
  }, [pendingActTransition]);

  return { isAdvancingAct, beginNextAct, handleJournalTypewriterDone };
}
