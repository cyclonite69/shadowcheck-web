export {};
import type { Request, Response } from 'express';
/**
 * Home Location Routes
 * Handles home location management for admin page
 */

const express = require('express');
const router = express.Router();
const { homeLocationService } = require('../../../config/container');
const { asyncHandler } = require('../../../utils/asyncHandler');
const { requireAdmin } = require('../../../middleware/authMiddleware');

const toResponse = (location: any) => ({
  latitude: location.latitude,
  longitude: location.longitude,
  radius: location.radius,
  isConfigured: true,
  lastUpdated: location.created_at,
});

// GET /api/home-location - Get current home location
router.get(
  '/home-location',
  asyncHandler(async (req: Request, res: Response) => {
    const location = await homeLocationService.getCurrentHomeLocation();

    if (!location) {
      return res.status(404).json({
        error: 'No home location configured',
        message: 'Set a home location via the location markers API',
      });
    }

    res.json(toResponse(location));
  })
);

// GET /api/admin/home-location - Get current home location for admin panel
router.get(
  '/admin/home-location',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const location = await homeLocationService.getCurrentHomeLocation();

    if (!location) {
      return res.status(404).json({
        error: 'No home location configured',
        isConfigured: false,
      });
    }

    res.json(toResponse(location));
  })
);

// POST /api/admin/home-location - Set home location and radius
router.post(
  '/admin/home-location',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const radius = req.body.radius === undefined ? 100 : Number(req.body.radius);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
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
      isConfigured: true,
      lastUpdated: new Date().toISOString(),
      latitude,
      longitude,
      radius,
    });
  })
);

module.exports = router;
