export {};
/**
 * Miscellaneous Routes (v1)
 * Small utility endpoints that don't warrant their own module.
 */

const express = require('express');
const path = require('path');
const {
  miscService,
  secretsManager,
  wigleImportService,
  dataQualityFilters,
} = require('../../../config/container');
const { importWigleDirectory } = wigleImportService;
const { DATA_QUALITY_FILTERS } = dataQualityFilters;
const logger = require('../../../logging/logger');

const router = express.Router();

/**
 * GET /demo/oui-grouping
 * Serves the OUI grouping demo page.
 */
router.get('/demo/oui-grouping', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'oui-grouping-demo.html'));
});

/**
 * POST /api/geocode
 * Uses Mapbox Geocoding API to resolve an address.
 */
router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Use Mapbox Geocoding API
    const mapboxToken = await secretsManager.getSecret('MAPBOX_TOKEN');
    if (!mapboxToken) {
      return res.status(500).json({ error: 'Mapbox token not configured' });
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if ((data as any).features && (data as any).features.length > 0) {
      const feature = (data as any).features[0];
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
    logger.error(`Geocoding error: ${error.message}`, { error });
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

/**
 * POST /api/import/wigle
 * Imports WiGLE files from the local imports directory.
 */
router.post('/import/wigle', async (req, res) => {
  try {
    const importDir = path.join(process.cwd(), 'imports', 'wigle');
    const result = await importWigleDirectory(importDir);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`WiGLE import error: ${error.message}`, { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/data-quality
 * Returns data quality metrics for observations.
 */
router.get('/data-quality', async (req, res) => {
  try {
    const filter = req.query.filter || 'none'; // none, temporal, extreme, duplicate, all

    let whereClause = '';
    if (filter === 'temporal') {
      whereClause = DATA_QUALITY_FILTERS.temporal_clusters;
    } else if (filter === 'extreme') {
      whereClause = DATA_QUALITY_FILTERS.extreme_signals;
    } else if (filter === 'duplicate') {
      whereClause = DATA_QUALITY_FILTERS.duplicate_coords;
    } else if (filter === 'all') {
      whereClause = DATA_QUALITY_FILTERS.all();
    }

    const metrics = await miscService.getDataQualityMetrics(whereClause);
    res.json({
      filter_applied: filter,
      ...metrics,
    });
  } catch (error) {
    logger.error(`Data quality error: ${error.message}`, { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
