
import React from 'react';

const parseInlineMarkdown = (text: string, animate: boolean = false) => {
  const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|_.*?_)/g);

  return parts.map((part, j) => {
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return <span key={j} className="font-bold italic text-lb-accent">{part.slice(3, -3)}</span>;
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const content = part.slice(2, -2);
      const isSystemLabel = content.startsWith('Objects of interest') || content.startsWith('Possible exits');
      const textColor = isSystemLabel ? 'text-lb-primary' : 'text-lb-accent';
      return <span key={j} className={`font-bold ${textColor}`}>{content}</span>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <span key={j} className="italic">{part.slice(1, -1)}</span>;
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length >= 2) {
      return <span key={j} className="italic">{part.slice(1, -1)}</span>;
    }

    return <span key={j}>{part}</span>;
  });
};

// The narrator occasionally emits the world-event blockquote inline
// (e.g. "...restless energy. > *quote.* Without...") instead of on its own
// line, which Markdown does not treat as a blockquote. Pull any inline
// "> *...*" onto its own line so it renders correctly.
const normalizeInlineBlockquotes = (text: string): string =>
  text.replace(/[ \t]*>[ \t]*(\*[^*\n]+\*)[ \t]*/g, '\n\n> $1\n\n');

interface StoryRendererProps {
  text: string;
  animate?: boolean;
  /** Typewriter caret. Rendered inside the final block so it sits against the
      last character rather than dropping onto its own line beneath the prose. */
  caret?: React.ReactNode;
}

export const StoryRenderer: React.FC<StoryRendererProps> = ({ text = "", animate = false, caret }) => {
  const safeText = normalizeInlineBlockquotes(text || "");
  const lines = safeText.split('\n');

  // Blank lines render nothing, so the caret belongs on the last line that has
  // content. Before any text has arrived there is no block to put it in, and it
  // falls back to the wrapper.
  let caretLine = -1;
  if (caret) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim()) { caretLine = i; break; }
    }
  }

  return (
    <div className="
      space-y-6 font-sans
      text-[16px] md:text-[18px] lg:text-[20px]
      leading-relaxed md:leading-relaxed lg:leading-[1.8]
      text-lb-primary
      max-w-3xl
    ">
      {caretLine === -1 && caret}
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const tail = i === caretLine ? caret : null;

        if (line.startsWith('###')) {
          return (
            <div key={i} className="pt-8 pb-4">
              <h4 className="text-sm font-bold tracking-[0.2em] uppercase text-lb-primary opacity-80 font-sans">
                {line.replace(/###\s*/, '')}
                {tail}
              </h4>
            </div>
          );
        }

        if (line.startsWith('>')) {
          return (
            <div key={i} className="pl-6 border-l-[3px] border-lb-accent my-6 py-1">
              <p className="italic text-lb-primary font-playfair text-[20px] md:text-[24px] leading-relaxed opacity-90">
                {parseInlineMarkdown(line.replace(/>\s*/, ''), animate)}
                {tail}
              </p>
            </div>
          );
        }

        if (trimmed.match(/^[\*\-]\s/)) {
          const content = trimmed.replace(/^[\*\-]\s/, '');
          return (
            <div key={i} className="flex items-start gap-3 ml-2 my-2">
              <div className="mt-2.5 w-1.5 min-w-[6px] h-1.5 rounded-full bg-lb-accent opacity-90" />
              <div>{parseInlineMarkdown(content, animate)}{tail}</div>
            </div>
          );
        }

        const isSystemSummary = trimmed.startsWith('**Objects of interest') || trimmed.startsWith('**Possible exits');
        const spacingClass = (isSystemSummary && trimmed.length > 25) ? '-mt-3' : 'm-0';

        return (
          <p key={i} className={`${spacingClass} p-0`}>
            {parseInlineMarkdown(line, animate)}
            {tail}
          </p>
        );
      })}
    </div>
  );
};

export { parseInlineMarkdown };
