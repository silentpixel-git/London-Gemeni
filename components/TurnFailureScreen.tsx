/**
 * components/TurnFailureScreen.tsx
 *
 * Blocking failure state for a turn that could not complete — either the
 * engine never resolved the action, or it resolved and only the AI's written
 * account of it failed to arrive. See
 * docs/superpowers/specs/2026-08-14-turn-failure-screen-design.md.
 */

import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT, DUR_PANEL } from './motionTokens';
import type { TurnFailure } from '../hooks/gameState/useTurnFailure';
import type { SaveGameOverrides } from '../hooks/gameState/usePersistence';

interface TurnFailureScreenProps {
  failure: TurnFailure;
  onSaveGame: (silent?: boolean, overrides?: SaveGameOverrides) => Promise<boolean>;
  connectionStatus: { gemini: boolean | null; supabase: boolean | null };
  onRetryConnection: () => Promise<void>;
}

function copyFor(failure: TurnFailure): { eyebrow: string; flavour: string; note: React.ReactNode } {
  if (failure.retryKind === 'turn') {
    return {
      eyebrow: 'The page would not turn',
      flavour: 'The case did not move.',
      note: (
        <>Your last action was never resolved, so nothing in the record has changed. <strong>Retry</strong> will attempt the action again from where you stood.</>
      ),
    };
  }
  if (failure.attempts >= 2) {
    return {
      eyebrow: 'The archive did not answer',
      flavour: 'The case moved. The pen did not.',
      note: (
        <>Asked more than once now, and no account has come back. The action itself still stands in the record, so nothing is lost by waiting. Save the case and return when the archive answers.</>
      ),
    };
  }
  return {
    eyebrow: 'The archive did not answer',
    flavour: 'The case moved. The pen did not.',
    note: (
      <>Your last action was resolved and entered into the record. Only the written account of it failed to arrive. <strong>Retry</strong> asks for that account again. It will not repeat the action itself.</>
    ),
  };
}

export const TurnFailureScreen: React.FC<TurnFailureScreenProps> = ({
  failure,
  onSaveGame,
  connectionStatus,
  onRetryConnection,
}) => {
  const reducedMotion = useReducedMotion();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isCheckingConn, setIsCheckingConn] = useState(false);

  const { eyebrow, flavour, note } = copyFor(failure);

  const handleRetry = async () => {
    setIsRetrying(true);
    // On success this screen unmounts entirely. On failure it unmounts and
    // remounts with a fresh (attempts + 1) failure object — either way there
    // is nothing to reset here.
    await failure.retry();
  };

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await onSaveGame(false, failure.saveOverrides ?? undefined);
    setIsSaving(false);
    if (ok) setJustSaved(true);
  };

  const handleCheckConnection = async () => {
    setIsCheckingConn(true);
    await onRetryConnection();
    setIsCheckingConn(false);
  };

  const geminiStatus = connectionStatus.gemini;
  const connectionKnown = !isCheckingConn && geminiStatus !== null;
  const dotColorClass = connectionKnown
    ? (geminiStatus ? 'bg-[#2f7d4f]' : 'bg-[#c0392b]')
    : 'bg-lb-primary/60 animate-pulse motion-reduce:animate-none';
  const connLabel = !connectionKnown
    ? 'Checking the archive'
    : geminiStatus
      ? 'Archive connection good'
      : 'Archive connection unreachable';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -40 }}
      transition={{ duration: DUR_PANEL, ease: EASE_OUT }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center text-center px-6 py-16 overflow-y-auto"
      style={{ backgroundColor: 'rgb(var(--lb-bg))' }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="turn-failure-title"
      aria-describedby="turn-failure-note"
    >
      <div className="w-full max-w-lg flex flex-col items-center">
        <div className="text-lb-accent tracking-[0.4em] text-lg md:text-xl mb-6" aria-hidden="true">
          ❧ ⸻ ❧
        </div>
        <div className="text-xs font-sans tracking-[0.22em] uppercase text-lb-primary/75 mb-3">
          {eyebrow}
        </div>
        <h1 id="turn-failure-title" className="font-serif text-3xl md:text-4xl text-lb-primary mb-5 text-balance">
          The record breaks off
        </h1>
        <p className="font-serif italic text-lg text-lb-primary/85 mb-6">
          {flavour}
        </p>
        <p id="turn-failure-note" className="text-[15px] leading-relaxed text-lb-primary/85 max-w-md mb-9">
          {note}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="pressable font-sans text-sm px-9 py-3.5 rounded-full bg-lb-primary text-lb-bg hover:shadow-[0_0_0_3px_rgb(var(--lb-accent)/0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lb-accent disabled:opacity-55"
          >
            {isRetrying ? 'Retrying…' : 'Retry'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || justSaved}
            className="pressable font-sans text-sm px-9 py-3.5 rounded-full border border-lb-accent/55 text-lb-primary hover:bg-lb-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lb-accent disabled:opacity-55"
          >
            {justSaved ? 'Case saved' : isSaving ? 'Saving…' : 'Save and wait'}
          </button>
        </div>

        <p className="flex items-center justify-center gap-2 text-sm text-lb-primary/85 mb-8 flex-wrap">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColorClass}`} aria-hidden="true" />
          <span>{connLabel}</span>
          <button
            type="button"
            onClick={handleCheckConnection}
            disabled={isCheckingConn}
            className="text-lb-primary underline decoration-lb-accent underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lb-accent disabled:opacity-55"
          >
            Check again
          </button>
        </p>

        <p className="font-mono text-xs leading-relaxed text-lb-primary/75 border-t border-lb-border pt-4 w-full max-w-md break-words text-left">
          {failure.debug}
        </p>
      </div>
    </motion.div>
  );
};
