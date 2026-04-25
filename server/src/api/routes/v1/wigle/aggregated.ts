import type { Request, Response } from 'express';
import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');
const { asyncHandler } = require('../../../../utils/asyncHandler');
import { validateQuery, optional } from '../../../../validation/middleware';
import { validateNumberRange, validateIntegerRange } from '../../../../validation/schemas';

const ALL_SOURCES = ['field', 'wigle-v2', 'wigle-v3', 'kml'];

const validateSourcesQuery = validateQuery({
  sources: optional((value: any) => {
    const raw = String(value).trim();
    if (!raw) return { valid: true, value: ALL_SOURCES };
    const parts = raw.split(',').map((s: string) => s.trim());
    const invalid = parts.filter((p: string) => !ALL_SOURCES.includes(p));
    if (invalid.length > 0) {
      return {
        valid: false,
        error: `Unknown sources: ${invalid.join(', ')}. Valid: ${ALL_SOURCES.join(', ')}`,
      };
    }
    return { valid: true, value: parts };
  }),
});

const validateAggregatedQuery = validateQuery({
  west: (value: any) => validateNumberRange(value, -180, 180, 'west'),
  south: (value: any) => validateNumberRange(value, -90, 90, 'south'),
  east: (value: any) => validateNumberRange(value, -180, 180, 'east'),
  north: (value: any) => validateNumberRange(value, -90, 90, 'north'),
  zoom: (value: any) => validateIntegerRange(value, 0, 22, 'zoom'),
  sources: optional((value: any) => {
    const raw = String(value).trim();
    if (!raw) return { valid: true, value: ALL_SOURCES };
    const parts = raw.split(',').map((s: string) => s.trim());
    const invalid = parts.filter((p: string) => !ALL_SOURCES.includes(p));
    if (invalid.length > 0)
      return {
        valid: false,
        error: `Unknown sources: ${invalid.join(', ')}. Valid: ${ALL_SOURCES.join(', ')}`,
      };
    return { valid: true, value: parts };
  }),
});

/**
 * GET /observations/aggregated
 * Zoom-aware spatial aggregation across all four observation sources.
 * Returns a GeoJSON FeatureCollection of grid-cell centroids.
 *
 * Query params:
 *   west, south, east, north — bounding box (WGS-84 degrees)
 *   zoom                     — map zoom level (0–22), controls grid cell size
 *   sources                  — comma-separated subset of: field,wigle-v2,wigle-v3,kml (default: all)
 */
router.get(
  '/observations/aggregated',
  validateAggregatedQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const v = (req as any).validated;
    const sources: string[] = v.sources ?? ALL_SOURCES;

    if (sources.length === 0) {
      return res.json({ ok: true, type: 'FeatureCollection', features: [] });
    }

    const rows = await wigleService.getAggregatedObservations({
      west: v.west,
      south: v.south,
      east: v.east,
      north: v.north,
      zoom: v.zoom,
      sources,
    });

    const features = rows.map((row: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
      properties: {
        count: row.count,
        avg_signal: row.avg_signal,
        source: row.source,
      },
    }));

    return res.json({ ok: true, type: 'FeatureCollection', features });
  })
);

/**
 * GET /observations/extent
 * Returns the ST_Extent bounding box across all active sources.
 * Used by the Fit Bounds button to fly the map to where data actually lives.
 *
 * Query params:
 *   sources — comma-separated subset of: field,wigle-v2,wigle-v3,kml (default: all)
 */
router.get(
  '/observations/extent',
  validateSourcesQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const v = (req as any).validated;
    const sources: string[] = v.sources ?? ALL_SOURCES;
    const extent = await wigleService.getObservationsExtent(sources);
    return res.json({ ok: true, extent });
  })
);

export default router;
