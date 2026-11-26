-- Migration 012: drop profiles.role.
-- The Victorian role was chosen in Edit Profile but never shown or used by the game.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
