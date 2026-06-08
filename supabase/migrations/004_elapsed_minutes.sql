-- ============================================================
-- Migration 004: Persist in-game elapsed time
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- Adds elapsed_minutes so the in-game clock survives save/resume.
-- The displayed time is ACT_TIME_CONFIG[act].canonicalMinutes + elapsed_minutes,
-- reset to 0 on each act advance. Written every turn by applyEngineResult.
--
-- IDEMPOTENT: Safe to run multiple times.
-- ============================================================

ALTER TABLE public.investigations
  ADD COLUMN IF NOT EXISTS elapsed_minutes INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.investigations.elapsed_minutes
  IS 'Minutes elapsed within the current act. Added to the act''s canonical start time for the in-game clock; reset to 0 on act advance.';

-- ============================================================
-- Done.
-- ============================================================
