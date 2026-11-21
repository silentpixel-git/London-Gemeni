// The player's Investigations as a list (ADR-0001: an Investigation is its
// Event log). Rows are read and deleted straight from Supabase under RLS
// (owner can all); creating one and playing it go through POST /api/turn.
import { supabase } from '../supabase';

export interface InvestigationSummary {
  id: string;
  name: string;
  storyId: string;
  /** ISO time of the last turn appended. */
  updatedAt: string;
}

export const InvestigationRepository = {
  async list(): Promise<InvestigationSummary[]> {
    const { data, error } = await supabase
      .from('investigations')
      .select('id, name, story_id, updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(r => ({ id: r.id, name: r.name ?? 'Untitled', storyId: r.story_id, updatedAt: r.updated_at }));
  },

  /** The events go with it (on delete cascade). */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('investigations').delete().eq('id', id);
    if (error) throw error;
  },
};
