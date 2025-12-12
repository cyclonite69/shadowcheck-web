-- Final analytical tables. ALTER statements keep existing installs aligned.

CREATE TABLE IF NOT EXISTS access_points (
  id bigserial PRIMARY KEY,
  bssid text UNIQUE NOT NULL,
  latest_ssid text,
  ssid_variants text[] DEFAULT '{}'::text[],
  first_seen timestamptz NOT NULL,
  last_seen timestamptz NOT NULL,
  total_observations bigint NOT NULL DEFAULT 0,
  is_5ghz boolean,
  is_6ghz boolean,
  is_hidden boolean,
  vendor text,
  enriched_json jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS observations (
  id bigserial PRIMARY KEY,
  device_id text NOT NULL REFERENCES device_sources(code),
  bssid text NOT NULL,
  ssid text,
  level integer NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  altitude double precision NOT NULL,
  accuracy double precision NOT NULL,
  time timestamptz NOT NULL,
  external boolean NOT NULL DEFAULT false,
  mfgrid integer NOT NULL,
  source_tag text NOT NULL,
  source_pk text NOT NULL,
  geom geometry(Point,4326) NOT NULL,
  time_ms bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS ssid_history (
  id bigserial PRIMARY KEY,
  bssid text NOT NULL REFERENCES access_points(bssid),
  ssid text,
  first_seen timestamptz NOT NULL,
  last_seen timestamptz NOT NULL
);

-- Align column types with ingestion format.
ALTER TABLE observations ALTER COLUMN source_pk TYPE text USING source_pk::text;
