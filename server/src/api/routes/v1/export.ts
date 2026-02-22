export {};
const express = require('express');
const router = express.Router();
const { exportService } = require('../../../config/container');

// No authentication required for exports
const requireAuth = (req, res, next) => {
  return next();
};

// Export as CSV with all available observation fields
router.get('/csv', requireAuth, async (req, res) => {
  try {
    const rows = await exportService.getObservationsForCSV();

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
      ...rows.map((row) =>
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
    const { observations, networks } = await exportService.getObservationsAndNetworksForJSON();

    const data = {
      exported_at: new Date().toISOString(),
      total_observations: observations.length,
      total_networks: networks.length,
      observations,
      networks,
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
    const rows = await exportService.getObservationsForGeoJSON();

    const features = rows.map((row) => ({
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
