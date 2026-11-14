-- ============================================================================
-- JADIJCB: Mutual Dispatch Deal Acceptance, Machine Relocation & Web Push
-- Migration: 20261114020000_dispatch_deals_and_push.sql
-- ============================================================================

-- 1. Extend dispatch_campaigns with winning deal metadata
ALTER TABLE public.dispatch_campaigns
  ADD COLUMN IF NOT EXISTS won_owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS won_machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS won_machine_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS booking_id uuid,
  ADD COLUMN IF NOT EXISTS won_at timestamptz;

-- 2. Extend dispatch_notifications with dual-party confirmation flags
ALTER TABLE public.dispatch_notifications
  ADD COLUMN IF NOT EXISTS contractor_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_status text NOT NULL DEFAULT 'open'
    CHECK (deal_status IN ('open', 'pending_contractor', 'pending_owner', 'accepted', 'closed_other')),
  ADD COLUMN IF NOT EXISTS booking_id uuid;

-- 3. Web Push Subscriptions Table (for background / closed-app mobile notifications)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
  CREATE POLICY "Users can manage own push subscriptions"
    ON public.push_subscriptions FOR ALL
    USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

GRANT ALL ON TABLE public.push_subscriptions TO postgres, service_role, authenticated;

-- 4. Atomic SECURITY DEFINER RPC to finalize a mutually-agreed dispatch deal:
--    - Closes the dispatch campaign & marks winning owner/machine
--    - Marks all other offers in the campaign as closed_other / dismissed
--    - Creates an active booking visible to both contractor & owner
--    - Updates the machine's GPS coordinates (lat, lng, city) to the job site
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
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_id uuid := gen_random_uuid();
  v_machine_title text := '';
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> p_contractor_id AND auth.uid() <> p_owner_id AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to finalize this dispatch deal';
  END IF;

  -- Resolve machine title
  IF p_machine_id IS NOT NULL THEN
    SELECT COALESCE(title_ar, title_fr, brand || ' ' || model, '')
    INTO v_machine_title
    FROM public.machines
    WHERE id = p_machine_id;
  END IF;

  -- 1. Create active booking (if machine_id exists)
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
        COALESCE(NULLIF(trim(p_company_name), ''), 'مقاولة أشغال'),
        COALESCE(NULLIF(trim(p_site_phone), ''), '+212600000000'),
        now(),
        now() + interval '7 days',
        GREATEST(COALESCE(p_total_price, 0), 0),
        'active',
        'صفقة حملة بحث مباشر — الورش: ' || COALESCE(p_site_name, '') ||
          CASE WHEN COALESCE(p_notes, '') <> '' THEN E'\n' || p_notes ELSE '' END
      );
    EXCEPTION WHEN OTHERS THEN
      -- Fallback if overlapping active booking exclusion triggers
      INSERT INTO public.bookings (
        id, machine_id, owner_id, client_id, client_name, client_phone,
        start_at, end_at, total_price, status, notes
      ) VALUES (
        v_booking_id,
        p_machine_id,
        p_owner_id,
        p_contractor_id,
        COALESCE(NULLIF(trim(p_company_name), ''), 'مقاولة أشغال'),
        COALESCE(NULLIF(trim(p_site_phone), ''), '+212600000000'),
        now(),
        now() + interval '7 days',
        GREATEST(COALESCE(p_total_price, 0), 0),
        'pending',
        'صفقة حملة بحث مباشر — الورش: ' || COALESCE(p_site_name, '') ||
          CASE WHEN COALESCE(p_notes, '') <> '' THEN E'\n' || p_notes ELSE '' END
      );
    END;

    -- 2. Relocate the machine to the contractor's job site in database
    UPDATE public.machines
    SET
      lat = p_site_lat,
      lng = p_site_lng,
      city = COALESCE(NULLIF(trim(p_site_city), ''), city)
    WHERE id = p_machine_id;
  ELSE
    v_booking_id := NULL;
  END IF;

  -- 3. Close the dispatch campaign (remains visible in contractor dashboard)
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

    -- Mark winning notification
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

    -- Close all OTHER notifications for the same campaign
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
    'site_lat', p_site_lat,
    'site_lng', p_site_lng
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
