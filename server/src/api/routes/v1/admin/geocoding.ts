const express = require('express');
const logger = require('../../../../logging/logger');
const { geocodingCacheService } = require('../../../../config/container');
const {
  startGeocodeCacheUpdate,
  getGeocodingCacheStats,
  testGeocodingProvider,
  startGeocodingDaemon,
  stopGeocodingDaemon,
  getGeocodingDaemonStatus,
} = geocodingCacheService;

export {};

const router = express.Router();

router.get('/admin/geocoding/stats', async (req: any, res: any) => {
  try {
    const precision = Number.parseInt(req.query.precision, 10) || 5;
    const stats = await getGeocodingCacheStats(precision);
    res.json({ ok: true, stats });
  } catch (err: any) {
    logger.error('[Geocoding] Failed to load stats', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to load geocoding stats',
    });
  }
});

router.post('/admin/geocoding/run', async (req: any, res: any) => {
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
  } catch (err: any) {
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

router.get('/admin/geocoding/daemon', async (req: any, res: any) => {
  try {
    const daemon = await getGeocodingDaemonStatus();
    res.json({ ok: true, daemon });
  } catch (err: any) {
    logger.error('[Geocoding] Failed to read daemon status', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to read daemon status',
    });
  }
});

router.post('/admin/geocoding/daemon', async (req: any, res: any) => {
  try {
    const {
      provider = 'mapbox',
      mode = 'address-only',
      limit = 250,
      precision = 5,
      perMinute = ['nominatim', 'overpass', 'opencage', 'geocodio', 'locationiq'].includes(provider)
        ? 60
        : 200,
      permanent = true,
      loopDelayMs = 15000,
      idleSleepMs = 180000,
      errorSleepMs = 60000,
      providers = [],
    } = req.body || {};

    const started = await startGeocodingDaemon({
      provider,
      mode,
      limit: Number.parseInt(limit, 10) || 250,
      precision: Number.parseInt(precision, 10) || 5,
      perMinute: Number.parseInt(perMinute, 10) || 200,
      permanent: Boolean(permanent),
      loopDelayMs: Number.parseInt(loopDelayMs, 10) || 15000,
      idleSleepMs: Number.parseInt(idleSleepMs, 10) || 180000,
      errorSleepMs: Number.parseInt(errorSleepMs, 10) || 60000,
      providers: Array.isArray(providers) ? providers : [],
    });

    res.json({
      ok: true,
      started: started.started,
      daemon: started.status,
    });
  } catch (err: any) {
    if (typeof err?.message === 'string' && err.message.startsWith('missing_key:')) {
      const provider = err.message.split(':')[1] || 'provider';
      return res.status(400).json({
        ok: false,
        error: `Missing API key for ${provider}`,
      });
    }

    logger.error('[Geocoding] Failed to start daemon', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to start geocoding daemon',
    });
  }
});

router.delete('/admin/geocoding/daemon', async (req: any, res: any) => {
  try {
    const stopped = stopGeocodingDaemon();
    res.json({ ok: true, stopped: stopped.stopped, daemon: stopped.status });
  } catch (err: any) {
    logger.error('[Geocoding] Failed to stop daemon', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to stop geocoding daemon',
    });
  }
});

router.post('/admin/geocoding/test', async (req: any, res: any) => {
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
  } catch (err: any) {
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
