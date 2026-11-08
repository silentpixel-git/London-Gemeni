-- ============================================================
-- Migration 010: Drop the snapshot engine's storage
-- London Bleeds: The Whitechapel Diaries
-- ============================================================
-- Phase 4 of the engine rebuild (docs/engine-rebuild-plan.md, ADR-0001):
-- an Investigation is now nothing but its Event log (migration 009), so
-- everything the old snapshot engine stored goes:
--   1. Investigations with no story_id: the old save slots. They cannot be
--      replayed by the new engine. DELETED, with their rows in the old tables.
--   2. The old per-investigation tables: clues, diary_entries,
--      location_states, logs, npc_states, saves.
--   3. The snapshot columns on investigations, and the save-slot index.
--   4. story_id and name become required.
--
-- DESTRUCTIVE: old save-slot games are deleted. Nothing in the app can open
-- them any more; the old engine is kept only on the archive/pre-phase4-engine
-- branch. Profiles, auth users and event-log investigations are untouched.
--
-- IDEMPOTENT: Safe to run multiple times.
-- ============================================================


-- ============================================================
-- 1. THE OLD SAVE SLOTS
-- ============================================================

DELETE FROM public.investigations WHERE story_id IS NULL;


-- ============================================================
-- 2. THE OLD PER-INVESTIGATION TABLES
-- ============================================================

DROP TABLE IF EXISTS public.clues;
DROP TABLE IF EXISTS public.diary_entries;
DROP TABLE IF EXISTS public.location_states;
DROP TABLE IF EXISTS public.logs;
DROP TABLE IF EXISTS public.npc_states;
DROP TABLE IF EXISTS public.saves;


-- ============================================================
-- 3. SNAPSHOT COLUMNS AND THE SAVE-SLOT INDEX
-- ============================================================

DROP INDEX IF EXISTS public.idx_investigations_owner_slot_active;

ALTER TABLE public.investigations
  DROP COLUMN IF EXISTS current_location,
  DROP COLUMN IF EXISTS sanity,
  DROP COLUMN IF EXISTS medical_points,
  DROP COLUMN IF EXISTS moral_points,
  DROP COLUMN IF EXISTS global_flags,
  DROP COLUMN IF EXISTS journal_notes,
  DROP COLUMN IF EXISTS current_act,
  DROP COLUMN IF EXISTS inventory,
  DROP COLUMN IF EXISTS disposition,
  DROP COLUMN IF EXISTS stim,
  DROP COLUMN IF EXISTS introduced_npcs,
  DROP COLUMN IF EXISTS save_slot,
  DROP COLUMN IF EXISTS elapsed_minutes,
  DROP COLUMN IF EXISTS rumor_events,
  DROP COLUMN IF EXISTS last_approach_at_minutes;


-- ============================================================
-- 4. AN INVESTIGATION IS A STORY'S EVENT LOG
-- ============================================================

ALTER TABLE public.investigations
  ALTER COLUMN story_id SET NOT NULL,
  ALTER COLUMN name     SET NOT NULL;

-- ============================================================
-- Done.
-- ============================================================
