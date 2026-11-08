/**
 * api/turn.ts
 *
 * Vercel serverless function — the turn endpoint (contract: server/TURN.md).
 * Builds the request's deps from the environment and the caller's Supabase
 * JWT, then hands over to server/turn.ts. The client is built with the
 * caller's token and the anon key, so RLS decides what the request may touch;
 * there is no service role key here.
 *
 * In dev, the same handler is mounted on the Vite dev server by the
 * api-dev-gateway plugin in vite.config.ts.
 */

import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { configFromEnv, createAi, type Ai } from '../packages/ai/index.js';
import { supabaseStore } from '../server/investigationStore.js';
import { fileStoryLoader, handleTurn } from '../server/turn.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Module scope, so the per-process Story cache outlives a single request.
const loadStory = fileStoryLoader([`${ROOT}stories`, `${ROOT}packages/schema/fixtures`]);

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return fail(401, 'sign in first (anonymous sign-in counts)');

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return fail(500, 'Supabase is not configured on the server');

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return fail(401, 'the session token was not accepted');

  let ai: Ai;
  try {
    ai = createAi(configFromEnv(process.env), process.env);
  } catch (err) {
    console.error('api/turn ai config:', err);
    return fail(500, 'the AI is not configured on the server');
  }

  return handleTurn(request, { store: supabaseStore(client), ai, loadStory, ownerId: data.user.id });
}

function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ kind: 'error', message }) + '\n', {
    status,
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  });
}
