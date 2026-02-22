import { Router, Request, Response } from 'express';
const { agencyService } = require('../../../config/container');

const router = Router();

/**
 * GET /agency-offices
 * Returns GeoJSON FeatureCollection of FBI field offices and resident agencies
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const geojson = await agencyService.getAgencyOfficesGeoJSON();
    res.json(geojson);
  } catch (error) {
    console.error('Error fetching agency offices:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch agency offices',
    });
  }
});

/**
 * GET /agency-offices/count
 * Returns count of agency offices by type
 */
router.get('/count', async (req: Request, res: Response) => {
  try {
    const rows = await agencyService.getAgencyOfficeCountByType();
    res.json({
      ok: true,
      data: rows,
      total: rows.reduce((sum, row) => sum + parseInt(row.count), 0),
    });
  } catch (error) {
    console.error('Error counting agency offices:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to count agency offices',
    });
  }
});

export default router;
