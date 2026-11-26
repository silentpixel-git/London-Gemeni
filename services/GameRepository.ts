// Player profiles. Investigations are not here: an Investigation is its Event
// log, written by POST /api/turn and listed by InvestigationRepository.
import { supabase } from '../supabase';
import type { ThemeMode } from '../types';

export interface UserProfile {
  id: string;
  displayName: string | null;
  themePreference: ThemeMode;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, theme_preference')
      .eq('id', userId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return { id: data.id, displayName: data.display_name, themePreference: (data.theme_preference as ThemeMode) ?? 'light' };
  } catch (err) {
    console.error('getProfile:', err);
    return null;
  }
}

export async function upsertProfile(userId: string, updates: Partial<Pick<UserProfile, 'displayName' | 'themePreference'>>): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        ...(updates.displayName !== undefined ? { display_name: updates.displayName } : {}),
        ...(updates.themePreference !== undefined ? { theme_preference: updates.themePreference } : {}),
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  } catch (err) {
    console.error('upsertProfile:', err);
  }
}
