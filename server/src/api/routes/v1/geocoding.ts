import { Router, Request, Response } from 'express';
const { secretsManager } = require('../../../config/container');
const logger = require('../../../logging/logger');

const router = Router();

/**
 * POST /api/geocode
 * Uses Mapbox Geocoding API to resolve an address.
 */
router.post('/geocode', async (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const mapboxToken = await secretsManager.getSecret('MAPBOX_TOKEN');
    if (!mapboxToken) {
      return res.status(500).json({ error: 'Mapbox token not configured' });
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`;

    const response = await fetch(url);
    const data = (await response.json()) as any;

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;

      res.json({
        lat: lat,
        lng: lng,
        formatted_address: feature.place_name,
        confidence: feature.relevance,
      });
    } else {
      res.status(404).json({ error: 'Address not found' });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Geocoding error: ${msg}`, { error });
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

export default router;
