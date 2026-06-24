-- ============================================================
-- Migration 006: Diary entry timestamps
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- Adds time_label so each casebook entry records the in-game clock at the
-- moment it was logged (e.g. "10:41 PM"). Computed at capture from
-- ACT_TIME_CONFIG[act].canonicalMinutes + elapsed_minutes. Nullable so older
-- entries (captured before this column existed) simply render without a time.
--
-- IDEMPOTENT: Safe to run multiple times.
-- ============================================================

ALTER TABLE public.diary_entries
  ADD COLUMN IF NOT EXISTS time_label TEXT;

COMMENT ON COLUMN public.diary_entries.time_label
  IS 'In-game clock when this entry was logged (e.g. "10:41 PM"). Null for entries captured before this column existed.';

-- ============================================================
-- Done.
-- ============================================================
