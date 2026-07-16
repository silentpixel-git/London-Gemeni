/**
 * components/CommandInput.tsx
 *
 * The command bar at the bottom of the main column.
 * Owns the text field value locally — calls onAction(value) on submit
 * then clears the local input. This avoids the hook needing to
 * know about the raw text field state.
 */

import React, { useState, useMemo } from 'react';
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
}

export const CommandInput: React.FC<CommandInputProps> = ({
  isLoading,
  isGameOver,
  isConsultingHolmes,
  isAdvancingAct,
  history,
  onAction,
  onConsultHolmes,
}) => {
  const reducedMotion = useReducedMotion();
  const [input, setInput] = useState('');

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
    <div className="absolute bottom-0 left-0 right-0 px-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-10 md:px-16 md:pb-[max(3rem,env(safe-area-inset-bottom))] md:pt-16 lg:pt-18 bg-gradient-to-t from-lb-bg to-transparent pointer-events-none">
      <form
        onSubmit={handleSubmit}
        className="relative pointer-events-auto max-w-3xl mx-auto"
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
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-lb-paper border border-lb-border rounded-full py-4 pl-6 pr-24 text-lb-primary placeholder-lb-muted text-lg focus:outline-none focus:border-lb-accent transition-colors duration-150 shadow-sm relative z-10"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
            <Tooltip label="Gather your thoughts" side="top">
              <button
                type="button"
                onClick={onConsultHolmes}
                disabled={isLoading}
                className="p-2 text-lb-muted hover:text-lb-accent pressable pressable-icon disabled:opacity-50"
                aria-label="Gather your thoughts"
              >
                <Lightbulb size={20} />
              </button>
            </Tooltip>
            <Tooltip label="Send" side="top">
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 text-lb-muted hover:text-lb-accent pressable pressable-icon disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={20} />
              </button>
            </Tooltip>
          </div>
        </div>
      </form>
    </div>
  );
};
