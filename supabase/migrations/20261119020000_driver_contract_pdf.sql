-- ============================================================================
-- JADIJCB: Add contract_data JSONB column to driver_job_offers
-- Stores the negotiated & mutually agreed PDF work contract data
-- ============================================================================

ALTER TABLE public.driver_job_offers
  ADD COLUMN IF NOT EXISTS contract_data JSONB;

COMMENT ON COLUMN public.driver_job_offers.contract_data IS
  'Mutually reviewed & signed PDF work contract metadata between owner and driver';
