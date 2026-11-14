-- ============================================================================
-- JADIJCB: Lifetime Free Subscription for VIP Owner (0612457896)
-- Migration: 20261114010000_lifetime_free_vip_owner.sql
-- ============================================================================

-- 1. Helper to check whether a phone number corresponds to a lifetime-free VIP account
CREATE OR REPLACE FUNCTION public.is_lifetime_free_phone(raw_phone text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  IF raw_phone IS NULL THEN
    RETURN false;
  END IF;
  digits := regexp_replace(raw_phone, '\D', '', 'g');
  RETURN right(digits, 9) = '612457896';
END;
$$;

-- 2. Activate existing profile(s) matching 0612457896 / +212612457896 for life
UPDATE public.profiles
SET
  subscription_status = 'active',
  subscription_ends_at = '2099-12-31 23:59:59+00'::timestamptz
WHERE public.is_lifetime_free_phone(phone)
   OR public.is_lifetime_free_phone(phone_number)
   OR id IN (
     SELECT id FROM auth.users
     WHERE email = '212612457896@users.jadijcb.app'
        OR public.is_lifetime_free_phone(phone)
   );

-- 3. Trigger to keep lifetime-free VIP phones permanently active on future signups/updates
CREATE OR REPLACE FUNCTION public.enforce_lifetime_free_vip_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.is_lifetime_free_phone(NEW.phone)
     OR public.is_lifetime_free_phone(NEW.phone_number) THEN
    NEW.subscription_status := 'active';
    NEW.subscription_ends_at := COALESCE(NEW.subscription_ends_at, '2099-12-31 23:59:59+00'::timestamptz);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lifetime_free_vip_profile ON public.profiles;
CREATE TRIGGER trg_enforce_lifetime_free_vip_profile
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lifetime_free_vip_profile();

-- 4. Update is_subscription_active() RLS helper so VIP phone always passes DB checks
CREATE OR REPLACE FUNCTION public.is_subscription_active(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT (
        public.is_lifetime_free_phone(phone)
        OR public.is_lifetime_free_phone(phone_number)
        OR (subscription_status = 'active' AND (subscription_ends_at IS NULL OR subscription_ends_at > now()))
        OR (subscription_status = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at > now()))
        OR subscription_status IS NULL
      )
      FROM public.profiles
      WHERE id = uid
    ),
    true
  );
$$;

NOTIFY pgrst, 'reload schema';
