/**
 * components/motionTokens.ts
 *
 * Motion vocabulary for `motion/react` components, mirroring the Tailwind
 * side (see tailwind.config.js): controls 0.15s, small UI 0.2s, panels 0.3s,
 * dramatic scene moments 0.5–0.7s. All UI movement eases OUT.
 */
export const EASE_OUT: [number, number, number, number] = [0, 0, 0.2, 1];
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const DUR_CONTROL = 0.15;
export const DUR_SMALL = 0.2;
export const DUR_PANEL = 0.3;
export const DUR_DRAMATIC = 0.6;
/** Exits are snappier than enters — the system responding vs. announcing. */
export const DUR_EXIT = 0.15;

/**
 * Self-contained fade + subtle zoom (never from scale 0) with a faster fade
 * out, for elements that are themselves the direct AnimatePresence child
 * (dropdown menus, the streaming indicator). Anchored popovers set their own
 * transform-origin via CSS (`origin-top-right` etc.).
 * Pass the `useReducedMotion()` result to drop the scale for those users.
 */
export const zoomFade = (reducedMotion: boolean | null) => ({
  initial: reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: {
    opacity: 0,
    ...(reducedMotion ? {} : { scale: 0.97 }),
    transition: { duration: DUR_EXIT, ease: EASE_OUT_EXPO },
  },
  transition: { duration: DUR_SMALL, ease: EASE_OUT_EXPO },
});

/**
 * Overlay presence pattern for modals: the fixed inset-0 wrapper takes these
 * props and MUST be a motion.div — AnimatePresence only unmounts exiting
 * children whose direct child is a motion component. The wrapper animates
 * nothing itself; it propagates 'visible'/'hidden' to the backdrop and card
 * variants below, and holds unmount until both finish.
 */
export const overlayPresence = {
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
} as const;

/** Backdrop fade, driven by the overlayPresence wrapper's variant state. */
export const backdropVariants = {
  visible: { opacity: 1, transition: { duration: DUR_SMALL } },
  hidden: { opacity: 0, transition: { duration: DUR_EXIT } },
};

/** Modal-card fade + zoom, driven by the overlayPresence wrapper. */
export const zoomFadeVariants = (reducedMotion: boolean | null) => ({
  visible: { opacity: 1, scale: 1, transition: { duration: DUR_SMALL, ease: EASE_OUT_EXPO } },
  hidden: {
    opacity: 0,
    ...(reducedMotion ? {} : { scale: 0.96 }),
    transition: { duration: DUR_EXIT, ease: EASE_OUT_EXPO },
  },
});
