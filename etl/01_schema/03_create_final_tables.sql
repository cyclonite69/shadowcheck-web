-- Canonical tables. Designed to be idempotent and forward-compatible.

CREATE TABLE IF NOT EXISTS device_sources (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL, -- e.g., j24, g63, s22_main
  description TEXT
);

CREATE TABLE IF NOT EXISTS access_points (
  id              BIGSERIAL PRIMARY KEY,
  bssid           TEXT UNIQUE NOT NULL,
  last_ssid       TEXT,
  vendor          TEXT,
  last_seen_at    TIMESTAMPTZ,
  geom_last_known GEOMETRY(Point, 4326),
  observations    BIGINT DEFAULT 0,
  first_seen_at   TIMESTAMPTZ,
  last_signal     INTEGER,
  radio           TEXT,
  channel         INTEGER
);

CREATE TABLE IF NOT EXISTS observations (
  id           BIGSERIAL PRIMARY KEY,
  bssid        TEXT NOT NULL,
  source_pk    TEXT NOT NULL,
  device_code  TEXT NOT NULL, -- matches device_sources.code
  observed_at  TIMESTAMPTZ NOT NULL,
  rssi         INTEGER NOT NULL,
  lat          DOUBLE PRECISION NOT NULL,
  lon          DOUBLE PRECISION NOT NULL,
  altitude     DOUBLE PRECISION,
  accuracy     DOUBLE PRECISION,
  external     INTEGER,
  mfgrid       INTEGER,
  geom         GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS ssid_history (
  id          BIGSERIAL PRIMARY KEY,
  bssid       TEXT NOT NULL,
  ssid        TEXT,
  first_seen  TIMESTAMPTZ,
  last_seen   TIMESTAMPTZ,
  observed_by TEXT, -- device code
  note        TEXT
);
