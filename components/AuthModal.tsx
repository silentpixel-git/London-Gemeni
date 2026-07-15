/**
 * components/AuthModal.tsx
 *
 * Overlay modal for Sign In and Create Account, styled to match the
 * London Bleeds case-file aesthetic.
 *
 * Tabs:
 *   - Sign In:        Google OAuth | email + password | forgot-password | magic-link fallback
 *   - Create Account: Google OAuth | email + password (+ confirm) + T&C acceptance
 *
 * Password auth logs the player in entirely in-app (no email round-trip) when
 * Supabase "Confirm email" is disabled. Auth state (loading, errors, notices)
 * lives locally — the modal is self-contained. Successful login is detected in
 * App.tsx via the user state change, which closes the modal.
 */

import React, { useState, useEffect } from 'react';
import { X, Mail, Loader2, CheckCircle, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { useSupabase } from './SupabaseProvider';
import { TermsContent } from './TermsContent';
import { ModalBackdrop } from './ModalBackdrop';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Inline Google SVG logo (official brand colours)
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const EMAIL_RE = /\S+@\S+\.\S+/;

const inputClass =
  'w-full border border-lb-border rounded-lg px-3 py-2.5 bg-lb-paper text-lb-primary text-sm ' +
  'placeholder:text-lb-muted focus:outline-none focus:border-lb-accent focus:ring-1 focus:ring-lb-accent/40 transition-colors';

const primaryBtnClass =
  'w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-lb-primary text-lb-bg text-sm font-semibold ' +
  'rounded-lg hover:bg-lb-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    loginWithGoogle, loginWithEmail,
    loginWithPassword, signUpWithPassword, resetPassword,
    authError, clearAuthError,
  } = useSupabase();

  const [activeTab, setActiveTab] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: React.ReactNode } | null>(null);

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
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setHasAcceptedTerms(false);
    setIsSubmitting(false);
    setClientError(null);
    setNotice(null);
    clearAuthError();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleTabChange = (tab: 'signin' | 'create') => {
    setActiveTab(tab);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setClientError(null);
    setNotice(null);
    clearAuthError();
  };

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordsMatch = password === confirmPassword;
  const canSignIn = emailValid && password.length > 0 && !isSubmitting;
  const canCreate =
    emailValid && password.length >= 6 && passwordsMatch && hasAcceptedTerms && !isSubmitting;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSignIn) return;
    setClientError(null);
    setIsSubmitting(true);
    await loginWithPassword(email.trim(), password);
    setIsSubmitting(false);
    // Success → App.tsx closes the modal on user change. Failure → authError shown.
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setClientError(null);
    setIsSubmitting(true);
    const result = await signUpWithPassword(email.trim(), password);
    setIsSubmitting(false);
    if (result === 'confirm') {
      setNotice({
        title: 'Confirm your email',
        body: <>We&apos;ve sent a confirmation link to <span className="font-mono">{email.trim()}</span>. Click it to enter the investigation.</>,
      });
    }
    // 'session' → App.tsx logs in & opens first-run profile. 'error' → authError shown.
  };

  const handleForgot = async () => {
    clearAuthError();
    if (!emailValid) {
      setClientError('Enter your email above, then tap “Forgot password?”');
      return;
    }
    setClientError(null);
    setIsSubmitting(true);
    const ok = await resetPassword(email.trim());
    setIsSubmitting(false);
    if (ok) {
      setNotice({
        title: 'Reset link sent',
        body: <>Check <span className="font-mono">{email.trim()}</span> for a link to set a new password.</>,
      });
    }
  };

  const handleMagicLink = async () => {
    clearAuthError();
    if (!emailValid) {
      setClientError('Enter your email above first.');
      return;
    }
    setClientError(null);
    setIsSubmitting(true);
    await loginWithEmail(email.trim());
    setIsSubmitting(false);
    setNotice({
      title: 'Sign-in link sent',
      body: <>A one-time link is on its way to <span className="font-mono">{email.trim()}</span>. It may take a minute.</>,
    });
  };

  const handleGoogle = () => {
    clearAuthError();
    loginWithGoogle();
    // Page will redirect — no onClose() needed
  };

  if (!isOpen) return null;

  const shownError = authError || clientError;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      <ModalBackdrop onClick={handleClose} />

      {/* Modal card */}
      <div className="relative w-full max-w-md bg-lb-bg border border-lb-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ease-out">

        {/* Brass top rule */}
        <div className="h-1 bg-lb-accent" />

        {/* Header / masthead */}
        <div className="relative px-6 pt-7 pb-4 text-center">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-paper rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <p className="font-serif text-lb-accent text-[11px] uppercase tracking-[0.25em] mb-1.5">London Bleeds</p>
          <h2 className="font-serif italic text-2xl text-lb-primary leading-tight">The Whitechapel Diaries</h2>
          <p className="text-lb-muted text-xs mt-2">
            {activeTab === 'signin' ? 'Resume your investigation' : 'Open a new case file'}
          </p>
          {/* Ornamental divider */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="h-px w-12 bg-lb-border" />
            <div className="w-1.5 h-1.5 rotate-45 bg-lb-accent/60" />
            <div className="h-px w-12 bg-lb-border" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-lb-border mx-6">
          {(['signin', 'create'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                activeTab === tab
                  ? 'text-lb-accent border-b-2 border-lb-accent -mb-px'
                  : 'text-lb-muted hover:text-lb-primary'
              }`}
            >
              {tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
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
                ← Back to {activeTab === 'signin' ? 'sign in' : 'sign up'}
              </button>
            </>
          ) : (
            <>
              {/* Google OAuth */}
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-lb-border bg-lb-paper hover:border-lb-accent/60 rounded-lg text-sm font-medium text-lb-primary transition-colors"
              >
                <GoogleLogo />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-lb-border" />
                <span className="text-lb-muted text-xs">or</span>
                <div className="flex-1 h-px bg-lb-border" />
              </div>

              {activeTab === 'signin' ? (
                /* ---------------- Sign In ---------------- */
                <form onSubmit={handleSignIn} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setClientError(null); }}
                    placeholder="your@email.com"
                    className={inputClass}
                    autoComplete="email"
                    autoFocus
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password"
                      className={`${inputClass} pr-10`}
                      autoComplete="current-password"
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
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleForgot}
                      className="text-xs text-lb-accent hover:text-lb-primary transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <button type="submit" disabled={!canSignIn} className={primaryBtnClass}>
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-lb-muted hover:text-lb-primary transition-colors"
                  >
                    <Mail size={12} />
                    Email me a sign-in link instead
                  </button>
                </form>
              ) : (
                /* ---------------- Create Account ---------------- */
                <form onSubmit={handleCreate} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setClientError(null); }}
                    placeholder="your@email.com"
                    className={inputClass}
                    autoComplete="email"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password (min. 6 characters)"
                      className={`${inputClass} pr-10`}
                      autoComplete="new-password"
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
                    placeholder="Confirm password"
                    className={inputClass}
                    autoComplete="new-password"
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-[11px] text-red-600">Passwords don&apos;t match.</p>
                  )}

                  {/* T&C */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasAcceptedTerms}
                      onChange={e => setHasAcceptedTerms(e.target.checked)}
                      className="mt-0.5 accent-lb-accent"
                    />
                    <TermsContent compact />
                  </label>

                  <button type="submit" disabled={!canCreate} className={primaryBtnClass}>
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    Create Account
                  </button>
                </form>
              )}
            </>
          )}

          {/* Auth / validation error */}
          {shownError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
              <p className="text-xs text-red-600">{shownError}</p>
            </div>
          )}

          {/* Sign In privacy note */}
          {activeTab === 'signin' && !notice && (
            <p className="text-center text-[10px] text-lb-muted">
              By signing in you agree to our{' '}
              <button
                type="button"
                onClick={() => handleTabChange('create')}
                className="text-lb-accent underline hover:text-lb-primary transition-colors"
              >
                Terms &amp; Privacy Policy
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
