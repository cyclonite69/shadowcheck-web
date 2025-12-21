const { query } = require('../config/database');

class NetworkRepository {
  async getAllNetworks() {
    try {
      const result = await query(`
        SELECT
          bssid,
          ssid,
          type,
          channel,
          max_signal as maxSignal,
          bestlevel as signalDbm,
          encryption,
          ST_X(location::geometry) as longitude,
          ST_Y(location::geometry) as latitude,
          first_seen as firstSeen,
          last_seen as lastSeen,
          ml_threat_score as threatScore,
          manufacturer,
          device_type as deviceType,
          capabilities
        FROM app.networks
        ORDER BY ml_threat_score DESC NULLS LAST, max_signal DESC NULLS LAST
        LIMIT 1000
      `);

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching networks:', error);
      return [];
    }
  }

  async getNetworksByType(type) {
    try {
      const result = await query(
        `
        SELECT
          bssid,
          ssid,
          type,
          channel,
          max_signal as maxSignal,
          bestlevel as signalDbm,
          encryption,
          ST_X(location::geometry) as longitude,
          ST_Y(location::geometry) as latitude,
          first_seen as firstSeen,
          last_seen as lastSeen,
          ml_threat_score as threatScore,
          manufacturer,
          device_type as deviceType
        FROM app.networks
        WHERE type = $1
        ORDER BY ml_threat_score DESC NULLS LAST, max_signal DESC NULLS LAST
      `,
        [type]
      );

      return result.rows || [];
    } catch (error) {
      console.error(`Error fetching ${type} networks:`, error);
      return [];
    }
  }

  async getThreatenedNetworks() {
    try {
      const result = await query(`
        SELECT
          bssid,
          ssid,
          type,
          channel,
          max_signal as maxSignal,
          bestlevel as signalDbm,
          encryption,
          ST_X(location::geometry) as longitude,
          ST_Y(location::geometry) as latitude,
          first_seen as firstSeen,
          last_seen as lastSeen,
          ml_threat_score as threatScore,
          manufacturer,
          device_type as deviceType
        FROM app.networks
        WHERE ml_threat_score >= 40
        ORDER BY ml_threat_score DESC
      `);

      return result.rows || [];
    } catch (error) {
      console.error('Error fetching threatened networks:', error);
      return [];
    }
  }

  async getDashboardMetrics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_networks,
          COUNT(*) FILTER (WHERE type = 'W') as wifi_count,
          COUNT(*) FILTER (WHERE type = 'E') as ble_count,
          COUNT(*) FILTER (WHERE type = 'B') as bluetooth_count,
          COUNT(*) FILTER (WHERE type = 'L') as lte_count,
          COUNT(*) FILTER (WHERE type = 'W' AND ml_threat_score >= 80) as critical_threats,
          COUNT(*) FILTER (WHERE type = 'W' AND ml_threat_score >= 60 AND ml_threat_score < 80) as high_threats,
          COUNT(*) FILTER (WHERE type = 'W' AND ml_threat_score >= 40 AND ml_threat_score < 60) as medium_threats,
          COUNT(*) FILTER (WHERE type = 'W' AND ml_threat_score >= 20 AND ml_threat_score < 40) as low_threats,
          COUNT(*) FILTER (WHERE type = 'W' AND ml_threat_score >= 40) as active_surveillance,
          COUNT(*) FILTER (WHERE location IS NOT NULL) as enriched_count
        FROM public.networks
      `);

      const row = result.rows[0] || {};

      return {
        totalNetworks: parseInt(row.total_networks) || 0,
        wifiCount: parseInt(row.wifi_count) || 0,
        bleCount: parseInt(row.ble_count) || 0,
        bluetoothCount: parseInt(row.bluetooth_count) || 0,
        lteCount: parseInt(row.lte_count) || 0,
        threatsCritical: parseInt(row.critical_threats) || 0,
        threatsHigh: parseInt(row.high_threats) || 0,
        threatsMedium: parseInt(row.medium_threats) || 0,
        threatsLow: parseInt(row.low_threats) || 0,
        activeSurveillance: parseInt(row.active_surveillance) || 0,
        enrichedCount: parseInt(row.enriched_count) || 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return {
        totalNetworks: 0,
        wifiCount: 0,
        bleCount: 0,
        bluetoothCount: 0,
        lteCount: 0,
        threatsCritical: 0,
        threatsHigh: 0,
        threatsMedium: 0,
        threatsLow: 0,
        activeSurveillance: 0,
        enrichedCount: 0,
      };
    }
  }
}

module.exports = NetworkRepository;
