const { adminQuery } = require('../adminDbService');
const logger = require('../../logging/logger');

type SiblingRefreshOptions = {
  batchSize?: number;
  maxOctetDelta?: number;
  maxDistanceM?: number;
  minCandidateConf?: number;
  minStrongConf?: number;
  maxBatches?: number | null;
};

type SiblingRefreshResult = {
  success: boolean;
  batchesRun: number;
  seedsProcessed: number;
  rowsUpserted: number;
  lastCursor: string | null;
  executionTimeMs: number;
  completed: boolean;
};

type SiblingRefreshStatus = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  options: Required<SiblingRefreshOptions> | null;
  progress: {
    batchesRun: number;
    seedsProcessed: number;
    rowsUpserted: number;
    lastCursor: string | null;
  };
  lastResult: SiblingRefreshResult | null;
  lastError: string | null;
};

const DEFAULTS: Required<SiblingRefreshOptions> = {
  batchSize: 250,
  maxOctetDelta: 6,
  maxDistanceM: 1500,
  minCandidateConf: 0.9,
  minStrongConf: 0.97,
  maxBatches: null,
};

const state: SiblingRefreshStatus = {
  running: false,
  startedAt: null,
  finishedAt: null,
  options: null,
  progress: {
    batchesRun: 0,
    seedsProcessed: 0,
    rowsUpserted: 0,
    lastCursor: null,
  },
  lastResult: null,
  lastError: null,
};

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeOptions(options: SiblingRefreshOptions = {}): Required<SiblingRefreshOptions> {
  return {
    batchSize: Math.floor(clampNumber(options.batchSize, DEFAULTS.batchSize, 10, 10000)),
    maxOctetDelta: Math.floor(clampNumber(options.maxOctetDelta, DEFAULTS.maxOctetDelta, 1, 64)),
    maxDistanceM: clampNumber(options.maxDistanceM, DEFAULTS.maxDistanceM, 0, 100000),
    minCandidateConf: clampNumber(options.minCandidateConf, DEFAULTS.minCandidateConf, 0, 2),
    minStrongConf: clampNumber(options.minStrongConf, DEFAULTS.minStrongConf, 0, 2),
    maxBatches:
      options.maxBatches === null || options.maxBatches === undefined
        ? null
        : Math.floor(clampNumber(options.maxBatches, 1, 1, 100000)),
  };
}

async function runSiblingRefreshJob(
  options: SiblingRefreshOptions = {}
): Promise<SiblingRefreshResult> {
  const normalized = normalizeOptions(options);
  const started = Date.now();

  let cursor: string | null = null;
  let batchesRun = 0;
  let seedsProcessed = 0;
  let rowsUpserted = 0;
  let completed = true;

  while (true) {
    if (normalized.maxBatches !== null && batchesRun >= normalized.maxBatches) {
      completed = false;
      break;
    }

    const chunkSql = `
      WITH seeds AS (
        SELECT ne.bssid
        FROM app.api_network_explorer_mv ne
        WHERE ne.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
          AND ($2::text IS NULL OR ne.bssid > $2)
        ORDER BY ne.bssid
        LIMIT $1
      ),
      hits AS (
        SELECT s.bssid AS seed_bssid, r.*
        FROM seeds s
        CROSS JOIN LATERAL app.find_sibling_radios(s.bssid, $3, $4) r
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
      partner_stats AS (
        SELECT
          radio_bssid,
          COUNT(*) FILTER (WHERE ssid_same AND ssid_common) AS common_partner_count
        FROM (
          SELECT
            s.bssid1 AS radio_bssid,
            s.ssid_same,
            s.ssid_common
          FROM scored s
          UNION ALL
          SELECT
            s.bssid2 AS radio_bssid,
            s.ssid_same,
            s.ssid_common
          FROM scored s
        ) radio_pairs
        GROUP BY radio_bssid
      ),
      family_stats AS (
        SELECT
          family_nodes.ssid_norm,
          family_pairs.family_pair_count,
          COUNT(*) AS family_radio_count
        FROM (
          SELECT DISTINCT
            s.n1 AS ssid_norm,
            s.bssid1 AS radio_bssid
          FROM scored s
          WHERE s.ssid_same AND s.ssid_common AND s.n1 <> ''
          UNION
          SELECT DISTINCT
            s.n1 AS ssid_norm,
            s.bssid2 AS radio_bssid
          FROM scored s
          WHERE s.ssid_same AND s.ssid_common AND s.n1 <> ''
        ) family_nodes
        JOIN (
          SELECT
            s.n1 AS ssid_norm,
            COUNT(*) AS family_pair_count
          FROM scored s
          WHERE s.ssid_same AND s.ssid_common AND s.n1 <> ''
          GROUP BY s.n1
        ) family_pairs ON family_pairs.ssid_norm = family_nodes.ssid_norm
        GROUP BY family_nodes.ssid_norm, family_pairs.family_pair_count
      ),
      final_pairs AS (
        SELECT
          s.bssid1,
          s.bssid2,
          s.rule,
          GREATEST(0, (
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
            - CASE
                WHEN s.ssid_same AND s.ssid_common THEN
                  CASE
                    WHEN GREATEST(
                      COALESCE(ps1.common_partner_count, 0),
                      COALESCE(ps2.common_partner_count, 0)
                    ) >= 12 THEN 0.55
                    WHEN GREATEST(
                      COALESCE(ps1.common_partner_count, 0),
                      COALESCE(ps2.common_partner_count, 0)
                    ) >= 8 THEN 0.40
                    WHEN GREATEST(
                      COALESCE(ps1.common_partner_count, 0),
                      COALESCE(ps2.common_partner_count, 0)
                    ) >= 5 THEN 0.25
                    WHEN GREATEST(
                      COALESCE(ps1.common_partner_count, 0),
                      COALESCE(ps2.common_partner_count, 0)
                    ) >= 3 THEN 0.12
                    ELSE 0
                  END
                ELSE 0
              END
            - CASE
                WHEN s.ssid_same AND s.ssid_common THEN
                  CASE
                    WHEN COALESCE(fs.family_radio_count, 0) >= 18 THEN 0.25
                    WHEN COALESCE(fs.family_radio_count, 0) >= 10 THEN 0.15
                    WHEN COALESCE(fs.family_radio_count, 0) >= 6 THEN 0.08
                    ELSE 0
                  END
                ELSE 0
              END
          )) AS final_conf,
          s.d_last_octet,
          s.d_third_octet,
          s.ssid1,
          s.ssid2,
          s.frequency1,
          s.frequency2,
          s.distance_m
        FROM scored s
        LEFT JOIN partner_stats ps1 ON ps1.radio_bssid = s.bssid1
        LEFT JOIN partner_stats ps2 ON ps2.radio_bssid = s.bssid2
        LEFT JOIN family_stats fs ON fs.ssid_norm = s.n1
      ),
      upserted AS (
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
        WHERE f.final_conf >= $5
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
          computed_at = EXCLUDED.computed_at
        RETURNING 1
      )
      SELECT
        (SELECT COUNT(*)::int FROM seeds) AS seed_count,
        (SELECT COUNT(*)::int FROM upserted) AS upserted_count,
        (SELECT MAX(bssid)::text FROM seeds) AS next_cursor
    `;

    const result: any = await adminQuery(chunkSql, [
      normalized.batchSize,
      cursor,
      normalized.maxOctetDelta,
      normalized.maxDistanceM,
      normalized.minCandidateConf,
    ]);

    const row = result.rows[0] || {};
    const seedCount = Number(row.seed_count || 0);
    const upsertedCount = Number(row.upserted_count || 0);
    const nextCursor = row.next_cursor || null;

    if (seedCount === 0) {
      break;
    }

    batchesRun += 1;
    seedsProcessed += seedCount;
    rowsUpserted += upsertedCount;
    cursor = nextCursor;

    state.progress = {
      batchesRun,
      seedsProcessed,
      rowsUpserted,
      lastCursor: cursor,
    };

    if (batchesRun % 10 === 0) {
      logger.info('[Siblings] Batch progress', {
        batchesRun,
        seedsProcessed,
        rowsUpserted,
        lastCursor: cursor,
      });
    }
  }

  return {
    success: true,
    batchesRun,
    seedsProcessed,
    rowsUpserted,
    lastCursor: cursor,
    executionTimeMs: Date.now() - started,
    completed,
  };
}

function getSiblingRefreshStatus(): SiblingRefreshStatus {
  return {
    ...state,
    progress: { ...state.progress },
    options: state.options ? { ...state.options } : null,
    lastResult: state.lastResult ? { ...state.lastResult } : null,
  };
}

async function startSiblingRefresh(
  options: SiblingRefreshOptions = {}
): Promise<{ accepted: boolean; status: SiblingRefreshStatus }> {
  if (state.running) {
    return { accepted: false, status: getSiblingRefreshStatus() };
  }

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.lastError = null;
  state.lastResult = null;
  state.options = normalizeOptions(options);
  state.progress = {
    batchesRun: 0,
    seedsProcessed: 0,
    rowsUpserted: 0,
    lastCursor: null,
  };

  logger.info('[Siblings] Starting sibling refresh job', state.options);

  runSiblingRefreshJob(state.options)
    .then((result) => {
      state.lastResult = result;
      logger.info('[Siblings] Sibling refresh job completed', result);
    })
    .catch((err: any) => {
      state.lastError = err?.message || 'Unknown error';
      logger.error('[Siblings] Sibling refresh job failed', { error: err?.message });
    })
    .finally(() => {
      state.running = false;
      state.finishedAt = new Date().toISOString();
    });

  return { accepted: true, status: getSiblingRefreshStatus() };
}

async function getSiblingStats(): Promise<any> {
  const { rows } = await adminQuery(
    `
      SELECT
        COUNT(*)::int AS total_pairs,
        COUNT(*)::int AS active_pairs,
        COUNT(*) FILTER (WHERE confidence >= 0.97)::int AS strong_pairs,
        COUNT(*) FILTER (WHERE confidence < 0.97)::int AS candidate_pairs,
        ROUND(AVG(confidence)::numeric, 3) AS avg_confidence,
        MIN(computed_at) AS oldest_computed_at,
        MAX(computed_at) AS newest_computed_at
      FROM app.network_sibling_pairs
    `
  );
  return rows[0] || {};
}

module.exports = {
  startSiblingRefresh,
  getSiblingRefreshStatus,
  getSiblingStats,
  runSiblingRefreshJob,
};

export {};
