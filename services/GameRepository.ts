/**
 * services/GameRepository.ts
 *
 * Player profiles. Investigations are not here: an Investigation is its
 * Event log, written by POST /api/turn and listed by InvestigationRepository.
 *
 * Table added by migration 001:
 *   profiles (id, display_name, avatar_url, created_at, updated_at)
 *
 * New columns added by migration 002:
 *   profiles.role              (text, default 'Field Surgeon')
 *   profiles.theme_preference  (text, default 'light')
 */

import { supabase } from '../supabase';

// ============================================================
// PROFILE
// ============================================================

export const VICTORIAN_ROLES = [
  'Field Surgeon',
  'Detective',
  'Crime Correspondent',
  'Police Constable',
  'Forensic Examiner',
] as const;

export type VictorianRole = typeof VICTORIAN_ROLES[number];

export interface UserProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: VictorianRole;
  themePreference: 'light' | 'dark' | 'auto';
  createdAt: string;
  updatedAt: string;
}

export class GameRepository {
  // ----------------------------------------------------------
  // PROFILES
  // ----------------------------------------------------------

  static async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return {
        id: data.id,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        role: (data.role as VictorianRole) ?? 'Field Surgeon',
        themePreference: (data.theme_preference as 'light' | 'dark' | 'auto') ?? 'light',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.error('GameRepository.getProfile:', err);
      return null;
    }
  }

  static async upsertProfile(userId: string, updates: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl' | 'role' | 'themePreference'>>): Promise<void> {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          ...(updates.displayName !== undefined ? { display_name: updates.displayName } : {}),
          ...(updates.avatarUrl !== undefined ? { avatar_url: updates.avatarUrl } : {}),
          ...(updates.role !== undefined ? { role: updates.role } : {}),
          ...(updates.themePreference !== undefined ? { theme_preference: updates.themePreference } : {}),
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    } catch (err) {
      console.error('GameRepository.upsertProfile:', err);
    }
  }
}
