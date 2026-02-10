/**
 * Analytics Query Builder Module
 * Handles analytics-specific query generation
 */

import type { Filters, EnabledFlags, AnalyticsQueries, AnalyticsOptions } from '../types';

export class AnalyticsQueryBuilder {
  private filters: Filters;
  private enabled: EnabledFlags;
  private params: unknown[];

  constructor(filters: Filters, enabled: EnabledFlags, params: unknown[]) {
    this.filters = filters;
    this.enabled = enabled;
    this.params = params;
  }

  buildQueries(
    cte: string,
    networkWhere: string,
    options: AnalyticsOptions = {}
  ): Record<string, string> {
    const { useLatestPerBssid = false } = options;
    const networkWhereClause = networkWhere.length > 0 ? `WHERE ${networkWhere}` : '';

    return {
      temporal: this.buildTemporalQuery(cte, networkWhereClause),
      signal: this.buildSignalQuery(cte, networkWhereClause),
      radioTypes: this.buildRadioTypesQuery(cte, networkWhereClause),
      security: this.buildSecurityQuery(cte, networkWhereClause),
      channels: this.buildChannelsQuery(cte, networkWhereClause),
      manufacturers: this.buildManufacturersQuery(cte, networkWhereClause),
      threatScores: this.buildThreatScoresQuery(cte, networkWhereClause),
    };
  }

  private buildTemporalQuery(cte: string, networkWhere: string): string {
    return `
      ${cte}
      SELECT 
        DATE_TRUNC('day', o.time) AS date,
        COUNT(DISTINCT o.bssid) AS network_count,
        COUNT(*) AS observation_count
      FROM filtered_observations o
      JOIN app.networks n ON n.bssid = o.bssid
      ${networkWhere}
      GROUP BY DATE_TRUNC('day', o.time)
      ORDER BY date DESC
    `;
  }

  private buildSignalQuery(cte: string, networkWhere: string): string {
    return `
      ${cte}
      SELECT 
        FLOOR(o.level / 10) * 10 AS signal_bucket,
        COUNT(*) AS count
      FROM filtered_observations o
      JOIN app.networks n ON n.bssid = o.bssid
      ${networkWhere}
      GROUP BY signal_bucket
      ORDER BY signal_bucket
    `;
  }

  private buildRadioTypesQuery(cte: string, networkWhere: string): string {
    return `
      ${cte}
      SELECT 
        COALESCE(o.radio_type, '?') AS type,
        COUNT(DISTINCT o.bssid) AS count
      FROM filtered_observations o
      JOIN app.networks n ON n.bssid = o.bssid
      ${networkWhere}
      GROUP BY type
      ORDER BY count DESC
    `;
  }

  private buildSecurityQuery(cte: string, networkWhere: string): string {
    return `
      ${cte}
      SELECT 
        CASE
          WHEN o.radio_capabilities ILIKE '%WPA3%' THEN 'WPA3'
          WHEN o.radio_capabilities ILIKE '%WPA2%' THEN 'WPA2'
          WHEN o.radio_capabilities ILIKE '%WPA%' THEN 'WPA'
          WHEN o.radio_capabilities ILIKE '%WEP%' THEN 'WEP'
          ELSE 'OPEN'
        END AS security,
        COUNT(DISTINCT o.bssid) AS count
      FROM filtered_observations o
      JOIN app.networks n ON n.bssid = o.bssid
      ${networkWhere}
      GROUP BY security
      ORDER BY count DESC
    `;
  }

  private buildChannelsQuery(cte: string, networkWhere: string): string {
    return `
      ${cte}
      SELECT 
        o.radio_channel AS channel,
        COUNT(DISTINCT o.bssid) AS count
      FROM filtered_observations o
      JOIN app.networks n ON n.bssid = o.bssid
      ${networkWhere}
      WHERE o.radio_channel IS NOT NULL
      GROUP BY channel
      ORDER BY channel
    `;
  }

  private buildManufacturersQuery(cte: string, networkWhere: string): string {
    return `
      ${cte}
      SELECT 
        SUBSTRING(o.bssid, 1, 8) AS oui,
        COUNT(DISTINCT o.bssid) AS count
      FROM filtered_observations o
      JOIN app.networks n ON n.bssid = o.bssid
      ${networkWhere}
      GROUP BY oui
      ORDER BY count DESC
      LIMIT 20
    `;
  }

  private buildThreatScoresQuery(cte: string, networkWhere: string): string {
    return `
      ${cte}
      SELECT 
        FLOOR(COALESCE(n.threat_score, 0) / 10) * 10 AS score_bucket,
        COUNT(*) AS count
      FROM filtered_observations o
      JOIN app.networks n ON n.bssid = o.bssid
      ${networkWhere}
      GROUP BY score_bucket
      ORDER BY score_bucket
    `;
  }
}
