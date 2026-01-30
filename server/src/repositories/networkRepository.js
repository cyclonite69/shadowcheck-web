const { query } = require('../config/database');
const logger = require('../logging/logger');
const { UniversalFilterQueryBuilder } = require('../services/filterQueryBuilder');
const {
  OBS_TYPE_EXPR,
  THREAT_LEVEL_EXPR,
  THREAT_SCORE_EXPR,
} = require('../services/filterQueryBuilder/sqlExpressions');

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
        FROM app.api_network_explorer ne
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
          FROM app.networks
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
          FROM app.observations
        `);

        // Use dynamic THREAT_LEVEL_EXPR for consistent threat counts (same logic as filtered queries)
        const dynamicThreatLevel = THREAT_LEVEL_EXPR('nts', 'nt');
        const threatResult = await query(`
          SELECT
            COUNT(*) FILTER (WHERE (${dynamicThreatLevel}) = 'CRITICAL') as threats_critical,
            COUNT(*) FILTER (WHERE (${dynamicThreatLevel}) = 'HIGH') as threats_high,
            COUNT(*) FILTER (WHERE (${dynamicThreatLevel}) = 'MED') as threats_medium,
            COUNT(*) FILTER (WHERE (${dynamicThreatLevel}) = 'LOW') as threats_low
          FROM app.network_threat_scores nts
          LEFT JOIN app.network_tags nt ON nt.bssid = nts.bssid
          WHERE (${dynamicThreatLevel}) != 'NONE'
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

      // Check if only threat-level filters are enabled (network-only filters)
      // These can be handled with a fast direct query instead of heavy CTEs
      const threatOnlyFilters = ['threatCategories', 'threatScoreMin', 'threatScoreMax'];
      const enabledKeys = Object.entries(enabled)
        .filter(([, value]) => value)
        .map(([key]) => key);
      const isThreatOnlyFilter =
        enabledKeys.length > 0 && enabledKeys.every((key) => threatOnlyFilters.includes(key));

      if (isThreatOnlyFilter) {
        // Map frontend lowercase categories to database uppercase values
        const threatLevelMap = {
          critical: 'CRITICAL',
          high: 'HIGH',
          medium: 'MED',
          low: 'LOW',
        };

        const params = [];
        const whereClauses = [];

        // Use THREAT_LEVEL_EXPR for dynamic threat level calculation (same as geospatial query)
        // This blends network_threat_scores with network_tags for accurate filtering
        const dynamicThreatLevel = THREAT_LEVEL_EXPR('nts', 'nt');
        const dynamicThreatScore = THREAT_SCORE_EXPR('nts', 'nt');

        if (
          enabled.threatCategories &&
          Array.isArray(filters.threatCategories) &&
          filters.threatCategories.length > 0
        ) {
          const dbThreatLevels = filters.threatCategories
            .map((cat) => threatLevelMap[cat] || cat.toUpperCase())
            .filter(Boolean);
          params.push(dbThreatLevels);
          whereClauses.push(`(${dynamicThreatLevel}) = ANY($${params.length})`);
        }
        if (enabled.threatScoreMin && filters.threatScoreMin !== undefined) {
          params.push(filters.threatScoreMin);
          whereClauses.push(`(${dynamicThreatScore}) >= $${params.length}`);
        }
        if (enabled.threatScoreMax && filters.threatScoreMax !== undefined) {
          params.push(filters.threatScoreMax);
          whereClauses.push(`(${dynamicThreatScore}) <= $${params.length}`);
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Fast query: Get BSSIDs matching threat filter using dynamic calculation, then count their stats
        const sql = `
          WITH filtered_bssids AS (
            SELECT nts.bssid
            FROM app.network_threat_scores nts
            LEFT JOIN app.network_tags nt ON nt.bssid = nts.bssid
            ${whereClause}
          ),
          network_counts AS (
            SELECT
              COUNT(*) AS total_networks,
              COUNT(*) FILTER (WHERE n.type = 'W') AS wifi_count,
              COUNT(*) FILTER (WHERE n.type = 'E') AS ble_count,
              COUNT(*) FILTER (WHERE n.type = 'B') AS bluetooth_count,
              COUNT(*) FILTER (WHERE n.type = 'L') AS lte_count,
              COUNT(*) FILTER (WHERE n.type = 'N') AS nr_count,
              COUNT(*) FILTER (WHERE n.type = 'G') AS gsm_count,
              COUNT(*) FILTER (WHERE n.bestlat != 0 AND n.bestlon != 0) AS enriched_count
            FROM app.networks n
            JOIN filtered_bssids fb ON fb.bssid = n.bssid
          ),
          obs_counts AS (
            SELECT
              COUNT(*) AS total_observations,
              COUNT(*) FILTER (WHERE o.radio_type = 'W') AS wifi_observations,
              COUNT(*) FILTER (WHERE o.radio_type = 'E') AS ble_observations,
              COUNT(*) FILTER (WHERE o.radio_type = 'B') AS bluetooth_observations,
              COUNT(*) FILTER (WHERE o.radio_type = 'L') AS lte_observations,
              COUNT(*) FILTER (WHERE o.radio_type = 'N') AS nr_observations,
              COUNT(*) FILTER (WHERE o.radio_type = 'G') AS gsm_observations
            FROM app.observations o
            JOIN filtered_bssids fb ON fb.bssid = o.bssid
          ),
          threat_counts AS (
            SELECT
              COUNT(*) FILTER (WHERE (${dynamicThreatLevel}) = 'CRITICAL') AS threats_critical,
              COUNT(*) FILTER (WHERE (${dynamicThreatLevel}) = 'HIGH') AS threats_high,
              COUNT(*) FILTER (WHERE (${dynamicThreatLevel}) = 'MED') AS threats_medium,
              COUNT(*) FILTER (WHERE (${dynamicThreatLevel}) = 'LOW') AS threats_low
            FROM app.network_threat_scores nts
            LEFT JOIN app.network_tags nt ON nt.bssid = nts.bssid
            JOIN filtered_bssids fb ON fb.bssid = nts.bssid
          )
          SELECT
            network_counts.*,
            obs_counts.*,
            threat_counts.*
          FROM network_counts, obs_counts, threat_counts
        `;

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
          filtersApplied: enabledKeys.length,
        };
      }

      const builder = new UniversalFilterQueryBuilder(filters, enabled);
      const { cte } = builder.buildFilteredObservationsCte();
      const networkWhere = builder.buildNetworkWhere();
      const networkWhereClause =
        networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';

      const sql = `
        ${cte}
        , obs_rollup AS (
          SELECT
            bssid,
            COUNT(*) AS observation_count
          FROM filtered_obs
          GROUP BY bssid
        ),
        obs_centroids AS (
          SELECT
            bssid,
            ST_Centroid(ST_Collect(geom::geometry)) AS centroid,
            MIN(time) AS first_time,
            MAX(time) AS last_time,
            COUNT(*) AS obs_count
          FROM filtered_obs
          WHERE geom IS NOT NULL
          GROUP BY bssid
        ),
        obs_spatial AS (
          SELECT
            c.bssid,
            CASE
              WHEN c.obs_count < 2 THEN NULL
              ELSE ROUND(
                LEAST(1, GREATEST(0,
                  (
                    (1 - LEAST(MAX(ST_Distance(o.geom::geography, c.centroid::geography)) / 500.0, 1)) * 0.5 +
                    (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
                    LEAST(c.obs_count / 50.0, 1) * 0.2
                  )
                ))::numeric,
                3
              )
            END AS stationary_confidence
          FROM filtered_obs o
          JOIN obs_centroids c ON c.bssid = o.bssid
          WHERE o.geom IS NOT NULL
          GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
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
            l.radio_capabilities,
            r.observation_count,
            s.stationary_confidence,
            ne.threat
          FROM obs_latest l
          JOIN obs_rollup r ON r.bssid = l.bssid
          LEFT JOIN obs_spatial s ON s.bssid = l.bssid
          LEFT JOIN app.api_network_explorer ne ON UPPER(ne.bssid) = UPPER(l.bssid)
          LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(l.bssid)
          LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(l.bssid)
          ${networkWhereClause}
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
          JOIN network_set n ON n.bssid = o.bssid
        ),
        threat_counts AS (
          SELECT
            COUNT(*) FILTER (WHERE ${THREAT_LEVEL_EXPR('nts', 'nt')} = 'CRITICAL') as threats_critical,
            COUNT(*) FILTER (WHERE ${THREAT_LEVEL_EXPR('nts', 'nt')} = 'HIGH') as threats_high,
            COUNT(*) FILTER (WHERE ${THREAT_LEVEL_EXPR('nts', 'nt')} = 'MED') as threats_medium,
            COUNT(*) FILTER (WHERE ${THREAT_LEVEL_EXPR('nts', 'nt')} = 'LOW') as threats_low
          FROM network_set n
          LEFT JOIN app.network_threat_scores nts ON nts.bssid = n.bssid
          LEFT JOIN app.network_tags nt ON nt.bssid = n.bssid
          WHERE (${THREAT_SCORE_EXPR('nts', 'nt')}) >= 20
            AND (${THREAT_LEVEL_EXPR('nts', 'nt')}) != 'NONE'
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
