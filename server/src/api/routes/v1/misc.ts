export {};
/**
 * Miscellaneous Routes (v1)
 * Small utility endpoints that don't warrant their own module.
 */

const express = require('express');
const path = require('path');
const { pool } = require('../../../config/database');
const logger = require('../../../logging/logger');
const secretsManager = require('../../../services/secretsManager');
const { importWigleDirectory } = require('../../../services/wigleImportService');

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
    const { DATA_QUALITY_FILTERS } = require('../../../services/dataQualityFilters');

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

    const qualityQuery = `
      SELECT COUNT(*) as total_observations,
             COUNT(DISTINCT bssid) as unique_networks,
             MIN(time) as earliest_time,
             MAX(time) as latest_time
      FROM observations 
      WHERE 1=1 ${whereClause}
    `;

    const result = await pool.query(qualityQuery);
    res.json({
      filter_applied: filter,
      ...result.rows[0],
    });
  } catch (error) {
    logger.error(`Data quality error: ${error.message}`, { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
