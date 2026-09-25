BEGIN;

-- Re-seed the VISINT unmatched fallback network in an idempotent way.
-- This preserves the original sentinel row values while avoiding duplicate-row
-- churn when the migration is re-applied on a database that already contains it.
INSERT INTO app.networks (
  bssid,
  ssid,
  type,
  frequency,
  capabilities,
  service,
  rcois,
  mfgrid,
  lasttime_ms,
  lastlat,
  lastlon,
  bestlevel,
  bestlat,
  bestlon,
  is_sentinel
)
VALUES (
  'VISINT_UNMATCHED',
  'VISINT Unmatched Fallback',
  'W',
  0,
  '',
  '',
  '',
  0,
  0,
  0.0,
  0.0,
  0,
  0.0,
  0.0,
  true
)
ON CONFLICT (bssid) DO NOTHING;

COMMIT;
