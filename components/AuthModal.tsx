/**
 * components/AuthModal.tsx
 *
 * Full-screen overlay modal for Sign In and Create Account.
 *
 * Tabs:
 *   - Sign In:        Google OAuth | Email magic link
 *   - Create Account: Google OAuth | Email magic link + name hint + T&C acceptance
 *
 * Auth state (loading, errors, emailSent) lives locally — the modal is
 * self-contained. Successful login is detected in App.tsx via the user
 * state change, which closes the modal.
 */

import React, { useState, useEffect } from 'react';
import { X, Mail, Loader2, CheckCircle } from 'lucide-react';
import { useSupabase } from './SupabaseProvider';
import { TermsContent } from './TermsContent';

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

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogle, loginWithEmail, authError, clearAuthError } = useSupabase();

  const [activeTab, setActiveTab] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleClose = () => {
    clearAuthError();
    setEmail('');
    setHasAcceptedTerms(false);
    setEmailSent(false);
    setIsSubmitting(false);
    onClose();
  };

  const handleTabChange = (tab: 'signin' | 'create') => {
    setActiveTab(tab);
    setEmail('');
    setEmailSent(false);
    clearAuthError();
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (activeTab === 'create' && !hasAcceptedTerms) return;
    setIsSubmitting(true);
    await loginWithEmail(email.trim());
    setEmailSent(true);
    setIsSubmitting(false);
  };

  const handleGoogle = () => {
    clearAuthError();
    loginWithGoogle();
    // Page will redirect — no onClose() needed
  };

  if (!isOpen) return null;

  const canSubmitEmail = email.trim().length > 0 &&
    (activeTab === 'signin' || hasAcceptedTerms) &&
    !isSubmitting;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(41, 51, 81, 0.75)' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal card */}
      <div className="relative w-full max-w-md bg-lb-paper border border-lb-border rounded-xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-0 text-center">
          <p className="font-serif text-lb-accent text-xs uppercase tracking-[0.2em] mb-1">London Bleeds</p>
          <h2 className="font-serif text-2xl text-lb-primary italic mb-1">The Whitechapel Diaries</h2>
          <p className="text-lb-muted text-xs mb-5">Sign in to save your investigation across devices</p>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-bg rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
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

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-lb-border bg-lb-paper hover:bg-lb-bg rounded-lg text-sm font-medium text-lb-primary transition-colors"
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

          {/* Email magic link */}
          {emailSent ? (
            <div className="flex items-start gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Check your inbox</p>
                <p className="text-xs text-green-700 mt-0.5">A sign-in link is on its way to <span className="font-mono">{email}</span>. It may take a minute.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-2">
              <label className="block text-xs font-semibold text-lb-primary uppercase tracking-wider">
                {activeTab === 'signin' ? 'Send me a magic link' : 'Or sign up with email'}
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 border border-lb-border rounded-lg px-3 py-2 bg-lb-bg text-lb-primary text-sm placeholder:text-lb-muted focus:outline-none focus:border-lb-accent transition-colors"
                  autoComplete="email"
                />
                <button
                  type="submit"
                  disabled={!canSubmitEmail}
                  className="flex items-center gap-1.5 px-4 py-2 bg-lb-primary text-white text-sm font-semibold rounded-lg hover:bg-lb-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Send
                </button>
              </div>
            </form>
          )}

          {/* Auth error */}
          {authError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700">{authError}</p>
            </div>
          )}

          {/* T&C for Create Account */}
          {activeTab === 'create' && (
            <div className="space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAcceptedTerms}
                  onChange={e => setHasAcceptedTerms(e.target.checked)}
                  className="mt-0.5 accent-lb-accent"
                />
                <TermsContent compact />
              </label>
            </div>
          )}

          {/* Sign In privacy note */}
          {activeTab === 'signin' && (
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
