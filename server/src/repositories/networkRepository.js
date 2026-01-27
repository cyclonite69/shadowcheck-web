const { query } = require('../config/database');
const logger = require('../logging/logger');
const { UniversalFilterQueryBuilder } = require('../services/filterQueryBuilder');
const { OBS_TYPE_EXPR } = require('../services/filterQueryBuilder/sqlExpressions');

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
      logger.error(`Error fetching networks: ${error.message}`, { error });
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
        FROM public.api_network_explorer ne
        WHERE (ne.threat->>'score')::numeric >= 25
          AND ne.threat->>'level' != 'NONE'
        ORDER BY (ne.threat->>'score')::numeric DESC
        LIMIT 100
      `);

      return result.rows || [];
    } catch (error) {
      logger.error(`Error fetching threatened networks: ${error.message}`, { error });
      return [];
    }
  }

  async getDashboardMetrics(filters = {}, enabled = {}) {
    try {
      // Debug logging
      console.log('[NetworkRepo] getDashboardMetrics called with:');
      console.log('[NetworkRepo] filters:', JSON.stringify(filters, null, 2));
      console.log('[NetworkRepo] enabled:', JSON.stringify(enabled, null, 2));

      const noFiltersEnabled = Object.values(enabled).every((value) => !value);

      if (noFiltersEnabled) {
        const networkResult = await query(`
          SELECT
            COUNT(*) as total_networks,
            COUNT(*) FILTER (WHERE type = 'W') as wifi_count,
            COUNT(*) FILTER (WHERE type = 'E') as ble_count,
            COUNT(*) FILTER (WHERE type = 'B') as bluetooth_count,
            COUNT(*) FILTER (WHERE type = 'L') as lte_count,
            COUNT(*) FILTER (WHERE type = 'N') as nr_count,
            COUNT(*) FILTER (WHERE type = 'G') as gsm_count,
            COUNT(*) FILTER (WHERE bestlat != 0 AND bestlon != 0) as enriched_count
          FROM public.networks
        `);

        const obsResult = await query(`
          SELECT
            COUNT(*) as total_observations,
            COUNT(*) FILTER (WHERE radio_type = 'W') as wifi_observations,
            COUNT(*) FILTER (WHERE radio_type = 'E') as ble_observations,
            COUNT(*) FILTER (WHERE radio_type = 'B') as bluetooth_observations,
            COUNT(*) FILTER (WHERE radio_type = 'L') as lte_observations,
            COUNT(*) FILTER (WHERE radio_type = 'N') as nr_observations,
            COUNT(*) FILTER (WHERE radio_type = 'G') as gsm_observations
          FROM public.observations
        `);

        const threatResult = await query(`
          SELECT
            COUNT(*) FILTER (WHERE final_threat_level = 'CRITICAL') as threats_critical,
            COUNT(*) FILTER (WHERE final_threat_level = 'HIGH') as threats_high,
            COUNT(*) FILTER (WHERE final_threat_level = 'MED') as threats_medium,
            COUNT(*) FILTER (WHERE final_threat_level = 'LOW') as threats_low
          FROM app.network_threat_scores
          WHERE COALESCE(final_threat_score, 0) >= 20
            AND COALESCE(final_threat_level, 'NONE') != 'NONE'
        `);

        const netRow = networkResult.rows[0] || {};
        const obsRow = obsResult.rows[0] || {};
        const threatCounts = threatResult.rows[0] || {};

        return {
          totalNetworks: parseInt(netRow.total_networks) || 0,
          wifiCount: parseInt(netRow.wifi_count) || 0,
          bleCount: parseInt(netRow.ble_count) || 0,
          bluetoothCount: parseInt(netRow.bluetooth_count) || 0,
          lteCount: parseInt(netRow.lte_count) || 0,
          nrCount: parseInt(netRow.nr_count) || 0,
          gsmCount: parseInt(netRow.gsm_count) || 0,
          totalObservations: parseInt(obsRow.total_observations) || 0,
          wifiObservations: parseInt(obsRow.wifi_observations) || 0,
          bleObservations: parseInt(obsRow.ble_observations) || 0,
          bluetoothObservations: parseInt(obsRow.bluetooth_observations) || 0,
          lteObservations: parseInt(obsRow.lte_observations) || 0,
          nrObservations: parseInt(obsRow.nr_observations) || 0,
          gsmObservations: parseInt(obsRow.gsm_observations) || 0,
          threatsCritical: parseInt(threatCounts.threats_critical) || 0,
          threatsHigh: parseInt(threatCounts.threats_high) || 0,
          threatsMedium: parseInt(threatCounts.threats_medium) || 0,
          threatsLow: parseInt(threatCounts.threats_low) || 0,
          activeSurveillance: parseInt(threatCounts.threats_high) || 0,
          enrichedCount: parseInt(netRow.enriched_count) || 0,
          filtersApplied: 0,
        };
      }

      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const { cte } = builder.buildFilteredObservationsCte();

      const obsCountFilters = [];
      if (enabled.observationCountMin && filters.observationCountMin !== undefined) {
        obsCountFilters.push(
          `r.observation_count >= ${builder.addParam(filters.observationCountMin)}`
        );
        builder.addApplied('quality', 'observationCountMin', filters.observationCountMin);
      }
      if (enabled.observationCountMax && filters.observationCountMax !== undefined) {
        obsCountFilters.push(
          `r.observation_count <= ${builder.addParam(filters.observationCountMax)}`
        );
        builder.addApplied('quality', 'observationCountMax', filters.observationCountMax);
      }

      const obsCountWhere =
        obsCountFilters.length > 0 ? `WHERE ${obsCountFilters.join(' AND ')}` : '';

      const sql = `
        ${cte}
        , obs_rollup AS (
          SELECT
            bssid,
            COUNT(*) AS observation_count
          FROM filtered_obs
          GROUP BY bssid
        ),
        obs_latest AS (
          SELECT DISTINCT ON (bssid)
            bssid,
            ssid,
            lat,
            lon,
            level,
            accuracy,
            time,
            radio_type,
            radio_frequency,
            radio_capabilities
          FROM filtered_obs
          ORDER BY bssid, time DESC
        ),
        network_set AS (
          SELECT
            l.bssid,
            l.lat,
            l.lon,
            l.radio_type,
            l.radio_frequency,
            l.radio_capabilities
          FROM obs_latest l
          JOIN obs_rollup r ON r.bssid = l.bssid
          ${obsCountWhere}
        ),
        network_counts AS (
          SELECT
            COUNT(*) AS total_networks,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('n')} = 'W') as wifi_count,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('n')} = 'E') as ble_count,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('n')} = 'B') as bluetooth_count,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('n')} = 'L') as lte_count,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('n')} = 'N') as nr_count,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('n')} = 'G') as gsm_count,
            COUNT(*) FILTER (WHERE n.lat IS NOT NULL AND n.lon IS NOT NULL AND n.lat != 0 AND n.lon != 0) as enriched_count
          FROM network_set n
        ),
        obs_counts AS (
          SELECT
            COUNT(*) as total_observations,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('o')} = 'W') as wifi_observations,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('o')} = 'E') as ble_observations,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('o')} = 'B') as bluetooth_observations,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('o')} = 'L') as lte_observations,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('o')} = 'N') as nr_observations,
            COUNT(*) FILTER (WHERE ${OBS_TYPE_EXPR('o')} = 'G') as gsm_observations
          FROM filtered_obs o
        ),
        threat_counts AS (
          SELECT
            COUNT(*) FILTER (WHERE nts.final_threat_level = 'CRITICAL') as threats_critical,
            COUNT(*) FILTER (WHERE nts.final_threat_level = 'HIGH') as threats_high,
            COUNT(*) FILTER (WHERE nts.final_threat_level = 'MED') as threats_medium,
            COUNT(*) FILTER (WHERE nts.final_threat_level = 'LOW') as threats_low
          FROM network_set n
          LEFT JOIN app.network_threat_scores nts ON nts.bssid = n.bssid
          WHERE COALESCE(nts.final_threat_score, 0) >= 20
            AND COALESCE(nts.final_threat_level, 'NONE') != 'NONE'
        )
        SELECT
          network_counts.*,
          obs_counts.*,
          threat_counts.*
        FROM network_counts, obs_counts, threat_counts
      `;

      const result = await query(sql, builder.params);
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
        filtersApplied: builder.appliedFilters.length,
      };
    } catch (error) {
      logger.error(`Error fetching dashboard metrics: ${error.message}`, { error });
      return {
        totalNetworks: 0,
        wifiCount: 0,
        bleCount: 0,
        bluetoothCount: 0,
        lteCount: 0,
        nrCount: 0,
        gsmCount: 0,
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
