/**
 * components/NarrativeFeed.tsx
 *
 * Scrollable narrative history — the main reading area of the game.
 * Renders the title lockup, the message history (user commands +
 * AI narration), and the GameOverScreen when the case closes.
 */

import React, { useRef, useEffect } from 'react';
import { Feather, Lightbulb, MapPin } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { EASE_OUT, DUR_DRAMATIC, DUR_PANEL } from './motionTokens';
import { StoryRenderer } from './StoryRenderer';
import { TypewriterBlock } from './TypewriterBlock';
import { GameOverScreen } from './GameOverScreen';
import { GameHistoryItem, PendingActTransition } from '../types';
import { useFeedFollow } from '../hooks/gameState/useFeedFollow';
import { ACT_ROMAN } from '../constants';

interface NarrativeFeedProps {
  history: GameHistoryItem[];
  isGameOver: boolean;
  actualLastUserIdx: number;
  scrollRef: React.RefObject<HTMLDivElement>;
  /** The command dock's form: the feed never types text underneath it. */
  dockRef: React.RefObject<HTMLElement>;
  onJournalDone?: () => void;
  pendingActTransition: PendingActTransition | null;
  isActBreakReady: boolean;
  onBeginAct: () => void;
}

/**
 * Deterministic scene chrome above the narrated prose: the act heading (scene
 * entries only) and the pin + location-name header (any full-mode turn). Data
 * comes from engine-verified fields on the history item — the AI has no hand
 * in it. Renders immediately; the prose typewrites below.
 */
function SceneHeader({ actHeading, location }: { actHeading?: string; location?: string }) {
  const reducedMotion = useReducedMotion();
  if (!actHeading && !location) return null;
  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR_PANEL, ease: EASE_OUT }}
      className="mb-4 space-y-8">
      {actHeading && (
        <h4 className="pt-8 text-sm font-bold tracking-[0.2em] uppercase text-lb-primary opacity-80 font-sans">
          {actHeading}
        </h4>
      )}
      {location && (
        <div className="flex items-center gap-2.5">
          <MapPin size={18} className="text-lb-accent shrink-0" />
          <span className="font-sans font-bold text-lb-primary text-[16px] md:text-[18px] lg:text-[20px]">
            {location}
          </span>
        </div>
      )}
    </motion.div>
  );
}

export function NarrativeFeed({
  history,
  isGameOver,
  actualLastUserIdx,
  scrollRef,
  dockRef,
  onJournalDone,
  pendingActTransition,
  isActBreakReady,
  onBeginAct,
}: NarrativeFeedProps) {
  const reducedMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const follow = useFeedFollow(scrollRef, contentRef, dockRef, history.length);
  // Anchor the act-closing diary to the TOP of the viewport when it appears, so
  // the player reads it from line one (rather than the feed jumping to the bottom
  // and clipping the top of a multi-paragraph entry). Fires once on append —
  // keyed on history.length, so it does not re-fire during the typewriter.
  const journalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const last = history[history.length - 1];
    if (last?.role === 'assistant' && last.type === 'journal' && journalRef.current) {
      journalRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [history.length]);

  return (
  <div
    ref={scrollRef}
    className="flex-1 overflow-y-auto px-8 md:px-16 scrollbar-thin scrollbar-thumb-lb-accent/20 scrollbar-track-transparent"
  >
    {/* Title lockup */}
    <div className="max-w-3xl mx-auto pt-8 pb-6 z-10" data-flip>
      <h1 className="font-serif text-5xl md:text-[76px] text-lb-primary leading-none mb-2 text-balance">
        London Bleeds
      </h1>
      <p className="font-serif text-2xl md:text-[40px] text-lb-primary opacity-90">
        The Whitechapel Diaries
      </p>
    </div>

    {/* History */}
    <div ref={contentRef} className="max-w-3xl mx-auto" data-flip>
      <AnimatePresence initial={false}>
        {history.map((msg, index) => {
          const isAI = msg.role === 'assistant';
          const isJournal = isAI && msg.type === 'journal';
          const isHint = isAI && msg.type === 'hint';
          const isLast = index === history.length - 1;
          const isLatestUser = index === actualLastUserIdx;

          // User command line
          if (!isAI && msg.role !== 'system') {
            return (
              <motion.div
                key={index}
                initial={isLatestUser ? { y: 12, opacity: 0 } : { opacity: 1 }}
                animate={{ y: 0, opacity: 1 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: EASE_OUT }}
                className="my-8"
              >
                <div className="pl-6 border-l-[3px] border-lb-accent">
                  {/* Same type ramp as the narration in StoryRenderer — the
                      player's command should read at the weight of the prose it
                      answers, not shrink away from it. */}
                  <span className="text-lb-accent font-sans font-medium text-[16px] md:text-[18px] lg:text-[20px] leading-relaxed">
                    {msg.text}
                  </span>
                </div>
              </motion.div>
            );
          }

          // Act-closing journal entry — diary styling. The latest one types out.
          if (isJournal && msg.text !== '') {
            // StoryRenderer sets its own prose ramp; the child selectors restyle it as an aside.
            const diaryInnerClass =
              "italic [&>div]:font-serif [&>div]:text-[15px] [&>div]:leading-[1.7] [&>div]:text-lb-primary/70";
            return (
              <motion.div
                key={index}
                ref={isLast ? journalRef : null}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DUR_DRAMATIC, ease: EASE_OUT }}
                className="my-10 scroll-mt-8"
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
                      onProgress={follow}
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

          // Watson's thoughts (the hint button) — a quiet aside that types in like the prose.
          if (isHint) {
            const thoughtClass = "italic [&>div]:font-serif [&>div]:text-[15px] [&>div]:leading-[1.7] [&>div]:text-lb-primary/70";
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DUR_PANEL, ease: EASE_OUT }}
                className="my-8"
              >
                <div className="border-l-2 border-lb-muted/40 pl-6 py-1">
                  <div className="flex items-center gap-2 mb-2 text-lb-muted">
                    <Lightbulb size={14} />
                    <span className="text-[10px] font-sans font-bold uppercase tracking-[0.18em]">Watson's thoughts</span>
                  </div>
                  {isLast ? (
                    <TypewriterBlock
                      text={msg.text}
                      onProgress={follow}
                      className={thoughtClass}
                      cursorClassName="inline-block w-1 h-[1em] bg-lb-muted opacity-50 animate-pulse ml-0.5 align-text-bottom"
                    />
                  ) : (
                    <div className={thoughtClass}>
                      <StoryRenderer text={msg.text} />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          }

          // Latest AI message — typewriter animation while streaming
          if (isLast && isAI && !isJournal && (msg.text !== '' || msg.actHeading || msg.location)) {
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8"
              >
                <SceneHeader actHeading={msg.actHeading} location={msg.location} />
                <TypewriterBlock text={msg.text} onProgress={follow} />
              </motion.div>
            );
          }

          // Previous AI messages — static render
          if (isAI && !isJournal && (msg.text !== '' || msg.actHeading || msg.location)) {
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8"
              >
                <SceneHeader actHeading={msg.actHeading} location={msg.location} />
                <StoryRenderer text={msg.text} />
              </motion.div>
            );
          }

          return null;
        })}
      </AnimatePresence>

      {pendingActTransition && isActBreakReady && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR_PANEL, ease: EASE_OUT }}
          className="my-10 flex justify-center"
        >
          <button
            onClick={onBeginAct}
            className="font-sans text-xs tracking-[0.08em] uppercase text-lb-accent border border-lb-accent/50 rounded px-5 py-2.5 hover:bg-lb-accent/10 pressable"
          >
            Begin Act {ACT_ROMAN[pendingActTransition.toAct] ?? pendingActTransition.toAct} →
          </button>
        </motion.div>
      )}

      {isGameOver && <GameOverScreen />}
    </div>
  </div>
  );
}
