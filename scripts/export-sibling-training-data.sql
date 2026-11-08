-- Read-only export of active analyst labels for offline sibling-weight calibration.
-- Synthetic negatives are deliberately excluded; only analyst overrides are ground truth.
COPY (
  WITH network_positions AS (
    SELECT
      n.bssid,
      n.ssid,
      n.type,
      CASE
        WHEN n.bestlat <> 0 OR n.bestlon <> 0 THEN n.bestlat
        ELSE n.lastlat
      END AS lat,
      CASE
        WHEN n.bestlat <> 0 OR n.bestlon <> 0 THEN n.bestlon
        ELSE n.lastlon
      END AS lon,
      (
        n.bestlat <> 0 OR n.bestlon <> 0 OR n.lastlat <> 0 OR n.lastlon <> 0
      ) AS has_location
    FROM app.networks n
    WHERE n.type = 'W'
  ),
  labeled_pairs AS (
    SELECT
      o.bssid1,
      o.bssid2,
      (o.relation = 'sibling')::int AS label,
      (p.bssid1 IS NOT NULL)::int AS candidate_present,
      p.confidence AS heuristic_confidence,
      COALESCE(
        p.distance_m,
        CASE
          WHEN n1.has_location AND n2.has_location THEN ST_Distance(
            ST_SetSRID(ST_MakePoint(n1.lon, n1.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(n2.lon, n2.lat), 4326)::geography
          )
        END
      ) AS distance_m,
      (
        n1.ssid <> ''
        AND n2.ssid <> ''
        AND lower(n1.ssid) = lower(n2.ssid)
      )::int AS ssid_exact_match
    FROM app.network_sibling_overrides o
    JOIN network_positions n1 ON n1.bssid = o.bssid1
    JOIN network_positions n2 ON n2.bssid = o.bssid2
    LEFT JOIN app.network_sibling_pairs p
      ON p.bssid1 = o.bssid1
      AND p.bssid2 = o.bssid2
      AND p.is_active = true
    WHERE o.is_active = true
  )
  SELECT
    bssid1,
    bssid2,
    label,
    candidate_present,
    heuristic_confidence,
    distance_m,
    ssid_exact_match
  FROM labeled_pairs
  ORDER BY bssid1, bssid2
) TO STDOUT WITH CSV HEADER;
