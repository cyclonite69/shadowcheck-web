const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// Middleware to require authentication
const requireAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Export as GeoJSON
router.get('/geojson', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        bssid,
        latitude,
        longitude,
        signal_dbm,
        observed_at,
        source_type,
        radio_type
      FROM app.observations
      ORDER BY observed_at DESC
      LIMIT 10000
    `);

    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [row.longitude, row.latitude],
      },
      properties: {
        bssid: row.bssid,
        signal_dbm: row.signal_dbm,
        observed_at: row.observed_at,
        source_type: row.source_type,
        radio_type: row.radio_type,
      },
    }));

    const geojson = {
      type: 'FeatureCollection',
      features: features,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="shadowcheck_export_${Date.now()}.geojson"`);
    res.json(geojson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export as JSON
router.get('/json', requireAuth, async (req, res) => {
  try {
    const [observations, networks] = await Promise.all([
      query('SELECT * FROM app.observations ORDER BY observed_at DESC LIMIT 10000'),
      query('SELECT * FROM app.networks LIMIT 10000'),
    ]);

    const data = {
      exported_at: new Date().toISOString(),
      observations: observations.rows,
      networks: networks.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="shadowcheck_export_${Date.now()}.json"`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export as CSV
router.get('/csv', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        bssid,
        latitude,
        longitude,
        signal_dbm,
        observed_at,
        source_type,
        radio_type
      FROM app.observations
      ORDER BY observed_at DESC
      LIMIT 10000
    `);

    const headers = ['bssid', 'latitude', 'longitude', 'signal_dbm', 'observed_at', 'source_type', 'radio_type'];
    const csv = [
      headers.join(','),
      ...result.rows.map(row =>
        headers.map(h => {
          const val = row[h];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="shadowcheck_export_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
