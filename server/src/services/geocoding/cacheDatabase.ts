import { query } from '../../config/database';
import type { GeocodeMode, GeocodeProvider, GeocodeRow } from './types';
import { GEOCODABLE_OBSERVATION_PREDICATE } from './cacheUtils';

const upsertGeocodeCacheBatch = async (precision: number, entries: any[]): Promise<void> => {
  if (entries.length === 0) return;
  // TODO: Implement logic
};

const seedNetworkRepresentativeCandidates = async (targetCount: number): Promise<number> => {
  const result = await query(
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
};

const seedAddressCandidates = async (precision: number, targetCount: number): Promise<number> => {
  const observationResult = await query(
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

  const observationInserted = Number(observationResult.rows[0]?.inserted_count || 0);
  if (precision !== 5) return observationInserted;

  const networkInserted = await seedNetworkRepresentativeCandidates(targetCount);
  return observationInserted + networkInserted;
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

const resetFailedAddressCandidates = async (precision: number): Promise<number> => {
  const result = await query(
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
};

export { upsertGeocodeCacheBatch, seedAddressCandidates, fetchRows, resetFailedAddressCandidates };
