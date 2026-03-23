import { Router, Request, Response } from 'express';
const { courthouseService } = require('../../../config/container');

const router = Router();

/**
 * GET /federal-courthouses
 * Returns GeoJSON FeatureCollection of federal courthouses
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const geojson = await courthouseService.getFederalCourthousesGeoJSON();
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching federal courthouses:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch federal courthouses',
    });
  }
});

export default router;
