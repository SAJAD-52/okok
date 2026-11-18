-- ============================================================================
-- JADIJCB: 100% Free WhatsApp Recovery Code & Admin Free WhatsApp OTP
-- Zero paid SMS/WhatsApp API required forever
-- Migration: 20261117040000_free_recovery_and_admin_otp.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Private table for hashed personal recovery codes (0 DH forever)
CREATE TABLE IF NOT EXISTS public.user_recovery_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_phone
  ON public.user_recovery_codes (phone);

ALTER TABLE public.user_recovery_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_recovery_codes FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.user_recovery_codes TO postgres, service_role;

-- 2. Logged-in user generates (or rotates) their personal 8-digit WhatsApp recovery code
CREATE OR REPLACE FUNCTION public.generate_my_recovery_code(p_phone text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid;
  v_phone text;
  v_raw_num bigint;
  v_digits text;
  v_formatted text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  v_phone := public.normalize_moroccan_phone_e164(p_phone);

  IF v_phone = '' THEN
    SELECT public.normalize_moroccan_phone_e164(COALESCE(phone, phone_number))
    INTO v_phone
    FROM public.profiles
    WHERE id = v_uid
    LIMIT 1;
  END IF;

  IF v_phone = '' OR v_phone IS NULL THEN
    SELECT public.normalize_moroccan_phone_e164(
      COALESCE(raw_user_meta_data->>'phone', phone, split_part(email, '@', 1))
    )
    INTO v_phone
    FROM auth.users
    WHERE id = v_uid
    LIMIT 1;
  END IF;

  IF v_phone = '' OR v_phone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PHONE');
  END IF;

  -- Cryptographically random 8-digit recovery code (10000000..99999999)
  v_raw_num := abs((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int)::bigint);
  v_digits := lpad(((v_raw_num % 90000000) + 10000000)::text, 8, '0');
  v_formatted := substr(v_digits, 1, 4) || '-' || substr(v_digits, 5, 4);

  INSERT INTO public.user_recovery_codes (user_id, phone, code_hash, attempts, updated_at)
  VALUES (
    v_uid,
    v_phone,
    extensions.crypt(v_digits, extensions.gen_salt('bf', 8)),
    0,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    phone = excluded.phone,
    code_hash = excluded.code_hash,
    attempts = 0,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'code', v_formatted,
    'phone', v_phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_my_recovery_code(text) TO authenticated, service_role;

-- 3. Self-service free password reset using the saved 8-digit WhatsApp recovery code
CREATE OR REPLACE FUNCTION public.reset_password_with_recovery_code(
  p_phone text,
  p_recovery_code text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_phone text;
  v_clean_code text;
  v_row public.user_recovery_codes;
BEGIN
  v_phone := public.normalize_moroccan_phone_e164(p_phone);
  v_clean_code := regexp_replace(COALESCE(p_recovery_code, ''), '\D', '', 'g');

  IF v_phone = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PHONE');
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'WEAK_PASSWORD');
  END IF;

  IF length(v_clean_code) <> 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_RECOVERY_CODE');
  END IF;

  SELECT * INTO v_row
  FROM public.user_recovery_codes
  WHERE phone = v_phone
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'RECOVERY_NOT_FOUND');
  END IF;

  IF v_row.attempts >= 8 AND v_row.updated_at > now() - interval '30 minutes' THEN
    RETURN jsonb_build_object('success', false, 'error', 'TOO_MANY_ATTEMPTS');
  END IF;

  IF v_row.code_hash <> extensions.crypt(v_clean_code, v_row.code_hash) THEN
    UPDATE public.user_recovery_codes
    SET attempts = CASE
          WHEN updated_at <= now() - interval '30 minutes' THEN 1
          ELSE attempts + 1
        END,
        updated_at = now()
    WHERE user_id = v_row.user_id;

    RETURN jsonb_build_object('success', false, 'error', 'INVALID_RECOVERY_CODE');
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = v_row.user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_NOT_FOUND');
  END IF;

  UPDATE public.user_recovery_codes
  SET attempts = 0, updated_at = now()
  WHERE user_id = v_row.user_id;

  RETURN jsonb_build_object('success', true, 'user_id', v_row.user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_password_with_recovery_code(text, text, text) TO anon, authenticated, service_role;

-- 4. Super Admin generates a free 6-digit OTP (valid 30 min) to send manually via 1-click wa.me
CREATE OR REPLACE FUNCTION public.admin_issue_whatsapp_otp(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_phone text;
  v_raw_num bigint;
  v_code text;
BEGIN
  IF NOT public.rls_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT public.normalize_moroccan_phone_e164(COALESCE(phone, phone_number))
  INTO v_phone
  FROM public.profiles
  WHERE id = p_user_id
  LIMIT 1;

  IF v_phone = '' OR v_phone IS NULL THEN
    SELECT public.normalize_moroccan_phone_e164(
      COALESCE(raw_user_meta_data->>'phone', phone, split_part(email, '@', 1))
    )
    INTO v_phone
    FROM auth.users
    WHERE id = p_user_id
    LIMIT 1;
  END IF;

  IF v_phone = '' OR v_phone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PHONE');
  END IF;

  v_raw_num := abs((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int)::bigint);
  v_code := lpad(((v_raw_num % 900000) + 100000)::text, 6, '0');

  UPDATE public.whatsapp_otp_codes
  SET used_at = now()
  WHERE phone = v_phone
    AND purpose = 'reset_password'
    AND used_at IS NULL;

  INSERT INTO public.whatsapp_otp_codes (phone, purpose, code_hash, expires_at)
  VALUES (
    v_phone,
    'reset_password',
    extensions.crypt(v_code, extensions.gen_salt('bf', 8)),
    now() + interval '30 minutes'
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', v_code,
    'phone', v_phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_issue_whatsapp_otp(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
