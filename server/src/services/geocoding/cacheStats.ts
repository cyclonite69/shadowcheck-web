import { query } from '../../config/database';
import type { GeocodingRunSnapshot } from './types';
import { GEOCODABLE_OBSERVATION_PREDICATE } from './cacheUtils';

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
        FROM app.geocoding_cache
        WHERE address IS NULL
          AND address_attempts = 0
      ) AS pending_address_queue,
      (
        SELECT count(*)
        FROM app.geocoding_cache
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
        WHERE c.id IS NULL OR c.address IS NULL
      ) AS missing_blocks,
      (
        SELECT count(*)
        FROM app.observations o
        LEFT JOIN app.geocoding_cache c
          ON c.precision = $1
         AND c.lat_round = round(o.lat::numeric, $1)
         AND c.lon_round = round(o.lon::numeric, $1)
        WHERE o.lat IS NOT NULL
          AND o.lon IS NOT NULL
          AND o.lat BETWEEN -90 AND 90
          AND o.lon BETWEEN -180 AND 180
          AND COALESCE(o.is_quality_filtered, false) = false
          AND (c.id IS NULL OR c.address IS NULL)
      ) AS unresolved_observations;
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

const getActivePendingPrecisions = async (excludePrecision: number): Promise<number[]> => {
  const result = await query(
    `SELECT DISTINCT precision
     FROM app.geocoding_cache
     WHERE address IS NULL
       AND address_attempts = 0
       AND precision != $1
     ORDER BY precision DESC`,
    [excludePrecision]
  );
  return result.rows.map((r: { precision: number }) => Number(r.precision));
};

export { loadCacheStats, getActivePendingPrecisions };
