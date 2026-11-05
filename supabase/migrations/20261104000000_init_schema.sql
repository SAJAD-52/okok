-- ============================================================================
-- JADIJCB: Moroccan Heavy Machinery B2B Marketplace & SaaS Database Schema
-- Migration: 20261104000000_init_schema.sql
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'expired', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.listing_mode AS ENUM ('rent', 'sale');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.machine_condition AS ENUM ('new', 'used');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('pending', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner', 'client', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  full_name text,
  company_name text,
  role public.user_role NOT NULL DEFAULT 'client',
  city text,
  avatar_url text,
  whatsapp_verified boolean NOT NULL DEFAULT false,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  trial_started_at timestamptz DEFAULT now(),
  trial_ends_at timestamptz DEFAULT (now() + interval '72 hours'),
  subscription_ends_at timestamptz,
  preferred_lang text NOT NULL DEFAULT 'ar' CHECK (preferred_lang IN ('ar', 'fr')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helper function: Check if current authenticated user has admin role
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role = 'admin'
  );
$$;

-- Helper function: Check if user's subscription or 72-hour trial is currently active
CREATE OR REPLACE FUNCTION public.is_subscription_active(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND (
        (subscription_status = 'active' AND subscription_ends_at IS NOT NULL AND subscription_ends_at > now())
        OR
        (subscription_status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at > now())
        OR
        role = 'admin'
      )
  );
$$;

-- Trigger: Automatically provision profile upon auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_phone text;
  v_full_name text;
  v_company_name text;
  v_role public.user_role;
  v_city text;
  v_lang text;
BEGIN
  -- Extract phone with fallback
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.phone,
    '+2126' || lpad(floor(random() * 100000000)::text, 8, '0')
  );

  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  v_city := COALESCE(NEW.raw_user_meta_data->>'city', 'Casablanca');
  v_lang := COALESCE(NEW.raw_user_meta_data->>'preferred_lang', 'ar');

  -- Role casting
  BEGIN
    v_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'client'::public.user_role;
  END;

  INSERT INTO public.profiles (
    id,
    phone,
    full_name,
    company_name,
    role,
    city,
    whatsapp_verified,
    subscription_status,
    trial_started_at,
    trial_ends_at,
    preferred_lang,
    created_at
  ) VALUES (
    NEW.id,
    v_phone,
    v_full_name,
    v_company_name,
    COALESCE(v_role, 'client'::public.user_role),
    v_city,
    false,
    'trial',
    now(),
    now() + interval '72 hours',
    CASE WHEN v_lang = 'fr' THEN 'fr' ELSE 'ar' END,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    company_name = COALESCE(EXCLUDED.company_name, public.profiles.company_name),
    city = COALESCE(EXCLUDED.city, public.profiles.city);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. MACHINES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_ar text NOT NULL,
  title_fr text NOT NULL,
  description_ar text,
  description_fr text,
  category text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  year int NOT NULL CHECK (year >= 1970 AND year <= 2030),
  listing_mode public.listing_mode NOT NULL,
  condition public.machine_condition NOT NULL,
  city text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  hourly_rate numeric(10,2),
  daily_rate numeric(10,2),
  weekly_rate numeric(10,2),
  sale_price numeric(12,2),
  with_operator boolean NOT NULL DEFAULT false,
  fuel_included boolean NOT NULL DEFAULT false,
  delivery_available boolean NOT NULL DEFAULT false,
  images text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT true,
  views_count int NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- CHECK constraints:
  -- rent requires at least one rate (hourly, daily, or weekly)
  -- sale requires sale_price and condition
  CONSTRAINT chk_machines_mode_requirements CHECK (
    (listing_mode = 'rent' AND (hourly_rate IS NOT NULL OR daily_rate IS NOT NULL OR weekly_rate IS NOT NULL))
    OR
    (listing_mode = 'sale' AND sale_price IS NOT NULL AND condition IS NOT NULL)
  )
);

-- ============================================================================
-- 4. BOOKINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  total_price numeric(10,2) NOT NULL CHECK (total_price >= 0),
  status public.booking_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_booking_dates CHECK (end_at > start_at),

  -- Exclusion constraint preventing overlapping active bookings for the same machine
  CONSTRAINT no_overlapping_active_bookings EXCLUDE USING gist (
    machine_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status = 'active')
);

-- ============================================================================
-- 5. CONVERSATIONS & MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  participant_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_diff_participants CHECK (participant_a <> participant_b),
  CONSTRAINT uq_conversation_pair UNIQUE NULLS NOT DISTINCT (machine_id, participant_a, participant_b)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. PAYMENTS (Offline RIB / Wafacash manual approval)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('rib', 'wafacash')),
  reference text NOT NULL,
  proof_url text NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. STOREFRONTS (Owner Public Landing Page)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.storefronts (
  owner_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL CHECK (length(trim(slug)) >= 3),
  banner_url text,
  about_ar text,
  about_fr text,
  whatsapp text,
  theme_color text NOT NULL DEFAULT '#FFB400'
);

-- ============================================================================
-- 8. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_machines_city ON public.machines(city);
CREATE INDEX IF NOT EXISTS idx_machines_category ON public.machines(category);
CREATE INDEX IF NOT EXISTS idx_machines_listing_mode ON public.machines(listing_mode);
CREATE INDEX IF NOT EXISTS idx_machines_is_published ON public.machines(is_published);
CREATE INDEX IF NOT EXISTS idx_machines_owner_id ON public.machines(owner_id);
CREATE INDEX IF NOT EXISTS idx_machines_lat_lng ON public.machines(lat, lng);

CREATE INDEX IF NOT EXISTS idx_bookings_machine_id ON public.bookings(machine_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner_id ON public.bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(participant_a, participant_b);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- ============================================================================
-- 9. REALTIME PUBLICATION
-- ============================================================================
-- Enable Postgres logical replication for real-time chat messages and conversations
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 10. STORAGE BUCKETS & STORAGE RLS POLICIES
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('machine-images', 'machine-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage policies: machine-images (public read, owner upload to own folder)
DROP POLICY IF EXISTS "Public can view machine images" ON storage.objects;
CREATE POLICY "Public can view machine images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'machine-images');

DROP POLICY IF EXISTS "Owners can upload machine images into own folder" ON storage.objects;
CREATE POLICY "Owners can upload machine images into own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'machine-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owners can update own machine images" ON storage.objects;
CREATE POLICY "Owners can update own machine images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'machine-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owners can delete own machine images" ON storage.objects;
CREATE POLICY "Owners can delete own machine images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'machine-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies: payment-proofs (private: owner uploads to own folder, admin view all)
DROP POLICY IF EXISTS "Users can upload their own payment proof" ON storage.objects;
CREATE POLICY "Users can upload their own payment proof"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users view own payment proof or admin" ON storage.objects;
CREATE POLICY "Users view own payment proof or admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text)
      OR public.is_admin()
    )
  );

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- A. PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable for marketplace trust"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile or admin"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Only admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- B. MACHINES
-- Soft lock: Write policies require is_subscription_active(auth.uid()), reads remain allowed
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published machines or owners view their own"
  ON public.machines FOR SELECT
  USING (
    is_published = true
    OR owner_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "Active subscribers can create machines"
  ON public.machines FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_subscription_active(auth.uid())
  );

CREATE POLICY "Active subscribers or admins can update their machines"
  ON public.machines FOR UPDATE
  USING (
    (owner_id = auth.uid() AND public.is_subscription_active(auth.uid()))
    OR public.is_admin()
  )
  WITH CHECK (
    (owner_id = auth.uid() AND public.is_subscription_active(auth.uid()))
    OR public.is_admin()
  );

CREATE POLICY "Owners or admins can delete their machines"
  ON public.machines FOR DELETE
  USING (
    owner_id = auth.uid()
    OR public.is_admin()
  );

-- C. BOOKINGS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners, clients, or admins can view their bookings"
  ON public.bookings FOR SELECT
  USING (
    owner_id = auth.uid()
    OR client_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "Clients can book machines when owner has active subscription"
  ON public.bookings FOR INSERT
  WITH CHECK (
    -- Authenticated client or guest submission
    (client_id IS NULL OR client_id = auth.uid())
    AND public.is_subscription_active(owner_id)
  );

CREATE POLICY "Owners or clients can update booking status"
  ON public.bookings FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR client_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR client_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "Owners or admins can delete bookings"
  ON public.bookings FOR DELETE
  USING (
    owner_id = auth.uid()
    OR public.is_admin()
  );

-- D. CONVERSATIONS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants or admins can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    participant_a = auth.uid()
    OR participant_b = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "Participants can create a conversation"
  ON public.conversations FOR INSERT
  WITH CHECK (
    participant_a = auth.uid()
    OR participant_b = auth.uid()
  );

CREATE POLICY "Participants can update conversation timestamp"
  ON public.conversations FOR UPDATE
  USING (
    participant_a = auth.uid()
    OR participant_b = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "Admins can delete conversations"
  ON public.conversations FOR DELETE
  USING (public.is_admin());

-- E. MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
    OR public.is_admin()
  );

CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

CREATE POLICY "Recipients can mark messages as read"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

CREATE POLICY "Senders or admins can delete messages"
  ON public.messages FOR DELETE
  USING (
    sender_id = auth.uid()
    OR public.is_admin()
  );

-- F. PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments, admins view all"
  ON public.payments FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "Users can submit payment proofs"
  ON public.payments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Only admins can update payment status"
  ON public.payments FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete payment records"
  ON public.payments FOR DELETE
  USING (public.is_admin());

-- G. STOREFRONTS
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Storefronts are publicly readable"
  ON public.storefronts FOR SELECT
  USING (true);

CREATE POLICY "Active owners can create their storefront"
  ON public.storefronts FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_subscription_active(auth.uid())
  );

CREATE POLICY "Active owners or admins can update their storefront"
  ON public.storefronts FOR UPDATE
  USING (
    (owner_id = auth.uid() AND public.is_subscription_active(auth.uid()))
    OR public.is_admin()
  )
  WITH CHECK (
    (owner_id = auth.uid() AND public.is_subscription_active(auth.uid()))
    OR public.is_admin()
  );

CREATE POLICY "Owners or admins can delete their storefront"
  ON public.storefronts FOR DELETE
  USING (
    owner_id = auth.uid()
    OR public.is_admin()
  );

-- ============================================================================
-- 12. ADMIN RPC: approve_payment(payment_id, months)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_payment(
  payment_id uuid,
  months int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_target_profile public.profiles%ROWTYPE;
  v_new_end_date timestamptz;
BEGIN
  -- 1. Security Check: caller must have admin role
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  -- 2. Validate input
  IF months IS NULL OR months < 1 THEN
    RAISE EXCEPTION 'Invalid duration. Months must be at least 1.';
  END IF;

  -- 3. Fetch payment
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment record % not found.', payment_id;
  END IF;

  -- 4. Fetch target user profile
  SELECT * INTO v_target_profile
  FROM public.profiles
  WHERE id = v_payment.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile % not found for payment.', v_payment.user_id;
  END IF;

  -- 5. Calculate new subscription end date
  -- Extends from existing subscription_ends_at if still active, otherwise from now()
  IF v_target_profile.subscription_ends_at IS NOT NULL AND v_target_profile.subscription_ends_at > now() THEN
    v_new_end_date := v_target_profile.subscription_ends_at + (months || ' months')::interval;
  ELSE
    v_new_end_date := now() + (months || ' months')::interval;
  END IF;

  -- 6. Update payment record
  UPDATE public.payments
  SET
    status = 'approved',
    reviewed_by = auth.uid()
  WHERE id = payment_id;

  -- 7. Update user profile to active subscription
  UPDATE public.profiles
  SET
    subscription_status = 'active',
    subscription_ends_at = v_new_end_date
  WHERE id = v_payment.user_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', payment_id,
    'user_id', v_payment.user_id,
    'status', 'approved',
    'subscription_ends_at', v_new_end_date
  );
END;
$$;


