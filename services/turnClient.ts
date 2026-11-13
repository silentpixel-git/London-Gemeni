// Client side of POST /api/turn (contract: server/TURN.md). Sends one request
// with the player's Supabase JWT and hands each NDJSON line over as it arrives.
// Types only from packages/schema: the browser never loads the engine or a Story.
import type { FeedItem, Observation, PlayerView } from '../packages/schema/index.js';
import { supabase } from '../supabase';

export type TurnBody =
  | { investigationId: string; text: string }
  | { investigationId: string; tick: true }
  | { investigationId: string; resume: true }
  | { start: { storyId: string; name: string } };

export type TurnLine =
  | { kind: 'turn'; investigationId: string; cues: string[]; diary: boolean }
  | { kind: 'text'; delta: string }
  | { kind: 'done'; narrated: { text: string; beats: string[] }; observations: Observation[]; view: PlayerView; feed: FeedItem[] }
  | { kind: 'resume'; investigationId: string; name: string; feed: FeedItem[]; view: PlayerView; busy: boolean }
  | { kind: 'error'; message: string };

/** A refusal before the stream started: 401, 404, 409 (a turn still being narrated), 5xx. */
export class TurnRefused extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'TurnRefused';
  }
}

/** Resolves when the stream ends. A line of kind 'error' mid-stream is delivered, not thrown. */
export async function postTurn(body: TurnBody, onLine: (line: TurnLine) => void): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new TurnRefused(401, 'not signed in');
  const res = await fetch('/api/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const first = (await res.text().catch(() => '')).split('\n')[0];
    let message = `the server answered ${res.status}`;
    try { message = (JSON.parse(first) as { message?: string }).message ?? message; } catch { /* not NDJSON */ }
    throw new TurnRefused(res.status, message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const flush = (all: boolean) => {
    let i: number;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (line) onLine(JSON.parse(line) as TurnLine);
    }
    if (all && buffer.trim()) { onLine(JSON.parse(buffer) as TurnLine); buffer = ''; }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flush(false);
  }
  buffer += decoder.decode();
  flush(true);
}
