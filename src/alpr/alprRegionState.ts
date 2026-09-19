/**
 * Durable per-region ALPR sync outcome writers for app.alpr_regions.
 *
 * cooldown_until is observability-only in Phase 2 (1h success / 6h failure).
 * Nothing gates admin or daemon sync on these values yet.
 */

import type { AlprDbClient } from './alprSync';
import type { AlprRegion } from './regions';

/** Default Overpass grid size (matches overpassClient CHUNK_ROWS × CHUNK_COLS). */
// TODO: last_chunk_count is decorative until fetchAlprElements returns the actual
// subdivided chunk length — overrides via FetchAlprElementsOptions.rows/cols would lie.
export const ALPR_DEFAULT_CHUNK_COUNT = 4;

export const ALPR_SUCCESS_COOLDOWN_SQL = `NOW() + INTERVAL '1 hour'`;
export const ALPR_FAILURE_COOLDOWN_SQL = `NOW() + INTERVAL '6 hours'`;

export type AlprRegionSyncStatus = 'idle' | 'running' | 'success' | 'failed';

/**
 * Mark a region sync as running. Upserts identity columns so a missing seed
 * row cannot leave status untracked.
 */
export async function markRegionSyncRunning(
  client: AlprDbClient,
  region: AlprRegion
): Promise<void> {
  await client.query(
    `
      INSERT INTO app.alpr_regions (region_id, name, state, bbox, sync_status, updated_at)
      VALUES ($1, $2, $3, $4::jsonb, 'running', NOW())
      ON CONFLICT (region_id) DO UPDATE
        SET sync_status = 'running',
            name = EXCLUDED.name,
            state = EXCLUDED.state,
            bbox = EXCLUDED.bbox,
            updated_at = NOW()
    `,
    [region.id, region.label, region.state, JSON.stringify(region.bbox)]
  );
}

/**
 * Mark a region sync as successful and record chunk/element counts + cooldown.
 */
export async function markRegionSyncSuccess(
  client: AlprDbClient,
  regionId: string,
  opts: { chunkCount: number; elementCount: number }
): Promise<void> {
  await client.query(
    `
      UPDATE app.alpr_regions
      SET sync_status = 'success',
          last_sync_at = NOW(),
          last_chunk_count = $2,
          last_element_count = $3,
          cooldown_until = ${ALPR_SUCCESS_COOLDOWN_SQL},
          updated_at = NOW()
      WHERE region_id = $1
    `,
    [regionId, opts.chunkCount, opts.elementCount]
  );
}

/**
 * Mark a region sync as failed and set the longer failure cooldown.
 * Does not clear prior chunk/element counts.
 */
export async function markRegionSyncFailed(client: AlprDbClient, regionId: string): Promise<void> {
  await client.query(
    `
      UPDATE app.alpr_regions
      SET sync_status = 'failed',
          last_sync_at = NOW(),
          cooldown_until = ${ALPR_FAILURE_COOLDOWN_SQL},
          updated_at = NOW()
      WHERE region_id = $1
    `,
    [regionId]
  );
}
