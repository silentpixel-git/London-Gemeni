-- ============================================================
-- Migration 007: Rumor-event log (Phase 4b)
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- When each rumor's trigger flag first fired: { "<rumorId>": { "act": n,
-- "atMinutes": n } }. Read by the engine to derive which NPCs have heard
-- which hearsay. Old rows default to {} — no behavioral change until a
-- trigger fires.
--
-- IDEMPOTENT: Safe to run multiple times.
-- ============================================================

ALTER TABLE public.investigations
  ADD COLUMN IF NOT EXISTS rumor_events JSONB DEFAULT '{}'::jsonb NOT NULL;

COMMENT ON COLUMN public.investigations.rumor_events
  IS 'Phase 4b rumor-event log: rumorId -> {act, atMinutes} recording when each rumor trigger first fired.';

-- ============================================================
-- Done.
-- ============================================================
