-- ============================================================================
-- JADIJCB: Automatic Driver Busy Status During Active Work Contracts
-- Migration: 20261119030000_driver_busy_during_contract.sql
-- ============================================================================

-- 1. Update finalize_driver_job_deal so closing a deal automatically marks
--    the winning driver as busy (driver_available = false)
CREATE OR REPLACE FUNCTION public.finalize_driver_job_deal(
  p_offer_id uuid,
  p_driver_id uuid,
  p_driver_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.driver_job_offers%ROWTYPE;
  v_driver_phone text := '';
  v_resolved_driver_name text := '';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_offer FROM public.driver_job_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'OFFER_NOT_FOUND');
  END IF;

  IF auth.uid() <> v_offer.owner_id AND auth.uid() <> p_driver_id AND NOT public.rls_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT
    COALESCE(NULLIF(p_driver_name, ''), NULLIF(full_name, ''), 'سائق JADIJCB'),
    COALESCE(phone, phone_number, '')
  INTO v_resolved_driver_name, v_driver_phone
  FROM public.profiles
  WHERE id = p_driver_id;

  v_resolved_driver_name := COALESCE(NULLIF(v_resolved_driver_name, ''), NULLIF(p_driver_name, ''), 'سائق JADIJCB');

  UPDATE public.driver_job_offers
  SET
    status = 'accepted',
    won_driver_id = p_driver_id,
    won_driver_name = v_resolved_driver_name,
    won_driver_phone = COALESCE(v_driver_phone, ''),
    agreed_at = now()
  WHERE id = p_offer_id;

  INSERT INTO public.driver_job_applications (
    offer_id,
    driver_id,
    driver_name,
    driver_phone,
    status
  ) VALUES (
    p_offer_id,
    p_driver_id,
    v_resolved_driver_name,
    COALESCE(v_driver_phone, ''),
    'accepted'
  )
  ON CONFLICT (offer_id, driver_id) DO UPDATE SET
    status = 'accepted',
    driver_name = COALESCE(NULLIF(EXCLUDED.driver_name, ''), public.driver_job_applications.driver_name);

  UPDATE public.driver_job_applications
  SET status = 'rejected'
  WHERE offer_id = p_offer_id
    AND driver_id <> p_driver_id
    AND status = 'pending';

  -- Mark winning driver as busy until contract duration expires or both parties terminate
  UPDATE public.profiles
  SET driver_available = false
  WHERE id = p_driver_id;

  RETURN jsonb_build_object('success', true, 'offer_id', p_offer_id, 'status', 'accepted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_driver_job_deal(uuid, uuid, text) TO authenticated;

-- 2. RPC called when a contract ends/terminates to restore driver_available = true
--    only if no other active accepted contracts remain for that driver
CREATE OR REPLACE FUNCTION public.release_driver_on_contract_end(
  p_offer_id uuid,
  p_driver_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.driver_job_offers%ROWTYPE;
  v_other_active integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_offer FROM public.driver_job_offers WHERE id = p_offer_id;
  IF FOUND THEN
    IF auth.uid() <> v_offer.owner_id AND auth.uid() <> p_driver_id AND NOT public.rls_is_admin() THEN
      RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;
  ELSIF auth.uid() <> p_driver_id AND NOT public.rls_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COUNT(*) INTO v_other_active
  FROM public.driver_job_offers o
  WHERE o.id <> p_offer_id
    AND o.won_driver_id = p_driver_id
    AND o.status = 'accepted'
    AND COALESCE(o.contract_data->'termination'->>'work_status', 'active') <> 'ended';

  IF v_other_active = 0 THEN
    UPDATE public.profiles
    SET driver_available = true
    WHERE id = p_driver_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'released', (v_other_active = 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_driver_on_contract_end(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
