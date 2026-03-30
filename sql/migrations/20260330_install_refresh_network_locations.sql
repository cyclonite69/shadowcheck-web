-- Install refresh_network_locations() and run initial population.
-- Must run after 20260330_create_network_locations.sql.
-- Function is inlined here because only sql/migrations/ is copied into the postgres container.

CREATE OR REPLACE FUNCTION app.refresh_network_locations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO app.network_locations (
    bssid,
    centroid_lat,
    centroid_lon,
    weighted_lat,
    weighted_lon,
    obs_count,
    last_computed_at
  )
  WITH bounds AS (
    SELECT
      bssid,
      MIN(level) AS min_level,
      MAX(level) AS max_level
    FROM app.observations
    WHERE lat   IS NOT NULL
      AND lon   IS NOT NULL
      AND level IS NOT NULL
      AND (is_quality_filtered = false OR is_quality_filtered IS NULL)
    GROUP BY bssid
  ),
  weighted AS (
    SELECT
      o.bssid,
      AVG(o.lat)  AS centroid_lat,
      AVG(o.lon)  AS centroid_lon,
      CASE
        WHEN b.max_level = b.min_level THEN AVG(o.lat)
        ELSE SUM(
               ((o.level - b.min_level)::double precision
                / NULLIF((b.max_level - b.min_level)::double precision, 0)
               ) * o.lat
             )
             / NULLIF(
               SUM(
                 (o.level - b.min_level)::double precision
                 / NULLIF((b.max_level - b.min_level)::double precision, 0)
               ), 0)
      END AS weighted_lat,
      CASE
        WHEN b.max_level = b.min_level THEN AVG(o.lon)
        ELSE SUM(
               ((o.level - b.min_level)::double precision
                / NULLIF((b.max_level - b.min_level)::double precision, 0)
               ) * o.lon
             )
             / NULLIF(
               SUM(
                 (o.level - b.min_level)::double precision
                 / NULLIF((b.max_level - b.min_level)::double precision, 0)
               ), 0)
      END AS weighted_lon,
      COUNT(*)::integer AS obs_count
    FROM app.observations o
    JOIN bounds b ON b.bssid = o.bssid
    WHERE o.lat   IS NOT NULL
      AND o.lon   IS NOT NULL
      AND o.level IS NOT NULL
      AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
    GROUP BY o.bssid, b.min_level, b.max_level
  )
  SELECT
    bssid,
    centroid_lat,
    centroid_lon,
    weighted_lat,
    weighted_lon,
    obs_count,
    NOW()
  FROM weighted
  ON CONFLICT (bssid) DO UPDATE SET
    centroid_lat     = EXCLUDED.centroid_lat,
    centroid_lon     = EXCLUDED.centroid_lon,
    weighted_lat     = EXCLUDED.weighted_lat,
    weighted_lon     = EXCLUDED.weighted_lon,
    obs_count        = EXCLUDED.obs_count,
    last_computed_at = EXCLUDED.last_computed_at;
END;
$$;

GRANT EXECUTE ON FUNCTION app.refresh_network_locations() TO shadowcheck_admin;

SELECT app.refresh_network_locations();
