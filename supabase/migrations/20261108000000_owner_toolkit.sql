-- ============================================================================
-- JADIJCB: Owner Toolkit Migration (20261108000000_owner_toolkit.sql)
-- Idempotent schema, RLS, conflict prevention, business profile, documents,
-- clients, payments, leads, and super admin oversight.
-- ============================================================================

-- 1. Profiles additions: last_active_at & activation_at
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activation_at timestamptz;

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
  -- Only block conflicts for active and pending bookings
  IF NEW.status IN ('pending', 'active', 'confirmed') THEN
    SELECT id, start_at, end_at, status INTO conflict_record
    FROM public.bookings
    WHERE machine_id = NEW.machine_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status IN ('pending', 'active', 'confirmed')
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

-- 9. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
