/**
 * Core Analytics Module
 * Temporal, signal, radio types, and frequency analytics
 */

const { query } = require('../../config/database');
const { DatabaseError } = require('../../errors/AppError');

/**
 * Get signal strength distribution
 * @returns Array of signal ranges with counts
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
      FROM app.networks
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
 * @param minTimestamp - Minimum timestamp filter
 * @returns Array of hours with activity counts
 */
async function getTemporalActivity(minTimestamp) {
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
 * @param range - Time range (24h, 7d, 30d, 90d, all)
 * @param minTimestamp - Minimum timestamp
 * @returns Array of time periods with type distribution
 */
async function getRadioTypeOverTime(range, minTimestamp) {
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

    return rows.map((row) => ({
      date: row.date,
      type: row.network_type,
      count: parseInt(row.count),
    }));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to retrieve radio type over time');
  }
}

module.exports = {
  getSignalStrengthDistribution,
  getTemporalActivity,
  getRadioTypeOverTime,
};
