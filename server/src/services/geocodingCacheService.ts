const logger = require('../logging/logger');
const { query } = require('../config/database');

export {};

import type {
  GeocodeDaemonConfig,
  GeocodeMode,
  GeocodeProvider,
  GeocodeProviderCredentials,
  GeocodingProviderProbe,
  GeocodingRunSnapshot,
  GeocodeRunOptions,
  GeocodeRunSummary,
  GeocodeResult,
  GeocodeRow,
} from './geocoding/types';
import {
  calculateRateLimitBackoffMs,
  ensureProviderReady,
  executeProviderLookup,
  getProviderLabel,
  resolveProviderCredentials,
} from './geocoding/providerRuntime';
import {
  fetchRows,
  loadCacheStats,
  seedAddressCandidates,
  upsertGeocodeCacheBatch,
  type GeocodeCacheWrite,
} from './geocoding/cacheStore';
import {
  geocodeDaemon,
  getDaemonProviderRunOptions,
  loadPersistedDaemonConfig,
  normalizeDaemonConfig,
  persistDaemonConfig,
} from './geocoding/daemonState';
import {
  acquireGeocodingRunLock,
  completeJobRun,
  createJobRun,
  createRunSnapshot,
  failJobRun,
  getProbeCoordinates,
  loadRecentJobHistory,
  releaseGeocodingRunLock,
  updateJobRunProgress,
} from './geocoding/jobState';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const GEOCODING_UPSERT_BATCH_SIZE = 100;
let currentRunSnapshot: GeocodingRunSnapshot | null = null;
let lastRunSnapshot: GeocodingRunSnapshot | null = null;

const runGeocodeCacheUpdateInternal = async (
  options: GeocodeRunOptions,
  credentials: GeocodeProviderCredentials,
  jobId?: number
): Promise<GeocodeRunSummary> => {
  const precision = options.precision ?? 5;
  const limit = Math.max(1, options.limit ?? 1000);
  const perMinute = Math.max(1, options.perMinute ?? 200);
  const delayMs = Math.max(1, Math.floor(60000 / perMinute));
  if (options.mode !== 'poi-only') {
    const seeded = await seedAddressCandidates(precision, limit * 2);
    if (seeded > 0) {
      logger.info('[Geocoding] Seeded pending address candidates', {
        precision,
        seeded,
        provider: options.provider,
      });
    }
  }
  const rows = await fetchRows(precision, limit, options.mode, options.provider);
  const providerLabel = getProviderLabel(options.provider, Boolean(options.permanent));

  const startedAt = Date.now();
  let processed = 0;
  let successful = 0;
  let poiHits = 0;
  let rateLimited = 0;
  let consecutiveRateLimits = 0;
  const pendingWrites: GeocodeCacheWrite[] = [];

  const syncProgress = async () => {
    if (!jobId) return;
    const durationMs = Date.now() - startedAt;
    const result = {
      processed,
      successful,
      poiHits,
      rateLimited,
    };
    await updateJobRunProgress(jobId, result, durationMs);
    if (currentRunSnapshot?.id === jobId) {
      currentRunSnapshot = {
        ...currentRunSnapshot,
        result: {
          precision,
          mode: options.mode,
          provider: providerLabel,
          processed,
          successful,
          poiHits,
          rateLimited,
          durationMs,
        },
      };
    }
  };

  const flushPendingWrites = async () => {
    if (pendingWrites.length === 0) return;
    const batch = pendingWrites.splice(0, pendingWrites.length);
    await upsertGeocodeCacheBatch(precision, batch);
    await syncProgress();
  };

  for (const row of rows) {
    try {
      const result: GeocodeResult = await executeProviderLookup(
        options.provider,
        options.mode,
        row.lat_round,
        row.lon_round,
        Boolean(options.permanent),
        credentials
      );

      consecutiveRateLimits = 0;
      if (result.ok) {
        successful++;
        if (result.poiName) {
          poiHits++;
        }
      }
      pendingWrites.push({
        row,
        provider: providerLabel,
        result,
        mode: options.mode,
      });
      if (pendingWrites.length >= GEOCODING_UPSERT_BATCH_SIZE) {
        await flushPendingWrites();
      }
    } catch (err) {
      const error = err as Error;
      if (error.message === 'rate_limit') {
        rateLimited++;
        consecutiveRateLimits++;
        const backoffMs = calculateRateLimitBackoffMs(options.provider, consecutiveRateLimits);
        logger.warn('[Geocoding] Rate limited, backing off', {
          provider: options.provider,
          backoffMs,
          consecutiveRateLimits,
        });
        await flushPendingWrites();
        await syncProgress();
        await sleep(backoffMs);
      } else if (error.message === 'missing_key') {
        logger.warn('[Geocoding] Missing API key for provider');
        await flushPendingWrites();
        await syncProgress();
        break;
      } else {
        logger.warn('[Geocoding] Provider error', { error: error.message });
      }
    }

    processed++;
    if (processed < rows.length) {
      await sleep(delayMs);
    }
  }

  await flushPendingWrites();

  const durationMs = Date.now() - startedAt;
  return {
    precision,
    mode: options.mode,
    provider: providerLabel,
    processed,
    successful,
    poiHits,
    rateLimited,
    durationMs,
  };
};

const runGeocodeCacheUpdate = async (options: GeocodeRunOptions) => {
  const acquired = await acquireGeocodingRunLock();
  if (!acquired) {
    throw new Error('job_already_running');
  }

  try {
    const jobId = await createJobRun(options);
    currentRunSnapshot = createRunSnapshot('running', options, { id: jobId });
    const credentials = await resolveProviderCredentials(options.provider);
    ensureProviderReady(options.provider, credentials);
    const result = await runGeocodeCacheUpdateInternal(options, credentials, jobId);
    await completeJobRun(jobId, result);
    lastRunSnapshot = createRunSnapshot('completed', options, {
      id: jobId,
      startedAt: currentRunSnapshot.startedAt,
      finishedAt: new Date().toISOString(),
      result,
    });
    return result;
  } catch (err) {
    if (currentRunSnapshot?.id) {
      await failJobRun(
        currentRunSnapshot.id,
        (err as Error)?.message || 'Unknown geocoding failure'
      );
    }
    lastRunSnapshot = createRunSnapshot('failed', options, {
      id: currentRunSnapshot?.id,
      startedAt: currentRunSnapshot?.startedAt || new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      error: (err as Error)?.message || 'Unknown geocoding failure',
    });
    throw err;
  } finally {
    currentRunSnapshot = null;
    await releaseGeocodingRunLock();
  }
};

const startGeocodeCacheUpdate = async (options: GeocodeRunOptions) => {
  const acquired = await acquireGeocodingRunLock();
  if (!acquired) {
    return { started: false };
  }

  let credentials: GeocodeProviderCredentials;
  try {
    credentials = await resolveProviderCredentials(options.provider);
    ensureProviderReady(options.provider, credentials);
  } catch (err) {
    await releaseGeocodingRunLock();
    throw err;
  }

  const jobId = await createJobRun(options);
  currentRunSnapshot = createRunSnapshot('running', options, { id: jobId });

  void runGeocodeCacheUpdateInternal(options, credentials, jobId)
    .then((result) => {
      return completeJobRun(jobId, result).then(() => result);
    })
    .then((result) => {
      lastRunSnapshot = createRunSnapshot('completed', options, {
        id: jobId,
        startedAt: currentRunSnapshot?.startedAt || new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        result,
      });
      logger.info('[Geocoding] Background job completed', {
        processed: result.processed,
        successful: result.successful,
      });
    })
    .catch((err) => {
      void failJobRun(jobId, err?.message || 'Unknown geocoding failure');
      lastRunSnapshot = createRunSnapshot('failed', options, {
        id: jobId,
        startedAt: currentRunSnapshot?.startedAt || new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        error: err?.message || 'Unknown geocoding failure',
      });
      logger.error('[Geocoding] Background job failed', { error: err?.message });
    })
    .finally(async () => {
      currentRunSnapshot = null;
      try {
        await releaseGeocodingRunLock();
      } catch (err) {
        logger.error('[Geocoding] Failed to release advisory lock', {
          error: (err as Error)?.message,
        });
      }
    });

  return { started: true };
};

const runGeocodeDaemonLoop = async () => {
  if (!geocodeDaemon.config) return;

  geocodeDaemon.running = true;
  geocodeDaemon.stopRequested = false;
  geocodeDaemon.startedAt = new Date().toISOString();
  geocodeDaemon.lastError = undefined;

  logger.info('[Geocoding] Continuous daemon started', { config: geocodeDaemon.config });

  while (!geocodeDaemon.stopRequested) {
    const config = geocodeDaemon.config;
    if (!config) break;
    geocodeDaemon.lastTickAt = new Date().toISOString();

    try {
      const runOptions = getDaemonProviderRunOptions(config);
      await persistDaemonConfig(config);
      const result = await runGeocodeCacheUpdate(runOptions);
      geocodeDaemon.lastResult = result;
      geocodeDaemon.lastError = undefined;

      const sleepMs = result.processed > 0 ? config.loopDelayMs : config.idleSleepMs;
      await sleep(sleepMs);
    } catch (err) {
      const error = err as Error;
      geocodeDaemon.lastError = error.message;
      logger.warn('[Geocoding] Continuous daemon tick failed', { error: error.message });
      await sleep(config.errorSleepMs);
    }
  }

  geocodeDaemon.running = false;
  geocodeDaemon.stopRequested = false;
  logger.info('[Geocoding] Continuous daemon stopped');
};

const startGeocodingDaemon = async (configInput: Partial<GeocodeDaemonConfig>) => {
  let persisted: GeocodeDaemonConfig | null = null;
  try {
    persisted = await loadPersistedDaemonConfig();
  } catch (err) {
    logger.warn('[Geocoding] Failed to load persisted daemon config before start', {
      error: (err as Error)?.message,
    });
  }
  const config =
    configInput && Object.keys(configInput).length > 0
      ? normalizeDaemonConfig(configInput)
      : normalizeDaemonConfig(persisted || {});

  const providerChecks = (config.providers || [])
    .filter((item) => item && item.enabled !== false)
    .map((item) => item.provider);
  const distinctProviders = Array.from(new Set([config.provider, ...providerChecks]));
  for (const provider of distinctProviders) {
    const credentials = await resolveProviderCredentials(provider);
    ensureProviderReady(provider, credentials);
  }

  await persistDaemonConfig(config);
  geocodeDaemon.config = config;

  if (geocodeDaemon.running) {
    return { started: false, status: geocodeDaemon };
  }

  void runGeocodeDaemonLoop();
  return { started: true, status: geocodeDaemon };
};

const stopGeocodingDaemon = () => {
  if (!geocodeDaemon.running) {
    return { stopped: false, status: geocodeDaemon };
  }
  geocodeDaemon.stopRequested = true;
  return { stopped: true, status: geocodeDaemon };
};

const getGeocodingDaemonStatus = async () => {
  if (!geocodeDaemon.config) {
    try {
      const persisted = await loadPersistedDaemonConfig();
      if (persisted) {
        geocodeDaemon.config = normalizeDaemonConfig(persisted);
      }
    } catch (err) {
      geocodeDaemon.lastError = (err as Error)?.message || 'Failed to load geocoding daemon config';
      logger.warn('[Geocoding] Failed to load persisted daemon config for status', {
        error: geocodeDaemon.lastError,
      });
    }
  }
  return geocodeDaemon;
};

const getGeocodingCacheStats = async (precision: number) => {
  const recent_runs = await loadRecentJobHistory();
  return loadCacheStats(
    precision,
    currentRunSnapshot,
    lastRunSnapshot,
    await getGeocodingDaemonStatus(),
    recent_runs
  );
};

const testGeocodingProvider = async (probe: GeocodingProviderProbe) => {
  const precision = probe.precision ?? 4;
  const coords =
    probe.lat !== undefined && probe.lon !== undefined
      ? { lat: probe.lat, lon: probe.lon }
      : await getProbeCoordinates(precision);

  if (!coords) {
    throw new Error('No valid coordinates available to test geocoding provider');
  }

  const credentials = await resolveProviderCredentials(probe.provider);
  ensureProviderReady(probe.provider, credentials);

  const result: GeocodeResult = await executeProviderLookup(
    probe.provider,
    probe.mode,
    coords.lat,
    coords.lon,
    Boolean(probe.permanent),
    credentials
  );

  return {
    sample: coords,
    provider: probe.provider,
    mode: probe.mode,
    permanent: Boolean(probe.permanent),
    result,
  };
};

module.exports = {
  runGeocodeCacheUpdate,
  startGeocodeCacheUpdate,
  startGeocodingDaemon,
  stopGeocodingDaemon,
  getGeocodingDaemonStatus,
  getGeocodingCacheStats,
  testGeocodingProvider,
};
