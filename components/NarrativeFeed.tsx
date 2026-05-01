/**
 * components/NarrativeFeed.tsx
 *
 * Scrollable narrative history — the main reading area of the game.
 * Renders the title lockup, the message history (user commands +
 * AI narration), and the GameOverScreen when the case closes.
 */

import React from 'react';
import { Feather } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StoryRenderer } from './StoryRenderer';
import { TypewriterBlock } from './TypewriterBlock';
import { GameOverScreen } from './GameOverScreen';
import { GameHistoryItem } from '../types';

interface NarrativeFeedProps {
  history: GameHistoryItem[];
  isLoading: boolean;
  isGameOver: boolean;
  actualLastUserIdx: number;
  lastUserMessageRef: React.RefObject<HTMLDivElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
}

export const NarrativeFeed: React.FC<NarrativeFeedProps> = ({
  history,
  isLoading,
  isGameOver,
  actualLastUserIdx,
  lastUserMessageRef,
  scrollRef,
  onScroll,
}) => (
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

          // Latest AI message — typewriter animation while streaming
          if (isLast && isAI && msg.text !== '') {
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
          if (msg.text !== '') {
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
            <Feather size={16} className="animate-bounce text-lb-accent" />
            <span className="text-sm italic font-serif">Watson opens his notebook...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {isGameOver && <GameOverScreen />}
    </div>
  </div>
);
