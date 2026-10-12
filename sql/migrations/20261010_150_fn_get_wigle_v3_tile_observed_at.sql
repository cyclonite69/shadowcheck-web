CREATE OR REPLACE FUNCTION app.fn_get_wigle_v3_tile(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH bounds AS (
    SELECT ST_TileEnvelope(z, x, y) AS geom_3857
  ),
  candidates AS (
    SELECT
      v3.id,
      v3.netid AS bssid,
      v3.ssid,
      v3.signal,
      v3.frequency,
      v3.channel,
      to_char(v3.observed_at, 'YYYY-MM-DD HH24:MI:SS') AS observed_at,
      ST_Transform(v3.location, 3857) AS geom_3857
    FROM app.wigle_v3_observations AS v3
    CROSS JOIN bounds
    WHERE v3.location IS NOT NULL
      AND v3.location && ST_Transform(bounds.geom_3857, 4326)
  ),
  low_zoom AS (
    SELECT DISTINCT ON (
      ST_SnapToGrid(candidates.geom_3857, (40075016.68557849 / (256 * (2 ^ z))) * 4)
    )
      candidates.*
    FROM candidates
    WHERE z < 13
    ORDER BY
      ST_SnapToGrid(candidates.geom_3857, (40075016.68557849 / (256 * (2 ^ z))) * 4),
      candidates.signal DESC NULLS LAST,
      candidates.id
  ),
  sampled AS (
    SELECT low_zoom.* FROM low_zoom
    UNION ALL
    SELECT candidates.*
    FROM candidates
    WHERE z >= 13
  ),
  features AS (
    SELECT
      sampled.id,
      sampled.bssid,
      sampled.ssid,
      sampled.signal,
      sampled.frequency,
      sampled.channel,
      sampled.observed_at,
      ST_AsMVTGeom(sampled.geom_3857, bounds.geom_3857, 4096, 64, true) AS geom
    FROM sampled
    CROSS JOIN bounds
  )
  SELECT ST_AsMVT(features, 'wigle_v3_observations', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION app.fn_get_wigle_v3_tile(integer, integer, integer) TO shadowcheck_user;
