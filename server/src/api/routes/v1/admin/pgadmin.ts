const express = require('express');
const router = express.Router();
const logger = require('../../../../logging/logger');
const { pgadminService } = require('../../../../config/container');
const { isDockerControlEnabled, getPgAdminStatus, startPgAdmin, stopPgAdmin } = pgadminService;

export {};

router.get('/admin/pgadmin/status', async (req, res) => {
  try {
    const status = await getPgAdminStatus();
    res.json({
      ok: true,
      enabled: isDockerControlEnabled(),
      ...status,
    });
  } catch (err) {
    logger.error('[PgAdmin] Failed to get status', { error: err?.message });
    res.status(500).json({
      ok: false,
      enabled: isDockerControlEnabled(),
      error: err?.message || 'Failed to get PgAdmin status',
    });
  }
});

router.post('/admin/pgadmin/start', async (req, res) => {
  if (!isDockerControlEnabled()) {
    return res.status(403).json({
      ok: false,
      error: 'Docker controls disabled. Set ADMIN_ALLOW_DOCKER=true to enable.',
    });
  }

  const reset = Boolean(req.body?.reset);

  try {
    const result = await startPgAdmin({ reset });
    res.json({
      ok: true,
      reset,
      message: reset ? 'PgAdmin reset and started' : 'PgAdmin started',
      ...result,
    });
  } catch (err) {
    logger.error('[PgAdmin] Failed to start', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to start PgAdmin',
    });
  }
});

router.post('/admin/pgadmin/stop', async (req, res) => {
  if (!isDockerControlEnabled()) {
    return res.status(403).json({
      ok: false,
      error: 'Docker controls disabled. Set ADMIN_ALLOW_DOCKER=true to enable.',
    });
  }

  try {
    const result = await stopPgAdmin();
    res.json({
      ok: true,
      message: 'PgAdmin stopped',
      ...result,
    });
  } catch (err) {
    logger.error('[PgAdmin] Failed to stop', { error: err?.message });
    res.status(500).json({
      ok: false,
      error: err?.message || 'Failed to stop PgAdmin',
    });
  }
});

module.exports = router;
