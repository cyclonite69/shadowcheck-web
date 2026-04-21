const logger = require('../../logging/logger');

import type {
  GeocodeDaemonConfig,
  GeocodeProviderCredentials,
  GeocodeRunOptions,
  GeocodeRunSummary,
} from './types';
import {
  geocodeDaemon,
  getDaemonProviderRunOptions,
  loadPersistedDaemonConfig,
  normalizeDaemonConfig,
  persistDaemonConfig,
} from './daemonState';
import { createRunSnapshot } from './jobState';
import { ensureProviderReady, resolveProviderCredentials } from './providerRuntime';
import { getActivePendingPrecisions } from './cacheStore';

// Precisions the application uses for address lookups that should be kept covered.
// Blocks at these precisions are seeded and resolved as part of the idle sweep even
// when they have no rows in geocoding_cache yet (the seed step creates them).
const APP_LOOKUP_PRECISIONS = [3, 4];

type InternalRunFn = (
  options: GeocodeRunOptions,
  credentials: GeocodeProviderCredentials,
  jobId?: number
) => Promise<GeocodeRunSummary>;

type RequeueFn = (precision: number) => Promise<number>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const finalizeSuccessfulRun = (
  options: GeocodeRunOptions,
  jobId: number,
  startedAt: string,
  result: GeocodeRunSummary
) =>
  createRunSnapshot('completed', options, {
    id: jobId,
    startedAt,
    finishedAt: new Date().toISOString(),
    result,
  });

const finalizeFailedRun = (
  options: GeocodeRunOptions,
  jobId: number | undefined,
  startedAt: string,
  error: string
) =>
  createRunSnapshot('failed', options, {
    id: jobId,
    startedAt,
    finishedAt: new Date().toISOString(),
    error,
  });

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

const runGeocodeDaemonLoop = async (
  runGeocodeCacheUpdate: (options: GeocodeRunOptions) => Promise<GeocodeRunSummary>,
  runInternal?: InternalRunFn,
  requeueFailedFn?: RequeueFn
) => {
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

    const workers = Math.min(4, Math.max(1, Number(config.workers) || 1));
    const useParallel = workers > 1 && typeof runInternal === 'function';

    try {
      if (useParallel) {
        const workerOptions: GeocodeRunOptions[] = [];
        for (let i = 0; i < workers; i++) {
          workerOptions.push(getDaemonProviderRunOptions(config));
        }
        await persistDaemonConfig(config);

        const workerPromises = workerOptions.map(async (opts, i) => {
          if (i > 0) {
            await sleep(100 + Math.floor(Math.random() * 400));
          }
          const creds = await resolveProviderCredentials(opts.provider);
          ensureProviderReady(opts.provider, creds);
          return runInternal!(opts, creds);
        });

        const settled = await Promise.allSettled(workerPromises);
        let totalProcessed = 0;
        for (const s of settled) {
          if (s.status === 'fulfilled') {
            totalProcessed += s.value.processed;
            geocodeDaemon.lastResult = s.value;
          } else {
            logger.warn('[Geocoding] Parallel worker failed', { error: s.reason?.message });
            geocodeDaemon.lastError = s.reason?.message;
          }
        }
        if (totalProcessed > 0) {
          await sleep(config.loopDelayMs);
        } else {
          const requeued = requeueFailedFn ? await requeueFailedFn(config.precision) : 0;
          if (requeued > 0) {
            logger.info('[Geocoding] Daemon auto-re-queued failed records', {
              precision: config.precision,
              requeued,
            });
          }
          await sleep(requeued > 0 ? config.loopDelayMs : config.idleSleepMs);
        }
      } else {
        const runOptions = getDaemonProviderRunOptions(config);
        await persistDaemonConfig(config);
        const result = await runGeocodeCacheUpdate(runOptions);
        geocodeDaemon.lastResult = result;
        geocodeDaemon.lastError = undefined;

        if (result.processed > 0) {
          await sleep(config.loopDelayMs);
        } else {
          const requeued = requeueFailedFn ? await requeueFailedFn(config.precision) : 0;
          if (requeued > 0) {
            logger.info('[Geocoding] Daemon auto-re-queued failed records', {
              precision: config.precision,
              requeued,
            });
          }

          // Sweep all other precisions that have pending work or are used by the app
          // but may have unseeded blocks. This ensures no precision is silently orphaned.
          const pendingPrecisions = await getActivePendingPrecisions(config.precision);
          const supplementalPrecisions = Array.from(
            new Set([
              ...pendingPrecisions,
              ...APP_LOOKUP_PRECISIONS.filter((p) => p !== config.precision),
            ])
          ).sort((a, b) => b - a);

          let supplementalProcessed = 0;
          for (const precision of supplementalPrecisions) {
            if (geocodeDaemon.stopRequested) break;
            try {
              const supplementalOptions = { ...getDaemonProviderRunOptions(config), precision };
              const supplementalResult = await runGeocodeCacheUpdate(supplementalOptions);
              geocodeDaemon.lastResult = supplementalResult;
              supplementalProcessed += supplementalResult.processed;
              if (supplementalResult.processed > 0) {
                logger.info('[Geocoding] Daemon swept supplemental precision', {
                  precision,
                  processed: supplementalResult.processed,
                  successful: supplementalResult.successful,
                });
                await sleep(config.loopDelayMs);
              }
            } catch (sweepErr) {
              logger.warn('[Geocoding] Supplemental precision sweep failed', {
                precision,
                error: (sweepErr as Error)?.message,
              });
            }
          }

          await sleep(
            requeued > 0 || supplementalProcessed > 0 ? config.loopDelayMs : config.idleSleepMs
          );
        }
      }
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

const startGeocodingDaemon = async (
  configInput: Partial<GeocodeDaemonConfig>,
  runGeocodeCacheUpdate: (options: GeocodeRunOptions) => Promise<GeocodeRunSummary>,
  runInternal?: InternalRunFn,
  requeueFailedFn?: RequeueFn
) => {
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

  void runGeocodeDaemonLoop(runGeocodeCacheUpdate, runInternal, requeueFailedFn);
  return { started: true, status: geocodeDaemon };
};

const stopGeocodingDaemon = () => {
  if (!geocodeDaemon.running) {
    return { stopped: false, status: geocodeDaemon };
  }
  geocodeDaemon.stopRequested = true;
  return { stopped: true, status: geocodeDaemon };
};

export {
  finalizeFailedRun,
  finalizeSuccessfulRun,
  getGeocodingDaemonStatus,
  runGeocodeDaemonLoop,
  startGeocodingDaemon,
  stopGeocodingDaemon,
};
