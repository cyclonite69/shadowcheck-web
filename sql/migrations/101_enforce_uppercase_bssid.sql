-- Migration: Enforce UPPERCASE BSSID (MAC addresses)
-- Ensures all BSSIDs are stored in uppercase for consistency

BEGIN;

-- Step 1: Create trigger function for BSSID uppercase
CREATE OR REPLACE FUNCTION public.uppercase_bssid_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bssid IS NOT NULL THEN
    NEW.bssid = UPPER(NEW.bssid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger for access_points table
DROP TRIGGER IF EXISTS trigger_uppercase_bssid_access_points ON public.access_points;
CREATE TRIGGER trigger_uppercase_bssid_access_points
  BEFORE INSERT OR UPDATE OF bssid ON public.access_points
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_bssid_trigger();

-- Step 3: Create trigger for observations table
DROP TRIGGER IF EXISTS trigger_uppercase_bssid_observations ON public.observations;
CREATE TRIGGER trigger_uppercase_bssid_observations
  BEFORE INSERT OR UPDATE OF bssid ON public.observations
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_bssid_trigger();

-- Step 4: Create trigger for ssid_history table
DROP TRIGGER IF EXISTS trigger_uppercase_bssid_history ON public.ssid_history;
CREATE TRIGGER trigger_uppercase_bssid_history
  BEFORE INSERT OR UPDATE OF bssid ON public.ssid_history
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_bssid_trigger();

-- Step 5: Temporarily disable foreign key constraints
ALTER TABLE public.observations DROP CONSTRAINT IF EXISTS fk_obs_bssid;
ALTER TABLE public.ssid_history DROP CONSTRAINT IF EXISTS ssid_history_bssid_fkey;

-- Step 6: Update all BSSIDs to uppercase
UPDATE public.access_points
SET bssid = UPPER(bssid)
WHERE bssid != UPPER(bssid);

UPDATE public.observations
SET bssid = UPPER(bssid)
WHERE bssid != UPPER(bssid);

UPDATE public.ssid_history
SET bssid = UPPER(bssid)
WHERE bssid != UPPER(bssid);

-- Step 7: Re-enable foreign key constraints
ALTER TABLE public.observations
  ADD CONSTRAINT fk_obs_bssid
  FOREIGN KEY (bssid)
  REFERENCES public.access_points(bssid)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.ssid_history
  ADD CONSTRAINT ssid_history_bssid_fkey
  FOREIGN KEY (bssid)
  REFERENCES public.access_points(bssid);

-- Add comments
COMMENT ON FUNCTION public.uppercase_bssid_trigger() IS 'Automatically converts BSSID (MAC address) to uppercase before insert/update';
COMMENT ON TRIGGER trigger_uppercase_bssid_access_points ON public.access_points IS 'Ensures BSSID is always uppercase';
COMMENT ON TRIGGER trigger_uppercase_bssid_observations ON public.observations IS 'Ensures BSSID is always uppercase';
COMMENT ON TRIGGER trigger_uppercase_bssid_history ON public.ssid_history IS 'Ensures BSSID is always uppercase';

COMMIT;

-- Print summary
DO $$
DECLARE
  ap_count INTEGER;
  obs_count INTEGER;
  hist_count INTEGER;
  ap_lower INTEGER;
  obs_lower INTEGER;
  hist_lower INTEGER;
BEGIN
  SELECT COUNT(*) INTO ap_count FROM public.access_points;
  SELECT COUNT(*) INTO obs_count FROM public.observations;
  SELECT COUNT(*) INTO hist_count FROM public.ssid_history;

  SELECT COUNT(*) INTO ap_lower FROM public.access_points WHERE bssid != UPPER(bssid);
  SELECT COUNT(*) INTO obs_lower FROM public.observations WHERE bssid != UPPER(bssid);
  SELECT COUNT(*) INTO hist_lower FROM public.ssid_history WHERE bssid != UPPER(bssid);

  RAISE NOTICE '✓ BSSID Uppercase Migration Complete:';
  RAISE NOTICE '  - access_points: % total, % lowercase remaining', ap_count, ap_lower;
  RAISE NOTICE '  - observations: % total, % lowercase remaining', obs_count, obs_lower;
  RAISE NOTICE '  - ssid_history: % total, % lowercase remaining', hist_count, hist_lower;
  RAISE NOTICE '  - Triggers installed on all tables';
  RAISE NOTICE '  - All future BSSIDs will be automatically uppercased';
END $$;
