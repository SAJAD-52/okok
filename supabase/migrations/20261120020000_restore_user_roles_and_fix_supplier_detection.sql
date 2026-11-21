-- ============================================================================
-- JADIJCB: Emergency Recovery & Permanent Fix for User Roles
-- Migration: 20261120020000_restore_user_roles_and_fix_supplier_detection.sql
-- Purpose:
--   1. Drop default values on supplier_type / supplier_scope so non-suppliers
--      are never misidentified as suppliers.
--   2. Accurately restore every account's true role ('admin', 'owner',
--      'driver', 'client', 'supplier') from auth.users metadata and real
--      domain activity (machines, bookings, driver fields, import fields).
--   3. Clean up supplier_type & supplier_scope on all non-supplier profiles.
--   4. Harden rls_is_supplier() so it strictly checks role IN ('supplier', 'dealer').
-- ============================================================================

-- 1. Remove defaults on supplier-only columns so non-suppliers stay NULL
DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN supplier_type DROP DEFAULT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN supplier_scope DROP DEFAULT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Restore original role for every account in public.profiles
DO $$
DECLARE
  rec RECORD;
  v_target_role text;
BEGIN
  FOR rec IN
    SELECT
      p.id,
      p.role::text AS current_role,
      p.subscription_status::text AS sub_status,
      p.client_segment,
      p.driver_machines,
      p.driver_experience_years,
      p.import_countries,
      p.import_lead_time,
      p.supplier_specialties,
      u.raw_user_meta_data,
      EXISTS (SELECT 1 FROM public.machines m WHERE m.owner_id = p.id) AS has_any_machines,
      EXISTS (SELECT 1 FROM public.machines m WHERE m.owner_id = p.id AND m.category = 'spare-parts') AS has_spare_parts,
      EXISTS (SELECT 1 FROM public.bookings b WHERE b.owner_id = p.id) AS has_owner_bookings,
      EXISTS (SELECT 1 FROM public.bookings b WHERE b.client_id = p.id) AS has_client_bookings
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
  LOOP
    v_target_role := CASE
      -- Admin always stays admin
      WHEN rec.current_role = 'admin'
        OR COALESCE(rec.raw_user_meta_data->>'role', '') = 'admin'
        THEN 'admin'

      -- Genuine suppliers & importers
      WHEN COALESCE(rec.raw_user_meta_data->>'role', '') IN ('supplier', 'dealer')
        OR (
          COALESCE(rec.raw_user_meta_data->>'role', '') NOT IN ('owner', 'driver', 'client', 'contractor')
          AND (
            (rec.raw_user_meta_data ? 'supplier_type')
            OR (rec.raw_user_meta_data ? 'supplierType')
            OR COALESCE(array_length(rec.import_countries, 1), 0) > 0
            OR COALESCE(rec.import_lead_time, '') <> ''
            OR COALESCE(array_length(rec.supplier_specialties, 1), 0) > 0
            OR rec.has_spare_parts
          )
        )
        THEN 'supplier'

      -- Genuine machinery owners (by signup metadata OR owning machines/owner bookings)
      WHEN COALESCE(rec.raw_user_meta_data->>'role', '') = 'owner'
        OR rec.has_any_machines
        OR rec.has_owner_bookings
        THEN 'owner'

      -- Genuine drivers
      WHEN COALESCE(rec.raw_user_meta_data->>'role', '') = 'driver'
        OR COALESCE(array_length(rec.driver_machines, 1), 0) > 0
        OR NULLIF(COALESCE(rec.driver_experience_years, ''), '') IS NOT NULL
        THEN 'driver'

      -- Genuine clients / contractors
      WHEN COALESCE(rec.raw_user_meta_data->>'role', '') IN ('client', 'contractor')
        OR NULLIF(COALESCE(rec.client_segment, ''), '') IS NOT NULL
        OR rec.has_client_bookings
        THEN 'client'

      -- Fallback by initial trial subscription vs active client
      WHEN rec.sub_status IN ('trial', 'expired')
        THEN 'owner'

      ELSE 'client'
    END;

    IF rec.current_role IS DISTINCT FROM v_target_role THEN
      BEGIN
        EXECUTE 'UPDATE public.profiles SET role = $1::public.user_role WHERE id = $2'
          USING v_target_role, rec.id;
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          EXECUTE 'UPDATE public.profiles SET role = $1 WHERE id = $2'
            USING v_target_role, rec.id;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END;
    END IF;
  END LOOP;
END $$;

-- 3. Clear supplier_type and supplier_scope from all non-supplier accounts
UPDATE public.profiles
SET
  supplier_type = NULL,
  supplier_scope = NULL
WHERE role::text NOT IN ('supplier', 'dealer');

-- 4. Strictly check role IN ('supplier', 'dealer') in rls_is_supplier()
CREATE OR REPLACE FUNCTION public.rls_is_supplier()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role::text IN ('supplier', 'dealer')
  );
$$;

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
