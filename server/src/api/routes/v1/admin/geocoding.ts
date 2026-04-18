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
  requeueFailedGeocoding,
} = geocodingCacheService;
const {
  parseRunOptions,
  parseDaemonOptions,
  parseTestOptions,
  hasMissingKeyError,
  missingKeyInfo,
} = require('./adminGeocodingHelpers');

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
    const options = parseRunOptions(req.body || {});

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
    if (hasMissingKeyError(err)) {
      return res.status(400).json(missingKeyInfo(err));
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
    const errorMessage = err?.message || 'Failed to read daemon status';
    logger.error('[Geocoding] Failed to read daemon status', { error: errorMessage });
    res.json({
      ok: true,
      daemon: {
        running: false,
        stopRequested: false,
        config: null,
        lastError: errorMessage,
      },
    });
  }
});

router.post('/admin/geocoding/daemon', async (req: any, res: any) => {
  try {
    const options = parseDaemonOptions(req.body || {});
    const started = await startGeocodingDaemon(options);

    res.json({
      ok: true,
      started: started.started,
      daemon: started.status,
    });
  } catch (err: any) {
    if (hasMissingKeyError(err)) {
      return res.status(400).json(missingKeyInfo(err));
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
    const result = await testGeocodingProvider(parseTestOptions(req.body || {}));

    res.json({ ok: true, result });
  } catch (err: any) {
    if (hasMissingKeyError(err)) {
      return res.status(400).json(missingKeyInfo(err));
    }
    logger.error('[Geocoding] Provider test failed', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Provider test failed',
    });
  }
});

router.post('/admin/geocoding/requeue', async (req: any, res: any) => {
  try {
    const precision = Number.parseInt(req.body.precision, 10) || 5;
    const maxAttempts = Number.parseInt(req.body.maxAttempts, 10) || 5;
    const count = await requeueFailedGeocoding(precision, maxAttempts);
    res.json({ ok: true, count, precision, maxAttempts });
  } catch (err: any) {
    logger.error('[Geocoding] Requeue failed', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Requeue failed',
    });
  }
});

module.exports = router;
