-- Backfill altitude columns on app.networks from app.observations.
-- These columns were added by 20260329_add_missing_network_columns.sql but never populated.
-- Observations have altitude data (606k rows with valid altitude); this computes per-network
-- min/max/span/last from the valid altitude range -500..10000m.

UPDATE app.networks n
SET
  min_altitude_m     = agg.min_alt,
  max_altitude_m     = agg.max_alt,
  altitude_span_m    = agg.max_alt - agg.min_alt,
  last_altitude_m    = agg.last_alt
FROM (
  SELECT
    bssid,
    MIN(altitude)  AS min_alt,
    MAX(altitude)  AS max_alt,
    (array_agg(altitude ORDER BY "time" DESC))[1] AS last_alt
  FROM app.observations
  WHERE altitude IS NOT NULL
    AND altitude BETWEEN -500 AND 10000
  GROUP BY bssid
) agg
WHERE n.bssid = agg.bssid;
