/**
 * Analytics Service Layer
 * Encapsulates business logic for analytics operations
 * Separates data retrieval from route handling
 */

const { query } = require('../config/database');
const { DatabaseError } = require('../errors/AppError');

/**
 * Get network type distribution
 * @returns {Promise<Array>} Array of network types with counts
 */
async function getNetworkTypes() {
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
      FROM public.networks
      WHERE type IS NOT NULL
      GROUP BY network_type
      ORDER BY count DESC
    `);

    return rows.map((row) => ({
      type: row.network_type,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve network type distribution');
  }
}

/**
 * Get signal strength distribution
 * @returns {Promise<Array>} Array of signal ranges with counts
 */
async function getSignalStrengthDistribution() {
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
      FROM public.networks
      WHERE bestlevel IS NOT NULL
      GROUP BY signal_range
      ORDER BY signal_range DESC
    `);

    return rows.map((row) => ({
      range: row.signal_range,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve signal strength distribution');
  }
}

/**
 * Get temporal activity (hourly distribution)
 * @param {number} minTimestamp - Minimum timestamp filter
 * @returns {Promise<Array>} Array of hours with activity counts
 */
async function getTemporalActivity(minTimestamp) {
  try {
    const { rows } = await query(
      `
      SELECT
        EXTRACT(HOUR FROM last_seen) as hour,
        COUNT(*) as count
      FROM public.networks
      WHERE last_seen IS NOT NULL
        AND EXTRACT(EPOCH FROM last_seen) * 1000 >= $1
      GROUP BY hour
      ORDER BY hour
    `,
      [minTimestamp]
    );

    return rows.map((row) => ({
      hour: parseInt(row.hour),
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve temporal activity');
  }
}

/**
 * Get radio type distribution over time
 * @param {string} range - Time range (24h, 7d, 30d, 90d, all)
 * @param {number} minTimestamp - Minimum timestamp
 * @returns {Promise<Array>} Array of time periods with type distribution
 */
async function getRadioTypeOverTime(range, minTimestamp) {
  try {
    const { rows } = await query(
      `
      WITH time_counts AS (
        SELECT
          CASE $1
            WHEN '24h' THEN DATE_TRUNC('hour', last_seen)
            WHEN '7d' THEN DATE(last_seen)
            WHEN '30d' THEN DATE(last_seen)
            WHEN '90d' THEN DATE(last_seen)
            WHEN 'all' THEN DATE_TRUNC('week', last_seen)
          END as date,
          CASE
            WHEN type = 'W' THEN 'WiFi'
            WHEN type = 'E' THEN 'BLE'
            WHEN type = 'B' AND (frequency < 5000 OR capabilities LIKE '%BLE%') THEN 'BLE'
            WHEN type = 'B' THEN 'BT'
            WHEN type = 'L' THEN 'LTE'
            WHEN type = 'N' THEN 'NR'
            WHEN type = 'G' AND capabilities LIKE '%LTE%' THEN 'LTE'
            WHEN type = 'G' THEN 'GSM'
            ELSE 'Other'
          END as network_type,
          COUNT(*) as count
        FROM public.networks
        WHERE last_seen IS NOT NULL
          AND EXTRACT(EPOCH FROM last_seen) * 1000 >= $2
          AND CASE $1
                WHEN 'all' THEN TRUE
                WHEN '24h' THEN last_seen >= NOW() - INTERVAL '24 hours'
                WHEN '7d' THEN last_seen >= NOW() - INTERVAL '7 days'
                WHEN '30d' THEN last_seen >= NOW() - INTERVAL '30 days'
                WHEN '90d' THEN last_seen >= NOW() - INTERVAL '90 days'
                ELSE FALSE
              END
        GROUP BY date, network_type
        ORDER BY date, network_type
      )
      SELECT * FROM time_counts
    `,
      [range, minTimestamp]
    );

    return rows.map((row) => ({
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
 * @returns {Promise<Array>} Array of security types with counts
 */
async function getSecurityDistribution() {
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
      FROM public.networks
      WHERE type = 'W'
      GROUP BY security_type
      ORDER BY count DESC
    `);

    return rows.map((row) => ({
      type: row.security_type,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve security distribution');
  }
}

/**
 * Get top networks by observation count
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} Array of top networks
 */
async function getTopNetworks(limit = 100) {
  try {
    const { rows } = await query(
      `
      SELECT
        bssid,
        ssid,
        type,
        bestlevel,
        COUNT(DISTINCT bssid) as observation_count,
        MIN(first_time) as first_seen,
        MAX(last_time) as last_seen
      FROM public.networks
      GROUP BY bssid, ssid, type, bestlevel
      ORDER BY observation_count DESC
      LIMIT $1
    `,
      [limit]
    );

    return rows.map((row) => ({
      bssid: row.bssid,
      ssid: row.ssid || '<Hidden>',
      type: row.type,
      signal: row.bestlevel,
      observations: parseInt(row.observation_count),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve top networks');
  }
}

/**
 * Get network statistics dashboard
 * @returns {Promise<Object>} Dashboard statistics
 */
async function getDashboardStats() {
  try {
    const [totalNetworks, radioTypes] = await Promise.all([
      query('SELECT COUNT(*) as count FROM public.networks'),
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
        FROM public.networks
        WHERE type IS NOT NULL
        GROUP BY radio_type
      `),
    ]);

    const radioCounts = {};
    radioTypes.rows.forEach((row) => {
      radioCounts[row.radio_type] = parseInt(row.count);
    });

    return {
      totalNetworks: parseInt(totalNetworks.rows[0]?.count || 0),
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
async function getBulkAnalytics() {
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
 * @returns {Promise<Array>} Array of threat score ranges with counts
 */
async function getThreatDistribution() {
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
      LEFT JOIN public.api_network_explorer_mv ne ON ne.bssid = nts.bssid
      WHERE ne.last_seen >= NOW() - INTERVAL '90 days'
      GROUP BY range
      ORDER BY range DESC
    `);

    return rows.map((row) => ({
      range: row.range,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve threat distribution');
  }
}

/**
 * Get threat trends over time
 * @param {string} range - Time range (24h, 7d, 30d, 90d, all)
 * @param {number} minTimestamp - Minimum timestamp
 * @returns {Promise<Array>} Array of time periods with threat metrics
 */
async function getThreatTrends(range, minTimestamp) {
  try {
    const { rows } = await query(
      `
      WITH daily_threats AS (
        SELECT
          CASE $1
            WHEN '24h' THEN DATE_TRUNC('hour', o.observed_at)
            WHEN '7d' THEN DATE(o.observed_at)
            WHEN '30d' THEN DATE(o.observed_at)
            WHEN '90d' THEN DATE(o.observed_at)
            WHEN 'all' THEN DATE_TRUNC('week', o.observed_at)
          END as time_period,
          o.bssid,
          COALESCE(nts.final_threat_score, 0) as threat_score
        FROM public.observations o
        LEFT JOIN app.network_threat_scores nts ON nts.bssid = o.bssid
        WHERE o.observed_at IS NOT NULL
          AND EXTRACT(EPOCH FROM o.observed_at) * 1000 >= $2
          AND CASE $1
                WHEN 'all' THEN TRUE
                WHEN '24h' THEN o.observed_at >= NOW() - INTERVAL '24 hours'
                WHEN '7d' THEN o.observed_at >= NOW() - INTERVAL '7 days'
                WHEN '30d' THEN o.observed_at >= NOW() - INTERVAL '30 days'
                WHEN '90d' THEN o.observed_at >= NOW() - INTERVAL '90 days'
                ELSE FALSE
              END
        GROUP BY time_period, o.bssid
        HAVING COUNT(DISTINCT o.id) >= 3
      )
      SELECT
        time_period as date,
        ROUND(AVG(threat_score)::numeric, 1) as avg_score,
        COUNT(*) FILTER (WHERE threat_score >= 80) as critical_count,
        COUNT(*) FILTER (WHERE threat_score >= 60 AND threat_score < 80) as high_count,
        COUNT(*) FILTER (WHERE threat_score >= 40 AND threat_score < 60) as medium_count
      FROM daily_threats
      GROUP BY time_period
      ORDER BY time_period
    `,
      [range, minTimestamp]
    );

    return rows.map((row) => ({
      date: row.date,
      avgScore: parseFloat(row.avg_score),
      criticalCount: parseInt(row.critical_count),
      highCount: parseInt(row.high_count),
      mediumCount: parseInt(row.medium_count),
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
