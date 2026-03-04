-- Threat Model v4.1: Co-occurrence Detection
-- Purpose: Detect networks that appear together at multiple locations (coordinated surveillance)

-- Step 1: Create co-occurrence tracking table
CREATE TABLE IF NOT EXISTS app.network_cooccurrence (
    bssid1 VARCHAR(17) NOT NULL,
    bssid2 VARCHAR(17) NOT NULL,
    cooccurrence_count INT NOT NULL DEFAULT 0,
    locations_count INT NOT NULL DEFAULT 0,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (bssid1, bssid2),
    CHECK (bssid1 < bssid2)  -- Ensure consistent ordering
);

CREATE INDEX IF NOT EXISTS idx_cooccurrence_bssid1 ON app.network_cooccurrence(bssid1);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_bssid2 ON app.network_cooccurrence(bssid2);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_count ON app.network_cooccurrence(cooccurrence_count DESC);

COMMENT ON TABLE app.network_cooccurrence IS 
'Tracks networks that appear together at multiple locations for coordinated surveillance detection';

-- Step 2: Populate co-occurrence data
INSERT INTO app.network_cooccurrence (bssid1, bssid2, cooccurrence_count, locations_count, first_seen, last_seen)
WITH network_pairs AS (
    SELECT 
        LEAST(o1.bssid, o2.bssid) AS bssid1,
        GREATEST(o1.bssid, o2.bssid) AS bssid2,
        ST_SnapToGrid(o1.geom, 0.0001) AS grid_point,  -- ~10m grid
        LEAST(o1.time, o2.time) AS seen_at
    FROM app.observations o1
    JOIN app.observations o2 
        ON ST_DWithin(o1.geom::geography, o2.geom::geography, 50)  -- Within 50m
        AND ABS(EXTRACT(EPOCH FROM (o1.time - o2.time))) <= 300  -- Within 5 minutes
    WHERE o1.bssid < o2.bssid
    AND LENGTH(o1.bssid) <= 17
    AND LENGTH(o2.bssid) <= 17
    GROUP BY LEAST(o1.bssid, o2.bssid), GREATEST(o1.bssid, o2.bssid), ST_SnapToGrid(o1.geom, 0.0001), LEAST(o1.time, o2.time)
)
SELECT 
    bssid1,
    bssid2,
    COUNT(*) AS cooccurrence_count,
    COUNT(DISTINCT grid_point) AS locations_count,
    MIN(seen_at) AS first_seen,
    MAX(seen_at) AS last_seen
FROM network_pairs
GROUP BY bssid1, bssid2
HAVING COUNT(DISTINCT grid_point) >= 3  -- At least 3 shared locations
ON CONFLICT (bssid1, bssid2) DO UPDATE SET
    cooccurrence_count = EXCLUDED.cooccurrence_count,
    locations_count = EXCLUDED.locations_count,
    first_seen = EXCLUDED.first_seen,
    last_seen = EXCLUDED.last_seen,
    updated_at = NOW();

SELECT 'Co-occurrence table populated' AS status;
SELECT 
    COUNT(*) AS total_pairs,
    COUNT(*) FILTER (WHERE cooccurrence_count >= 10) AS high_cooccurrence,
    MAX(cooccurrence_count) AS max_cooccurrence
FROM app.network_cooccurrence;
