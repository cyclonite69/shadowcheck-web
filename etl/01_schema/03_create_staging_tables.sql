-- Staging tables remain unlogged for fast, disposable loads.

-- Ensure PK type is text for all staging variants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staging_locations_all') THEN
    ALTER TABLE staging_locations_all ALTER COLUMN source_pk TYPE text USING source_pk::text;
  END IF;
EXCEPTION WHEN undefined_column THEN
  NULL;
END$$;

CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_j24 (
  id bigserial PRIMARY KEY,
  source_pk text NOT NULL,
  bssid text NOT NULL,
  level integer NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  altitude double precision NOT NULL,
  accuracy double precision NOT NULL,
  time_ms bigint NOT NULL,
  external integer NOT NULL,
  mfgrid integer NOT NULL
);

CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_g63 (
  id bigserial PRIMARY KEY,
  source_pk text NOT NULL,
  bssid text NOT NULL,
  level integer NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  altitude double precision NOT NULL,
  accuracy double precision NOT NULL,
  time_ms bigint NOT NULL,
  external integer NOT NULL,
  mfgrid integer NOT NULL
);

CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_s22_main (
  id bigserial PRIMARY KEY,
  source_pk text NOT NULL,
  bssid text NOT NULL,
  level integer NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  altitude double precision NOT NULL,
  accuracy double precision NOT NULL,
  time_ms bigint NOT NULL,
  external integer NOT NULL,
  mfgrid integer NOT NULL
);

CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_s22_backup (
  id bigserial PRIMARY KEY,
  source_pk text NOT NULL,
  bssid text NOT NULL,
  level integer NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  altitude double precision NOT NULL,
  accuracy double precision NOT NULL,
  time_ms bigint NOT NULL,
  external integer NOT NULL,
  mfgrid integer NOT NULL
);

CREATE UNLOGGED TABLE IF NOT EXISTS staging_networks (
  device_id text NOT NULL REFERENCES device_sources(code),
  bssid text NOT NULL,
  ssid text NOT NULL,
  frequency integer NOT NULL,
  capabilities text NOT NULL,
  lasttime bigint NOT NULL,
  lastlat double precision NOT NULL,
  lastlon double precision NOT NULL,
  type text NOT NULL,
  bestlevel integer NOT NULL,
  bestlat double precision NOT NULL,
  bestlon double precision NOT NULL,
  rcois text NOT NULL,
  mfgrid integer NOT NULL,
  service text NOT NULL
);

CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_all (
  id bigserial PRIMARY KEY,
  device_id text NOT NULL REFERENCES device_sources(code),
  source_pk text NOT NULL,
  bssid text NOT NULL,
  level integer NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  altitude double precision NOT NULL,
  accuracy double precision NOT NULL,
  time_ms bigint NOT NULL,
  external integer NOT NULL,
  mfgrid integer NOT NULL
);

-- Enriched staging used for promotion steps (includes derived fields).
CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_all_enriched (
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
