BEGIN;

CREATE TABLE IF NOT EXISTS app.orphan_network_backfills (
  bssid text PRIMARY KEY REFERENCES app.networks_orphans(bssid) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_attempted',
  matched_netid text,
  detail_imported boolean NOT NULL DEFAULT false,
  observations_imported integer NOT NULL DEFAULT 0,
  last_attempted_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT orphan_network_backfills_status_check CHECK (
    status IN ('not_attempted', 'wigle_match_imported_v3', 'no_wigle_match', 'error')
  )
);

CREATE INDEX IF NOT EXISTS idx_orphan_network_backfills_status
  ON app.orphan_network_backfills (status, last_attempted_at DESC);

ALTER TABLE app.orphan_network_backfills OWNER TO shadowcheck_admin;

GRANT SELECT ON app.orphan_network_backfills TO shadowcheck_user;
GRANT ALL PRIVILEGES ON app.orphan_network_backfills TO shadowcheck_admin;

COMMIT;
