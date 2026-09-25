import { Pool } from 'pg';
import type { AlprDbClient } from './alprSync';

const CURSOR_KEY = 'alpr_sync_region_cursor';

interface CursorState {
  index: number;
  lastRunAt: string | null;
}

/**
 * Persists rotation position in app.settings — VERIFY this table's real
 * column shape (key, value jsonb, description, updated_at) against the
 * live DB before trusting this; it's modeled on daemonState.ts but not
 * independently confirmed here.
 */
export async function loadCursor(pool: Pool | AlprDbClient): Promise<CursorState> {
  const result = await pool.query('SELECT value FROM app.settings WHERE key = $1 LIMIT 1', [
    CURSOR_KEY,
  ]);
  const row = result.rows[0];
  if (!row?.value) {
    return { index: 0, lastRunAt: null };
  }
  const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
  return { index: Number(value.index) || 0, lastRunAt: value.lastRunAt ?? null };
}

export async function saveCursor(pool: Pool | AlprDbClient, state: CursorState): Promise<void> {
  await pool.query(
    `
      INSERT INTO app.settings (key, value, description)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            description = EXCLUDED.description,
            updated_at = NOW()
    `,
    [CURSOR_KEY, JSON.stringify(state), 'Rotation cursor for ALPR metro batch sync']
  );
}

export async function nextRotation<T>(
  pool: Pool | AlprDbClient,
  items: T[],
  count: number
): Promise<T[]> {
  if (items.length === 0) {
    return [];
  }
  const state = await loadCursor(pool);
  const selected: T[] = [];
  let index = state.index % items.length;
  for (let i = 0; i < Math.min(count, items.length); i += 1) {
    selected.push(items[index]);
    index = (index + 1) % items.length;
  }
  await saveCursor(pool, { index, lastRunAt: new Date().toISOString() });
  return selected;
}
