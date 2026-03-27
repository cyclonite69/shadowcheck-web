const { query } = require('../../config/database');

export {};

import type { GeocodeRunOptions, GeocodeRunSummary, GeocodingRunSnapshot } from './types';

const GEOCODING_RUN_LOCK_KEY = 74100531;

const createRunSnapshot = (
  status: GeocodingRunSnapshot['status'],
  options: GeocodeRunOptions,
  extras: Partial<GeocodingRunSnapshot> = {}
): GeocodingRunSnapshot => ({
  status,
  startedAt: extras.startedAt || new Date().toISOString(),
  provider: options.provider,
  mode: options.mode,
  precision: options.precision ?? 5,
  limit: options.limit ?? 1000,
  perMinute: options.perMinute ?? 200,
  permanent: options.permanent,
  ...extras,
});

const loadRecentJobHistory = async (): Promise<GeocodingRunSnapshot[]> => {
  const result = await query(
    `
    SELECT
      id,
      status,
      provider,
      mode,
      precision,
      limit_rows,
      per_minute,
      permanent,
      processed,
      successful,
      poi_hits,
      rate_limited,
      duration_ms,
      error,
      started_at,
      finished_at
    FROM app.geocoding_job_runs
    ORDER BY started_at DESC
    LIMIT 10;
  `
  );

  return result.rows.map((row: any) => ({
    id: Number(row.id),
    status: row.status,
    provider: row.provider,
    mode: row.mode,
    precision: Number(row.precision),
    limit: Number(row.limit_rows),
    perMinute: Number(row.per_minute),
    permanent: Boolean(row.permanent),
    startedAt:
      row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at),
    finishedAt: row.finished_at
      ? row.finished_at instanceof Date
        ? row.finished_at.toISOString()
        : String(row.finished_at)
      : undefined,
    error: row.error || undefined,
    result:
      row.processed !== null && row.processed !== undefined
        ? {
            precision: Number(row.precision),
            mode: row.mode,
            provider: row.provider,
            processed: Number(row.processed || 0),
            successful: Number(row.successful || 0),
            poiHits: Number(row.poi_hits || 0),
            rateLimited: Number(row.rate_limited || 0),
            durationMs: Number(row.duration_ms || 0),
          }
        : undefined,
  }));
};

const getProbeCoordinates = async (
  precision: number
): Promise<{ lat: number; lon: number } | null> => {
  const result = await query(
    `
    SELECT
      round(lat::numeric, $1)::double precision AS lat_round,
      round(lon::numeric, $1)::double precision AS lon_round
    FROM app.observations
    WHERE lat BETWEEN -90 AND 90
      AND lon BETWEEN -180 AND 180
    GROUP BY 1, 2
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  `,
    [precision]
  );

  const row = result.rows[0];
  if (!row) return null;
  return { lat: Number(row.lat_round), lon: Number(row.lon_round) };
};

const createJobRun = async (options: GeocodeRunOptions): Promise<number> => {
  const result = await query(
    `
    INSERT INTO app.geocoding_job_runs (
      provider,
      mode,
      precision,
      limit_rows,
      per_minute,
      permanent,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'running')
    RETURNING id;
  `,
    [
      options.provider,
      options.mode,
      options.precision ?? 5,
      options.limit ?? 1000,
      options.perMinute ?? 200,
      Boolean(options.permanent),
    ]
  );

  return Number(result.rows[0]?.id);
};

const completeJobRun = async (jobId: number, result: GeocodeRunSummary): Promise<void> => {
  await query(
    `
    UPDATE app.geocoding_job_runs
    SET
      status = 'completed',
      processed = $2,
      successful = $3,
      poi_hits = $4,
      rate_limited = $5,
      duration_ms = $6,
      finished_at = NOW()
    WHERE id = $1;
  `,
    [
      jobId,
      result.processed,
      result.successful,
      result.poiHits,
      result.rateLimited,
      result.durationMs,
    ]
  );
};

const updateJobRunProgress = async (
  jobId: number,
  result: Pick<GeocodeRunSummary, 'processed' | 'successful' | 'poiHits' | 'rateLimited'>,
  durationMs: number
): Promise<void> => {
  await query(
    `
    UPDATE app.geocoding_job_runs
    SET
      processed = $2,
      successful = $3,
      poi_hits = $4,
      rate_limited = $5,
      duration_ms = $6
    WHERE id = $1
      AND status = 'running';
  `,
    [jobId, result.processed, result.successful, result.poiHits, result.rateLimited, durationMs]
  );
};

const failJobRun = async (jobId: number, error: string): Promise<void> => {
  await query(
    `
    UPDATE app.geocoding_job_runs
    SET
      status = 'failed',
      error = $2,
      finished_at = NOW()
    WHERE id = $1;
  `,
    [jobId, error]
  );
};

const acquireGeocodingRunLock = async (): Promise<boolean> => {
  const result = await query('SELECT pg_try_advisory_lock($1) AS acquired', [
    GEOCODING_RUN_LOCK_KEY,
  ]);
  return Boolean(result.rows[0]?.acquired);
};

const releaseGeocodingRunLock = async (): Promise<void> => {
  await query('SELECT pg_advisory_unlock($1)', [GEOCODING_RUN_LOCK_KEY]);
};

export {
  acquireGeocodingRunLock,
  completeJobRun,
  createJobRun,
  createRunSnapshot,
  failJobRun,
  getProbeCoordinates,
  loadRecentJobHistory,
  releaseGeocodingRunLock,
  updateJobRunProgress,
};
