-- tests/fixtures/cleanup_sorting_test_data.sql
--
-- Clean up sorting test fixtures after E2E tests complete.
-- Run after test suite:
--   psql -U shadowcheck_user -d shadowcheck_test -f tests/fixtures/cleanup_sorting_test_data.sql
--

DELETE FROM app.observations WHERE source_tag = 'sort-test';
DELETE FROM app.networks WHERE bssid LIKE '02:SC:SORT:TE:ST:%';
