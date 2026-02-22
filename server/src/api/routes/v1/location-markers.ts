export {};
const express = require('express');
const router = express.Router();
const { homeLocationService, adminDbService } = require('../../../config/container');
const { adminQuery } = adminDbService;

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
      await adminQuery("DELETE FROM app.location_markers WHERE name = 'home' AND device_id = $1", [
        devId,
      ]);

      // Insert new home marker
      const result = await adminQuery(
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
      await homeLocationService.deleteHomeLocation();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // TEST endpoint
  router.get('/test-location', async (req, res) => {
    res.json({ message: 'Location routes working!' });
  });

  return router;
};
