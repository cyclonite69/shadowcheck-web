-- Migration: Create Triggers for Network Aggregation Fields
-- Purpose: Auto-calculate first_seen, last_seen, observation counts, signal stats
-- Date: 2025-11-23

BEGIN;

-- ============================================================================
-- TRIGGER 1: Update network aggregates when location is inserted
-- ============================================================================

CREATE OR REPLACE FUNCTION update_network_from_location()
RETURNS TRIGGER AS $$
DECLARE
  current_obs_count INTEGER;
  current_signal_sum NUMERIC;
  current_signal_count INTEGER;
BEGIN
  -- Update networks_legacy with aggregated data from this new location
  UPDATE app.networks_legacy n
  SET
    -- Update last seen time (most recent observation)
    lasttime = GREATEST(COALESCE(n.lasttime, 0), COALESCE(NEW.time, 0)),
    last_seen = CASE 
      WHEN NEW.time IS NOT NULL THEN to_timestamp(NEW.time / 1000.0)
      ELSE n.last_seen
    END,
    
    -- Set first seen if NULL (earliest observation)
    first_seen = CASE
      WHEN n.first_seen IS NULL AND NEW.time IS NOT NULL THEN to_timestamp(NEW.time / 1000.0)
      ELSE n.first_seen
    END,
    
    -- Increment observation count
    observation_count_staging = COALESCE(n.observation_count_staging, 0) + 1,
    
    -- Update signal statistics
    signal_min = CASE
      WHEN NEW.level IS NOT NULL THEN LEAST(COALESCE(n.signal_min, NEW.level), NEW.level)
      ELSE n.signal_min
    END,
    
    signal_max = CASE
      WHEN NEW.level IS NOT NULL THEN GREATEST(COALESCE(n.signal_max, NEW.level), NEW.level)
      ELSE n.signal_max
    END,
    
    -- Update best signal and location if this is stronger
    bestlevel = CASE
      WHEN NEW.level IS NOT NULL AND (n.bestlevel IS NULL OR NEW.level > n.bestlevel) THEN NEW.level
      ELSE n.bestlevel
    END,
    
    bestlat = CASE
      WHEN NEW.level IS NOT NULL AND NEW.lat IS NOT NULL AND (n.bestlevel IS NULL OR NEW.level > n.bestlevel) THEN NEW.lat
      ELSE n.bestlat
    END,
    
    bestlon = CASE
      WHEN NEW.level IS NOT NULL AND NEW.lon IS NOT NULL AND (n.bestlevel IS NULL OR NEW.level > n.bestlevel) THEN NEW.lon
      ELSE n.bestlon
    END,
    
    -- Update timestamp
    last_update = NOW()
    
  WHERE n.bssid = NEW.bssid;
  
  -- Calculate signal average (requires separate query for accuracy)
  IF NEW.level IS NOT NULL THEN
    UPDATE app.networks_legacy n
    SET signal_avg = (
      SELECT AVG(level)::NUMERIC(5,2)
      FROM app.locations_legacy
      WHERE bssid = NEW.bssid AND level IS NOT NULL
    )
    WHERE n.bssid = NEW.bssid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and create trigger
DROP TRIGGER IF EXISTS trigger_update_network_from_location ON app.locations_legacy;
CREATE TRIGGER trigger_update_network_from_location
  AFTER INSERT ON app.locations_legacy
  FOR EACH ROW
  EXECUTE FUNCTION update_network_from_location();

-- ============================================================================
-- TRIGGER 2: Update timestamp on network modification
-- ============================================================================

CREATE OR REPLACE FUNCTION update_network_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_update := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and create trigger
DROP TRIGGER IF EXISTS trigger_update_network_timestamp ON app.networks_legacy;
CREATE TRIGGER trigger_update_network_timestamp
  BEFORE UPDATE ON app.networks_legacy
  FOR EACH ROW
  EXECUTE FUNCTION update_network_timestamp();

-- ============================================================================
-- ONE-TIME: Backfill existing data
-- ============================================================================

-- Update all networks with aggregated location data
UPDATE app.networks_legacy n
SET
  first_seen = subq.first_seen,
  last_seen = subq.last_seen,
  lasttime = subq.lasttime,
  observation_count_staging = subq.obs_count,
  signal_min = subq.signal_min,
  signal_max = subq.signal_max,
  signal_avg = subq.signal_avg,
  bestlevel = subq.best_level,
  bestlat = subq.best_lat,
  bestlon = subq.best_lon
FROM (
  SELECT
    bssid,
    to_timestamp(MIN(time) / 1000.0) as first_seen,
    to_timestamp(MAX(time) / 1000.0) as last_seen,
    MAX(time) as lasttime,
    COUNT(*) as obs_count,
    MIN(level) as signal_min,
    MAX(level) as signal_max,
    AVG(level)::NUMERIC(5,2) as signal_avg,
    (ARRAY_AGG(level ORDER BY level DESC NULLS LAST))[1] as best_level,
    (ARRAY_AGG(lat ORDER BY level DESC NULLS LAST))[1] as best_lat,
    (ARRAY_AGG(lon ORDER BY level DESC NULLS LAST))[1] as best_lon
  FROM app.locations_legacy
  WHERE time IS NOT NULL
  GROUP BY bssid
) subq
WHERE n.bssid = subq.bssid;

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'Triggers created successfully!' as status;

SELECT 
  'Networks with first_seen' as metric,
  COUNT(*) as count
FROM app.networks_legacy 
WHERE first_seen IS NOT NULL;

SELECT 
  'Networks with last_seen' as metric,
  COUNT(*) as count
FROM app.networks_legacy 
WHERE last_seen IS NOT NULL;

SELECT 
  'Networks with observation counts' as metric,
  COUNT(*) as count
FROM app.networks_legacy 
WHERE observation_count_staging > 0;

SELECT 
  'Networks with signal stats' as metric,
  COUNT(*) as count
FROM app.networks_legacy 
WHERE signal_min IS NOT NULL;

COMMIT;

-- Summary
SELECT 'Migration completed! All triggers active and data backfilled.' as final_status;
