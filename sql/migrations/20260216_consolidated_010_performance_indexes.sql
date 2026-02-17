-- ============================================================================
-- Consolidated Migration 010: Performance Indexes
-- ============================================================================
-- BRIN indexes, covering indexes, partial indexes, GIST tuning,
-- statistics targets, and analytics performance indexes.
-- Source: pg_dump --schema-only of live database (2026-02-16)
--
-- Note: Uses CREATE INDEX IF NOT EXISTS (not CONCURRENTLY) so this can
-- run inside the migration runner's transaction wrapper. On a fresh empty
-- DB, CONCURRENTLY provides no benefit anyway.
-- ============================================================================

-- --------------------------------------------------------------------------
-- BRIN indexes for time-series data
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_observations_observed_at_ms_brin ON app.observations USING brin (observed_at_ms);
CREATE INDEX IF NOT EXISTS idx_observations_time_brin ON app.observations_legacy USING brin (observed_at) WITH (pages_per_range='64');

-- --------------------------------------------------------------------------
-- Covering indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_networks_bssid_covering ON app.networks USING btree (bssid) INCLUDE (ssid, type, bestlevel, lasttime_ms);

-- --------------------------------------------------------------------------
-- Partial indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_observations_high_accuracy_recent ON app.observations USING btree (bssid, "time" DESC)
    WHERE ((accuracy < (100)::double precision) AND ("time" > '2025-11-15 00:00:00+00'::timestamp with time zone));

CREATE INDEX IF NOT EXISTS idx_observations_recent_covering ON app.observations USING btree ("time" DESC, bssid) INCLUDE (lat, lon, level, accuracy)
    WHERE ("time" > '2026-01-15 00:00:00+00'::timestamp with time zone);

CREATE INDEX IF NOT EXISTS idx_observations_bssid_geom_not_null ON app.observations USING btree (bssid)
    WHERE (geom IS NOT NULL);

-- --------------------------------------------------------------------------
-- GIST index tuning
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_obs_geom_gist ON app.observations USING gist (geom) WITH (buffering=auto, fillfactor='90');
CREATE INDEX IF NOT EXISTS idx_observations_geom_gist ON app.observations USING gist (geom) WITH (buffering=auto, fillfactor='90')
    WHERE (geom IS NOT NULL);

-- --------------------------------------------------------------------------
-- Observation directional indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_observations_bssid_time_desc ON app.observations USING btree (bssid, "time" DESC);
CREATE INDEX IF NOT EXISTS obs_bssid_time_asc_idx ON app.observations USING btree (bssid, "time") WHERE (geom IS NOT NULL);
CREATE INDEX IF NOT EXISTS obs_bssid_time_desc_idx ON app.observations USING btree (bssid, "time" DESC) WHERE (geom IS NOT NULL);
CREATE INDEX IF NOT EXISTS obs_geom_gix ON app.observations USING gist (geom) WHERE (geom IS NOT NULL);
