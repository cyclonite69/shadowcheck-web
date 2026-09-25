-- tests/fixtures/cleanup_sorting_test_data_v2.sql
-- Cleanup sorting test fixtures and refresh MV
-- Run with:
--   psql -U shadowcheck_user -d shadowcheck_test -f tests/fixtures/cleanup_sorting_test_data_v2.sql

DELETE FROM app.observations WHERE source_tag = 'sort-test';
DELETE FROM app.network_threat_scores WHERE bssid LIKE '02:SC:SORT:TE:ST:%';
DELETE FROM app.networks WHERE bssid LIKE '02:SC:SORT:TE:ST:%';

-- Refresh MV so the removed rows no longer appear
REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_network_explorer_mv;
