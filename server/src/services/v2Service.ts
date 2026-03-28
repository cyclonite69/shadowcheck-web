import { UniversalFilterQueryBuilder } from './filterQueryBuilder/universalFilterQueryBuilder';
import {
  buildListNetworksQuery,
  buildThreatMapQueries,
  getDashboardMetricsQueries,
  getNetworkDetailQueries,
} from './v2Queries';
/**
 * V2 API Service Layer
 * Encapsulates database queries for V2 API operations
 */

const { query } = require('../config/database');
const logger = require('../logging/logger');
const SLOW_QUERY_THRESHOLD_MS = Math.max(0, Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? 2000));

// ── Shared types ───────────────────────────────────────────────────────────────

type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MED' | 'LOW' | 'NONE';

export interface NetworkListItem {
  bssid: string;
  ssid: string;
  observed_at: Date | null;
  signal: number | null;
  lat: number | null;
  lon: number | null;
  observations: number;
  first_seen: Date | null;
  last_seen: Date | null;
  frequency: number | null;
  capabilities: string | null;
  accuracy_meters: number | null;
  threat_score: number;
  threat_level: ThreatLevel;
  model_version: string;
}

export interface NetworkListResult {
  total: number;
  rows: NetworkListItem[];
}

export interface NetworkDetailRow {
  bssid: string;
  ssid: string | null;
  lat: number | null;
  lon: number | null;
  signal: number | null;
  accuracy: number | null;
  observed_at: Date | null;
  frequency: number | null;
  capabilities: string | null;
  altitude: number | null;
}

export interface TimelineRow {
  bucket: Date;
  obs_count: string;
  avg_signal: number | null;
  min_signal: number | null;
  max_signal: number | null;
}

export interface ThreatDataRow {
  bssid: string;
  final_threat_score: number | null;
  final_threat_level: ThreatLevel | null;
  model_version: string | null;
  ml_threat_probability: number | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface NetworkDetail {
  latest: NetworkDetailRow | null;
  timeline: TimelineRow[];
  threat: ThreatDataRow | null;
  observation_count: number;
  first_seen: Date | null;
  last_seen: Date | null;
}

export interface DashboardMetrics {
  networks: { total: number; hidden: number; wifi: number };
  threats: { critical: number; high: number; medium: number; low: number };
  observations: number;
  ssid_history: number;
  enriched: null;
  surveillance: null;
}

export interface ThreatMapRow {
  bssid: string;
  ssid: string | null;
  severity: string | null;
  threat_score: number | null;
  first_seen: Date | null;
  last_seen: Date | null;
  lat: number | null;
  lon: number | null;
  observation_count: number;
}

export interface ObservationMapRow {
  bssid: string;
  lat: number | null;
  lon: number | null;
  observed_at: Date | null;
  rssi: number | null;
  severity: string | null;
}

export interface ThreatMapResult {
  threats: ThreatMapRow[];
  observations: ObservationMapRow[];
  meta: {
    severity: string;
    days: number;
    threat_count: number | null;
    observation_count: number | null;
    model_version: string;
  };
}

export interface SeverityCounts {
  critical: { unique_networks: number; total_observations: number };
  high: { unique_networks: number; total_observations: number };
  medium: { unique_networks: number; total_observations: number };
  low: { unique_networks: number; total_observations: number };
  none: { unique_networks: number; total_observations: number };
}

// ── Service methods ────────────────────────────────────────────────────────────

/**
 * Low-level pass-through for dynamically-built queries (used by filtered.ts
 * which gets its SQL from UniversalFilterQueryBuilder).
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
 * Throws on unexpected DB errors (e.g. missing table).
 */
export async function checkHomeExists(): Promise<boolean> {
  const result = await query(
    "SELECT 1 FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
  );
  return (result.rowCount ?? 0) > 0;
}

module.exports = {
  executeV2Query,
  listNetworks,
  getNetworkDetail,
  getDashboardMetrics,
  getThreatMapData,
  getThreatSeverityCounts,
  checkHomeExists,
};
