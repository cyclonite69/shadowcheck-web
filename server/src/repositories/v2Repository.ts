import { UniversalFilterQueryBuilder } from '../services/filterQueryBuilder/universalFilterQueryBuilder';
import { SqlFragmentLibrary } from '../services/filterQueryBuilder/SqlFragmentLibrary';
import {
  buildListNetworksQuery,
  buildThreatMapQueries,
  getDashboardMetricsQueries,
  getNetworkDetailQueries,
} from '../services/v2Queries';
import type {
  NetworkListResult,
  NetworkDetail,
  DashboardMetrics,
  ThreatMapResult,
  SeverityCounts,
} from '../types/v2Types';

const { query, CONFIG } = require('../config/database');
const logger = require('../logging/logger');

const SLOW_QUERY_THRESHOLD_MS = Math.max(0, Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? 2000));

/**
 * Low-level pass-through for dynamically-built queries (used by filtered.ts).
 */
export async function executeV2Query(sql: string, params?: any[]): Promise<any> {
  const start = Date.now();
  try {
    return await query(sql, params);
  } finally {
    const durationMs = Date.now() - start;
    logger.logQuery(sql, params, durationMs);
    if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
      logger.warn({
        message: 'Slow V2 query detected',
        durationMs,
        thresholdMs: SLOW_QUERY_THRESHOLD_MS,
        paramCount: params?.length ?? 0,
      });
    }
  }
}

/**
 * Paginated network list with optional SSID/BSSID search and sort.
 */
export async function listNetworks(opts: {
  limit: number;
  offset: number;
  search: string;
  sort: string;
  order: 'ASC' | 'DESC';
}): Promise<NetworkListResult> {
  const { sql, params } = buildListNetworksQuery(opts);
  const result = await query(sql, params);
  return {
    total: result.rows[0]?.total || 0,
    rows: result.rows.map((row: any) => ({
      bssid: row.bssid,
      ssid: row.ssid || '(hidden)',
      observed_at: row.latest_time,
      signal: row.latest_signal,
      lat: row.lat,
      lon: row.lon,
      observations: parseInt(row.obs_count) || 0,
      first_seen: row.first_seen,
      last_seen: row.last_seen,
      frequency: row.frequency,
      capabilities: row.capabilities,
      accuracy_meters: row.accuracy,
      threat_score: row.final_threat_score ? parseFloat(row.final_threat_score) : 0,
      threat_level: row.final_threat_level || 'NONE',
      model_version: row.model_version || 'rule-v3.1',
    })),
  };
}

/**
 * Full detail for a single network: latest observation, hourly timeline,
 * threat score, observation count, and first/last timestamps.
 */
export async function getNetworkDetail(bssid: string): Promise<NetworkDetail> {
  const queries = getNetworkDetailQueries(bssid);
  const [latest, timeline, threatData] = await Promise.all([
    query(queries.latest.sql, queries.latest.params),
    query(queries.timeline.sql, queries.timeline.params),
    query(queries.threat.sql, queries.threat.params),
  ]);

  const obsCount = await query(queries.obsCount.sql, queries.obsCount.params);
  const firstLast = await query(queries.firstLast.sql, queries.firstLast.params);

  return {
    latest: latest.rows[0] || null,
    timeline: timeline.rows,
    threat: threatData.rows[0] || null,
    observation_count: parseInt(obsCount.rows[0]?.count) || 0,
    first_seen: firstLast.rows[0]?.first_seen || null,
    last_seen: firstLast.rows[0]?.last_seen || null,
  };
}

/**
 * Dashboard summary: threat level counts + total networks/observations.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const queries = getDashboardMetricsQueries();
  const [threatCounts, counts] = await Promise.all([
    query(queries.threatCounts),
    query(queries.counts),
  ]);

  const tc = threatCounts.rows[0];
  const c = counts.rows[0];
  return {
    networks: {
      total: parseInt(c?.total_networks) || 0,
      hidden: 0,
      wifi: parseInt(c?.total_networks) || 0,
    },
    threats: {
      critical: parseInt(tc?.critical || '0') || 0,
      high: parseInt(tc?.high || '0') || 0,
      medium: parseInt(tc?.medium || '0') || 0,
      low: parseInt(tc?.low || '0') || 0,
    },
    observations: parseInt(c?.observations) || 0,
    ssid_history: 0,
    enriched: null,
    surveillance: null,
  };
}

/**
 * Threat map payload: network threat pins + recent observations for threats.
 */
export async function getThreatMapData(opts: {
  severity: string;
  days: number;
}): Promise<ThreatMapResult> {
  const { severity, days } = opts;
  const { hasSeverityFilter, threatParams, observationParams, threatsSql, observationsSql } =
    buildThreatMapQueries(opts);

  const [threats, observations] = await Promise.all([
    query(threatsSql, threatParams),
    query(observationsSql, observationParams),
  ]);

  return {
    threats: threats.rows,
    observations: observations.rows,
    meta: {
      severity: hasSeverityFilter ? severity : 'all',
      days,
      threat_count: threats.rowCount,
      observation_count: observations.rowCount,
      model_version: 'rule-v3.1',
    },
  };
}

/**
 * Threat severity counts, optionally filtered by active threat categories.
 */
export async function getThreatSeverityCounts(
  filters: any = {},
  enabled: any = {}
): Promise<SeverityCounts> {
  const builder = new UniversalFilterQueryBuilder(filters, enabled);
  const { sql, params } = builder.buildThreatSeverityCountsQuery();

  const result = await query(sql, params);

  const counts: SeverityCounts = {
    critical: { unique_networks: 0, total_observations: 0 },
    high: { unique_networks: 0, total_observations: 0 },
    medium: { unique_networks: 0, total_observations: 0 },
    low: { unique_networks: 0, total_observations: 0 },
    none: { unique_networks: 0, total_observations: 0 },
  };

  result.rows.forEach((row: any) => {
    const sev = (row.severity || '').toLowerCase();
    const unique = parseInt(row.unique_networks, 10);
    const total = parseInt(row.total_observations, 10);
    if (sev === 'med' || sev === 'medium') {
      counts.medium.unique_networks += unique;
      counts.medium.total_observations += total;
    } else if (sev in counts) {
      const key = sev as keyof SeverityCounts;
      counts[key].unique_networks += unique;
      counts[key].total_observations += total;
    }
  });

  return counts;
}

/**
 * Returns true if a 'home' location marker exists, false otherwise.
 */
export async function checkHomeExists(): Promise<boolean> {
  const result = await query(
    "SELECT 1 FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Given BSSIDs already in the result set, finds active manual sibling links and
 * returns full explorer rows for siblings not yet included.
 */
export async function fetchMissingSiblingRows(
  matchedBssids: string[],
  locationMode: string = 'latest_observation'
): Promise<any[]> {
  if (matchedBssids.length === 0) return [];

  const upperBssids = matchedBssids.map((b) => b.toUpperCase());

  const siblingResult = await query(
    `SELECT DISTINCT
       CASE
         WHEN UPPER(bssid1) = ANY($1::text[]) THEN UPPER(bssid2)
         ELSE UPPER(bssid1)
       END AS sibling_bssid
     FROM app.network_sibling_overrides
     WHERE is_active IS TRUE
       AND relation = 'sibling'
       AND (UPPER(bssid1) = ANY($1::text[]) OR UPPER(bssid2) = ANY($1::text[]))`,
    [upperBssids]
  );

  const allSiblingBssids: string[] = (siblingResult.rows as any[]).map(
    (r) => r.sibling_bssid as string
  );
  const missingSiblings = allSiblingBssids.filter((b) => !upperBssids.includes(b));

  if (missingSiblings.length === 0) return [];

  const locationJoin = SqlFragmentLibrary.joinNetworkLocations('ne', locationMode);
  const locationCols = SqlFragmentLibrary.selectLocationCoords('ne', locationMode);
  const tagsLateral = SqlFragmentLibrary.joinNetworkTagsLateral('ne', 'nt');
  const rmJoin = SqlFragmentLibrary.joinRadioManufacturers('ne', 'rm');
  const rmFields = SqlFragmentLibrary.selectManufacturerFields('rm');
  const geocodedFields = SqlFragmentLibrary.selectGeocodedFields('ne');
  const tagFields = SqlFragmentLibrary.selectThreatTagFields('nt');

  const networkResult = await query(
    `SELECT
       ne.bssid,
       ne.ssid AS ssid,
       ne.type AS type,
       ne.security AS security,
       ne.frequency AS frequency,
       ne.capabilities AS capabilities,
       (ne.frequency BETWEEN 5000 AND 5900) AS is_5ghz,
       (ne.frequency BETWEEN 5925 AND 7125) AS is_6ghz,
       (COALESCE(ne.ssid, '') = '') AS is_hidden,
       ne.first_seen,
       ne.last_seen,
       ${rmFields},
       ${geocodedFields},
       n.min_altitude_m,
       n.max_altitude_m,
       n.altitude_span_m,
       ne.max_distance_meters,
       n.last_altitude_m,
       COALESCE(n.is_sentinel, FALSE) AS is_sentinel,
       ne.distance_from_home_km,
       ne.observations AS observations,
       ne.wigle_v3_observation_count,
       ne.wigle_v3_last_import_at,
       ne.first_seen AS first_observed_at,
       ne.last_seen AS last_observed_at,
       NULL::integer AS unique_days,
       NULL::integer AS unique_locations,
       NULL::numeric AS avg_signal,
       NULL::numeric AS min_signal,
       NULL::numeric AS max_signal,
       ne.observed_at AS observed_at,
       ne.signal AS signal,
       ${locationCols},
       ne.centroid_lat,
       ne.centroid_lon,
       ne.weighted_lat,
       ne.weighted_lon,
       ne.accuracy_meters AS accuracy_meters,
       ne.stationary_confidence AS stationary_confidence,
       ${tagFields},
       COALESCE(nn_agg.notes_count, 0)::integer AS notes_count,
       JSONB_BUILD_OBJECT('score', ne.threat_score::text, 'level', ne.threat_level) AS threat,
       ne.rule_based_score,
       ne.ml_threat_score,
       ne.ml_weight,
       ne.ml_boost,
       NULL::text AS network_id,
       n.bestlat AS raw_lat,
       n.bestlon AS raw_lon
     FROM app.api_network_explorer_mv ne
     LEFT JOIN app.networks n ON UPPER(n.bssid) = UPPER(ne.bssid)
     ${locationJoin}
     ${tagsLateral}
     ${rmJoin}
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::integer AS notes_count
       FROM app.network_notes nn
       WHERE UPPER(nn.bssid) = UPPER(ne.bssid)
         AND nn.is_deleted IS NOT TRUE
     ) nn_agg ON TRUE
     WHERE UPPER(ne.bssid) = ANY($1::text[])`,
    [missingSiblings]
  );

  return networkResult.rows as any[];
}
