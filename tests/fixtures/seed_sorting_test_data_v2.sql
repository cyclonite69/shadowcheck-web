-- tests/fixtures/seed_sorting_test_data_v2.sql
-- Idempotent fixture for column sorting E2E tests (v2 - corrected)
-- Targets the test DB: shadowcheck_test
-- Inserts networks and corresponding observations with required NOT NULL columns
-- and then refreshes the materialized view used by the Geospatial Explorer.
-- Run with:
--   psql -U shadowcheck_user -d shadowcheck_test -f tests/fixtures/seed_sorting_test_data_v2.sql

-- 1) Insert networks (idempotent)
INSERT INTO app.networks (
  bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid,
  lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon
)
VALUES
  ('02:SC:SORT:TE:ST:01', 'aaa', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  ('02:SC:SORT:TE:ST:02', 'bbb', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  ('02:SC:SORT:TE:ST:03', 'BBB', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  ('02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  ('02:SC:SORT:TE:ST:05', 'test10', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  ('02:SC:SORT:TE:ST:06', 'test11', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  ('02:SC:SORT:TE:ST:07', 'test20', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  ('02:SC:SORT:TE:ST:08', 'test100', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  ('02:SC:SORT:TE:ST:09', 'tie1', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  ('02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970)
ON CONFLICT (bssid) DO NOTHING;

-- 2) Insert observations using generate_series where helpful
-- Required NOT NULL columns for app.observations are honored: device_id, bssid, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom

-- Helper: base timestamp (ms) for first observation per network
\set base_ms 1717243200000

-- Network counts mapping
-- 1,2,3,9,10,11,20,100 for networks 01..08 respectively

-- Network 01 -> 1 observation
INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:01', 'aaa', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, to_timestamp((:base_ms)::double precision/1000.0), :base_ms, :base_ms, false, 0, 'sort-test', format('sort-01-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,1) gs ON CONFLICT DO NOTHING;

-- Network 02 -> 2 observations
INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:02', 'bbb', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, to_timestamp((:base_ms + (gs-1)*60000)::double precision/1000.0), (:base_ms + (gs-1)*60000), (:base_ms + (gs-1)*60000), false, 0, 'sort-test', format('sort-02-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,2) gs ON CONFLICT DO NOTHING;

-- Network 03 -> 3 observations
INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:03', 'BBB', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, to_timestamp((:base_ms + (gs-1)*60000)::double precision/1000.0), (:base_ms + (gs-1)*60000), (:base_ms + (gs-1)*60000), false, 0, 'sort-test', format('sort-03-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,3) gs ON CONFLICT DO NOTHING;

-- Network 04 -> 9 observations
INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, to_timestamp((:base_ms + (gs-1)*60000)::double precision/1000.0), (:base_ms + (gs-1)*60000), (:base_ms + (gs-1)*60000), false, 0, 'sort-test', format('sort-04-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,9) gs ON CONFLICT DO NOTHING;

-- Network 05 -> 10 observations
INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:05', 'test10', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, to_timestamp((:base_ms + (gs-1)*60000)::double precision/1000.0), (:base_ms + (gs-1)*60000), (:base_ms + (gs-1)*60000), false, 0, 'sort-test', format('sort-05-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,10) gs ON CONFLICT DO NOTHING;

-- Network 06 -> 11 observations
INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:06', 'test11', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, to_timestamp((:base_ms + (gs-1)*60000)::double precision/1000.0), (:base_ms + (gs-1)*60000), (:base_ms + (gs-1)*60000), false, 0, 'sort-test', format('sort-06-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,11) gs ON CONFLICT DO NOTHING;

-- Network 07 -> 20 observations
INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:07', 'test20', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, to_timestamp((:base_ms + (gs-1)*60000)::double precision/1000.0), (:base_ms + (gs-1)*60000), (:base_ms + (gs-1)*60000), false, 0, 'sort-test', format('sort-07-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,20) gs ON CONFLICT DO NOTHING;

-- Network 08 -> 100 observations (generate_series)
INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:08', 'test100', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5,
       to_timestamp((:base_ms + (gs-1)*60000)::double precision/1000.0), (:base_ms + (gs-1)*60000), (:base_ms + (gs-1)*60000), false, 0,
       'sort-test', format('sort-08-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,100) gs ON CONFLICT DO NOTHING;

-- Networks 09 and 0A -> tie-breaking test (5 and 15 observations)
INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:09', 'tie1', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, to_timestamp((:base_ms + (gs-1)*60000)::double precision/1000.0), (:base_ms + (gs-1)*60000), (:base_ms + (gs-1)*60000), false, 0, 'sort-test', format('sort-09-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,5) gs ON CONFLICT DO NOTHING;

INSERT INTO app.observations (device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities, level, lat, lon, altitude, accuracy, time, observed_at_ms, time_ms, external, mfgrid, source_tag, source_pk, geom)
SELECT 'j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, to_timestamp((:base_ms + (gs-1)*60000)::double precision/1000.0), (:base_ms + (gs-1)*60000), (:base_ms + (gs-1)*60000), false, 0, 'sort-test', format('sort-0A-%s', gs), ST_SetSRID(ST_MakePoint(-83.6970, 43.0234), 4326)
FROM generate_series(1,15) gs ON CONFLICT DO NOTHING;

-- 3) Seed network threat scores for tie-breaking test (idempotent)
-- Insert or update final_threat_score for two test networks so they tie at 42.0
INSERT INTO app.network_threat_scores (bssid, final_threat_score, final_threat_level, rule_based_score, ml_threat_score, ml_feature_values, model_version, scored_at)
VALUES
  ('02:SC:SORT:TE:ST:09', 42.00, 'HIGH', 42.00, 42.00, '{"evidence_weight":1.0}'::jsonb, 'test-model-1', now()),
  ('02:SC:SORT:TE:ST:0A', 42.00, 'HIGH', 42.00, 42.00, '{"evidence_weight":1.0}'::jsonb, 'test-model-1', now())
ON CONFLICT (bssid) DO UPDATE SET
  final_threat_score = EXCLUDED.final_threat_score,
  final_threat_level = EXCLUDED.final_threat_level,
  rule_based_score = EXCLUDED.rule_based_score,
  ml_threat_score = EXCLUDED.ml_threat_score,
  ml_feature_values = EXCLUDED.ml_feature_values,
  model_version = EXCLUDED.model_version,
  scored_at = EXCLUDED.scored_at;

-- 4) Refresh materialized view (CONCURRENTLY allowed because unique index on bssid exists)
-- Note: REFRESH MATERIALIZED VIEW CONCURRENTLY cannot run inside a transaction block.
REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_network_explorer_mv;

-- End of fixture
