\set ON_ERROR_STOP on

-- Phase 3 carry-forward for post-consolidation runtime contract migrations.
-- These remain outside sql/migrations until switchover, but validation must
-- include them so the assembled baseline matches the current app contract.

\ir ../migrations/20260405_normalize_radio_manufacturers.sql
\ir ../migrations/20260404_add_geocoding_to_api_network_explorer_mv.sql
\ir ../migrations/20260404_add_networks_orphans_table.sql
\ir ../migrations/20260405_add_orphan_network_backfill_tracking.sql
