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
 * @route GET /api/wigle/observations/aggregated
 * @description Zoom-aware spatial aggregation across active observation sources.
 *   ST_SnapToGrid cell size is derived from the zoom level; each cell becomes
 *   a GeoJSON Point feature with count and optional avg_signal properties.
 * @param west - Western bbox longitude, clamped to [-180, 180]
 * @param south - Southern bbox latitude, clamped to [-90, 90]
 * @param east - Eastern bbox longitude, clamped to [-180, 180]
 * @param north - Northern bbox latitude, clamped to [-90, 90]
 * @param zoom - Map zoom level (0–22); controls ST_SnapToGrid resolution
 * @param sources - Comma-separated: field,wigle-v2,wigle-v3,kml (default: all)
 * @returns GeoJSON FeatureCollection of grid-cell centroid Points
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
 * @route GET /api/wigle/observations/extent
 * @description Returns the ST_Extent bounding box across all active sources.
 *   Each source extent is computed independently (using spatial indexes), then
 *   the results are unioned into a single bbox. Used by the Fit Bounds button
 *   to fly the map to where data actually lives.
 * @param sources - Comma-separated: field,wigle-v2,wigle-v3,kml (default: all)
 * @returns { extent: { west, south, east, north } | null }
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
