const express = require('express');
const logger = require('../../../../logging/logger');
const { geocodingCacheService } = require('../../../../config/container');
const { startGeocodeCacheUpdate, getGeocodingCacheStats, testGeocodingProvider } =
  geocodingCacheService;

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
      perMinute = ['nominatim', 'overpass', 'opencage', 'geocodio', 'locationiq'].includes(provider)
        ? 60
        : 200,
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
    if (err?.message === 'job_already_running') {
      return res.status(409).json({
        ok: false,
        error: 'Geocoding job already running',
      });
    }
    if (typeof err?.message === 'string' && err.message.startsWith('missing_key:')) {
      const provider = err.message.split(':')[1] || 'provider';
      return res.status(400).json({
        ok: false,
        error: `Missing API key for ${provider}`,
      });
    }
    logger.error('[Geocoding] Run failed', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Geocoding run failed',
    });
  }
});

router.post('/admin/geocoding/test', async (req, res) => {
  try {
    const {
      provider = 'locationiq',
      mode = provider === 'overpass' ? 'poi-only' : 'address-only',
      precision = 4,
      permanent = false,
      lat,
      lon,
    } = req.body || {};

    const result = await testGeocodingProvider({
      provider,
      mode,
      precision: Number.parseInt(precision, 10) || 4,
      permanent: Boolean(permanent),
      lat: lat !== undefined ? Number(lat) : undefined,
      lon: lon !== undefined ? Number(lon) : undefined,
    });

    res.json({ ok: true, result });
  } catch (err) {
    if (typeof err?.message === 'string' && err.message.startsWith('missing_key:')) {
      const provider = err.message.split(':')[1] || 'provider';
      return res.status(400).json({
        ok: false,
        error: `Missing API key for ${provider}`,
      });
    }
    logger.error('[Geocoding] Provider test failed', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Provider test failed',
    });
  }
});

module.exports = router;
