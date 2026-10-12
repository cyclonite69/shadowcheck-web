-- Geospatial Explorer persistent menu overlays as viewport-scoped vector tiles.

CREATE OR REPLACE FUNCTION app.fn_get_kml_tile(z integer, x integer, y integer)
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
      k.id,
      k.bssid,
      k.network_id,
      k.name,
      k.encryption,
      k.signal_dbm,
      k.network_type,
      ST_Transform(k.location, 3857) AS geom_3857
    FROM app.kml_points AS k
    CROSS JOIN bounds
    WHERE k.location IS NOT NULL
      AND k.location && ST_Transform(bounds.geom_3857, 4326)
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
      candidates.signal_dbm DESC NULLS LAST,
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
      sampled.network_id,
      sampled.name,
      sampled.encryption,
      sampled.signal_dbm,
      sampled.network_type,
      ST_AsMVTGeom(sampled.geom_3857, bounds.geom_3857, 4096, 64, true) AS geom
    FROM sampled
    CROSS JOIN bounds
  )
  SELECT ST_AsMVT(features, 'kml_points', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;

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
      ST_AsMVTGeom(sampled.geom_3857, bounds.geom_3857, 4096, 64, true) AS geom
    FROM sampled
    CROSS JOIN bounds
  )
  SELECT ST_AsMVT(features, 'wigle_v2_networks', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;

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
      ST_AsMVTGeom(sampled.geom_3857, bounds.geom_3857, 4096, 64, true) AS geom
    FROM sampled
    CROSS JOIN bounds
  )
  SELECT ST_AsMVT(features, 'wigle_v3_observations', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION app.fn_get_deflock_camera_tile(z integer, x integer, y integer)
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
      d.id,
      COALESCE(d.manufacturer, d.source_properties->>'manufacturer', d.source) AS vendor,
      d.name,
      d.source AS source_tag,
      ST_Transform(d.geom, 3857) AS geom_3857
    FROM app.deflock_cameras AS d
    CROSS JOIN bounds
    WHERE d.geom IS NOT NULL
      AND d.geom && ST_Transform(bounds.geom_3857, 4326)
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
      sampled.vendor,
      sampled.name,
      sampled.source_tag,
      ST_AsMVTGeom(sampled.geom_3857, bounds.geom_3857, 4096, 64, true) AS geom
    FROM sampled
    CROSS JOIN bounds
  )
  SELECT ST_AsMVT(features, 'deflock_cameras', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION app.fn_get_agency_offices_tile(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH bounds AS (
    SELECT ST_TileEnvelope(z, x, y) AS geom_3857
  ),
  features AS (
    SELECT
      a.id,
      a.office_type,
      a.name,
      a.city,
      a.state,
      ST_AsMVTGeom(
        ST_Transform(a.location::geometry, 3857),
        bounds.geom_3857,
        4096,
        64,
        true
      ) AS geom
    FROM app.agency_offices AS a
    CROSS JOIN bounds
    WHERE a.location IS NOT NULL
      AND a.location && ST_Transform(bounds.geom_3857, 4326)::geography
  )
  SELECT ST_AsMVT(features, 'agency_offices', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION app.fn_get_courthouses_tile(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH bounds AS (
    SELECT ST_TileEnvelope(z, x, y) AS geom_3857
  ),
  features AS (
    SELECT
      c.id,
      c.name AS court_name,
      c.circuit,
      c.courthouse_type AS building_type,
      c.district,
      ST_AsMVTGeom(
        ST_Transform(c.location::geometry, 3857),
        bounds.geom_3857,
        4096,
        64,
        true
      ) AS geom
    FROM app.federal_courthouses AS c
    CROSS JOIN bounds
    WHERE c.location IS NOT NULL
      AND c.location && ST_Transform(bounds.geom_3857, 4326)::geography
  )
  SELECT ST_AsMVT(features, 'federal_courthouses', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION app.fn_get_shotspotter_tile(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH bounds AS (
    SELECT ST_TileEnvelope(z, x, y) AS geom_3857
  ),
  zones AS (
    SELECT
      zone.id,
      zone.city AS zone_name,
      zone.city,
      zone.state,
      zone.contract_status,
      ST_AsMVTGeom(
        ST_Transform(zone.geom, 3857),
        bounds.geom_3857,
        4096,
        64,
        true
      ) AS geom
    FROM app.shotspotter_zones AS zone
    CROSS JOIN bounds
    WHERE zone.geom IS NOT NULL
      AND zone.geom && ST_Transform(bounds.geom_3857, 4326)
  ),
  sensor_candidates AS (
    SELECT
      sensor.id,
      sensor.sensor_id,
      sensor.status,
      ST_Transform(sensor.geom, 3857) AS geom_3857
    FROM app.shotspotter_sensors AS sensor
    CROSS JOIN bounds
    WHERE sensor.geom IS NOT NULL
      AND sensor.geom && ST_Transform(bounds.geom_3857, 4326)
  ),
  low_zoom_sensors AS (
    SELECT DISTINCT ON (
      ST_SnapToGrid(
        sensor_candidates.geom_3857,
        (40075016.68557849 / (256 * (2 ^ z))) * 4
      )
    )
      sensor_candidates.id,
      sensor_candidates.sensor_id,
      sensor_candidates.status,
      ST_AsMVTGeom(sensor_candidates.geom_3857, bounds.geom_3857, 4096, 64, true) AS geom
    FROM sensor_candidates
    CROSS JOIN bounds
    WHERE z < 13
    ORDER BY
      ST_SnapToGrid(
        sensor_candidates.geom_3857,
        (40075016.68557849 / (256 * (2 ^ z))) * 4
      ),
      sensor_candidates.id
  ),
  sensors AS (
    SELECT low_zoom_sensors.* FROM low_zoom_sensors
    UNION ALL
    SELECT
      sensor_candidates.id,
      sensor_candidates.sensor_id,
      sensor_candidates.status,
      ST_AsMVTGeom(sensor_candidates.geom_3857, bounds.geom_3857, 4096, 64, true) AS geom
    FROM sensor_candidates
    CROSS JOIN bounds
    WHERE z >= 13
  )
  SELECT
    COALESCE(
      (SELECT ST_AsMVT(zones, 'shotspotter_zones', 4096, 'geom') FROM zones WHERE geom IS NOT NULL),
      ''::bytea
    )
    ||
    COALESCE(
      (SELECT ST_AsMVT(sensors, 'shotspotter_sensors', 4096, 'geom') FROM sensors WHERE geom IS NOT NULL),
      ''::bytea
    );
$$;

GRANT EXECUTE ON FUNCTION app.fn_get_kml_tile(integer, integer, integer) TO shadowcheck_user;
GRANT EXECUTE ON FUNCTION app.fn_get_wigle_v2_tile(integer, integer, integer) TO shadowcheck_user;
GRANT EXECUTE ON FUNCTION app.fn_get_wigle_v3_tile(integer, integer, integer) TO shadowcheck_user;
GRANT EXECUTE ON FUNCTION app.fn_get_deflock_camera_tile(integer, integer, integer) TO shadowcheck_user;
GRANT EXECUTE ON FUNCTION app.fn_get_agency_offices_tile(integer, integer, integer) TO shadowcheck_user;
GRANT EXECUTE ON FUNCTION app.fn_get_courthouses_tile(integer, integer, integer) TO shadowcheck_user;
GRANT EXECUTE ON FUNCTION app.fn_get_shotspotter_tile(integer, integer, integer) TO shadowcheck_user;

-- Keep the previously introduced ALPR tile API bounded at overview zooms too.
CREATE OR REPLACE FUNCTION app.fn_get_alpr_camera_tile(z integer, x integer, y integer)
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
      cameras.osm_id,
      cameras.source_properties->>'manufacturer' AS manufacturer,
      cameras.source_properties->>'name' AS name,
      COALESCE(
        cameras.source_properties->>'manufacturer',
        cameras.source_properties->>'brand'
      ) AS vendor,
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
      ST_Transform(cameras.geom, 3857) AS geom_3857
    FROM app.alpr_cameras AS cameras
    CROSS JOIN bounds
    WHERE cameras.geom IS NOT NULL
      AND cameras.geom && ST_Transform(bounds.geom_3857, 4326)
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
      candidates.osm_id
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
      sampled.osm_id,
      sampled.manufacturer,
      sampled.name,
      sampled.vendor,
      sampled.camera_type,
      sampled.operator,
      sampled.surveillance_zone,
      sampled.camera_mount,
      sampled.direction,
      ST_AsMVTGeom(sampled.geom_3857, bounds.geom_3857, 4096, 64, true) AS geom
    FROM sampled
    CROSS JOIN bounds
  )
  SELECT ST_AsMVT(features, 'alpr_cameras', 4096, 'geom')
  FROM features
  WHERE geom IS NOT NULL;
$$;
