-- Tune sibling scoring to reduce false positives for common SSIDs at distance.
-- Keeps close-range matches while penalizing generic fleet/public SSIDs when far apart.

CREATE OR REPLACE FUNCTION app.refresh_network_sibling_pairs(
  p_max_octet_delta int DEFAULT 6,
  p_max_distance_m numeric DEFAULT 5000,
  p_min_candidate_conf numeric DEFAULT 0.70,
  p_min_strong_conf numeric DEFAULT 0.92,
  p_seed_limit int DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_rowcount bigint := 0;
BEGIN
  IF to_regprocedure('app.find_sibling_radios(text,integer,numeric)') IS NULL
     AND to_regprocedure('app.find_sibling_radios(text,integer,double precision)') IS NULL THEN
    RAISE EXCEPTION 'Missing function app.find_sibling_radios(text, integer, numeric/double precision)';
  END IF;

  WITH seeds AS (
    SELECT ne.bssid
    FROM app.api_network_explorer_mv ne
    WHERE ne.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    ORDER BY ne.bssid
    LIMIT COALESCE(p_seed_limit, 2147483647)
  ),
  hits AS (
    SELECT s.bssid AS seed_bssid, r.*
    FROM seeds s
    CROSS JOIN LATERAL app.find_sibling_radios(s.bssid, p_max_octet_delta, p_max_distance_m) r
  ),
  dedup AS (
    SELECT DISTINCT ON (LEAST(seed_bssid, sibling_bssid), GREATEST(seed_bssid, sibling_bssid))
      LEAST(seed_bssid, sibling_bssid) AS bssid1,
      GREATEST(seed_bssid, sibling_bssid) AS bssid2,
      rule,
      confidence,
      d_last_octet,
      d_third_octet,
      target_ssid AS ssid1,
      sibling_ssid AS ssid2,
      frequency_target AS frequency1,
      frequency_sibling AS frequency2,
      distance_m
    FROM hits
    ORDER BY LEAST(seed_bssid, sibling_bssid), GREATEST(seed_bssid, sibling_bssid), confidence DESC
  ),
  scored AS (
    SELECT
      d.*,
      lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) AS n1,
      lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g')) AS n2,
      (
        lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g'))
        =
        lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g'))
      ) AS ssid_same,
      (
        lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) IN (
          'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
          'mtasmartbus','kajeetsmartbus','somguest','somiot'
        )
      ) AS ssid_common,
      CASE
        WHEN d.distance_m IS NULL THEN 0
        WHEN (
          lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g'))
          =
          lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g'))
        )
        AND (
          lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) IN (
            'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
            'mtasmartbus','kajeetsmartbus','somguest','somiot'
          )
        ) THEN
          CASE
            WHEN d.distance_m <= 25 THEN 0
            WHEN d.distance_m <= 75 THEN 0.05
            WHEN d.distance_m <= 150 THEN 0.12
            WHEN d.distance_m <= 300 THEN 0.28
            WHEN d.distance_m <= 500 THEN 0.45
            WHEN d.distance_m <= 1000 THEN 0.70
            ELSE 1.00
          END
        WHEN d.distance_m <= 100 THEN 0
        WHEN d.distance_m <= 500 THEN 0.03
        WHEN d.distance_m <= 1500 THEN 0.08
        ELSE 0.15
      END AS distance_penalty
    FROM dedup d
  ),
  final_pairs AS (
    SELECT
      s.bssid1,
      s.bssid2,
      s.rule,
      (
        s.confidence
        - s.distance_penalty
        + CASE
            WHEN s.n1 <> '' AND s.n2 <> '' AND s.ssid_same AND s.ssid_common THEN
              CASE WHEN coalesce(s.distance_m, 999999) <= 75 THEN 0.03 ELSE 0 END
            WHEN s.n1 <> '' AND s.n2 <> ''
             AND (s.n1 = s.n2 OR s.n1 LIKE s.n2 || '%' OR s.n2 LIKE s.n1 || '%') THEN 0.07
            ELSE 0
          END
        - CASE
            WHEN s.rule = 'ssid_exact' AND s.ssid_same AND s.ssid_common AND coalesce(s.distance_m, 999999) > 150
            THEN 0.35
            ELSE 0
          END
      ) AS final_conf,
      s.d_last_octet,
      s.d_third_octet,
      s.ssid1,
      s.ssid2,
      s.frequency1,
      s.frequency2,
      s.distance_m
    FROM scored s
  )
  INSERT INTO app.network_sibling_pairs (
    bssid1, bssid2, rule, confidence,
    d_last_octet, d_third_octet, ssid1, ssid2,
    frequency1, frequency2, distance_m,
    quality_scope, computed_at
  )
  SELECT
    f.bssid1,
    f.bssid2,
    f.rule,
    f.final_conf,
    f.d_last_octet,
    f.d_third_octet,
    f.ssid1,
    f.ssid2,
    f.frequency1,
    f.frequency2,
    f.distance_m,
    'default',
    now()
  FROM final_pairs f
  WHERE f.final_conf >= p_min_candidate_conf
  ON CONFLICT (bssid1, bssid2) DO UPDATE
  SET
    rule = EXCLUDED.rule,
    confidence = EXCLUDED.confidence,
    d_last_octet = EXCLUDED.d_last_octet,
    d_third_octet = EXCLUDED.d_third_octet,
    ssid1 = EXCLUDED.ssid1,
    ssid2 = EXCLUDED.ssid2,
    frequency1 = EXCLUDED.frequency1,
    frequency2 = EXCLUDED.frequency2,
    distance_m = EXCLUDED.distance_m,
    quality_scope = EXCLUDED.quality_scope,
    computed_at = EXCLUDED.computed_at;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  RETURN v_rowcount;
END;
$$;
