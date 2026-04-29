const logger = require('../../logging/logger');
import { REFRESH_CHUNK_SQL, SIBLING_STATS_SQL } from './siblingDetectionQueries';

// Four additional rule classes derived from manual ground truth analysis.
// Run once per refresh after the chunked REFRESH_CHUNK_SQL loop, as a single
// full-table pass. ON CONFLICT only upgrades confidence, never downgrades.
const EXTRA_RULES_SQL = `
  WITH upper_rotation AS (
    INSERT INTO app.network_sibling_pairs (
      bssid1, bssid2, rule, confidence, quality_scope, computed_at
    )
    SELECT
      LEAST(a.bssid, b.bssid),
      GREATEST(a.bssid, b.bssid),
      'upper_octet_rotation',
      0.95,
      'default',
      now()
    FROM app.networks a
    JOIN app.networks b
      ON SUBSTRING(b.bssid, 7) = SUBSTRING(a.bssid, 7)
     AND SUBSTRING(b.bssid, 1, 5) <> SUBSTRING(a.bssid, 1, 5)
     AND b.bssid > a.bssid
     AND b.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    WHERE a.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    ON CONFLICT (bssid1, bssid2) DO UPDATE
      SET rule        = EXCLUDED.rule,
          confidence  = EXCLUDED.confidence,
          quality_scope = EXCLUDED.quality_scope,
          computed_at = EXCLUDED.computed_at
      WHERE EXCLUDED.confidence > network_sibling_pairs.confidence
    RETURNING 1
  ),
  ssid_anchor AS (
    INSERT INTO app.network_sibling_pairs (
      bssid1, bssid2, rule, confidence, ssid1, ssid2, quality_scope, computed_at
    )
    SELECT
      LEAST(a.bssid, b.bssid),
      GREATEST(a.bssid, b.bssid),
      'ssid_anchor',
      0.97,
      a.ssid,
      b.ssid,
      'default',
      now()
    FROM app.networks a
    JOIN app.networks b
      ON b.ssid = a.ssid
     AND SUBSTRING(b.bssid, 1, 8) = SUBSTRING(a.bssid, 1, 8)
     AND b.bssid > a.bssid
     AND b.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    WHERE a.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
      AND a.ssid IS NOT NULL AND a.ssid <> ''
    ON CONFLICT (bssid1, bssid2) DO UPDATE
      SET rule        = EXCLUDED.rule,
          confidence  = EXCLUDED.confidence,
          ssid1       = EXCLUDED.ssid1,
          ssid2       = EXCLUDED.ssid2,
          quality_scope = EXCLUDED.quality_scope,
          computed_at = EXCLUDED.computed_at
      WHERE EXCLUDED.confidence > network_sibling_pairs.confidence
    RETURNING 1
  ),
  cross_oui_ssid AS (
    INSERT INTO app.network_sibling_pairs (
      bssid1, bssid2, rule, confidence, ssid1, ssid2, distance_m, quality_scope, computed_at
    )
    SELECT
      LEAST(a.bssid, b.bssid),
      GREATEST(a.bssid, b.bssid),
      'cross_oui_ssid_exact',
      0.88,
      a.ssid,
      b.ssid,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(COALESCE(a.bestlon, a.lastlon), COALESCE(a.bestlat, a.lastlat)), 4326)::geography,
        ST_SetSRID(ST_MakePoint(COALESCE(b.bestlon, b.lastlon), COALESCE(b.bestlat, b.lastlat)), 4326)::geography
      ),
      'default',
      now()
    FROM app.networks a
    JOIN app.networks b
      ON b.ssid = a.ssid
     AND SUBSTRING(b.bssid, 1, 8) <> SUBSTRING(a.bssid, 1, 8)
     AND b.bssid > a.bssid
     AND b.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    WHERE a.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
      AND a.ssid IS NOT NULL AND a.ssid <> ''
      AND COALESCE(a.bestlat, a.lastlat) IS NOT NULL
      AND COALESCE(a.bestlon, a.lastlon) IS NOT NULL
      AND COALESCE(b.bestlat, b.lastlat) IS NOT NULL
      AND COALESCE(b.bestlon, b.lastlon) IS NOT NULL
      AND ST_Distance(
        ST_SetSRID(ST_MakePoint(COALESCE(a.bestlon, a.lastlon), COALESCE(a.bestlat, a.lastlat)), 4326)::geography,
        ST_SetSRID(ST_MakePoint(COALESCE(b.bestlon, b.lastlon), COALESCE(b.bestlat, b.lastlat)), 4326)::geography
      ) < 200
    ON CONFLICT (bssid1, bssid2) DO UPDATE
      SET rule        = EXCLUDED.rule,
          confidence  = EXCLUDED.confidence,
          ssid1       = EXCLUDED.ssid1,
          ssid2       = EXCLUDED.ssid2,
          distance_m  = EXCLUDED.distance_m,
          quality_scope = EXCLUDED.quality_scope,
          computed_at = EXCLUDED.computed_at
      WHERE EXCLUDED.confidence > network_sibling_pairs.confidence
    RETURNING 1
  ),
  same_oui_proximity AS (
    -- BUG 2 FIX: OUI-only match requires actual spatial corroboration.
    -- Both networks must have location data AND be within 100m.
    -- Removed the NULL-location escape hatch that allowed OUI-only matches
    -- with no corroborating signal to score 0.93.
    INSERT INTO app.network_sibling_pairs (
      bssid1, bssid2, rule, confidence, distance_m, quality_scope, computed_at
    )
    SELECT
      LEAST(a.bssid, b.bssid),
      GREATEST(a.bssid, b.bssid),
      'same_oui_proximity',
      0.93,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(COALESCE(a.bestlon, a.lastlon), COALESCE(a.bestlat, a.lastlat)), 4326)::geography,
        ST_SetSRID(ST_MakePoint(COALESCE(b.bestlon, b.lastlon), COALESCE(b.bestlat, b.lastlat)), 4326)::geography
      ),
      'default',
      now()
    FROM app.networks a
    JOIN app.networks b
      ON SUBSTRING(b.bssid, 1, 8) = SUBSTRING(a.bssid, 1, 8)
     AND ABS(
           ('x' || SUBSTRING(b.bssid, 16, 2))::bit(8)::int -
           ('x' || SUBSTRING(a.bssid, 16, 2))::bit(8)::int
         ) BETWEEN 1 AND 6
     AND b.bssid > a.bssid
     AND b.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    WHERE a.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
      AND COALESCE(a.bestlat, a.lastlat) IS NOT NULL
      AND COALESCE(a.bestlon, a.lastlon) IS NOT NULL
      AND COALESCE(b.bestlat, b.lastlat) IS NOT NULL
      AND COALESCE(b.bestlon, b.lastlon) IS NOT NULL
      AND ST_Distance(
        ST_SetSRID(ST_MakePoint(COALESCE(a.bestlon, a.lastlon), COALESCE(a.bestlat, a.lastlat)), 4326)::geography,
        ST_SetSRID(ST_MakePoint(COALESCE(b.bestlon, b.lastlon), COALESCE(b.bestlat, b.lastlat)), 4326)::geography
      ) < 100
    ON CONFLICT (bssid1, bssid2) DO UPDATE
      SET rule        = EXCLUDED.rule,
          confidence  = EXCLUDED.confidence,
          distance_m  = EXCLUDED.distance_m,
          quality_scope = EXCLUDED.quality_scope,
          computed_at = EXCLUDED.computed_at
      WHERE EXCLUDED.confidence > network_sibling_pairs.confidence
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::int FROM upper_rotation)     AS upper_rotation_count,
    (SELECT COUNT(*)::int FROM ssid_anchor)        AS ssid_anchor_count,
    (SELECT COUNT(*)::int FROM cross_oui_ssid)     AS cross_oui_count,
    (SELECT COUNT(*)::int FROM same_oui_proximity) AS same_oui_proximity_count
`;
import {
  getSiblingRefreshStatus,
  normalizeOptions,
  state,
  type SiblingRefreshOptions,
  type SiblingRefreshResult,
  type SiblingRefreshStatus,
} from './siblingDetectionState';

const adminQuery = (text: string, params: any[] = []) =>
  require('../../config/container').adminDbService.adminQuery(text, params);

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
    const result: any = await adminQuery(REFRESH_CHUNK_SQL, [
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

  const extraResult: any = await adminQuery(EXTRA_RULES_SQL, []);
  const extraRow = extraResult.rows[0] || {};
  logger.info('[Siblings] Extra rules complete', {
    upper_rotation: extraRow.upper_rotation_count,
    ssid_anchor: extraRow.ssid_anchor_count,
    cross_oui: extraRow.cross_oui_count,
    same_oui_proximity: extraRow.same_oui_proximity_count,
  });

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
  const { rows } = await adminQuery(SIBLING_STATS_SQL);
  return rows[0] || {};
}

module.exports = {
  startSiblingRefresh,
  getSiblingRefreshStatus,
  getSiblingStats,
  runSiblingRefreshJob,
};

export {};
