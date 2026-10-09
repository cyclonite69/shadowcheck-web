#!/usr/bin/env tsx
import '../loadEnv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import readline from 'readline';
import { closeAdminPool } from '../../server/src/services/adminDbService';
import {
  getExistingAlprCameras,
  upsertAlprCameras,
  vacuumAnalyzeAlprCameras,
} from '../../server/src/repositories/alprIngestionRepository';
import logger from '../../server/src/logging/logger';

export interface AlprImportRecord {
  osmId: string;
  lon: number;
  lat: number;
  sourceProperties: Record<string, unknown>;
}

export interface ScriptOptions {
  pbfPath: string;
  batchSize: number;
  apply: boolean;
  rollbackFilePath: string;
}

export function parseArgs(args: string[]): ScriptOptions {
  const options: ScriptOptions = {
    pbfPath: '',
    batchSize: 2000,
    apply: false,
    rollbackFilePath: path.join(
      process.cwd(),
      'backups',
      'alpr',
      `rollback-national-${Date.now()}.jsonl`
    ),
  };

  for (const arg of args) {
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--dry-run') {
      options.apply = false;
    } else if (arg.startsWith('--pbf=')) {
      options.pbfPath = arg.slice('--pbf='.length);
    } else if (arg.startsWith('--batch-size=')) {
      const parsed = Number.parseInt(arg.slice('--batch-size='.length), 10);
      if (Number.isInteger(parsed) && parsed >= 1000 && parsed <= 5000) {
        options.batchSize = parsed;
      } else {
        throw new Error('--batch-size must be an integer from 1000 through 5000');
      }
    } else if (arg.startsWith('--rollback-file=')) {
      options.rollbackFilePath = arg.slice('--rollback-file='.length);
    }
  }

  if (!options.pbfPath) {
    throw new Error('Pass the local national extract path with --pbf=/path/to/us-latest.osm.pbf');
  }

  return options;
}

function nonEmptyProperties(properties: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([, value]) => value !== null && value !== undefined && value !== ''
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasCameraTags(properties: Record<string, unknown>): boolean {
  const manMade = String(properties.man_made ?? '').toLowerCase();
  const surveillanceType = String(properties['surveillance:type'] ?? '').toLowerCase();
  const cameraType = String(properties['camera:type'] ?? '').trim();

  return (
    manMade === 'surveillance' ||
    surveillanceType === 'alpr' ||
    surveillanceType === 'camera' ||
    cameraType.length > 0
  );
}

export function parseGeoJsonFeature(feature: unknown): AlprImportRecord | null {
  if (!isRecord(feature) || !isRecord(feature.properties)) {
    return null;
  }

  const properties = feature.properties;
  if (!hasCameraTags(properties) || !isRecord(feature.geometry)) {
    return null;
  }
  const geometry = feature.geometry;

  if (
    geometry.type !== 'Point' ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2
  ) {
    return null;
  }

  const [lon, lat] = geometry.coordinates;
  if (
    typeof lon !== 'number' ||
    typeof lat !== 'number' ||
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    lon < -180 ||
    lon > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return null;
  }

  const rawId = String(feature.id ?? properties['@id'] ?? properties.id ?? '');
  const idMatch = rawId.match(/^(?:n|node\/)?(\d+)$/i);
  if (!idMatch || BigInt(idMatch[1]) <= 0n) {
    return null;
  }

  return {
    osmId: idMatch[1],
    lon,
    lat,
    sourceProperties: nonEmptyProperties(properties),
  };
}

function runOsmium(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

async function* streamGeoJsonSequence(pbfPath: string): AsyncGenerator<unknown> {
  const child = spawn(
    'osmium',
    [
      'export',
      pbfPath,
      '--geometry-types=point',
      '-u',
      'type_id',
      '--output-format=geojsonseq',
      '-o',
      '-',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let stderr = '';
  const completed = new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  const lines = readline.createInterface({ input: child.stdout });
  for await (const line of lines) {
    const json = (line.charCodeAt(0) === 0x1e ? line.slice(1) : line).trim();
    if (json) {
      yield JSON.parse(json);
    }
  }

  const code = await completed;
  if (code !== 0) {
    throw new Error(`osmium export exited with code ${code}: ${stderr.trim()}`);
  }
}

function appendSnapshots(
  existing: Awaited<ReturnType<typeof getExistingAlprCameras>>,
  snapshotFilePath: string
): void {
  if (existing.length > 0) {
    fs.appendFileSync(
      snapshotFilePath,
      `${existing.map((row) => JSON.stringify(row)).join('\n')}\n`
    );
  }
}

function appendInsertedIds(ids: string[], insertedIdsFilePath: string): void {
  if (ids.length > 0) {
    fs.appendFileSync(insertedIdsFilePath, `${ids.join('\n')}\n`);
  }
}

async function snapshotExistingRows(
  records: AlprImportRecord[],
  snapshotFilePath: string
): Promise<void> {
  const osmIds = records.map((record) => record.osmId);
  const existing = await getExistingAlprCameras(osmIds);
  appendSnapshots(existing, snapshotFilePath);
}

export async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.pbfPath)) {
    throw new Error(`PBF file does not exist at: ${options.pbfPath}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpr-national-'));
  const filteredPbfPath = path.join(tempDir, 'camera-nodes.osm.pbf');
  const insertedIdsFilePath = `${options.rollbackFilePath}.inserted`;
  const runStartedAt = new Date();
  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let batch = new Map<string, AlprImportRecord>();

  try {
    logger.info(`Filtering camera nodes from national OSM extract ${options.pbfPath}`);
    await runOsmium('osmium', [
      'tags-filter',
      options.pbfPath,
      'n/man_made=surveillance',
      'n/surveillance:type=ALPR',
      'n/surveillance:type=camera',
      'n/camera:type',
      '-o',
      filteredPbfPath,
      '--overwrite',
    ]);

    if (options.apply) {
      fs.mkdirSync(path.dirname(options.rollbackFilePath), { recursive: true });
      fs.writeFileSync(options.rollbackFilePath, '', 'utf8');
      fs.writeFileSync(insertedIdsFilePath, '', 'utf8');
    }

    const flushBatch = async (): Promise<void> => {
      const records = [...batch.values()];
      batch = new Map();
      if (records.length === 0) {
        return;
      }

      processed += records.length;
      if (options.apply) {
        await snapshotExistingRows(records, options.rollbackFilePath);
        const counts = await upsertAlprCameras(records, runStartedAt);
        appendInsertedIds(counts.insertedIds, insertedIdsFilePath);
        inserted += counts.insertedIds.length;
        updated += counts.updated;
      }
      console.log(
        `Processed ${processed} camera nodes${
          options.apply ? ` (${inserted} inserted, ${updated} updated)` : ' [dry-run]'
        }`
      );
    };

    for await (const feature of streamGeoJsonSequence(filteredPbfPath)) {
      const record = parseGeoJsonFeature(feature);
      if (!record) {
        continue;
      }
      batch.set(record.osmId, record);
      if (batch.size >= options.batchSize) {
        await flushBatch();
      }
    }
    await flushBatch();

    if (options.apply) {
      await vacuumAnalyzeAlprCameras();
      console.log(
        `National ALPR ingestion complete: ${processed} processed, ${inserted} inserted, ` +
          `${updated} updated. VACUUM ANALYZE completed.`
      );
      console.log(`Rollback snapshot: ${options.rollbackFilePath}`);
      console.log(`Inserted IDs: ${insertedIdsFilePath}`);
    } else {
      console.log(`Dry run complete: ${processed} camera nodes; no database writes performed.`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    await closeAdminPool();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Fatal error running national OSM ALPR ingestion:', error);
    process.exit(1);
  });
}
