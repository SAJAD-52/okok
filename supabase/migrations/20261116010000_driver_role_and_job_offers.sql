-- ============================================================================
-- JADIJCB: Professional Heavy Machinery Drivers Role & Urgent Job Offers
-- Migration: 20261116010000_driver_role_and_job_offers.sql
-- ============================================================================

-- 1. Safely extend public.user_role enum with 'driver' if enum exists
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'driver';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Add driver profile columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driver_machines text[] DEFAULT '{}'::text[];

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driver_experience_years text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driver_available boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driver_bio text;

-- 3. Refresh handle_new_user() so driver metadata is persisted cleanly on signup
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
  v_client_segment text;
  v_client_note text;
  v_driver_exp text;
  v_driver_machines text[];
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
    v_client_segment := NEW.raw_user_meta_data->>'client_segment';
    v_client_note := COALESCE(NEW.raw_user_meta_data->>'client_activity_note', '');
    v_driver_exp := NEW.raw_user_meta_data->>'driver_experience_years';

    BEGIN
      IF NEW.raw_user_meta_data ? 'driver_machines'
         AND jsonb_typeof(NEW.raw_user_meta_data->'driver_machines') = 'array' THEN
        SELECT COALESCE(array_agg(elem), '{}'::text[])
        INTO v_driver_machines
        FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'driver_machines') AS elem;
      ELSE
        v_driver_machines := '{}'::text[];
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_driver_machines := '{}'::text[];
    END;

    INSERT INTO public.profiles (
      id,
      phone,
      phone_number,
      full_name,
      company_name,
      city,
      client_segment,
      client_activity_note,
      driver_machines,
      driver_experience_years,
      driver_available,
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
      v_client_segment,
      v_client_note,
      COALESCE(v_driver_machines, '{}'::text[]),
      v_driver_exp,
      true,
      false,
      CASE WHEN v_role_str IN ('client', 'contractor', 'driver') THEN 'active' ELSE 'trial' END,
      now(),
      now() + interval '72 hours',
      'ar'
    )
    ON CONFLICT (id) DO UPDATE SET
      phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
      phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number),
      full_name = CASE
        WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = ''
        THEN EXCLUDED.full_name ELSE public.profiles.full_name
      END,
      driver_machines = CASE
        WHEN COALESCE(array_length(public.profiles.driver_machines, 1), 0) = 0
        THEN EXCLUDED.driver_machines ELSE public.profiles.driver_machines
      END,
      driver_experience_years = COALESCE(public.profiles.driver_experience_years, EXCLUDED.driver_experience_years);

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
    RAISE WARNING 'handle_new_user non-fatal error for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 4. Urgent Driver Job Offers Table (used by /driver/joboffer & future owner dispatch campaigns)
CREATE TABLE IF NOT EXISTS public.driver_job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_name text NOT NULL DEFAULT '',
  owner_company text DEFAULT '',
  owner_phone text DEFAULT '',
  machine_category text NOT NULL,
  machine_label_ar text NOT NULL,
  machine_label_fr text NOT NULL DEFAULT '',
  offered_salary numeric NOT NULL DEFAULT 0,
  salary_unit text NOT NULL DEFAULT 'day' CHECK (salary_unit IN ('day', 'month')),
  city text NOT NULL DEFAULT 'Casablanca',
  work_location_note text DEFAULT '',
  duration_label text NOT NULL DEFAULT '',
  is_urgent boolean NOT NULL DEFAULT true,
  accommodation_included boolean NOT NULL DEFAULT false,
  meals_included boolean NOT NULL DEFAULT false,
  experience_required text DEFAULT '',
  description_ar text DEFAULT '',
  description_fr text DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_job_offers_status_created
  ON public.driver_job_offers (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_job_offers_machine_city
  ON public.driver_job_offers (machine_category, city);

ALTER TABLE public.driver_job_offers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rls_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text = 'admin'
  );
$$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Open driver job offers are readable" ON public.driver_job_offers;
  CREATE POLICY "Open driver job offers are readable"
    ON public.driver_job_offers FOR SELECT
    USING (status = 'open' OR owner_id = auth.uid() OR public.rls_is_admin());

  DROP POLICY IF EXISTS "Owners can create driver job offers" ON public.driver_job_offers;
  CREATE POLICY "Owners can create driver job offers"
    ON public.driver_job_offers FOR INSERT
    WITH CHECK (auth.uid() = owner_id OR public.rls_is_admin());

  DROP POLICY IF EXISTS "Owners can update their driver job offers" ON public.driver_job_offers;
  CREATE POLICY "Owners can update their driver job offers"
    ON public.driver_job_offers FOR UPDATE
    USING (auth.uid() = owner_id OR public.rls_is_admin());

  DROP POLICY IF EXISTS "Owners can delete their driver job offers" ON public.driver_job_offers;
  CREATE POLICY "Owners can delete their driver job offers"
    ON public.driver_job_offers FOR DELETE
    USING (auth.uid() = owner_id OR public.rls_is_admin());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Driver Job Applications Table (tracks driver responses/applications)
CREATE TABLE IF NOT EXISTS public.driver_job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.driver_job_offers(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_name text NOT NULL DEFAULT '',
  driver_phone text DEFAULT '',
  driver_city text DEFAULT '',
  driver_experience text DEFAULT '',
  note text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, driver_id)
);

ALTER TABLE public.driver_job_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Drivers and offer owners view applications" ON public.driver_job_applications;
  CREATE POLICY "Drivers and offer owners view applications"
    ON public.driver_job_applications FOR SELECT
    USING (
      auth.uid() = driver_id
      OR EXISTS (
        SELECT 1 FROM public.driver_job_offers o
        WHERE o.id = offer_id AND o.owner_id = auth.uid()
      )
      OR public.rls_is_admin()
    );

  DROP POLICY IF EXISTS "Drivers can apply to open offers" ON public.driver_job_applications;
  CREATE POLICY "Drivers can apply to open offers"
    ON public.driver_job_applications FOR INSERT
    WITH CHECK (auth.uid() = driver_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Enable Supabase Realtime for live driver job offer alerts
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_job_offers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
