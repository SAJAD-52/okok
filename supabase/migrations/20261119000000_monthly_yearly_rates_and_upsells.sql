-- Add Monthly & Yearly rental rates + Tiered Volume Discounts support to public.machines
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS monthly_rate numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS yearly_rate numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS rate_monthly numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS rate_yearly numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS upsell_addons jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS volume_discounts jsonb DEFAULT '[]'::jsonb;

-- Backfill monthly/yearly rates & volume_discounts if stored inside specs or either column convention
UPDATE public.machines
SET
  monthly_rate = COALESCE(NULLIF(monthly_rate, 0), NULLIF(rate_monthly, 0), NULLIF((specs->>'rate_monthly')::numeric, 0), 0),
  rate_monthly = COALESCE(NULLIF(rate_monthly, 0), NULLIF(monthly_rate, 0), NULLIF((specs->>'rate_monthly')::numeric, 0), 0),
  yearly_rate  = COALESCE(NULLIF(yearly_rate, 0), NULLIF(rate_yearly, 0), NULLIF((specs->>'rate_yearly')::numeric, 0), 0),
  rate_yearly  = COALESCE(NULLIF(rate_yearly, 0), NULLIF(yearly_rate, 0), NULLIF((specs->>'rate_yearly')::numeric, 0), 0),
  upsell_addons = COALESCE(NULLIF(upsell_addons, '[]'::jsonb), specs->'upsells', '[]'::jsonb),
  volume_discounts = COALESCE(NULLIF(volume_discounts, '[]'::jsonb), specs->'volume_discounts', '[]'::jsonb)
WHERE
  monthly_rate IS NULL OR rate_monthly IS NULL
  OR yearly_rate IS NULL OR rate_yearly IS NULL
  OR upsell_addons IS NULL
  OR volume_discounts IS NULL;

-- Expand sync trigger to cover monthly and yearly rate columns cleanly
CREATE OR REPLACE FUNCTION public.sync_machine_rate_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.rate_daily IS DISTINCT FROM OLD.rate_daily AND NEW.daily_rate IS NOT DISTINCT FROM OLD.daily_rate THEN
      NEW.daily_rate := NEW.rate_daily;
    ELSIF NEW.daily_rate IS DISTINCT FROM OLD.daily_rate AND NEW.rate_daily IS NOT DISTINCT FROM OLD.rate_daily THEN
      NEW.rate_daily := NEW.daily_rate;
    ELSE
      NEW.daily_rate := COALESCE(NULLIF(NEW.daily_rate, 0), NULLIF(NEW.rate_daily, 0), NEW.daily_rate, NEW.rate_daily, 0);
      NEW.rate_daily := NEW.daily_rate;
    END IF;

    IF NEW.rate_hourly IS DISTINCT FROM OLD.rate_hourly AND NEW.hourly_rate IS NOT DISTINCT FROM OLD.hourly_rate THEN
      NEW.hourly_rate := NEW.rate_hourly;
    ELSIF NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate AND NEW.rate_hourly IS NOT DISTINCT FROM OLD.rate_hourly THEN
      NEW.rate_hourly := NEW.hourly_rate;
    ELSE
      NEW.hourly_rate := COALESCE(NULLIF(NEW.hourly_rate, 0), NULLIF(NEW.rate_hourly, 0), NEW.hourly_rate, NEW.rate_hourly, 0);
      NEW.rate_hourly := NEW.hourly_rate;
    END IF;

    IF NEW.rate_weekly IS DISTINCT FROM OLD.rate_weekly AND NEW.weekly_rate IS NOT DISTINCT FROM OLD.weekly_rate THEN
      NEW.weekly_rate := NEW.rate_weekly;
    ELSIF NEW.weekly_rate IS DISTINCT FROM OLD.weekly_rate AND NEW.rate_weekly IS NOT DISTINCT FROM OLD.rate_weekly THEN
      NEW.rate_weekly := NEW.weekly_rate;
    ELSE
      NEW.weekly_rate := COALESCE(NULLIF(NEW.weekly_rate, 0), NULLIF(NEW.rate_weekly, 0), NEW.weekly_rate, NEW.rate_weekly, 0);
      NEW.rate_weekly := NEW.weekly_rate;
    END IF;

    IF NEW.rate_monthly IS DISTINCT FROM OLD.rate_monthly AND NEW.monthly_rate IS NOT DISTINCT FROM OLD.monthly_rate THEN
      NEW.monthly_rate := NEW.rate_monthly;
    ELSIF NEW.monthly_rate IS DISTINCT FROM OLD.monthly_rate AND NEW.rate_monthly IS NOT DISTINCT FROM OLD.rate_monthly THEN
      NEW.rate_monthly := NEW.monthly_rate;
    ELSE
      NEW.monthly_rate := COALESCE(NULLIF(NEW.monthly_rate, 0), NULLIF(NEW.rate_monthly, 0), NEW.monthly_rate, NEW.rate_monthly, 0);
      NEW.rate_monthly := NEW.monthly_rate;
    END IF;

    IF NEW.rate_yearly IS DISTINCT FROM OLD.rate_yearly AND NEW.yearly_rate IS NOT DISTINCT FROM OLD.yearly_rate THEN
      NEW.yearly_rate := NEW.rate_yearly;
    ELSIF NEW.yearly_rate IS DISTINCT FROM OLD.yearly_rate AND NEW.rate_yearly IS NOT DISTINCT FROM OLD.rate_yearly THEN
      NEW.rate_yearly := NEW.yearly_rate;
    ELSE
      NEW.yearly_rate := COALESCE(NULLIF(NEW.yearly_rate, 0), NULLIF(NEW.rate_yearly, 0), NEW.yearly_rate, NEW.rate_yearly, 0);
      NEW.rate_yearly := NEW.yearly_rate;
    END IF;
  ELSE
    NEW.daily_rate   := COALESCE(NULLIF(NEW.daily_rate, 0), NULLIF(NEW.rate_daily, 0), 0);
    NEW.rate_daily   := NEW.daily_rate;
    NEW.hourly_rate  := COALESCE(NULLIF(NEW.hourly_rate, 0), NULLIF(NEW.rate_hourly, 0), 0);
    NEW.rate_hourly  := NEW.hourly_rate;
    NEW.weekly_rate  := COALESCE(NULLIF(NEW.weekly_rate, 0), NULLIF(NEW.rate_weekly, 0), 0);
    NEW.rate_weekly  := NEW.weekly_rate;
    NEW.monthly_rate := COALESCE(NULLIF(NEW.monthly_rate, 0), NULLIF(NEW.rate_monthly, 0), 0);
    NEW.rate_monthly := NEW.monthly_rate;
    NEW.yearly_rate  := COALESCE(NULLIF(NEW.yearly_rate, 0), NULLIF(NEW.rate_yearly, 0), 0);
    NEW.rate_yearly  := NEW.yearly_rate;
  END IF;
  RETURN NEW;
END;
$$;
