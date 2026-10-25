/**
 * components/AuthModal.tsx
 *
 * Overlay modal for signing in, styled to match the London Bleeds case-file
 * aesthetic. Magic-link only: the player enters an email and gets a one-time
 * sign-in link. Supabase creates the account on first use, so there is no
 * separate sign-up step. Consent to the terms is implied by continuing.
 *
 * Auth state (errors, notices) lives locally — the modal is self-contained.
 * Successful login is detected in App.tsx via the user state change, which
 * closes the modal.
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X, Mail, Loader2, CheckCircle } from 'lucide-react';
import { useSupabase } from './SupabaseProvider';
import { TermsContent } from './TermsContent';
import { ModalBackdrop } from './ModalBackdrop';
import { overlayPresence, zoomFadeVariants } from './motionTokens';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_RE = /\S+@\S+\.\S+/;

const inputClass =
  'w-full border border-lb-border rounded-lg px-3 py-2.5 bg-lb-paper text-lb-primary text-sm ' +
  'placeholder:text-lb-muted focus:outline-none focus:border-lb-accent focus:ring-1 focus:ring-lb-accent/40 transition-colors';

const primaryBtnClass =
  'w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lb-primary text-lb-bg text-sm font-semibold ' +
  'rounded-lg hover:bg-lb-accent disabled:opacity-40 disabled:cursor-not-allowed pressable';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const reducedMotion = useReducedMotion();
  const { loginWithEmail, authError, clearAuthError } = useSupabase();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: React.ReactNode } | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  // Lock body scroll while open; ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const resetState = () => {
    setEmail('');
    setIsSubmitting(false);
    setClientError(null);
    setNotice(null);
    setShowTerms(false);
    clearAuthError();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const emailValid = EMAIL_RE.test(email.trim());

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid || isSubmitting) return;
    setClientError(null);
    setIsSubmitting(true);
    const ok = await loginWithEmail(email.trim());
    setIsSubmitting(false);
    // Failure → authError shown. Success → App.tsx closes the modal once the link is opened.
    if (ok) {
      setNotice({
        title: 'Sign-in link sent',
        body: <>A one-time link is on its way to <span className="font-mono">{email.trim()}</span>. It may take a minute.</>,
      });
    }
  };

  const shownError = authError || clientError;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...overlayPresence}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          <ModalBackdrop onClick={handleClose} />

          {/* Modal card */}
          <motion.div variants={zoomFadeVariants(reducedMotion)} className="relative w-full max-w-md bg-lb-bg border border-lb-border rounded-xl shadow-2xl overflow-hidden">

            {/* Brass top rule */}
            <div className="h-1 bg-lb-accent" />

            {/* Header / masthead */}
            <div className="relative px-6 pt-7 pb-4 text-center">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-paper rounded-md pressable pressable-icon"
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <p className="font-serif text-lb-accent text-[11px] uppercase tracking-[0.25em] mb-1.5">London Bleeds</p>
              <h2 className="font-serif italic text-2xl text-lb-primary leading-tight">The Whitechapel Diaries</h2>
              <p className="text-lb-muted text-xs mt-2">Resume your investigation</p>
              {/* Ornamental divider */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="h-px w-12 bg-lb-border" />
                <div className="w-1.5 h-1.5 rotate-45 bg-lb-accent/60" />
                <div className="h-px w-12 bg-lb-border" />
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">

              {notice ? (
                <>
                  <div className="flex items-start gap-3 rounded-lg border border-lb-accent/40 bg-lb-accent/10 px-4 py-3">
                    <CheckCircle size={16} className="text-lb-accent mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-lb-primary">{notice.title}</p>
                      <p className="text-xs text-lb-muted mt-0.5">{notice.body}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotice(null)}
                    className="w-full text-center text-xs text-lb-muted hover:text-lb-primary transition-colors"
                  >
                    ← Back to sign in
                  </button>
                </>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setClientError(null); }}
                    placeholder="your@email.com"
                    className={inputClass}
                    autoComplete="email"
                    autoFocus
                  />
                  <button type="submit" disabled={!emailValid || isSubmitting} className={primaryBtnClass}>
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                    Email me a sign-in link
                  </button>
                </form>
              )}

              {/* Auth / validation error */}
              {shownError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
                  <p className="text-xs text-red-600">{shownError}</p>
                </div>
              )}

              {/* Consent note */}
              {!notice && (
                <div className="space-y-3">
                  <p className="text-center text-[10px] text-lb-muted">
                    By continuing you agree to our{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(v => !v)}
                      className="text-lb-accent underline hover:text-lb-primary transition-colors"
                    >
                      Terms &amp; Privacy Policy
                    </button>
                  </p>
                  {showTerms && (
                    <div className="max-h-48 overflow-y-auto pr-1">
                      <TermsContent />
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
