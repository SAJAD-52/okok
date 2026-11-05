-- ============================================================================
-- JADIJCB: Ensure public.profiles Schema & Reload PostgREST Schema Cache
-- ============================================================================

-- 1. Ensure public.profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Alter table to add any missing columns (handles pre-existing starter tables)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
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

-- 3. Unique index on phone
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone) WHERE phone IS NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Enable RLS and permissive policies for users
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

-- 5. Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
