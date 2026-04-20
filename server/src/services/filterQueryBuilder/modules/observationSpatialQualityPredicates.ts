import { getSpatialBoundingBoxFragment } from '../spatialHelpers';
import type { FilterBuildContext } from '../FilterBuildContext';

export function buildObservationSpatialQualityPredicates(ctx: FilterBuildContext): string[] {
  const where: string[] = [];
  const f = ctx.filters;
  const e = ctx.enabled;

  if (e.excludeInvalidCoords) {
    where.push(
      'o.lat IS NOT NULL',
      'o.lon IS NOT NULL',
      'o.lat BETWEEN -90 AND 90',
      'o.lon BETWEEN -180 AND 180'
    );
    ctx.addApplied('quality', 'excludeInvalidCoords', true);
  }

  if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
    where.push(
      `o.accuracy IS NOT NULL AND o.accuracy > 0 AND o.accuracy <= ${ctx.addParam(
        f.gpsAccuracyMax
      )}`
    );
    ctx.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
  }

  if (e.observationCountMin && f.observationCountMin !== undefined) {
    // Observation count filtering is handled at the network level (networkWhereBuilder)
    // via ne.observations from the materialized view. Do not duplicate here.
  }

  if (e.observationCountMax && f.observationCountMax !== undefined) {
    // Observation count filtering is handled at the network level (networkWhereBuilder)
    // via ne.observations from the materialized view. Do not duplicate here.
  }

  if (e.boundingBox && f.boundingBox) {
    const west = f.boundingBox.west;
    const south = f.boundingBox.south;
    const east = f.boundingBox.east;
    const north = f.boundingBox.north;

    if (west <= east) {
      where.push(
        `o.geom && ST_MakeEnvelope(${ctx.addParam(west)}, ${ctx.addParam(south)}, ${ctx.addParam(east)}, ${ctx.addParam(north)}, 4326)`
      );
    } else {
      where.push(
        `(o.geom && ST_MakeEnvelope(${ctx.addParam(west)}, ${ctx.addParam(south)}, 180, ${ctx.addParam(north)}, 4326) OR o.geom && ST_MakeEnvelope(-180, ${ctx.addParam(south)}, ${ctx.addParam(east)}, ${ctx.addParam(north)}, 4326))`
      );
    }
    ctx.addApplied('spatial', 'boundingBox', f.boundingBox);
  }

  if (e.radiusFilter && f.radiusFilter) {
    const { longitude, latitude, radiusMeters } = f.radiusFilter;
    where.push(
      getSpatialBoundingBoxFragment(latitude, longitude, radiusMeters),
      `ST_DWithin(o.geom::geography, ST_SetSRID(ST_MakePoint(${ctx.addParam(longitude)}, ${ctx.addParam(latitude)}), 4326)::geography, ${ctx.addParam(radiusMeters)})`
    );
    ctx.addApplied('spatial', 'radiusFilter', f.radiusFilter);
  }

  if (e.distanceFromHomeMin || e.distanceFromHomeMax) {
    ctx.requiresHome = true;
    if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
      // Home coordinates are DB-resident (resolved via the home CTE at query time),
      // so bounding-box pre-filtering is not available here — use ST_DWithin only.
      where.push(
        `ST_DWithin(o.geom::geography, home.home_point, ${ctx.addParam(f.distanceFromHomeMin * 1000)})`
      );
      ctx.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
    }
    if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
      where.push(
        `NOT ST_DWithin(o.geom::geography, home.home_point, ${ctx.addParam(f.distanceFromHomeMax * 1000)})`
      );
      ctx.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
    }
  }

  return where;
}
