/**
 * ALPR Sync Service
 *
 * Exposes the Overpass-based ALPR camera sync pipeline for use by the
 * Express admin route layer. The service accepts the shared
 * `longRunningPool` instance so no second Postgres connection pool is
 * allocated — this is intentional and non-negotiable.
 *
 * Concurrency Safety:
 *   Uses Postgres session advisory lock `ALPR_SYNC_LOCK_KEY` to guarantee
 *   mutual exclusion. If another sync (manual or daemon) is running,
 *   subsequent requests fail fast with a 409 Conflict error.
 *
 * Prune Safety:
 *   If Overpass returns 0 candidate records, pruning is skipped to prevent
 *   accidental table wipe from an empty Overpass API response.
 */

import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { findRegion, ALPR_REGIONS } from '../../../../src/alpr/regions';
import {
  fetchAlprElements,
  elementsToRecords,
  type Bbox,
} from '../../../../src/alpr/overpassClient';
import {
  acquireAlprLock,
  ALPR_SYNC_LOCK_KEY,
  pruneStaleInBbox,
  releaseAlprLock,
  upsertAlprBatch,
} from '../../../../src/alpr/alprSync';
import {
  ALPR_DEFAULT_CHUNK_COUNT,
  markRegionSyncFailed,
  markRegionSyncRunning,
  markRegionSyncSuccess,
} from '../../../../src/alpr/alprRegionState';

const logger = require('../../logging/logger');

export { ALPR_REGIONS };
export { ALPR_SYNC_LOCK_KEY };

export interface AlprSyncResult {
  regionId: string;
  regionLabel: string;
  upsertedCount: number;
  prunedCount: number;
  candidateCount: number;
  durationMs: number;
}

export type SyncJobStatus = 'dispatched' | 'running' | 'completed' | 'failed';

export interface SyncJobState {
  jobId: string;
  regionId: string;
  status: SyncJobStatus;
  startTime: string;
  endTime?: string;
  error?: string;
  result?: AlprSyncResult;
}

export type SyncDispatchResult =
  | { jobId: string; regionId: string; status: 'dispatched' }
  | { jobId: string; regionId: string; status: 'already_running' };

const JOB_TTL_MS = 15 * 60 * 1000;
const syncJobs = new Map<string, SyncJobState>();

function purgeExpiredJobs(now = Date.now()): void {
  for (const [jobId, job] of syncJobs) {
    if (
      (job.status === 'completed' || job.status === 'failed') &&
      now - Date.parse(job.endTime ?? job.startTime) >= JOB_TTL_MS
    ) {
      syncJobs.delete(jobId);
    }
  }
}

function findRunningJob(regionId: string): SyncJobState | undefined {
  for (const job of syncJobs.values()) {
    if (job.regionId === regionId && (job.status === 'dispatched' || job.status === 'running')) {
      return job;
    }
  }
  return undefined;
}

export function getSyncStatus(regionId?: string): SyncJobState[] {
  purgeExpiredJobs();
  return [...syncJobs.values()]
    .filter((job) => !regionId || job.regionId === regionId)
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
}

/**
 * Run a single-region Overpass sync in-process using the provided pool.
 *
 * @param pool         - Shared long-running Postgres pool (no statement timeout).
 * @param regionId     - One of the IDs from `ALPR_REGIONS` (e.g. `'seattle'`).
 * @param prune        - When true, delete stale rows inside the region bbox after upsert.
 * @returns            - Upsert and prune counts for the caller to surface.
 * @throws             - Error if region unknown, lock held, or Overpass fetch fails.
 */
export async function syncAlprRegion(
  pool: Pool,
  regionId: string,
  prune = false
): Promise<AlprSyncResult> {
  const region = findRegion(regionId);
  if (!region) {
    throw new Error(`Unknown ALPR region id: '${regionId}'`);
  }

  // Acquire a dedicated client for the session advisory lock so that
  // the lock is held across the entire fetch-upsert-prune pipeline.
  const client: PoolClient = await pool.connect();
  let lockAcquired = false;

  try {
    lockAcquired = await acquireAlprLock(client);

    if (!lockAcquired) {
      throw new Error('ALPR synchronization is already in progress');
    }

    const started = Date.now();
    const runStartedAt = new Date(started);

    const [west, south, east, north] = region.bbox;
    const bbox: Bbox = { west, south, east, north };

    await markRegionSyncRunning(client, region);

    try {
      // Fetch elements from Overpass API (may throw on timeout/network failure)
      const elements = await fetchAlprElements(bbox);
      const records = elementsToRecords(elements);

      // Upsert batch via UNNEST in single round-trip
      const upsertedCount = await upsertAlprBatch(client, records, runStartedAt);

      // Prune safety guard: only prune if Overpass returned candidate records.
      // If Overpass returned 0 elements, skip prune to prevent wiping existing cameras.
      let prunedCount = 0;
      if (prune) {
        if (records.length > 0) {
          prunedCount = await pruneStaleInBbox(client, bbox, runStartedAt);
        }
      }

      await markRegionSyncSuccess(client, region.id, {
        chunkCount: ALPR_DEFAULT_CHUNK_COUNT,
        elementCount: records.length,
      });

      return {
        regionId: region.id,
        regionLabel: region.label,
        upsertedCount,
        prunedCount,
        candidateCount: records.length,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      await markRegionSyncFailed(client, region.id);
      throw error;
    }
  } finally {
    if (lockAcquired) {
      await releaseAlprLock(client);
    }
    client.release();
  }
}

export async function runAlprSync(regionId: string, prune = false): Promise<AlprSyncResult> {
  const { getLongRunningAdminPool } = require('../adminDbService');
  const adminPool = getLongRunningAdminPool();
  if (!adminPool) {
    throw new Error('Long-running admin database pool not initialized (check DB_ADMIN_PASSWORD)');
  }
  return syncAlprRegion(adminPool, regionId, prune);
}

export function dispatchRegionSync(regionId: string, prune = false): SyncDispatchResult {
  purgeExpiredJobs();
  if (!findRegion(regionId)) {
    throw new Error(`Unknown ALPR region id: '${regionId}'`);
  }

  const active = findRunningJob(regionId);
  if (active) {
    return { jobId: active.jobId, regionId, status: 'already_running' };
  }

  const job: SyncJobState = {
    jobId: randomUUID(),
    regionId,
    status: 'running',
    startTime: new Date().toISOString(),
  };
  syncJobs.set(job.jobId, job);

  void Promise.resolve()
    .then(() => runAlprSync(regionId, prune))
    .then((result) => {
      job.status = 'completed';
      job.endTime = new Date().toISOString();
      job.result = result;
    })
    .catch((error: unknown) => {
      job.status = 'failed';
      job.endTime = new Date().toISOString();
      job.error = error instanceof Error ? error.message : String(error);
      logger.error('ALPR background sync failed', {
        jobId: job.jobId,
        regionId,
        error: job.error,
      });
    });

  return { jobId: job.jobId, regionId, status: 'dispatched' };
}

export const alprSyncService = {
  getRegions: async () =>
    ALPR_REGIONS.map((r) => ({
      id: r.id,
      name: r.label,
      label: r.label,
      state: r.state,
      bbox: r.bbox,
    })),
  syncRegion: async ({ region, prune = false }: { region: string; prune?: boolean }) => {
    return runAlprSync(region, prune);
  },
  dispatchRegionSync,
  getSyncStatus,
  runAlprSync,
  syncAlprRegion,
};
