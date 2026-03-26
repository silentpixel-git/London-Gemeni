
import { supabase } from '../supabase';
import { 
  Investigation, 
  LocationState, 
  NPCState, 
  Clue, 
  LogEntry, 
  InvestigationStatus
} from '../types';

export class InvestigationService {
  /**
   * Gets the most recent active investigation for the current user.
   */
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
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }
      
      // Map snake_case to camelCase
      return {
        id: data.id,
        ownerId: data.owner_id,
        status: data.status,
        currentLocation: data.current_location,
        sanity: data.sanity,
        medicalPoints: data.medical_points,
        moralPoints: data.moral_points,
        globalFlags: data.global_flags,
        journalNotes: data.journal_notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      } as Investigation;
    } catch (error) {
      console.error('Supabase Error (getActiveInvestigation):', error);
      return null;
    }
  }

  /**
   * Starts a new investigation.
   */
  static async startNewInvestigation(userId: string, initialData: Partial<Investigation>): Promise<Investigation> {
    try {
      const now = new Date().toISOString();
      
      const newInvestigation = {
        owner_id: userId,
        status: 'active',
        current_location: initialData.currentLocation || 'miller_court',
        sanity: initialData.sanity ?? 100,
        medical_points: initialData.medicalPoints || 0,
        moral_points: initialData.moralPoints || 0,
        global_flags: initialData.globalFlags || {},
        journal_notes: initialData.journalNotes || '',
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('investigations')
        .insert(newInvestigation)
        .select()
        .single();

      if (error) throw error;
      
      // Map snake_case to camelCase
      return {
        id: data.id,
        ownerId: data.owner_id,
        status: data.status,
        currentLocation: data.current_location,
        sanity: data.sanity,
        medicalPoints: data.medical_points,
        moralPoints: data.moral_points,
        globalFlags: data.global_flags,
        journalNotes: data.journal_notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      } as Investigation;
    } catch (error) {
      console.error('Supabase Error (startNewInvestigation):', error);
      throw error;
    }
  }

  /**
   * Fetches the recent log entries for an investigation.
   */
  static async getRecentLogs(investigationId: string, limitCount = 20): Promise<LogEntry[]> {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('investigation_id', investigationId)
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      return data.map((l: any) => ({
        id: l.id,
        investigationId: l.investigation_id,
        timestamp: l.timestamp,
        type: l.type,
        content: l.content
      })) as LogEntry[];
    } catch (error) {
      console.error('Supabase Error (getRecentLogs):', error);
      return [];
    }
  }

  /**
   * Adds a new log entry.
   */
  static async addLogEntry(investigationId: string, entry: Omit<LogEntry, 'id'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('logs')
        .insert({ 
          investigation_id: investigationId,
          timestamp: entry.timestamp,
          type: entry.type,
          content: entry.content
        });
      
      if (error) throw error;
      
      // Update investigation timestamp
      await InvestigationService.updateInvestigation(investigationId, { updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Supabase Error (addLogEntry):', error);
    }
  }

  /**
   * Updates investigation state.
   */
  static async updateInvestigation(investigationId: string, updates: Partial<Investigation>): Promise<Investigation | null> {
    try {
      const snakeUpdates: any = {};
      if (updates.status) snakeUpdates.status = updates.status;
      if (updates.currentLocation) snakeUpdates.current_location = updates.currentLocation;
      if (updates.sanity !== undefined) snakeUpdates.sanity = updates.sanity;
      if (updates.medicalPoints !== undefined) snakeUpdates.medical_points = updates.medicalPoints;
      if (updates.moralPoints !== undefined) snakeUpdates.moral_points = updates.moralPoints;
      if (updates.globalFlags) snakeUpdates.global_flags = updates.globalFlags;
      if (updates.journalNotes !== undefined) snakeUpdates.journal_notes = updates.journalNotes;
      
      snakeUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('investigations')
        .update(snakeUpdates)
        .eq('id', investigationId)
        .select()
        .single();
      
      if (error) throw error;

      return {
        id: data.id,
        ownerId: data.owner_id,
        status: data.status,
        currentLocation: data.current_location,
        sanity: data.sanity,
        medicalPoints: data.medical_points,
        moralPoints: data.moral_points,
        globalFlags: data.global_flags,
        journalNotes: data.journal_notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      } as Investigation;
    } catch (error) {
      console.error('Supabase Error (updateInvestigation):', error);
      return null;
    }
  }

  /**
   * Upserts state for a location.
   */
  static async upsertLocationState(investigationId: string, locationId: string, updates: Partial<LocationState>): Promise<void> {
    try {
      const snakeUpdates: any = {
        investigation_id: investigationId,
        location_id: locationId,
        updated_at: new Date().toISOString()
      };
      if (updates.isCrimeScene !== undefined) snakeUpdates.is_crime_scene = updates.isCrimeScene;
      if (updates.isLocked !== undefined) snakeUpdates.is_locked = updates.isLocked;
      if (updates.mutations) snakeUpdates.mutations = updates.mutations;

      const { error } = await supabase
        .from('location_states')
        .upsert(snakeUpdates, { onConflict: 'investigation_id,location_id' });
      
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (upsertLocationState):', error);
    }
  }

  /**
   * Gets state for a location.
   */
  static async getLocationState(investigationId: string, locationId: string): Promise<LocationState | null> {
    try {
      const { data, error } = await supabase
        .from('location_states')
        .select('*')
        .eq('investigation_id', investigationId)
        .eq('location_id', locationId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return {
        locationId: data.location_id,
        isCrimeScene: data.is_crime_scene,
        isLocked: data.is_locked,
        mutations: data.mutations,
        updatedAt: data.updated_at
      } as LocationState;
    } catch (error) {
      console.error('Supabase Error (getLocationState):', error);
      return null;
    }
  }

  /**
   * Upserts state for an NPC.
   */
  static async upsertNPCState(investigationId: string, npcId: string, updates: Partial<NPCState>): Promise<void> {
    try {
      const snakeUpdates: any = {
        investigation_id: investigationId,
        npc_id: npcId,
        updated_at: new Date().toISOString()
      };
      if (updates.disposition !== undefined) snakeUpdates.disposition = updates.disposition;
      if (updates.status !== undefined) snakeUpdates.status = updates.status;
      if (updates.currentLocation !== undefined) snakeUpdates.current_location = updates.currentLocation;
      if (updates.lastInteraction !== undefined) snakeUpdates.last_interaction = updates.lastInteraction;
      if (updates.memory) snakeUpdates.memory = updates.memory;

      const { error } = await supabase
        .from('npc_states')
        .upsert(snakeUpdates, { onConflict: 'investigation_id,npc_id' });
      
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (upsertNPCState):', error);
    }
  }

  /**
   * Gets all NPC states for an investigation.
   */
  static async getAllNPCStates(investigationId: string): Promise<Record<string, NPCState>> {
    try {
      const { data, error } = await supabase
        .from('npc_states')
        .select('*')
        .eq('investigation_id', investigationId);
      
      if (error) throw error;
      
      const npcMap: Record<string, NPCState> = {};
      data.forEach((s: any) => {
        npcMap[s.npc_id] = {
          npcId: s.npc_id,
          disposition: s.disposition,
          currentLocation: s.current_location,
          status: s.status,
          lastInteraction: s.last_interaction,
          memory: s.memory
        } as NPCState;
      });
      return npcMap;
    } catch (error) {
      console.error('Supabase Error (getAllNPCStates):', error);
      return {};
    }
  }

  /**
   * Gets state for an NPC.
   */
  static async getNPCState(investigationId: string, npcId: string): Promise<NPCState | null> {
    try {
      const { data, error } = await supabase
        .from('npc_states')
        .select('*')
        .eq('investigation_id', investigationId)
        .eq('npc_id', npcId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return {
        npcId: data.npc_id,
        disposition: data.disposition,
        currentLocation: data.current_location,
        status: data.status,
        lastInteraction: data.last_interaction,
        memory: data.memory
      } as NPCState;
    } catch (error) {
      console.error('Supabase Error (getNPCState):', error);
      return null;
    }
  }

  /**
   * Adds a discovered clue.
   */
  static async addClue(investigationId: string, clue: Clue): Promise<void> {
    try {
      const { error } = await supabase
        .from('clues')
        .upsert({ 
          investigation_id: investigationId,
          clue_id: clue.clueId,
          name: clue.name,
          description: clue.description,
          discovered_at: new Date().toISOString(),
          location_found: clue.locationFound,
          connections: clue.connections || []
        }, { onConflict: 'investigation_id,clue_id' });
      
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (addClue):', error);
    }
  }

  /**
   * Gets all discovered clues.
   */
  static async getClues(investigationId: string): Promise<Clue[]> {
    try {
      const { data, error } = await supabase
        .from('clues')
        .select('*')
        .eq('investigation_id', investigationId)
        .order('discovered_at', { ascending: false });
      
      if (error) throw error;
      return data.map((c: any) => ({
        clueId: c.clue_id,
        name: c.name,
        description: c.description,
        discoveredAt: c.discovered_at,
        locationFound: c.location_found,
        connections: c.connections
      })) as Clue[];
    } catch (error) {
      console.error('Supabase Error (getClues):', error);
      return [];
    }
  }
}
