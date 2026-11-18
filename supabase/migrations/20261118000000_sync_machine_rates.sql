-- Ensure dual machine rate columns exist and synchronize existing & future rows
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS daily_rate numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS weekly_rate numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS rate_hourly numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS rate_daily numeric(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS rate_weekly numeric(10,2);

-- Backfill existing machines so whichever column holds the entered rate populates both
UPDATE public.machines
SET
  daily_rate  = COALESCE(NULLIF(daily_rate, 0), NULLIF(rate_daily, 0), 0),
  rate_daily  = COALESCE(NULLIF(rate_daily, 0), NULLIF(daily_rate, 0), 0),
  hourly_rate = COALESCE(NULLIF(hourly_rate, 0), NULLIF(rate_hourly, 0), 0),
  rate_hourly = COALESCE(NULLIF(rate_hourly, 0), NULLIF(hourly_rate, 0), 0),
  weekly_rate = COALESCE(NULLIF(weekly_rate, 0), NULLIF(rate_weekly, 0), 0),
  rate_weekly = COALESCE(NULLIF(rate_weekly, 0), NULLIF(weekly_rate, 0), 0)
WHERE
  COALESCE(daily_rate, 0) <> COALESCE(rate_daily, 0)
  OR COALESCE(hourly_rate, 0) <> COALESCE(rate_hourly, 0)
  OR COALESCE(weekly_rate, 0) <> COALESCE(rate_weekly, 0)
  OR daily_rate IS NULL
  OR rate_daily IS NULL;

-- Trigger to keep both naming conventions synchronized on future inserts/updates
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
  ELSE
    NEW.daily_rate  := COALESCE(NULLIF(NEW.daily_rate, 0), NULLIF(NEW.rate_daily, 0), 0);
    NEW.rate_daily  := NEW.daily_rate;
    NEW.hourly_rate := COALESCE(NULLIF(NEW.hourly_rate, 0), NULLIF(NEW.rate_hourly, 0), 0);
    NEW.rate_hourly := NEW.hourly_rate;
    NEW.weekly_rate := COALESCE(NULLIF(NEW.weekly_rate, 0), NULLIF(NEW.rate_weekly, 0), 0);
    NEW.rate_weekly := NEW.weekly_rate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_machine_rate_columns ON public.machines;
CREATE TRIGGER trg_sync_machine_rate_columns
BEFORE INSERT OR UPDATE ON public.machines
FOR EACH ROW
EXECUTE FUNCTION public.sync_machine_rate_columns();
