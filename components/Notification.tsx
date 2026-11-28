import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // A manual popover sits in the top layer, so the toast shows above an open modal <dialog> too.
  useLayoutEffect(() => { ref.current?.showPopover(); }, []);

  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), 2700);
    const closeTimer = setTimeout(onClose, 3000);
    return () => { clearTimeout(leaveTimer); clearTimeout(closeTimer); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      popover="manual"
      className={`
        fixed inset-auto top-6 left-1/2 -translate-x-1/2 m-0 border-0 overflow-visible
        flex items-center gap-3 px-6 py-3 rounded-full shadow-xl
        lb-in-drop
        transition-[opacity,transform] ease-out
        ${leaving ? 'opacity-0 -translate-y-2' : ''}
        ${type === 'error' ? 'bg-red-900 text-white' : 'bg-lb-primary text-lb-bg'}
      `}
      // lb-in-drop is the entrance (0.3s); the exit transition is snappier
      // (system responding, not announcing).
      style={{ transitionDuration: '200ms' }}
    >
      {type === 'error'
        ? <AlertCircle size={20} />
        : <CheckCircle size={20} className="text-lb-accent" />
      }
      <span className="font-bold text-sm tracking-wide">{message}</span>
    </div>
  );
};
