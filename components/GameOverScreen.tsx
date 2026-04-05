/**
 * components/GameOverScreen.tsx
 *
 * "Case Closed" end screen displayed below the narrative feed when the game ends.
 * No props — calls window.location.reload() internally to restart.
 */

import React from 'react';
import { Feather, ArrowDown } from 'lucide-react';

export const GameOverScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 border-t border-lb-accent/20 mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
    <div className="text-lb-accent flex flex-col items-center gap-4 text-center">
      <Feather size={48} className="opacity-30" />
      <div className="space-y-1">
        <h2 className="font-serif text-4xl italic tracking-tight">Case Closed</h2>
        <p className="text-xs opacity-60 font-sans tracking-[0.3em] uppercase">The Whitechapel Diaries</p>
      </div>
    </div>

    <div className="max-w-md text-center space-y-4">
      <p className="font-serif text-lb-primary/70 italic leading-relaxed">
        The ink has dried on this chapter of London's history. The truth, however elusive, has been recorded.
      </p>
    </div>

    <button
      onClick={() => window.location.reload()}
      className="group flex items-center gap-3 px-10 py-4 bg-lb-primary text-lb-bg rounded-full font-sans text-xs tracking-[0.2em] uppercase hover:bg-lb-accent transition-all duration-500 shadow-xl hover:shadow-2xl hover:-translate-y-1"
    >
      <span>Begin a New Diary</span>
      <ArrowDown size={14} className="group-hover:translate-y-1 transition-transform" />
    </button>
  </div>
);
