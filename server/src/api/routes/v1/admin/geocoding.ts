const express = require('express');
const logger = require('../../../../logging/logger');
const { geocodingCacheService } = require('../../../../config/container');
const { startGeocodeCacheUpdate, getGeocodingCacheStats } = geocodingCacheService;

export {};

const router = express.Router();

router.get('/admin/geocoding/stats', async (req, res) => {
  try {
    const precision = Number.parseInt(req.query.precision, 10) || 5;
    const stats = await getGeocodingCacheStats(precision);
    res.json({ ok: true, stats });
  } catch (err) {
    logger.error('[Geocoding] Failed to load stats', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to load geocoding stats',
    });
  }
});

router.post('/admin/geocoding/run', async (req, res) => {
  try {
    const {
      provider = 'mapbox',
      mode = 'address-only',
      limit = 1000,
      precision = 5,
      perMinute = ['nominatim', 'overpass', 'opencage', 'locationiq'].includes(provider) ? 60 : 200,
      permanent = true,
    } = req.body || {};

    const options = {
      provider,
      mode,
      limit: Number.parseInt(limit, 10) || 1000,
      precision: Number.parseInt(precision, 10) || 5,
      perMinute: Number.parseInt(perMinute, 10) || 200,
      permanent: Boolean(permanent),
    };

    const started = await startGeocodeCacheUpdate(options);
    if (!started.started) {
      return res.status(409).json({
        ok: false,
        error: 'Geocoding job already running',
      });
    }

    res.json({
      ok: true,
      message: 'Geocoding job started in background',
      options,
    });
  } catch (err) {
    logger.error('[Geocoding] Run failed', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Geocoding run failed',
    });
  }
});

module.exports = router;
