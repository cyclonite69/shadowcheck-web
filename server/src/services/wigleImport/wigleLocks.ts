/**
 * WiGLE Advisory Lock Coordination
 *
 * Implements session-scoped PostgreSQL advisory locks to guarantee:
 * 1. Global WiGLE serialization: At most one WiGLE API import loop (WiFi or Bluetooth)
 *    executes at any time within this database (classid = 9192000, objid = 1).
 * 2. Per-run identity: Identifies the active execution owner for a specific run
 *    (classid = 9192001, objid = runId).
 *
 * Both locks are held on the same dedicated PoolClient for the entire lifetime
 * of the import loop and released explicitly in reverse order:
 * per-run lock first, then global lock.
 */

import type { Pool, PoolClient } from 'pg';
import logger from '../../logging/logger';

export const WIGLE_GLOBAL_LOCK_CLASSID = 9192000;
export const WIGLE_GLOBAL_LOCK_OBJID = 1;
export const WIGLE_RUN_LOCK_CLASSID = 9192001;

/**
 * Acquire the global WiGLE serialization advisory lock.
 * Serializes all WiGLE API-consuming imports within the current database.
 */
export async function acquireGlobalWigleLock(client: PoolClient): Promise<boolean> {
  const res = await client.query('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
    WIGLE_GLOBAL_LOCK_CLASSID,
    WIGLE_GLOBAL_LOCK_OBJID,
  ]);
  return Boolean(res.rows?.[0]?.acquired);
}

/**
 * Acquire the per-run identity advisory lock.
 * Identifies the execution owner for a specific import run.
 */
export async function acquireRunWigleLock(client: PoolClient, runId: number): Promise<boolean> {
  const res = await client.query('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
    WIGLE_RUN_LOCK_CLASSID,
    runId,
  ]);
  return Boolean(res.rows?.[0]?.acquired);
}

/**
 * Release the per-run identity advisory lock.
 */
export async function releaseRunWigleLock(client: PoolClient, runId: number): Promise<boolean> {
  try {
    const res = await client.query('SELECT pg_advisory_unlock($1, $2) AS released', [
      WIGLE_RUN_LOCK_CLASSID,
      runId,
    ]);
    return Boolean(res.rows?.[0]?.released);
  } catch (err: any) {
    logger.warn('[WiGLE Lock] Failed to release per-run advisory lock', {
      runId,
      error: err.message,
    });
    return false;
  }
}

/**
 * Release the global WiGLE serialization advisory lock.
 */
export async function releaseGlobalWigleLock(client: PoolClient): Promise<boolean> {
  try {
    const res = await client.query('SELECT pg_advisory_unlock($1, $2) AS released', [
      WIGLE_GLOBAL_LOCK_CLASSID,
      WIGLE_GLOBAL_LOCK_OBJID,
    ]);
    return Boolean(res.rows?.[0]?.released);
  } catch (err: any) {
    logger.warn('[WiGLE Lock] Failed to release global advisory lock', {
      error: err.message,
    });
    return false;
  }
}

/**
 * Identify the currently active WiGLE run ID by querying the per-run lock namespace
 * in pg_locks scoped strictly to the current database.
 */
export async function findActiveWigleRunId(
  clientOrPool: Pool | PoolClient
): Promise<number | null> {
  const res = await clientOrPool.query(
    `
    SELECT l.objid AS active_run_id
      FROM pg_locks l
     WHERE l.locktype = 'advisory'
       AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
       AND l.classid = $1
       AND l.objsubid = 2
       AND l.granted = true
     LIMIT 1;
    `,
    [WIGLE_RUN_LOCK_CLASSID]
  );
  if (res.rows && res.rows.length > 0) {
    const id = Number(res.rows[0].active_run_id);
    return Number.isFinite(id) ? id : null;
  }
  return null;
}

/**
 * Atomically transition a run to 'running' state.
 * Only transitions if the run is in a resumable/pending state ('running', 'paused', 'failed').
 */
export async function transitionRunToRunning(
  client: PoolClient,
  runId: number
): Promise<any | null> {
  const result = await client.query(
    `UPDATE app.wigle_import_runs
        SET status = 'running',
            last_error = NULL,
            last_attempted_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
        AND status IN ('running', 'paused', 'failed')
      RETURNING *`,
    [runId]
  );
  return result.rows?.[0] ?? null;
}
