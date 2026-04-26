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
import { Investigation, NPCState, Clue, LogEntry } from '../types';
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

export interface UserProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: VictorianRole;
  themePreference: 'light' | 'dark';
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
        themePreference: (data.theme_preference as 'light' | 'dark') ?? 'light',
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

  static async createInvestigation(userId: string, initial: {
    currentLocation: string;
    inventory: string[];
    sanity: number;
    currentAct: number;
    globalFlags: Record<string, boolean>;
    journalNotes: string;
  }): Promise<Investigation> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('investigations')
      .insert({
        owner_id: userId,
        status: 'active',
        current_location: initial.currentLocation,
        inventory: initial.inventory,
        sanity: initial.sanity,
        current_act: initial.currentAct,
        medical_points: 0,
        moral_points: 0,
        global_flags: initial.globalFlags,
        journal_notes: initial.journalNotes,
        disposition: {},
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
      sanity: number;
      medicalPoints: number;
      moralPoints: number;
      currentAct: number;
      flags: Record<string, boolean>;
    }
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

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

      if (result.sanityDelta !== undefined) {
        updates.sanity = Math.max(0, Math.min(100, currentState.sanity + result.sanityDelta));
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

      if (result.gameOver) {
        updates.status = 'solved';
      }

      const { error } = await supabase
        .from('investigations')
        .update(updates)
        .eq('id', investigationId);

      if (error) throw error;
    } catch (err) {
      console.error('GameRepository.applyEngineResult:', err);
    }
  }

  static async updateInvestigation(investigationId: string, updates: {
    currentLocation?: string;
    sanity?: number;
    medicalPoints?: number;
    moralPoints?: number;
    currentAct?: number;
    inventory?: string[];
    globalFlags?: Record<string, boolean>;
    journalNotes?: string;
    status?: string;
    stim?: Record<string, unknown>;
  }): Promise<Investigation | null> {
    try {
      const snakeUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.currentLocation !== undefined) snakeUpdates.current_location = updates.currentLocation;
      if (updates.sanity !== undefined) snakeUpdates.sanity = updates.sanity;
      if (updates.medicalPoints !== undefined) snakeUpdates.medical_points = updates.medicalPoints;
      if (updates.moralPoints !== undefined) snakeUpdates.moral_points = updates.moralPoints;
      if (updates.currentAct !== undefined) snakeUpdates.current_act = updates.currentAct;
      if (updates.inventory !== undefined) snakeUpdates.inventory = updates.inventory;
      if (updates.globalFlags !== undefined) snakeUpdates.global_flags = updates.globalFlags;
      if (updates.journalNotes !== undefined) snakeUpdates.journal_notes = updates.journalNotes;
      if (updates.status !== undefined) snakeUpdates.status = updates.status;
      if (updates.stim !== undefined) snakeUpdates.stim = updates.stim;

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
  ): Promise<void> {
    if (!npcUpdates || Object.keys(npcUpdates).length === 0) return;

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
    } catch (err) {
      console.error('GameRepository.applyNPCUpdates:', err);
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
      console.error('GameRepository.addDiscoveredClues:', err);
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
      sanity: data.sanity as number,
      medicalPoints: (data.medical_points as number) || 0,
      moralPoints: (data.moral_points as number) || 0,
      globalFlags: (data.global_flags as Record<string, unknown>) || {},
      journalNotes: (data.journal_notes as string) || '',
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      // New fields (may not exist on old rows — graceful fallback)
      currentAct: (data.current_act as number) || 1,
      inventory: (data.inventory as string[]) || [],
      stim: (data.stim as Record<string, unknown>) || undefined,
    } as Investigation & { currentAct: number; inventory: string[] };
  }
}
