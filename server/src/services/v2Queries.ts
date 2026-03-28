const { CONFIG } = require('../config/database');
const { THREAT_LEVEL_EXPR, THREAT_SCORE_EXPR } = require('./filterQueryBuilder/sqlExpressions');

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

const buildListNetworksQuery = (opts: {
  limit: number;
  offset: number;
  search: string;
  sort: string;
  order: 'ASC' | 'DESC';
}) => {
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

  return {
    sql: `
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
    `,
    params,
  };
};

const getNetworkDetailQueries = (bssid: string) => ({
  latest: {
    sql: `SELECT DISTINCT ON (bssid)
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
      AND COALESCE(is_quality_filtered, false) = false
    ORDER BY bssid, time DESC
    LIMIT 1`,
    params: [bssid],
  },
  timeline: {
    sql: `SELECT
      DATE_TRUNC('hour', time) as bucket,
      COUNT(*) as obs_count,
      AVG(level) as avg_signal,
      MIN(level) as min_signal,
      MAX(level) as max_signal
    FROM app.observations
    WHERE bssid = $1
      AND COALESCE(is_quality_filtered, false) = false
    GROUP BY DATE_TRUNC('hour', time)
    ORDER BY bucket DESC
    LIMIT 168`,
    params: [bssid],
  },
  threat: {
    sql: `SELECT
      bssid,
      final_threat_score,
      final_threat_level,
      model_version,
      ml_threat_probability,
      created_at,
      updated_at
    FROM app.network_threat_scores
    WHERE bssid = $1`,
    params: [bssid],
  },
  obsCount: {
    sql: `SELECT COUNT(*) as count
     FROM app.observations
     WHERE bssid = $1
       AND COALESCE(is_quality_filtered, false) = false`,
    params: [bssid],
  },
  firstLast: {
    sql: `SELECT MIN(time) as first_seen, MAX(time) as last_seen
    FROM app.observations
    WHERE bssid = $1
      AND COALESCE(is_quality_filtered, false) = false`,
    params: [bssid],
  },
});

const getDashboardMetricsQueries = () => ({
  threatCounts: `
    SELECT
      SUM(CASE WHEN nts.final_threat_level = 'CRITICAL' THEN 1 ELSE 0 END) AS critical,
      SUM(CASE WHEN nts.final_threat_level = 'HIGH' THEN 1 ELSE 0 END) AS high,
      SUM(CASE WHEN nts.final_threat_level = 'MED' THEN 1 ELSE 0 END) AS medium,
      SUM(CASE WHEN nts.final_threat_level IN ('LOW', 'NONE') THEN 1 ELSE 0 END) AS low
    FROM app.network_threat_scores nts
    LEFT JOIN app.network_tags nt ON nt.bssid = nts.bssid
    WHERE nts.final_threat_level IS NOT NULL
      AND nt.is_ignored IS NOT TRUE
  `,
  counts: `
    SELECT
      (SELECT COUNT(DISTINCT bssid) FROM app.observations) as total_networks,
      (SELECT COUNT(*) FROM app.observations) as observations
  `,
});

const buildThreatMapQueries = (opts: { severity: string; days: number }) => {
  const { severity, days } = opts;
  const allowedSeverities = ['critical', 'high', 'med', 'low', 'none'];
  const hasSeverityFilter = severity && allowedSeverities.includes(severity);
  const threatParams: (string | number)[] = hasSeverityFilter ? [severity.toUpperCase()] : [];
  const observationParams: (string | number)[] = hasSeverityFilter
    ? [severity.toUpperCase(), days]
    : [days];
  const dynamicThreatLevel = THREAT_LEVEL_EXPR('nts', 'nt');
  const dynamicThreatScore = THREAT_SCORE_EXPR('nts', 'nt');

  return {
    hasSeverityFilter,
    threatParams,
    observationParams,
    threatsSql: `
      SELECT
        ne.bssid,
        ne.ssid,
        LOWER(${dynamicThreatLevel}) AS severity,
        (${dynamicThreatScore})::numeric AS threat_score,
        ne.first_seen,
        ne.last_seen,
        ne.lat,
        ne.lon,
        ne.observations AS observation_count
      FROM app.api_network_explorer_mv ne
      LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(ne.bssid)
      LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(ne.bssid)
      WHERE (${dynamicThreatLevel}) IS NOT NULL
        AND (${dynamicThreatLevel}) != 'NONE'
        AND nt.is_ignored IS NOT TRUE
        ${hasSeverityFilter ? `AND (${dynamicThreatLevel}) = $1` : ''}
      ORDER BY (${dynamicThreatScore})::numeric DESC
      LIMIT ${CONFIG.MAX_PAGE_SIZE}
    `,
    observationsSql: `
      SELECT
        o.bssid,
        o.lat,
        o.lon,
        o.time as observed_at,
        o.level AS rssi,
        LOWER(${dynamicThreatLevel}) AS severity
      FROM app.observations o
      LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(o.bssid)
      LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(o.bssid)
      WHERE (${dynamicThreatLevel}) IS NOT NULL
        AND (${dynamicThreatLevel}) != 'NONE'
        AND nt.is_ignored IS NOT TRUE
        AND COALESCE(o.is_quality_filtered, false) = false
        AND o.time >= NOW() - ($${hasSeverityFilter ? 2 : 1} || ' days')::interval
        ${hasSeverityFilter ? `AND (${dynamicThreatLevel}) = $1` : ''}
      LIMIT 100000
    `,
  };
};

export {
  buildListNetworksQuery,
  buildThreatMapQueries,
  getDashboardMetricsQueries,
  getNetworkDetailQueries,
};
