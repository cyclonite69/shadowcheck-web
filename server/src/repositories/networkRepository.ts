const { query } = require('../config/database');
const logger = require('../logging/logger');
const { UniversalFilterQueryBuilder } = require('../services/filterQueryBuilder');
const BaseRepository = require('./baseRepository');
const {
  OBS_TYPE_EXPR,
  THREAT_LEVEL_EXPR,
  THREAT_SCORE_EXPR,
  normalizeRadioTypes,
  isAllRadioTypesSelection,
} = require('../services/filterQueryBuilder/sqlExpressions');

export {};

class NetworkRepository extends BaseRepository {
  static ALLOWED_COLUMNS = new Set([
    'bssid',
    'ssid',
    'first_seen',
    'last_seen',
    'latitude',
    'longitude',
    'location',
    'max_signal',
    'frequency',
  ]);

  constructor() {
    super('app.networks');
  }

  private getEffectiveEnabledFilters(filters: any, enabled: any): any {
    const effectiveEnabled: any = { ...(enabled || {}) };
    if (effectiveEnabled.radioTypes && Array.isArray((filters as any).radioTypes)) {
      const normalizedRadioTypes = normalizeRadioTypes((filters as any).radioTypes);
      if (normalizedRadioTypes.length === 0 || isAllRadioTypesSelection(normalizedRadioTypes)) {
        effectiveEnabled.radioTypes = false;
      }
    }
    return effectiveEnabled;
  }

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
    } catch (error: any) {
      logger.error(`Error fetching networks: ${error.message}`, { error });
      return [];
    }
  }

  async getNetworksByType(type: string) {
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
    } catch (error: any) {
      logger.error(`Error fetching ${type} networks: ${error.message}`, { error });
      return [];
    }
  }

  async getThreatenedNetworks() {
    try {
      const result = await query(`
        SELECT
          ne.bssid,
          ne.ssid,
          ne.type,
          ne.signal,
          ne.frequency,
          ne.security,
          ne.lon as longitude,
          ne.lat as latitude,
          ne.last_seen as lastSeen,
          ne.observations,
          (ne.threat->>'score')::numeric as threatScore,
          ne.threat->>'level' as threatLevel,
          ne.threat->>'summary' as threatSummary,
          ne.manufacturer
        FROM app.api_network_explorer ne
        WHERE (ne.threat->>'score')::numeric >= 25
          AND ne.threat->>'level' != 'NONE'
        ORDER BY (ne.threat->>'score')::numeric DESC
        LIMIT 100
      `);

      return result.rows || [];
    } catch (error: any) {
      logger.error(`Error fetching threatened networks: ${error.message}`, { error });
      return [];
    }
  }

  async getDashboardMetrics(filters: any = {}, enabled: any = {}) {
    try {
      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const validationErrors = builder.getValidationErrors();
      if (validationErrors.length > 0) {
        logger.error('Invalid filters for getDashboardMetrics', {
          validationErrors,
          enabledKeys: Object.keys(enabled || {}).filter((key) => enabled[key]),
          filterKeys: Object.keys(filters || {}),
        });
        return {
          totalNetworks: 0,
          wifiCount: 0,
          bleCount: 0,
          bluetoothCount: 0,
          lteCount: 0,
          nrCount: 0,
          gsmCount: 0,
          totalObservations: 0,
          wifiObservations: 0,
          bleObservations: 0,
          bluetoothObservations: 0,
          lteObservations: 0,
          nrObservations: 0,
          gsmObservations: 0,
          threatsCritical: 0,
          threatsHigh: 0,
          threatsMedium: 0,
          threatsLow: 0,
          activeSurveillance: 0,
          enrichedCount: 0,
          filtersApplied: 0,
        };
      }
      const { sql, params } = builder.buildDashboardMetricsQuery();

      const result = await query(sql, params);
      const row = result.rows[0] || {};

      return {
        totalNetworks: parseInt(row.total_networks) || 0,
        wifiCount: parseInt(row.wifi_count) || 0,
        bleCount: parseInt(row.ble_count) || 0,
        bluetoothCount: parseInt(row.bluetooth_count) || 0,
        lteCount: parseInt(row.lte_count) || 0,
        nrCount: parseInt(row.nr_count) || 0,
        gsmCount: parseInt(row.gsm_count) || 0,
        totalObservations: parseInt(row.total_observations) || 0,
        wifiObservations: parseInt(row.wifi_observations) || 0,
        bleObservations: parseInt(row.ble_observations) || 0,
        bluetoothObservations: parseInt(row.bluetooth_observations) || 0,
        lteObservations: parseInt(row.lte_observations) || 0,
        nrObservations: parseInt(row.nr_observations) || 0,
        gsmObservations: parseInt(row.gsm_observations) || 0,
        threatsCritical: parseInt(row.threats_critical) || 0,
        threatsHigh: parseInt(row.threats_high) || 0,
        threatsMedium: parseInt(row.threats_medium) || 0,
        threatsLow: parseInt(row.threats_low) || 0,
        activeSurveillance: parseInt(row.threats_high) || 0,
        enrichedCount: parseInt(row.enriched_count) || 0,
        filtersApplied: builder.getAppliedCount(),
      };
    } catch (error: any) {
      logger.error(`Error fetching dashboard metrics: ${error.message}`, { error });
      return {
        totalNetworks: 0,
        wifiCount: 0,
        bleCount: 0,
        bluetoothCount: 0,
        lteCount: 0,
        nrCount: 0,
        gsmCount: 0,
        totalObservations: 0,
        wifiObservations: 0,
        bleObservations: 0,
        bluetoothObservations: 0,
        lteObservations: 0,
        nrObservations: 0,
        gsmObservations: 0,
        threatsCritical: 0,
        threatsHigh: 0,
        threatsMedium: 0,
        threatsLow: 0,
        activeSurveillance: 0,
        enrichedCount: 0,
        filtersApplied: 0,
      };
    }
  }
}

module.exports = NetworkRepository;
