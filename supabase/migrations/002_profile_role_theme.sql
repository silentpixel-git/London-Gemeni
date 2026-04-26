-- Migration 002: Add role and theme_preference to profiles
-- London Bleeds: The Whitechapel Diaries
--
-- Run in: Supabase Dashboard → SQL Editor
--
-- New columns added by this migration:
--   profiles.role              (text, default 'Field Surgeon')
--   profiles.theme_preference  (text, default 'light')

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Field Surgeon';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'light';

COMMENT ON COLUMN public.profiles.role IS
  'Victorian player role. One of: Field Surgeon, Detective, Crime Correspondent, Police Constable, Forensic Examiner.';

COMMENT ON COLUMN public.profiles.theme_preference IS
  'UI theme preference. Either ''light'' or ''dark''.';
