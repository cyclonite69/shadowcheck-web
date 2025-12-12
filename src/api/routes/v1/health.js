const express = require('express');
const router = express.Router();
const { pool } = require('../../../config/database');
const secretsManager = require('../../../services/secretsManager');
const keyringService = require('../../../services/keyringService');

const startTime = Date.now();

router.get('/health', async (req, res) => {
  const checks = {};
  let overallStatus = 'healthy';

  // 1. Database check
  const dbStart = Date.now();
  try {
    await pool.query('SELECT 1');
    checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: 'error', error: err.message };
    overallStatus = 'unhealthy';
  }

  // 2. Secrets check
  const requiredSecrets = ['db_password', 'mapbox_token'];
  const loadedCount = requiredSecrets.filter((s) => secretsManager.has(s)).length;

  if (loadedCount === requiredSecrets.length) {
    checks.secrets = {
      status: 'ok',
      required_count: requiredSecrets.length,
      loaded_count: loadedCount,
    };
  } else {
    checks.secrets = {
      status: 'error',
      required_count: requiredSecrets.length,
      loaded_count: loadedCount,
    };
    overallStatus = 'unhealthy';
  }

  // 3. Keyring check (optional - degraded if fails)
  try {
    await keyringService.getCredential('test_health_check');
    checks.keyring = { status: 'ok' };
  } catch (err) {
    checks.keyring = { status: 'degraded', error: 'Keyring not accessible' };
    if (overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  }

  // 4. Memory check
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapMaxMB = Math.round(mem.heapTotal / 1024 / 1024);
  const heapPercent = (mem.heapUsed / mem.heapTotal) * 100;

  if (heapPercent > 80) {
    checks.memory = {
      status: 'warning',
      heap_used_mb: heapUsedMB,
      heap_max_mb: heapMaxMB,
      percent: Math.round(heapPercent),
    };
    if (overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  } else {
    checks.memory = { status: 'ok', heap_used_mb: heapUsedMB, heap_max_mb: heapMaxMB };
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(response);
});

module.exports = router;
