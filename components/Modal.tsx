/**
 * components/Modal.tsx
 *
 * The shell every modal shares: a native <dialog> opened with showModal(), so
 * the browser supplies Escape, an inert page behind it, and focus moved in on
 * open (or to the card's autoFocus) and back to the opener on close. motion
 * animates it in and out: the dialog stays mounted (and modal) until its exit
 * finishes. Nothing behind it can scroll: the app shell never scrolls the
 * body, and the dialog covers the viewport.
 *
 * The dialog is the overlayPresence root, so the card (the child) takes
 * variants (zoomFadeVariants or its own) and ModalBackdrop fades with it.
 *
 * `onDismiss`: Escape and a press on the backdrop call it. Leave it out for a
 * modal that must be answered; Escape then does nothing, and if the browser
 * closes the dialog anyway (it may, on a repeated Escape), it reopens.
 * `className`: where the card sits; centred with a gutter unless given.
 * `labelledBy`: the id of the card's heading, the dialog's accessible name.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ModalBackdrop } from './ModalBackdrop';
import { overlayPresence } from './motionTokens';

interface ModalProps {
  isOpen: boolean;
  onDismiss?: () => void;
  className?: string;
  labelledBy?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, ...rest }) => (
  <AnimatePresence>{isOpen && <OpenModal {...rest} />}</AnimatePresence>
);

const OpenModal: React.FC<Omit<ModalProps, 'isOpen'>> = ({ onDismiss, className = 'items-center p-4', labelledBy, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  // Read during the first render, before an autoFocus inside the card takes focus.
  const opener = useRef<Element | null>(null);
  opener.current ??= document.activeElement;
  // React runs a card's autoFocus before this effect, and showModal would move focus to the first
  // button; kept in a ref so a re-run of the effect (StrictMode) still finds it.
  const autoFocused = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const dialog = ref.current!;
    const onCancel = (e: Event) => { e.preventDefault(); dismiss.current?.(); };
    const onClose = () => { if (!dismiss.current && !dialog.open) dialog.showModal(); };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose);
    if (dialog.contains(document.activeElement)) autoFocused.current = document.activeElement as HTMLElement;
    dialog.showModal();
    autoFocused.current?.focus();
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClose);
      dialog.close();
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  return (
    <motion.dialog
      ref={ref}
      aria-labelledby={labelledBy}
      {...overlayPresence}
      className={`fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none justify-center overflow-hidden border-0 bg-transparent p-0 text-lb-primary backdrop:bg-transparent ${className}`}
    >
      <ModalBackdrop onClick={() => dismiss.current?.()} />
      {children}
    </motion.dialog>
  );
};
