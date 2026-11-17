-- ============================================================================
-- JADIJCB: Mutual Driver Job Deal Closure & Automatic Listing Removal
-- Migration: 20261116020000_driver_deal_closure.sql
-- ============================================================================

-- 1. Allow drivers & owners to update driver_job_applications
DO $$ BEGIN
  DROP POLICY IF EXISTS "Drivers and offer owners update applications" ON public.driver_job_applications;
  CREATE POLICY "Drivers and offer owners update applications"
    ON public.driver_job_applications FOR UPDATE
    USING (
      auth.uid() = driver_id
      OR EXISTS (
        SELECT 1 FROM public.driver_job_offers o
        WHERE o.id = offer_id AND o.owner_id = auth.uid()
      )
      OR public.rls_is_admin()
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Atomic SECURITY DEFINER RPC so EITHER the owner OR the driver clicking 2nd
--    to agree on terms can close the deal & remove the offer from open listings.
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_offer FROM public.driver_job_offers WHERE id = p_offer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'OFFER_NOT_FOUND');
  END IF;

  -- Verify caller is the offer owner, the agreed driver, or an admin
  IF auth.uid() <> v_offer.owner_id AND auth.uid() <> p_driver_id AND NOT public.rls_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  -- Close the job offer so it disappears from /driver/joboffer
  UPDATE public.driver_job_offers
  SET status = 'accepted'
  WHERE id = p_offer_id;

  -- Mark winning driver's application accepted (upsert if they agreed directly via chat)
  INSERT INTO public.driver_job_applications (
    offer_id,
    driver_id,
    driver_name,
    status
  ) VALUES (
    p_offer_id,
    p_driver_id,
    COALESCE(NULLIF(p_driver_name, ''), 'سائق JADIJCB'),
    'accepted'
  )
  ON CONFLICT (offer_id, driver_id) DO UPDATE SET
    status = 'accepted';

  -- Reject other pending applications for this offer
  UPDATE public.driver_job_applications
  SET status = 'rejected'
  WHERE offer_id = p_offer_id
    AND driver_id <> p_driver_id
    AND status = 'pending';

  RETURN jsonb_build_object('success', true, 'offer_id', p_offer_id, 'status', 'accepted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_driver_job_deal(uuid, uuid, text) TO authenticated;

-- 3. Enable Realtime on driver_job_applications for live owner updates
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_job_applications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
