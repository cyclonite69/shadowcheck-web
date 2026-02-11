/**
 * Threat Analytics Module
 * Security and threat level analytics
 */

const { query } = require('../../config/database');
const { DatabaseError } = require('../../errors/AppError');

/**
 * Get threat score distribution
 * @returns Array of threat score ranges with counts
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
      LEFT JOIN app.api_network_explorer_mv ne ON ne.bssid = nts.bssid
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
 * @param range - Time range (24h, 7d, 30d, 90d, all)
 * @param minTimestamp - Minimum timestamp
 * @returns Array of time periods with threat metrics
 */
async function getThreatTrends(range, minTimestamp) {
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

    return rows.map((row) => ({
      date: row.date,
      avgScore: row.avg_score,
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
  getThreatDistribution,
  getThreatTrends,
};
