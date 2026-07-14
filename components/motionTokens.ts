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
