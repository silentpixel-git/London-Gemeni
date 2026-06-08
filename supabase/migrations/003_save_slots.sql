-- ============================================================
-- Migration 003: Save Slots
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- Run this in your Supabase SQL Editor or via the Supabase CLI.
-- This migration:
--   1. Adds a save_slot column to investigations (1-5 per user)
--   2. Adds stim / introduced_npcs columns the app already writes but
--      that no prior migration created
--   3. Backfills save_slot for existing active investigations
--   4. Adds a partial unique index so one user can't have two active
--      games in the same slot
--
-- IDEMPOTENT: Safe to run multiple times.
-- RLS: investigations is already covered by the existing
--      "investigations: owner can all" policy — no policy change needed.
-- ============================================================


-- ============================================================
-- 1. ADD COLUMNS
-- ============================================================

ALTER TABLE public.investigations
  ADD COLUMN IF NOT EXISTS save_slot        INTEGER,
  ADD COLUMN IF NOT EXISTS stim             JSONB DEFAULT '{}'  NOT NULL,
  ADD COLUMN IF NOT EXISTS introduced_npcs  JSONB DEFAULT '[]'  NOT NULL;

COMMENT ON COLUMN public.investigations.save_slot       IS 'Save slot number (1-5). One active investigation per (owner_id, save_slot).';
COMMENT ON COLUMN public.investigations.stim            IS 'Session memory observations (STIM). Managed by the app.';
COMMENT ON COLUMN public.investigations.introduced_npcs IS 'Array of NPC IDs whose real names Watson knows. Managed by the app.';


-- ============================================================
-- 2. BACKFILL save_slot FOR EXISTING ACTIVE INVESTIGATIONS
-- Most-recently-updated active game per owner becomes slot 1, etc.
-- Capped at 5; any beyond the 5th are left without a slot.
-- ============================================================

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY updated_at DESC) AS rn
  FROM public.investigations
  WHERE status = 'active' AND save_slot IS NULL
)
UPDATE public.investigations AS inv
SET save_slot = ranked.rn
FROM ranked
WHERE inv.id = ranked.id
  AND ranked.rn <= 5;


-- ============================================================
-- 3. PARTIAL UNIQUE INDEX
-- Enforces at most one active investigation per slot per user.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_investigations_owner_slot_active
  ON public.investigations (owner_id, save_slot)
  WHERE status = 'active' AND save_slot IS NOT NULL;


-- ============================================================
-- Done.
-- ============================================================
