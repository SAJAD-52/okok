-- ============================================================================
-- JADIJCB: Owner-Supplier Guided Search Campaigns, Fleet Link, Mutual Terms & Closed Orders
-- Migration: 20261120010000_owner_supplier_orders_and_terms.sql
-- ============================================================================

-- 1. Extend public.dispatch_campaigns with fleet-machine link, model, customs, and closed supplier order fields
ALTER TABLE public.dispatch_campaigns
  ADD COLUMN IF NOT EXISTS desired_model text DEFAULT '',
  ADD COLUMN IF NOT EXISTS customs_clearance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_fleet_machine boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fleet_machine_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_image text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_brand text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_model text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_year integer,
  ADD COLUMN IF NOT EXISTS agreed_price numeric,
  ADD COLUMN IF NOT EXISTS agreed_currency text DEFAULT 'MAD',
  ADD COLUMN IF NOT EXISTS agreed_supply_source text DEFAULT '',
  ADD COLUMN IF NOT EXISTS won_supplier_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS won_supplier_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS won_supplier_city text DEFAULT '';

-- 2. Extend public.dispatch_notifications with fleet-machine link, model, customs & two-party terms agreement
ALTER TABLE public.dispatch_notifications
  ADD COLUMN IF NOT EXISTS desired_model text DEFAULT '',
  ADD COLUMN IF NOT EXISTS customs_clearance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_fleet_machine boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fleet_machine_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_image text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_brand text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_model text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fleet_machine_year integer,
  ADD COLUMN IF NOT EXISTS contractor_terms_agreed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_terms_agreed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreed_price numeric,
  ADD COLUMN IF NOT EXISTS agreed_currency text DEFAULT 'MAD',
  ADD COLUMN IF NOT EXISTS agreed_supply_source text DEFAULT '';

-- 3. Helpful performance indexes
CREATE INDEX IF NOT EXISTS idx_dispatch_campaigns_supply_active
  ON public.dispatch_campaigns(campaign_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_type
  ON public.notifications(user_id, type, created_at DESC);

-- 4. Allow both Owner (requester) and winning Supplier to close/update supply campaigns safely
DO $$ BEGIN
  DROP POLICY IF EXISTS "Supply campaign participants can close deal" ON public.dispatch_campaigns;
  CREATE POLICY "Supply campaign participants can close deal"
    ON public.dispatch_campaigns FOR UPDATE
    USING (
      contractor_id = auth.uid()
      OR won_owner_id = auth.uid()
      OR (
        campaign_type IN ('spare_part', 'machine_purchase')
        AND public.rls_is_supplier()
      )
      OR public.rls_is_admin()
    )
    WITH CHECK (
      contractor_id = auth.uid()
      OR won_owner_id = auth.uid()
      OR (
        campaign_type IN ('spare_part', 'machine_purchase')
        AND public.rls_is_supplier()
      )
      OR public.rls_is_admin()
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Allow suppliers to initiate/link their notification row on open Owner supply campaigns
DO $$ BEGIN
  DROP POLICY IF EXISTS "Suppliers can engage open supply notifications" ON public.dispatch_notifications;
  CREATE POLICY "Suppliers can engage open supply notifications"
    ON public.dispatch_notifications FOR INSERT
    WITH CHECK (
      contractor_id = auth.uid()
      OR (
        owner_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.dispatch_campaigns dc
          WHERE dc.id = campaign_id
            AND dc.status = 'active'
            AND dc.campaign_type IN ('spare_part', 'machine_purchase')
        )
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
