-- Create app.network_locations table to store precomputed coordinate estimates.
-- Centroid and weighted_centroid are computed from quality-filtered observations only
-- (is_quality_filtered = false OR is_quality_filtered IS NULL), matching the MV criterion.
--
-- centroid_lat/lon     : unweighted mean of all quality-filtered observation coords
-- weighted_lat/lon     : signal-strength weighted mean (stronger signal = higher weight,
--                        since stronger signal = physically closer to AP)
-- obs_count            : number of quality-filtered observations used for the calculation
-- last_computed_at     : timestamp of last refresh

CREATE TABLE IF NOT EXISTS app.network_locations (
    bssid                text        PRIMARY KEY,
    centroid_lat         double precision,
    centroid_lon         double precision,
    weighted_lat         double precision,
    weighted_lon         double precision,
    obs_count            integer     NOT NULL DEFAULT 0,
    last_computed_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_locations_bssid
    ON app.network_locations (bssid);

CREATE INDEX IF NOT EXISTS idx_network_locations_bssid_upper
    ON app.network_locations (UPPER(bssid));

GRANT SELECT ON app.network_locations TO shadowcheck_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.network_locations TO shadowcheck_admin;
