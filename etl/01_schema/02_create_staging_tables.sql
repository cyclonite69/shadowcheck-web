-- Unlogged staging tables for fast, disposable loads.
-- Keep raw precision (text for source_pk) and original timestamps (ms).

CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_j24 (
  id        BIGSERIAL PRIMARY KEY,
  source_pk TEXT        NOT NULL,
  bssid     TEXT        NOT NULL,
  level     INTEGER     NOT NULL,
  lat       DOUBLE PRECISION NOT NULL,
  lon       DOUBLE PRECISION NOT NULL,
  altitude  DOUBLE PRECISION NOT NULL,
  accuracy  DOUBLE PRECISION NOT NULL,
  time_ms   BIGINT      NOT NULL,
  external  INTEGER     NOT NULL,
  mfgrid    INTEGER     NOT NULL
);

CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_g63 (
  id        BIGSERIAL PRIMARY KEY,
  source_pk TEXT        NOT NULL,
  bssid     TEXT        NOT NULL,
  level     INTEGER     NOT NULL,
  lat       DOUBLE PRECISION NOT NULL,
  lon       DOUBLE PRECISION NOT NULL,
  altitude  DOUBLE PRECISION NOT NULL,
  accuracy  DOUBLE PRECISION NOT NULL,
  time_ms   BIGINT      NOT NULL,
  external  INTEGER     NOT NULL,
  mfgrid    INTEGER     NOT NULL
);

CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_s22_main (
  id        BIGSERIAL PRIMARY KEY,
  source_pk TEXT        NOT NULL,
  bssid     TEXT        NOT NULL,
  level     INTEGER     NOT NULL,
  lat       DOUBLE PRECISION NOT NULL,
  lon       DOUBLE PRECISION NOT NULL,
  altitude  DOUBLE PRECISION NOT NULL,
  accuracy  DOUBLE PRECISION NOT NULL,
  time_ms   BIGINT      NOT NULL,
  external  INTEGER     NOT NULL,
  mfgrid    INTEGER     NOT NULL
);

CREATE UNLOGGED TABLE IF NOT EXISTS staging_locations_s22_backup (
  id        BIGSERIAL PRIMARY KEY,
  source_pk TEXT        NOT NULL,
  bssid     TEXT        NOT NULL,
  level     INTEGER     NOT NULL,
  lat       DOUBLE PRECISION NOT NULL,
  lon       DOUBLE PRECISION NOT NULL,
  altitude  DOUBLE PRECISION NOT NULL,
  accuracy  DOUBLE PRECISION NOT NULL,
  time_ms   BIGINT      NOT NULL,
  external  INTEGER     NOT NULL,
  mfgrid    INTEGER     NOT NULL
);

-- Raw networks metadata; keep dataset tag for lineage.
CREATE UNLOGGED TABLE IF NOT EXISTS staging_networks (
  id             BIGSERIAL PRIMARY KEY,
  dataset        TEXT        NOT NULL,
  bssid          TEXT        NOT NULL,
  ssid           TEXT,
  channel        INTEGER,
  radio          TEXT,
  first_seen_ms  BIGINT,
  first_lat      DOUBLE PRECISION,
  first_lon      DOUBLE PRECISION,
  first_loc_src  TEXT,
  last_signal    INTEGER,
  last_lat       DOUBLE PRECISION,
  last_lon       DOUBLE PRECISION,
  vendor         TEXT,
  security       TEXT,
  notes          TEXT,
  external       INTEGER
);
