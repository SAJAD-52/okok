-- ============================================================================
-- JADIJCB: Fix Bookings Owner RLS & Machine-Level Access
-- Ensures equipment owners always receive and manage bookings for their machines,
-- even if owner_id was initially null, mismatched, or submitted via external forms.
-- ============================================================================

-- 1. Ensure columns exist on bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rate_type text DEFAULT 'daily';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS fuel_included boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS delivery_requested boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS site_address text DEFAULT '';

-- 2. Backfill owner_id on any bookings where machine belongs to an owner
UPDATE public.bookings b
SET owner_id = m.owner_id
FROM public.machines m
WHERE b.machine_id = m.id
  AND m.owner_id IS NOT NULL
  AND (b.owner_id IS NULL OR b.owner_id <> m.owner_id);

-- 3. Update SELECT policy on public.bookings
-- Allows access if:
--   a) user is explicitly the owner_id
--   b) OR the booked machine belongs to the user (catches all contractor requests)
--   c) OR user is the client who booked
--   d) OR user is Super Admin
DROP POLICY IF EXISTS "Owners, clients, or admins can view their bookings" ON public.bookings;
CREATE POLICY "Owners, clients, or admins can view their bookings"
  ON public.bookings FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      owner_id = auth.uid() 
      OR machine_id IN (SELECT id FROM public.machines WHERE owner_id = auth.uid())
      OR client_id = auth.uid() 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- 4. Update UPDATE policy on public.bookings
DROP POLICY IF EXISTS "Owners or clients can update bookings" ON public.bookings;
CREATE POLICY "Owners or clients can update bookings"
  ON public.bookings FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      owner_id = auth.uid() 
      OR machine_id IN (SELECT id FROM public.machines WHERE owner_id = auth.uid())
      OR client_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      owner_id = auth.uid() 
      OR machine_id IN (SELECT id FROM public.machines WHERE owner_id = auth.uid())
      OR client_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- 5. Force PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
