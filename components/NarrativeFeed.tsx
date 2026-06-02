/**
 * components/NarrativeFeed.tsx
 *
 * Scrollable narrative history — the main reading area of the game.
 * Renders the title lockup, the message history (user commands +
 * AI narration), and the GameOverScreen when the case closes.
 */

import React, { useMemo } from 'react';
import { Eye, Search, Glasses, Compass, Brain, Microscope, Feather, type LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StoryRenderer } from './StoryRenderer';
import { TypewriterBlock } from './TypewriterBlock';
import { GameOverScreen } from './GameOverScreen';
import { GameHistoryItem } from '../types';

const LOADING_VARIANTS: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Eye,        text: 'Surveying the scene...' },
  { icon: Search,     text: 'Examining the evidence...' },
  { icon: Glasses,    text: 'Scrutinising the details...' },
  { icon: Compass,    text: 'Taking bearings...' },
  { icon: Brain,      text: 'Cataloguing observations...' },
  { icon: Microscope, text: 'Investigating closely...' },
];

interface NarrativeFeedProps {
  history: GameHistoryItem[];
  isLoading: boolean;
  isGameOver: boolean;
  actualLastUserIdx: number;
  lastUserMessageRef: React.RefObject<HTMLDivElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
}

export function NarrativeFeed({
  history,
  isLoading,
  isGameOver,
  actualLastUserIdx,
  lastUserMessageRef,
  scrollRef,
  onScroll,
}: NarrativeFeedProps) {
  // Pick a random loading variant once per loading session
  const loadingVariant = useMemo(
    () => LOADING_VARIANTS[Math.floor(Math.random() * LOADING_VARIANTS.length)],
    [isLoading], // eslint-disable-line react-hooks/exhaustive-deps
  );

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

          // Act-closing journal entry — always static, distinct diary styling
          if (isJournal && msg.text !== '') {
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
                  <div className="font-serif text-lb-primary/60 italic text-sm md:text-[15px] leading-relaxed">
                    <StoryRenderer text={msg.text} />
                  </div>
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

      <AnimatePresence>
        {isLoading && history.length > 0 && history[history.length - 1]?.role === 'assistant' && history[history.length - 1]?.text === '' && (
          <motion.div
            key="opening-loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8 flex items-center gap-3 text-lb-muted"
          >
            <loadingVariant.icon size={16} className="animate-bounce text-lb-accent" />
            <span className="text-sm italic font-serif">{loadingVariant.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {isGameOver && <GameOverScreen />}
    </div>
  </div>
  );
}
