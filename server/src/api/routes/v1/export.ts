export {};
import type { Request, Response } from 'express';
const express = require('express');
const router = express.Router();
const container = require('../../../config/container');
const exportService = container.exportService;
const { requireAuth, requireAdmin } = require('../../../middleware/authMiddleware');
const logger = require('../../../logging/logger');

interface ExportRow {
  bssid: string | null;
  ssid: string | null;
  latitude: number | null;
  longitude: number | null;
  signal_dbm: number | null;
  observed_at: unknown;
  radio_type: string | null;
  frequency: number | null;
  capabilities: string | null;
  accuracy: number | null;
  [key: string]: unknown;
}

// Export as CSV with all available observation fields
router.get('/csv', requireAuth, async (req: Request, res: Response) => {
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
      ...rows.map((row: ExportRow) =>
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
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(`Export failed: ${msg}`, { error, stack });
    res.status(500).json({ error: msg });
  }
});

// Export as JSON with observations and networks
router.get('/json', requireAuth, async (req: Request, res: Response) => {
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
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(`Export failed: ${msg}`, { error, stack });
    res.status(500).json({ error: msg });
  }
});

// Export full app schema as JSON (admin only)
router.get('/json/full', requireAdmin, async (req: Request, res: Response) => {
  try {
    const snapshot = await exportService.getFullDatabaseSnapshot();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shadowcheck_full_app_schema_${Date.now()}.json"`
    );
    res.json(snapshot);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(`Full export failed: ${msg}`, { error, stack });
    res.status(500).json({ error: msg });
  }
});

// Export as GeoJSON
router.get('/geojson', requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await exportService.getObservationsForGeoJSON();

    const features = rows.map((row: ExportRow) => ({
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
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(`Export failed: ${msg}`, { error, stack });
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
