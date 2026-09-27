/**
 * Geocoding Cache Repository
 *
 * Data access layer for app.geocoding_cache and related observation candidate seeding.
 * Follows the Lane 2 repository pattern with explicit queryExecutor parameters.
 */

import type { GeocodeRow } from '../services/geocoding/types';
import { GEOCODABLE_OBSERVATION_PREDICATE } from '../services/geocoding/cacheUtils';

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any>;

/**
 * Upserts a successful address geocode result into app.geocoding_cache.
 */
export async function upsertAddressSuccess(
  queryExecutor: QueryExecutor,
  precision: number,
  row: any,
  provider: string,
  result: any
): Promise<void> {
  const baseValues = [precision, row.lat_round, row.lon_round, provider, result.raw ?? null];
  await queryExecutor(
    `
            INSERT INTO app.geocoding_cache (
              precision,
              lat_round,
              lon_round,
              lat,
              lon,
              provider,
              raw_response,
              address_attempted_at,
              address_attempts,
              address,
              city,
              state,
              postal_code,
              country,
              confidence,
              geocoded_at
            )
            VALUES (
              $1, $2, $3, $2, $3, $4, $5, NOW(), 1,
              $6, $7, $8, $9, $10, $11, NOW()
            )
            ON CONFLICT (precision, lat_round, lon_round) DO UPDATE SET
              provider = EXCLUDED.provider,
              raw_response = EXCLUDED.raw_response,
              address_attempted_at = NOW(),
              address_attempts = app.geocoding_cache.address_attempts + 1,
              address = EXCLUDED.address,
              city = EXCLUDED.city,
              state = EXCLUDED.state,
              postal_code = EXCLUDED.postal_code,
              country = EXCLUDED.country,
              confidence = EXCLUDED.confidence,
              geocoded_at = NOW()
          `,
    [
      ...baseValues,
      result.address ?? null,
      result.city ?? null,
      result.state ?? null,
      result.postal ?? null,
      result.country ?? null,
      result.confidence ?? null,
    ]
  );
}

/**
 * Upserts a failed address geocode attempt into app.geocoding_cache.
 */
export async function upsertAddressFailure(
  queryExecutor: QueryExecutor,
  precision: number,
  row: any,
  provider: string,
  result: any
): Promise<void> {
  const baseValues = [precision, row.lat_round, row.lon_round, provider, result.raw ?? null];
  await queryExecutor(
    `
            INSERT INTO app.geocoding_cache (
              precision,
              lat_round,
              lon_round,
              lat,
              lon,
              provider,
              raw_response,
              address_attempted_at,
              address_attempts
            )
            VALUES ($1, $2, $3, $2, $3, $4, $5, NOW(), 1)
            ON CONFLICT (precision, lat_round, lon_round) DO UPDATE SET
              provider = EXCLUDED.provider,
              raw_response = EXCLUDED.raw_response,
              address_attempted_at = NOW(),
              address_attempts = app.geocoding_cache.address_attempts + 1
          `,
    baseValues
  );
}

/**
 * Upserts a successful POI geocode result into app.geocoding_cache.
 */
export async function upsertPoiSuccess(
  queryExecutor: QueryExecutor,
  precision: number,
  row: any,
  provider: string,
  result: any
): Promise<void> {
  const baseValues = [precision, row.lat_round, row.lon_round, provider, result.raw ?? null];
  await queryExecutor(
    `
            INSERT INTO app.geocoding_cache (
              precision,
              lat_round,
              lon_round,
              lat,
              lon,
              provider,
              raw_response,
              poi_attempted_at,
              poi_attempts,
              poi_name,
              poi_category,
              feature_type
            )
            VALUES ($1, $2, $3, $2, $3, $4, $5, NOW(), 1, $6, $7, $8)
            ON CONFLICT (precision, lat_round, lon_round) DO UPDATE SET
              provider = EXCLUDED.provider,
              raw_response = EXCLUDED.raw_response,
              poi_attempted_at = NOW(),
              poi_attempts = app.geocoding_cache.poi_attempts + 1,
              poi_name = EXCLUDED.poi_name,
              poi_category = EXCLUDED.poi_category,
              feature_type = EXCLUDED.feature_type
          `,
    [...baseValues, result.poiName ?? null, result.poiCategory ?? null, result.featureType ?? null]
  );
}

/**
 * Upserts a failed POI geocode attempt into app.geocoding_cache.
 */
export async function upsertPoiFailure(
  queryExecutor: QueryExecutor,
  precision: number,
  row: any,
  provider: string,
  result: any
): Promise<void> {
  const baseValues = [precision, row.lat_round, row.lon_round, provider, result.raw ?? null];
  await queryExecutor(
    `
            INSERT INTO app.geocoding_cache (
              precision,
              lat_round,
              lon_round,
              lat,
              lon,
              provider,
              raw_response,
              poi_attempted_at,
              poi_attempts
            )
            VALUES ($1, $2, $3, $2, $3, $4, $5, NOW(), 1)
            ON CONFLICT (precision, lat_round, lon_round) DO UPDATE SET
              provider = EXCLUDED.provider,
              raw_response = EXCLUDED.raw_response,
              poi_attempted_at = NOW(),
              poi_attempts = app.geocoding_cache.poi_attempts + 1
          `,
    baseValues
  );
}

/**
 * Inserts network representative candidates into app.geocoding_cache for precision 5.
 */
export async function insertNetworkRepresentativeCandidates(
  queryExecutor: QueryExecutor,
  targetCount: number
): Promise<number> {
  const result = await queryExecutor(
    `
      WITH pending AS (
        SELECT COUNT(*)::int AS pending_count
        FROM app.geocoding_cache c
        WHERE c.precision = 5
          AND c.address IS NULL
          AND c.address_attempts = 0
      ),
      rounded AS (
        SELECT
          round(coords.lat::numeric, 5) AS lat_round,
          round(coords.lon::numeric, 5) AS lon_round,
          COUNT(*) AS network_count
        FROM (
          SELECT mv.weighted_lat AS lat, mv.weighted_lon AS lon
          FROM app.api_network_explorer_mv mv
          WHERE mv.weighted_lat IS NOT NULL
            AND mv.weighted_lon IS NOT NULL
          UNION ALL
          SELECT mv.centroid_lat AS lat, mv.centroid_lon AS lon
          FROM app.api_network_explorer_mv mv
          WHERE mv.centroid_lat IS NOT NULL
            AND mv.centroid_lon IS NOT NULL
        ) coords
        GROUP BY 1, 2
      ),
      candidates AS (
        SELECT r.lat_round, r.lon_round
        FROM rounded r
        LEFT JOIN app.geocoding_cache c
          ON c.precision = 5
         AND c.lat_round = r.lat_round
         AND c.lon_round = r.lon_round
        WHERE c.id IS NULL
        ORDER BY r.network_count DESC
        LIMIT (
          SELECT GREATEST($1 - pending.pending_count, 0)
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
          5,
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
    [targetCount]
  );

  return Number(result.rows[0]?.inserted_count || 0);
}

/**
 * Inserts observation-derived geocoding cache candidate blocks.
 */
export async function insertObservationCandidates(
  queryExecutor: QueryExecutor,
  precision: number,
  targetCount: number
): Promise<number> {
  const observationResult = await queryExecutor(
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

  return Number(observationResult.rows[0]?.inserted_count || 0);
}

/**
 * Fetches POI candidates needing lookup.
 */
export async function fetchPoiRows(
  queryExecutor: QueryExecutor,
  precision: number,
  limit: number
): Promise<GeocodeRow[]> {
  const result = await queryExecutor(
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

/**
 * Fetches address candidates for non-Mapbox providers.
 */
export async function fetchNonMapboxAddressRows(
  queryExecutor: QueryExecutor,
  precision: number,
  limit: number
): Promise<GeocodeRow[]> {
  const result = await queryExecutor(
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

/**
 * Fetches address candidates for Mapbox provider (limiting attempts < 3).
 */
export async function fetchMapboxAddressRows(
  queryExecutor: QueryExecutor,
  precision: number,
  limit: number
): Promise<GeocodeRow[]> {
  const result = await queryExecutor(
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
}

/**
 * Resets failed address attempts for a given precision level.
 */
export async function resetFailedAddressAttempts(
  queryExecutor: QueryExecutor,
  precision: number
): Promise<number> {
  const result = await queryExecutor(
    `
        UPDATE app.geocoding_cache
        SET address_attempts = 0,
            geocoded_at = NOW()
        WHERE precision = $1
          AND address IS NULL
          AND address_attempts > 0
      `,
    [precision]
  );
  return Number(result.rowCount || 0);
}
