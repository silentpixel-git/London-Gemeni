
import React, { useState, useEffect } from 'react';
import { StoryRenderer } from './StoryRenderer';

interface TypewriterBlockProps {
  text: string;
  onComplete?: () => void;
  /** Wrapper class — lets callers (e.g. the diary) impose their own text styling. */
  className?: string;
  /** Cursor class — defaults to the accent caret used by narration. */
  cursorClassName?: string;
  /** When false, suppresses onComplete so a still-streaming text does not
      fire completion side-effects early. Defaults to true. */
  isComplete?: boolean;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const TypewriterBlock: React.FC<TypewriterBlockProps> = ({
  text = "",
  onComplete,
  className = "relative min-h-[1.8em]",
  cursorClassName = "inline-block w-1.5 h-[1.1em] bg-lb-accent opacity-70 animate-pulse ml-0.5 align-text-bottom translate-y-[-0.1em]",
  isComplete = true,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (displayedText.length === text.length) {
      setIsTyping(false);
      if (isComplete) onComplete?.();
      return;
    }

    if (prefersReducedMotion()) {
      if (displayedText !== text) setDisplayedText(text);
      return;
    }

    setIsTyping(true);

    const timeout = setTimeout(() => {
      const distance = text.length - displayedText.length;
      // 2.4x the original 2/6/12, so the prose keeps pace with a live stream
      // instead of trailing it by seconds. Rate chosen against the four-variant
      // reveal explorer on the throwaway/typewriter-reveal-prototypes branch.
      const chunkSize = distance > 100 ? 29 : (distance > 40 ? 14 : 5);
      setDisplayedText(text.slice(0, displayedText.length + chunkSize));
    }, 12);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, displayedText, isComplete]);

  useEffect(() => {
    if (text.length < displayedText.length) {
      setDisplayedText('');
    }
  }, [text, displayedText]);

  const handleSkip = () => {
    if (!window.getSelection()?.isCollapsed) return; // don't kill text selection
    setDisplayedText(text);
  };

  return (
    <div className={className} onClick={handleSkip}>
      <StoryRenderer
        text={displayedText}
        animate={true}
        caret={isTyping ? <span className={cursorClassName} /> : undefined}
      />
    </div>
  );
};
