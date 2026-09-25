import { FLEET_SSID_SQL_LIST, SIBLING_SCORING } from './siblingDetectionConstants';

/** Inserted between `hits` and `dedup` when pair audit is enabled. */
const HIT_COMPETITION_CTE = `
  hit_competition AS (
    SELECT
      LEAST(seed_bssid, sibling_bssid) AS bssid1,
      GREATEST(seed_bssid, sibling_bssid) AS bssid2,
      jsonb_agg(
        jsonb_build_object(
          'rule', rule,
          'confidence', confidence,
          'seed_bssid', seed_bssid,
          'target_ssid', target_ssid,
          'sibling_ssid', sibling_ssid
        ) ORDER BY confidence DESC NULLS LAST, rule ASC
      ) AS competing_hits
    FROM hits
    GROUP BY 1, 2
  ),`;

/** Between final_pairs and upserted: compares incoming row to current persisted row (pre-statement). */
const PAIR_REFRESH_AUDIT_CTE = `
  pair_refresh_audit AS (
    SELECT
      f.bssid1,
      f.bssid2,
      f.ssid1,
      f.ssid2,
      hc.competing_hits,
      d.rule AS dedup_winning_rule,
      d.confidence AS dedup_raw_max_confidence,
      d.corroborating_rules AS dedup_corroborating_rules,
      f.rule AS final_rule,
      f.final_conf AS incoming_confidence,
      (f.final_conf >= 0.90 AND f.final_conf < 0.92) AS would_hide_from_effective_view_cutoff,
      p.rule AS prev_persisted_rule,
      p.confidence AS prev_persisted_confidence,
      p.computed_at AS prev_computed_at,
      p.run_id AS prev_run_id,
      p.source AS prev_source,
      (p.bssid1 IS NOT NULL AND f.final_conf < p.confidence) AS would_downgrade_confidence,
      (
        p.bssid1 IS NOT NULL
        AND p.rule IN ('Class A', 'Unnamed Recursive (Class A)', 'Class B', 'Unnamed Recursive (Class B)', 'Class C', 'Unnamed Recursive (Class C)', 'AIRLINK_DELTA1_TWIN', 'SIERRA_DELTA1_TWIN', 'last_octet_sequential', 'ssid_exact_sequential', 'middle_octets_sequential')
        AND f.rule NOT IN ('Class A', 'Unnamed Recursive (Class A)', 'Class B', 'Unnamed Recursive (Class B)', 'Class C', 'Unnamed Recursive (Class C)', 'AIRLINK_DELTA1_TWIN', 'SIERRA_DELTA1_TWIN', 'last_octet_sequential', 'ssid_exact_sequential', 'middle_octets_sequential')
      ) AS would_replace_deterministic_with_probabilistic,
      (
        hc.competing_hits IS NOT NULL
        AND jsonb_array_length(hc.competing_hits) >= 2
        AND (hc.competing_hits->0->>'confidence')::numeric = (hc.competing_hits->1->>'confidence')::numeric
      ) AS top_two_hits_confidence_tie
    FROM final_pairs f
    INNER JOIN dedup d ON d.bssid1 = f.bssid1 AND d.bssid2 = f.bssid2
    LEFT JOIN hit_competition hc ON hc.bssid1 = f.bssid1 AND hc.bssid2 = f.bssid2
    LEFT JOIN app.network_sibling_pairs p ON p.bssid1 = f.bssid1 AND p.bssid2 = f.bssid2
    LEFT JOIN app.network_sibling_overrides nso
      ON nso.bssid1 = f.bssid1
     AND nso.bssid2 = f.bssid2
     AND nso.relation = 'not_sibling'
     AND nso.is_active = true
    WHERE f.final_conf >= $5
      AND nso.bssid1 IS NULL
  ),`;

const REFRESH_CHUNK_SQL_CORE = `
  WITH seeds AS (
    SELECT ne.bssid
    FROM app.api_network_explorer_mv ne
    WHERE ne.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
      __TARGET_FILTER_SLOT__
      AND ($2::text IS NULL OR ne.bssid > $2)
      AND (NOT $6::boolean OR ne.last_seen > COALESCE($7::timestamptz, '1970-01-01'::timestamptz))
    ORDER BY ne.bssid
    LIMIT $1
  ),
  hits AS (
    SELECT s.bssid AS seed_bssid, r.*
    FROM seeds s
    CROSS JOIN LATERAL app.find_sibling_radios(s.bssid, $3, $4) r
  ),__HIT_COMPETITION_SLOT__
  dedup AS (
    -- Deterministic winner selection with explicit stable ordering.
    -- Rule priority: sequential rules are deterministic (priority 1-3),
    -- mac_only_match is probabilistic (priority 100), others default to 999.
    -- Ordering: confidence DESC, rule_priority ASC, sibling_bssid ASC
    SELECT DISTINCT ON (
      LEAST(seed_bssid, sibling_bssid),
      GREATEST(seed_bssid, sibling_bssid)
    )
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
      distance_m,
      matched_octets
    FROM hits
    ORDER BY
      LEAST(seed_bssid, sibling_bssid),
      GREATEST(seed_bssid, sibling_bssid),
      confidence DESC,
      CASE rule
        WHEN 'Class A' THEN 1
        WHEN 'Unnamed Recursive (Class A)' THEN 2
        WHEN 'Class B' THEN 3
        WHEN 'Unnamed Recursive (Class B)' THEN 4
        WHEN 'Class C' THEN 5
        WHEN 'Unnamed Recursive (Class C)' THEN 6
        WHEN 'AIRLINK_DELTA1_TWIN' THEN 7
        WHEN 'SIERRA_DELTA1_TWIN' THEN 8
        WHEN 'last_octet_sequential' THEN 10
        WHEN 'ssid_exact_sequential' THEN 11
        WHEN 'middle_octets_sequential' THEN 12
        WHEN 'mac_only_match' THEN 100
        ELSE 999
      END ASC,
      sibling_bssid ASC
  ),
  corroboration AS (
    SELECT
      LEAST(seed_bssid, sibling_bssid) AS bssid1,
      GREATEST(seed_bssid, sibling_bssid) AS bssid2,
      array_agg(DISTINCT rule) AS corroborating_rules
    FROM hits
    GROUP BY 1, 2
  ),
  scored AS (
    SELECT
      d.*,
      c.corroborating_rules,
      lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-zA-Z0-9]+', '', 'g')) AS n1,
      lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-zA-Z0-9]+', '', 'g')) AS n2,
      (
        lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-zA-Z0-9]+', '', 'g'))
        =
        lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-zA-Z0-9]+', '', 'g'))
      ) AS ssid_same,
      (
        lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-zA-Z0-9]+', '', 'g')) IN (${FLEET_SSID_SQL_LIST})
        OR lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-zA-Z0-9]+', '', 'g')) LIKE 'hmc%'
      ) AS ssid_common,
      0 AS distance_penalty
    FROM dedup d
    LEFT JOIN corroboration c ON c.bssid1 = d.bssid1 AND c.bssid2 = d.bssid2
  ),
  partner_stats AS (
    SELECT
      radio_bssid,
      COUNT(*) FILTER (WHERE ssid_same AND ssid_common) AS common_partner_count
    FROM (
      SELECT s.bssid1 AS radio_bssid, s.ssid_same, s.ssid_common FROM scored s
      UNION ALL
      SELECT s.bssid2 AS radio_bssid, s.ssid_same, s.ssid_common FROM scored s
    ) radio_pairs
    GROUP BY radio_bssid
  ),
  family_stats AS (
    SELECT
      family_nodes.ssid_norm,
      family_pairs.family_pair_count,
      COUNT(*) AS family_radio_count
    FROM (
      SELECT DISTINCT s.n1 AS ssid_norm, s.bssid1 AS radio_bssid FROM scored s WHERE s.ssid_same AND s.ssid_common AND s.n1 <> ''
      UNION
      SELECT DISTINCT s.n1 AS ssid_norm, s.bssid2 AS radio_bssid FROM scored s WHERE s.ssid_same AND s.ssid_common AND s.n1 <> ''
    ) family_nodes
    JOIN (
      SELECT s.n1 AS ssid_norm, COUNT(*) AS family_pair_count FROM scored s WHERE s.ssid_same AND s.ssid_common AND s.n1 <> '' GROUP BY s.n1
    ) family_pairs ON family_pairs.ssid_norm = family_nodes.ssid_norm
    GROUP BY family_nodes.ssid_norm, family_pairs.family_pair_count
  ),
  final_pairs AS (
    SELECT
      s.bssid1,
      s.bssid2,
      s.rule,
      LEAST(1.000, CASE
        WHEN s.rule IN ('Class A', 'Unnamed Recursive (Class A)') THEN LEAST(0.900, s.confidence)
        WHEN s.rule IN ('Class B', 'Unnamed Recursive (Class B)') THEN LEAST(0.850, s.confidence)
        WHEN s.rule IN ('Class C', 'Unnamed Recursive (Class C)') THEN LEAST(0.800, s.confidence)
        -- Mist VAP/Cross-Band: cap at 0.900 when both SSIDs are non-empty and unrelated (no prefix match).
        -- Prevents cross-org fleet pairs like meijer-corp ↔ paxar from reaching confidence 1.0.
        WHEN s.rule IN ('Mist Systems VAP (Class A)', 'Mist Systems Cross-Band (Class A)')
             AND s.n1 <> '' AND s.n2 <> ''
             AND NOT (s.n1 = s.n2 OR s.n1 LIKE s.n2 || '%' OR s.n2 LIKE s.n1 || '%')
             THEN LEAST(0.900, s.confidence)
        WHEN s.rule IN ('AIRLINK_DELTA1_TWIN', 'SIERRA_DELTA1_TWIN', 'last_octet_sequential', 'ssid_exact_sequential', 'middle_octets_sequential') THEN s.confidence
        ELSE GREATEST(0, (
          s.confidence
          - s.distance_penalty
          + CASE
              WHEN s.n1 <> '' AND s.n2 <> ''
               AND (s.n1 = s.n2 OR s.n1 LIKE s.n2 || '%' OR s.n2 LIKE s.n1 || '%') THEN ${SIBLING_SCORING.SSID_FUZZY_MATCH_BONUS}
              ELSE 0
            END
          - CASE
              WHEN s.ssid_same AND s.ssid_common THEN
                CASE
                  WHEN GREATEST(COALESCE(ps1.common_partner_count, 0), COALESCE(ps2.common_partner_count, 0)) >= ${SIBLING_SCORING.PARTNER_PENALTY_COUNTS[0]} THEN ${SIBLING_SCORING.PARTNER_PENALTY_VALUES[0]}
                  WHEN GREATEST(COALESCE(ps1.common_partner_count, 0), COALESCE(ps2.common_partner_count, 0)) >= ${SIBLING_SCORING.PARTNER_PENALTY_COUNTS[1]} THEN ${SIBLING_SCORING.PARTNER_PENALTY_VALUES[1]}
                  WHEN GREATEST(COALESCE(ps1.common_partner_count, 0), COALESCE(ps2.common_partner_count, 0)) >= ${SIBLING_SCORING.PARTNER_PENALTY_COUNTS[2]} THEN ${SIBLING_SCORING.PARTNER_PENALTY_VALUES[2]}
                  WHEN GREATEST(COALESCE(ps1.common_partner_count, 0), COALESCE(ps2.common_partner_count, 0)) >= ${SIBLING_SCORING.PARTNER_PENALTY_COUNTS[3]} THEN ${SIBLING_SCORING.PARTNER_PENALTY_VALUES[3]}
                  ELSE 0
                END
              ELSE 0
            END
          - CASE
              WHEN s.ssid_same AND s.ssid_common THEN
                CASE
                  WHEN COALESCE(fs.family_radio_count, 0) >= ${SIBLING_SCORING.FAMILY_PENALTY_COUNTS[0]} THEN ${SIBLING_SCORING.FAMILY_PENALTY_VALUES[0]}
                  WHEN COALESCE(fs.family_radio_count, 0) >= ${SIBLING_SCORING.FAMILY_PENALTY_COUNTS[1]} THEN ${SIBLING_SCORING.FAMILY_PENALTY_VALUES[1]}
                  WHEN COALESCE(fs.family_radio_count, 0) >= ${SIBLING_SCORING.FAMILY_PENALTY_COUNTS[2]} THEN ${SIBLING_SCORING.FAMILY_PENALTY_VALUES[2]}
                  ELSE 0
                END
              ELSE 0
            END
        ))
      END) AS final_conf,
      s.d_last_octet,
      s.d_third_octet,
      s.ssid1,
      s.ssid2,
      s.frequency1,
      s.frequency2,
      s.distance_m,
      s.matched_octets,
      s.corroborating_rules
    FROM scored s
    LEFT JOIN partner_stats ps1 ON ps1.radio_bssid = s.bssid1
    LEFT JOIN partner_stats ps2 ON ps2.radio_bssid = s.bssid2
    LEFT JOIN family_stats fs ON fs.ssid_norm = s.n1
  ),__PAIR_AUDIT_SLOT__
  upserted AS (
    __UPSERT_LOGIC_SLOT__
  )
__FINAL_SELECT__`;

const UPSERT_LOGIC_PROD = `INSERT INTO app.network_sibling_pairs (
      bssid1, bssid2, rule, confidence,
      d_last_octet, d_third_octet, ssid1, ssid2,
      frequency1, frequency2, distance_m,
      matched_octets, pair_strength, quality_scope, computed_at,
      run_id,
      corroborating_rules
    )
    SELECT
      f.bssid1, f.bssid2, f.rule, f.final_conf,
      f.d_last_octet, f.d_third_octet, f.ssid1, f.ssid2,
      f.frequency1, f.frequency2, f.distance_m,
      f.matched_octets,
      CASE
        WHEN f.rule = 'manual_confirmed' THEN 'verified'
        WHEN f.final_conf = 1.000 THEN 'strong'
        WHEN f.final_conf >= 0.85 THEN 'candidate'
        ELSE 'weak'
      END,
      'default', now(), $8::integer, f.corroborating_rules
    FROM final_pairs f
    LEFT JOIN app.network_sibling_overrides nso
      ON nso.bssid1 = f.bssid1 AND nso.bssid2 = f.bssid2 AND nso.relation = 'not_sibling' AND nso.is_active = true
    WHERE f.final_conf >= $5 AND nso.bssid1 IS NULL
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
      matched_octets = EXCLUDED.matched_octets,
      pair_strength = EXCLUDED.pair_strength,
      quality_scope = EXCLUDED.quality_scope,
      computed_at = EXCLUDED.computed_at,
      run_id = EXCLUDED.run_id,
      corroborating_rules = array(
        SELECT DISTINCT unnest(network_sibling_pairs.corroborating_rules || EXCLUDED.corroborating_rules)
      )
    WHERE
      EXCLUDED.confidence > network_sibling_pairs.confidence
      OR (
        EXCLUDED.rule IN ('Class A', 'Unnamed Recursive (Class A)', 'Class B', 'Unnamed Recursive (Class B)', 'Class C', 'Unnamed Recursive (Class C)', 'AIRLINK_DELTA1_TWIN', 'SIERRA_DELTA1_TWIN', 'last_octet_sequential', 'ssid_exact_sequential', 'middle_octets_sequential')
        AND network_sibling_pairs.rule NOT IN ('Class A', 'Unnamed Recursive (Class A)', 'Class B', 'Unnamed Recursive (Class B)', 'Class C', 'Unnamed Recursive (Class C)', 'AIRLINK_DELTA1_TWIN', 'SIERRA_DELTA1_TWIN', 'last_octet_sequential', 'ssid_exact_sequential', 'middle_octets_sequential')
      )
    RETURNING 1`;

const UPSERT_LOGIC_READONLY = 'SELECT 0::int AS affected WHERE FALSE';

const FINAL_SELECT_BASE = `  SELECT
    (SELECT COUNT(*)::int FROM seeds) AS seed_count,
    (SELECT COUNT(*)::int FROM upserted) AS upserted_count,
    (SELECT MAX(bssid)::text FROM seeds) AS next_cursor`;

const FINAL_SELECT_AUDIT = `  SELECT
    (SELECT COUNT(*)::int FROM seeds) AS seed_count,
    (SELECT COUNT(*)::int FROM upserted) AS upserted_count,
    (SELECT MAX(bssid)::text FROM seeds) AS next_cursor,
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(pra) ORDER BY pra.bssid1, pra.bssid2)
       FROM pair_refresh_audit pra
       WHERE pra.would_downgrade_confidence
          OR pra.would_replace_deterministic_with_probabilistic
          OR pra.would_hide_from_effective_view_cutoff
          OR pra.top_two_hits_confidence_tie
          OR lower(coalesce(pra.ssid1, '')) LIKE 'pas%'
          OR lower(coalesce(pra.ssid2, '')) LIKE 'pas%'
          OR lower(coalesce(pra.ssid1, '')) LIKE 'mdt%'
          OR lower(coalesce(pra.ssid2, '')) LIKE 'mdt%'
          OR lower(regexp_replace(coalesce(pra.ssid1, ''), '[^a-zA-Z0-9]+', '', 'g')) = 'pasrig'
          OR lower(regexp_replace(coalesce(pra.ssid2, ''), '[^a-zA-Z0-9]+', '', 'g')) = 'pasrig'
      ),
      '[]'::jsonb
    ) AS debug_audit_events`;

/**
 * Forensic batch SQL for sibling refresh.
 * Supports true read-only simulation via `options.readOnly`.
 * Supports targeting specific BSSIDs via `options.targetBssids` (uses $9).
 */
function buildRefreshChunkSql(
  options: {
    pairAudit?: boolean;
    readOnly?: boolean;
    targetBssids?: boolean;
  } = {}
): string {
  const hitSlot = options.pairAudit ? HIT_COMPETITION_CTE : '';
  const auditSlot = options.pairAudit ? PAIR_REFRESH_AUDIT_CTE : '';
  const upsertLogic = options.readOnly ? UPSERT_LOGIC_READONLY : UPSERT_LOGIC_PROD;
  const finalSelect = options.pairAudit ? FINAL_SELECT_AUDIT : FINAL_SELECT_BASE;
  const targetSlot = options.targetBssids ? 'AND ne.bssid = ANY($9::text[])' : '';

  return REFRESH_CHUNK_SQL_CORE.replace('__HIT_COMPETITION_SLOT__', hitSlot)
    .replace('__PAIR_AUDIT_SLOT__', auditSlot)
    .replace('__UPSERT_LOGIC_SLOT__', upsertLogic)
    .replace('__FINAL_SELECT__', finalSelect)
    .replace('__TARGET_FILTER_SLOT__', targetSlot);
}

const REFRESH_CHUNK_SQL = buildRefreshChunkSql({ pairAudit: false, readOnly: false });

const SIBLING_STATS_SQL = `
  SELECT
    COUNT(*)::int AS total_pairs,
    COUNT(*)::int AS active_pairs,
    COUNT(*) FILTER (WHERE confidence >= 0.97)::int AS strong_pairs,
    COUNT(*) FILTER (WHERE confidence < 0.97)::int AS candidate_pairs,
    ROUND(AVG(confidence)::numeric, 3) AS avg_confidence,
    MIN(computed_at) AS oldest_computed_at,
    MAX(computed_at) AS newest_computed_at
  FROM app.network_sibling_pairs
`;

const SIBLING_STATS_BY_RULE_SQL = `
  SELECT
    rule,
    COUNT(*)::int                              AS pair_count,
    ROUND(AVG(confidence)::numeric, 3)         AS avg_confidence,
    MAX(computed_at)                           AS last_run_at
  FROM app.network_sibling_pairs
  GROUP BY rule
  ORDER BY pair_count DESC
`;

const SIBLING_COVERAGE_SQL = `
  WITH stats AS (
    SELECT
      (SELECT COUNT(*)::double precision FROM app.networks WHERE type = 'W') AS total_wifi_bssids,
      (SELECT COUNT(DISTINCT bssid)::double precision FROM (
        SELECT bssid1 AS bssid FROM app.network_sibling_pairs
        UNION
        SELECT bssid2 AS bssid FROM app.network_sibling_pairs
      ) s) AS bssids_with_siblings
  )
  SELECT
    total_wifi_bssids::int,
    bssids_with_siblings::int,
    CASE
      WHEN total_wifi_bssids = 0 THEN 0.00
      ELSE ROUND((bssids_with_siblings * 100.0 / total_wifi_bssids)::numeric, 2)::float
    END AS coverage_pct
  FROM stats
`;

export {
  buildRefreshChunkSql,
  REFRESH_CHUNK_SQL,
  SIBLING_STATS_SQL,
  SIBLING_STATS_BY_RULE_SQL,
  SIBLING_COVERAGE_SQL,
};
