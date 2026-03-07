import type { QueryResult } from './filterQueryBuilder/types';

const { UniversalFilterQueryBuilder } = require('./filterQueryBuilder');
const v2Service = require('./v2Service');

type PageType = 'geospatial' | 'wigle';
type FiltersInput = Record<string, unknown>;
type EnabledInput = Record<string, boolean>;

interface FilteredAnalyticsResult {
  data: {
    networkTypes: Array<{ type: string; count: number }>;
    signalStrength: Array<{ signal_range: string; range: string; count: number }>;
    security: Array<{ security_type: string; type: string; count: number }>;
    threatDistribution: Array<{ range: string; count: number }>;
    temporalActivity: Array<{ hour: number; count: number }>;
    radioTypeOverTime: Array<{ date: string; network_type: string; type: string; count: number }>;
    threatTrends: Array<{
      date: string;
      avg_score: number;
      avgScore: number;
      critical_count: number;
      criticalCount: number;
      high_count: number;
      highCount: number;
      medium_count: number;
      mediumCount: number;
      low_count: number;
      lowCount: number;
      network_count: number;
      networkCount: number;
    }>;
    topNetworks: Array<{
      bssid: string;
      ssid: string;
      observation_count: number;
      observations: number;
      first_seen: string | null;
      firstSeen: string | null;
      last_seen: string | null;
      lastSeen: string | null;
    }>;
  };
  queryDurationMs: number;
}

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function executeQuery<T>(query: QueryResult): Promise<T[]> {
  const result = await v2Service.executeV2Query(query.sql, query.params);
  return (result.rows || []) as T[];
}

export async function getFilteredAnalytics(
  filters: FiltersInput,
  enabled: EnabledInput,
  pageType: PageType = 'geospatial'
): Promise<FilteredAnalyticsResult> {
  const start = Date.now();
  const builder = new UniversalFilterQueryBuilder(filters, enabled, { pageType });
  const queries = builder.buildAnalyticsQueries();

  const [
    networkTypesRows,
    signalStrengthRows,
    securityRows,
    threatDistributionRows,
    temporalActivityRows,
    radioTypeOverTimeRows,
    threatTrendsRows,
    topNetworksRows,
  ] = await Promise.all([
    executeQuery<Array<{ network_type?: string; type?: string; count: unknown }>[number]>(
      queries.networkTypes
    ),
    executeQuery<Array<{ signal_range?: string; range?: string; count: unknown }>[number]>(
      queries.signalStrength
    ),
    executeQuery<Array<{ security_type?: string; type?: string; count: unknown }>[number]>(
      queries.security
    ),
    executeQuery<Array<{ range: string; count: unknown }>[number]>(queries.threatDistribution),
    executeQuery<Array<{ hour: unknown; count: unknown }>[number]>(queries.temporalActivity),
    executeQuery<
      Array<{ date: string; network_type?: string; type?: string; count: unknown }>[number]
    >(queries.radioTypeOverTime),
    executeQuery<
      Array<{
        date: string;
        avg_score: unknown;
        critical_count: unknown;
        high_count: unknown;
        medium_count: unknown;
        low_count: unknown;
        network_count: unknown;
      }>[number]
    >(queries.threatTrends),
    executeQuery<
      Array<{
        bssid: string;
        ssid: string;
        observation_count: unknown;
        first_seen: string | null;
        last_seen: string | null;
      }>[number]
    >(queries.topNetworks),
  ]);

  const data = {
    networkTypes: networkTypesRows.map((row) => ({
      type: row.network_type || row.type || 'Other',
      count: asNumber(row.count),
    })),
    signalStrength: signalStrengthRows.map((row) => ({
      signal_range: row.signal_range || row.range || '-90',
      range: row.signal_range || row.range || '-90',
      count: asNumber(row.count),
    })),
    security: securityRows.map((row) => ({
      security_type: row.security_type || row.type || 'Unknown',
      type: row.security_type || row.type || 'Unknown',
      count: asNumber(row.count),
    })),
    threatDistribution: threatDistributionRows.map((row) => ({
      range: row.range,
      count: asNumber(row.count),
    })),
    temporalActivity: temporalActivityRows.map((row) => ({
      hour: asNumber(row.hour),
      count: asNumber(row.count),
    })),
    radioTypeOverTime: radioTypeOverTimeRows.map((row) => ({
      date: row.date,
      network_type: row.network_type || row.type || 'Other',
      type: row.network_type || row.type || 'Other',
      count: asNumber(row.count),
    })),
    threatTrends: threatTrendsRows.map((row) => {
      const avgScore = asNumber(row.avg_score);
      const criticalCount = asNumber(row.critical_count);
      const highCount = asNumber(row.high_count);
      const mediumCount = asNumber(row.medium_count);
      const lowCount = asNumber(row.low_count);
      const networkCount = asNumber(row.network_count);
      return {
        date: row.date,
        avg_score: avgScore,
        avgScore,
        critical_count: criticalCount,
        criticalCount,
        high_count: highCount,
        highCount,
        medium_count: mediumCount,
        mediumCount,
        low_count: lowCount,
        lowCount,
        network_count: networkCount,
        networkCount,
      };
    }),
    topNetworks: topNetworksRows.map((row) => {
      const observations = asNumber(row.observation_count);
      return {
        bssid: row.bssid,
        ssid: row.ssid,
        observation_count: observations,
        observations,
        first_seen: row.first_seen,
        firstSeen: row.first_seen,
        last_seen: row.last_seen,
        lastSeen: row.last_seen,
      };
    }),
  };

  return {
    data,
    queryDurationMs: Date.now() - start,
  };
}
