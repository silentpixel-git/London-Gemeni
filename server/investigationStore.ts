// Where an Investigation's Event log lives (ADR-0001). The turn endpoint only
// sees this interface: QA uses the memory store, the deployed function the
// Supabase one built with the caller's own token so RLS applies.
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LogEvent } from '../packages/schema/index.js';

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
  };
}

const PAGE = 1000; // PostgREST's default row cap

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
      const inv = await client.from('investigations').select('story_id, name').eq('id', id).maybeSingle();
      // 22P02: not a uuid at all, which is a miss to the caller, not a server fault.
      if (inv.error?.code === '22P02') return null;
      if (inv.error) throw inv.error;
      if (!inv.data) return null;
      const events: LogEvent[] = [];
      let headAt: number | null = null;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client
          .from('events')
          .select('seq, turn, payload, created_at')
          .eq('investigation_id', id)
          .order('seq', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        for (const r of data) events.push({ seq: r.seq, turn: r.turn, payload: r.payload });
        if (data.length) headAt = Date.parse(data[data.length - 1].created_at as string);
        if (data.length < PAGE) break;
      }
      return { storyId: inv.data.story_id as string, name: inv.data.name as string, events, headAt };
    },
    async append(id, events) {
      if (events.length === 0) return;
      const { error } = await client
        .from('events')
        .insert(events.map(e => ({ investigation_id: id, seq: e.seq, turn: e.turn, payload: e.payload })));
      // 23505: unique_violation on the (investigation_id, seq) primary key.
      if (error?.code === '23505') throw new SeqConflict(id, events[0].seq);
      if (error) throw error;
      const last = events[events.length - 1].seq;
      // updated_at orders the player's investigations list (last played first).
      const upd = await client.from('investigations').update({ last_event_seq: last, updated_at: new Date().toISOString() }).eq('id', id);
      if (upd.error) throw upd.error;
    },
  };
}
