
import React, { useState, useEffect, useRef } from 'react';
import { StoryRenderer } from './StoryRenderer';

interface TypewriterBlockProps {
  text: string;
  onComplete?: () => void;
}

export const TypewriterBlock: React.FC<TypewriterBlockProps> = ({ text = "", onComplete }) => {
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
        // Adjust chunk size for a smoother feel
        const chunkSize = distance > 100 ? 12 : (distance > 40 ? 6 : 2);
        
        const nextText = text.slice(0, displayedText.length + chunkSize);
        setDisplayedText(nextText);
    }, 12); 

    return () => clearTimeout(timeout);
  }, [text, displayedText, onComplete]);

  useEffect(() => {
    if (text.length < displayedText.length) {
        setDisplayedText('');
    }
  }, [text, displayedText]);

  return (
    <div className="relative min-h-[1.8em]"> 
      <StoryRenderer text={displayedText} animate={true} />
      {isTyping && (
        <span className="inline-block w-1.5 h-[1.1em] bg-[#CD7B00] opacity-70 animate-pulse ml-0.5 align-text-bottom translate-y-[-0.1em] transition-opacity duration-300" />
      )}
    </div>
  );
};
