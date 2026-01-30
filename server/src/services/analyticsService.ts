/**
 * Analytics Service Layer
 * Encapsulates business logic for analytics operations
 * Separates data retrieval from route handling
 */

const { query } = require('../config/database');
const { DatabaseError } = require('../errors/AppError');

// Type definitions for analytics data

interface NetworkTypeCount {
  type: string;
  count: number;
}

interface SignalRangeCount {
  range: string;
  count: number;
}

interface HourlyActivity {
  hour: number;
  count: number;
}

interface RadioTypeOverTimeEntry {
  date: Date | string;
  type: string;
  count: number;
}

interface SecurityTypeCount {
  type: string;
  count: number;
}

interface TopNetwork {
  bssid: string;
  ssid: string;
  type: string;
  signal: number | null;
  observations: number;
  firstSeen: Date | string | null;
  lastSeen: Date | string | null;
}

interface DashboardStats {
  totalNetworks: number;
  threatsCount: number;
  surveillanceCount: number;
  enrichedCount: number;
  wifiCount: number;
  btCount: number;
  bleCount: number;
  lteCount: number;
  gsmCount: number;
  nrCount: number;
}

interface BulkAnalytics {
  dashboard: DashboardStats;
  networkTypes: NetworkTypeCount[];
  signalStrength: SignalRangeCount[];
  security: SecurityTypeCount[];
  topNetworks: TopNetwork[];
  generatedAt: string;
}

interface ThreatRangeCount {
  range: string;
  count: number;
}

interface ThreatTrendEntry {
  date: Date | string;
  avgScore: number | null;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  networkCount: number;
}

type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

// Database row types
interface NetworkTypeRow {
  network_type: string;
  count: string;
}

interface SignalRangeRow {
  signal_range: string;
  count: string;
}

interface HourlyActivityRow {
  hour: string;
  count: string;
}

interface RadioTypeOverTimeRow {
  date: Date;
  network_type: string;
  count: string;
}

interface SecurityTypeRow {
  security_type: string;
  count: string;
}

interface TopNetworkRow {
  bssid: string;
  ssid: string | null;
  type: string;
  signal: number | null;
  observations: string;
  first_seen: Date | null;
  last_seen: Date | null;
}

interface CountRow {
  count: string;
}

interface RadioTypeCountRow {
  radio_type: string;
  count: string;
}

interface ThreatRangeRow {
  range: string;
  count: string;
}

interface ThreatTrendRow {
  date: Date;
  avg_score: number | null;
  critical_count: string;
  high_count: string;
  medium_count: string;
  low_count: string;
  network_count: string;
}

/**
 * Get network type distribution
 * @returns Array of network types with counts
 */
async function getNetworkTypes(): Promise<NetworkTypeCount[]> {
  try {
    const { rows } = await query(`
      SELECT
        CASE
          WHEN type = 'W' THEN 'WiFi'
          WHEN type = 'E' THEN 'BLE'
          WHEN type = 'B' AND (frequency < 5000 OR capabilities LIKE '%BLE%') THEN 'BLE'
          WHEN type = 'B' THEN 'BT'
          WHEN type = 'L' THEN 'LTE'
          WHEN type = 'N' THEN 'NR'
          WHEN type = 'G' AND capabilities LIKE '%LTE%' THEN 'LTE'
          WHEN type = 'G' THEN 'GSM'
          ELSE type
        END as network_type,
        COUNT(*) as count
      FROM app.networks
      WHERE type IS NOT NULL
      GROUP BY network_type
      ORDER BY count DESC
    `);

    return (rows as NetworkTypeRow[]).map((row) => ({
      type: row.network_type,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve network type distribution');
  }
}

/**
 * Get signal strength distribution
 * @returns Array of signal ranges with counts
 */
async function getSignalStrengthDistribution(): Promise<SignalRangeCount[]> {
  try {
    const { rows } = await query(`
      SELECT
        CASE
          WHEN bestlevel >= -30 THEN '-30'
          WHEN bestlevel >= -40 THEN '-40'
          WHEN bestlevel >= -50 THEN '-50'
          WHEN bestlevel >= -60 THEN '-60'
          WHEN bestlevel >= -70 THEN '-70'
          WHEN bestlevel >= -80 THEN '-80'
          ELSE '-90'
        END as signal_range,
        COUNT(*) as count
      FROM app.networks
      WHERE bestlevel IS NOT NULL
      GROUP BY signal_range
      ORDER BY signal_range DESC
    `);

    return (rows as SignalRangeRow[]).map((row) => ({
      range: row.signal_range,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve signal strength distribution');
  }
}

/**
 * Get temporal activity (hourly distribution)
 * @param minTimestamp - Minimum timestamp filter
 * @returns Array of hours with activity counts
 */
async function getTemporalActivity(minTimestamp: number): Promise<HourlyActivity[]> {
  try {
    const { rows } = await query(
      `
      SELECT
        EXTRACT(HOUR FROM o.time) as hour,
        COUNT(*) as count
      FROM app.observations o
      WHERE o.time IS NOT NULL
        AND EXTRACT(EPOCH FROM o.time) * 1000 >= $1
      GROUP BY hour
      ORDER BY hour
    `,
      [minTimestamp]
    );

    return (rows as HourlyActivityRow[]).map((row) => ({
      hour: parseInt(row.hour),
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve temporal activity');
  }
}

/**
 * Get radio type distribution over time
 * @param range - Time range (24h, 7d, 30d, 90d, all)
 * @param minTimestamp - Minimum timestamp
 * @returns Array of time periods with type distribution
 */
async function getRadioTypeOverTime(
  range: TimeRange,
  minTimestamp: number
): Promise<RadioTypeOverTimeEntry[]> {
  try {
    const { rows } = await query(
      `
      WITH time_counts AS (
        SELECT
          CASE $1
            WHEN '24h' THEN DATE_TRUNC('hour', o.time)
            WHEN '7d' THEN DATE(o.time)
            WHEN '30d' THEN DATE(o.time)
            WHEN '90d' THEN DATE(o.time)
            WHEN 'all' THEN DATE_TRUNC('week', o.time)
          END as date,
          CASE
            WHEN o.radio_type = 'W' THEN 'WiFi'
            WHEN o.radio_type = 'E' THEN 'BLE'
            WHEN o.radio_type = 'B' THEN 'BT'
            WHEN o.radio_type = 'L' THEN 'LTE'
            WHEN o.radio_type = 'N' THEN 'NR'
            WHEN o.radio_type = 'G' THEN 'GSM'
            ELSE 'Other'
          END as network_type,
          COUNT(DISTINCT o.bssid) as count
        FROM app.observations o
        WHERE o.time IS NOT NULL
          AND EXTRACT(EPOCH FROM o.time) * 1000 >= $2
          AND CASE $1
                WHEN 'all' THEN TRUE
                WHEN '24h' THEN o.time >= NOW() - INTERVAL '24 hours'
                WHEN '7d' THEN o.time >= NOW() - INTERVAL '7 days'
                WHEN '30d' THEN o.time >= NOW() - INTERVAL '30 days'
                WHEN '90d' THEN o.time >= NOW() - INTERVAL '90 days'
                ELSE FALSE
              END
        GROUP BY date, network_type
        ORDER BY date, network_type
      )
      SELECT * FROM time_counts
    `,
      [range, minTimestamp]
    );

    return (rows as RadioTypeOverTimeRow[]).map((row) => ({
      date: row.date,
      type: row.network_type,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve radio type over time');
  }
}

/**
 * Get security type distribution
 * @returns Array of security types with counts
 */
async function getSecurityDistribution(): Promise<SecurityTypeCount[]> {
  try {
    const { rows } = await query(`
      SELECT
        CASE
          -- WPA3 variants
          WHEN capabilities ILIKE '%WPA3%' AND capabilities ILIKE '%ENT%' THEN 'WPA3-E'
          WHEN capabilities ILIKE '%WPA3%' AND (capabilities ILIKE '%SAE%' OR capabilities ILIKE '%PSK%') THEN 'WPA3-P'
          WHEN capabilities ILIKE '%WPA3%' THEN 'WPA3'

          -- WPA2 variants
          WHEN capabilities ILIKE '%WPA2%' AND capabilities ILIKE '%ENT%' THEN 'WPA2-E'
          WHEN capabilities ILIKE '%WPA2%' AND capabilities ILIKE '%PSK%' THEN 'WPA2-P'
          WHEN capabilities ILIKE '%WPA2%' THEN 'WPA2'

          -- WPA (original)
          WHEN capabilities ILIKE '%WPA%' AND NOT capabilities ILIKE '%WPA2%' AND NOT capabilities ILIKE '%WPA3%' THEN 'WPA'

          -- WEP
          WHEN capabilities ILIKE '%WEP%' THEN 'WEP'

          -- WPS (WiFi Protected Setup)
          WHEN capabilities ILIKE '%WPS%' AND (capabilities IS NULL OR capabilities = '' OR NOT capabilities ILIKE '%WPA%') THEN 'WPS'

          -- Open networks
          WHEN capabilities IS NULL OR capabilities = '' OR capabilities ILIKE '%ESS%' THEN 'OPEN'

          ELSE 'OPEN'
        END as security_type,
        COUNT(*) as count
      FROM app.networks
      WHERE type = 'W'
      GROUP BY security_type
      ORDER BY count DESC
    `);

    return (rows as SecurityTypeRow[]).map((row) => ({
      type: row.security_type,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve security distribution');
  }
}

/**
 * Get top networks by observation count
 * @param limit - Number of results to return
 * @returns Array of top networks
 */
async function getTopNetworks(limit: number = 100): Promise<TopNetwork[]> {
  try {
    const { rows } = await query(
      `
      SELECT
        ne.bssid,
        ne.ssid,
        ne.type,
        ne.signal,
        ne.observations,
        ne.first_seen,
        ne.last_seen
      FROM app.api_network_explorer_mv ne
      WHERE ne.observations > 0
      ORDER BY ne.observations DESC, ne.last_seen DESC
      LIMIT $1
    `,
      [limit]
    );

    return (rows as TopNetworkRow[]).map((row) => ({
      bssid: row.bssid,
      ssid: row.ssid || '<Hidden>',
      type: row.type,
      signal: row.signal, // Keep as null if null
      observations: parseInt(row.observations) || 0,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve top networks');
  }
}

/**
 * Get network statistics dashboard
 * @returns Dashboard statistics
 */
async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [totalNetworks, radioTypes] = await Promise.all([
      query('SELECT COUNT(*) as count FROM app.networks'),
      query(`
        SELECT
          CASE
            WHEN type = 'W' THEN 'WiFi'
            WHEN type = 'E' THEN 'BLE'
            WHEN type = 'B' THEN 'BT'
            WHEN type = 'L' THEN 'LTE'
            WHEN type = 'N' THEN 'NR'
            WHEN type = 'G' THEN 'GSM'
            ELSE 'Other'
          END as radio_type,
          COUNT(*) as count
        FROM app.networks
        WHERE type IS NOT NULL
        GROUP BY radio_type
      `),
    ]);

    const radioCounts: Record<string, number> = {};
    (radioTypes.rows as RadioTypeCountRow[]).forEach((row) => {
      radioCounts[row.radio_type] = parseInt(row.count);
    });

    return {
      totalNetworks: parseInt((totalNetworks.rows as CountRow[])[0]?.count || '0'),
      threatsCount: 0, // Placeholder - would need proper threat detection query
      surveillanceCount: 0, // Placeholder
      enrichedCount: 0, // Placeholder - manufacturer column doesn't exist
      wifiCount: radioCounts.WiFi || 0,
      btCount: radioCounts.BT || 0,
      bleCount: radioCounts.BLE || 0,
      lteCount: radioCounts.LTE || 0,
      gsmCount: radioCounts.GSM || 0,
      nrCount: radioCounts.NR || 0,
    };
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve dashboard statistics');
  }
}

/**
 * Bulk retrieve analytics data
 * Optimized for dashboard loading
 */
async function getBulkAnalytics(): Promise<BulkAnalytics> {
  try {
    const [networkTypes, signalStrength, security, topNetworks, dashStats] = await Promise.all([
      getNetworkTypes(),
      getSignalStrengthDistribution(),
      getSecurityDistribution(),
      getTopNetworks(50),
      getDashboardStats(),
    ]);

    return {
      dashboard: dashStats,
      networkTypes,
      signalStrength,
      security,
      topNetworks,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve bulk analytics');
  }
}

/**
 * Get threat score distribution
 * @returns Array of threat score ranges with counts
 */
async function getThreatDistribution(): Promise<ThreatRangeCount[]> {
  try {
    const { rows } = await query(`
      SELECT
        CASE
          WHEN nts.final_threat_score >= 80 THEN '80-100'
          WHEN nts.final_threat_score >= 60 THEN '60-80'
          WHEN nts.final_threat_score >= 40 THEN '40-60'
          WHEN nts.final_threat_score >= 20 THEN '20-40'
          ELSE '0-20'
        END as range,
        COUNT(*) as count
      FROM app.network_threat_scores nts
      LEFT JOIN app.api_network_explorer_mv ne ON ne.bssid = nts.bssid
      WHERE ne.last_seen >= NOW() - INTERVAL '90 days'
      GROUP BY range
      ORDER BY range DESC
    `);

    return (rows as ThreatRangeRow[]).map((row) => ({
      range: row.range,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve threat distribution');
  }
}

/**
 * Get threat trends over time
 * @param range - Time range (24h, 7d, 30d, 90d, all)
 * @param minTimestamp - Minimum timestamp
 * @returns Array of time periods with threat metrics
 */
async function getThreatTrends(
  range: TimeRange,
  minTimestamp: number
): Promise<ThreatTrendEntry[]> {
  try {
    const { rows } = await query(
      `
      WITH daily_threats AS (
        SELECT
          CASE $1
            WHEN '24h' THEN DATE_TRUNC('hour', ne.last_seen)
            WHEN '7d' THEN DATE(ne.last_seen)
            WHEN '30d' THEN DATE(ne.last_seen)
            WHEN '90d' THEN DATE(ne.last_seen)
            WHEN 'all' THEN DATE_TRUNC('week', ne.last_seen)
          END as time_period,
          ne.bssid,
          ne.threat_score
        FROM app.api_network_explorer_mv ne
        WHERE ne.last_seen IS NOT NULL
          AND ne.threat_score IS NOT NULL
          AND EXTRACT(EPOCH FROM ne.last_seen) * 1000 >= $2
          AND CASE $1
                WHEN 'all' THEN TRUE
                WHEN '24h' THEN ne.last_seen >= NOW() - INTERVAL '24 hours'
                WHEN '7d' THEN ne.last_seen >= NOW() - INTERVAL '7 days'
                WHEN '30d' THEN ne.last_seen >= NOW() - INTERVAL '30 days'
                WHEN '90d' THEN ne.last_seen >= NOW() - INTERVAL '90 days'
                ELSE FALSE
              END
      )
      SELECT
        time_period as date,
        CASE
          WHEN COUNT(*) > 0 THEN ROUND(AVG(threat_score::numeric), 1)
          ELSE NULL
        END as avg_score,
        COUNT(CASE WHEN threat_score::numeric >= 80 THEN 1 END) as critical_count,
        COUNT(CASE WHEN threat_score::numeric >= 60 AND threat_score::numeric < 80 THEN 1 END) as high_count,
        COUNT(CASE WHEN threat_score::numeric >= 40 AND threat_score::numeric < 60 THEN 1 END) as medium_count,
        COUNT(CASE WHEN threat_score::numeric >= 20 AND threat_score::numeric < 40 THEN 1 END) as low_count,
        COUNT(*) as network_count
      FROM daily_threats
      GROUP BY time_period
      ORDER BY time_period
    `,
      [range, minTimestamp]
    );

    return (rows as ThreatTrendRow[]).map((row) => ({
      date: row.date,
      avgScore: row.avg_score, // Keep as null if null
      criticalCount: parseInt(row.critical_count) || 0,
      highCount: parseInt(row.high_count) || 0,
      mediumCount: parseInt(row.medium_count) || 0,
      lowCount: parseInt(row.low_count) || 0,
      networkCount: parseInt(row.network_count) || 0,
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve threat trends');
  }
}

module.exports = {
  getNetworkTypes,
  getSignalStrengthDistribution,
  getTemporalActivity,
  getRadioTypeOverTime,
  getSecurityDistribution,
  getTopNetworks,
  getDashboardStats,
  getBulkAnalytics,
  getThreatDistribution,
  getThreatTrends,
};

// Export types for consumers
export type {
  NetworkTypeCount,
  SignalRangeCount,
  HourlyActivity,
  RadioTypeOverTimeEntry,
  SecurityTypeCount,
  TopNetwork,
  DashboardStats,
  BulkAnalytics,
  ThreatRangeCount,
  ThreatTrendEntry,
  TimeRange,
};
