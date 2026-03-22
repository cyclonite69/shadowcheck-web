import { THREAT_LEVEL_EXPR } from '../sqlExpressions';
import type { AnalyticsQueries } from '../types';
import type { AnalyticsQueryContext } from './analyticsQueryContext';

export function buildAnalyticsQueriesFromContext(
  context: AnalyticsQueryContext
): AnalyticsQueries {
  const { baseCtes, filteredObsCte, params, sourceTable, typeExpr, securityExpr } = context;

  return {
    networkTypes: {
      sql: `${baseCtes} SELECT ${typeExpr} as type, COUNT(*) as count FROM ${sourceTable} GROUP BY type`,
      params: [...params],
    },
    signalStrength: {
      sql: `${baseCtes} SELECT 
                CASE 
                  WHEN level >= -50 THEN 'Excellent'
                  WHEN level >= -60 THEN 'Good'
                  WHEN level >= -70 THEN 'Fair'
                  ELSE 'Poor'
                END as strength_category,
                COUNT(*) as count 
              FROM ${sourceTable} GROUP BY strength_category`,
      params: [...params],
    },
    security: {
      sql: `${baseCtes} SELECT ${securityExpr} as encryption, COUNT(*) as count FROM ${sourceTable} GROUP BY encryption`,
      params: [...params],
    },
    threatDistribution: {
      sql: `${baseCtes} 
              SELECT 
                ${THREAT_LEVEL_EXPR('nts', 'nt')} as threat_level,
                COUNT(*) as count
              FROM network_set
              LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(network_set.bssid)
              LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(network_set.bssid)
              GROUP BY threat_level`,
      params: [...params],
    },
    temporalActivity: {
      sql: `${filteredObsCte} SELECT DATE_TRUNC('hour', time) as period, COUNT(*) as count FROM filtered_obs GROUP BY period ORDER BY period`,
      params: [...params],
    },
    radioTypeOverTime: {
      sql: `${filteredObsCte} SELECT DATE_TRUNC('day', time) as period, ${typeExpr.replace(/filtered_obs|network_set/g, 'o')} as type, COUNT(*) as count FROM filtered_obs o GROUP BY period, type ORDER BY period`,
      params: [...params],
    },
    threatTrends: {
      sql: `${baseCtes} 
              SELECT 
                DATE_TRUNC('day', observed_at) as period,
                ${THREAT_LEVEL_EXPR('nts', 'nt')} as threat_level,
                COUNT(*) as count
              FROM network_set
              LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(network_set.bssid)
              LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(network_set.bssid)
              GROUP BY period, threat_level
              ORDER BY period`,
      params: [...params],
    },
    topNetworks: {
      sql: `${baseCtes} SELECT bssid, ssid, observation_count as count FROM network_set ORDER BY count DESC LIMIT 10`,
      params: [...params],
    },
  };
}

export function buildAnalyticsQueriesFromMaterializedView(): AnalyticsQueries {
  const params: unknown[] = [];
  return {
    networkTypes: {
      sql: `SELECT CASE 
                WHEN type = 'W' THEN 'WiFi'
                WHEN type = 'E' THEN 'BLE'
                WHEN type = 'B' THEN 'BT'
                WHEN type = 'L' THEN 'LTE'
                WHEN type = 'N' THEN 'NR'
                WHEN type = 'G' THEN 'GSM'
                ELSE type 
              END as type, COUNT(*) as count FROM app.analytics_summary_mv GROUP BY type`,
      params,
    },
    signalStrength: {
      sql: `SELECT CASE 
                WHEN max_signal >= -30 THEN 'Excellent'
                WHEN max_signal >= -50 THEN 'Good'
                WHEN max_signal >= -70 THEN 'Fair'
                ELSE 'Poor'
              END as strength_category, COUNT(*) as count FROM app.analytics_summary_mv GROUP BY strength_category`,
      params,
    },
    security: {
      sql: `SELECT CASE 
                WHEN capabilities LIKE '%WPA3%' THEN 'WPA3'
                WHEN capabilities LIKE '%WPA2%' THEN 'WPA2'
                WHEN capabilities LIKE '%WPA%' THEN 'WPA'
                WHEN capabilities LIKE '%WEP%' THEN 'WEP'
                ELSE 'Open'
              END as encryption, COUNT(*) as count FROM app.analytics_summary_mv GROUP BY encryption`,
      params,
    },
    threatDistribution: {
      sql: `SELECT CASE 
                WHEN threat_score >= 0.7 THEN 'high'
                WHEN threat_score >= 0.4 THEN 'medium'
                WHEN threat_score >= 0.1 THEN 'low'
                ELSE 'none'
              END as threat_level, COUNT(*) as count FROM app.analytics_summary_mv GROUP BY threat_level`,
      params,
    },
    temporalActivity: { sql: 'SELECT NOW() as period, 0 as count', params },
    radioTypeOverTime: { sql: "SELECT NOW() as period, 'W' as type, 0 as count", params },
    threatTrends: { sql: "SELECT NOW() as period, 'none' as threat_level, 0 as count", params },
    topNetworks: {
      sql: 'SELECT bssid, ssid, 0 as count FROM app.api_network_explorer_mv LIMIT 10',
      params,
    },
  };
}
