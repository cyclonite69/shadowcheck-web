-- Geocoding cache for rounded coordinate lookups (dedupe by block/parcel)
CREATE TABLE IF NOT EXISTS app.geocoding_cache (
  id BIGSERIAL PRIMARY KEY,
  precision SMALLINT NOT NULL CHECK (precision >= 0 AND precision <= 6),
  lat_round DOUBLE PRECISION NOT NULL,
  lon_round DOUBLE PRECISION NOT NULL,
  -- Optional original coordinate used when cache row was created
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  address TEXT,
  poi_name TEXT,
  poi_category TEXT,
  feature_type TEXT,
  poi_skip BOOLEAN NOT NULL DEFAULT FALSE,
  poi_attempted_at TIMESTAMPTZ,
  poi_attempts INTEGER NOT NULL DEFAULT 0,
  address_attempted_at TIMESTAMPTZ,
  address_attempts INTEGER NOT NULL DEFAULT 0,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  provider TEXT,
  confidence NUMERIC(5, 4),
  geocoded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_response JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS geocoding_cache_round_idx
  ON app.geocoding_cache (precision, lat_round, lon_round);

CREATE INDEX IF NOT EXISTS geocoding_cache_provider_idx
  ON app.geocoding_cache (provider);
