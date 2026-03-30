-- Add functional indexes on UPPER(bssid) for tables joined with UPPER() comparisons.
-- Plain btree indexes on bssid cannot be used when both sides are wrapped in UPPER(),
-- causing full sequential scans on every query-builder lateral join per row.

CREATE INDEX IF NOT EXISTS idx_network_tags_bssid_upper
  ON app.network_tags (UPPER(bssid));

CREATE INDEX IF NOT EXISTS idx_network_notes_bssid_upper
  ON app.network_notes (UPPER(bssid));

CREATE INDEX IF NOT EXISTS idx_networks_bssid_upper
  ON app.networks (UPPER(bssid));

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_bssid_upper
  ON app.api_network_explorer_mv (UPPER(bssid));

CREATE INDEX IF NOT EXISTS idx_network_threat_scores_bssid_upper
  ON app.network_threat_scores (UPPER(bssid));
