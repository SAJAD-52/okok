-- ============================================================================
-- JADIJCB: Machine Expenses, Breakdowns & Operating Costs Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.machine_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric(10,2) NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text,
  receipt_number text,
  vendor_name text,
  downtime_hours numeric(6,1) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.machine_expenses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owners can view their expenses" ON public.machine_expenses;
  CREATE POLICY "Owners can view their expenses" ON public.machine_expenses
    FOR SELECT USING (auth.uid() = owner_id);

  DROP POLICY IF EXISTS "Owners can insert expenses" ON public.machine_expenses;
  CREATE POLICY "Owners can insert expenses" ON public.machine_expenses
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

  DROP POLICY IF EXISTS "Owners can update expenses" ON public.machine_expenses;
  CREATE POLICY "Owners can update expenses" ON public.machine_expenses
    FOR UPDATE USING (auth.uid() = owner_id);

  DROP POLICY IF EXISTS "Owners can delete expenses" ON public.machine_expenses;
  CREATE POLICY "Owners can delete expenses" ON public.machine_expenses
    FOR DELETE USING (auth.uid() = owner_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
