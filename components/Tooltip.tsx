/**
 * components/Tooltip.tsx
 *
 * Small styled tooltip for icon-only controls. Shows after a short delay on
 * hover (or keyboard focus-visible); once one tooltip has been shown, moving
 * to an adjacent tooltipped control opens instantly with no animation, so
 * scanning a row of icons feels fast without defeating the initial delay.
 * Hover-gated — touch devices rely on the controls' aria-labels instead.
 */

import React, { useEffect, useRef, useState } from 'react';

// Module-level: when the pointer moves between tooltipped controls within
// this window, the next tooltip skips its delay and entrance animation.
let lastShownAt = 0;
const INSTANT_WINDOW_MS = 400;
const SHOW_DELAY_MS = 500;

interface TooltipProps {
  label: string;
  /** Which side of the trigger the tooltip appears on. */
  side?: 'top' | 'bottom';
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ label, side = 'bottom', children }) => {
  const [open, setOpen] = useState<false | 'animated' | 'instant'>(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const show = () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const instant = Date.now() - lastShownAt < INSTANT_WINDOW_MS;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(instant ? 'instant' : 'animated'), instant ? 0 : SHOW_DELAY_MS);
  };

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    if (open) lastShownAt = Date.now();
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      // Hide on press — the control's own feedback takes over from here.
      onMouseDown={hide}
      onFocus={e => { if (e.target.matches(':focus-visible')) show(); }}
      onBlur={hide}
    >
      {children}
      {open && (
        // Outer span centres the pill over the trigger without transforms, so
        // the zoom-in entrance (which owns `transform`) can't shift it.
        <span
          className={`pointer-events-none absolute inset-x-0 z-50 flex justify-center ${
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <span
            role="tooltip"
            className={`whitespace-nowrap rounded-md bg-lb-primary text-lb-bg font-sans text-xs px-2.5 py-1.5 shadow-lg ${
              side === 'top' ? 'origin-bottom' : 'origin-top'
            } ${open === 'animated' ? 'animate-in fade-in zoom-in-95 duration-150 ease-out' : ''}`}
          >
            {label}
          </span>
        </span>
      )}
    </span>
  );
};
