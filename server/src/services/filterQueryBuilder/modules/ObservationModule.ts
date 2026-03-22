import type { FilterBuildContext } from '../FilterBuildContext';
import type { CteResult, ObservationFiltersResult } from '../types';
import { buildObservationFilters } from './observationFilterBuilder';

export class ObservationModule {
  constructor(private ctx: FilterBuildContext) {}

  public buildObservationFilters(): ObservationFiltersResult {
    return buildObservationFilters(this.ctx);
  }

  public buildFilteredObservationsCte(options: { selectedBssids?: string[] } = {}): CteResult {
    const { selectedBssids = [] } = options;
    const { where, joins } = this.buildObservationFilters();

    if (selectedBssids.length > 0) {
      where.push(
        `UPPER(o.bssid) = ANY(${this.ctx.addParam(selectedBssids.map((b) => b.toUpperCase()))})`
      );
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const joinClause = joins.join('\n        ');

    const homeCte = this.ctx.requiresHome
      ? `home AS (
        SELECT ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography AS home_point
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
      ),`
      : '';

    const cte = `
      WITH ${homeCte}
      filtered_obs AS (
        SELECT 
          o.bssid,
          o.ssid,
          o.lat,
          o.lon,
          o.level,
          o.time,
          o.accuracy,
          o.radio_frequency,
          o.radio_capabilities,
          o.radio_type,
          o.geom,
          o.altitude
        FROM app.observations o
        ${joinClause}
        ${this.ctx.requiresHome && !joinClause.includes('CROSS JOIN home') ? 'CROSS JOIN home' : ''}
        ${whereClause.length > 0 ? `${whereClause} AND COALESCE(o.is_quality_filtered, FALSE) = FALSE` : 'WHERE COALESCE(o.is_quality_filtered, FALSE) = FALSE'}
      )
    `;

    return { cte, params: this.ctx.getParams() as any[] };
  }
}
