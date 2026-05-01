/**
 * components/CommandInput.tsx
 *
 * The command bar at the bottom of the main column.
 * Owns the text field value locally — calls onAction(value) on submit
 * then clears the local input. This avoids the hook needing to
 * know about the raw text field state.
 */

import React, { useState } from 'react';
import { Feather, Lightbulb, Send } from 'lucide-react';
import { GameHistoryItem } from '../types';

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
  history: GameHistoryItem[];
  onAction: (userAction: string) => Promise<void>;
  onConsultHolmes: () => void;
}

export const CommandInput: React.FC<CommandInputProps> = ({
  isLoading,
  isGameOver,
  isConsultingHolmes,
  history,
  onAction,
  onConsultHolmes,
}) => {
  const [input, setInput] = useState('');

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
    <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 pt-10 md:px-16 md:pb-12 md:pt-16 lg:pt-18 bg-gradient-to-t from-lb-bg to-transparent pointer-events-none">
      <form
        onSubmit={handleSubmit}
        className="relative pointer-events-auto max-w-3xl mx-auto"
      >
        {isStreaming && (
          <div className="absolute bottom-full left-4 mb-2 flex items-center gap-2 text-lb-accent animate-in fade-in zoom-in-95 duration-300 z-20">
            <Feather size={14} className="animate-bounce" />
            <span className="text-sm italic font-serif">
              {isConsultingHolmes ? 'Holmes is contemplating...' : 'The ink is drying...'}
            </span>
          </div>
        )}

        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-lb-paper border border-lb-border rounded-full py-4 pl-6 pr-24 text-lb-primary placeholder-lb-muted text-lg focus:outline-none focus:border-lb-accent shadow-sm relative z-10"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
            <button
              type="button"
              onClick={onConsultHolmes}
              disabled={isLoading}
              className="p-2 text-lb-muted hover:text-lb-accent transition-colors disabled:opacity-50"
              title="Consult Holmes"
            >
              <Lightbulb size={20} />
            </button>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 text-lb-muted hover:text-lb-accent transition-colors disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
