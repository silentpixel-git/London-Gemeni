-- ============================================================
-- Migration 008: Persist NPC-approach cooldown timestamp
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- Adds last_approach_at_minutes so the 30-minute NPC-approach cooldown
-- (engine/approaches.ts, APPROACH_COOLDOWN_MINUTES) survives save/resume.
-- The value is an in-game clock reading (ACT_TIME_CONFIG[act].canonicalMinutes
-- + elapsedMinutes at the turn an approach fired). Nullable — NULL/absent
-- means no approach has fired yet this game (old saves included).
--
-- IDEMPOTENT: Safe to run multiple times.
-- ============================================================

ALTER TABLE public.investigations
  ADD COLUMN IF NOT EXISTS last_approach_at_minutes INTEGER;

COMMENT ON COLUMN public.investigations.last_approach_at_minutes
  IS 'In-game clock value of the last NPC approach; drives the 30-minute approach cooldown. NULL = no approach fired yet.';

-- ============================================================
-- Done.
-- ============================================================
