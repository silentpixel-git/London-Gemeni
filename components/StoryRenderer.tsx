import React from 'react';
import { THEME } from '../constants';

const parseInlineMarkdown = (text: string, animate: boolean = false) => {
  const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|_.*?_)/g);
  
  return parts.map((part, j) => {
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return <span key={j} className="font-bold italic text-[#CD7B00]">{part.slice(3, -3)}</span>;
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const content = part.slice(2, -2);
      // Special coloring for the "Look" mechanic labels to be dark navy instead of orange
      const isSystemLabel = content.startsWith('Objects of interest') || content.startsWith('Possible exits');
      const textColor = isSystemLabel ? "text-[#293351]" : "text-[#CD7B00]";
      
      return <span key={j} className={`font-bold ${textColor}`}>{content}</span>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <span key={j} className="italic">{part.slice(1, -1)}</span>;
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length >= 2) {
      return <span key={j} className="italic">{part.slice(1, -1)}</span>;
    }
    
    if (animate && part.trim().length > 0) {
      const words = part.split(/(\s+)/); 
      return (
        <span key={j}>
          {words.map((word, k) => {
             if (word.match(/^\s+$/)) {
                 return <span key={k}>{word}</span>;
             }
             return (
                <span 
                  key={k} 
                  className="inline-block animate-in fade-in duration-700 fill-mode-forwards"
                >
                  {word}
                </span>
             );
          })}
        </span>
      );
    }
    return <span key={j}>{part}</span>;
  });
};

interface StoryRendererProps {
  text: string;
  animate?: boolean;
}

export const StoryRenderer: React.FC<StoryRendererProps> = ({ text = "", animate = false }) => {
  const safeText = text || ""; 
  const lines = safeText.split('\n');
  
  return (
    <div className={`
      space-y-6 
      ${THEME.fonts.body} 
      text-[16px] md:text-[18px] lg:text-[20px] 
      leading-relaxed md:leading-relaxed lg:leading-[1.8] 
      text-[#293351] 
      max-w-[65ch]
    `}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (line.startsWith('###')) {
          return (
            <div key={i} className="pt-8 pb-4">
              <h4 className={`text-sm font-bold tracking-[0.2em] uppercase text-[#293351] opacity-80 ${THEME.fonts.body}`}>
                {line.replace(/###\s*/, '')}
              </h4>
            </div>
          );
        }
        
        if (line.startsWith('>')) {
          return (
            <div key={i} className="pl-6 border-l-[3px] border-[#CD7B00] my-6 py-1">
              <p className="italic text-[#293351] font-playfair text-[24px] leading-relaxed opacity-90">
                {parseInlineMarkdown(line.replace(/>\s*/, ''), animate)}
              </p>
            </div>
          );
        }
        
        if (trimmed.match(/^[\*\-]\s/)) {
           const content = trimmed.replace(/^[\*\-]\s/, '');
           return (
             <div key={i} className="flex items-start gap-3 ml-2 my-2">
                <div className="mt-2.5 w-1.5 min-w-[6px] h-1.5 rounded-full bg-[#CD7B00] opacity-90" />
                <div>{parseInlineMarkdown(content, animate)}</div>
             </div>
           );
        }

        // Special handling for the "Look" mechanic block to tighten the spacing
        // The container has space-y-6 (24px). We use negative margin to pull these specific lines closer.
        const isSystemSummary = trimmed.startsWith('**Objects of interest') || trimmed.startsWith('**Possible exits');
        const spacingClass = isSystemSummary ? "-mt-3" : "m-0";

        return (
          <p key={i} className={`${spacingClass} p-0`}>
            {parseInlineMarkdown(line, animate)}
          </p>
        );
      })}
    </div>
  );
};

export { parseInlineMarkdown };