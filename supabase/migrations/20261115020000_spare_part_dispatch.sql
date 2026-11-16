-- ============================================================================
-- JADIJCB: Owner Spare Parts Live Dispatch Campaigns & Specs Persistence
-- Migration: 20261115020000_spare_part_dispatch.sql
-- ============================================================================

-- 1. Ensure public.machines has specs jsonb column (stores part_number, part_type, compatible_models)
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS specs jsonb DEFAULT '{}'::jsonb;

-- 2. Extend dispatch_campaigns for spare-part campaigns
ALTER TABLE public.dispatch_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'machine',
  ADD COLUMN IF NOT EXISTS part_reference text DEFAULT '',
  ADD COLUMN IF NOT EXISTS part_category text DEFAULT '';

-- 3. Extend dispatch_notifications for spare-part campaigns
ALTER TABLE public.dispatch_notifications
  ADD COLUMN IF NOT EXISTS campaign_type text NOT NULL DEFAULT 'machine',
  ADD COLUMN IF NOT EXISTS part_reference text DEFAULT '',
  ADD COLUMN IF NOT EXISTS part_category text DEFAULT '';

-- 4. Update accept_dispatch_deal so spare-part deals do NOT relocate the supplier's shop coordinates
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
  v_is_spare boolean := false;
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

  v_is_spare := (COALESCE(p_campaign_type, 'machine') = 'spare_part') OR (lower(v_machine_category) = 'spare-parts');

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
        COALESCE(NULLIF(trim(p_company_name), ''), 'زبون / مالك آلية'),
        COALESCE(NULLIF(trim(p_site_phone), ''), '+212600000000'),
        now(),
        now() + interval '7 days',
        GREATEST(COALESCE(p_total_price, 0), 0),
        'active',
        CASE
          WHEN v_is_spare THEN 'طلب قطعة غيار عبر البحث المباشر — ' || COALESCE(p_site_name, '')
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
        COALESCE(NULLIF(trim(p_company_name), ''), 'زبون / مالك آلية'),
        COALESCE(NULLIF(trim(p_site_phone), ''), '+212600000000'),
        now(),
        now() + interval '7 days',
        GREATEST(COALESCE(p_total_price, 0), 0),
        'pending',
        CASE
          WHEN v_is_spare THEN 'طلب قطعة غيار عبر البحث المباشر — ' || COALESCE(p_site_name, '')
          ELSE 'صفقة حملة بحث مباشر — الورش: ' || COALESCE(p_site_name, '')
        END || CASE WHEN COALESCE(p_notes, '') <> '' THEN E'\n' || p_notes ELSE '' END
      );
    END;

    -- Relocate ONLY machinery rentals; never overwrite spare-parts store coordinates
    IF NOT v_is_spare THEN
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
      won_machine_title = v_machine_title,
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
      deal_status = 'closed_other',
      status = 'dismissed',
      is_read = true
    WHERE campaign_id = p_campaign_id
      AND owner_id <> p_owner_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'campaign_id', p_campaign_id,
    'machine_id', p_machine_id,
    'is_spare_part', v_is_spare
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
