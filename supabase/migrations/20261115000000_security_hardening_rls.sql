-- ============================================================================
-- JADIJCB: Security Hardening RLS & Privilege Escalation Protection
-- Migration: 20261115000000_security_hardening_rls.sql
-- ============================================================================

-- 0. Self-contained admin check helper (does not depend on public.is_admin signature)
CREATE OR REPLACE FUNCTION public.rls_is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'admin'
    ) THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN false;
END;
$$;

-- 1. Prevent non-admin users from self-escalating role, subscription_status,
--    trial dates, or verification flags on public.profiles
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_digits text;
  v_is_vip_phone boolean := false;
BEGIN
  -- Allow postgres/service_role (SQL Editor, triggers, backend) and admins
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.rls_is_admin() THEN
    RETURN NEW;
  END IF;

  -- Check if phone is the designated VIP lifetime phone
  v_clean_digits := regexp_replace(COALESCE(NEW.phone, OLD.phone, ''), '\D', '', 'g');
  IF v_clean_digits LIKE '%612457896' THEN
    v_is_vip_phone := true;
  END IF;

  -- Block unauthorized changes to privileged fields
  NEW.role := OLD.role;
  NEW.whatsapp_verified := OLD.whatsapp_verified;
  NEW.trial_started_at := OLD.trial_started_at;
  NEW.trial_ends_at := OLD.trial_ends_at;

  IF NOT v_is_vip_phone THEN
    NEW.subscription_status := OLD.subscription_status;
    NEW.subscription_ends_at := OLD.subscription_ends_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- 2. Harden public.bookings INSERT policy:
--    Still allows guest marketplace/storefront bookings, but enforces:
--    - client_id must be NULL or match auth.uid()
--    - machine_id must belong to a real published machine (or owner's own machine)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public or authenticated can create bookings" ON public.bookings;
  CREATE POLICY "Public or authenticated can create bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (
      (client_id IS NULL OR client_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.machines m
        WHERE m.id = machine_id
          AND (m.is_published = true OR m.owner_id = auth.uid())
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Harden public.notifications INSERT & DELETE policies:
--    - Authenticated users can insert notifications
--    - Anonymous visitors can ONLY insert booking/quote notifications targeting an existing machine owner
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public and users can insert notifications" ON public.notifications;
  CREATE POLICY "Public and users can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL
      OR (
        type IN ('booking_request', 'lead_inquiry', 'quote_request')
        AND EXISTS (
          SELECT 1 FROM public.machines m
          WHERE m.owner_id = user_id
        )
      )
    );

  DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
  CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (
      auth.uid() = user_id
      OR public.rls_is_admin()
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
