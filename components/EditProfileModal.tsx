/**
 * components/EditProfileModal.tsx
 *
 * Modal for setting or editing a player's display name and Victorian role.
 *
 * Used in two modes:
 *   isFirstRun=true  — "Begin the Investigation" first-time setup after login.
 *                      Backdrop click does NOT close. T&C acceptance required.
 *   isFirstRun=false — "Edit Profile" from header dropdown. Normal close behaviour.
 *
 * Reads auth + profile state from SupabaseProvider context.
 * Writes via GameRepository.upsertProfile, then calls refreshProfile().
 */

import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Loader2, Save } from 'lucide-react';
import { useSupabase } from './SupabaseProvider';
import { GameRepository, VICTORIAN_ROLES, VictorianRole } from '../services/GameRepository';
import { TermsContent } from './TermsContent';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstRun?: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  isFirstRun = false,
}) => {
  const { user, userProfile, refreshProfile } = useSupabase();

  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState<VictorianRole>('Field Surgeon');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pre-fill fields when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(
      userProfile?.displayName ||
      user?.user_metadata?.full_name ||
      ''
    );
    setSelectedRole((userProfile?.role as VictorianRole) || 'Field Surgeon');
    setHasAcceptedTerms(!isFirstRun); // existing users have already accepted
    setSaveError(null);
  }, [isOpen, userProfile, user, isFirstRun]);

  // Lock body scroll; ESC to close (only when not first run)
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isFirstRun) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, isFirstRun, onClose]);

  const handleSave = async () => {
    if (!user || !displayName.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await GameRepository.upsertProfile(user.id, {
        displayName: displayName.trim(),
        avatarUrl: user.user_metadata?.avatar_url ?? null,
        role: selectedRole,
      });
      await refreshProfile();
      onClose();
    } catch {
      setSaveError('Could not save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdrop = () => {
    if (!isFirstRun) onClose();
  };

  if (!isOpen || !user) return null;

  const canSave = displayName.trim().length > 0 && (!isFirstRun || hasAcceptedTerms) && !isSaving;

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(41, 51, 81, 0.75)' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm" onClick={handleBackdrop} />

      {/* Modal card */}
      <div className="relative w-full max-w-sm bg-lb-paper border border-lb-border rounded-xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-lb-border">
          <p className="font-serif text-lb-accent text-xs uppercase tracking-[0.2em] mb-1">London Bleeds</p>
          <h2 className="font-serif text-xl text-lb-primary">
            {isFirstRun ? <span className="italic">Welcome to the Investigation</span> : 'Edit Profile'}
          </h2>
          {isFirstRun && (
            <p className="text-lb-muted text-xs mt-1">Tell us how you would like to be addressed, Doctor.</p>
          )}
          {!isFirstRun && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-lb-muted hover:text-lb-primary hover:bg-lb-bg rounded-md transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-lb-primary text-white flex items-center justify-center overflow-hidden shrink-0">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon size={22} />
              )}
            </div>
            <div>
              <p className="text-xs text-lb-muted">{user.email}</p>
              {memberSince && !isFirstRun && (
                <p className="text-[10px] text-lb-muted opacity-70">Member since {memberSince}</p>
              )}
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="block text-xs font-bold text-lb-primary uppercase tracking-widest mb-1.5">
              How shall we address you?
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name or alias"
              maxLength={40}
              className="w-full border border-lb-border rounded-lg px-3 py-2 bg-lb-bg text-lb-primary text-sm placeholder:text-lb-muted focus:outline-none focus:border-lb-accent transition-colors"
              autoFocus={isFirstRun}
            />
          </div>

          {/* Role picker */}
          <div>
            <label className="block text-xs font-bold text-lb-primary uppercase tracking-widest mb-1.5">
              Your title in the investigation
            </label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as VictorianRole)}
              className="w-full border border-lb-border rounded-lg px-3 py-2 bg-lb-bg text-lb-primary text-sm focus:outline-none focus:border-lb-accent transition-colors appearance-none cursor-pointer"
            >
              {VICTORIAN_ROLES.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* T&C checkbox — first run only */}
          {isFirstRun && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasAcceptedTerms}
                onChange={e => setHasAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-lb-accent"
              />
              <TermsContent compact />
            </label>
          )}

          {/* Privacy note — always visible */}
          <p className="text-[10px] text-lb-muted border-t border-lb-border pt-3 leading-relaxed">
            Your email and display name are used exclusively to save your game progress.
            We never send marketing communications or share your data with anyone.
          </p>

          {/* Save error */}
          {saveError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{saveError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!isFirstRun && (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-lb-border text-lb-primary text-sm font-semibold rounded-lg hover:bg-lb-bg transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-lb-primary text-white text-sm font-semibold rounded-lg hover:bg-lb-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${isFirstRun ? 'w-full' : 'flex-1'}`}
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : (!isFirstRun && <Save size={14} />)}
              {isFirstRun ? 'Begin the Investigation' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
