const express = require('express');
const router = express.Router();

module.exports = (query) => {
  // Get all location markers
  router.get('/location-markers', async (req, res, next) => {
    try {
      const result = await query(`
        SELECT 
          id,
          marker_type,
          latitude,
          longitude,
          created_at
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

  // Get home location
  router.get('/location-markers/home', async (req, res, next) => {
    try {
      const result = await query(`
        SELECT 
          id,
          marker_type,
          latitude,
          longitude,
          created_at
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        return res.json({
          ok: true,
          marker: null,
        });
      }

      res.json({
        ok: true,
        marker: result.rows[0],
      });
    } catch (err) {
      next(err);
    }
  });

  // Set home location (replaces existing)
  router.post('/location-markers/home', async (req, res, next) => {
    try {
      const { latitude, longitude, altitude_gps, altitude_baro, device_id, device_type } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          ok: false,
          error: 'Latitude and longitude are required',
        });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const altGps = altitude_gps ? parseFloat(altitude_gps) : null;
      const altBaro = altitude_baro ? parseFloat(altitude_baro) : null;
      const devId = device_id || 'unknown';
      const devType = device_type || 'browser';

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

      // Delete existing home marker for THIS device only
      await query("DELETE FROM app.location_markers WHERE name = 'home' AND device_id = $1", [
        devId,
      ]);

      // Insert new home marker
      const result = await query(
        `
        INSERT INTO app.location_markers (name, marker_type, latitude, longitude, altitude_gps, altitude_baro, device_id, device_type, location)
        VALUES ('home', 'home', $1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($2, $1), 4326))
        RETURNING 
          id,
          name as marker_type,
          latitude,
          longitude,
          altitude_gps,
          altitude_baro,
          device_id,
          device_type,
          created_at
      `,
        [lat, lng, altGps, altBaro, devId, devType]
      );

      res.json({
        ok: true,
        marker: result.rows[0],
      });
    } catch (err) {
      next(err);
    }
  });

  // Delete home location
  router.delete('/location-markers/home', async (req, res, next) => {
    try {
      await query("DELETE FROM app.location_markers WHERE name = 'home'");
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // TEST endpoint
  router.get('/test-location', async (req, res) => {
    res.json({ message: 'Location routes working!' });
  });

  // GET /api/home-location - Get current home location (for admin page)
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

  // POST /api/admin/home-location - Set home location and radius (for admin page)
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

  return router;
};
