-- ============================================================================
-- SIBLING ML TRAINING DATA EXPORT
-- Generates a labeled dataset for training a sibling classifier
-- ============================================================================

COPY (
  WITH labeled_data AS (
    -- Positive Samples (Manual Overrides)
    SELECT 
      p.confidence as heuristic_conf,
      p.distance_m,
      p.frequency1,
      p.frequency2,
      abs(p.frequency1 - p.frequency2) as freq_delta,
      p.d_last_octet,
      (p.ssid1 = p.ssid2)::int as ssid_exact_match,
      (p.ssid1 IS NULL OR p.ssid1 = '')::int as ssid_empty,
      1 as label -- Positive
    FROM app.network_sibling_pairs p
    JOIN app.network_sibling_overrides o 
      ON p.bssid1 = o.bssid1 AND p.bssid2 = o.bssid2
    WHERE o.relation = 'sibling' AND o.is_active = true

    UNION ALL

    -- Negative Samples (Manual Overrides)
    SELECT 
      p.confidence as heuristic_conf,
      p.distance_m,
      p.frequency1,
      p.frequency2,
      abs(p.frequency1 - p.frequency2) as freq_delta,
      p.d_last_octet,
      (p.ssid1 = p.ssid2)::int as ssid_exact_match,
      (p.ssid1 IS NULL OR p.ssid1 = '')::int as ssid_empty,
      0 as label -- Negative
    FROM app.network_sibling_pairs p
    JOIN app.network_sibling_overrides o 
      ON p.bssid1 = o.bssid1 AND p.bssid2 = o.bssid2
    WHERE o.relation = 'not_sibling' AND o.is_active = true

    UNION ALL

    -- Synthetic Negative Samples (High distance, common SSID)
    -- This helps the model learn what we currently penalize heavily
    SELECT 
      confidence as heuristic_conf,
      distance_m,
      frequency1,
      frequency2,
      abs(frequency1 - frequency2) as freq_delta,
      d_last_octet,
      (ssid1 = ssid2)::int as ssid_exact_match,
      (ssid1 IS NULL OR ssid1 = '')::int as ssid_empty,
      0 as label
    FROM app.network_sibling_pairs
    WHERE distance_m > 1000 AND confidence < 0.5
    LIMIT 200
  )
  SELECT * FROM labeled_data
) TO STDOUT WITH CSV HEADER;
