-- ============================================================================
-- JADIJCB: Machinery & Spare Parts Suppliers + International Importers Portal
-- Migration: 20261120000000_supplier_and_importers.sql
-- ============================================================================

-- 1. Safely extend public.user_role enum with 'supplier' if enum exists
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'supplier';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Add supplier & international importer columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supplier_type text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS import_countries text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS import_lead_time text DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier_specialties text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS delivers_nationwide boolean NOT NULL DEFAULT true;

-- 3. Extend dispatch_campaigns & dispatch_notifications for machinery purchase / import requests
ALTER TABLE public.dispatch_campaigns
  ADD COLUMN IF NOT EXISTS budget_mad numeric,
  ADD COLUMN IF NOT EXISTS import_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_origin text DEFAULT '',
  ADD COLUMN IF NOT EXISTS desired_condition text DEFAULT 'any';

ALTER TABLE public.dispatch_notifications
  ADD COLUMN IF NOT EXISTS budget_mad numeric,
  ADD COLUMN IF NOT EXISTS import_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_origin text DEFAULT '',
  ADD COLUMN IF NOT EXISTS desired_condition text DEFAULT 'any';

-- 4. Refresh handle_new_user() so 'supplier' & importer metadata are persisted cleanly on signup
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
  v_supplier_type text;
  v_import_countries text[];
  v_import_lead_time text;
  v_delivers_nationwide boolean;
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
    v_supplier_type := COALESCE(NEW.raw_user_meta_data->>'supplier_type', 'all');
    v_import_lead_time := COALESCE(NEW.raw_user_meta_data->>'import_lead_time', '');
    v_delivers_nationwide := COALESCE((NEW.raw_user_meta_data->>'delivers_nationwide')::boolean, true);

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

    BEGIN
      IF NEW.raw_user_meta_data ? 'import_countries'
         AND jsonb_typeof(NEW.raw_user_meta_data->'import_countries') = 'array' THEN
        SELECT COALESCE(array_agg(elem), '{}'::text[])
        INTO v_import_countries
        FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'import_countries') AS elem;
      ELSE
        v_import_countries := '{}'::text[];
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_import_countries := '{}'::text[];
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
      supplier_type,
      import_countries,
      import_lead_time,
      delivers_nationwide,
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
      v_supplier_type,
      COALESCE(v_import_countries, '{}'::text[]),
      v_import_lead_time,
      v_delivers_nationwide,
      false,
      CASE WHEN v_role_str IN ('client', 'contractor', 'driver', 'supplier', 'dealer') THEN 'active' ELSE 'trial' END,
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
      supplier_type = COALESCE(NULLIF(public.profiles.supplier_type, ''), EXCLUDED.supplier_type),
      import_countries = CASE
        WHEN COALESCE(array_length(public.profiles.import_countries, 1), 0) = 0
        THEN EXCLUDED.import_countries ELSE public.profiles.import_countries
      END,
      import_lead_time = COALESCE(NULLIF(public.profiles.import_lead_time, ''), EXCLUDED.import_lead_time);

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

-- 5. Update accept_dispatch_deal so spare_part AND machine_purchase deals do NOT overwrite seller coordinates
CREATE OR REPLACE FUNCTION public.accept_dispatch_deal(
  p_campaign_id uuid,
  p_notification_id uuid,
  p_contractor_id uuid,
  p_owner_id uuid,
  p_machine_id uuid,
  p_site_name text,
  p_site_city text,
  p_site_lat double precision,
  p_site_lng double precision,
  p_company_name text DEFAULT '',
  p_site_phone text DEFAULT '',
  p_total_price numeric DEFAULT 0,
  p_notes text DEFAULT '',
  p_campaign_type text DEFAULT 'machine'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id uuid := gen_random_uuid();
  v_machine_title text := '';
  v_machine_category text := '';
  v_is_supply_deal boolean := false;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> p_contractor_id AND auth.uid() <> p_owner_id AND NOT public.rls_is_admin()) THEN
    RAISE EXCEPTION 'Not authorized to finalize this dispatch deal';
  END IF;

  IF p_machine_id IS NOT NULL THEN
    SELECT COALESCE(title_ar, title_fr, brand || ' ' || model, ''), COALESCE(category, '')
    INTO v_machine_title, v_machine_category
    FROM public.machines
    WHERE id = p_machine_id;
  END IF;

  v_is_supply_deal :=
    (COALESCE(p_campaign_type, 'machine') IN ('spare_part', 'machine_purchase'))
    OR (lower(v_machine_category) = 'spare-parts');

  IF p_machine_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.bookings (
        id, machine_id, owner_id, client_id, client_name, client_phone,
        start_at, end_at, total_price, status, notes
      ) VALUES (
        v_booking_id,
        p_machine_id,
        p_owner_id,
        p_contractor_id,
        COALESCE(NULLIF(trim(p_company_name), ''), 'مالك آلية / زبون'),
        COALESCE(NULLIF(trim(p_site_phone), ''), '+212600000000'),
        now(),
        now() + interval '7 days',
        GREATEST(COALESCE(p_total_price, 0), 0),
        'active',
        CASE
          WHEN p_campaign_type = 'machine_purchase' THEN 'طلب شراء / استيراد آلية — ' || COALESCE(p_site_name, '')
          WHEN v_is_supply_deal THEN 'طلب قطعة غيار عبر البحث المباشر — ' || COALESCE(p_site_name, '')
          ELSE 'صفقة حملة بحث مباشر — الورش: ' || COALESCE(p_site_name, '')
        END || CASE WHEN COALESCE(p_notes, '') <> '' THEN E'\n' || p_notes ELSE '' END
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.bookings (
        id, machine_id, owner_id, client_id, client_name, client_phone,
        start_at, end_at, total_price, status, notes
      ) VALUES (
        v_booking_id,
        p_machine_id,
        p_owner_id,
        p_contractor_id,
        COALESCE(NULLIF(trim(p_company_name), ''), 'مالك آلية / زبون'),
        COALESCE(NULLIF(trim(p_site_phone), ''), '+212600000000'),
        now(),
        now() + interval '7 days',
        GREATEST(COALESCE(p_total_price, 0), 0),
        'pending',
        CASE
          WHEN p_campaign_type = 'machine_purchase' THEN 'طلب شراء / استيراد آلية — ' || COALESCE(p_site_name, '')
          WHEN v_is_supply_deal THEN 'طلب قطعة غيار عبر البحث المباشر — ' || COALESCE(p_site_name, '')
          ELSE 'صفقة حملة بحث مباشر — الورش: ' || COALESCE(p_site_name, '')
        END || CASE WHEN COALESCE(p_notes, '') <> '' THEN E'\n' || p_notes ELSE '' END
      );
    END;

    IF NOT v_is_supply_deal THEN
      UPDATE public.machines
      SET
        lat = p_site_lat,
        lng = p_site_lng,
        city = COALESCE(NULLIF(trim(p_site_city), ''), city)
      WHERE id = p_machine_id;
    END IF;
  ELSE
    v_booking_id := NULL;
  END IF;

  IF p_campaign_id IS NOT NULL THEN
    UPDATE public.dispatch_campaigns
    SET
      status = 'closed',
      won_owner_id = p_owner_id,
      won_machine_id = p_machine_id,
      won_machine_title = COALESCE(NULLIF(v_machine_title, ''), won_machine_title),
      booking_id = v_booking_id,
      won_at = now()
    WHERE id = p_campaign_id;

    UPDATE public.dispatch_notifications
    SET
      contractor_accepted = true,
      owner_accepted = true,
      deal_status = 'accepted',
      status = 'accepted',
      is_read = true,
      booking_id = v_booking_id
    WHERE campaign_id = p_campaign_id
      AND (id = p_notification_id OR owner_id = p_owner_id);

    UPDATE public.dispatch_notifications
    SET
      status = 'dismissed',
      deal_status = 'closed_other',
      is_read = true
    WHERE campaign_id = p_campaign_id
      AND owner_id <> p_owner_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'campaign_id', p_campaign_id
  );
END;
$$;

-- 6. Safe RLS policy allowing authenticated suppliers/dealers to browse active Owner supply campaigns
CREATE OR REPLACE FUNCTION public.rls_is_supplier()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text IN ('supplier', 'dealer')
  );
$$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Suppliers can view open owner supply campaigns" ON public.dispatch_campaigns;
  CREATE POLICY "Suppliers can view open owner supply campaigns"
    ON public.dispatch_campaigns FOR SELECT
    USING (
      (status = 'active' AND campaign_type IN ('spare_part', 'machine_purchase') AND public.rls_is_supplier())
      OR contractor_id = auth.uid()
      OR won_owner_id = auth.uid()
      OR public.rls_is_admin()
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_campaigns;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
