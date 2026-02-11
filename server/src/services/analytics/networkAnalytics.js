/**
 * Network Analytics Module
 * Manufacturer, channel, observation counts, and network type analytics
 */

const { query } = require('../../config/database');
const { DatabaseError } = require('../../errors/AppError');

/**
 * Get network type distribution
 * @returns Array of network types with counts
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
      FROM app.networks
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
 * Get security type distribution
 * @returns Array of security types with counts
 */
async function getSecurityDistribution() {
  try {
    const { rows } = await query(`
      SELECT
        CASE
          WHEN capabilities ILIKE '%WPA3%' AND capabilities ILIKE '%ENT%' THEN 'WPA3-E'
          WHEN capabilities ILIKE '%WPA3%' AND (capabilities ILIKE '%SAE%' OR capabilities ILIKE '%PSK%') THEN 'WPA3-P'
          WHEN capabilities ILIKE '%WPA3%' THEN 'WPA3'
          WHEN capabilities ILIKE '%WPA2%' AND capabilities ILIKE '%ENT%' THEN 'WPA2-E'
          WHEN capabilities ILIKE '%WPA2%' AND capabilities ILIKE '%PSK%' THEN 'WPA2-P'
          WHEN capabilities ILIKE '%WPA2%' THEN 'WPA2'
          WHEN capabilities ILIKE '%WPA%' AND NOT capabilities ILIKE '%WPA2%' AND NOT capabilities ILIKE '%WPA3%' THEN 'WPA'
          WHEN capabilities ILIKE '%WEP%' THEN 'WEP'
          WHEN capabilities ILIKE '%WPS%' AND (capabilities IS NULL OR capabilities = '' OR NOT capabilities ILIKE '%WPA%') THEN 'WPS'
          WHEN capabilities IS NULL OR capabilities = '' OR capabilities ILIKE '%ESS%' THEN 'OPEN'
          ELSE 'OPEN'
        END as security_type,
        COUNT(*) as count
      FROM app.networks
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
 * @param limit - Number of results to return
 * @returns Array of top networks
 */
async function getTopNetworks(limit = 100) {
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

    return rows.map((row) => ({
      bssid: row.bssid,
      ssid: row.ssid || '<Hidden>',
      type: row.type,
      signal: row.signal,
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
async function getDashboardStats() {
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

    const radioCounts = {};
    radioTypes.rows.forEach((row) => {
      radioCounts[row.radio_type] = parseInt(row.count);
    });

    return {
      totalNetworks: parseInt(totalNetworks.rows[0]?.count || '0'),
      threatsCount: 0,
      surveillanceCount: 0,
      enrichedCount: 0,
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

module.exports = {
  getNetworkTypes,
  getSecurityDistribution,
  getTopNetworks,
  getDashboardStats,
};
