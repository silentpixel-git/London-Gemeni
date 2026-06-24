/**
 * components/NarrativeFeed.tsx
 *
 * Scrollable narrative history — the main reading area of the game.
 * Renders the title lockup, the message history (user commands +
 * AI narration), and the GameOverScreen when the case closes.
 */

import React, { useRef, useEffect } from 'react';
import { Feather } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StoryRenderer } from './StoryRenderer';
import { TypewriterBlock } from './TypewriterBlock';
import { GameOverScreen } from './GameOverScreen';
import { GameHistoryItem, PendingActTransition } from '../types';
import { ACT_ROMAN } from '../constants';

interface NarrativeFeedProps {
  history: GameHistoryItem[];
  isGameOver: boolean;
  actualLastUserIdx: number;
  lastUserMessageRef: React.RefObject<HTMLDivElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  onJournalDone?: () => void;
  pendingActTransition: PendingActTransition | null;
  isActBreakReady: boolean;
  onBeginAct: () => void;
}

export function NarrativeFeed({
  history,
  isGameOver,
  actualLastUserIdx,
  lastUserMessageRef,
  scrollRef,
  onScroll,
  onJournalDone,
  pendingActTransition,
  isActBreakReady,
  onBeginAct,
}: NarrativeFeedProps) {
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
    onScroll={onScroll}
    className="flex-1 overflow-y-auto px-8 md:px-16 pb-[60vh] scrollbar-thin scrollbar-thumb-lb-accent/20 scrollbar-track-transparent scroll-smooth"
  >
    {/* Title lockup */}
    <div className="max-w-3xl mx-auto pt-8 pb-6 z-10">
      <h1 className="font-serif text-5xl md:text-[76px] text-lb-primary leading-none mb-2 text-balance">
        London Bleeds
      </h1>
      <p className="font-serif text-2xl md:text-[40px] text-lb-primary opacity-90">
        The Whitechapel Diaries
      </p>
    </div>

    {/* History */}
    <div className="max-w-3xl mx-auto">
      <AnimatePresence initial={false}>
        {history.map((msg, index) => {
          const isAI = msg.role === 'assistant';
          const isJournal = isAI && msg.type === 'journal';
          const isLast = index === history.length - 1;
          const isLatestUser = index === actualLastUserIdx;

          // User command line
          if (!isAI && msg.role !== 'system') {
            return (
              <motion.div
                key={index}
                ref={isLatestUser ? lastUserMessageRef : null}
                initial={isLatestUser ? { y: 300, opacity: 0 } : { opacity: 1 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.8 }}
                className="my-8 scroll-mt-[120px]"
              >
                <div className="pl-6 border-l-[3px] border-lb-accent">
                  <span className="text-lb-accent font-sans font-medium text-[14px] md:text-[20px] leading-relaxed">
                    {msg.text}
                  </span>
                </div>
              </motion.div>
            );
          }

          // Act-closing journal entry — diary styling. The latest one types out.
          if (isJournal && msg.text !== '') {
            const diaryInnerClass =
              "font-serif text-lb-primary/60 italic text-sm md:text-[15px] leading-relaxed";
            return (
              <motion.div
                key={index}
                ref={isLast ? journalRef : null}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
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

          // Latest AI message — typewriter animation while streaming
          if (isLast && isAI && !isJournal && msg.text !== '') {
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8"
              >
                <TypewriterBlock text={msg.text} />
              </motion.div>
            );
          }

          // Previous AI messages — static render
          if (isAI && !isJournal && msg.text !== '') {
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8"
              >
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

      {isGameOver && <GameOverScreen />}
    </div>
  </div>
  );
}
