export {};
/**
 * Home Location Routes
 * Handles home location management for admin page
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// GET /api/home-location - Get current home location
router.get('/home-location', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        latitude,
        longitude,
        radius,
        created_at
      FROM app.location_markers
      WHERE marker_type = 'home'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      // Return default home location if none set
      return res.json({
        latitude: 43.02345147,
        longitude: -83.69682688,
        radius: 100,
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/home-location - Set home location and radius
router.post('/admin/home-location', async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 100 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
    }

    if (radius < 10 || radius > 5000) {
      return res.status(400).json({ error: 'Radius must be between 10 and 5000 meters' });
    }

    // Delete existing home location
    await query("DELETE FROM app.location_markers WHERE marker_type = 'home'");

    // Insert new home location with radius
    await query(
      `
      INSERT INTO app.location_markers (marker_type, latitude, longitude, radius, location, created_at)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($3, $2), 4326), NOW())
    `,
      ['home', latitude, longitude, radius]
    );

    res.json({
      ok: true,
      message: 'Home location and radius saved successfully',
      latitude,
      longitude,
      radius,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
