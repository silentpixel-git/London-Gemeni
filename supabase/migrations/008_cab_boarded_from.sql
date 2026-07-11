-- ============================================================
-- Migration 008: Persist hansom-cab boarding point
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- Adds cab_boarded_from so a cab ride survives save/resume. Set to the
-- location Watson hailed from when he boards a hansom cab, cleared (NULL)
-- when he alights. NULL/absent means "not currently aboard a cab" — rides
-- taken with no recorded boarding point price at the cross-district tier.
-- Written every turn by applyEngineResult, alongside elapsed_minutes.
--
-- IDEMPOTENT: Safe to run multiple times.
-- ============================================================

ALTER TABLE public.investigations
  ADD COLUMN IF NOT EXISTS cab_boarded_from TEXT DEFAULT NULL;

COMMENT ON COLUMN public.investigations.cab_boarded_from
  IS 'Location id Watson hailed the current hansom cab from; NULL when not aboard a cab.';

-- ============================================================
-- Done.
-- ============================================================
