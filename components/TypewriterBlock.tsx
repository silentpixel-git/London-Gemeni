
import React, { useState, useEffect, useRef } from 'react';
import { StoryRenderer } from './StoryRenderer';

interface TypewriterBlockProps {
  text: string;
  onComplete?: () => void;
  scrollToBottom?: () => void;
}

export const TypewriterBlock: React.FC<TypewriterBlockProps> = ({ text = "", onComplete, scrollToBottom }) => {
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
        const chunkSize = distance > 50 ? 8 : (distance > 20 ? 4 : 2);
        
        const nextText = text.slice(0, displayedText.length + chunkSize);
        
        setDisplayedText(nextText);
        scrollToBottom?.();
    }, 10); // Faster base speed

    return () => clearTimeout(timeout);
  }, [text, displayedText, onComplete, scrollToBottom]);

  useEffect(() => {
    if (text.length < displayedText.length) {
        setDisplayedText('');
    }
  }, [text, displayedText]);

  return (
    <div className="min-h-[40px] relative"> 
      <StoryRenderer text={displayedText} animate={true} />
      {isTyping && (
        <span className="inline-block w-2 h-4 bg-[#CD7B00] animate-pulse ml-1 align-middle"/>
      )}
    </div>
  );
};
