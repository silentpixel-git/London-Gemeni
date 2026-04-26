/**
 * components/TermsContent.tsx
 *
 * Terms of Use & Privacy Policy for London Bleeds.
 * Rendered in AuthModal (compact, expandable) and EditProfileModal (inline reference).
 */

import React, { useState } from 'react';

interface TermsContentProps {
  compact?: boolean;
}

export const TermsContent: React.FC<TermsContentProps> = ({ compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (compact && !isExpanded) {
    return (
      <span className="text-lb-muted text-xs">
        Your data is used only to save your game progress — never for marketing.{' '}
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="text-lb-accent underline hover:text-lb-primary transition-colors"
        >
          Read full terms
        </button>
      </span>
    );
  }

  return (
    <div className="text-xs text-lb-muted leading-relaxed space-y-3">
      {compact && (
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="text-lb-accent underline hover:text-lb-primary transition-colors"
        >
          ↑ Collapse
        </button>
      )}

      <div>
        <p className="font-bold text-lb-primary uppercase tracking-widest text-[10px] mb-1">London Bleeds — Terms of Use &amp; Privacy</p>
        <p className="opacity-60">Last updated: April 2026</p>
      </div>

      <div>
        <p className="font-semibold text-lb-primary mb-0.5">What we collect</p>
        <p>When you create an account, we store your email address, the display name you choose, and your game progress (save data). That is all.</p>
      </div>

      <div>
        <p className="font-semibold text-lb-primary mb-0.5">Why we collect it</p>
        <p>Exclusively to run your game account and keep your progress saved across devices. We do not use your data for advertising, analytics, or any other purpose.</p>
      </div>

      <div>
        <p className="font-semibold text-lb-primary mb-1">What we will never do</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Send you marketing or promotional emails</li>
          <li>Share your data with third parties</li>
          <li>Sell your data</li>
          <li>Use your data for anything except saving your game</li>
        </ul>
      </div>

      <div>
        <p className="font-semibold text-lb-primary mb-0.5">Data retention</p>
        <p>Your data is kept for as long as your account is active.</p>
      </div>

      <div>
        <p className="font-semibold text-lb-primary mb-0.5">Deleting your account</p>
        <p>To delete your account and all associated data, send an email with the subject <span className="font-mono bg-lb-bg px-1 rounded">Delete my London Bleeds account</span>. We will remove everything within 7 days.</p>
      </div>

      <div>
        <p className="font-semibold text-lb-primary mb-0.5">Cookies</p>
        <p>We use a single session cookie to keep you logged in. No tracking or advertising cookies.</p>
      </div>
    </div>
  );
};
