/**
 * components/CommandInput.tsx
 *
 * The command bar at the bottom of the main column.
 * Owns the text field value locally — calls onAction(value) on submit
 * then clears the local input. This avoids the hook needing to
 * know about the raw text field state.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Feather, Lightbulb, Send, Eye, Search, Glasses, Compass, Brain, Microscope, BookOpen, type LucideIcon } from 'lucide-react';
import { GameHistoryItem } from '../types';
import { zoomFade } from './motionTokens';
import { Tooltip } from './Tooltip';

const LOADING_VARIANTS: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Eye,        text: 'Surveying the scene...' },
  { icon: Search,     text: 'Examining the evidence...' },
  { icon: Glasses,    text: 'Scrutinising the details...' },
  { icon: Compass,    text: 'Taking bearings...' },
  { icon: Brain,      text: 'Cataloguing observations...' },
  { icon: Microscope, text: 'Investigating closely...' },
];

const PROMPTS_DESKTOP = [
  'How do you choose to proceed, Doctor?',
  'The game is afoot. What next?',
  'The fog thickens. What will you do?',
  'Holmes waits. Proceed, Doctor.',
  'What does your instinct tell you?',
  'Every second counts. Your move.',
  'The night is watching. Choose carefully.',
];

const PROMPTS_MOBILE = [
  'Your move, Doctor.',
  'The game is afoot.',
  'Proceed, Doctor.',
  'Holmes waits.',
  'What next?',
  'Choose carefully.',
  'Every second counts.',
];

interface CommandInputProps {
  isLoading: boolean;
  isGameOver: boolean;
  isConsultingHolmes: boolean;
  isAdvancingAct: boolean;
  history: GameHistoryItem[];
  onAction: (userAction: string) => Promise<void>;
  onConsultHolmes: () => void;
  /** Lets the feed keep typed text clear of the dock (chips + input). */
  dockRef?: React.Ref<HTMLDivElement>;
  /** A command placed in the input from the sidebar; the nonce re-applies a repeat. */
  prefill?: { text: string; nonce: number } | null;
  /** "Try" chips — each sends its command when clicked. Empty hides the row. */
  suggestions?: string[];
}

export const CommandInput: React.FC<CommandInputProps> = ({
  isLoading,
  isGameOver,
  isConsultingHolmes,
  isAdvancingAct,
  history,
  onAction,
  onConsultHolmes,
  dockRef,
  prefill,
  suggestions = [],
}) => {
  const reducedMotion = useReducedMotion();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // A sidebar click fills the line (it never sends) and hands focus back to it.
  useEffect(() => {
    if (!prefill) return;
    setInput(prefill.text);
    const el = inputRef.current;
    if (el) {
      el.focus({ preventScroll: true });
      requestAnimationFrame(() => el.setSelectionRange(prefill.text.length, prefill.text.length));
    }
  }, [prefill]);

  // Pick a random starting message once per wait; the CSS rotation loop
  // (see index.css lb-rot-*) cycles onward from there.
  const loadingStart = useMemo(
    () => Math.floor(Math.random() * LOADING_VARIANTS.length),
    [isLoading], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const loadingVariant = LOADING_VARIANTS[loadingStart];

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const prompts = isMobile ? PROMPTS_MOBILE : PROMPTS_DESKTOP;
  const placeholder = prompts[history.length % prompts.length];

  if (isGameOver) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const value = input;
    setInput('');
    await onAction(value);
  };

  const isStreaming =
    isLoading &&
    (isConsultingHolmes ||
      (history.length > 0 &&
        history[history.length - 1].role === 'assistant' &&
        history[history.length - 1].text === ''));

  return (
    <div
      className="absolute bottom-0 inset-x-0 z-[4] pointer-events-none px-4 pt-10 pb-[calc(16px+env(safe-area-inset-bottom,0px))] desk:px-16 desk:pt-12 desk:pb-[calc(24px+env(safe-area-inset-bottom,0px))]"
      style={{ background: 'linear-gradient(to top, rgb(var(--lb-bg)) 72%, rgb(var(--lb-bg) / 0))' }}
    >
      <div ref={dockRef} data-flip className="max-w-3xl mx-auto flex flex-col gap-2.5 pointer-events-auto">
      {/* "Try" — things here not yet tried; a click sends the command. */}
      {suggestions.length > 0 && !isLoading && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.16em] text-lb-muted">Try</span>
          {suggestions.map(cmd => (
            <button
              key={cmd}
              type="button"
              onClick={() => onAction(cmd)}
              className="pressable rounded-full border border-dashed border-lb-muted/70 bg-lb-paper/70 px-3 py-1.5 text-[13px] text-lb-primary/85 hover:border-lb-accent hover:text-lb-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lb-accent"
            >
              {cmd}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="relative"
      >
        <AnimatePresence>
        {isStreaming && (
          <motion.div {...zoomFade(reducedMotion)} className="absolute bottom-full left-4 mb-2 flex items-center gap-2 text-lb-accent origin-bottom-left z-20">
            {isConsultingHolmes ? (
              <>
                <Feather size={14} className="lb-wait-icon shrink-0" />
                <span className="text-sm italic font-serif lb-ink-mask lb-wait-txt">Watson is contemplating...</span>
              </>
            ) : isAdvancingAct ? (
              <>
                <BookOpen size={14} className="lb-wait-icon shrink-0" />
                <span className="text-sm italic font-serif lb-ink-mask lb-wait-txt">Turning the page to a new act...</span>
              </>
            ) : reducedMotion ? (
              <>
                <loadingVariant.icon size={14} className="shrink-0" />
                <span className="text-sm italic font-serif">{loadingVariant.text}</span>
              </>
            ) : (
              // All messages render stacked; the lb-rot-* CSS loop shows one
              // 3.1s slot at a time, offset per line via --lb-slot, starting
              // from the randomly chosen message.
              <span className="relative block h-5">
                {LOADING_VARIANTS.map(({ icon: Icon, text }, k) => (
                  <span
                    key={text}
                    className="lb-rot-line absolute left-0 top-0 flex items-center gap-2 whitespace-nowrap"
                    style={{ '--lb-slot': `${((k - loadingStart + LOADING_VARIANTS.length) % LOADING_VARIANTS.length) * 3.1}s` } as React.CSSProperties}
                  >
                    <Icon size={14} className="lb-rot-icon shrink-0" />
                    <span className="text-sm italic font-serif lb-ink-mask lb-rot-txt">{text}</span>
                  </span>
                ))}
              </span>
            )}
          </motion.div>
        )}
        </AnimatePresence>

        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-lb-paper border border-lb-border rounded-full py-4 pl-6 pr-[104px] text-[18px] leading-normal font-sans text-lb-primary placeholder:text-lb-muted placeholder:italic focus:outline-none focus:border-lb-accent transition-colors duration-150 shadow-[0_1px_2px_rgb(var(--lb-primary)/0.06)] relative z-10"
            autoFocus
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
            <Tooltip label="Gather your thoughts" side="top">
              <button
                type="button"
                onClick={onConsultHolmes}
                disabled={isLoading}
                className="w-10 h-10 grid place-items-center rounded-full text-lb-muted hover:text-lb-accent hover:bg-lb-accent/[0.08] pressable pressable-icon disabled:opacity-50"
                aria-label="Gather your thoughts"
              >
                <Lightbulb size={20} />
              </button>
            </Tooltip>
            <Tooltip label="Send" side="top">
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 grid place-items-center rounded-full text-lb-muted hover:text-lb-accent hover:bg-lb-accent/[0.08] pressable pressable-icon disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={20} />
              </button>
            </Tooltip>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
};
