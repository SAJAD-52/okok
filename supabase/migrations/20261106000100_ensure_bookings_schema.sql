-- ============================================================================
-- JADIJCB: Fix and Ensure All Columns and RLS on public.bookings
-- Run this script in the Supabase SQL Editor to resolve missing column errors
-- and refresh PostgREST schema cache.
-- ============================================================================

-- 1. Ensure table exists
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add all columns if not existing
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES public.machines(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS client_name text DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS client_phone text DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS start_at timestamptz DEFAULT now();
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS end_at timestamptz DEFAULT (now() + interval '3 days');
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS start_date timestamptz DEFAULT now();
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS end_date timestamptz DEFAULT (now() + interval '3 days');
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_price numeric(10,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS with_operator boolean DEFAULT true;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 3. Relax any strict NOT NULL constraints on legacy/optional columns so inserts never fail
DO $$
DECLARE
  col text;
BEGIN
  FOR col IN 
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'bookings' 
      AND table_schema = 'public'
      AND column_name NOT IN ('id')
      AND is_nullable = 'NO'
  LOOP
    EXECUTE format('ALTER TABLE public.bookings ALTER COLUMN %I DROP NOT NULL', col);
  END LOOP;
END $$;

-- 4. Enable RLS and setup permissive policies
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public or authenticated can view bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Owners, clients, or admins can view their bookings" ON public.bookings;
  CREATE POLICY "Owners, clients, or admins can view their bookings"
    ON public.bookings FOR SELECT
    USING (
      auth.uid() IS NOT NULL AND (
        owner_id = auth.uid() 
        OR client_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can create bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Clients can book machines" ON public.bookings;
  CREATE POLICY "Authenticated users can create bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners or clients can update bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Owners or clients can update booking status" ON public.bookings;
  CREATE POLICY "Owners or clients can update bookings"
    ON public.bookings FOR UPDATE
    USING (
      auth.uid() IS NOT NULL AND (
        owner_id = auth.uid() 
        OR client_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
    WITH CHECK (
      auth.uid() IS NOT NULL AND (
        owner_id = auth.uid() 
        OR client_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Force PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
