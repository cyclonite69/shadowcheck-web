import { Router, Request, Response } from 'express';
const pool = require('../../../config/database');

const router = Router();

/**
 * GET /agency-offices
 * Returns GeoJSON FeatureCollection of FBI field offices and resident agencies
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        jsonb_build_object(
          'type', 'FeatureCollection',
          'features', jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'id', id,
              'geometry', ST_AsGeoJSON(location)::jsonb,
              'properties', jsonb_build_object(
                'id', id,
                'name', name,
                'office_type', office_type,
                'address_line1', address_line1,
                'address_line2', address_line2,
                'city', city,
                'state', state,
                'postal_code', postal_code,
                'phone', phone,
                'website', website,
                'parent_office', parent_office
              )
            )
          )
        ) as geojson
      FROM app.agency_offices
      WHERE location IS NOT NULL;
    `;

    const result = await pool.query(query);
    const geojson = result.rows[0]?.geojson || {
      type: 'FeatureCollection',
      features: [],
    };

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
    const query = `
      SELECT 
        office_type,
        COUNT(*) as count
      FROM app.agency_offices
      GROUP BY office_type
      ORDER BY office_type;
    `;

    const result = await pool.query(query);
    res.json({
      ok: true,
      data: result.rows,
      total: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
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
