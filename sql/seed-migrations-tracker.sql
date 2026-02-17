-- ============================================================================
-- Seed schema_migrations tracking table
-- ============================================================================
-- Run this ONCE on an existing database to mark all migrations as applied.
-- Marks both the 77 archived migrations AND the 10 consolidated baselines
-- so the migration runner skips them all on existing deployments.
--
-- Usage:
--   docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db \
--     -f /sql/seed-migrations-tracker.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert all known migrations as "already applied"
-- ON CONFLICT skips any that are already tracked
INSERT INTO app.schema_migrations (filename) VALUES
  -- === 77 archived (original incremental) migrations ===
  ('004_add_authentication.sql'),
  ('00_create_legacy_tables.sql'),
  ('00_enforce_uppercase_ssid.sql'),
  ('00_init_schema.sql'),
  ('01_add_minimum_required_columns.sql'),
  ('01_create_import_schema.sql'),
  ('02_create_mvs_and_imports_table.sql'),
  ('03_fix_location_markers_schema.sql'),
  ('100_enforce_uppercase_ssid_public.sql'),
  ('101_enforce_uppercase_bssid.sql'),
  ('20251219_api_network_explorer_forensic.sql'),
  ('20251220_add_threat_intelligence_to_explorer.sql'),
  ('20251220_fix_duplicate_bssids_in_explorer.sql'),
  ('20251221_create_api_network_explorer_mv.sql'),
  ('20251221_recreate_api_network_explorer.sql'),
  ('20260127_update_mv_threat_unified.sql'),
  ('20260129_implement_db_security.sql'),
  ('20260130_consolidate_schema_to_app.sql'),
  ('20260130_fix_max_distance_meters.sql'),
  ('20260130_fix_mv_column_names.sql'),
  ('20260204_create_agency_offices.sql'),
  ('20260205_add_agency_office_source_status.sql'),
  ('20260205_create_geocoding_cache.sql'),
  ('20260206_add_agency_offices_address_normalization.sql'),
  ('20260206_add_agency_offices_phone_normalization.sql'),
  ('20260206_expand_agency_office_types.sql'),
  ('20260207_create_agency_office_coverage_notes.sql'),
  ('20260209_add_wigle_v2_unique_constraint.sql'),
  ('20260213_tighten_user_permissions.sql'),
  ('20260214_add_radio_manufacturers_compat_columns.sql'),
  ('20260214_create_network_entries_view.sql'),
  ('20260214_drop_uppercase_ssid_triggers.sql'),
  ('20260215_cleanup_public_duplicates.sql'),
  ('20260215_improve_network_entries_view.sql'),
  ('20260215_postgres18_postgis_optimizations.sql'),
  ('99_enforce_uppercase_ssid.sql'),
  ('add_analytics_performance_indexes.sql'),
  ('add_business_names.sql'),
  ('add_geocode_enrichment.sql'),
  ('add_ml_threat_score.sql'),
  ('add_performance_indexes.sql'),
  ('add_precomputed_threat_columns.sql'),
  ('add_threat_score_v2.sql'),
  ('add_trilateration_enrichment.sql'),
  ('add_trilat_to_networks.sql'),
  ('classify_device_types.sql'),
  ('classify_government_networks.sql'),
  ('cleanup_duplicates.sql'),
  ('contextual_classification.sql'),
  ('create_analytics_summary_mv.sql'),
  ('create_colocation_view.sql'),
  ('create_ml_model_table.sql'),
  ('create_network_aggregation_triggers.sql'),
  ('create_network_tags.sql'),
  ('create_radio_manufacturers.sql'),
  ('create_scoring_function.sql'),
  ('create_tracking_dashboard.sql'),
  ('create_trilateration_trigger.sql'),
  ('create_uuid_tracking.sql'),
  ('create_wigle_v3_details.sql'),
  ('create_wigle_v3_observations.sql'),
  ('extract_business_from_ssid.sql'),
  ('fix_channels_from_frequency.sql'),
  ('fix_kismet_functions.sql'),
  ('migrate_network_tags_v2.sql'),
  ('populate_ap_locations.sql'),
  ('update_mv_security_parsing_v8.sql'),
  ('update_mv_security_parsing_v9_fix_nulls.sql'),
  ('update_mv_threat_v2.sql'),
  ('update_mv_threat_v3_fast.sql'),
  ('update_mv_threat_v3_fixed.sql'),
  ('update_mv_threat_v3.sql'),
  ('update_mv_threat_v4_distance.sql'),
  ('update_mv_threat_v4_mobile.sql'),
  ('update_mv_threat_v5_distance_based.sql'),
  ('update_mv_threat_v6_precomputed.sql'),
  ('update_mv_threat_v7_improved_security.sql'),
  -- === 10 consolidated baseline migrations ===
  ('20260216_consolidated_001_extensions_and_schemas.sql'),
  ('20260216_consolidated_002_core_tables.sql'),
  ('20260216_consolidated_003_auth_and_users.sql'),
  ('20260216_consolidated_004_network_analysis.sql'),
  ('20260216_consolidated_005_ml_and_scoring.sql'),
  ('20260216_consolidated_006_wigle_integration.sql'),
  ('20260216_consolidated_007_agency_offices.sql'),
  ('20260216_consolidated_008_views_and_materialized_views.sql'),
  ('20260216_consolidated_009_functions_and_triggers.sql'),
  ('20260216_consolidated_010_performance_indexes.sql')
ON CONFLICT (filename) DO NOTHING;

SELECT COUNT(*) AS tracked_migrations FROM app.schema_migrations;
