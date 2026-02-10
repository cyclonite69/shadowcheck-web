import express from 'express';
const router = express.Router();
import { pool } from '../../../config/database';
import secretsManager from '../../../services/secretsManager';
import keyringService from '../../../services/keyringService';

const startTime = Date.now();

router.get('/health', async (req, res) => {
  const checks = {};
  let overallStatus = 'healthy';

  // 1. Database check
  const dbStart = Date.now();
  try {
    await pool.query('SELECT 1');
    (checks as any).database = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (err) {
    (checks as any).database = { status: 'error', error: (err as any).message };
    overallStatus = 'unhealthy';
  }

  // 2. Secrets check
  // Only db_password is truly required for the API to function.
  // mapbox_token is important but its absence should degrade, not block.
  const criticalSecrets = ['db_password'];
  const importantSecrets = ['mapbox_token'];
  const criticalLoaded = criticalSecrets.filter((s) => secretsManager.has(s)).length;
  const importantLoaded = importantSecrets.filter((s) => secretsManager.has(s)).length;
  const totalRequired = criticalSecrets.length + importantSecrets.length;
  const totalLoaded = criticalLoaded + importantLoaded;

  if (criticalLoaded < criticalSecrets.length) {
    (checks as any).secrets = {
      status: 'error',
      required_count: totalRequired,
      loaded_count: totalLoaded,
    };
    overallStatus = 'unhealthy';
  } else if (importantLoaded < importantSecrets.length) {
    (checks as any).secrets = {
      status: 'degraded',
      required_count: totalRequired,
      loaded_count: totalLoaded,
    };
    if (overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  } else {
    (checks as any).secrets = {
      status: 'ok',
      required_count: totalRequired,
      loaded_count: totalLoaded,
    };
  }

  // 3. Keyring check (optional - degraded if fails)
  try {
    await keyringService.getCredential('test_health_check');
    (checks as any).keyring = { status: 'ok' };
  } catch {
    (checks as any).keyring = { status: 'degraded', error: 'Keyring not accessible' };
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
    (checks as any).memory = {
      status: 'warning',
      heap_used_mb: heapUsedMB,
      heap_max_mb: heapMaxMB,
      percent: Math.round(heapPercent),
    };
    if (overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  } else {
    (checks as any).memory = { status: 'ok', heap_used_mb: heapUsedMB, heap_max_mb: heapMaxMB };
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

export default router;
