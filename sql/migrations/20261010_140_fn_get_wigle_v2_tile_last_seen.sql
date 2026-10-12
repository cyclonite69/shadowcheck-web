CREATE OR REPLACE FUNCTION app.fn_get_wigle_v2_tile(z integer, x integer, y integer)
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
      v2.id,
      v2.bssid,
      v2.ssid,
      v2.name,
      v2.type,
      v2.encryption,
      v2.channel,
      to_char(v2.lasttime, 'YYYY-MM-DD HH24:MI:SS') AS last_seen,
      ST_Transform(v2.location, 3857) AS geom_3857
    FROM app.wigle_v2_networks_search AS v2
    CROSS JOIN bounds
    WHERE v2.location IS NOT NULL
      AND v2.location && ST_Transform(bounds.geom_3857, 4326)
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
      sampled.name,
      sampled.type,
      sampled.encryption,
      sampled.channel,
      sampled.last_seen,
      ST_AsMVTGeom(sampled.geom_3857, bounds.geom_3857, 4096, 64, true) AS geom
    FROM sampled
    CROSS JOIN bounds
  )
  SELECT ST_AsMVT(features, 'wigle_v2_networks', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION app.fn_get_wigle_v2_tile(integer, integer, integer) TO shadowcheck_user;
