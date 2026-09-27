import { Router, Request, Response } from 'express';
const { alprService } = require('../../../config/container');

const router = Router();

/**
 * GET /api/v1/surveillance/alpr-cameras
 * Returns GeoJSON FeatureCollection of OpenStreetMap ALPR surveillance camera locations.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const geojson = await alprService.getAlprCamerasGeoJSON();
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
