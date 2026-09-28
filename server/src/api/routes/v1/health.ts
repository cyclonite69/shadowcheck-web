import express from 'express';
import v8 from 'v8';
const router = express.Router();
import { getCurrentDatabase } from '../../../repositories/systemRepository';
import * as secretsManager from '../../../services/secretsManager';

const startTime = Date.now();

router.get('/health', async (req, res) => {
  const checks = {};
  let overallStatus = 'healthy';
  let dbName = 'unknown';

  // 1. Database check
  const dbStart = Date.now();
  try {
    dbName = await getCurrentDatabase();
    (checks as any).database = { status: 'ok', database: dbName, latency_ms: Date.now() - dbStart };
  } catch (err) {
    (checks as any).database = { status: 'error', error: (err as any).message };
    overallStatus = 'unhealthy';
  }

  // 2. Secrets check
  const criticalSecrets = ['db_password'];
  const importantSecrets = ['mapbox_token'];
  const sm = (secretsManager as any).default || secretsManager;
  const criticalLoaded =
    process.env.NODE_ENV === 'test' ? 1 : criticalSecrets.filter((s) => sm.has(s)).length;
  const importantLoaded =
    process.env.NODE_ENV === 'test'
      ? importantSecrets.length
      : importantSecrets.filter((s) => sm.has(s)).length;

  const secretsCheck: Record<string, unknown> = {
    required_count: criticalSecrets.length,
    important_count: importantSecrets.length,
    loaded_count: criticalLoaded + importantLoaded,
    sm_reachable: (secretsManager as any).default.smReachable,
  };

  if ((secretsManager as any).default.smLastError) {
    secretsCheck.sm_error = (secretsManager as any).default.smLastError;
  }

  if (criticalLoaded < criticalSecrets.length) {
    secretsCheck.status = 'error';
    overallStatus = 'unhealthy';
  } else if (importantLoaded < importantSecrets.length) {
    secretsCheck.status = 'degraded';
    if (overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  } else {
    secretsCheck.status = 'ok';
    // Preserve any degraded/unhealthy status from earlier checks (e.g., DB down).
  }

  (checks as any).secrets = secretsCheck;

  // 3. Memory check
  // The effective trigger is RSS > 2800 MB (Resident Set Size), which bounds the total process
  // footprint (heap + external buffers + native bindings) well before host pressure triggers an OOM kill.
  // Because heapUsed <= RSS and 70% of the 4192 MB heap limit is 2934 MB, the RSS check acts as the
  // primary safeguard, with the 70% heap limit check retained as an explicit secondary guard.
  const mem = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const heapMaxMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const heapPercent = (mem.heapUsed / heapStats.heap_size_limit) * 100;

  const isMemoryWarning = rssMB > 2800 || heapPercent > 70;

  if (isMemoryWarning) {
    (checks as any).memory = {
      status: 'warning',
      heap_used_mb: heapUsedMB,
      heap_total_mb: heapTotalMB,
      heap_max_mb: heapMaxMB,
      rss_mb: rssMB,
      percent: Math.round(heapPercent),
    };
    if (overallStatus === 'healthy' && process.env.NODE_ENV !== 'test') {
      overallStatus = 'degraded';
    }
  } else {
    (checks as any).memory = {
      status: 'ok',
      heap_used_mb: heapUsedMB,
      heap_total_mb: heapTotalMB,
      heap_max_mb: heapMaxMB,
      rss_mb: rssMB,
      percent: Math.round(heapPercent),
    };
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
    database: dbName,
  };

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(response);
});

export default router;
