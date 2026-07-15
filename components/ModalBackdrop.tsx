/**
 * components/ModalBackdrop.tsx
 *
 * The single standard modal backdrop: blue-tinted, blurred, 200ms fade-in.
 * Render it as the first child of a fixed inset-0 modal root; the card
 * follows as a `relative` sibling so it paints above.
 *
 * The tint/blur/fade live on this one element deliberately — animating an
 * ancestor of a backdrop-filter element makes the blur re-rasterize with a
 * one-frame flash when the animation's compositing group collapses.
 */
import React from 'react';

interface ModalBackdropProps {
  onClick?: () => void;
}

export const ModalBackdrop: React.FC<ModalBackdropProps> = ({ onClick }) => (
  <div
    className="absolute inset-0 backdrop-blur-sm animate-in fade-in duration-200"
    style={{ backgroundColor: 'rgba(41, 51, 81, 0.75)' }}
    onClick={onClick}
  />
);
