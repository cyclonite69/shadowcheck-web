-- This migration is intentionally transaction-free. The migration runner and
-- the test-only command provide the transaction boundary.

SET search_path TO app, public;

ALTER TABLE app.wigle_ledger_events
  ADD COLUMN IF NOT EXISTS requests_in_prior_24h INTEGER
    CHECK (
      requests_in_prior_24h IS NULL
      OR requests_in_prior_24h >= 0
    );

COMMENT ON COLUMN app.wigle_ledger_events.requests_in_prior_24h IS
  'Rolling 24-hour request count captured immediately before this attempt was added to the in-memory ledger. Legacy rows remain NULL when the count cannot be established.';

-- Snapshot values are written on INSERT and must not be rewritten later.
-- Event outcome UPDATEs remain allowed as long as they leave the snapshot
-- unchanged. DELETE and TRUNCATE are blocked to preserve the ledger history.
CREATE OR REPLACE FUNCTION app.guard_wigle_ledger_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'app.wigle_ledger_events is append-only; % is prohibited', TG_OP;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.requests_in_prior_24h IS DISTINCT FROM NEW.requests_in_prior_24h THEN
    RAISE EXCEPTION 'requests_in_prior_24h is immutable after insert';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION app.guard_wigle_ledger_append_only() FROM PUBLIC;

CREATE OR REPLACE TRIGGER wigle_ledger_guard_snapshot_and_delete
BEFORE UPDATE OF requests_in_prior_24h OR DELETE
ON app.wigle_ledger_events
FOR EACH ROW
EXECUTE FUNCTION app.guard_wigle_ledger_append_only();

CREATE OR REPLACE TRIGGER wigle_ledger_guard_truncate
BEFORE TRUNCATE
ON app.wigle_ledger_events
FOR EACH STATEMENT
EXECUTE FUNCTION app.guard_wigle_ledger_append_only();

-- Explicitly drop the dollar-quoted functions before replacing the view.
-- Do not rely on DROP VIEW ... CASCADE.
DROP FUNCTION IF EXISTS app.get_wigle_safe_limit(TEXT);
DROP FUNCTION IF EXISTS app.get_wigle_reset_profile(TEXT);
DROP VIEW IF EXISTS app.v_wigle_rate_limit_events;

CREATE VIEW app.v_wigle_rate_limit_events AS
WITH wall_hits AS (
  SELECT
    e.id,
    e.kind,
    e.requested_at AS wall_hit_at,
    e.retry_after_hint,
    e.requests_in_prior_24h
  FROM app.wigle_ledger_events AS e
  WHERE e.status = 'rate_limited'
     OR e.http_status = 429
),
lagged AS (
  SELECT
    w.*,
    pg_catalog.lag(w.wall_hit_at) OVER (
      PARTITION BY w.kind
      ORDER BY w.wall_hit_at, w.id
    ) AS previous_wall_hit_at
  FROM wall_hits AS w
),
marked AS (
  SELECT
    l.*,
    CASE
      WHEN l.previous_wall_hit_at IS NULL
        OR l.wall_hit_at - l.previous_wall_hit_at > INTERVAL '1 hour'
      THEN 1
      ELSE 0
    END AS is_new_episode
  FROM lagged AS l
),
episodes AS (
  SELECT
    m.*,
    pg_catalog.sum(m.is_new_episode) OVER (
      PARTITION BY m.kind
      ORDER BY m.wall_hit_at, m.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS episode_number
  FROM marked AS m
)
SELECT
  e.id,
  e.kind,
  e.wall_hit_at,
  e.retry_after_hint,
  e.requests_in_prior_24h,
  e.is_new_episode,
  e.episode_number,
  recovery.requested_at AS first_ok_after_wall,
  (
    EXTRACT(EPOCH FROM (recovery.requested_at - e.wall_hit_at))::INTEGER / 60
  ) AS recovery_minutes,
  EXTRACT(
    HOUR FROM (recovery.requested_at AT TIME ZONE 'UTC')
  )::INTEGER AS recovery_utc_hour
FROM episodes AS e
LEFT JOIN LATERAL (
  SELECT x.requested_at
  FROM app.wigle_ledger_events AS x
  WHERE x.kind = e.kind
    AND x.id > e.id
    AND x.status = 'success'
    AND x.phase = 'complete'
    AND x.requested_at > e.wall_hit_at
    AND x.requested_at <= e.wall_hit_at + INTERVAL '24 hours'
  ORDER BY x.id ASC
  LIMIT 1
) AS recovery ON TRUE;

GRANT SELECT ON app.v_wigle_rate_limit_events TO shadowcheck_admin;

COMMENT ON VIEW app.v_wigle_rate_limit_events IS
  'Each row is a WiGLE rate-limit event with its captured 24-hour request count, episode, and recovery timing. Legacy rows without a snapshot remain NULL.';

CREATE FUNCTION app.get_wigle_safe_limit(p_kind TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH valid_episode_samples AS (
    SELECT DISTINCT ON (v.kind, v.episode_number)
      v.kind,
      v.episode_number,
      v.requests_in_prior_24h
    FROM app.v_wigle_rate_limit_events AS v
    WHERE v.kind = p_kind
      AND v.wall_hit_at > pg_catalog.now() - INTERVAL '30 days'
      AND v.requests_in_prior_24h IS NOT NULL
    ORDER BY v.kind, v.episode_number, v.wall_hit_at, v.id
  )
  SELECT CASE
    WHEN pg_catalog.count(*) < 3 THEN NULL
    WHEN pg_catalog.min(s.requests_in_prior_24h) - 1 < 1 THEN NULL
    ELSE pg_catalog.min(s.requests_in_prior_24h) - 1
  END
  FROM valid_episode_samples AS s;
$$;

REVOKE EXECUTE ON FUNCTION app.get_wigle_safe_limit(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_wigle_safe_limit(TEXT) TO shadowcheck_admin;

COMMENT ON FUNCTION app.get_wigle_safe_limit(TEXT) IS
  'Returns a conservative request limit from at least three distinct 429 episodes with valid snapshots in the last 30 days. Zero is a valid learned limit.';

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
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_count INT;
  v_avg_recovery NUMERIC;
  v_mean_cos DOUBLE PRECISION;
  v_mean_sin DOUBLE PRECISION;
  v_resultant DOUBLE PRECISION;
  v_circular_stddev_hours DOUBLE PRECISION;
  v_mean_angle DOUBLE PRECISION;
  v_mean_hour DOUBLE PRECISION;
  v_likely_hour INT;
BEGIN
  SELECT
    pg_catalog.count(*)::INT,
    pg_catalog.avg(v.recovery_minutes),
    pg_catalog.avg(
      pg_catalog.cos(2.0 * pg_catalog.pi() * v.recovery_utc_hour / 24.0)
    ),
    pg_catalog.avg(
      pg_catalog.sin(2.0 * pg_catalog.pi() * v.recovery_utc_hour / 24.0)
    )
  INTO
    v_count,
    v_avg_recovery,
    v_mean_cos,
    v_mean_sin
  FROM app.v_wigle_rate_limit_events AS v
  WHERE v.kind = p_kind
    AND v.recovery_utc_hour IS NOT NULL
    AND v.wall_hit_at > pg_catalog.now() - INTERVAL '60 days';

  IF v_count < 3 THEN
    RETURN QUERY
      SELECT
        NULL::INT,
        NULL::NUMERIC,
        'insufficient_data'::TEXT,
        'low'::TEXT,
        v_count;
    RETURN;
  END IF;

  v_resultant := pg_catalog.sqrt(
    (v_mean_cos * v_mean_cos) + (v_mean_sin * v_mean_sin)
  );

  -- Circular standard deviation converted from radians to hours.
  -- The epsilon handles a fully scattered set whose resultant length is zero.
  v_circular_stddev_hours :=
    pg_catalog.sqrt(
      -2.0 * pg_catalog.ln(
        GREATEST(LEAST(v_resultant, 1.0), 1e-12)
      )
    ) * 24.0 / (2.0 * pg_catalog.pi());

  -- The circular mean is undefined when the resultant vector is effectively
  -- zero. In that case classify the sample, but do not report a misleading hour.
  IF v_resultant > 1e-12 THEN
    v_mean_angle := pg_catalog.atan2(v_mean_sin, v_mean_cos);
    v_mean_hour := v_mean_angle * 24.0 / (2.0 * pg_catalog.pi());

    IF v_mean_hour < 0 THEN
      v_mean_hour := v_mean_hour + 24.0;
    END IF;

    v_likely_hour := pg_catalog.floor(v_mean_hour + 0.5)::INT;

    IF v_likely_hour = 24 THEN
      v_likely_hour := 0;
    END IF;
  ELSE
    v_likely_hour := NULL;
  END IF;

  RETURN QUERY
  SELECT
    v_likely_hour,
    pg_catalog.round(v_avg_recovery, 1),
    CASE
      WHEN v_circular_stddev_hours < 1.5 THEN 'fixed_clock'::TEXT
      ELSE 'rolling_window'::TEXT
    END,
    CASE
      WHEN v_count >= 10 AND v_circular_stddev_hours < 1.0 THEN 'high'::TEXT
      WHEN v_count >= 5 AND v_circular_stddev_hours < 2.0 THEN 'medium'::TEXT
      ELSE 'low'::TEXT
    END,
    v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION app.get_wigle_reset_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.get_wigle_reset_profile(TEXT) TO shadowcheck_admin;

COMMENT ON FUNCTION app.get_wigle_reset_profile(TEXT) IS
  'Classifies observed UTC recovery hours using circular statistics. The hour is the circular mean of the first-success-after-wall-hit UTC hour, not a known WiGLE server reset timestamp. Thresholds remain 1.5, 1.0, and 2.0 hours.';
