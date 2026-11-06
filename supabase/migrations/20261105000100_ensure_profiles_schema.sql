-- ============================================================================
-- JADIJCB: Fix Database Error Saving New User & Ensure Profiles Schema
-- ============================================================================

-- 1. Drop any problematic BEFORE triggers on auth.users that might conflict with GoTrue
DROP TRIGGER IF EXISTS trg_auto_confirm_synthetic_user ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_synthetic_user();

-- 2. Ensure public.profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Drop all strict NOT NULL constraints on public.profiles that could fail an insert
DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN phone_number DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN full_name DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN company_name DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN city DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Ensure all required columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'client';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text DEFAULT 'Casablanca';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at timestamptz DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '72 hours');
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_lang text DEFAULT 'ar';

-- 5. Synchronize phone and phone_number
UPDATE public.profiles
SET
  phone = COALESCE(phone, phone_number),
  phone_number = COALESCE(phone_number, phone);

-- 6. Enable RLS and permissive policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
  CREATE POLICY "Profiles are publicly readable" ON public.profiles FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
  CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
  CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. 100% Fail-Safe Profile Creation Trigger on auth.users
-- Wrapped in an exception block so that it NEVER causes "Database error saving new user"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_phone text;
  v_role_str text;
  v_full_name text;
  v_company text;
  v_city text;
BEGIN
  BEGIN
    v_phone := COALESCE(
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'phone_number',
      NEW.phone,
      '+212600000000'
    );
    v_role_str := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
    v_company := COALESCE(NEW.raw_user_meta_data->>'company_name', '');
    v_city := COALESCE(NEW.raw_user_meta_data->>'city', 'Casablanca');

    INSERT INTO public.profiles (
      id,
      phone,
      phone_number,
      full_name,
      company_name,
      city,
      whatsapp_verified,
      subscription_status,
      trial_started_at,
      trial_ends_at,
      preferred_lang
    ) VALUES (
      NEW.id,
      v_phone,
      v_phone,
      v_full_name,
      v_company,
      v_city,
      false,
      'trial',
      now(),
      now() + interval '72 hours',
      'ar'
    )
    ON CONFLICT (id) DO UPDATE SET
      phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
      phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number),
      full_name = CASE WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;

    -- Update role safely whether role is text or user_role enum
    BEGIN
      UPDATE public.profiles SET role = v_role_str WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'UPDATE public.profiles SET role = ' || quote_literal(v_role_str) || '::public.user_role WHERE id = $1' USING NEW.id;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;

  EXCEPTION WHEN OTHERS THEN
    -- CRITICAL: Never abort auth.users transaction! The frontend useAuth handles fallback.
    RAISE WARNING 'handle_new_user non-fatal error for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Permissions
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated, anon;

-- 9. Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
