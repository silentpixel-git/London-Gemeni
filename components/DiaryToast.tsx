/**
 * components/DiaryToast.tsx
 *
 * A small "Noted in the diary" pill under the header when Watson records
 * something while the diary is closed. Transition-based (not keyframes), so a
 * second note mid-exit retargets instead of restarting; the exit is faster
 * than the entrance. Reduced motion keeps the fade and drops the slide.
 */

import React from 'react';
import { Feather } from 'lucide-react';

export const DiaryToast: React.FC<{ show: boolean }> = ({ show }) => (
  <div
    role="status"
    aria-live="polite"
    className={`fixed left-1/2 top-[calc(76px+env(safe-area-inset-top,0px))] z-40 -translate-x-1/2 pointer-events-none whitespace-nowrap
      flex items-center gap-2 px-4 py-2 rounded-full bg-lb-primary text-lb-bg text-[13px] shadow-[0_8px_24px_rgb(0_0_0/0.18)]
      transition-[opacity,transform,visibility] ease-out-quint motion-reduce:transform-none ${
      show
        ? 'opacity-100 translate-y-0 visible duration-200'
        : 'opacity-0 -translate-y-1.5 invisible duration-150'
    }`}
  >
    <Feather size={14} className="text-lb-accent" />
    {show ? 'Noted in the diary' : ''}
  </div>
);
