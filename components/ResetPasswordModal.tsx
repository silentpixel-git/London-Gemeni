/**
 * components/ResetPasswordModal.tsx
 *
 * Shown after the player follows a password-recovery email link. Supabase
 * establishes a temporary recovery session (SupabaseProvider sets
 * isPasswordRecovery); this modal lets them choose a new password via
 * updateUser() before continuing into the game.
 *
 * Takes precedence over the slot menu / first-run profile so the player
 * actually gets the chance to set a password.
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useSupabase } from './SupabaseProvider';
import { ModalBackdrop } from './ModalBackdrop';

interface ResetPasswordModalProps {
  isOpen: boolean;
}

const inputClass =
  'w-full border border-lb-border rounded-lg px-3 py-2.5 bg-lb-paper text-lb-primary text-sm ' +
  'placeholder:text-lb-muted focus:outline-none focus:border-lb-accent focus:ring-1 focus:ring-lb-accent/40 transition-colors';

const primaryBtnClass =
  'w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lb-primary text-lb-bg text-sm font-semibold ' +
  'rounded-lg hover:bg-lb-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen }) => {
  const { updatePassword, clearPasswordRecovery, authError, clearAuthError } = useSupabase();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Reset local state whenever the modal opens fresh
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setIsSubmitting(false);
      setDone(false);
      clearAuthError();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const passwordsMatch = password === confirmPassword;
  const canSubmit = password.length >= 6 && passwordsMatch && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    const ok = await updatePassword(password);
    setIsSubmitting(false);
    if (ok) setDone(true); // clearPasswordRecovery already fired inside updatePassword
  };

  // "Skip" — keep the recovery session (player stays signed in) without changing
  // the password. clears the flag so the normal flow proceeds.
  const handleSkip = () => {
    clearAuthError();
    clearPasswordRecovery();
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
    >
      <ModalBackdrop onClick={handleSkip} />

      <div className="relative w-full max-w-md bg-lb-bg border border-lb-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ease-out">
        <div className="h-1 bg-lb-accent" />

        <div className="relative px-6 pt-7 pb-4 text-center">
          {!done && (
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-paper rounded-md transition-colors"
              aria-label="Skip"
              title="Keep my current password"
            >
              <X size={16} />
            </button>
          )}
          <p className="font-serif text-lb-accent text-[11px] uppercase tracking-[0.25em] mb-1.5">London Bleeds</p>
          <h2 className="font-serif italic text-2xl text-lb-primary leading-tight">Set a New Password</h2>
          <p className="text-lb-muted text-xs mt-2">
            {done ? 'Your password has been updated.' : 'Choose a new password to secure your case files.'}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="h-px w-12 bg-lb-border" />
            <div className="w-1.5 h-1.5 rotate-45 bg-lb-accent/60" />
            <div className="h-px w-12 bg-lb-border" />
          </div>
        </div>

        <div className="p-6 space-y-4">
          {done ? (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-lb-accent/40 bg-lb-accent/10 px-4 py-3">
                <CheckCircle size={16} className="text-lb-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-lb-primary">Password updated</p>
                  <p className="text-xs text-lb-muted mt-0.5">You can use your new password next time you sign in.</p>
                </div>
              </div>
              <button type="button" onClick={clearPasswordRecovery} className={primaryBtnClass}>
                Continue to the investigation
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="New password (min. 6 characters)"
                  className={`${inputClass} pr-10`}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-lb-muted hover:text-lb-primary transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={inputClass}
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-[11px] text-red-600">Passwords don&apos;t match.</p>
              )}

              <button type="submit" disabled={!canSubmit} className={primaryBtnClass}>
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Update Password
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="w-full text-center text-xs text-lb-muted hover:text-lb-primary transition-colors"
              >
                Skip for now
              </button>
            </form>
          )}

          {authError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
              <p className="text-xs text-red-600">{authError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
