-- ============================================================================
-- JADIJCB: Owner Toolkit Migration (20261108000000_owner_toolkit.sql)
-- Idempotent schema, RLS, conflict prevention, business profile, documents,
-- clients, payments, leads, and super admin oversight.
-- ============================================================================

-- 1. Profiles additions: last_active_at, activation_at, onboarding_completed, ice_number, avatar_url, banner_url, storefront_slug
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activation_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ice_number text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS storefront_slug text DEFAULT '';

-- 2. Business Profiles Table (/app/settings/business)
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  logo_url text DEFAULT '',
  stamp_signature_url text DEFAULT '',
  ice text DEFAULT '',
  rc text DEFAULT '',
  identifiant_fiscal text DEFAULT '',
  taxe_professionnelle text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  rib text DEFAULT '',
  vat_enabled boolean NOT NULL DEFAULT false,
  default_terms_ar text DEFAULT '',
  default_terms_fr text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can view own business profile" ON public.business_profiles;
  CREATE POLICY "Owners can view own business profile" ON public.business_profiles
    FOR SELECT USING (
      auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

  DROP POLICY IF EXISTS "Owners can insert own business profile" ON public.business_profiles;
  CREATE POLICY "Owners can insert own business profile" ON public.business_profiles
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

  DROP POLICY IF EXISTS "Owners can update own business profile" ON public.business_profiles;
  CREATE POLICY "Owners can update own business profile" ON public.business_profiles
    FOR UPDATE USING (auth.uid() = owner_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Clients Directory Table (/app/clients)
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  cin_or_ice text DEFAULT '',
  city text DEFAULT 'Casablanca',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON public.clients(owner_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can manage own clients" ON public.clients;
  CREATE POLICY "Owners can manage own clients" ON public.clients
    FOR ALL USING (
      auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    ) WITH CHECK (
      auth.uid() = owner_id
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Overlap Conflict Protection on Bookings
-- Add additional fields to bookings if missing
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rate_type text DEFAULT 'daily';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS fuel_included boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS client_ref_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Trigger to prevent overlapping non-cancelled bookings for same machine
CREATE OR REPLACE FUNCTION public.check_booking_conflict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_record RECORD;
BEGIN
    IF TG_OP = 'UPDATE'
     AND NEW.machine_id IS NOT DISTINCT FROM OLD.machine_id
     AND NEW.start_at IS NOT DISTINCT FROM OLD.start_at
     AND NEW.end_at IS NOT DISTINCT FROM OLD.end_at
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text IN ('pending', 'active', 'confirmed') THEN
    SELECT id, start_at, end_at, status INTO conflict_record
    FROM public.bookings
    WHERE machine_id = NEW.machine_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status::text IN ('pending', 'active', 'confirmed')
      AND tstzrange(start_at, end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
    LIMIT 1;

    IF conflict_record.id IS NOT NULL THEN
      RAISE EXCEPTION 'BOOKING_CONFLICT: Machine already booked from % to % (status: %)',
        conflict_record.start_at, conflict_record.end_at, conflict_record.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_booking_conflict ON public.bookings;
CREATE TRIGGER trg_check_booking_conflict
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_conflict();

-- 5. Booking Payments & Balances Table
CREATE TABLE IF NOT EXISTS public.booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cash',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_payments_booking_id ON public.booking_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_owner_id ON public.booking_payments(owner_id);

ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can manage own booking payments" ON public.booking_payments;
  CREATE POLICY "Owners can manage own booking payments" ON public.booking_payments
    FOR ALL USING (
      auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    ) WITH CHECK (
      auth.uid() = owner_id
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Documents Table (Contracts, Invoices, Receipts)
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('contract', 'invoice', 'receipt')),
  number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_documents_owner_type_number UNIQUE (owner_id, type, number)
);

CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_booking_id ON public.documents(booking_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can manage own documents" ON public.documents;
  CREATE POLICY "Owners can manage own documents" ON public.documents
    FOR ALL USING (
      auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    ) WITH CHECK (
      auth.uid() = owner_id
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. Leads Table (Storefront Lead Capture)
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  city text DEFAULT '',
  rental_duration text DEFAULT '',
  start_date date,
  notes text DEFAULT '',
  is_contacted boolean NOT NULL DEFAULT false,
  contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON public.leads(owner_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Public can create leads from public storefront
  DROP POLICY IF EXISTS "Public can submit quotes" ON public.leads;
  CREATE POLICY "Public can submit quotes" ON public.leads
    FOR INSERT WITH CHECK (true);

  -- Owners can view and manage their own leads
  DROP POLICY IF EXISTS "Owners can view own leads" ON public.leads;
  CREATE POLICY "Owners can view own leads" ON public.leads
    FOR SELECT USING (
      auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

  DROP POLICY IF EXISTS "Owners can update own leads" ON public.leads;
  CREATE POLICY "Owners can update own leads" ON public.leads
    FOR UPDATE USING (
      auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8. Machine Expenses additions for Maintenance Economics
ALTER TABLE public.machine_expenses ADD COLUMN IF NOT EXISTS hours_or_km numeric(10,1) DEFAULT 0;
ALTER TABLE public.machine_expenses ADD COLUMN IF NOT EXISTS next_due_date date;
ALTER TABLE public.machine_expenses ADD COLUMN IF NOT EXISTS expense_type text DEFAULT 'expense';

-- 9. Real-time Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_ar text NOT NULL DEFAULT '',
  title_fr text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  body_fr text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'booking_request',
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
  CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

  DROP POLICY IF EXISTS "Public and users can insert notifications" ON public.notifications;
  CREATE POLICY "Public and users can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
  CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 10. Bookings RLS enhancements: Allow public/guest inserts, allow owners to view bookings by owner_id or machine ownership
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public or authenticated can create bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Authenticated users can create bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Clients can book machines" ON public.bookings;
  CREATE POLICY "Public or authenticated can create bookings" ON public.bookings
    FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS "Owners, clients, or admins can view their bookings" ON public.bookings;
  CREATE POLICY "Owners, clients, or admins can view their bookings" ON public.bookings
    FOR SELECT USING (
      auth.uid() = owner_id
      OR auth.uid() = client_id
      OR machine_id IN (SELECT id FROM public.machines WHERE owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

  DROP POLICY IF EXISTS "Owners or clients can update bookings" ON public.bookings;
  CREATE POLICY "Owners or clients can update bookings" ON public.bookings
    FOR UPDATE USING (
      auth.uid() = owner_id
      OR auth.uid() = client_id
      OR machine_id IN (SELECT id FROM public.machines WHERE owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 11. Auto-synchronize owner_id from machines table (ensures owner ALWAYS receives bookings)
CREATE OR REPLACE FUNCTION public.sync_booking_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.machine_id IS NOT NULL THEN
    SELECT owner_id INTO NEW.owner_id
    FROM public.machines
    WHERE id = NEW.machine_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_owner_id ON public.bookings;
CREATE TRIGGER trg_sync_booking_owner_id
  BEFORE INSERT OR UPDATE OF machine_id ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_booking_owner_id();

-- Backfill: Fix any existing bookings whose owner_id was omitted or mismatched
UPDATE public.bookings b
SET owner_id = m.owner_id
FROM public.machines m
WHERE b.machine_id = m.id
  AND m.owner_id IS NOT NULL
  AND (b.owner_id IS NULL OR b.owner_id <> m.owner_id);

-- 12. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';

