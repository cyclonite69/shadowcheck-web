-- Rollback Migration: Drop functional expression index idx_networks_oui_clean
-- Date: 2026-10-04
-- Target Table: app.networks

DROP INDEX IF EXISTS app.idx_networks_oui_clean;

ANALYZE app.networks;
