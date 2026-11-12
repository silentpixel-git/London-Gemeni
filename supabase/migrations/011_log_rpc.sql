-- ============================================================
-- Migration 011: Event log RPCs
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- Run this in your Supabase SQL Editor or via the Supabase CLI.
-- server/investigationStore.ts used to page through events 1,000 rows at a
-- time and to append with two round trips. This migration adds:
--   1. load_investigation(uuid): story_id, name, head_at (created_at of the
--      newest event) and every event, ordered by seq, as ONE jsonb value.
--      A single aggregate is one row, so PostgREST's row cap does not apply.
--      NULL when the Investigation does not exist or the caller cannot see it.
--   2. append_events(uuid, jsonb): inserts a batch of event rows and sets
--      investigations.last_event_seq / updated_at in the same call (one
--      transaction). A duplicate (investigation_id, seq) is still 23505.
-- Both are SECURITY INVOKER: the caller's JWT applies, so the existing RLS
-- policies (009 on events, 001 on investigations) decide what is visible.
-- Anonymous Supabase users have the `authenticated` role.
--
-- IDEMPOTENT: Safe to run multiple times.
-- ============================================================


-- ============================================================
-- 1. LOAD: STORY, NAME AND THE WHOLE LOG
-- ============================================================

CREATE OR REPLACE FUNCTION public.load_investigation(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'story_id', i.story_id,
    'name',     i.name,
    'head_at',  (SELECT e.created_at FROM public.events e
                 WHERE e.investigation_id = i.id ORDER BY e.seq DESC LIMIT 1),
    'events',   COALESCE(
                  (SELECT jsonb_agg(jsonb_build_object('seq', e.seq, 'turn', e.turn, 'payload', e.payload)
                                    ORDER BY e.seq)
                   FROM public.events e WHERE e.investigation_id = i.id),
                  '[]'::jsonb)
  )
  FROM public.investigations i
  WHERE i.id = p_id;
$$;


-- ============================================================
-- 2. APPEND: INSERT THE BATCH AND MOVE THE LOG HEAD
-- ============================================================
-- p_events: [{"seq": int, "turn": int, "payload": object}, ...]

CREATE OR REPLACE FUNCTION public.append_events(p_id uuid, p_events jsonb)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ins AS (
    INSERT INTO public.events (investigation_id, seq, turn, payload)
    SELECT p_id, x.seq, x.turn, x.payload
    FROM jsonb_to_recordset(p_events) AS x(seq integer, turn integer, payload jsonb)
    RETURNING seq
  )
  UPDATE public.investigations
  SET last_event_seq = (SELECT max(seq) FROM ins),
      updated_at     = now()
  WHERE id = p_id
    AND EXISTS (SELECT 1 FROM ins);
$$;


-- ============================================================
-- 3. GRANTS
-- ============================================================

REVOKE ALL ON FUNCTION public.load_investigation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_events(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.load_investigation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_events(uuid, jsonb) TO authenticated;

-- ============================================================
-- Done.
-- ============================================================
