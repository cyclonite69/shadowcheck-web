const express = require('express');
const router = express.Router();

module.exports = (query) => {
  // Get all location markers
  router.get('/', async (req, res, next) => {
    try {
      const result = await query(`
        SELECT 
          marker_id,
          marker_type,
          ST_X(location::geometry) as longitude,
          ST_Y(location::geometry) as latitude,
          created_at,
          updated_at
        FROM app.location_markers
        ORDER BY created_at DESC
      `);

      res.json({
        ok: true,
        markers: result.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  // Set home location (replaces existing)
  router.post('/home', async (req, res, next) => {
    try {
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          ok: false,
          error: 'Latitude and longitude are required',
        });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid coordinates',
        });
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          ok: false,
          error: 'Coordinates out of range',
        });
      }

      // Delete existing home marker
      await query('DELETE FROM app.location_markers WHERE marker_type = \'home\'');

      // Insert new home marker
      const result = await query(`
        INSERT INTO app.location_markers (marker_type, location)
        VALUES ('home', ST_SetSRID(ST_MakePoint($1, $2), 4326))
        RETURNING 
          marker_id,
          marker_type,
          ST_X(location::geometry) as longitude,
          ST_Y(location::geometry) as latitude,
          created_at
      `, [lng, lat]);

      res.json({
        ok: true,
        marker: result.rows[0],
      });
    } catch (err) {
      next(err);
    }
  });

  // Delete home location
  router.delete('/home', async (req, res, next) => {
    try {
      await query('DELETE FROM app.location_markers WHERE marker_type = \'home\'');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
