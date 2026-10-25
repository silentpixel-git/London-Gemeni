/**
 * components/NarrativeFeed.tsx
 *
 * Scrollable narrative history — the main reading area of the game.
 * Renders the title lockup, the message history (user commands +
 * AI narration), and the GameOverScreen when the case closes.
 */

import React, { useRef } from 'react';
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
      className="mb-6 flex flex-col gap-6">
      {actHeading && (
        <h4 className="m-0 pt-2 text-sm leading-normal font-bold tracking-[0.2em] uppercase text-lb-primary opacity-80 font-sans">
          {actHeading}
        </h4>
      )}
      {location && (
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-lb-accent shrink-0" />
          <span className="font-sans font-bold text-lb-primary text-[18px]">
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
  // Every block — the act-closing journal included — types in below the last
  // and is followed line by line, so the reader always starts at its first line.
  const follow = useFeedFollow(scrollRef, contentRef, dockRef, history.length);

  return (
  <div
    ref={scrollRef}
    className="flex-1 overflow-y-auto px-4 desk:px-16 scrollbar-thin scrollbar-thumb-lb-accent/20 scrollbar-track-transparent"
  >
    {/* Title lockup */}
    <div className="max-w-3xl mx-auto pt-8 desk:pt-14 mb-12 flex flex-col gap-1.5" data-flip>
      <h1 className="m-0 font-serif font-normal text-[clamp(44px,7vw,76px)] leading-[1.05] tracking-[-0.01em] text-lb-primary text-balance">
        London Bleeds
      </h1>
      <p className="m-0 font-serif text-[clamp(22px,3.4vw,40px)] text-lb-primary opacity-90">
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
                className="my-6"
              >
                <div className="pl-6 border-l-[3px] border-lb-accent">
                  {/* Same type ramp as the narration in StoryRenderer — the
                      player's command should read at the weight of the prose it
                      answers, not shrink away from it. */}
                  <span className="text-lb-accent font-sans font-bold text-[16px] desk:text-[18px] leading-[1.6] [overflow-wrap:anywhere]">
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DUR_DRAMATIC, ease: EASE_OUT }}
                className="my-6"
              >
                <div className="border-l-2 border-lb-muted/40 pl-5">
                  <div className="flex items-center gap-2 mb-2 text-lb-muted">
                    <Feather size={14} />
                    <span className="text-[10px] font-sans font-bold uppercase tracking-[0.18em]">Watson's Journal</span>
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
            const thoughtClass = "italic [&>div]:font-playfair [&>div]:text-[20px] [&>div]:desk:text-[24px] [&>div]:leading-[1.7] [&>div]:text-lb-primary/70";
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DUR_PANEL, ease: EASE_OUT }}
                className="my-6"
              >
                <div className="border-l-2 border-lb-muted/40 pl-5">
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
                className="mb-6"
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
                className="mb-6"
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
          className="my-6 flex"
        >
          <button
            onClick={onBeginAct}
            className="font-sans text-xs font-bold tracking-[0.14em] uppercase text-lb-accent border border-lb-accent/50 rounded px-5 py-2.5 hover:bg-lb-accent/[0.08] pressable"
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
