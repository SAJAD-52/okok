-- ============================================================================
-- JADIJCB: Auto-Confirm Synthetic Phone Users & Resolve Email Rate Limits
-- ============================================================================

-- 1. Auto-confirm all existing users in auth.users whose email is synthetic or unconfirmed
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at = COALESCE(confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 2. Trigger function to automatically mark synthetic phone accounts as confirmed upon insert
CREATE OR REPLACE FUNCTION public.auto_confirm_synthetic_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.email LIKE '%@users.jadijcb.app' OR NEW.email LIKE '%@jadijcb.ma' THEN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Register BEFORE INSERT trigger on auth.users
DROP TRIGGER IF EXISTS trg_auto_confirm_synthetic_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_synthetic_user
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_synthetic_user();
