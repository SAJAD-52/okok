-- ============================================================================
-- JADIJCB: Link Driver Job Offers to Machines & Persist Agreed Deal Details
-- Migration: 20261119010000_driver_offer_machine_link.sql
-- ============================================================================

-- 1. Add machine metadata and winning driver snapshot columns to driver_job_offers
ALTER TABLE public.driver_job_offers
  ADD COLUMN IF NOT EXISTS machine_id uuid,
  ADD COLUMN IF NOT EXISTS machine_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS machine_image text DEFAULT '',
  ADD COLUMN IF NOT EXISTS won_driver_id uuid,
  ADD COLUMN IF NOT EXISTS won_driver_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS won_driver_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS agreed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_driver_job_offers_won_driver
  ON public.driver_job_offers (won_driver_id, agreed_at DESC);

-- 2. Allow drivers who applied or won an offer to SELECT that offer even after status becomes 'accepted'
DO $$ BEGIN
  DROP POLICY IF EXISTS "Open driver job offers are readable" ON public.driver_job_offers;
  CREATE POLICY "Open driver job offers are readable"
    ON public.driver_job_offers FOR SELECT
    USING (
      status = 'open'
      OR owner_id = auth.uid()
      OR won_driver_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.driver_job_applications a
        WHERE a.offer_id = id AND a.driver_id = auth.uid()
      )
      OR public.rls_is_admin()
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Update finalize_driver_job_deal RPC to also record winning driver details & agreed_at timestamp
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

  RETURN jsonb_build_object('success', true, 'offer_id', p_offer_id, 'status', 'accepted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_driver_job_deal(uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
