export {};
/**
 * Home Location Routes
 * Handles home location management for admin page
 */

const express = require('express');
const router = express.Router();
const { homeLocationService } = require('../../../config/container');

// GET /api/home-location - Get current home location
router.get('/home-location', async (req, res, next) => {
  try {
    const location = await homeLocationService.getCurrentHomeLocation();

    if (!location) {
      return res.status(404).json({
        error: 'No home location configured',
        message: 'Set a home location via the location markers API',
      });
    }

    res.json(location);
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

    await homeLocationService.setHomeLocation(latitude, longitude, radius);

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
