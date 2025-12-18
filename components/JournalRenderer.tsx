import React from 'react';
import { parseInlineMarkdown } from './StoryRenderer';

interface JournalRendererProps {
  text: string;
}

export const JournalRenderer: React.FC<JournalRendererProps> = ({ text = "" }) => {
  const lines = (text || "").split('\n');
  
  return (
    <div className="space-y-2 font-sans text-sm text-[#293351] leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // 1. Check for standard Markdown headers (# Header)
        if (trimmed.startsWith('#')) {
            const cleanHeader = trimmed.replace(/^#+\s*/, '');
            return (
                <h4 key={i} className="font-bold text-[#CD7B00] uppercase text-xs tracking-widest mt-5 mb-2 border-b border-[#CD7B00]/20 pb-1">
                    {cleanHeader}
                </h4>
            );
        }

        // 2. Check for "Headline" pattern: **Found:** or * **Found:**
        // This regex catches lines that start with an optional bullet and contain a bold label ending in a colon.
        const labelMatch = trimmed.match(/^([\*\-]\s+)?\*\*(.*?):\*\*$/);
        if (labelMatch) {
            const label = labelMatch[2];
            return (
                <h5 key={i} className="font-bold text-[#CD7B00] text-[11px] uppercase tracking-widest mt-4 mb-1 first:mt-0">
                    {label}:
                </h5>
            );
        }

        // 3. Handle standard bullet points (that are not labels)
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const content = trimmed.substring(2);
            return (
                <div key={i} className="flex items-start gap-2 ml-1">
                    <div className="mt-2 w-1 min-w-[4px] h-1 rounded-full bg-[#CD7B00] opacity-60" />
                    <p className="leading-relaxed opacity-90">{parseInlineMarkdown(content, false)}</p>
                </div>
            );
        }

        // 4. Default paragraph
        return <p key={i} className="leading-relaxed opacity-90">{parseInlineMarkdown(trimmed, false)}</p>;
      })}
    </div>
  );
};