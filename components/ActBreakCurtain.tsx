import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT, EASE_OUT_QUINT, DUR_DRAMATIC } from './motionTokens';
import { ACT_ROMAN } from '../constants';
import { ACT_NAMES } from '../engine/gameData';

interface ActBreakCurtainProps {
  fromAct: number;
  toAct: number;
}

// Non-interactive cinematic overlay. Mounted only while the curtain is playing
// (after the player clicks "Begin Act N"); it has no button of its own.
export const ActBreakCurtain: React.FC<ActBreakCurtainProps> = ({ fromAct, toAct }) => {
  const reducedMotion = useReducedMotion();
  const endLabel = fromAct === 0 ? 'End of Prologue' : `End of Act ${ACT_ROMAN[fromAct] ?? fromAct}`;
  const actName = ACT_NAMES[toAct] ?? `Act ${toAct}`;
  const line = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT_QUINT } },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -40 }}
      transition={{ duration: DUR_DRAMATIC, ease: EASE_OUT }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-center px-6"
      style={{ backgroundColor: 'rgb(var(--lb-bg))' }}
    >
      {/* The lines arrive one after another, 80ms apart. */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { delayChildren: 0.25, staggerChildren: 0.08 } } }}
        className="flex flex-col items-center gap-2"
      >
        <motion.span variants={line} className="font-sans text-xs md:text-sm tracking-[0.3em] uppercase text-lb-muted">{endLabel}</motion.span>
        <motion.span variants={line} className="text-lb-accent/60 tracking-[0.4em] my-2 text-lg md:text-xl">❧ ⸻ ❧</motion.span>
        <motion.span variants={line} className="font-sans text-sm md:text-base tracking-[0.3em] uppercase text-lb-accent">
          Act {ACT_ROMAN[toAct] ?? toAct}
        </motion.span>
        <motion.span variants={line} className="font-serif text-3xl md:text-4xl text-lb-primary mt-1">{actName}</motion.span>
      </motion.div>
    </motion.div>
  );
};
