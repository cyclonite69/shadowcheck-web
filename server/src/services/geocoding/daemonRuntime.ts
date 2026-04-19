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

type InternalRunFn = (
  options: GeocodeRunOptions,
  credentials: GeocodeProviderCredentials,
  jobId?: number
) => Promise<GeocodeRunSummary>;

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
  runInternal?: InternalRunFn
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
        const sleepMs = totalProcessed > 0 ? config.loopDelayMs : config.idleSleepMs;
        await sleep(sleepMs);
      } else {
        const runOptions = getDaemonProviderRunOptions(config);
        await persistDaemonConfig(config);
        const result = await runGeocodeCacheUpdate(runOptions);
        geocodeDaemon.lastResult = result;
        geocodeDaemon.lastError = undefined;

        const sleepMs = result.processed > 0 ? config.loopDelayMs : config.idleSleepMs;
        await sleep(sleepMs);
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
  runInternal?: InternalRunFn
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

  void runGeocodeDaemonLoop(runGeocodeCacheUpdate, runInternal);
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
