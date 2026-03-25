export {};
import type { Request, Response } from 'express';
const express = require('express');
const router = express.Router();
const { homeLocationService } = require('../../../config/container');
const { asyncHandler } = require('../../../utils/asyncHandler');

// Get all location markers
router.get(
  '/location-markers',
  asyncHandler(async (req: Request, res: Response) => {
    const markers = await homeLocationService.getAllLocationMarkers();
    res.json({ ok: true, markers });
  })
);

// Get home location
router.get(
  '/location-markers/home',
  asyncHandler(async (req: Request, res: Response) => {
    const marker = await homeLocationService.getHomeLocationMarker();
    res.json({ ok: true, marker: marker || null });
  })
);

// Set home location (replaces existing for this device)
router.post(
  '/location-markers/home',
  asyncHandler(async (req: Request, res: Response) => {
    const { latitude, longitude, altitude_gps, altitude_baro, device_id, device_type } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ ok: false, error: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const altGps = altitude_gps ? parseFloat(altitude_gps) : null;
    const altBaro = altitude_baro ? parseFloat(altitude_baro) : null;
    const devId = device_id || 'unknown';
    const devType = device_type || 'browser';

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ ok: false, error: 'Invalid coordinates' });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: 'Coordinates out of range' });
    }

    const marker = await homeLocationService.setHomeLocationMarker({
      lat,
      lng,
      altGps,
      altBaro,
      devId,
      devType,
    });

    res.json({ ok: true, marker });
  })
);

// Delete home location
router.delete(
  '/location-markers/home',
  asyncHandler(async (req: Request, res: Response) => {
    await homeLocationService.deleteHomeLocation();
    res.json({ ok: true });
  })
);

// TEST endpoint
router.get('/test-location', async (req: Request, res: Response) => {
  res.json({ message: 'Location routes working!' });
});

module.exports = router;
