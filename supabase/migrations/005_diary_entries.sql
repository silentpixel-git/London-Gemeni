-- ============================================================
-- Migration 005 — Watson's Diary (auto-captured casebook)
--
-- Append-only record of important events the engine captures (clue discoveries,
-- act milestones, major decisions). Entries store a reference (kind + ref_id);
-- the Watson-voiced text is resolved from authored story data at render time.
-- 'act' entries carry the reflective act-closing prose in `text`.
--
-- NOTE: PostgreSQL does not support CREATE POLICY IF NOT EXISTS — we drop+recreate.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.diary_entries (
  investigation_id uuid NOT NULL REFERENCES public.investigations (id) ON DELETE CASCADE,
  id               uuid NOT NULL,
  kind             text NOT NULL,
  ref_id           text NOT NULL,
  act_number       integer NOT NULL DEFAULT 0,
  sequence         integer NOT NULL DEFAULT 0,
  text             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (investigation_id, id)
);

-- Owner-scoped RLS (same shape as clues/logs).
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diary_entries: owner can all" ON public.diary_entries;
CREATE POLICY "diary_entries: owner can all"
  ON public.diary_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = diary_entries.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.investigations
      WHERE investigations.id = diary_entries.investigation_id
        AND investigations.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_diary_entries_investigation_sequence
  ON public.diary_entries (investigation_id, sequence);
