import { Router, Request, Response } from 'express';
const { alprService } = require('../../../config/container');

const router = Router();

type Bbox = [number, number, number, number];

function parseBbox(value: unknown): Bbox | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const rawCoordinates = value.split(',');
  if (rawCoordinates.some((coordinate) => coordinate.trim() === '')) {
    return null;
  }
  const coordinates = rawCoordinates.map(Number);
  if (coordinates.length !== 4 || coordinates.some((coordinate) => !Number.isFinite(coordinate))) {
    return null;
  }

  const [west, south, east, north] = coordinates;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) {
    return null;
  }

  return [west, south, east, north];
}

/**
 * GET /api/v1/surveillance/alpr-cameras
 * Returns GeoJSON FeatureCollection of OpenStreetMap surveillance camera locations.
 */
router.get('/', async (req: Request, res: Response) => {
  const bbox = parseBbox(req.query.bbox);
  if (bbox === null) {
    res.status(400).json({
      ok: false,
      error: 'bbox must be four finite coordinates: west,south,east,north',
    });
    return;
  }

  try {
    const geojson = await alprService.getAlprCamerasGeoJSON(bbox);
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching ALPR cameras:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch ALPR camera locations',
    });
  }
});

export default router;
