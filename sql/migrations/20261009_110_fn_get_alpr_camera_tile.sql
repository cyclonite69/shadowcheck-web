CREATE OR REPLACE FUNCTION app.fn_get_alpr_camera_tile(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH tile_bounds AS (
    SELECT ST_TileEnvelope(z, x, y) AS bounds_3857
  ),
  tile_features AS (
    SELECT
      cameras.osm_id,
      cameras.source_properties->>'manufacturer' AS manufacturer,
      COALESCE(
        cameras.source_properties->>'camera:type',
        cameras.source_properties->>'surveillance'
      ) AS camera_type,
      COALESCE(
        cameras.source_properties->>'operator',
        cameras.source_properties->>'operator:short'
      ) AS operator,
      cameras.source_properties->>'surveillance:zone' AS surveillance_zone,
      cameras.source_properties->>'camera:mount' AS camera_mount,
      COALESCE(
        cameras.source_properties->>'direction',
        cameras.source_properties->>'camera:direction'
      ) AS direction,
      ST_AsMVTGeom(
        ST_Transform(cameras.geom, 3857),
        tile_bounds.bounds_3857,
        4096,
        64,
        true
      ) AS geom
    FROM app.alpr_cameras AS cameras
    CROSS JOIN tile_bounds
    WHERE cameras.geom && ST_Transform(tile_bounds.bounds_3857, 4326)
  )
  SELECT ST_AsMVT(tile_features, 'alpr_cameras', 4096, 'geom')
  FROM tile_features
  WHERE geom IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION app.fn_get_alpr_camera_tile(integer, integer, integer)
  TO shadowcheck_user;
