-- Migration: 20260426_add_wigle_ledger_events.sql
-- Persists WiGLE API request timestamps so the 24-hour quota ledger survives
-- process restarts and deploys mid-run.

SET search_path TO app, public;

CREATE TABLE IF NOT EXISTS app.wigle_ledger_events (
    id           SERIAL      PRIMARY KEY,
    kind         TEXT        NOT NULL CHECK (kind IN ('search', 'detail', 'stats')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wigle_ledger_events_kind_ts
    ON app.wigle_ledger_events (kind, requested_at);

-- shadowcheck_admin owns writes; the read-only role has no access (not needed)
GRANT INSERT, SELECT, DELETE ON app.wigle_ledger_events TO shadowcheck_admin;
GRANT USAGE, SELECT ON SEQUENCE app.wigle_ledger_events_id_seq TO shadowcheck_admin;
