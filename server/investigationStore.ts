// Where an Investigation's Event log lives (ADR-0001). The turn endpoint only
// sees this interface: QA uses the memory store, the deployed function the
// Supabase one built with the caller's own token so RLS applies.
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LogEvent } from '../packages/schema/index.js';
import { EventPayload } from '../packages/schema/event.js';

export interface StoredInvestigation {
  storyId: string;
  name: string;
  events: LogEvent[];
  /** When the newest row was written (ms since epoch); null for an empty log. */
  headAt: number | null;
}

/** The log moved on since it was loaded: another request appended at this seq first. */
export class SeqConflict extends Error {
  constructor(id: string, seq: number) {
    super(`investigation ${id}: seq ${seq} is already taken`);
    this.name = 'SeqConflict';
  }
}

export interface InvestigationStore {
  create(storyId: string, name: string, ownerId: string | null): Promise<{ id: string }>;
  /** null when there is no such Investigation, or the caller may not see it. */
  load(id: string): Promise<StoredInvestigation | null>;
  /** Events carry consecutive seq values continuing the log; a clash throws SeqConflict, a gap any other error. */
  append(id: string, events: LogEvent[]): Promise<void>;
  /** Deletes the Investigation and its log; a missing one is not an error. */
  remove(id: string): Promise<void>;
}

/** `now` lets QA age the log to exercise stale-turn recovery. */
export function memoryStore(now: () => number = Date.now): InvestigationStore {
  const rows = new Map<string, Omit<StoredInvestigation, 'headAt'> & { ownerId: string | null; headAt: number | null }>();
  return {
    async create(storyId, name, ownerId) {
      const id = randomUUID();
      rows.set(id, { storyId, name, ownerId, events: [], headAt: null });
      return { id };
    },
    async load(id) {
      const row = rows.get(id);
      return row ? { storyId: row.storyId, name: row.name, events: [...row.events], headAt: row.headAt } : null;
    },
    async append(id, events) {
      const row = rows.get(id);
      if (!row) throw new Error(`no investigation ${id}`);
      events.forEach((e, i) => {
        // Mirrors the (investigation_id, seq) primary key.
        if (e.seq < row.events.length) throw new SeqConflict(id, e.seq);
        if (e.seq !== row.events.length + i) throw new Error(`seq ${e.seq} does not continue the log at ${row.events.length + i}`);
      });
      row.events.push(...events);
      if (events.length) row.headAt = now();
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

export function supabaseStore(client: SupabaseClient): InvestigationStore {
  return {
    async create(storyId, name, ownerId) {
      const { data, error } = await client
        .from('investigations')
        .insert({ owner_id: ownerId, story_id: storyId, name, status: 'active' })
        .select('id')
        .single();
      if (error) throw error;
      return { id: data.id as string };
    },
    async load(id) {
      // One call returns story, name and the whole log as a single jsonb (migration 011), so no row cap applies.
      const { data, error } = await client.rpc('load_investigation', { p_id: id });
      // 22P02: not a uuid at all, which is a miss to the caller, not a server fault.
      if (error?.code === '22P02') return null;
      if (error) throw error;
      if (!data) return null;
      const events: LogEvent[] = data.events.map((r: { seq: number; turn: number; payload: unknown }) => {
        const p = EventPayload.safeParse(r.payload);
        if (!p.success) throw new Error(`investigation ${id}: event seq ${r.seq} is corrupt: ${p.error.message}`);
        return { seq: r.seq, turn: r.turn, payload: p.data };
      });
      return { storyId: data.story_id as string, name: data.name as string, events, headAt: data.head_at ? Date.parse(data.head_at as string) : null };
    },
    async append(id, events) {
      if (events.length === 0) return;
      // Insert and last_event_seq / updated_at (the list's last-played order) in one call (migration 011).
      const { error } = await client.rpc('append_events', { p_id: id, p_events: events });
      // 23505: unique_violation on the (investigation_id, seq) primary key.
      if (error?.code === '23505') throw new SeqConflict(id, events[0].seq);
      if (error) throw error;
    },
    async remove(id) {
      // The events go with it (on delete cascade).
      const { error } = await client.from('investigations').delete().eq('id', id);
      if (error) throw error;
    },
  };
}
