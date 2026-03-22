import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import { OBS_TYPE_EXPR, SECURITY_FROM_CAPS_EXPR, WIFI_CHANNEL_EXPR } from '../sqlExpressions';
import { GeospatialQueryBuilder } from '../builders/GeospatialQueryBuilder';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { FilteredQueryResult, CteResult, GeospatialOptions } from '../types';

export class GeospatialModule {
  constructor(
    private ctx: FilterBuildContext,
    private getFilteredObservationsCte: (options?: { selectedBssids?: string[] }) => CteResult
  ) {}

  public buildGeospatialQuery(options: GeospatialOptions = {}): FilteredQueryResult {
    const builder = new GeospatialQueryBuilder(this.ctx.context as any, () =>
      this.buildGeospatialQueryImpl(options)
    );
    return builder.build();
  }

  private buildGeospatialQueryImpl(options: GeospatialOptions = {}): FilteredQueryResult {
    const { limit = null, offset = 0, selectedBssids = [] } = options;
    const { cte } = this.getFilteredObservationsCte({ selectedBssids });
    const networkWhere = this.ctx.buildNetworkWhere();
    const includeStationaryConfidence = this.ctx.shouldComputeStationaryConfidence();

    if (networkWhere.length === 0) {
      const sql = `
        ${cte}
        SELECT
          o.bssid,
          o.ssid,
          COALESCE(o.radio_capabilities, ne.capabilities) AS capabilities,
          ${SECURITY_FROM_CAPS_EXPR('COALESCE(o.radio_capabilities, ne.capabilities)')} AS security,
          o.lat,
          o.lon,
          o.level AS signal,
          o.radio_frequency AS frequency,
          ${WIFI_CHANNEL_EXPR('o')} AS channel,
          ${OBS_TYPE_EXPR('o')} AS type,
          o.time AS last_seen,
          ne.threat_score,
          ne.threat_level,
          o.accuracy,
          ne.distance_from_home_km,
          ${includeStationaryConfidence ? 'ne.stationary_confidence' : 'NULL::numeric AS stationary_confidence'}
        FROM filtered_obs o
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(o.bssid)
        ORDER BY o.time DESC
        ${limit ? `LIMIT ${this.ctx.addParam(limit)} OFFSET ${this.ctx.addParam(offset)}` : ''}
      `;

      return {
        sql,
        params: this.ctx.getParams(),
        appliedFilters: this.ctx.state.appliedFilters(),
        ignoredFilters: this.ctx.state.ignoredFilters(),
        warnings: this.ctx.state.warnings(),
      };
    }

    const whereClause = `WHERE ${networkWhere.join(' AND ')}`;
    const sql = `
      ${cte}
      , rollup AS (
        SELECT bssid FROM filtered_obs GROUP BY bssid
      )
      SELECT
        o.bssid,
        o.ssid,
        COALESCE(o.radio_capabilities, ne.capabilities) AS capabilities,
        ${SECURITY_FROM_CAPS_EXPR('COALESCE(o.radio_capabilities, ne.capabilities)')} AS security,
        o.lat,
        o.lon,
        o.level AS signal,
        o.radio_frequency AS frequency,
        ${WIFI_CHANNEL_EXPR('o')} AS channel,
        ${OBS_TYPE_EXPR('o')} AS type,
        o.time AS last_seen,
        ne.threat_score,
        ne.threat_level,
        o.accuracy,
        ne.distance_from_home_km,
        ${includeStationaryConfidence ? 'ne.stationary_confidence' : 'NULL::numeric AS stationary_confidence'}
      FROM filtered_obs o
      JOIN rollup r ON UPPER(r.bssid) = UPPER(o.bssid)
      LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(o.bssid)
      ${whereClause}
      ORDER BY o.time DESC
      ${limit ? `LIMIT ${this.ctx.addParam(limit)} OFFSET ${this.ctx.addParam(offset)}` : ''}
    `;

    return {
      sql,
      params: this.ctx.getParams(),
      appliedFilters: this.ctx.state.appliedFilters(),
      ignoredFilters: this.ctx.state.ignoredFilters(),
      warnings: this.ctx.state.warnings(),
    };
  }

  public buildGeospatialCountQuery(): FilteredQueryResult {
    const { cte, params } = this.getFilteredObservationsCte();
    const networkWhere = this.ctx.buildNetworkWhere();
    const whereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';

    const sql = `
      ${cte}
      , rollup AS (
        SELECT bssid FROM filtered_obs GROUP BY bssid
      )
      SELECT COUNT(*) as total
      FROM filtered_obs o
      JOIN rollup r ON UPPER(r.bssid) = UPPER(o.bssid)
      LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(o.bssid)
      ${whereClause}
      WHERE ((o.lat IS NOT NULL AND o.lon IS NOT NULL)
        OR o.geom IS NOT NULL)
    `;

    return {
      sql,
      params: [...params],
      appliedFilters: this.ctx.state.appliedFilters(),
      ignoredFilters: this.ctx.state.ignoredFilters(),
      warnings: this.ctx.state.warnings(),
    };
  }
}
