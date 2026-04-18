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
  GeocodingDaemonProviderConfig,
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
import {
  finalizeFailedRun,
  finalizeSuccessfulRun,
  getGeocodingDaemonStatus,
  startGeocodingDaemon,
  stopGeocodingDaemon,
} from './geocoding/daemonRuntime';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const GEOCODING_UPSERT_BATCH_SIZE = 100;
let currentRunSnapshot: GeocodingRunSnapshot | null = null;
let lastRunSnapshot: GeocodingRunSnapshot | null = null;
const GEOCODE_PROVIDERS: Set<GeocodeProvider> = new Set([
  'mapbox',
  'nominatim',
  'overpass',
  'opencage',
  'geocodio',
  'locationiq',
]);

const runGeocodeCacheUpdateInternal = async (
  options: GeocodeRunOptions,
  credentials: GeocodeProviderCredentials,
  jobId?: number
): Promise<GeocodeRunSummary> => {
  const precision = options.precision ?? 5;
  const limit = Math.max(1, options.limit ?? 1000);
  const perMinute = Math.max(1, options.perMinute ?? 200);
  const delayMs = Math.max(1, Math.floor(60000 / perMinute));

  // Determine fallback chain from geocodeDaemon config if available
  const { geocodeDaemon } = require('./geocoding/daemonState');
  const fallbackProviders: GeocodingDaemonProviderConfig[] = (
    geocodeDaemon.config?.providers || []
  ).filter(
    (p: GeocodingDaemonProviderConfig) =>
      p && p.enabled !== false && p.provider !== options.provider
  );

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
    try {
      await upsertGeocodeCacheBatch(precision, batch);
      await syncProgress();
    } catch (err) {
      // Restore the batch so data is not silently dropped on a transient DB error
      pendingWrites.unshift(...batch);
      throw err;
    }
  };

  for (const row of rows) {
    try {
      let result: GeocodeResult = await executeProviderLookup(
        options.provider,
        options.mode,
        row.lat_round,
        row.lon_round,
        Boolean(options.permanent),
        credentials
      );

      // FALLBACK CHAIN: If primary provider failed and we have alternatives, try them
      if (!result.ok && fallbackProviders.length > 0) {
        for (const fallback of fallbackProviders) {
          try {
            const fallbackCreds = await resolveProviderCredentials(fallback.provider);
            ensureProviderReady(fallback.provider, fallbackCreds);

            const fallbackResult = await executeProviderLookup(
              fallback.provider,
              fallback.mode || options.mode,
              row.lat_round,
              row.lon_round,
              fallback.permanent !== undefined
                ? Boolean(fallback.permanent)
                : Boolean(options.permanent),
              fallbackCreds
            );

            if (fallbackResult.ok) {
              logger.info('[Geocoding] Fallback successful', {
                primary: options.provider,
                fallback: fallback.provider,
                lat: row.lat_round,
                lon: row.lon_round,
              });
              result = fallbackResult;
              break;
            }
          } catch (fErr) {
            // Silently continue to next fallback
          }
        }
      }

      consecutiveRateLimits = 0;
      if (result.ok) {
        successful++;
        if (result.poiName) {
          poiHits++;
        }
      }
      const rawProvider =
        result.raw && typeof result.raw === 'object' && 'provider' in result.raw
          ? (result.raw as { provider?: string }).provider
          : undefined;
      const resolvedProvider =
        rawProvider && GEOCODE_PROVIDERS.has(rawProvider as GeocodeProvider)
          ? (rawProvider as GeocodeProvider)
          : options.provider;
      pendingWrites.push({
        row,
        provider: result.ok
          ? getProviderLabel(resolvedProvider as GeocodeProvider, Boolean(options.permanent))
          : providerLabel,
        result,
        mode: options.mode,
      });
      if (pendingWrites.length >= GEOCODING_UPSERT_BATCH_SIZE) {
        await flushPendingWrites();
      }
    } catch (err) {
      const error = err as Error;
      if (error.message === 'rate_limit' || error.message?.includes('rate_limit')) {
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
      } else if (error.message === 'missing_key' || error.message?.includes('missing_key')) {
        logger.warn('[Geocoding] Missing API key for provider');
        await flushPendingWrites();
        await syncProgress();
        break;
      } else {
        logger.warn('[Geocoding] Provider error, recording attempt', { error: error.message });
        // Push a failed result so address_attempts is incremented in the DB,
        // preventing endless silent retries of the same coordinates.
        pendingWrites.push({
          row,
          provider: providerLabel,
          result: { ok: false, error: error.message },
          mode: options.mode,
        });
        if (pendingWrites.length >= GEOCODING_UPSERT_BATCH_SIZE) {
          await flushPendingWrites();
        }
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

const requeueFailedGeocoding = async (
  precision: number,
  maxAttempts: number = 5
): Promise<number> => {
  const result = await query(
    `
    UPDATE app.geocoding_cache
    SET address_attempts = 0,
        geocoded_at = NOW()
    WHERE precision = $1
      AND address IS NULL
      AND address_attempts > 0
      AND address_attempts < $2
  `,
    [precision, maxAttempts]
  );

  const count = Number(result.rowCount || 0);
  if (count > 0) {
    logger.info('[Geocoding] Re-queued failed geocoding records', {
      precision,
      count,
      maxAttempts,
    });
  }
  return count;
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
    lastRunSnapshot = finalizeSuccessfulRun(options, jobId, currentRunSnapshot.startedAt, result);
    return result;
  } catch (err) {
    if (currentRunSnapshot?.id) {
      await failJobRun(
        currentRunSnapshot.id,
        (err as Error)?.message || 'Unknown geocoding failure'
      );
    }
    lastRunSnapshot = finalizeFailedRun(
      options,
      currentRunSnapshot?.id,
      currentRunSnapshot?.startedAt || new Date().toISOString(),
      (err as Error)?.message || 'Unknown geocoding failure'
    );
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
      lastRunSnapshot = finalizeSuccessfulRun(
        options,
        jobId,
        currentRunSnapshot?.startedAt || new Date().toISOString(),
        result
      );
      logger.info('[Geocoding] Background job completed', {
        processed: result.processed,
        successful: result.successful,
      });
    })
    .catch((err) => {
      void failJobRun(jobId, err?.message || 'Unknown geocoding failure');
      lastRunSnapshot = finalizeFailedRun(
        options,
        jobId,
        currentRunSnapshot?.startedAt || new Date().toISOString(),
        err?.message || 'Unknown geocoding failure'
      );
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
  requeueFailedGeocoding,
  startGeocodingDaemon: (configInput: Partial<GeocodeDaemonConfig>) =>
    startGeocodingDaemon(configInput, runGeocodeCacheUpdate),
  stopGeocodingDaemon,
  getGeocodingDaemonStatus,
  getGeocodingCacheStats,
  testGeocodingProvider,
};
