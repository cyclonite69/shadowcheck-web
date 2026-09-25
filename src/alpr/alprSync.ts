import { Pool } from 'pg';
import type { Bbox } from './overpassClient';

export interface AlprDbClient {
  query: (sql: string, params?: unknown[]) => Promise<any>;
}

export interface AlprRecord {
  osmId: number;
  lat: number;
  lon: number;
  sourceProperties: Record<string, unknown>;
}

/**
 * 32-bit integer key for Postgres advisory lock on ALPR sync operations.
 * Guarantees mutual exclusion between the systemd CLI daemon and manual web triggers.
 */
export const ALPR_SYNC_LOCK_KEY = 9191001;

export async function acquireAlprLock(clientOrPool: AlprDbClient): Promise<boolean> {
  const result = await clientOrPool.query('SELECT pg_try_advisory_lock($1) AS acquired', [
    ALPR_SYNC_LOCK_KEY,
  ]);
  return Boolean(result.rows?.[0]?.acquired);
}

export async function releaseAlprLock(clientOrPool: AlprDbClient): Promise<void> {
  await clientOrPool.query('SELECT pg_advisory_unlock($1)', [ALPR_SYNC_LOCK_KEY]).catch(() => {});
}

/**
 * Batch upsert via UNNEST — one round trip per chunk. Existing rows are
 * updated in place. Nothing is deleted here.
 */
export async function upsertAlprBatch(
  pool: Pool | AlprDbClient,
  records: AlprRecord[],
  runStartedAt: Date
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  const osmIds = records.map((r) => r.osmId);
  const lons = records.map((r) => r.lon);
  const lats = records.map((r) => r.lat);
  const props = records.map((r) => JSON.stringify(r.sourceProperties));

  const result = await pool.query(
    `
      INSERT INTO app.alpr_cameras (osm_id, geom, source_properties, last_seen)
      SELECT
        t.osm_id,
        ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326),
        t.source_properties,
        $5::timestamptz
      FROM UNNEST($1::bigint[], $2::double precision[], $3::double precision[], $4::jsonb[])
        AS t(osm_id, lon, lat, source_properties)
      ON CONFLICT (osm_id) DO UPDATE
      SET geom = EXCLUDED.geom,
          source_properties = EXCLUDED.source_properties,
          last_seen = EXCLUDED.last_seen
    `,
    [osmIds, lons, lats, props, runStartedAt.toISOString()]
  );

  return result.rowCount ?? 0;
}

/**
 * Scoped source-wins deletion: only rows physically inside the given
 * bbox whose last_seen predates this run. Rows outside the bbox are
 * never touched. Caller must only invoke this after a fully successful
 * fetch for that bbox. Not called automatically anywhere in the CLI —
 * gated behind --prune per the standing DB-write-approval rule.
 */
export async function pruneStaleInBbox(
  pool: Pool | AlprDbClient,
  bbox: Bbox,
  runStartedAt: Date
): Promise<number> {
  const result = await pool.query(
    `
      DELETE FROM app.alpr_cameras
      WHERE last_seen < $1::timestamptz
        AND geom && ST_MakeEnvelope($2, $3, $4, $5, 4326)
    `,
    [runStartedAt.toISOString(), bbox.west, bbox.south, bbox.east, bbox.north]
  );

  return result.rowCount ?? 0;
}
