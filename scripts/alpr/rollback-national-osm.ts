#!/usr/bin/env tsx
import '../loadEnv';
import fs from 'fs';
import readline from 'readline';
import { closeAdminPool } from '../../server/src/services/adminDbService';
import {
  deleteInsertedAlprCameras,
  restoreAlprCameras,
  type ExistingCameraSnapshot,
} from '../../server/src/repositories/alprIngestionRepository';

async function* readJsonLines<T>(filePath: string): AsyncGenerator<T> {
  const lines = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.trim()) {
      yield JSON.parse(line) as T;
    }
  }
}

export async function rollback(snapshotFilePath: string, apply: boolean): Promise<void> {
  const insertedIdsFilePath = `${snapshotFilePath}.inserted`;
  if (!fs.existsSync(snapshotFilePath) || !fs.existsSync(insertedIdsFilePath)) {
    throw new Error(`Rollback snapshot or inserted-ID file is missing for ${snapshotFilePath}`);
  }

  if (!apply) {
    console.log(
      `Dry run: rollback would restore rows from ${snapshotFilePath} and delete IDs from ` +
        `${insertedIdsFilePath}. No database writes performed.`
    );
    return;
  }

  let snapshots: ExistingCameraSnapshot[] = [];
  for await (const snapshot of readJsonLines<ExistingCameraSnapshot>(snapshotFilePath)) {
    snapshots.push(snapshot);
    if (snapshots.length === 2000) {
      await restoreChunk(snapshots);
      snapshots = [];
    }
  }
  if (snapshots.length > 0) {
    await restoreChunk(snapshots);
  }

  let insertedIds: string[] = [];
  const lines = readline.createInterface({
    input: fs.createReadStream(insertedIdsFilePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const id of lines) {
    if (!id.trim()) {
      continue;
    }
    insertedIds.push(id.trim());
    if (insertedIds.length === 2000) {
      await deleteChunk(insertedIds);
      insertedIds = [];
    }
  }
  if (insertedIds.length > 0) {
    await deleteChunk(insertedIds);
  }
  console.log('National OSM ALPR rollback completed.');
}

async function deleteChunk(ids: string[]): Promise<void> {
  await deleteInsertedAlprCameras(ids);
}

async function restoreChunk(records: ExistingCameraSnapshot[]): Promise<void> {
  await restoreAlprCameras(records);
}

async function run(): Promise<void> {
  const snapshotFilePath = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--snapshot='))
    ?.slice('--snapshot='.length);
  const apply = process.argv.includes('--apply');
  if (!snapshotFilePath) {
    throw new Error('Pass --snapshot=/path/to/rollback-national.jsonl');
  }
  try {
    await rollback(snapshotFilePath, apply);
  } finally {
    await closeAdminPool();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Fatal error during national OSM ALPR rollback:', error);
    process.exit(1);
  });
}
