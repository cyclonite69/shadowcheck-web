\echo 'Convert time_ms to timestamptz and join SSIDs'

DROP TABLE IF EXISTS staging_locations_all_enriched;

CREATE UNLOGGED TABLE staging_locations_all_enriched (
  id bigserial PRIMARY KEY,
  device_id text NOT NULL REFERENCES device_sources(code),
  source_pk text NOT NULL,
  bssid text NOT NULL,
  ssid text,
  level integer NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  altitude double precision NOT NULL,
  accuracy double precision NOT NULL,
  time_ms bigint NOT NULL,
  observed_at timestamptz NOT NULL,
  external boolean NOT NULL,
  mfgrid integer NOT NULL,
  source_tag text NOT NULL,
  geom geometry(Point,4326) NOT NULL
);

INSERT INTO staging_locations_all_enriched (
  device_id, source_pk, bssid, ssid, level, lat, lon, altitude, accuracy,
  time_ms, observed_at, external, mfgrid, source_tag, geom
)
SELECT
  l.device_id,
  l.source_pk,
  l.bssid,
  NULLIF(n.ssid, '') AS ssid,
  l.level,
  l.lat,
  l.lon,
  l.altitude,
  l.accuracy,
  l.time_ms,
  to_timestamp(l.time_ms / 1000.0) AS observed_at,
  CASE WHEN l.external IS NOT NULL AND l.external <> 0 THEN true ELSE false END AS external,
  l.mfgrid,
  l.device_id AS source_tag,
  ST_SetSRID(ST_MakePoint(l.lon, l.lat), 4326) AS geom
FROM staging_locations_all l
LEFT JOIN staging_networks n
  ON n.device_id = l.device_id AND n.bssid = l.bssid;
