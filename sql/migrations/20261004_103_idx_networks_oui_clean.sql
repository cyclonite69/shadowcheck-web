-- Migration: Add functional expression index on app.networks for surveillance queries
-- Date: 2026-10-04
-- Purpose: Resolves the Tier 20 join row misestimate (~2.6M rows vs ~711 actual) in
--          getEnrichedCandidates that pushed planner cost > 500k and triggered runaway
--          JIT inlining/optimization during surveillance detection tests.
--
-- Target Table: app.networks
-- Target Index: idx_networks_oui_clean
-- Expression:   (replace(left(upper(bssid), 8), ':', ''))

CREATE INDEX IF NOT EXISTS idx_networks_oui_clean
  ON app.networks ((replace(left(upper(bssid), 8), ':', '')));

ANALYZE app.networks;
