CREATE OR REPLACE FUNCTION app.fn_get_observation_tile(
    z integer,
    x integer,
    y integer
)
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH tile_bounds AS (
    SELECT ST_TileEnvelope(z, x, y) AS bounds_3857
  ),
  tile_points AS (
    -- High zoom (z >= 13): All raw observations, zero pagination limits
    SELECT
      obs.id,
      obs.bssid,
      obs.ssid,
      obs.level,
      obs.radio_type,
      ST_AsMVTGeom(
        ST_Transform(obs.geom, 3857),
        tile_bounds.bounds_3857,
        4096,
        64,
        true
      ) AS geom
    FROM app.observations AS obs
    CROSS JOIN tile_bounds
    WHERE z >= 13
      AND obs.geom && ST_Transform(tile_bounds.bounds_3857, 4326)

    UNION ALL

    -- Low/Mid zoom (z < 13): 1 observation per 4px grid cell (strongest dBm wins)
    SELECT
      sub.id,
      sub.bssid,
      sub.ssid,
      sub.level,
      sub.radio_type,
      ST_AsMVTGeom(
        ST_Transform(sub.geom, 3857),
        tile_bounds.bounds_3857,
        4096,
        64,
        true
      ) AS geom
    FROM (
      SELECT DISTINCT ON (
        ST_SnapToGrid(
          ST_Transform(obs.geom, 3857),
          (40075016.68557849 / (256 * (2 ^ z))) * 4
        )
      )
        obs.id,
        obs.bssid,
        obs.ssid,
        obs.level,
        obs.radio_type,
        obs.geom
      FROM app.observations AS obs
      CROSS JOIN tile_bounds
      WHERE z < 13
        AND obs.geom && ST_Transform(tile_bounds.bounds_3857, 4326)
      ORDER BY
        ST_SnapToGrid(
          ST_Transform(obs.geom, 3857),
          (40075016.68557849 / (256 * (2 ^ z))) * 4
        ),
        obs.level DESC NULLS LAST
    ) sub
    CROSS JOIN tile_bounds
  )
  SELECT ST_AsMVT(tile_points, 'observations', 4096, 'geom')
  FROM tile_points
  WHERE geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION app.fn_get_observation_tile(integer, integer, integer)
  TO shadowcheck_user;
