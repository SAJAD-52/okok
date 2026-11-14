-- ============================================================================
-- JADIJCB: InDrive-Style Live Dispatch Campaigns & Real-Time Owner Alerts
-- Migration: 20261114000000_dispatch_campaigns.sql
-- ============================================================================

-- 1. Dispatch Campaigns Table (Launched by contractors from a job site card)
CREATE TABLE IF NOT EXISTS public.dispatch_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  site_id text,
  site_name text NOT NULL DEFAULT '',
  site_city text DEFAULT '',
  site_lat double precision NOT NULL,
  site_lng double precision NOT NULL,
  site_phone text DEFAULT '',
  machine_category text DEFAULT '',
  machine_name text NOT NULL,
  radius_km integer,
  is_nationwide boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  matched_owners_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_campaigns_contractor
  ON public.dispatch_campaigns(contractor_id, created_at DESC);

-- 2. Dispatch Notifications Table (Sent to matching machinery owners within radius)
CREATE TABLE IF NOT EXISTS public.dispatch_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.dispatch_campaigns(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  company_name text NOT NULL DEFAULT '',
  machine_name text NOT NULL DEFAULT '',
  matched_machine_title text DEFAULT '',
  site_name text NOT NULL DEFAULT '',
  site_city text DEFAULT '',
  site_lat double precision,
  site_lng double precision,
  site_phone text DEFAULT '',
  distance_km double precision,
  is_nationwide boolean NOT NULL DEFAULT false,
  radius_km integer,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'read', 'accepted', 'dismissed')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_notifications_owner
  ON public.dispatch_notifications(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_notifications_campaign
  ON public.dispatch_notifications(campaign_id, created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.dispatch_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for dispatch_campaigns
DO $$ BEGIN
  DROP POLICY IF EXISTS "Contractors and notified owners can view dispatch_campaigns" ON public.dispatch_campaigns;
  CREATE POLICY "Contractors and notified owners can view dispatch_campaigns"
    ON public.dispatch_campaigns FOR SELECT
    USING (
      contractor_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.dispatch_notifications dn
        WHERE dn.campaign_id = dispatch_campaigns.id
          AND dn.owner_id = auth.uid()
      )
      OR public.is_admin(auth.uid())
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Contractors can create dispatch_campaigns" ON public.dispatch_campaigns;
  CREATE POLICY "Contractors can create dispatch_campaigns"
    ON public.dispatch_campaigns FOR INSERT
    WITH CHECK (contractor_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Contractors can update own dispatch_campaigns" ON public.dispatch_campaigns;
  CREATE POLICY "Contractors can update own dispatch_campaigns"
    ON public.dispatch_campaigns FOR UPDATE
    USING (contractor_id = auth.uid())
    WITH CHECK (contractor_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. RLS Policies for dispatch_notifications
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners and contractors can view dispatch_notifications" ON public.dispatch_notifications;
  CREATE POLICY "Owners and contractors can view dispatch_notifications"
    ON public.dispatch_notifications FOR SELECT
    USING (
      owner_id = auth.uid()
      OR contractor_id = auth.uid()
      OR public.is_admin(auth.uid())
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Contractors can insert dispatch_notifications" ON public.dispatch_notifications;
  CREATE POLICY "Contractors can insert dispatch_notifications"
    ON public.dispatch_notifications FOR INSERT
    WITH CHECK (contractor_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners or contractors can update dispatch_notifications" ON public.dispatch_notifications;
  CREATE POLICY "Owners or contractors can update dispatch_notifications"
    ON public.dispatch_notifications FOR UPDATE
    USING (owner_id = auth.uid() OR contractor_id = auth.uid())
    WITH CHECK (owner_id = auth.uid() OR contractor_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Grants
GRANT ALL ON TABLE public.dispatch_campaigns TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.dispatch_notifications TO postgres, service_role, authenticated, anon;

-- 7. Enable Realtime on both tables
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_campaigns;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN OTHERS THEN NULL;
END $$;

-- 8. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
