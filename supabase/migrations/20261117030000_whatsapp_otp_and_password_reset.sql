-- ============================================================================
-- JADIJCB: WhatsApp OTP Activation & Self-Service / Admin Password Reset
-- Migration: 20261117030000_whatsapp_otp_and_password_reset.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Phone normalization helper (matches frontend normalizeMoroccanPhone)
CREATE OR REPLACE FUNCTION public.normalize_moroccan_phone_e164(raw_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean text;
BEGIN
  IF raw_phone IS NULL THEN
    RETURN '';
  END IF;
  v_clean := regexp_replace(trim(raw_phone), '[\s\-\.\(\)/]', '', 'g');
  IF v_clean LIKE '00212%' THEN
    v_clean := '+212' || substr(v_clean, 6);
  ELSIF v_clean LIKE '212%' AND v_clean NOT LIKE '+212%' THEN
    v_clean := '+212' || substr(v_clean, 4);
  END IF;

  IF (v_clean LIKE '06%' OR v_clean LIKE '07%') AND length(v_clean) = 10 THEN
    v_clean := '+212' || substr(v_clean, 2);
  END IF;

  IF (v_clean LIKE '6%' OR v_clean LIKE '7%') AND length(v_clean) = 9 THEN
    v_clean := '+212' || v_clean;
  END IF;

  IF v_clean ~ '^\+212[67]\d{8}$' THEN
    RETURN v_clean;
  END IF;
  RETURN '';
END;
$$;

-- 2. Secure OTP table (zero direct client policies; accessed only via SECURITY DEFINER RPCs)
CREATE TABLE IF NOT EXISTS public.whatsapp_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('register', 'reset_password')),
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  verified_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_phone_purpose_created
  ON public.whatsapp_otp_codes (phone, purpose, created_at DESC);

ALTER TABLE public.whatsapp_otp_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.whatsapp_otp_codes FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.whatsapp_otp_codes TO postgres, service_role;

-- 3. Check whether a Moroccan phone already has a registered account
CREATE OR REPLACE FUNCTION public.check_phone_registered(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_phone text;
  v_digits text;
  v_email text;
BEGIN
  v_phone := public.normalize_moroccan_phone_e164(p_phone);
  IF v_phone = '' THEN
    RETURN false;
  END IF;
  v_digits := regexp_replace(v_phone, '\D', '', 'g');
  v_email := v_digits || '@users.jadijcb.app';

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(v_email)
       OR phone = v_phone
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.normalize_moroccan_phone_e164(COALESCE(phone, phone_number)) = v_phone
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_phone_registered(text) TO anon, authenticated, service_role;

-- 4. Store hashed OTP code (callable only by service_role / Edge Function)
CREATE OR REPLACE FUNCTION public.store_whatsapp_otp(
  p_phone text,
  p_purpose text,
  p_code text,
  p_ttl_seconds integer DEFAULT 600
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_phone text;
  v_recent_count integer;
  v_last_created timestamptz;
BEGIN
  v_phone := public.normalize_moroccan_phone_e164(p_phone);
  IF v_phone = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PHONE');
  END IF;

  IF p_purpose NOT IN ('register', 'reset_password') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PURPOSE');
  END IF;

  IF p_code IS NULL OR p_code !~ '^\d{6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE_FORMAT');
  END IF;

  SELECT max(created_at), count(*)
  INTO v_last_created, v_recent_count
  FROM public.whatsapp_otp_codes
  WHERE phone = v_phone
    AND purpose = p_purpose
    AND created_at > now() - interval '1 hour';

  IF v_last_created IS NOT NULL AND v_last_created > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'COOLDOWN_ACTIVE');
  END IF;

  IF v_recent_count >= 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'RATE_LIMIT_EXCEEDED');
  END IF;

  -- Invalidate prior pending codes for this phone & purpose
  UPDATE public.whatsapp_otp_codes
  SET used_at = now()
  WHERE phone = v_phone
    AND purpose = p_purpose
    AND used_at IS NULL;

  INSERT INTO public.whatsapp_otp_codes (phone, purpose, code_hash, expires_at)
  VALUES (
    v_phone,
    p_purpose,
    extensions.crypt(p_code, extensions.gen_salt('bf', 8)),
    now() + make_interval(secs => GREATEST(60, LEAST(1800, COALESCE(p_ttl_seconds, 600))))
  );

  RETURN jsonb_build_object('success', true, 'phone', v_phone);
END;
$$;

REVOKE ALL ON FUNCTION public.store_whatsapp_otp(text, text, text, integer) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_whatsapp_otp(text, text, text, integer) TO postgres, service_role;

-- 5. Verify a 6-digit WhatsApp OTP (with 5-attempt lockout)
CREATE OR REPLACE FUNCTION public.verify_whatsapp_otp_code(
  p_phone text,
  p_purpose text,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_phone text;
  v_clean_code text;
  v_row public.whatsapp_otp_codes;
BEGIN
  v_phone := public.normalize_moroccan_phone_e164(p_phone);
  v_clean_code := regexp_replace(COALESCE(p_code, ''), '\D', '', 'g');

  IF v_phone = '' OR length(v_clean_code) <> 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_OTP');
  END IF;

  SELECT * INTO v_row
  FROM public.whatsapp_otp_codes
  WHERE phone = v_phone
    AND purpose = p_purpose
    AND used_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'OTP_NOT_FOUND');
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'OTP_EXPIRED');
  END IF;

  IF v_row.attempts >= v_row.max_attempts THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOO_MANY_ATTEMPTS');
  END IF;

  IF v_row.code_hash <> extensions.crypt(v_clean_code, v_row.code_hash) THEN
    UPDATE public.whatsapp_otp_codes
    SET attempts = attempts + 1
    WHERE id = v_row.id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_OTP',
      'remaining_attempts', GREATEST(0, v_row.max_attempts - (v_row.attempts + 1))
    );
  END IF;

  UPDATE public.whatsapp_otp_codes
  SET verified_at = COALESCE(verified_at, now())
  WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'verified', true, 'phone', v_phone);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_whatsapp_otp_code(text, text, text) TO anon, authenticated, service_role;

-- 6. Self-Service Password Reset via verified WhatsApp OTP
CREATE OR REPLACE FUNCTION public.reset_password_with_whatsapp_otp(
  p_phone text,
  p_code text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_phone text;
  v_digits text;
  v_email text;
  v_clean_code text;
  v_row public.whatsapp_otp_codes;
  v_user_id uuid;
BEGIN
  v_phone := public.normalize_moroccan_phone_e164(p_phone);
  v_clean_code := regexp_replace(COALESCE(p_code, ''), '\D', '', 'g');

  IF v_phone = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PHONE');
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'WEAK_PASSWORD');
  END IF;

  IF length(v_clean_code) <> 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_OTP');
  END IF;

  SELECT * INTO v_row
  FROM public.whatsapp_otp_codes
  WHERE phone = v_phone
    AND purpose = 'reset_password'
    AND used_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'OTP_NOT_FOUND');
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'OTP_EXPIRED');
  END IF;

  IF v_row.attempts >= v_row.max_attempts THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOO_MANY_ATTEMPTS');
  END IF;

  IF v_row.code_hash <> extensions.crypt(v_clean_code, v_row.code_hash) THEN
    UPDATE public.whatsapp_otp_codes
    SET attempts = attempts + 1
    WHERE id = v_row.id;
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_OTP');
  END IF;

  v_digits := regexp_replace(v_phone, '\D', '', 'g');
  v_email := v_digits || '@users.jadijcb.app';

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
     OR phone = v_phone
  LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE public.normalize_moroccan_phone_e164(COALESCE(phone, phone_number)) = v_phone
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_NOT_FOUND');
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.whatsapp_otp_codes
  SET
    verified_at = COALESCE(verified_at, now()),
    used_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_password_with_whatsapp_otp(text, text, text) TO anon, authenticated, service_role;

-- 7. Update profile guard trigger so verified WhatsApp registration RPC can mark whatsapp_verified = true safely
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
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.rls_is_admin() THEN
    RETURN NEW;
  END IF;

  v_clean_digits := regexp_replace(COALESCE(NEW.phone, OLD.phone, ''), '\D', '', 'g');
  IF v_clean_digits LIKE '%612457896' THEN
    v_is_vip_phone := true;
  END IF;

  NEW.role := OLD.role;
  IF current_setting('app.allow_whatsapp_verified_update', true) IS DISTINCT FROM '1' THEN
    NEW.whatsapp_verified := OLD.whatsapp_verified;
  END IF;
  NEW.trial_started_at := OLD.trial_started_at;
  NEW.trial_ends_at := OLD.trial_ends_at;

  IF NOT v_is_vip_phone THEN
    NEW.subscription_status := OLD.subscription_status;
    NEW.subscription_ends_at := OLD.subscription_ends_at;
  END IF;

  RETURN NEW;
END;
$$;

-- 8. Mark profile whatsapp_verified = true after verified OTP registration
CREATE OR REPLACE FUNCTION public.mark_phone_whatsapp_verified(
  p_user_id uuid,
  p_phone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_has_verified_otp boolean := false;
BEGIN
  v_phone := public.normalize_moroccan_phone_e164(p_phone);
  IF v_phone = '' OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.whatsapp_otp_codes
    WHERE phone = v_phone
      AND purpose = 'register'
      AND verified_at IS NOT NULL
      AND created_at > now() - interval '30 minutes'
  ) INTO v_has_verified_otp;

  IF NOT v_has_verified_otp AND auth.role() <> 'service_role' THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.allow_whatsapp_verified_update', '1', true);

  UPDATE public.profiles
  SET whatsapp_verified = true
  WHERE id = p_user_id;

  UPDATE public.whatsapp_otp_codes
  SET used_at = COALESCE(used_at, now())
  WHERE phone = v_phone
    AND purpose = 'register'
    AND verified_at IS NOT NULL
    AND used_at IS NULL;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_phone_whatsapp_verified(uuid, text) TO authenticated, service_role;

-- 9. Super Admin assisted password reset (when user contacts WhatsApp support)
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT public.rls_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_user_id IS NULL OR p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
