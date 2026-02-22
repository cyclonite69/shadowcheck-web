/**
 * V2 API Service Layer
 * Encapsulates database queries for V2 API operations
 */

const { query } = require('../config/database');
const { CONFIG } = require('../config/database');

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

// ── Sort map for listNetworks ──────────────────────────────────────────────────

const SORT_MAP: Record<string, string> = {
  observed_at: 'latest_time',
  ssid: 'ssid',
  bssid: 'bssid',
  signal: 'latest_signal',
  frequency: 'frequency',
  observations: 'obs_count',
  threat_score: 'final_threat_score',
  threat_level: 'final_threat_level',
};

// ── Service methods ────────────────────────────────────────────────────────────

/**
 * Low-level pass-through for dynamically-built queries (used by filtered.ts
 * which gets its SQL from UniversalFilterQueryBuilder).
 */
export async function executeV2Query(sql: string, params?: any[]): Promise<any> {
  return query(sql, params);
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
  const { limit, offset, search, sort, order } = opts;
  const sortColumn = SORT_MAP[sort] || SORT_MAP.observed_at;

  const params: (string | number)[] = [];
  const where: string[] = [];
  if (search) {
    params.push(`%${search}%`, `%${search}%`);
    where.push(
      `(obs_latest.ssid ILIKE $${params.length - 1} OR obs_latest.bssid ILIKE $${params.length})`
    );
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(limit, offset);

  const sql = `
    WITH obs_latest AS (
      SELECT DISTINCT ON (bssid)
        bssid,
        ssid,
        lat,
        lon,
        level as signal,
        accuracy,
        time as latest_time,
        radio_frequency as frequency,
        radio_capabilities as capabilities
      FROM app.observations
      ORDER BY bssid, time DESC
    ),
    obs_agg AS (
      SELECT
        o.bssid,
        COUNT(*) as obs_count,
        MAX(o.time) as last_seen,
        MIN(o.time) as first_seen
      FROM app.observations o
      GROUP BY o.bssid
    )
    SELECT
      obs_latest.bssid,
      obs_latest.ssid,
      obs_latest.lat,
      obs_latest.lon,
      obs_latest.signal as latest_signal,
      obs_latest.accuracy,
      obs_latest.latest_time,
      obs_latest.frequency,
      obs_latest.capabilities,
      obs_agg.obs_count,
      obs_agg.first_seen,
      obs_agg.last_seen,
      nts.final_threat_score,
      nts.final_threat_level,
      nts.model_version,
      COUNT(*) OVER() as total
    FROM obs_latest
    LEFT JOIN obs_agg ON obs_agg.bssid = obs_latest.bssid
    LEFT JOIN app.network_threat_scores nts ON nts.bssid = obs_latest.bssid
    ${whereClause}
    ORDER BY ${sortColumn} ${order}
    LIMIT $${params.length - 1} OFFSET $${params.length};
  `;

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
  const [latest, timeline, threatData] = await Promise.all([
    query(
      `SELECT DISTINCT ON (bssid)
        bssid,
        ssid,
        lat,
        lon,
        level as signal,
        accuracy,
        time as observed_at,
        radio_frequency as frequency,
        radio_capabilities as capabilities,
        altitude
      FROM app.observations
      WHERE bssid = $1
      ORDER BY bssid, time DESC
      LIMIT 1`,
      [bssid]
    ),
    query(
      `SELECT
        DATE_TRUNC('hour', time) as bucket,
        COUNT(*) as obs_count,
        AVG(level) as avg_signal,
        MIN(level) as min_signal,
        MAX(level) as max_signal
      FROM app.observations
      WHERE bssid = $1
      GROUP BY DATE_TRUNC('hour', time)
      ORDER BY bucket DESC
      LIMIT 168`,
      [bssid]
    ),
    query(
      `SELECT
        bssid,
        final_threat_score,
        final_threat_level,
        model_version,
        ml_threat_probability,
        created_at,
        updated_at
      FROM app.network_threat_scores
      WHERE bssid = $1`,
      [bssid]
    ),
  ]);

  const obsCount = await query('SELECT COUNT(*) as count FROM app.observations WHERE bssid = $1', [
    bssid,
  ]);

  const firstLast = await query(
    `SELECT MIN(time) as first_seen, MAX(time) as last_seen
    FROM app.observations
    WHERE bssid = $1`,
    [bssid]
  );

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
  const [threatCounts, counts] = await Promise.all([
    query(`
      SELECT
        SUM(CASE WHEN nts.final_threat_level = 'CRITICAL' THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN nts.final_threat_level = 'HIGH' THEN 1 ELSE 0 END) AS high,
        SUM(CASE WHEN nts.final_threat_level = 'MED' THEN 1 ELSE 0 END) AS medium,
        SUM(CASE WHEN nts.final_threat_level IN ('LOW', 'NONE') THEN 1 ELSE 0 END) AS low
      FROM app.network_threat_scores nts
      WHERE nts.final_threat_level IS NOT NULL
    `),
    query(`
      SELECT
        (SELECT COUNT(DISTINCT bssid) FROM app.observations) as total_networks,
        (SELECT COUNT(*) FROM app.observations) as observations
    `),
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
  const allowedSeverities = ['critical', 'high', 'med', 'low', 'none'];
  const hasSeverityFilter = severity && allowedSeverities.includes(severity);
  const params: (string | number)[] = hasSeverityFilter ? [severity.toUpperCase()] : [];
  params.push(days);

  const threatsSql = `
    SELECT
      ne.bssid,
      ne.ssid,
      LOWER(ne.threat->>'level') AS severity,
      (ne.threat->>'score')::numeric AS threat_score,
      ne.first_seen,
      ne.last_seen,
      ne.lat,
      ne.lon,
      ne.observations AS observation_count
    FROM app.api_network_explorer_mv ne
    WHERE ne.threat->>'level' IS NOT NULL
      AND ne.threat->>'level' != 'NONE'
      ${hasSeverityFilter ? "AND ne.threat->>'level' = $1" : ''}
    ORDER BY (ne.threat->>'score')::numeric DESC
    LIMIT ${CONFIG.MAX_PAGE_SIZE}
  `;

  const observationsSql = `
    SELECT
      o.bssid,
      o.lat,
      o.lon,
      o.time as observed_at,
      o.level AS rssi,
      LOWER(ne.threat->>'level') AS severity
    FROM app.observations o
    JOIN app.api_network_explorer_mv ne ON ne.bssid = o.bssid
    WHERE ne.threat->>'level' IS NOT NULL
      AND ne.threat->>'level' != 'NONE'
      AND o.time >= NOW() - ($${params.length} || ' days')::interval
      ${hasSeverityFilter ? "AND ne.threat->>'level' = $1" : ''}
    LIMIT 100000
  `;

  const [threats, observations] = await Promise.all([
    query(threatsSql, params),
    query(observationsSql, params),
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
  filters: { threatCategories?: string[] },
  enabled: { threatCategories?: boolean }
): Promise<SeverityCounts> {
  const ThreatLevelMap: Record<string, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MED',
    low: 'LOW',
  };

  let whereClause = '';
  const params: unknown[] = [];

  if (
    enabled.threatCategories &&
    Array.isArray(filters.threatCategories) &&
    filters.threatCategories.length > 0
  ) {
    const dbThreatLevels = filters.threatCategories
      .map((cat) => ThreatLevelMap[cat])
      .filter(Boolean);
    if (dbThreatLevels.length > 0) {
      whereClause = `WHERE (
        CASE
          WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'
          WHEN nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_level, 'NONE')
          ELSE (
            CASE
              WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 80 THEN 'CRITICAL'
              WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 60 THEN 'HIGH'
              WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= ${CONFIG.THREAT_THRESHOLD} THEN 'MED'
              WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 20 THEN 'LOW'
              ELSE 'NONE'
            END
          )
        END
      ) = ANY($1)`;
      params.push(dbThreatLevels);
    }
  }

  const result = await query(
    `
    SELECT
      CASE
        WHEN nt.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'
        WHEN nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_level, 'NONE')
        ELSE (
          CASE
            WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 80 THEN 'CRITICAL'
            WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 60 THEN 'HIGH'
            WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= ${CONFIG.THREAT_THRESHOLD} THEN 'MED'
            WHEN (COALESCE(nts.final_threat_score, 0)::numeric * 0.7 + COALESCE(nt.threat_confidence, 0)::numeric * 100 * 0.3) >= 20 THEN 'LOW'
            ELSE 'NONE'
          END
        )
      END as severity,
      COUNT(DISTINCT ne.bssid) as unique_networks,
      SUM(ne.observations)::bigint as total_observations
    FROM app.api_network_explorer_mv ne
    LEFT JOIN app.network_threat_scores nts ON nts.bssid = ne.bssid
    LEFT JOIN app.network_tags nt ON nt.bssid = ne.bssid AND nt.threat_tag IS NOT NULL
    ${whereClause}
    GROUP BY 1
  `,
    params
  );

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
