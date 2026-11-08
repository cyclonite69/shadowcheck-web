-- Read-only paired observation export for offline sibling co-observation analysis.
-- Coordinates are scanner GPS locations, not verified transmitter locations.
COPY (
  WITH active_pairs AS (
    SELECT
      p.bssid1,
      p.bssid2,
      p.rule,
      p.confidence,
      COALESCE(o.relation, 'unreviewed') AS label
    FROM app.network_sibling_pairs p
    LEFT JOIN app.network_sibling_overrides o
      ON o.bssid1 = p.bssid1
      AND o.bssid2 = p.bssid2
      AND o.is_active = true
    WHERE p.is_active = true
  ),
  endpoints AS (
    SELECT bssid1 AS bssid FROM active_pairs
    UNION
    SELECT bssid2 AS bssid FROM active_pairs
  ),
  observation_windows AS (
    SELECT
      o.bssid,
      o.device_id,
      o.source_tag,
      date_bin(
        INTERVAL '5 minutes',
        o."time",
        TIMESTAMPTZ '2000-01-01 00:00:00+00'
      ) AS window_start,
      COUNT(*)::int AS observation_count,
      AVG(o.lat)::double precision AS latitude,
      AVG(o.lon)::double precision AS longitude,
      AVG(o.level)::double precision AS mean_signal_dbm
    FROM app.observations o
    JOIN endpoints e ON e.bssid = o.bssid
    WHERE o.lat BETWEEN -90 AND 90
      AND o.lon BETWEEN -180 AND 180
    GROUP BY o.bssid, o.device_id, o.source_tag, window_start
  ),
  paired_windows AS (
    SELECT
      p.bssid1,
      p.bssid2,
      a.device_id,
      a.source_tag,
      a.window_start,
      a.observation_count AS observations_a,
      a.latitude AS latitude_a,
      a.longitude AS longitude_a,
      a.mean_signal_dbm AS mean_signal_a,
      b.observation_count AS observations_b,
      b.latitude AS latitude_b,
      b.longitude AS longitude_b,
      b.mean_signal_dbm AS mean_signal_b
    FROM active_pairs p
    JOIN observation_windows a ON a.bssid = p.bssid1
    JOIN observation_windows b
      ON b.bssid = p.bssid2
      AND b.device_id = a.device_id
      AND b.source_tag = a.source_tag
      AND b.window_start = a.window_start
  )
  SELECT
    p.bssid1,
    p.bssid2,
    p.rule,
    p.confidence,
    p.label,
    pw.device_id,
    pw.source_tag,
    to_char(
      pw.window_start AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ) AS window_start,
    pw.observations_a,
    pw.latitude_a,
    pw.longitude_a,
    pw.mean_signal_a,
    pw.observations_b,
    pw.latitude_b,
    pw.longitude_b,
    pw.mean_signal_b
  FROM active_pairs p
  LEFT JOIN paired_windows pw ON pw.bssid1 = p.bssid1 AND pw.bssid2 = p.bssid2
  ORDER BY p.bssid1, p.bssid2, pw.device_id, pw.source_tag, pw.window_start
) TO STDOUT WITH CSV HEADER;
