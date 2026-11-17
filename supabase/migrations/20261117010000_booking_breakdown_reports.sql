-- ============================================================================
-- JADIJCB: Booking Machine Breakdown / Fault Reports During Active Rental
-- Migration: 20261117010000_booking_breakdown_reports.sql
-- ============================================================================

-- 1. Add structured JSONB column for breakdown reports on public.bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS breakdowns jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. RPC allowing an authenticated client (by client_id OR matching phone) to
--    append a machine breakdown report and update notes safely
CREATE OR REPLACE FUNCTION public.report_booking_breakdown(
  p_booking_id uuid,
  p_report jsonb,
  p_notes text DEFAULT NULL
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_phone text;
  v_booking public.bookings;
  v_clean_user_digits text;
  v_clean_client_digits text;
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

  SELECT COALESCE(phone, phone_number, '') INTO v_user_phone
  FROM public.profiles
  WHERE id = v_uid;

  v_clean_user_digits := right(regexp_replace(COALESCE(v_user_phone, ''), '\D', '', 'g'), 9);
  v_clean_client_digits := right(regexp_replace(COALESCE(v_booking.client_phone, ''), '\D', '', 'g'), 9);

  IF v_booking.client_id IS DISTINCT FROM v_uid
     AND v_booking.owner_id IS DISTINCT FROM v_uid
     AND (v_clean_user_digits = '' OR v_clean_user_digits IS DISTINCT FROM v_clean_client_digits) THEN
    RAISE EXCEPTION 'Not authorized to report breakdown on this booking';
  END IF;

  UPDATE public.bookings
  SET
    breakdowns = COALESCE(breakdowns, '[]'::jsonb) || jsonb_build_array(p_report),
    notes = COALESCE(p_notes, notes)
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

-- 3. RPC allowing the booking owner to mark a breakdown report as resolved
CREATE OR REPLACE FUNCTION public.resolve_booking_breakdown(
  p_booking_id uuid,
  p_report_id text,
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
  v_now text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_updated jsonb;
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
    RAISE EXCEPTION 'Only the owner can resolve breakdown reports';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN elem->>'id' = p_report_id THEN
          elem || jsonb_build_object('status', 'resolved', 'resolved_at', v_now)
        ELSE elem
      END
    ),
    '[]'::jsonb
  )
  INTO v_updated
  FROM jsonb_array_elements(COALESCE(v_booking.breakdowns, '[]'::jsonb)) AS elem;

  UPDATE public.bookings
  SET
    breakdowns = v_updated,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  RETURN v_booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_booking_breakdown(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_booking_breakdown(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
