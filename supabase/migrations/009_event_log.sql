-- ============================================================
-- Migration 009: Event Log
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- Run this in your Supabase SQL Editor or via the Supabase CLI.
-- This migration (contract: server/TURN.md, ADR-0001):
--   1. Adds story_id / name / last_event_seq to investigations
--   2. Creates the append-only events table an Investigation's
--      state is replayed from
--   3. Owner-scoped RLS on events: select and insert only, so the
--      log can never be rewritten through the API
--
-- DASHBOARD STEP (not SQL): enable anonymous sign-ins under
--   Authentication → Sign In / Providers → "Allow anonymous sign-ins".
--   Guests play as anonymous users; POST /api/turn needs their JWT.
--   Claiming an account later (supabase.auth.linkIdentity or an email
--   upgrade) keeps the same user id, so owner_id never changes.
--
-- The old snapshot columns on investigations stay until Phase 4.
--
-- IDEMPOTENT: Safe to run multiple times.
-- NOTE: PostgreSQL does not support CREATE POLICY IF NOT EXISTS — we drop+recreate.
-- ============================================================


-- ============================================================
-- 1. INVESTIGATIONS: STORY, NAME, LOG HEAD
-- ============================================================

ALTER TABLE public.investigations
  ADD COLUMN IF NOT EXISTS story_id        TEXT,
  ADD COLUMN IF NOT EXISTS name            TEXT,
  ADD COLUMN IF NOT EXISTS last_event_seq  INTEGER NOT NULL DEFAULT -1;

COMMENT ON COLUMN public.investigations.story_id       IS 'Story id (story.json id) the event log replays against.';
COMMENT ON COLUMN public.investigations.name           IS 'Player-given name of the investigation.';
COMMENT ON COLUMN public.investigations.last_event_seq IS 'seq of the newest row in events; -1 when the log is empty. Managed by /api/turn.';


-- ============================================================
-- 2. EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.events (
  investigation_id uuid        NOT NULL REFERENCES public.investigations (id) ON DELETE CASCADE,
  seq              integer     NOT NULL,
  turn             integer     NOT NULL,
  payload          jsonb       NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (investigation_id, seq)
);

COMMENT ON TABLE public.events IS 'Append-only Event log per investigation; state is its replay. Written only by /api/turn.';


-- ============================================================
-- 3. RLS: OWNER MAY READ AND APPEND; NO UPDATE, NO DELETE
-- (rows still go when their investigation is deleted, via the cascade)
-- ============================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events: owner can select" ON public.events;
CREATE POLICY "events: owner can select"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = events.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "events: owner can insert" ON public.events;
CREATE POLICY "events: owner can insert"
  ON public.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = events.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  );


-- ============================================================
-- Done.
-- ============================================================
