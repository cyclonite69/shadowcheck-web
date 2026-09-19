import 'dotenv/config';
import { Pool, PoolClient } from 'pg';
import { ALPR_REGIONS, findRegion, regionsByState, type AlprRegion } from './alpr/regions';
import { fetchAlprElements, elementsToRecords, type Bbox } from './alpr/overpassClient';
import {
  upsertAlprBatch,
  pruneStaleInBbox,
  acquireAlprLock,
  releaseAlprLock,
} from './alpr/alprSync';
import { nextRotation } from './alpr/alprCursor';
import {
  ALPR_DEFAULT_CHUNK_COUNT,
  markRegionSyncFailed,
  markRegionSyncRunning,
  markRegionSyncSuccess,
} from './alpr/alprRegionState';

function createPool(): Pool {
  return new Pool({
    user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'shadowcheck_admin',
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'shadowcheck_db',
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT || '5432'),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 30_000,
    statement_timeout: 60_000,
    application_name: 'shadowcheck-alpr-sync',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
}

function parseBboxArg(value?: string): Bbox | null {
  if (!value) return null;
  const parts = value.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return null;
  const [west, south, east, north] = parts;
  return { west, south, east, north };
}

interface CliArgs {
  bbox: Bbox | null;
  regionIds: string[];
  state: string | null;
  rotate: number | null;
  allRegions: boolean;
  prune: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const get = (prefix: string): string | undefined =>
    argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
  const regionsArg = get('--regions=') ?? get('--region=');
  const rotateArg = get('--rotate=');
  return {
    bbox: parseBboxArg(get('--bbox=')),
    regionIds: regionsArg ? regionsArg.split(',').map((s) => s.trim()) : [],
    state: get('--state=') ?? null,
    rotate: rotateArg ? Number(rotateArg) : null,
    allRegions: argv.includes('--all-regions'),
    prune: argv.includes('--prune'),
  };
}

async function runRegion(pool: PoolClient, region: AlprRegion, prune: boolean): Promise<void> {
  const runStartedAt = new Date();
  const [west, south, east, north] = region.bbox;
  const bbox: Bbox = { west, south, east, north };
  console.log(`[${region.id}] fetching...`);

  await markRegionSyncRunning(pool, region);

  let elements;
  try {
    elements = await fetchAlprElements(bbox);
  } catch (error) {
    await markRegionSyncFailed(pool, region.id);
    console.error(`[${region.id}] fetch failed, skipping (no writes, no prune):`, error);
    return;
  }

  try {
    const records = elementsToRecords(elements);
    const upserted = await upsertAlprBatch(pool, records, runStartedAt);
    console.log(`[${region.id}] upserted ${upserted} of ${records.length} candidate records`);

    if (prune && records.length > 0) {
      const deleted = await pruneStaleInBbox(pool, bbox, runStartedAt);
      if (deleted > 0)
        console.log(`[${region.id}] pruned ${deleted} stale rows inside region bbox`);
    }

    await markRegionSyncSuccess(pool, region.id, {
      chunkCount: ALPR_DEFAULT_CHUNK_COUNT,
      elementCount: records.length,
    });
  } catch (error) {
    await markRegionSyncFailed(pool, region.id);
    throw error;
  }
}

async function runCustomBbox(pool: PoolClient, bbox: Bbox, prune: boolean): Promise<void> {
  const runStartedAt = new Date();
  console.log(`[custom-bbox] fetching ${JSON.stringify(bbox)}...`);
  const elements = await fetchAlprElements(bbox);
  const records = elementsToRecords(elements);
  const upserted = await upsertAlprBatch(pool, records, runStartedAt);
  console.log(`[custom-bbox] upserted ${upserted} of ${records.length} candidate records`);

  if (prune && records.length > 0) {
    const deleted = await pruneStaleInBbox(pool, bbox, runStartedAt);
    if (deleted > 0) console.log(`[custom-bbox] pruned ${deleted} stale rows inside bbox`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const pool = createPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    const locked = await acquireAlprLock(client);
    if (!locked) {
      console.warn(
        '[alpr-sync-daemon] Another ALPR sync is currently in progress (advisory lock held). Skipping this cycle.'
      );
      return;
    }

    try {
      if (args.bbox) {
        await runCustomBbox(client, args.bbox, args.prune);
        return;
      }

      let regions: AlprRegion[] = [];
      if (args.allRegions) {
        regions = ALPR_REGIONS;
      } else if (args.rotate) {
        regions = await nextRotation(client, ALPR_REGIONS, args.rotate);
      } else if (args.state) {
        regions = regionsByState(args.state);
      } else if (args.regionIds.length > 0) {
        regions = args.regionIds
          .map((id) => findRegion(id))
          .filter((r): r is AlprRegion => Boolean(r));
      }

      if (regions.length === 0) {
        console.error(
          'No target specified. Use --bbox=W,S,E,N, --region=<id>, --regions=<id,id>, --state=<XX>, --rotate=<N>, or --all-regions.'
        );
        process.exitCode = 1;
        return;
      }

      /** 5 s between regions to avoid Overpass IP rate-limit bans. */
      const INTER_REGION_DELAY_MS = 5_000;
      for (let i = 0; i < regions.length; i += 1) {
        if (i > 0) await new Promise<void>((resolve) => setTimeout(resolve, INTER_REGION_DELAY_MS));
        await runRegion(client, regions[i], args.prune);
      }
    } finally {
      await releaseAlprLock(client);
      client.release();
      client = null;
    }
  } finally {
    client?.release();
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error('ALPR sync failed:', error);
    process.exitCode = 1;
  });
}

export { main, parseBboxArg };
