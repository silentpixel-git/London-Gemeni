-- ============================================================
-- Migration 001: Database-First Architecture Update
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- Run this in your Supabase SQL Editor or via the Supabase CLI.
-- This migration:
--   1. Creates the profiles table for cross-device player accounts
--   2. Adds missing columns to investigations (inventory, current_act, disposition)
--   3. Enables Row Level Security on all game tables
--   4. Creates RLS policies so players can only access their own data
--   5. Adds a trigger to auto-create a profile on user signup
--
-- IDEMPOTENT: Safe to run multiple times.
-- NOTE: PostgreSQL does not support CREATE POLICY IF NOT EXISTS.
--       Policies are dropped first (IF EXISTS) then recreated cleanly.
-- ============================================================


-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.profiles IS 'Player profile data linked to Supabase Auth. Auto-created on signup.';


-- ============================================================
-- 2. ADD MISSING COLUMNS TO INVESTIGATIONS
-- (IF NOT EXISTS is valid for ALTER TABLE ADD COLUMN)
-- ============================================================

ALTER TABLE public.investigations
  ADD COLUMN IF NOT EXISTS current_act  INTEGER DEFAULT 1    NOT NULL,
  ADD COLUMN IF NOT EXISTS inventory    JSONB   DEFAULT '[]' NOT NULL,
  ADD COLUMN IF NOT EXISTS disposition  JSONB   DEFAULT '{}' NOT NULL;

COMMENT ON COLUMN public.investigations.current_act IS 'Current story act (1-6). Managed by the game engine.';
COMMENT ON COLUMN public.investigations.inventory   IS 'Array of inventory item strings. Managed by the game engine.';
COMMENT ON COLUMN public.investigations.disposition IS 'NPC disposition stats object. Managed by the game engine.';


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- Enable RLS on every table, then drop+recreate each policy so
-- this script is safe to re-run.
-- ============================================================

-- ── profiles ────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: owner can select" ON public.profiles;
CREATE POLICY "profiles: owner can select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: owner can insert" ON public.profiles;
CREATE POLICY "profiles: owner can insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: owner can update" ON public.profiles;
CREATE POLICY "profiles: owner can update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── investigations ──────────────────────────────────────────

ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investigations: owner can all" ON public.investigations;
CREATE POLICY "investigations: owner can all"
  ON public.investigations FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ── npc_states ──────────────────────────────────────────────

ALTER TABLE public.npc_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "npc_states: owner can all" ON public.npc_states;
CREATE POLICY "npc_states: owner can all"
  ON public.npc_states FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = npc_states.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = npc_states.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  );

-- ── location_states ─────────────────────────────────────────

ALTER TABLE public.location_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_states: owner can all" ON public.location_states;
CREATE POLICY "location_states: owner can all"
  ON public.location_states FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = location_states.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = location_states.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  );

-- ── clues ───────────────────────────────────────────────────

ALTER TABLE public.clues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clues: owner can all" ON public.clues;
CREATE POLICY "clues: owner can all"
  ON public.clues FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = clues.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = clues.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  );

-- ── logs ────────────────────────────────────────────────────

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs: owner can all" ON public.logs;
CREATE POLICY "logs: owner can all"
  ON public.logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = logs.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = logs.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  );

-- ── saves (legacy) ──────────────────────────────────────────

ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saves: owner can all" ON public.saves;
CREATE POLICY "saves: owner can all"
  ON public.saves FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);


-- ============================================================
-- 4. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- DROP + CREATE is the correct idempotent pattern for triggers too
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 5. INDEXES FOR PERFORMANCE
-- (IF NOT EXISTS IS valid for CREATE INDEX)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_investigations_owner_status
  ON public.investigations (owner_id, status);

CREATE INDEX IF NOT EXISTS idx_npc_states_investigation
  ON public.npc_states (investigation_id);

CREATE INDEX IF NOT EXISTS idx_clues_investigation
  ON public.clues (investigation_id);

CREATE INDEX IF NOT EXISTS idx_logs_investigation_timestamp
  ON public.logs (investigation_id, timestamp);


-- ============================================================
-- Done.
-- ============================================================
