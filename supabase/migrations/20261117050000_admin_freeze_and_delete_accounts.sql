-- ============================================================================
-- JADIJCB: Super Admin Freeze/Unfreeze & Permanent Account Deletion RPCs
-- Migration: 20261117050000_admin_freeze_and_delete_accounts.sql
-- ============================================================================

-- 1. Harden rls_is_admin() & is_admin() to recognize both profiles.role = 'admin'
--    and the verified Super Admin email in JWT claims
CREATE OR REPLACE FUNCTION public.rls_is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  v_email := lower(trim(COALESCE(auth.jwt()->>'email', '')));
  IF v_email IN ('said.cpge24@gmail.com', 'said.cpge240@gmail.com') THEN
    RETURN true;
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

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  IF uid = auth.uid() THEN
    v_email := lower(trim(COALESCE(auth.jwt()->>'email', '')));
    IF v_email IN ('said.cpge24@gmail.com', 'said.cpge240@gmail.com') THEN
      RETURN true;
    END IF;
  END IF;

  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = uid AND role::text = 'admin'
    ) THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN false;
END;
$$;

-- 2. Ensure Super Admin always has table-level DELETE/UPDATE grants & RLS policies on profiles
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update their own profile or admin" ON public.profiles;
  CREATE POLICY "Users can update their own profile or admin"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.rls_is_admin())
    WITH CHECK (auth.uid() = id OR public.rls_is_admin());

  DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
  CREATE POLICY "Only admins can delete profiles"
    ON public.profiles FOR DELETE
    USING (public.rls_is_admin());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Super Admin Freeze / Unfreeze User Account RPC
--    Works whether subscription_status column is enum or text, and hides/unpublishes or blocks user access cleanly
CREATE OR REPLACE FUNCTION public.admin_toggle_suspend_user(
  p_user_id uuid,
  p_suspend boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_currently_suspended boolean;
  v_should_suspend boolean;
  v_next_status text;
BEGIN
  IF NOT public.rls_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_SUSPEND_SELF');
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF v_target.role::text = 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_SUSPEND_ADMIN');
  END IF;

  v_currently_suspended := (COALESCE(v_target.subscription_status::text, '') = 'suspended');
  v_should_suspend := COALESCE(p_suspend, NOT v_currently_suspended);

  IF v_should_suspend THEN
    v_next_status := 'suspended';
  ELSE
    IF v_target.role::text IN ('client', 'contractor', 'driver') THEN
      v_next_status := 'active';
    ELSIF v_target.subscription_ends_at IS NOT NULL AND v_target.subscription_ends_at > now() THEN
      v_next_status := 'active';
    ELSIF v_target.trial_ends_at IS NOT NULL AND v_target.trial_ends_at > now() THEN
      v_next_status := 'trial';
    ELSE
      v_next_status := 'active';
    END IF;
  END IF;

  -- Safely update regardless of whether subscription_status is enum or text
  BEGIN
    EXECUTE format(
      'UPDATE public.profiles SET subscription_status = %L::public.subscription_status WHERE id = $1',
      v_next_status
    ) USING p_user_id;
  EXCEPTION WHEN OTHERS THEN
    EXECUTE format(
      'UPDATE public.profiles SET subscription_status = %L WHERE id = $1',
      v_next_status
    ) USING p_user_id;
  END;

  -- Unpublish owner's machines while frozen so marketplace stays clean
  IF v_should_suspend THEN
    BEGIN
      UPDATE public.machines SET is_published = false WHERE owner_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'is_suspended', v_should_suspend,
    'subscription_status', v_next_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_suspend_user(uuid, boolean) TO authenticated, service_role;

-- 4. Super Admin Permanent Account Deletion RPC (deletes profile + cascaded data + auth.users)
CREATE OR REPLACE FUNCTION public.admin_delete_user_account(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_phone text;
BEGIN
  IF NOT public.rls_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_DELETE_SELF');
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE id = p_user_id
  LIMIT 1;

  IF FOUND AND v_target.role::text = 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_DELETE_ADMIN');
  END IF;

  v_phone := COALESCE(v_target.phone, v_target.phone_number, '');

  -- Clean up optional tables keyed by phone or user_id without failing if a table is absent
  IF v_phone <> '' THEN
    BEGIN
      DELETE FROM public.whatsapp_otp_codes WHERE phone = v_phone;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  BEGIN
    DELETE FROM public.user_recovery_codes WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.notifications WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Delete public profile (cascades machines, bookings, conversations, messages, payments, storefronts, etc.)
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- Delete underlying auth.users entry so the account cannot log back in and phone number is freed
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user_account(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
