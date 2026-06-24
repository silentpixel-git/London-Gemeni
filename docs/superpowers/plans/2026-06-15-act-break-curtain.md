# Act-break Curtain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give act transitions a deliberate, player-paced ending — Watson's diary types out in the feed, a *Begin Act N* button appears only after it finishes, and clicking it plays a cinematic curtain that commits the new-act state and streams an arrival scene. The sidebar holds at the old act until the player clicks Begin.

**Architecture:** The engine already returns the entire act transition in one `result` (new act, anchor location, NPC movements, time reset). Today the hook commits all of it immediately. We split that: the Act I action commits now; the four sidebar-visible pieces (`currentAct`, `location`, `npcStates`, `elapsedMinutes`) are stashed in a `pendingActTransition` and committed only when the player clicks **Begin Act N**. A new non-interactive `ActBreakCurtain` overlay plays the cinematic beat on commit. The diary entry is routed through the existing `TypewriterBlock`.

**Tech Stack:** React + TypeScript, Vite, Tailwind, framer-motion (already used in `NarrativeFeed`), Supabase. **No unit-test framework exists in this repo** — the only automated gate is `npm run lint` (`tsc --noEmit`). Each task is verified with `npm run lint`; behavior is verified in the final task via the dev server. **Do not add a test runner** — it is not part of this codebase.

**Spec:** `docs/superpowers/specs/2026-06-15-act-break-curtain-design.md`

---

## File Structure

- `types.ts` — add `'divider'` to `GameHistoryItem.type`; add `PendingActTransition` interface.
- `constants.ts` — add shared `ACT_ROMAN` numeral array.
- `services/AIService.ts` — import `ACT_ROMAN` from constants instead of its private copy.
- `engine/GameEngine.ts` — extract a public `computeActEntry(toAct, session)` helper from the inline anchor-move block; use it in `resolve()` (and later from the hook's reload path).
- `components/TypewriterBlock.tsx` — add optional `className` + `cursorClassName` props so the diary can type in its own styling.
- `components/NarrativeFeed.tsx` — type the latest journal entry; render the in-feed **Begin Act N** button; render `'divider'` items.
- `components/ActBreakCurtain.tsx` — **new** full-screen cinematic overlay.
- `hooks/useGameState.ts` — defer the act-advance commit; add `pendingActTransition` / `isActBreakReady` / `isCurtainPlaying` state; add `beginNextAct()` and `handleJournalTypewriterDone()`; reload reconstruction; expose all via `GameStateReturn`.
- `App.tsx` — mount `ActBreakCurtain`; pass new props to `NarrativeFeed` and `CommandInput`.

## Data model (used across tasks — keep names exact)

```ts
// types.ts
export interface GameHistoryItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
  type?: 'journal' | 'divider'; // 'journal' = diary entry; 'divider' = permanent act-break landmark
}

export interface PendingActTransition {
  fromAct: number;
  toAct: number;
  newLocation: string;                            // ACT_ANCHORS[toAct]
  npcUpdates: Record<string, Partial<NPCState>>;  // act-entry NPC movements
}
```

Hook state added: `pendingActTransition: PendingActTransition | null`, `isActBreakReady: boolean` (diary finished typing → show Begin), `isCurtainPlaying: boolean` (cinematic overlay animating).

Persistence marker: a flag `__pending_act_to_<toAct>: true` written into `flags` when the transition is stashed and removed when committed. Reused on both the localStorage and Supabase save paths (both persist `flags`).

---

## Task 1: Shared types & `ACT_ROMAN` constant

**Files:**
- Modify: `types.ts:4-8`
- Modify: `constants.ts` (append)
- Modify: `services/AIService.ts:107`

- [ ] **Step 1: Extend `GameHistoryItem` and add `PendingActTransition`**

In `types.ts`, replace the `GameHistoryItem` interface (lines 4-8) with:

```ts
export interface GameHistoryItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
  type?: 'journal' | 'divider'; // 'journal' = act-closing diary entry; 'divider' = permanent act-break landmark
}

export interface PendingActTransition {
  fromAct: number;
  toAct: number;
  newLocation: string;
  npcUpdates: Record<string, Partial<NPCState>>;
}
```

`NPCState` is already imported/defined in `types.ts` (it is used by `GameDispositions` neighbours and exported). Confirm `NPCState` is in scope in this file; if it is defined later in the same file, the forward reference is fine for interfaces.

- [ ] **Step 2: Add `ACT_ROMAN` to `constants.ts`**

Append to `constants.ts`:

```ts
// Roman numerals for act labels (index 0 = prologue, unused as a numeral).
export const ACT_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
```

- [ ] **Step 3: Point `AIService` at the shared constant**

In `services/AIService.ts`, delete the private declaration on line 107:

```ts
const ACT_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
```

and add an import at the top of the file (alongside the existing imports):

```ts
import { ACT_ROMAN } from '../constants';
```

- [ ] **Step 4: Type-check**

Run: `npm run lint`
Expected: PASS (no errors). If `constants.ts` import path differs (it is at repo root, imported as `'../constants'` from `services/`), fix the path until lint is clean.

- [ ] **Step 5: Commit**

```bash
git add types.ts constants.ts services/AIService.ts
git commit -m "feat: shared ACT_ROMAN + act-break types"
```

---

## Task 2: Engine `computeActEntry` helper

Extract the inline anchor-move logic so the same computation is reusable from the hook's reload path. Pure refactor — no behavior change.

**Files:**
- Modify: `engine/GameEngine.ts:133-147` (call site) and add a public method near `computeNpcMovements` (~line 1457)

- [ ] **Step 1: Add the public method**

Just above `private computeNpcMovements(` (line 1457), add:

```ts
  /**
   * Compute the state Watson enters a new act with: the anchor location and the
   * NPC movements for that act. Used both by resolve() on a live act-advance and
   * by the UI when committing a deferred act transition (e.g. after reload).
   */
  public computeActEntry(
    toAct: number,
    session: SessionSnapshot
  ): { anchor: string; npcUpdates: Record<string, Partial<NPCState>> } {
    const anchor = ACT_ANCHORS[toAct];
    const npcUpdates = this.computeNpcMovements(anchor, { ...session, currentAct: toAct });
    return { anchor, npcUpdates };
  }
```

- [ ] **Step 2: Use it in `resolve()`**

Replace the block at lines 136-147:

```ts
    if (result.newAct !== undefined && !result.gameOver) {
      const anchor = ACT_ANCHORS[result.newAct];
      if (anchor && anchor !== (result.newLocation ?? session.location)) {
        result.newLocation = anchor;
        result.npcUpdates = {
          ...result.npcUpdates,
          ...this.computeNpcMovements(anchor, { ...session, currentAct: result.newAct }),
        };
      }
    }
```

with:

```ts
    if (result.newAct !== undefined && !result.gameOver) {
      const { anchor, npcUpdates } = this.computeActEntry(result.newAct, session);
      if (anchor && anchor !== (result.newLocation ?? session.location)) {
        result.newLocation = anchor;
        result.npcUpdates = { ...result.npcUpdates, ...npcUpdates };
      }
    }
```

- [ ] **Step 3: Type-check + engine QA**

Run: `npm run lint`
Expected: PASS.
Run: `npx tsx scripts/qa-engine.ts`
Expected: same pass/fail profile as before this change (the refactor must not alter engine behavior). If the script needs no API key it should complete; note any pre-existing failures are unrelated.

- [ ] **Step 4: Commit**

```bash
git add engine/GameEngine.ts
git commit -m "refactor: extract GameEngine.computeActEntry"
```

---

## Task 3: Diary typewriter

Route the latest act-closing journal entry through the typewriter while keeping its diary chrome.

**Files:**
- Modify: `components/TypewriterBlock.tsx`
- Modify: `components/NarrativeFeed.tsx:79-114`

- [ ] **Step 1: Give `TypewriterBlock` optional styling hooks**

Replace `components/TypewriterBlock.tsx` in full with:

```tsx
import React, { useState, useEffect } from 'react';
import { StoryRenderer } from './StoryRenderer';

interface TypewriterBlockProps {
  text: string;
  onComplete?: () => void;
  /** Wrapper class — lets callers (e.g. the diary) impose their own text styling. */
  className?: string;
  /** Cursor class — defaults to the accent caret used by narration. */
  cursorClassName?: string;
}

export const TypewriterBlock: React.FC<TypewriterBlockProps> = ({
  text = "",
  onComplete,
  className = "relative min-h-[1.8em]",
  cursorClassName = "inline-block w-1.5 h-[1.1em] bg-lb-accent opacity-70 animate-pulse ml-0.5 align-text-bottom translate-y-[-0.1em] transition-opacity duration-300",
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (displayedText.length === text.length) {
      setIsTyping(false);
      onComplete?.();
      return;
    }

    setIsTyping(true);

    const timeout = setTimeout(() => {
      const distance = text.length - displayedText.length;
      const chunkSize = distance > 100 ? 12 : (distance > 40 ? 6 : 2);
      setDisplayedText(text.slice(0, displayedText.length + chunkSize));
    }, 12);

    return () => clearTimeout(timeout);
  }, [text, displayedText, onComplete]);

  useEffect(() => {
    if (text.length < displayedText.length) {
      setDisplayedText('');
    }
  }, [text, displayedText]);

  return (
    <div className={className}>
      <StoryRenderer text={displayedText} animate={true} />
      {isTyping && <span className={cursorClassName} />}
    </div>
  );
};
```

- [ ] **Step 2: Add `onJournalDone` prop to `NarrativeFeed` and type the latest journal entry**

In `components/NarrativeFeed.tsx`, add `onJournalDone?: () => void` to the component's props interface (it currently receives `history`, `isGameOver`, `actualLastUserIdx`, `lastUserMessageRef`, `scrollRef`, `onScroll`). Destructure it in the component signature.

Then replace the journal branch (lines 79-100). The current static branch always renders `StoryRenderer`. Make the **latest** journal entry type out (firing `onJournalDone` on completion) while older journal entries (e.g. the true-ending coda, or after reload of earlier acts) stay static:

```tsx
          // Act-closing journal entry — diary styling. The latest one types out.
          if (isJournal && msg.text !== '') {
            const diaryInnerClass =
              "font-serif text-lb-primary/60 italic text-sm md:text-[15px] leading-relaxed";
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="my-10"
              >
                <div className="border-l-2 border-lb-muted/40 pl-6 py-1">
                  <div className="flex items-center gap-2 mb-3 text-lb-muted opacity-50">
                    <Feather size={11} />
                    <span className="text-[10px] font-sans uppercase tracking-widest">Watson's Journal</span>
                  </div>
                  {isLast ? (
                    <TypewriterBlock
                      text={msg.text}
                      onComplete={onJournalDone}
                      className={diaryInnerClass}
                      cursorClassName="inline-block w-1 h-[1em] bg-lb-muted opacity-40 animate-pulse ml-0.5 align-text-bottom"
                    />
                  ) : (
                    <div className={diaryInnerClass}>
                      <StoryRenderer text={msg.text} />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          }
```

Add the `TypewriterBlock` import at the top of `NarrativeFeed.tsx` if not already present (it currently imports `StoryRenderer`; check existing imports and add `import { TypewriterBlock } from './TypewriterBlock';`).

- [ ] **Step 3: Type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/TypewriterBlock.tsx components/NarrativeFeed.tsx
git commit -m "feat: diary entry types out with the typewriter effect"
```

---

## Task 4: Defer the act-advance commit in the hook

Stash the four sidebar-visible pieces instead of committing them on an act-advance turn; suppress the matching persistence.

**Files:**
- Modify: `hooks/useGameState.ts` — state declarations (~line 149), commit block (705-753), persistence (789-801), journal capture (768-784)

- [ ] **Step 1: Add transition state**

After the `cluesFoundThisAct` declaration (line 149), add:

```ts
  // ── Act-break curtain ─────────────────────────────────────────────────────
  const [pendingActTransition, setPendingActTransition] = useState<PendingActTransition | null>(null);
  const [isActBreakReady, setIsActBreakReady] = useState(false);   // diary finished typing → show Begin
  const [isCurtainPlaying, setIsCurtainPlaying] = useState(false); // cinematic overlay animating
```

Add `PendingActTransition` to the existing `types` import at the top of the file (it already imports `GameHistoryItem, GameState, ... NarrationContext` from `'../types'`).

- [ ] **Step 2: Skip the four act setters on act-advance; stash instead**

In the commit block (lines 705-730), the act-advance setters must be guarded. Replace:

```ts
      setLocation(newLocation);
      if (result.newLocation) {
        setLocationVisitCounts(prev => ({
          ...prev,
          [result.newLocation!]: (prev[result.newLocation!] ?? 0) + 1,
        }));
      }
      setInventory(newInventory);
      setMedicalPoints(newMedicalPoints);
      setMoralPoints(newMoralPoints);
      setFlags(newFlags);
      if (result.newAct)   setCurrentAct(result.newAct);
```

with:

```ts
      const advancingAct = !!result.newAct && !result.gameOver;

      // On an act-advance we HOLD the sidebar-visible state (location, act, npcs,
      // clock) until the player clicks "Begin Act N". Everything else commits now.
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
      // Inject the reload marker into the flags we commit/persist this turn.
      const flagsWithMarker = advancingAct
        ? { ...newFlags, [`__pending_act_to_${result.newAct}`]: true }
        : newFlags;
      setFlags(flagsWithMarker);
```

The original `if (result.newAct) setCurrentAct(result.newAct);` line is **deleted** entirely — `result.newAct` only ever appears on an act-advance, and the act commit now happens in `beginNextAct` (Task 5).

- [ ] **Step 3: Hold NPC movements on act-advance**

Replace the npcUpdates block (lines 722-730):

```ts
      if (result.npcUpdates) {
        setNpcStates(prev => {
          const next = { ...prev };
          Object.entries(result.npcUpdates!).forEach(([id, upd]) => {
            next[id] = { ...(next[id] || { npcId: id, disposition: 50, status: 'alive' }), ...upd } as NPCState;
          });
          return next;
        });
      }
```

with:

```ts
      if (result.npcUpdates && !advancingAct) {
        setNpcStates(prev => {
          const next = { ...prev };
          Object.entries(result.npcUpdates!).forEach(([id, upd]) => {
            next[id] = { ...(next[id] || { npcId: id, disposition: 50, status: 'alive' }), ...upd } as NPCState;
          });
          return next;
        });
      }
```

- [ ] **Step 4: Hold the clock reset on act-advance**

Replace the elapsed block (lines 743-753):

```ts
      let newElapsedMinutes: number;
      if (result.newAct) {
        newElapsedMinutes = 0; // Reset to new act's canonical start time
      } else {
        const ACTION_TIME_MINUTES: Partial<Record<typeof result.actionType, number>> = {
          move: 10, talk: 5, deduce: 5, examine: 2,
          use: 2, take: 1, inventory: 0, query: 1, help: 0, other: 2,
        };
        newElapsedMinutes = elapsedMinutes + (ACTION_TIME_MINUTES[result.actionType] ?? 2);
      }
      setElapsedMinutes(newElapsedMinutes);
```

with:

```ts
      // The clock resets to the new act's canonical start only at Begin (commit).
      // On an act-advance turn we keep advancing Act I's clock normally so the
      // held sidebar stays coherent until the curtain.
      const ACTION_TIME_MINUTES: Partial<Record<typeof result.actionType, number>> = {
        move: 10, talk: 5, deduce: 5, examine: 2,
        use: 2, take: 1, inventory: 0, query: 1, help: 0, other: 2,
      };
      const newElapsedMinutes = elapsedMinutes + (ACTION_TIME_MINUTES[result.actionType] ?? 2);
      if (!advancingAct) setElapsedMinutes(newElapsedMinutes);
```

- [ ] **Step 5: Stash the transition and suppress new-act persistence**

The persistence block (lines 789-801) calls `applyEngineResult` (writes `current_act`/`current_location`/`elapsed_minutes`) and `applyNPCUpdates`. On an act-advance these must be suppressed so the cloud copy stays Act I + marker. Replace:

```ts
      // STEP 5: Persist engine result to Supabase
      if (user && activeInvestigation) {
        await GameRepository.applyEngineResult(activeInvestigation.id, result, {
          location, inventory, medicalPoints, moralPoints, currentAct, flags,
        }, newElapsedMinutes);
        if (result.npcUpdates) {
          GameRepository.applyNPCUpdates(activeInvestigation.id, result.npcUpdates);
        }
```

with:

```ts
      // On an act-advance, stash the held pieces and persist only the Act I deltas
      // (inventory/points/flags + the reload marker) — NOT the new act/location/npcs.
      if (advancingAct) {
        setPendingActTransition({
          fromAct: currentAct,
          toAct: result.newAct!,
          newLocation: result.newLocation!,
          npcUpdates: result.npcUpdates ?? {},
        });
        setIsActBreakReady(false);
      }

      // STEP 5: Persist engine result to Supabase
      if (user && activeInvestigation) {
        const persistResult = advancingAct
          ? { ...result, newAct: undefined, newLocation: undefined,
              flagsUpdate: { ...result.flagsUpdate, [`__pending_act_to_${result.newAct}`]: true } }
          : result;
        await GameRepository.applyEngineResult(activeInvestigation.id, persistResult, {
          location, inventory, medicalPoints, moralPoints, currentAct, flags,
        }, newElapsedMinutes);
        if (result.npcUpdates && !advancingAct) {
          GameRepository.applyNPCUpdates(activeInvestigation.id, result.npcUpdates);
        }
```

(`newElapsedMinutes` is the held Act I clock — Act I keeps ticking; the reset to 0 happens at commit in `beginNextAct`.)

- [ ] **Step 6: Type-check**

Run: `npm run lint`
Expected: PASS. `PendingActTransition` must resolve; the `__pending_act_to_*` computed keys are valid `Record<string, boolean>` entries.

- [ ] **Step 7: Commit**

```bash
git add hooks/useGameState.ts
git commit -m "feat: defer act-advance state commit behind pendingActTransition"
```

---

## Task 5: `beginNextAct` + journal-done handler + arrival scene

**Files:**
- Modify: `hooks/useGameState.ts` — add handlers; STEP 8 journal capture fallback; `GameStateReturn` (37-92) and the return object

- [ ] **Step 1: Reveal Begin immediately when there is no diary**

In STEP 8 (lines 906-919), the diary may fail/empty. Ensure the read-gate never softlocks by marking ready when no diary is appended. Replace:

```ts
      // STEP 8: Generate act journal after narration stream completes (act advance only)
      if (pendingJournalSummary) {
        try {
          const journalText = await aiService.generateJournalEntry(pendingJournalSummary);
          if (journalText) {
            setHistory(prev => [
              ...prev,
              { role: 'assistant', text: journalText, type: 'journal' },
            ]);
          }
        } catch {
          // Journal is bonus content — never block the game on failure
        }
      }
```

with:

```ts
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
          }
        } catch {
          // Journal is bonus content — never block the game on failure
        }
        // No diary to type out → reveal the Begin button immediately (no softlock).
        if (!appendedJournal) setIsActBreakReady(true);
      }
```

- [ ] **Step 2: Add `handleJournalTypewriterDone`**

Add this `useCallback` near `handleConsultHolmes` (after the `handleAction` definition, ~line 948):

```ts
  // Fired by NarrativeFeed when the act-closing diary finishes typing.
  const handleJournalTypewriterDone = useCallback(() => {
    if (pendingActTransition) setIsActBreakReady(true);
  }, [pendingActTransition]);
```

- [ ] **Step 3: Add the arrival-scene generator**

Add near `generateOpeningScene` (it ends ~line 352). This mirrors that pattern but for an arbitrary act/anchor and uses `full` mode:

```ts
  // Stream Watson's arrival into a new act's anchor location. Mirrors
  // generateOpeningScene but for a committed act transition.
  const streamArrivalScene = useCallback(async (toAct: number, anchor: string) => {
    const intent = parseIntent('look');
    const snapshot: SessionSnapshot = {
      location: anchor,
      inventory,
      flags,
      npcStates,
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
    setHistory(prev => [...prev, { role: 'assistant', text: '' }]);
    try {
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
      console.error('Arrival scene failed', e);
      setHistory(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], text: `### Act ${toAct}` };
        return next;
      });
    }
  }, [inventory, flags, npcStates, medicalPoints, moralPoints, activeInvestigation, introducedNpcs, locationVisitCounts, turnCount]);
```

Confirm `SessionSnapshot`, `parseIntent`, `gameEngine` are already imported in this file (they are — `generateOpeningScene` uses all three).

- [ ] **Step 4: Add `beginNextAct`**

Add after `streamArrivalScene`:

```ts
  // Player clicked "Begin Act N": play the cinematic curtain, commit the held
  // state behind it, then stream the arrival scene.
  const beginNextAct = useCallback(async () => {
    const pending = pendingActTransition;
    if (!pending || isCurtainPlaying) return;

    setIsCurtainPlaying(true);
    setIsActBreakReady(false);

    // Hold the curtain a beat (matches ActBreakCurtain's enter+hold animation).
    await new Promise(res => setTimeout(res, 2200));

    const { toAct, newLocation, npcUpdates } = pending;

    // Commit the four held pieces — sidebar flips to the new act now (behind the overlay).
    setCurrentAct(toAct);
    setLocation(newLocation);
    setLocationVisitCounts(prev => ({ ...prev, [newLocation]: (prev[newLocation] ?? 0) + 1 }));
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

    // Clear the reload marker from flags.
    setFlags(prev => {
      const next = { ...prev };
      delete next[`__pending_act_to_${toAct}`];
      return next;
    });

    setPendingActTransition(null);
    setIsCurtainPlaying(false);

    // Permanent in-feed landmark, then the arrival scene.
    setHistory(prev => [...prev, { role: 'assistant', text: `Act ${ACT_ROMAN[toAct] ?? toAct}`, type: 'divider' }]);
    await streamArrivalScene(toAct, newLocation);

    // Persist the committed Act-N state (flags now marker-free).
    handleSaveGame(true);
  }, [pendingActTransition, isCurtainPlaying, streamArrivalScene, handleSaveGame]);
```

Add `import { ACT_ROMAN } from '../constants';` to the hook file's imports.

- [ ] **Step 5: Expose the new surface in `GameStateReturn` and the return object**

In `GameStateReturn` (lines 37-92), add under a new comment block:

```ts
  // Act-break curtain
  pendingActTransition: PendingActTransition | null;
  isActBreakReady: boolean;
  isCurtainPlaying: boolean;
  beginNextAct: () => Promise<void>;
  handleJournalTypewriterDone: () => void;
```

In the hook's `return { ... }` object (near the end of the file), add the matching keys:

```ts
    pendingActTransition,
    isActBreakReady,
    isCurtainPlaying,
    beginNextAct,
    handleJournalTypewriterDone,
```

- [ ] **Step 6: Type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add hooks/useGameState.ts
git commit -m "feat: beginNextAct commits transition and streams arrival scene"
```

---

## Task 6: `ActBreakCurtain` component

**Files:**
- Create: `components/ActBreakCurtain.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { ACT_ROMAN } from '../constants';
import { ACT_NAMES } from '../engine/gameData';

interface ActBreakCurtainProps {
  fromAct: number;
  toAct: number;
}

// Non-interactive cinematic overlay. Mounted only while the curtain is playing
// (after the player clicks "Begin Act N"); it has no button of its own.
export const ActBreakCurtain: React.FC<ActBreakCurtainProps> = ({ fromAct, toAct }) => {
  const endLabel = fromAct === 0 ? 'End of Prologue' : `End of Act ${ACT_ROMAN[fromAct] ?? fromAct}`;
  const actName = ACT_NAMES[toAct] ?? `Act ${toAct}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-center px-6"
      style={{ backgroundColor: 'rgb(var(--lb-bg))' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="flex flex-col items-center gap-2"
      >
        <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-lb-muted">{endLabel}</span>
        <span className="text-lb-accent opacity-60 tracking-[0.4em] my-2">❧ ⸻ ❧</span>
        <span className="font-sans text-[13px] tracking-[0.3em] uppercase text-lb-accent">
          Act {ACT_ROMAN[toAct] ?? toAct}
        </span>
        <span className="font-serif text-2xl md:text-3xl text-lb-primary mt-1">{actName}</span>
      </motion.div>
    </motion.div>
  );
};
```

`ACT_NAMES` is exported from `engine/gameData.ts` (confirmed). `--lb-bg` is the themed background variable (parchment in light, ink in dark) — the curtain follows the active theme.

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ActBreakCurtain.tsx
git commit -m "feat: ActBreakCurtain cinematic overlay"
```

---

## Task 7: Wire App — curtain, in-feed Begin button, input lock, divider

**Files:**
- Modify: `App.tsx` (mount curtain; pass props to `NarrativeFeed` and `CommandInput`)
- Modify: `components/NarrativeFeed.tsx` (Begin button after the journal; render `'divider'`)
- Modify: `components/CommandInput.tsx` (disable during the break)

- [ ] **Step 1: Mount the curtain in `App.tsx`**

Add the import:

```tsx
import { ActBreakCurtain } from './components/ActBreakCurtain';
```

Inside the root return (after the `Notification` block, ~line 93), add:

```tsx
      <AnimatePresence>
        {gs.isCurtainPlaying && gs.pendingActTransition && (
          <ActBreakCurtain
            fromAct={gs.pendingActTransition.fromAct}
            toAct={gs.pendingActTransition.toAct}
          />
        )}
      </AnimatePresence>
```

`AnimatePresence` must be imported from `framer-motion` in `App.tsx` (add to imports if absent: `import { AnimatePresence } from 'framer-motion';`).

- [ ] **Step 2: Pass act-break props to `NarrativeFeed` and `CommandInput`**

In the `<NarrativeFeed ... />` JSX (lines 129-136), add:

```tsx
          onJournalDone={gs.handleJournalTypewriterDone}
          pendingActTransition={gs.pendingActTransition}
          isActBreakReady={gs.isActBreakReady}
          onBeginAct={gs.beginNextAct}
```

In the `<CommandInput ... />` JSX (lines 138+), change the `isLoading` prop to also lock during the break:

```tsx
          isLoading={gs.isLoading || gs.pendingActTransition !== null || gs.isCurtainPlaying}
```

- [ ] **Step 3: Render the in-feed Begin button and the divider in `NarrativeFeed`**

Extend `NarrativeFeed`'s props interface with:

```tsx
  pendingActTransition: import('../types').PendingActTransition | null;
  isActBreakReady: boolean;
  onBeginAct: () => void;
```

(or import `PendingActTransition` at the top and reference it directly). Destructure all three plus the `onJournalDone` from Task 3.

Add a `'divider'` render branch — place it just before the journal branch:

```tsx
          // Permanent act-break landmark in the feed
          if (isAI && msg.type === 'divider') {
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="my-12 flex items-center justify-center gap-4"
              >
                <span className="h-px w-12 bg-lb-muted/40" />
                <span className="font-sans text-[11px] tracking-[0.3em] uppercase text-lb-muted">{msg.text}</span>
                <span className="h-px w-12 bg-lb-muted/40" />
              </motion.div>
            );
          }
```

After the `history.map(...)` closes and before `{isGameOver && <GameOverScreen />}` (line 134), add the Begin button — shown only when a transition is pending and the diary has finished typing:

```tsx
      {pendingActTransition && isActBreakReady && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="my-10 flex justify-center"
        >
          <button
            onClick={onBeginAct}
            className="font-sans text-xs tracking-[0.08em] uppercase text-lb-accent border border-lb-accent/50 rounded px-5 py-2.5 hover:bg-lb-accent/10 transition-colors"
          >
            Begin Act {ACT_ROMAN[pendingActTransition.toAct] ?? pendingActTransition.toAct} →
          </button>
        </motion.div>
      )}
```

Add `import { ACT_ROMAN } from '../constants';` to `NarrativeFeed.tsx`.

- [ ] **Step 4: Type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add App.tsx components/NarrativeFeed.tsx components/CommandInput.tsx
git commit -m "feat: wire act-break curtain, Begin button, input lock, divider"
```

---

## Task 8: Reload-robustness

If the player reloads while the diary is shown but Begin not yet clicked, reconstruct the pending transition from the persisted `__pending_act_to_N` flag.

**Reliability note:** The marker is written to Supabase by `applyEngineResult` (Task 4 Step 5), so reload-robustness is reliable for **signed-in** users. The anonymous localStorage save (`handleSaveGame`) has pre-existing gaps — it captures `flags` from the render-time closure and does not persist `currentAct` at all — so an anonymous player who reloads mid-curtain may not restore the marker. That is an existing-architecture limitation, not introduced here; do not expand the local-save schema as part of this task. The cloud path is the supported one.

**Files:**
- Modify: `hooks/useGameState.ts` — after the two load paths set `flags`

- [ ] **Step 1: Add a reconstruction helper**

Add near `beginNextAct`:

```ts
  // On load, if a pending-act marker is present in flags, rebuild the transition
  // so the curtain's read-gate (diary + Begin button) re-appears instead of
  // stranding the player with spent gate flags.
  const restorePendingTransitionFromFlags = useCallback((loadedFlags: Record<string, boolean>, loadedAct: number, loadedNpcStates: Record<string, NPCState>) => {
    const markerKey = Object.keys(loadedFlags).find(k => k.startsWith('__pending_act_to_') && loadedFlags[k]);
    if (!markerKey) return;
    const toAct = parseInt(markerKey.replace('__pending_act_to_', ''), 10);
    if (!Number.isFinite(toAct)) return;
    const snapshot: SessionSnapshot = {
      location: INITIAL_LOCATION, inventory, flags: loadedFlags, npcStates: loadedNpcStates,
      currentAct: loadedAct, medicalPoints, moralPoints, discoveredClueIds: [],
      investigationId: activeInvestigation?.id, turnsAtLocationWithoutProgress: 0,
      elapsedMinutes: 0, introducedNpcs, locationVisitCounts, turnCount,
    };
    const { anchor, npcUpdates } = gameEngine.computeActEntry(toAct, snapshot);
    setPendingActTransition({ fromAct: loadedAct, toAct, newLocation: anchor, npcUpdates });
    setIsActBreakReady(false); // the restored diary (last history item) re-types, then reveals Begin
  }, [inventory, medicalPoints, moralPoints, activeInvestigation, introducedNpcs, locationVisitCounts, turnCount]);
```

- [ ] **Step 2: Call it from the cloud load path**

In `loadInvestigationIntoState` (after `setNpcStates(...)` / `setFlags(...)` around lines 369-389), add:

```ts
    restorePendingTransitionFromFlags(
      investigation.globalFlags as Record<string, boolean>,
      act,
      /* the npcStates object just built for setNpcStates */ npcStatesForLoad,
    );
```

Use the same npcStates object passed to `setNpcStates` in that function (name it `npcStatesForLoad` when building it if it is currently inlined). `act` is the local already computed there (line 373 sets `setCurrentAct(act)`).

- [ ] **Step 3: Call it from the local (anonymous) load path**

In the local fallback in `handleLoadGame` (after `setFlags(state.flags || {})` ~line 472 and again in the secondary path ~line 488), add:

```ts
        restorePendingTransitionFromFlags(state.flags || {}, currentAct, state.npcStates || {});
```

Note: the local `GameState` does not persist `currentAct`; the marker's `toAct` is authoritative and `fromAct` is cosmetic on the curtain. Passing the in-memory `currentAct` is acceptable.

- [ ] **Step 4: Type-check**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useGameState.ts
git commit -m "feat: restore act-break read-gate after reload"
```

---

## Task 9: Manual verification (dev server)

No automated behavior tests exist; verify against the spec's success criteria in the running app.

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Use the preview tooling (`preview_start`) or `npm run dev`. Load the app and start/continue an investigation that is near an act boundary (or use a save close to one).

- [ ] **Step 2: Trigger an act advance and verify the hold (criteria 1-3)**

Perform the action that advances the act. Verify:
- The Act I narration types out, then the diary types out (typewriter, diary styling), staying in view (not below the fold).
- The **Begin Act N** button appears ONLY after the diary finishes typing.
- The **sidebar** (location, time, date, weather, people) is unchanged from Act I while the button is showing.
- The command input is disabled throughout.

- [ ] **Step 3: Click Begin and verify the curtain + arrival (criterion 4)**

- The cinematic curtain plays (End of Act I → Act II title), no button on it.
- After it lifts, the sidebar now shows Act II, an arrival scene streams, and a permanent `⸻ Act II ⸻` divider sits in the feed above it.

- [ ] **Step 4: Verify endings are untouched (criterion 5)**

Reach (or load near) the true ending and a cold-case ending. Confirm no curtain appears and the coda/epilogue render as before.

- [ ] **Step 5: Verify reload-robustness (criterion 6)**

At the point where the diary is shown and Begin is visible (before clicking), reload the page. Confirm the diary and Begin button reappear (rather than resuming play or stranding), and clicking Begin still advances correctly.

- [ ] **Step 6: Final type-check and finish**

Run: `npm run lint`
Expected: PASS. Use the `superpowers:finishing-a-development-branch` skill to decide merge/PR.
