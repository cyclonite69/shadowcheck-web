-- Migration: Add Minimum Required Columns for server.js Compatibility
-- Only adds fields that server.js explicitly queries (based on grep analysis)
-- Date: 2025-12-03

-- ============================================================================
-- PART 1: ALTER TABLES - Add Missing Columns
-- ============================================================================

-- Add missing columns to app.networks
ALTER TABLE app.networks
  ADD COLUMN IF NOT EXISTS bestlevel INTEGER,
  ADD COLUMN IF NOT EXISTS bestlat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS bestlon NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS lasttime BIGINT,
  ADD COLUMN IF NOT EXISTS unified_id BIGSERIAL,
  ADD COLUMN IF NOT EXISTS lastlat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS lastlon NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS trilaterated_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS trilaterated_lon NUMERIC(10, 7);

-- Add missing columns to app.observations (if needed)
ALTER TABLE app.observations
  ADD COLUMN IF NOT EXISTS unified_id BIGINT;

-- ============================================================================
-- PART 2: MIGRATE DATA - Populate New Columns from Existing Data
-- ============================================================================

-- Populate networks columns from existing data
UPDATE app.networks SET
  -- Signal: bestlevel = max_signal (or calculate from observations)
  bestlevel = COALESCE(max_signal, 0),

  -- Location: best* = current location (only if valid)
  bestlat = CASE
    WHEN latitude IS NOT NULL
      AND latitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
      AND latitude BETWEEN -90 AND 90
    THEN latitude
    ELSE NULL
  END,
  bestlon = CASE
    WHEN longitude IS NOT NULL
      AND longitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
      AND longitude BETWEEN -180 AND 180
    THEN longitude
    ELSE NULL
  END,
  lastlat = CASE
    WHEN latitude IS NOT NULL
      AND latitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
      AND latitude BETWEEN -90 AND 90
    THEN latitude
    ELSE NULL
  END,
  lastlon = CASE
    WHEN longitude IS NOT NULL
      AND longitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
      AND longitude BETWEEN -180 AND 180
    THEN longitude
    ELSE NULL
  END,

  -- Time: Convert TIMESTAMPTZ to Unix epoch milliseconds
  lasttime = CASE
    WHEN last_seen IS NOT NULL
    THEN EXTRACT(EPOCH FROM last_seen)::BIGINT * 1000
    ELSE EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
  END
WHERE bestlevel IS NULL OR bestlat IS NULL OR lasttime IS NULL;

-- Update bestlevel from observations if networks.max_signal is NULL/0
UPDATE app.networks n
SET bestlevel = subq.max_signal
FROM (
  SELECT bssid, MAX(signal_dbm)::INTEGER as max_signal
  FROM app.observations
  WHERE signal_dbm IS NOT NULL
  GROUP BY bssid
) subq
WHERE n.bssid = subq.bssid
  AND (n.bestlevel IS NULL OR n.bestlevel = 0)
  AND subq.max_signal IS NOT NULL;

-- Update location from most recent observation if networks location is NULL
UPDATE app.networks n
SET
  bestlat = subq.latitude,
  bestlon = subq.longitude,
  lastlat = subq.latitude,
  lastlon = subq.longitude
FROM (
  SELECT DISTINCT ON (bssid)
    bssid, latitude, longitude
  FROM app.observations
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    AND latitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
    AND longitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
    AND latitude BETWEEN -90 AND 90
    AND longitude BETWEEN -180 AND 180
  ORDER BY bssid, observed_at DESC
) subq
WHERE n.bssid = subq.bssid
  AND (n.bestlat IS NULL OR n.bestlon IS NULL);

-- ============================================================================
-- PART 3: CREATE INDEXES - Only on Frequently Queried Columns
-- ============================================================================

-- Index on bssid (already exists as PK, but ensure it's optimized)
CREATE INDEX IF NOT EXISTS idx_networks_bssid_text ON app.networks(bssid);

-- Index on type for filtering (W, E, B, L, N, G)
CREATE INDEX IF NOT EXISTS idx_networks_type ON app.networks(type) WHERE type IS NOT NULL;

-- Index on bestlevel for signal queries
CREATE INDEX IF NOT EXISTS idx_networks_bestlevel ON app.networks(bestlevel) WHERE bestlevel IS NOT NULL AND bestlevel != 0;

-- Index on capabilities for security parsing
CREATE INDEX IF NOT EXISTS idx_networks_capabilities ON app.networks(capabilities) WHERE capabilities IS NOT NULL;

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_networks_type_bestlevel ON app.networks(type, bestlevel)
  WHERE type IS NOT NULL AND bestlevel IS NOT NULL AND bestlevel != 0;

-- ============================================================================
-- PART 4: UPDATE TRIGGERS - Keep Auto-Population Working
-- ============================================================================

-- Update the network upsert trigger to populate new columns
CREATE OR REPLACE FUNCTION app.upsert_network_from_observation()
RETURNS TRIGGER AS $$
DECLARE
    valid_lat NUMERIC(10, 7);
    valid_lon NUMERIC(10, 7);
BEGIN
    -- Validate and sanitize coordinates
    valid_lat := CASE
        WHEN NEW.latitude IS NOT NULL
            AND NEW.latitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
            AND NEW.latitude BETWEEN -90 AND 90
        THEN NEW.latitude
        ELSE NULL
    END;

    valid_lon := CASE
        WHEN NEW.longitude IS NOT NULL
            AND NEW.longitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
            AND NEW.longitude BETWEEN -180 AND 180
        THEN NEW.longitude
        ELSE NULL
    END;

    INSERT INTO app.networks (
        bssid, ssid, first_seen, last_seen,
        latitude, longitude, location,
        max_signal, bestlevel, bestlat, bestlon, lastlat, lastlon,
        lasttime, frequency, type
    )
    VALUES (
        UPPER(NEW.bssid),
        NULL, -- SSID enriched later
        NEW.observed_at,
        NEW.observed_at,
        valid_lat,
        valid_lon,
        NEW.location,
        NEW.signal_dbm::INTEGER,
        NEW.signal_dbm::INTEGER,  -- bestlevel
        valid_lat,              -- bestlat
        valid_lon,             -- bestlon
        valid_lat,              -- lastlat
        valid_lon,             -- lastlon
        EXTRACT(EPOCH FROM NEW.observed_at)::BIGINT * 1000,  -- lasttime
        CASE
            WHEN NEW.radio_metadata->>'frequency' IS NOT NULL
            THEN (NEW.radio_metadata->>'frequency')::numeric
            ELSE NULL
        END,
        NEW.radio_type::TEXT  -- type
    )
    ON CONFLICT (bssid) DO UPDATE SET
        last_seen = GREATEST(networks.last_seen, EXCLUDED.last_seen),
        first_seen = LEAST(networks.first_seen, EXCLUDED.first_seen),

        -- Update max_signal and bestlevel together
        max_signal = CASE
            WHEN networks.max_signal IS NULL THEN EXCLUDED.max_signal
            WHEN EXCLUDED.max_signal IS NULL THEN networks.max_signal
            ELSE GREATEST(networks.max_signal, EXCLUDED.max_signal)
        END,
        bestlevel = CASE
            WHEN networks.bestlevel IS NULL THEN EXCLUDED.bestlevel
            WHEN EXCLUDED.bestlevel IS NULL THEN networks.bestlevel
            ELSE GREATEST(networks.bestlevel, EXCLUDED.bestlevel)
        END,

        -- Update location if this observation is newer and has valid coordinates
        latitude = CASE
            WHEN EXCLUDED.last_seen > networks.last_seen AND EXCLUDED.latitude IS NOT NULL
            THEN EXCLUDED.latitude
            ELSE networks.latitude
        END,
        longitude = CASE
            WHEN EXCLUDED.last_seen > networks.last_seen AND EXCLUDED.longitude IS NOT NULL
            THEN EXCLUDED.longitude
            ELSE networks.longitude
        END,
        location = CASE
            WHEN EXCLUDED.last_seen > networks.last_seen THEN EXCLUDED.location
            ELSE networks.location
        END,

        -- Update best* fields (only if valid)
        bestlat = CASE
            WHEN EXCLUDED.last_seen > networks.last_seen AND EXCLUDED.bestlat IS NOT NULL
            THEN EXCLUDED.bestlat
            ELSE networks.bestlat
        END,
        bestlon = CASE
            WHEN EXCLUDED.last_seen > networks.last_seen AND EXCLUDED.bestlon IS NOT NULL
            THEN EXCLUDED.bestlon
            ELSE networks.bestlon
        END,
        lastlat = CASE
            WHEN EXCLUDED.last_seen > networks.last_seen AND EXCLUDED.lastlat IS NOT NULL
            THEN EXCLUDED.lastlat
            ELSE networks.lastlat
        END,
        lastlon = CASE
            WHEN EXCLUDED.last_seen > networks.last_seen AND EXCLUDED.lastlon IS NOT NULL
            THEN EXCLUDED.lastlon
            ELSE networks.lastlon
        END,

        -- Update lasttime (Unix epoch ms)
        lasttime = CASE
            WHEN EXCLUDED.last_seen > networks.last_seen THEN EXCLUDED.lasttime
            ELSE networks.lasttime
        END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 5: VALIDATION QUERIES
-- ============================================================================

-- Check that all networks have required fields populated
DO $$
DECLARE
    null_bestlevel_count INTEGER;
    null_location_count INTEGER;
    null_lasttime_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_bestlevel_count FROM app.networks WHERE bestlevel IS NULL;
    SELECT COUNT(*) INTO null_location_count FROM app.networks WHERE bestlat IS NULL OR bestlon IS NULL;
    SELECT COUNT(*) INTO null_lasttime_count FROM app.networks WHERE lasttime IS NULL;

    RAISE NOTICE 'Migration Validation:';
    RAISE NOTICE '  Networks with NULL bestlevel: %', null_bestlevel_count;
    RAISE NOTICE '  Networks with NULL location: %', null_location_count;
    RAISE NOTICE '  Networks with NULL lasttime: %', null_lasttime_count;

    IF null_bestlevel_count > 0 THEN
        RAISE WARNING 'Some networks still have NULL bestlevel - may need manual review';
    END IF;
END $$;

-- Display sample of migrated data
SELECT
    bssid,
    ssid,
    type,
    bestlevel,
    max_signal,
    bestlat,
    bestlon,
    lasttime,
    last_seen
FROM app.networks
WHERE bestlevel IS NOT NULL
LIMIT 5;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary
SELECT
    'Networks' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN bestlevel IS NOT NULL THEN 1 END) as has_bestlevel,
    COUNT(CASE WHEN bestlat IS NOT NULL AND bestlon IS NOT NULL THEN 1 END) as has_location,
    COUNT(CASE WHEN lasttime IS NOT NULL THEN 1 END) as has_lasttime
FROM app.networks
UNION ALL
SELECT
    'Observations' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN bssid IS NOT NULL THEN 1 END) as has_bssid,
    COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as has_location,
    COUNT(CASE WHEN observed_at IS NOT NULL THEN 1 END) as has_time
FROM app.observations;
