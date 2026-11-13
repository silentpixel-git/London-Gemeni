/**
 * components/NarrativeFeed.tsx
 *
 * Scrollable narrative history — the main reading area of the game.
 * Renders the title lockup and the feed: the player's lines and the
 * narrated prose, each prose block under its scene and act headers. An
 * ending arrives as a feed block like any other.
 */

import React, { useRef } from 'react';
import { MapPin } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { EASE_OUT, DUR_PANEL } from './motionTokens';
import { StoryRenderer } from './StoryRenderer';
import { TypewriterBlock } from './TypewriterBlock';
import { GameHistoryItem } from '../types';
import { useFeedFollow } from '../hooks/gameState/useFeedFollow';

interface NarrativeFeedProps {
  history: GameHistoryItem[];
  actualLastUserIdx: number;
  scrollRef: React.RefObject<HTMLDivElement>;
  /** The command dock's form: the feed never types text underneath it. */
  dockRef: React.RefObject<HTMLElement>;
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
  actualLastUserIdx,
  scrollRef,
  dockRef,
}: NarrativeFeedProps) {
  const reducedMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  // Every block types in below the last
  // and is followed line by line, so the reader always starts at its first line.
  const follow = useFeedFollow(scrollRef, contentRef, dockRef, history.length);

  return (
  <div
    ref={scrollRef}
    className="flex-1 overflow-y-auto px-4 desk:px-16"
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

          // Latest AI message — typewriter animation while streaming
          if (isLast && isAI && (msg.text !== '' || msg.actHeading || msg.location)) {
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
          if (isAI && (msg.text !== '' || msg.actHeading || msg.location)) {
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

    </div>
  </div>
  );
}
