-- Read-only paired scanner-observation export for analyst-labeled sibling pairs.
-- Coordinates are scanner GPS locations, not verified transmitter locations.
BEGIN TRANSACTION READ ONLY;

COPY (
  WITH analyst_pairs AS (
    SELECT
      LEAST(o.bssid1, o.bssid2) AS bssid1,
      GREATEST(o.bssid1, o.bssid2) AS bssid2,
      o.relation AS label
    FROM app.network_sibling_overrides o
    WHERE o.is_active = true
      AND o.relation IN ('sibling', 'not_sibling')
  ),
  endpoints AS (
    SELECT bssid1 AS bssid FROM analyst_pairs
    UNION
    SELECT bssid2 AS bssid FROM analyst_pairs
  ),
  observation_windows AS (
    SELECT
      obs.bssid,
      obs.device_id,
      obs.source_tag,
      date_bin(
        INTERVAL '5 minutes',
        obs."time",
        TIMESTAMPTZ '2000-01-01 00:00:00+00'
      ) AS window_start,
      COUNT(*)::int AS observation_count,
      AVG(obs.lat)::double precision AS latitude,
      AVG(obs.lon)::double precision AS longitude
    FROM app.observations obs
    JOIN endpoints e ON e.bssid = obs.bssid
    WHERE obs.lat BETWEEN -90 AND 90
      AND obs.lon BETWEEN -180 AND 180
    GROUP BY obs.bssid, obs.device_id, obs.source_tag, window_start
  ),
  paired_windows AS (
    SELECT
      p.bssid1,
      p.bssid2,
      p.label,
      a.device_id,
      a.source_tag,
      a.window_start,
      a.observation_count AS observations_a,
      a.latitude AS latitude_a,
      a.longitude AS longitude_a,
      b.observation_count AS observations_b,
      b.latitude AS latitude_b,
      b.longitude AS longitude_b
    FROM analyst_pairs p
    JOIN observation_windows a ON a.bssid = p.bssid1
    JOIN observation_windows b
      ON b.bssid = p.bssid2
      AND b.device_id = a.device_id
      AND b.source_tag = a.source_tag
      AND b.window_start = a.window_start
  )
  SELECT
    bssid1,
    bssid2,
    label,
    device_id,
    source_tag,
    to_char(window_start AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS window_start,
    observations_a,
    latitude_a,
    longitude_a,
    observations_b,
    latitude_b,
    longitude_b
  FROM paired_windows
  ORDER BY bssid1, bssid2, device_id, source_tag, window_start
) TO STDOUT WITH CSV HEADER;

COMMIT;
