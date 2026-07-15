/**
 * components/ModalBackdrop.tsx
 *
 * The single standard modal backdrop: blue-tinted, blurred, 200ms fade-in
 * and a snappier fade-out. Render it as the first child of a fixed inset-0
 * `motion.div {...overlayPresence}` modal root (which drives the variants
 * here); the card follows as a `relative` sibling so it paints above.
 *
 * The tint/blur/fade live on this one element deliberately — animating an
 * ancestor of a backdrop-filter element makes the blur re-rasterize with a
 * one-frame flash when the animation's compositing group collapses.
 */
import React from 'react';
import { motion } from 'motion/react';
import { backdropVariants } from './motionTokens';

interface ModalBackdropProps {
  onClick?: () => void;
}

export const ModalBackdrop: React.FC<ModalBackdropProps> = ({ onClick }) => (
  <motion.div
    variants={backdropVariants}
    className="absolute inset-0 backdrop-blur-sm"
    style={{ backgroundColor: 'rgba(41, 51, 81, 0.75)' }}
    onClick={onClick}
  />
);
