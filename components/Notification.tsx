import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-[100]
      flex items-center gap-3 px-6 py-3 rounded-full shadow-xl
      animate-in fade-in slide-in-from-top-4 duration-300
      ${type === 'error' ? 'bg-red-900 text-white' : 'bg-lb-primary text-white'}
    `}>
      {type === 'error'
        ? <AlertCircle size={20} />
        : <CheckCircle size={20} className="text-lb-accent" />
      }
      <span className="font-bold text-sm tracking-wide">{message}</span>
    </div>
  );
};
