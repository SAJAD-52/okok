-- ============================================================================
-- JADIJCB: Booking Pause & Resume (Preserving Remaining Hours on Breakdown)
-- Migration: 20261117020000_booking_pause_resume.sql
-- ============================================================================

-- 1. Add pause_state JSONB column on public.bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pause_state jsonb DEFAULT NULL;

-- 2. RPC to pause an active booking while freezing remaining_ms
CREATE OR REPLACE FUNCTION public.pause_booking(
  p_booking_id uuid,
  p_pause_state jsonb,
  p_notes text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_booking public.bookings;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.owner_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the booking owner can pause a rental';
  END IF;

  UPDATE public.bookings
  SET
    pause_state = p_pause_state,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- 3. RPC to resume a paused booking and shift end_at by the preserved remaining hours
CREATE OR REPLACE FUNCTION public.resume_booking(
  p_booking_id uuid,
  p_new_end_at timestamptz,
  p_pause_state jsonb,
  p_notes text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_booking public.bookings;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.owner_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only the booking owner can resume a rental';
  END IF;

  UPDATE public.bookings
  SET
    end_at = p_new_end_at,
    pause_state = p_pause_state,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pause_booking(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_booking(uuid, timestamptz, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
