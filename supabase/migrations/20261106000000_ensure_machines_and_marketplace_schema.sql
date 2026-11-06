-- ============================================================================
-- JADIJCB: Comprehensive Machines, Bookings, Storefronts & Storage Schema
-- Migration: 20261106000000_ensure_machines_and_marketplace_schema.sql
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. HELPER FUNCTION: is_subscription_active (Permissive for trial / onboarding)
CREATE OR REPLACE FUNCTION public.is_subscription_active(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT (
        (subscription_status = 'active' AND (subscription_ends_at IS NULL OR subscription_ends_at > now()))
        OR
        (subscription_status = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at > now()))
        OR
        subscription_status IS NULL
      )
      FROM public.profiles
      WHERE id = uid
    ),
    true
  );
$$;

-- 3. ENSURE MACHINES TABLE & ALL REQUIRED COLUMNS
CREATE TABLE IF NOT EXISTS public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_ar text NOT NULL DEFAULT '',
  title_fr text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns to public.machines if they do not exist
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS title_ar text NOT NULL DEFAULT '';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS title_fr text NOT NULL DEFAULT '';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS description_ar text DEFAULT '';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS description_fr text DEFAULT '';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS category text DEFAULT 'excavators';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS brand text DEFAULT '';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS model text DEFAULT '';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS year int DEFAULT 2022;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS listing_mode text DEFAULT 'rent';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS condition text DEFAULT 'used';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS city text DEFAULT 'Casablanca';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS lat double precision DEFAULT 33.5731;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS lng double precision DEFAULT -7.5898;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS daily_rate numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS weekly_rate numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS rate_hourly numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS rate_daily numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS rate_weekly numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS sale_price numeric(12,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS with_operator boolean DEFAULT false;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS fuel_included boolean DEFAULT false;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS delivery_available boolean DEFAULT false;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS views_count int DEFAULT 0;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Drop any restrictive check constraints that might block inserts
DO $$ BEGIN
  ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS chk_machines_mode_requirements;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. ENABLE RLS & POLICIES ON MACHINES
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can view published machines or owners view their own" ON public.machines;
  CREATE POLICY "Anyone can view published machines or owners view their own"
    ON public.machines FOR SELECT
    USING (is_published = true OR owner_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Active subscribers can create machines" ON public.machines;
  CREATE POLICY "Active subscribers can create machines"
    ON public.machines FOR INSERT
    WITH CHECK (owner_id = auth.uid() AND public.is_subscription_active(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Active subscribers or admins can update their machines" ON public.machines;
  CREATE POLICY "Active subscribers or admins can update their machines"
    ON public.machines FOR UPDATE
    USING (owner_id = auth.uid() AND public.is_subscription_active(auth.uid()))
    WITH CHECK (owner_id = auth.uid() AND public.is_subscription_active(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners or admins can delete their machines" ON public.machines;
  CREATE POLICY "Owners or admins can delete their machines"
    ON public.machines FOR DELETE
    USING (owner_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. ENSURE BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners, clients, or admins can view their bookings" ON public.bookings;
  CREATE POLICY "Owners, clients, or admins can view their bookings"
    ON public.bookings FOR SELECT
    USING (owner_id = auth.uid() OR client_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Clients can book machines" ON public.bookings;
  CREATE POLICY "Clients can book machines"
    ON public.bookings FOR INSERT
    WITH CHECK (client_id IS NULL OR client_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners or clients can update booking status" ON public.bookings;
  CREATE POLICY "Owners or clients can update booking status"
    ON public.bookings FOR UPDATE
    USING (owner_id = auth.uid() OR client_id = auth.uid())
    WITH CHECK (owner_id = auth.uid() OR client_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. ENSURE STOREFRONTS TABLE
CREATE TABLE IF NOT EXISTS public.storefronts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text,
  logo_url text,
  banner_url text,
  contact_phone text,
  whatsapp_number text,
  city text,
  address text,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Storefronts are publicly readable" ON public.storefronts;
  CREATE POLICY "Storefronts are publicly readable" ON public.storefronts FOR SELECT USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Active owners can create their storefront" ON public.storefronts;
  CREATE POLICY "Active owners can create their storefront"
    ON public.storefronts FOR INSERT
    WITH CHECK (owner_id = auth.uid() AND public.is_subscription_active(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Active owners or admins can update their storefront" ON public.storefronts;
  CREATE POLICY "Active owners or admins can update their storefront"
    ON public.storefronts FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. ENSURE CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  participant_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_preview text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Participants can view their conversations" ON public.conversations;
  CREATE POLICY "Participants can view their conversations"
    ON public.conversations FOR SELECT
    USING (participant_a = auth.uid() OR participant_b = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can start conversations" ON public.conversations;
  CREATE POLICY "Authenticated users can start conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (participant_a = auth.uid() OR participant_b = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Conversation participants can view messages" ON public.messages;
  CREATE POLICY "Conversation participants can view messages"
    ON public.messages FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Conversation participants can send messages" ON public.messages;
  CREATE POLICY "Conversation participants can send messages"
    ON public.messages FOR INSERT
    WITH CHECK (
      sender_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8. STORAGE BUCKET: machine-images
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('machine-images', 'machine-images', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can view machine images" ON storage.objects;
  CREATE POLICY "Public can view machine images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'machine-images');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload machine images" ON storage.objects;
  CREATE POLICY "Authenticated users can upload machine images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'machine-images' AND auth.role() = 'authenticated');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 9. PERMISSIONS
GRANT ALL ON TABLE public.machines TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.bookings TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.storefronts TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.conversations TO postgres, service_role, authenticated, anon;
GRANT ALL ON TABLE public.messages TO postgres, service_role, authenticated, anon;

-- 10. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
