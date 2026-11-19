-- ============================================================================
-- JADIJCB: Fix 42P17 Infinite Recursion in RLS Policies on driver_job_offers
--          and driver_job_applications
-- Migration: 20261119040000_fix_driver_job_offers_rls_recursion.sql
-- ============================================================================
-- Root Cause:
--   "Open driver job offers are readable" on driver_job_offers queried
--   driver_job_applications, while "Drivers and offer owners view/update
--   applications" on driver_job_applications queried driver_job_offers.
--   Evaluating either table triggered mutual RLS recursion (SQLSTATE 42P17).
--
-- Fix:
--   Move cross-table ownership/applicant checks into SECURITY DEFINER helpers
--   so RLS is evaluated cleanly without circular table policy re-entry.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rls_is_driver_applicant(p_offer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.driver_job_applications a
    WHERE a.offer_id = p_offer_id
      AND a.driver_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.rls_is_driver_offer_owner(p_offer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.driver_job_offers o
    WHERE o.id = p_offer_id
      AND o.owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.rls_is_driver_applicant(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.rls_is_driver_offer_owner(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "Open driver job offers are readable" ON public.driver_job_offers;
CREATE POLICY "Open driver job offers are readable"
  ON public.driver_job_offers FOR SELECT
  USING (
    status = 'open'
    OR owner_id = auth.uid()
    OR won_driver_id = auth.uid()
    OR public.rls_is_driver_applicant(id)
    OR public.rls_is_admin()
  );

DROP POLICY IF EXISTS "Drivers and offer owners view applications" ON public.driver_job_applications;
CREATE POLICY "Drivers and offer owners view applications"
  ON public.driver_job_applications FOR SELECT
  USING (
    auth.uid() = driver_id
    OR public.rls_is_driver_offer_owner(offer_id)
    OR public.rls_is_admin()
  );

DROP POLICY IF EXISTS "Drivers and offer owners update applications" ON public.driver_job_applications;
CREATE POLICY "Drivers and offer owners update applications"
  ON public.driver_job_applications FOR UPDATE
  USING (
    auth.uid() = driver_id
    OR public.rls_is_driver_offer_owner(offer_id)
    OR public.rls_is_admin()
  );

NOTIFY pgrst, 'reload schema';
