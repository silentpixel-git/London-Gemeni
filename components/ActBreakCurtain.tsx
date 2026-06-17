import React from 'react';
import { motion } from 'motion/react';
import { ACT_ROMAN } from '../constants';
import { ACT_NAMES } from '../engine/gameData';

interface ActBreakCurtainProps {
  fromAct: number;
  toAct: number;
}

// Non-interactive cinematic overlay. Mounted only while the curtain is playing
// (after the player clicks "Begin Act N"); it has no button of its own.
export const ActBreakCurtain: React.FC<ActBreakCurtainProps> = ({ fromAct, toAct }) => {
  const endLabel = fromAct === 0 ? 'End of Prologue' : `End of Act ${ACT_ROMAN[fromAct] ?? fromAct}`;
  const actName = ACT_NAMES[toAct] ?? `Act ${toAct}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-center px-6"
      style={{ backgroundColor: 'rgb(var(--lb-bg))' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="flex flex-col items-center gap-2"
      >
        <span className="font-sans text-xs md:text-sm tracking-[0.3em] uppercase text-lb-muted">{endLabel}</span>
        <span className="text-lb-accent opacity-60 tracking-[0.4em] my-2 text-lg md:text-xl">❧ ⸻ ❧</span>
        <span className="font-sans text-sm md:text-base tracking-[0.3em] uppercase text-lb-accent">
          Act {ACT_ROMAN[toAct] ?? toAct}
        </span>
        <span className="font-serif text-3xl md:text-4xl text-lb-primary mt-1">{actName}</span>
      </motion.div>
    </motion.div>
  );
};
