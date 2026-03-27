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
} from './geocoding/jobState';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const GEOCODING_UPSERT_BATCH_SIZE = 100;
let currentRunSnapshot: GeocodingRunSnapshot | null = null;
let lastRunSnapshot: GeocodingRunSnapshot | null = null;

const GEOCODABLE_OBSERVATION_PREDICATE = `
  lat IS NOT NULL
  AND lon IS NOT NULL
  AND lat BETWEEN -90 AND 90
  AND lon BETWEEN -180 AND 180
  AND COALESCE(is_quality_filtered, false) = false
`;

type GeocodeCacheWrite = {
  row: GeocodeRow;
  provider: string;
  result: GeocodeResult;
  mode: GeocodeMode;
};

const shouldSkipPoi = (address?: string | null): boolean => {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return (
    normalized.includes('814 martin luther king') || normalized.includes('816 martin luther king')
  );
};

const upsertGeocodeCacheBatch = async (
  precision: number,
  entries: GeocodeCacheWrite[]
): Promise<void> => {
  if (entries.length === 0) return;

  const values: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const entry of entries) {
    const { row, provider, result, mode } = entry;
    const poiSkip = shouldSkipPoi(result.address);
    const now = new Date().toISOString();
    const poiAttemptedAt = mode === 'poi-only' ? now : null;
    const addressAttemptedAt = mode === 'address-only' ? now : null;
    const poiAttempts = mode === 'poi-only' ? 1 : 0;
    const addressAttempts = mode === 'address-only' ? 1 : 0;

    values.push(
      `($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8},$${idx + 9},$${idx + 10},$${idx + 11},$${idx + 12},$${idx + 13},$${idx + 14},$${idx + 15},$${idx + 16},$${idx + 17},$${idx + 18},$${idx + 19},$${idx + 20})`
    );

    params.push(
      precision,
      row.lat_round,
      row.lon_round,
      row.lat_round,
      row.lon_round,
      result.ok ? result.address || null : null,
      result.ok ? result.poiName || null : null,
      result.ok ? result.poiCategory || null : null,
      result.ok ? result.featureType || null : null,
      poiSkip,
      poiAttemptedAt,
      poiAttempts,
      addressAttemptedAt,
      addressAttempts,
      result.city || null,
      result.state || null,
      result.postal || null,
      result.country || null,
      provider,
      result.confidence ?? null,
      result.raw ? JSON.stringify(result.raw) : null
    );

    idx += 21;
  }

  await query(
    `
    INSERT INTO app.geocoding_cache (
      precision,
      lat_round,
      lon_round,
      lat,
      lon,
      address,
      poi_name,
      poi_category,
      feature_type,
      poi_skip,
      poi_attempted_at,
      poi_attempts,
      address_attempted_at,
      address_attempts,
      city,
      state,
      postal_code,
      country,
      provider,
      confidence,
      raw_response
    )
    VALUES ${values.join(', ')}
    ON CONFLICT (precision, lat_round, lon_round) DO UPDATE SET
      address = COALESCE(app.geocoding_cache.address, EXCLUDED.address),
      poi_name = COALESCE(app.geocoding_cache.poi_name, EXCLUDED.poi_name),
      poi_category = COALESCE(app.geocoding_cache.poi_category, EXCLUDED.poi_category),
      feature_type = COALESCE(app.geocoding_cache.feature_type, EXCLUDED.feature_type),
      poi_skip = app.geocoding_cache.poi_skip OR EXCLUDED.poi_skip,
      poi_attempted_at = COALESCE(EXCLUDED.poi_attempted_at, app.geocoding_cache.poi_attempted_at),
      poi_attempts = app.geocoding_cache.poi_attempts + EXCLUDED.poi_attempts,
      address_attempted_at = COALESCE(
        EXCLUDED.address_attempted_at,
        app.geocoding_cache.address_attempted_at
      ),
      address_attempts = app.geocoding_cache.address_attempts + EXCLUDED.address_attempts,
      city = COALESCE(app.geocoding_cache.city, EXCLUDED.city),
      state = COALESCE(app.geocoding_cache.state, EXCLUDED.state),
      postal_code = COALESCE(app.geocoding_cache.postal_code, EXCLUDED.postal_code),
      country = COALESCE(app.geocoding_cache.country, EXCLUDED.country),
      provider = COALESCE(EXCLUDED.provider, app.geocoding_cache.provider),
      confidence = COALESCE(EXCLUDED.confidence, app.geocoding_cache.confidence),
      lat = COALESCE(app.geocoding_cache.lat, EXCLUDED.lat),
      lon = COALESCE(app.geocoding_cache.lon, EXCLUDED.lon),
      geocoded_at = NOW(),
      raw_response = COALESCE(EXCLUDED.raw_response, app.geocoding_cache.raw_response)
  `,
    params
  );
};

const seedAddressCandidates = async (precision: number, targetCount: number): Promise<number> => {
  const result = await query(
    `
    WITH pending AS (
      SELECT COUNT(*)::int AS pending_count
      FROM app.geocoding_cache c
      WHERE c.precision = $1
        AND c.address IS NULL
        AND c.address_attempts = 0
    ),
    rounded AS (
      SELECT
        round(lat::numeric, $1) AS lat_round,
        round(lon::numeric, $1) AS lon_round,
        COUNT(*) AS obs_count
      FROM app.observations
      WHERE ${GEOCODABLE_OBSERVATION_PREDICATE}
      GROUP BY 1, 2
    ),
    candidates AS (
      SELECT r.lat_round, r.lon_round
      FROM rounded r
      LEFT JOIN app.geocoding_cache c
        ON c.precision = $1
       AND c.lat_round = r.lat_round
       AND c.lon_round = r.lon_round
      WHERE c.id IS NULL
      ORDER BY r.obs_count DESC
      LIMIT (
        SELECT GREATEST($2 - pending.pending_count, 0)
        FROM pending
      )
    ),
    inserted AS (
      INSERT INTO app.geocoding_cache (
        precision,
        lat_round,
        lon_round,
        lat,
        lon
      )
      SELECT
        $1,
        candidates.lat_round,
        candidates.lon_round,
        candidates.lat_round,
        candidates.lon_round
      FROM candidates
      ON CONFLICT (precision, lat_round, lon_round) DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*)::int AS inserted_count FROM inserted
  `,
    [precision, targetCount]
  );

  return Number(result.rows[0]?.inserted_count || 0);
};

const fetchRows = async (
  precision: number,
  limit: number,
  mode: GeocodeMode,
  provider: GeocodeProvider
): Promise<GeocodeRow[]> => {
  if (mode === 'poi-only') {
    const result = await query(
      `
      SELECT
        c.lat_round::double precision AS lat_round,
        c.lon_round::double precision AS lon_round,
        c.address
      FROM app.geocoding_cache c
      WHERE c.precision = $2
        AND c.poi_name IS NULL
        AND c.address IS NOT NULL
        AND c.poi_skip IS FALSE
        AND c.poi_attempts = 0
      ORDER BY c.geocoded_at DESC
      LIMIT $1;
    `,
      [limit, precision]
    );
    return result.rows as GeocodeRow[];
  }

  if (provider !== 'mapbox') {
    const result = await query(
      `
      SELECT
        c.lat_round::double precision AS lat_round,
        c.lon_round::double precision AS lon_round,
        c.address
      FROM app.geocoding_cache c
      WHERE c.precision = $2
        AND c.address IS NULL
      ORDER BY c.address_attempts ASC, c.geocoded_at ASC, c.id ASC
      LIMIT $1;
    `,
      [limit, precision]
    );
    return result.rows as GeocodeRow[];
  }

  const result = await query(
    `
    SELECT
      c.lat_round::double precision AS lat_round,
      c.lon_round::double precision AS lon_round,
      c.address
    FROM app.geocoding_cache c
    WHERE c.precision = $2
      AND c.address IS NULL
      AND c.address_attempts < 3
    ORDER BY c.address_attempts ASC, c.geocoded_at ASC, c.id ASC
    LIMIT $1;
  `,
    [limit, precision]
  );
  return result.rows as GeocodeRow[];
};

const runGeocodeCacheUpdateInternal = async (
  options: GeocodeRunOptions,
  credentials: GeocodeProviderCredentials
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

  const flushPendingWrites = async () => {
    if (pendingWrites.length === 0) return;
    const batch = pendingWrites.splice(0, pendingWrites.length);
    await upsertGeocodeCacheBatch(precision, batch);
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
        await sleep(backoffMs);
      } else if (error.message === 'missing_key') {
        logger.warn('[Geocoding] Missing API key for provider');
        await flushPendingWrites();
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
    const result = await runGeocodeCacheUpdateInternal(options, credentials);
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

  void runGeocodeCacheUpdateInternal(options, credentials)
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
  const persisted = await loadPersistedDaemonConfig();
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
    const persisted = await loadPersistedDaemonConfig();
    if (persisted) {
      geocodeDaemon.config = normalizeDaemonConfig(persisted);
    }
  }
  return geocodeDaemon;
};

const getGeocodingCacheStats = async (precision: number) => {
  const result = await query(
    `
    WITH rounded AS (
      SELECT
        round(lat::numeric, $1) AS lat_round,
        round(lon::numeric, $1) AS lon_round
      FROM app.observations
      WHERE ${GEOCODABLE_OBSERVATION_PREDICATE}
      GROUP BY 1, 2
    ),
    cache AS (
      SELECT * FROM app.geocoding_cache WHERE precision = $1
    )
    SELECT
      (
        SELECT count(*)
        FROM app.observations
        WHERE ${GEOCODABLE_OBSERVATION_PREDICATE}
      ) AS observation_count,
      (SELECT count(*) FROM rounded) AS unique_blocks,
      (SELECT count(*) FROM cache) AS cached_blocks,
      (SELECT count(*) FROM cache WHERE address IS NOT NULL) AS resolved_address_rows,
      (SELECT count(*) FROM cache WHERE address IS NOT NULL) AS cached_with_address,
      (SELECT count(*) FROM cache WHERE poi_name IS NOT NULL) AS cached_with_poi,
      (SELECT count(DISTINCT address) FROM cache WHERE address IS NOT NULL) AS distinct_addresses,
      (
        SELECT count(*)
        FROM cache
        WHERE address IS NULL
          AND address_attempts = 0
      ) AS pending_address_queue,
      (
        SELECT count(*)
        FROM cache
        WHERE address IS NULL
          AND address_attempts > 0
      ) AS attempted_without_address,
      (
        SELECT count(*)
        FROM cache
        WHERE geocoded_at > NOW() - INTERVAL '10 minutes'
      ) AS recent_activity,
      (SELECT max(geocoded_at) FROM cache) AS last_activity_at,
      (
        SELECT count(*)
        FROM rounded r
        LEFT JOIN cache c
          ON c.lat_round = r.lat_round
         AND c.lon_round = r.lon_round
        WHERE c.id IS NULL
      ) AS missing_blocks;
  `,
    [precision]
  );

  const providerRows = await query(
    `
    SELECT provider, count(*)::int AS count
    FROM app.geocoding_cache
    WHERE precision = $1
    GROUP BY provider
    ORDER BY count DESC;
  `,
    [precision]
  );

  const providers: Record<string, number> = {};
  for (const row of providerRows.rows) {
    providers[row.provider] = row.count;
  }

  const recent_runs = await loadRecentJobHistory();

  return {
    precision,
    ...result.rows[0],
    providers,
    current_run: currentRunSnapshot,
    last_run: lastRunSnapshot,
    daemon: await getGeocodingDaemonStatus(),
    recent_runs,
  };
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
