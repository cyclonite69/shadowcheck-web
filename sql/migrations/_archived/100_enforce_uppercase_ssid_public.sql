-- Migration: Enforce UPPERCASE SSID across public schema tables
-- Ensures all SSIDs are stored in uppercase for consistency

BEGIN;

-- Step 1: Create trigger function for access_points table (latest_ssid column)
CREATE OR REPLACE FUNCTION public.uppercase_latest_ssid_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latest_ssid IS NOT NULL THEN
    NEW.latest_ssid = UPPER(NEW.latest_ssid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create trigger function for observations and ssid_history tables (ssid column)
CREATE OR REPLACE FUNCTION public.uppercase_ssid_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ssid IS NOT NULL THEN
    NEW.ssid = UPPER(NEW.ssid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger for access_points table
DROP TRIGGER IF EXISTS trigger_uppercase_latest_ssid ON public.access_points;
CREATE TRIGGER trigger_uppercase_latest_ssid
  BEFORE INSERT OR UPDATE OF latest_ssid ON public.access_points
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_latest_ssid_trigger();

-- Step 4: Create trigger for observations table
DROP TRIGGER IF EXISTS trigger_uppercase_ssid_observations ON public.observations;
CREATE TRIGGER trigger_uppercase_ssid_observations
  BEFORE INSERT OR UPDATE OF ssid ON public.observations
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_ssid_trigger();

-- Step 5: Create trigger for ssid_history table
DROP TRIGGER IF EXISTS trigger_uppercase_ssid_history ON public.ssid_history;
CREATE TRIGGER trigger_uppercase_ssid_history
  BEFORE INSERT OR UPDATE OF ssid ON public.ssid_history
  FOR EACH ROW
  EXECUTE FUNCTION public.uppercase_ssid_trigger();

-- Step 6: Update existing SSIDs to uppercase in access_points
UPDATE public.access_points
SET latest_ssid = UPPER(latest_ssid)
WHERE latest_ssid IS NOT NULL
  AND latest_ssid != UPPER(latest_ssid);

-- Step 7: Update ssid_variants array to uppercase in access_points
UPDATE public.access_points
SET ssid_variants = ARRAY(
  SELECT DISTINCT UPPER(variant)
  FROM unnest(ssid_variants) AS variant
  ORDER BY UPPER(variant)
)
WHERE ssid_variants IS NOT NULL
  AND array_length(ssid_variants, 1) > 0
  AND EXISTS (
    SELECT 1 FROM unnest(ssid_variants) AS variant
    WHERE variant != UPPER(variant)
  );

-- Step 8: Update existing SSIDs to uppercase in observations
UPDATE public.observations
SET ssid = UPPER(ssid)
WHERE ssid IS NOT NULL
  AND ssid != UPPER(ssid);

-- Step 9: Update existing SSIDs to uppercase in ssid_history
UPDATE public.ssid_history
SET ssid = UPPER(ssid)
WHERE ssid IS NOT NULL
  AND ssid != UPPER(ssid);

-- Step 10: Create indexes for faster SSID searches (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_access_points_latest_ssid ON public.access_points(latest_ssid);
CREATE INDEX IF NOT EXISTS idx_observations_ssid ON public.observations(ssid);
CREATE INDEX IF NOT EXISTS idx_ssid_history_ssid ON public.ssid_history(ssid);

-- Add comments
COMMENT ON FUNCTION public.uppercase_latest_ssid_trigger() IS 'Automatically converts latest_ssid to uppercase before insert/update in access_points';
COMMENT ON FUNCTION public.uppercase_ssid_trigger() IS 'Automatically converts ssid to uppercase before insert/update';
COMMENT ON TRIGGER trigger_uppercase_latest_ssid ON public.access_points IS 'Ensures latest_ssid is always uppercase';
COMMENT ON TRIGGER trigger_uppercase_ssid_observations ON public.observations IS 'Ensures ssid is always uppercase';
COMMENT ON TRIGGER trigger_uppercase_ssid_history ON public.ssid_history IS 'Ensures ssid is always uppercase';

COMMIT;

-- Print summary
DO $$
DECLARE
  ap_count INTEGER;
  obs_count INTEGER;
  hist_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ap_count FROM public.access_points WHERE latest_ssid IS NOT NULL;
  SELECT COUNT(*) INTO obs_count FROM public.observations WHERE ssid IS NOT NULL;
  SELECT COUNT(*) INTO hist_count FROM public.ssid_history WHERE ssid IS NOT NULL;

  RAISE NOTICE '✓ SSID Uppercase Migration Complete (public schema):';
  RAISE NOTICE '  - access_points.latest_ssid: % rows', ap_count;
  RAISE NOTICE '  - observations.ssid: % rows', obs_count;
  RAISE NOTICE '  - ssid_history.ssid: % rows', hist_count;
  RAISE NOTICE '  - Triggers installed on all tables';
  RAISE NOTICE '  - All future SSIDs will be automatically uppercased';
END $$;
