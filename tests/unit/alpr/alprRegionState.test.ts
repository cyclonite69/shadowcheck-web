import * as fs from 'fs';
import * as path from 'path';
import { ALPR_REGIONS } from '../../../src/alpr/regions';
import {
  ALPR_DEFAULT_CHUNK_COUNT,
  ALPR_FAILURE_COOLDOWN_SQL,
  ALPR_SUCCESS_COOLDOWN_SQL,
  markRegionSyncFailed,
  markRegionSyncRunning,
  markRegionSyncSuccess,
} from '../../../src/alpr/alprRegionState';

describe('alprRegionState writers', () => {
  const client = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('markRegionSyncRunning upserts identity and sets status running', async () => {
    const region = ALPR_REGIONS.find((r) => r.id === 'seattle')!;
    await markRegionSyncRunning(client, region);

    expect(client.query).toHaveBeenCalledTimes(1);
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO app\.alpr_regions/);
    expect(sql).toMatch(/sync_status = 'running'/);
    expect(params).toEqual(['seattle', region.label, region.state, JSON.stringify(region.bbox)]);
  });

  it('markRegionSyncSuccess records counts and 1h cooldown', async () => {
    await markRegionSyncSuccess(client, 'seattle', {
      chunkCount: ALPR_DEFAULT_CHUNK_COUNT,
      elementCount: 12,
    });

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/sync_status = 'success'/);
    expect(sql).toContain(ALPR_SUCCESS_COOLDOWN_SQL);
    expect(params).toEqual(['seattle', ALPR_DEFAULT_CHUNK_COUNT, 12]);
  });

  it('markRegionSyncFailed records failure and 6h cooldown', async () => {
    await markRegionSyncFailed(client, 'atlanta');

    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/sync_status = 'failed'/);
    expect(sql).toContain(ALPR_FAILURE_COOLDOWN_SQL);
    expect(params).toEqual(['atlanta']);
  });
});

describe('alpr_regions migration seed', () => {
  const migrationPath = path.join(
    __dirname,
    '../../../sql/migrations/20260919_101_create_alpr_regions.sql'
  );

  it('seeds exactly one row per ALPR_REGIONS entry with matching ids', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS app\.alpr_regions/);
    expect(sql).toMatch(/state\s+text NOT NULL/);

    const insertBlock = sql.slice(sql.indexOf('INSERT INTO app.alpr_regions'));
    const seededIds = [...insertBlock.matchAll(/\('([a-z0-9-]+)',\s*'/g)].map((m) => m[1]);
    const regionIds = ALPR_REGIONS.map((r) => r.id);

    expect(seededIds).toHaveLength(ALPR_REGIONS.length);
    expect(seededIds.sort()).toEqual([...regionIds].sort());
    expect(ALPR_REGIONS.length).toBe(30);
  });
});
