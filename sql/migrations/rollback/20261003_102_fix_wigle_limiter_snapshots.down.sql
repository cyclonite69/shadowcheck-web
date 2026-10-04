-- This security-preserving rollback restores the pre-102 rate-limit view and
-- function calculations, but is not an exact historical security restoration.
-- It retains requests_in_prior_24h and the append-only guards so rollback does
-- not discard captured snapshots or permit ledger deletion. The functions keep
-- their historical SECURITY DEFINER mode with a pinned search_path, PUBLIC
-- EXECUTE revoked, and EXECUTE granted to shadowcheck_admin.

SET search_path TO app, public;

DROP FUNCTION IF EXISTS app.get_wigle_safe_limit(TEXT);
DROP FUNCTION IF EXISTS app.get_wigle_reset_profile(TEXT);
DROP VIEW IF EXISTS app.v_wigle_rate_limit_events;

CREATE VIEW app.v_wigle_rate_limit_events AS
WITH wall_hits AS (
  SELECT e.id, e.kind, e.requested_at, e.retry_after_hint
  FROM app.wigle_ledger_events AS e
  WHERE e.status = 'rate_limited'
)
SELECT
  w.id,
  w.kind,
  w.requested_at AS wall_hit_at,
  w.retry_after_hint,
  (
    SELECT pg_catalog.count(*)::INTEGER
    FROM app.wigle_ledger_events AS p
    WHERE p.kind = w.kind
      AND p.requested_at > w.requested_at - INTERVAL '1 hour'
      AND p.requested_at < w.requested_at
  ) AS requests_in_prior_hour,
  (
    SELECT COALESCE(pg_catalog.sum(p.result_count), 0)::INTEGER
    FROM app.wigle_ledger_events AS p
    WHERE p.kind = w.kind
      AND p.requested_at > w.requested_at - INTERVAL '1 hour'
      AND p.requested_at < w.requested_at
      AND p.result_count IS NOT NULL
  ) AS results_in_prior_hour,
  (
    SELECT x.requested_at
    FROM app.wigle_ledger_events AS x
    WHERE x.kind = w.kind
      AND x.id > w.id
      AND x.status = 'success'
    ORDER BY x.id ASC
    LIMIT 1
  ) AS first_ok_after_wall,
  EXTRACT(EPOCH FROM (
    (
      SELECT x.requested_at
      FROM app.wigle_ledger_events AS x
      WHERE x.kind = w.kind
        AND x.id > w.id
        AND x.status = 'success'
      ORDER BY x.id ASC
      LIMIT 1
    ) - w.requested_at
  ))::INTEGER / 60 AS recovery_minutes,
  EXTRACT(HOUR FROM (
    (
      SELECT x.requested_at
      FROM app.wigle_ledger_events AS x
      WHERE x.kind = w.kind
        AND x.id > w.id
        AND x.status = 'success'
      ORDER BY x.id ASC
      LIMIT 1
    ) AT TIME ZONE 'UTC'
  ))::INTEGER AS recovery_utc_hour
FROM wall_hits AS w;

GRANT SELECT ON app.v_wigle_rate_limit_events TO shadowcheck_admin;

-- Restore the prior request/result-based safe-limit calculation while retaining
-- SECURITY DEFINER, the pinned search_path, and restricted function execution.
CREATE FUNCTION app.get_wigle_safe_limit(p_kind TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN pg_catalog.count(*) < 3 THEN NULL
    ELSE LEAST(
      pg_catalog.min(v.requests_in_prior_hour),
      pg_catalog.min(v.results_in_prior_hour)
    ) - 1
  END
  FROM app.v_wigle_rate_limit_events AS v
  WHERE v.kind = p_kind
    AND v.wall_hit_at > pg_catalog.now() - INTERVAL '30 days';
$$;

REVOKE EXECUTE ON FUNCTION app.get_wigle_safe_limit(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_wigle_safe_limit(TEXT) TO shadowcheck_admin;

-- Restore the prior non-circular profile calculation while retaining
-- SECURITY DEFINER, the pinned search_path, and restricted function execution.
CREATE FUNCTION app.get_wigle_reset_profile(p_kind TEXT)
RETURNS TABLE (
  likely_reset_utc_hour INT,
  avg_recovery_minutes NUMERIC,
  reset_type TEXT,
  confidence TEXT,
  sample_count INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_count INT;
  v_hour_stddev NUMERIC;
  v_avg_recovery NUMERIC;
  v_modal_hour INT;
BEGIN
  SELECT
    pg_catalog.count(*)::INT,
    pg_catalog.stddev(v.recovery_utc_hour),
    pg_catalog.avg(v.recovery_minutes),
    pg_catalog.mode() WITHIN GROUP (ORDER BY v.recovery_utc_hour)
  INTO v_count, v_hour_stddev, v_avg_recovery, v_modal_hour
  FROM app.v_wigle_rate_limit_events AS v
  WHERE v.kind = p_kind
    AND v.recovery_utc_hour IS NOT NULL
    AND v.wall_hit_at > pg_catalog.now() - INTERVAL '60 days';

  IF v_count < 3 THEN
    RETURN QUERY
      SELECT NULL::INT, NULL::NUMERIC, 'insufficient_data'::TEXT, 'low'::TEXT, v_count;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_modal_hour,
    pg_catalog.round(v_avg_recovery, 1),
    CASE
      WHEN v_hour_stddev < 1.5 THEN 'fixed_clock'::TEXT
      ELSE 'rolling_window'::TEXT
    END,
    CASE
      WHEN v_count >= 10 AND v_hour_stddev < 1.0 THEN 'high'::TEXT
      WHEN v_count >= 5 AND v_hour_stddev < 2.0 THEN 'medium'::TEXT
      ELSE 'low'::TEXT
    END,
    v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION app.get_wigle_reset_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_wigle_reset_profile(TEXT) TO shadowcheck_admin;
