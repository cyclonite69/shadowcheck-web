const { query } = require('../../config/database');

import type {
  GeocodeMode,
  GeocodeProvider,
  GeocodingRunSnapshot,
  GeocodeResult,
  GeocodeRow,
} from './types';

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

const providerPriority = (provider?: string | null): number => {
  const normalized = String(provider || '')
    .trim()
    .toLowerCase();
  switch (normalized) {
    case 'mapbox_v5_permanent':
      return 5;
    case 'mapbox_v5':
    case 'mapbox':
      return 4;
    case 'locationiq':
      return 3;
    case 'geocodio':
      return 2;
    case 'opencage':
      return 1;
    default:
      return 0;
  }
};

const shouldReplaceAddressData = (
  current: {
    ok?: boolean;
    address?: string | null;
    confidence?: number | null;
    provider?: string | null;
  },
  incoming: {
    ok?: boolean;
    address?: string | null;
    confidence?: number | null;
    provider?: string | null;
  }
): boolean => {
  if (!incoming?.ok || !incoming.address) return false;
  if (!current?.address) return true;

  const currentConfidence = Number(current.confidence ?? 0);
  const incomingConfidence = Number(incoming.confidence ?? 0);
  if (incomingConfidence >= currentConfidence + 0.1) {
    return true;
  }

  if (Math.abs(incomingConfidence - currentConfidence) <= 0.05) {
    return providerPriority(incoming.provider) > providerPriority(current.provider);
  }

  return false;
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
      -- Address fields: fill if empty, or replace when incoming confidence is meaningfully higher
      address = CASE
        WHEN app.geocoding_cache.address IS NULL THEN EXCLUDED.address
        WHEN EXCLUDED.address IS NOT NULL
         AND COALESCE(EXCLUDED.confidence, 0) > COALESCE(app.geocoding_cache.confidence, 0) + 0.05
         THEN EXCLUDED.address
        ELSE app.geocoding_cache.address
      END,
      city = CASE
        WHEN app.geocoding_cache.city IS NULL THEN EXCLUDED.city
        WHEN EXCLUDED.address IS NOT NULL
         AND COALESCE(EXCLUDED.confidence, 0) > COALESCE(app.geocoding_cache.confidence, 0) + 0.05
         THEN EXCLUDED.city
        ELSE app.geocoding_cache.city
      END,
      state = CASE
        WHEN app.geocoding_cache.state IS NULL THEN EXCLUDED.state
        WHEN EXCLUDED.address IS NOT NULL
         AND COALESCE(EXCLUDED.confidence, 0) > COALESCE(app.geocoding_cache.confidence, 0) + 0.05
         THEN EXCLUDED.state
        ELSE app.geocoding_cache.state
      END,
      postal_code = CASE
        WHEN app.geocoding_cache.postal_code IS NULL THEN EXCLUDED.postal_code
        WHEN EXCLUDED.address IS NOT NULL
         AND COALESCE(EXCLUDED.confidence, 0) > COALESCE(app.geocoding_cache.confidence, 0) + 0.05
         THEN EXCLUDED.postal_code
        ELSE app.geocoding_cache.postal_code
      END,
      country = COALESCE(app.geocoding_cache.country, EXCLUDED.country),
      -- Provider and confidence track whichever result we stored the address from
      provider = CASE
        WHEN app.geocoding_cache.address IS NULL AND EXCLUDED.address IS NOT NULL
         THEN EXCLUDED.provider
        WHEN EXCLUDED.address IS NOT NULL
         AND COALESCE(EXCLUDED.confidence, 0) > COALESCE(app.geocoding_cache.confidence, 0) + 0.05
         THEN EXCLUDED.provider
        ELSE COALESCE(app.geocoding_cache.provider, EXCLUDED.provider)
      END,
      confidence = CASE
        WHEN app.geocoding_cache.address IS NULL AND EXCLUDED.address IS NOT NULL
         THEN EXCLUDED.confidence
        WHEN EXCLUDED.address IS NOT NULL
         AND COALESCE(EXCLUDED.confidence, 0) > COALESCE(app.geocoding_cache.confidence, 0) + 0.05
         THEN EXCLUDED.confidence
        ELSE COALESCE(app.geocoding_cache.confidence, EXCLUDED.confidence)
      END,
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

const loadCacheStats = async (
  precision: number,
  currentRun: GeocodingRunSnapshot | null,
  lastRun: GeocodingRunSnapshot | null,
  daemon: unknown,
  recentRuns: unknown
) => {
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

  return {
    precision,
    ...result.rows[0],
    providers,
    current_run: currentRun,
    last_run: lastRun,
    daemon,
    recent_runs: recentRuns,
  };
};

export {
  fetchRows,
  GEOCODABLE_OBSERVATION_PREDICATE,
  loadCacheStats,
  providerPriority,
  seedAddressCandidates,
  shouldReplaceAddressData,
  shouldSkipPoi,
  upsertGeocodeCacheBatch,
};
export type { GeocodeCacheWrite };
