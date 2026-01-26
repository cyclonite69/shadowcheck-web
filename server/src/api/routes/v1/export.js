const express = require('express');
const router = express.Router();
const { query } = require('../../../config/database');

// No authentication required for exports
const requireAuth = (req, res, next) => {
  return next();
};

// Export as CSV with all available observation fields
router.get('/csv', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        bssid,
        ssid,
        lat as latitude,
        lon as longitude,
        level as signal_dbm,
        time as observed_at,
        radio_type,
        radio_frequency as frequency,
        radio_capabilities as capabilities,
        accuracy
      FROM public.observations
      ORDER BY time DESC
    `);

    const headers = [
      'bssid',
      'ssid',
      'latitude',
      'longitude',
      'signal_dbm',
      'observed_at',
      'radio_type',
      'frequency',
      'capabilities',
      'accuracy',
    ];

    const csv = [
      headers.join(','),
      ...result.rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
          })
          .join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowcheck_observations_${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export as JSON with observations and networks
router.get('/json', requireAuth, async (req, res) => {
  try {
    const [observations, networks] = await Promise.all([
      query(`
        SELECT * FROM public.observations
        ORDER BY time DESC
      `),
      query(`
        SELECT * FROM public.networks
        ORDER BY lasttime DESC
      `),
    ]);

    const data = {
      exported_at: new Date().toISOString(),
      total_observations: observations.rows.length,
      total_networks: networks.rows.length,
      observations: observations.rows,
      networks: networks.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowcheck_data_${Date.now()}.json"`
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export as GeoJSON
router.get('/geojson', requireAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        bssid,
        ssid,
        lat as latitude,
        lon as longitude,
        level as signal_dbm,
        time as observed_at,
        radio_type,
        radio_frequency as frequency,
        radio_capabilities as capabilities,
        accuracy
      FROM public.observations
      WHERE lat IS NOT NULL AND lon IS NOT NULL
      ORDER BY time DESC
    `);

    const features = result.rows.map((row) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [row.longitude, row.latitude],
      },
      properties: {
        bssid: row.bssid,
        ssid: row.ssid,
        signal_dbm: row.signal_dbm,
        observed_at: row.observed_at,
        radio_type: row.radio_type,
        frequency: row.frequency,
        capabilities: row.capabilities,
        accuracy: row.accuracy,
      },
    }));

    const geojson = {
      type: 'FeatureCollection',
      features: features,
      metadata: {
        exported_at: new Date().toISOString(),
        total_features: features.length,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowcheck_geospatial_${Date.now()}.geojson"`
    );
    res.json(geojson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
