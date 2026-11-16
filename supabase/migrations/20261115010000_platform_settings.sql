-- ============================================================================
-- JADIJCB: Dynamic Platform Settings Table & Admin RLS
-- Migration: 20261115010000_platform_settings.sql
-- ============================================================================

-- Ensure self-contained admin helper exists
CREATE OR REPLACE FUNCTION public.rls_is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'admin'
    ) THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN false;
END;
$$;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id text PRIMARY KEY DEFAULT 'global_settings',
  monthly_price_mad numeric NOT NULL DEFAULT 200,
  trial_duration_hours integer NOT NULL DEFAULT 72,
  bank_name text NOT NULL DEFAULT 'Attijariwafa Bank (التجاري وفا بنك)',
  rib_number text NOT NULL DEFAULT '',
  account_holder_name text NOT NULL DEFAULT 'JADIJCB MAROC',
  cin_number text NOT NULL DEFAULT '',
  whatsapp_number text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT 'Casablanca (الدار البيضاء)',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can read platform settings" ON public.platform_settings;
  CREATE POLICY "Public can read platform settings"
    ON public.platform_settings FOR SELECT
    USING (true);

  DROP POLICY IF EXISTS "Admins can insert platform settings" ON public.platform_settings;
  CREATE POLICY "Admins can insert platform settings"
    ON public.platform_settings FOR INSERT
    WITH CHECK (public.rls_is_admin());

  DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;
  CREATE POLICY "Admins can update platform settings"
    ON public.platform_settings FOR UPDATE
    USING (public.rls_is_admin())
    WITH CHECK (public.rls_is_admin());

  DROP POLICY IF EXISTS "Admins can delete platform settings" ON public.platform_settings;
  CREATE POLICY "Admins can delete platform settings"
    ON public.platform_settings FOR DELETE
    USING (public.rls_is_admin());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Seed single global settings row if not present (admin configures real RIB/CIN/WhatsApp in /admin)
INSERT INTO public.platform_settings (
  id,
  monthly_price_mad,
  trial_duration_hours,
  bank_name,
  rib_number,
  account_holder_name,
  cin_number,
  whatsapp_number,
  city
)
VALUES (
  'global_settings',
  200,
  72,
  'Attijariwafa Bank (التجاري وفا بنك)',
  '',
  'JADIJCB MAROC',
  '',
  '',
  'Casablanca (الدار البيضاء)'
)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON TABLE public.platform_settings TO anon, authenticated;
GRANT ALL ON TABLE public.platform_settings TO postgres, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.platform_settings TO authenticated;

NOTIFY pgrst, 'reload schema';
