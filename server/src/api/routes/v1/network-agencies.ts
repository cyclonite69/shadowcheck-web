const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

/**
 * GET /api/networks/:bssid/nearest-agencies
 * Get nearest agencies to all observation points for a network (local + WiGLE v3)
 */
router.get('/:bssid/nearest-agencies', async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const radius = parseFloat(req.query.radius) || 250; // Default 250km

    const sql = `
      WITH all_observations AS (
        -- Local observations
        SELECT DISTINCT lat, lon, 'local' as source
        FROM app.observations 
        WHERE UPPER(bssid) = UPPER($1) 
          AND lat IS NOT NULL 
          AND lon IS NOT NULL
        UNION
        -- WiGLE v3 observations
        SELECT DISTINCT latitude as lat, longitude as lon, 'wigle' as source
        FROM app.wigle_v3_observations 
        WHERE UPPER(netid) = UPPER($1) 
          AND latitude IS NOT NULL 
          AND longitude IS NOT NULL
      ),
      agency_distances AS (
        SELECT
          a.id,
          a.name as office_name,
          a.office_type,
          a.city,
          a.state,
          a.postal_code,
          ST_Y(a.location::geometry) as latitude,
          ST_X(a.location::geometry) as longitude,
          MIN(ST_Distance(
            ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
            a.location::geography
          ) / 1000.0) as distance_km,
          BOOL_OR(o.source = 'wigle') as has_wigle_obs
        FROM all_observations o
        CROSS JOIN app.agency_offices a
        GROUP BY a.id, a.name, a.office_type, a.city, a.state, a.postal_code, a.location
      )
      SELECT * FROM agency_distances
      WHERE distance_km <= $2
      ORDER BY distance_km ASC
    `;

    const result = await query(sql, [bssid, radius]);

    res.json({
      ok: true,
      bssid,
      agencies: result.rows,
      count: result.rows.length,
      radius_km: radius,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/networks/nearest-agencies/batch
 * Get nearest agencies to all observation points for multiple networks (local + WiGLE v3)
 */
router.post('/nearest-agencies/batch', async (req, res, next) => {
  try {
    const { bssids } = req.body;

    if (!Array.isArray(bssids) || bssids.length === 0) {
      return res.status(400).json({ error: 'bssids array is required' });
    }

    const radius = parseFloat(req.query.radius) || 250; // Default 250km

    // Convert all BSSIDs to uppercase for consistent matching
    const upperBssids = bssids.map((b) => String(b).toUpperCase());

    const sql = `
      WITH all_observations AS (
        -- Local observations for all networks
        SELECT DISTINCT lat, lon, 'local' as source
        FROM app.observations 
        WHERE UPPER(bssid) = ANY($1)
          AND lat IS NOT NULL 
          AND lon IS NOT NULL
        UNION
        -- WiGLE v3 observations for all networks
        SELECT DISTINCT latitude as lat, longitude as lon, 'wigle' as source
        FROM app.wigle_v3_observations 
        WHERE UPPER(netid) = ANY($1)
          AND latitude IS NOT NULL 
          AND longitude IS NOT NULL
      ),
      agency_distances AS (
        SELECT
          a.id,
          a.name as office_name,
          a.office_type,
          a.city,
          a.state,
          a.postal_code,
          ST_Y(a.location::geometry) as latitude,
          ST_X(a.location::geometry) as longitude,
          MIN(ST_Distance(
            ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
            a.location::geography
          ) / 1000.0) as distance_km,
          BOOL_OR(o.source = 'wigle') as has_wigle_obs
        FROM all_observations o
        CROSS JOIN app.agency_offices a
        GROUP BY a.id, a.name, a.office_type, a.city, a.state, a.postal_code, a.location
      )
      SELECT * FROM agency_distances
      WHERE distance_km <= $2
      ORDER BY distance_km ASC
    `;

    const result = await query(sql, [upperBssids, radius]);

    res.json({
      ok: true,
      bssids,
      agencies: result.rows,
      count: result.rows.length,
      radius_km: radius,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
