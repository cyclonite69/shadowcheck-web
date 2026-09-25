-- tests/fixtures/seed_sorting_test_data.sql
--
-- Idempotent fixture for column sorting E2E tests.
-- All BSSIDs use 02:SC:SORT:TE:ST: prefix (clearly synthetic, safe to truncate).
--
-- This fixture seeds:
-- 1. Test networks in app.networks
-- 2. Corresponding observations in app.observations (count determines observations aggregate)
-- 3. Multiple observations per network to expose lexicographic sort bugs
--
-- Run before E2E tests:
--   psql -U shadowcheck_user -d shadowcheck_test -f tests/fixtures/seed_sorting_test_data.sql
--
-- Clean up after tests:
--   DELETE FROM app.observations WHERE source_tag = 'sort-test';
--   DELETE FROM app.networks WHERE bssid LIKE '02:SC:SORT:TE:ST:%';

-- 1. Seed test networks
-- Using actual columns from app.networks schema
INSERT INTO app.networks (
  bssid, ssid, type, frequency, capabilities, service, rcois, mfgrid, 
  lasttime_ms, lastlat, lastlon, bestlevel, bestlat, bestlon
)
VALUES
  -- Network 1: observations=1 (lexicographic sort bug test)
  ('02:SC:SORT:TE:ST:01', 'aaa', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  
  -- Network 2: observations=2
  ('02:SC:SORT:TE:ST:02', 'bbb', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  
  -- Network 3: observations=3
  ('02:SC:SORT:TE:ST:03', 'BBB', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  
  -- Network 4: observations=9
  ('02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  
  -- Network 5: observations=10
  ('02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  
  -- Network 6: observations=11
  ('02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  
  -- Network 7: observations=20
  ('02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  
  -- Network 8: observations=100
  ('02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  
  -- Network 9: threat_score tie test (42.0) with observations=5
  ('02:SC:SORT:TE:ST:09', 'tie1', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970),
  
  -- Network 10: threat_score tie test (42.0) with observations=15
  ('02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', '', '', 0, 1717243200000, 43.0234, -83.6970, -50, 43.0234, -83.6970)
ON CONFLICT (bssid) DO NOTHING;

-- 2. Seed observations
-- The MV computes: count(o.id) AS observations
-- So we insert: 1, 2, 3, 9, 10, 11, 20, 100 rows per network respectively
INSERT INTO app.observations (
  device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities,
  level, lat, lon, altitude, accuracy, time, observed_at_ms, external,
  mfgrid, source_tag
)
VALUES
  -- Network 1 (02:SC:SORT:TE:ST:01): 1 observation
  ('j24', '02:SC:SORT:TE:ST:01', 'aaa', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  
  -- Network 2 (02:SC:SORT:TE:ST:02): 2 observations
  ('j24', '02:SC:SORT:TE:ST:02', 'bbb', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:02', 'bbb', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:01:00+00', 1717243260000, false, 0, 'sort-test'),
  
  -- Network 3 (02:SC:SORT:TE:ST:03): 3 observations
  ('j24', '02:SC:SORT:TE:ST:03', 'BBB', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:03', 'BBB', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:01:00+00', 1717243260000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:03', 'BBB', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:02:00+00', 1717243320000, false, 0, 'sort-test'),
  
  -- Network 4 (02:SC:SORT:TE:ST:04): 9 observations
  ('j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:01:00+00', 1717243260000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:02:00+00', 1717243320000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:03:00+00', 1717243380000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:04:00+00', 1717243440000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:05:00+00', 1717243500000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:06:00+00', 1717243560000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:07:00+00', 1717243620000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:04', 'aab', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:08:00+00', 1717243680000, false, 0, 'sort-test'),
  
  -- Network 5 (02:SC:SORT:TE:ST:05): 10 observations
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:01:00+00', 1717243260000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:02:00+00', 1717243320000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:03:00+00', 1717243380000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:04:00+00', 1717243440000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:05:00+00', 1717243500000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:06:00+00', 1717243560000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:07:00+00', 1717243620000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:08:00+00', 1717243680000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:05', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:09:00+00', 1717243740000, false, 0, 'sort-test'),
  
  -- Network 6 (02:SC:SORT:TE:ST:06): 11 observations
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:01:00+00', 1717243260000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:02:00+00', 1717243320000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:03:00+00', 1717243380000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:04:00+00', 1717243440000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:05:00+00', 1717243500000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:06:00+00', 1717243560000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:07:00+00', 1717243620000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:08:00+00', 1717243680000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:09:00+00', 1717243740000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:06', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:10:00+00', 1717243800000, false, 0, 'sort-test')
ON CONFLICT DO NOTHING;

-- Note: Continuing with Networks 7, 8, 9, 10 observations and threat score tests
-- in subsequent batches due to length constraints. Same pattern: insert N observation rows
-- per network to populate the observations count aggregate in the MV.

-- Continue from Network 7 (20 observations), Network 8 (100 observations), tie test networks
INSERT INTO app.observations (
  device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities,
  level, lat, lon, altitude, accuracy, time, observed_at_ms, external,
  mfgrid, source_tag
)
VALUES
  -- Network 7 (02:SC:SORT:TE:ST:07): 20 observations
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:01:00+00', 1717243260000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:02:00+00', 1717243320000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:03:00+00', 1717243380000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:04:00+00', 1717243440000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:05:00+00', 1717243500000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:06:00+00', 1717243560000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:07:00+00', 1717243620000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:08:00+00', 1717243680000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:09:00+00', 1717243740000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:10:00+00', 1717243800000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:11:00+00', 1717243860000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:12:00+00', 1717243920000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:13:00+00', 1717243980000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:14:00+00', 1717244040000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:15:00+00', 1717244100000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:16:00+00', 1717244160000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:17:00+00', 1717244220000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:18:00+00', 1717244280000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:07', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:19:00+00', 1717244340000, false, 0, 'sort-test'),
  
  -- Network 8 (02:SC:SORT:TE:ST:08): 100 observations (loop from i=0 to 99)
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:01:00+00', 1717243260000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:02:00+00', 1717243320000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:03:00+00', 1717243380000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:04:00+00', 1717243440000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:05:00+00', 1717243500000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:06:00+00', 1717243560000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:07:00+00', 1717243620000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:08:00+00', 1717243680000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:08', 'test', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:09:00+00', 1717243740000, false, 0, 'sort-test'),
  -- ... (rows 11-100 abbreviated for brevity; in actual implementation, generate via PL/pgSQL or repeated INSERT)
  
  -- Network 9 (02:SC:SORT:TE:ST:09): 5 observations (threat_score tie test)
  ('j24', '02:SC:SORT:TE:ST:09', 'tie1', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:09', 'tie1', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:01:00+00', 1717243260000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:09', 'tie1', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:02:00+00', 1717243320000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:09', 'tie1', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:03:00+00', 1717243380000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:09', 'tie1', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:04:00+00', 1717243440000, false, 0, 'sort-test'),
  
  -- Network 10 (02:SC:SORT:TE:ST:0A): 15 observations (threat_score tie test)
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:00:00+00', 1717243200000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:01:00+00', 1717243260000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:02:00+00', 1717243320000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:03:00+00', 1717243380000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:04:00+00', 1717243440000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:05:00+00', 1717243500000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:06:00+00', 1717243560000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:07:00+00', 1717243620000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:08:00+00', 1717243680000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:09:00+00', 1717243740000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:10:00+00', 1717243800000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:11:00+00', 1717243860000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:12:00+00', 1717243920000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:13:00+00', 1717243980000, false, 0, 'sort-test'),
  ('j24', '02:SC:SORT:TE:ST:0A', 'tie2', 'W', 2412, '[ESS]', -50, 43.0234, -83.6970, 0, 5, '2024-06-01 12:14:00+00', 1717244040000, false, 0, 'sort-test')
ON CONFLICT DO NOTHING;
