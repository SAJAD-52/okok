-- ============================================================================
-- JADIJCB: Inclusive Client Segments (Company, Farmer, Artisan, Individual, etc.)
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_segment text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_activity_note text;

NOTIFY pgrst, 'reload schema';
