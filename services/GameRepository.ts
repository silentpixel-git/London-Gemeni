/**
 * services/GameRepository.ts
 *
 * Clean Supabase data access layer for the database-first game architecture.
 *
 * Handles all DB reads and writes. The engine resolves what should happen;
 * this repository persists it. The AI narrates it.
 *
 * New columns added by migration 001:
 *   investigations.current_act  (integer, default 1)
 *   investigations.inventory    (jsonb, default '[]')
 *   investigations.disposition  (jsonb, default '{}')
 *
 * New table added by migration 001:
 *   profiles (id, display_name, avatar_url, created_at, updated_at)
 *
 * New columns added by migration 002:
 *   profiles.role              (text, default 'Field Surgeon')
 *   profiles.theme_preference  (text, default 'light')
 */

import { supabase } from '../supabase';
import { Investigation, NPCState, Clue, LogEntry, DiaryEntry, RumorEvents } from '../types';
import type { EngineResult } from '../types';
import { CLUE_DEFINITIONS } from '../engine/gameData';

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

/**
 * Render a thrown value (PostgrestError, AuthError, TypeError…) as one readable
 * line. Logging the raw object serializes to "[object Object]" in captured
 * console output, hiding the code/message that identify the failure.
 */
export function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Partial<{ name: string; message: string; code: string | number; status: number; details: string; hint: string }>;
    const parts = [
      e.name && e.name !== 'Error' ? e.name : null,
      e.message ? `message="${e.message}"` : null,
      e.code !== undefined ? `code=${e.code}` : null,
      e.status !== undefined ? `status=${e.status}` : null,
      e.details ? `details="${e.details}"` : null,
      e.hint ? `hint="${e.hint}"` : null,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    try {
      return JSON.stringify(err);
    } catch { /* fall through */ }
  }
  return String(err);
}

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

  // ----------------------------------------------------------
  // INVESTIGATIONS
  // ----------------------------------------------------------

  static async getActiveInvestigation(userId: string): Promise<Investigation | null> {
    try {
      const { data, error } = await supabase
        .from('investigations')
        .select('*')
        .eq('owner_id', userId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return this.mapInvestigation(data);
    } catch (err) {
      console.error('GameRepository.getActiveInvestigation:', err);
      return null;
    }
  }

  /**
   * List all active investigations (save slots) for a user, ordered by slot.
   */
  static async listActiveSlots(userId: string): Promise<Investigation[]> {
    try {
      const { data, error } = await supabase
        .from('investigations')
        .select('*')
        .eq('owner_id', userId)
        .eq('status', 'active')
        .order('save_slot', { ascending: true });

      if (error) throw error;
      return (data || []).map(row => this.mapInvestigation(row));
    } catch (err) {
      console.error('GameRepository.listActiveSlots:', err);
      return [];
    }
  }

  /**
   * Soft-delete an investigation (frees its save slot, preserves the data).
   */
  static async archiveSlot(investigationId: string): Promise<void> {
    await this.updateInvestigation(investigationId, { status: 'archived' });
  }

  static async createInvestigation(userId: string, initial: {
    currentLocation: string;
    inventory: string[];
    currentAct: number;
    globalFlags: Record<string, boolean>;
    journalNotes: string;
    saveSlot?: number;
  }): Promise<Investigation> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('investigations')
      .insert({
        owner_id: userId,
        status: 'active',
        current_location: initial.currentLocation,
        inventory: initial.inventory,
        current_act: initial.currentAct,
        medical_points: 0,
        moral_points: 0,
        global_flags: initial.globalFlags,
        journal_notes: initial.journalNotes,
        disposition: {},
        ...(initial.saveSlot !== undefined ? { save_slot: initial.saveSlot } : {}),
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapInvestigation(data);
  }

  /**
   * Apply an EngineResult's state changes to the investigations table.
   * Called immediately after the engine resolves — before AI narration.
   */
  static async applyEngineResult(
    investigationId: string,
    result: EngineResult,
    currentState: {
      location: string;
      inventory: string[];
      medicalPoints: number;
      moralPoints: number;
      currentAct: number;
      flags: Record<string, boolean>;
      rumorEvents: RumorEvents;
    },
    newElapsedMinutes?: number,
    // Explicit override, same shape/reasoning as newElapsedMinutes: on an
    // act-advancing turn, result.approachAtMinutes is architecturally always
    // undefined (selectApproach suppresses on any newAct turn), so without
    // this override the DB column would simply never be touched on the
    // transition turn and the previous act's stale value would sit there
    // until some later write happened to include it. Pass `null` to clear.
    newLastApproachAtMinutes?: number | null
  ): Promise<boolean> {
    try {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (newElapsedMinutes !== undefined) {
        updates.elapsed_minutes = newElapsedMinutes;
      }

      if (newLastApproachAtMinutes !== undefined) {
        updates.last_approach_at_minutes = newLastApproachAtMinutes;
      } else if (result.approachAtMinutes !== undefined) {
        updates.last_approach_at_minutes = result.approachAtMinutes;
      }

      if (result.newLocation) {
        updates.current_location = result.newLocation;
      }

      if (result.inventoryAdd || result.inventoryRemove) {
        let inv = [...currentState.inventory];
        if (result.inventoryAdd) {
          inv = [...inv, ...result.inventoryAdd.filter(i => !inv.includes(i))];
        }
        if (result.inventoryRemove) {
          inv = inv.filter(i => !result.inventoryRemove!.includes(i));
        }
        updates.inventory = inv;
      }

      if (result.medicalPointsDelta !== undefined) {
        updates.medical_points = currentState.medicalPoints + result.medicalPointsDelta;
      }

      if (result.moralPointsDelta !== undefined) {
        updates.moral_points = currentState.moralPoints + result.moralPointsDelta;
      }

      if (result.newAct) {
        updates.current_act = result.newAct;
      }

      if (result.flagsUpdate && Object.keys(result.flagsUpdate).length > 0) {
        updates.global_flags = { ...currentState.flags, ...result.flagsUpdate };
      }

      if (result.rumorEventsUpdate && Object.keys(result.rumorEventsUpdate).length > 0) {
        updates.rumor_events = { ...currentState.rumorEvents, ...result.rumorEventsUpdate };
      }

      if (result.gameOver) {
        updates.status = 'solved';
      }

      const { error } = await supabase
        .from('investigations')
        .update(updates)
        .eq('id', investigationId);

      if (!error) return true;

      // Intermittent failures here are most often a stale/expired access token
      // (auto-refresh ticks stop while the tab is backgrounded or the machine
      // sleeps). getSession() forces a refresh of an expired session, so one
      // retry heals that case; it also covers a brief network blip.
      console.warn(`GameRepository.applyEngineResult: ${describeError(error)} — refreshing session and retrying once`);
      await supabase.auth.getSession();
      const { error: retryError } = await supabase
        .from('investigations')
        .update(updates)
        .eq('id', investigationId);

      if (retryError) throw retryError;
      return true;
    } catch (err) {
      console.error('GameRepository.applyEngineResult:', describeError(err), err);
      return false;
    }
  }

  static async updateInvestigation(investigationId: string, updates: {
    currentLocation?: string;
    medicalPoints?: number;
    moralPoints?: number;
    currentAct?: number;
    inventory?: string[];
    globalFlags?: Record<string, boolean>;
    journalNotes?: string;
    status?: string;
    stim?: Record<string, unknown>;
    introducedNpcs?: string[];
    rumorEvents?: RumorEvents;
  }): Promise<Investigation | null> {
    try {
      const snakeUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.currentLocation !== undefined) snakeUpdates.current_location = updates.currentLocation;
      if (updates.medicalPoints !== undefined) snakeUpdates.medical_points = updates.medicalPoints;
      if (updates.moralPoints !== undefined) snakeUpdates.moral_points = updates.moralPoints;
      if (updates.currentAct !== undefined) snakeUpdates.current_act = updates.currentAct;
      if (updates.inventory !== undefined) snakeUpdates.inventory = updates.inventory;
      if (updates.globalFlags !== undefined) snakeUpdates.global_flags = updates.globalFlags;
      if (updates.journalNotes !== undefined) snakeUpdates.journal_notes = updates.journalNotes;
      if (updates.status !== undefined) snakeUpdates.status = updates.status;
      if (updates.stim !== undefined) snakeUpdates.stim = updates.stim;
      if (updates.introducedNpcs !== undefined) snakeUpdates.introduced_npcs = updates.introducedNpcs;
      if (updates.rumorEvents !== undefined) snakeUpdates.rumor_events = updates.rumorEvents;

      const { data, error } = await supabase
        .from('investigations')
        .update(snakeUpdates)
        .eq('id', investigationId)
        .select()
        .single();

      if (error) throw error;
      return this.mapInvestigation(data);
    } catch (err) {
      console.error('GameRepository.updateInvestigation:', err);
      return null;
    }
  }

  // ----------------------------------------------------------
  // NPC STATES
  // ----------------------------------------------------------

  static async getAllNPCStates(investigationId: string): Promise<Record<string, NPCState>> {
    try {
      const { data, error } = await supabase
        .from('npc_states')
        .select('*')
        .eq('investigation_id', investigationId);

      if (error) throw error;

      const map: Record<string, NPCState> = {};
      (data || []).forEach((row: Record<string, unknown>) => {
        map[row.npc_id as string] = {
          npcId: row.npc_id as string,
          disposition: row.disposition as number,
          currentLocation: row.current_location as string | undefined,
          status: row.status as string,
          lastInteraction: row.last_interaction as string | undefined,
          memory: row.memory as string[] | undefined,
        };
      });
      return map;
    } catch (err) {
      console.error('GameRepository.getAllNPCStates:', err);
      return {};
    }
  }

  /**
   * Persist NPC location/state updates from the engine result.
   */
  static async applyNPCUpdates(
    investigationId: string,
    npcUpdates: Record<string, Partial<NPCState>>
  ): Promise<boolean> {
    if (!npcUpdates || Object.keys(npcUpdates).length === 0) return true;

    const rows = Object.entries(npcUpdates).map(([npcId, updates]) => ({
      investigation_id: investigationId,
      npc_id: npcId,
      ...(updates.currentLocation !== undefined ? { current_location: updates.currentLocation } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.disposition !== undefined ? { disposition: updates.disposition } : {}),
      ...(updates.memory !== undefined ? { memory: updates.memory } : {}),
      ...(updates.lastInteraction !== undefined ? { last_interaction: updates.lastInteraction } : {}),
      updated_at: new Date().toISOString(),
    }));

    try {
      const { error } = await supabase
        .from('npc_states')
        .upsert(rows, { onConflict: 'investigation_id,npc_id' });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('GameRepository.applyNPCUpdates:', describeError(err), err);
      return false;
    }
  }

  /**
   * Update NPC memory after AI narration returns memory summaries.
   */
  static async updateNPCMemory(
    investigationId: string,
    npcMemoryUpdate: Record<string, string>,
    currentNpcStates: Record<string, NPCState>
  ): Promise<void> {
    for (const [npcId, summary] of Object.entries(npcMemoryUpdate)) {
      const existing = currentNpcStates[npcId]?.memory || [];
      const newMemory = [summary, ...existing].slice(0, 5);
      await this.applyNPCUpdates(investigationId, {
        [npcId]: { memory: newMemory },
      });
    }
  }

  // ----------------------------------------------------------
  // DISCOVERED CLUES
  // ----------------------------------------------------------

  static async getDiscoveredClueIds(investigationId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('clues')
        .select('clue_id')
        .eq('investigation_id', investigationId);
      if (error) throw error;
      return (data || []).map((r: Record<string, unknown>) => r.clue_id as string);
    } catch (err) {
      console.error('GameRepository.getDiscoveredClueIds:', err);
      return [];
    }
  }

  static async addDiscoveredClues(investigationId: string, clueIds: string[]): Promise<void> {
    if (clueIds.length === 0) return;
    const now = new Date().toISOString();
    const rows = clueIds
      .map(id => {
        const def = CLUE_DEFINITIONS[id];
        if (!def) return null;
        return {
          investigation_id: investigationId,
          clue_id: id,
          name: def.name,
          description: def.description,
          discovered_at: now,
          location_found: def.locationFound,
          connections: def.connections,
        };
      })
      .filter(Boolean);

    if (rows.length === 0) return;

    try {
      const { error } = await supabase
        .from('clues')
        .upsert(rows as Record<string, unknown>[], { onConflict: 'investigation_id,clue_id' });
      if (error) throw error;
    } catch (err) {
      console.error('GameRepository.addDiscoveredClues:', describeError(err), err);
    }
  }

  static async getAllDiscoveredClues(investigationId: string): Promise<Clue[]> {
    try {
      const { data, error } = await supabase
        .from('clues')
        .select('*')
        .eq('investigation_id', investigationId)
        .order('discovered_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((c: Record<string, unknown>) => ({
        clueId: c.clue_id as string,
        name: c.name as string,
        description: c.description as string,
        discoveredAt: c.discovered_at as string,
        locationFound: c.location_found as string | undefined,
        connections: c.connections as string[] | undefined,
      }));
    } catch (err) {
      console.error('GameRepository.getAllDiscoveredClues:', err);
      return [];
    }
  }

  // ----------------------------------------------------------
  // DIARY (Watson's auto-captured casebook)
  // ----------------------------------------------------------

  static async addDiaryEntries(investigationId: string, entries: DiaryEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const rows = entries.map(e => ({
      investigation_id: investigationId,
      id: e.id,
      kind: e.kind,
      ref_id: e.refId,
      act_number: e.actNumber,
      sequence: e.sequence,
      text: e.text ?? null,
      time_label: e.timeLabel ?? null,
    }));

    try {
      const { error } = await supabase
        .from('diary_entries')
        .upsert(rows as Record<string, unknown>[], { onConflict: 'investigation_id,id' });
      if (error) throw error;
    } catch (err) {
      console.error('GameRepository.addDiaryEntries:', err);
    }
  }

  static async getDiaryEntries(investigationId: string): Promise<DiaryEntry[]> {
    try {
      const { data, error } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('investigation_id', investigationId)
        .order('sequence', { ascending: true });
      if (error) throw error;
      return (data || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        kind: d.kind as DiaryEntry['kind'],
        refId: d.ref_id as string,
        actNumber: d.act_number as number,
        sequence: d.sequence as number,
        text: (d.text as string | null) ?? undefined,
        timeLabel: (d.time_label as string | null) ?? undefined,
      }));
    } catch (err) {
      console.error('GameRepository.getDiaryEntries:', err);
      return [];
    }
  }

  // ----------------------------------------------------------
  // LOGS (conversation history)
  // ----------------------------------------------------------

  static async addLogEntry(investigationId: string, entry: Omit<LogEntry, 'id'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('logs')
        .insert({
          investigation_id: investigationId,
          timestamp: entry.timestamp,
          type: entry.type,
          content: entry.content,
          speaker: entry.speaker,
        });
      if (error) throw error;
    } catch (err) {
      console.error('GameRepository.addLogEntry:', err);
    }
  }

  static async getRecentLogs(investigationId: string, limit = 50): Promise<LogEntry[]> {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('investigation_id', investigationId)
        .order('timestamp', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((l: Record<string, unknown>) => ({
        id: l.id as string,
        timestamp: l.timestamp as string,
        type: l.type as LogEntry['type'],
        content: l.content as string,
        speaker: l.speaker as string | undefined,
      }));
    } catch (err) {
      console.error('GameRepository.getRecentLogs:', err);
      return [];
    }
  }

  // ----------------------------------------------------------
  // INTERNAL MAPPERS
  // ----------------------------------------------------------

  private static mapInvestigation(data: Record<string, unknown>): Investigation {
    return {
      id: data.id as string,
      ownerId: data.owner_id as string,
      status: data.status as Investigation['status'],
      currentLocation: data.current_location as string,
      medicalPoints: (data.medical_points as number) || 0,
      moralPoints: (data.moral_points as number) || 0,
      globalFlags: (data.global_flags as Record<string, unknown>) || {},
      journalNotes: (data.journal_notes as string) || '',
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      // New fields (may not exist on old rows — graceful fallback)
      currentAct: (data.current_act as number) ?? 0,
      inventory: (data.inventory as string[]) || [],
      stim: (data.stim as Record<string, unknown>) || undefined,
      introducedNpcs: (data.introduced_npcs as string[]) || [],
      saveSlot: (data.save_slot as number | null) ?? undefined,
      elapsedMinutes: (data.elapsed_minutes as number) ?? 0,
      lastApproachAtMinutes: (data.last_approach_at_minutes as number | null) ?? undefined,
      rumorEvents: (data.rumor_events as RumorEvents) || {},
    } as Investigation & { currentAct: number; inventory: string[]; introducedNpcs: string[] };
  }
}
