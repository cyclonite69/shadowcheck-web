#!/usr/bin/env tsx
import '../loadEnv';
import fs from 'fs';
import path from 'path';
import { adminQuery, closeAdminPool } from '../../server/src/services/adminDbService';
import {
  parseAndFilterAlprRecords,
  extractGeoJsonFromPbf,
  ExistingCameraSnapshot,
} from './port-michigan-osm';

export interface RollbackOptions {
  rollbackFilePath: string;
  pbfPath: string;
  apply: boolean;
}

export function parseArgs(args: string[]): RollbackOptions {
  const options: RollbackOptions = {
    rollbackFilePath: path.join(process.cwd(), 'backups', 'alpr', 'rollback-michigan-alpr.json'),
    pbfPath: '/home/dbcooper/repos/osm-spatial-pipeline/output/michigan-surveillance.osm.pbf',
    apply: false,
  };

  for (const arg of args) {
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--dry-run') {
      options.apply = false;
    } else if (arg.startsWith('--pbf=')) {
      options.pbfPath = arg.slice('--pbf='.length);
    } else if (arg.startsWith('--rollback-file=')) {
      options.rollbackFilePath = arg.slice('--rollback-file='.length);
    }
  }

  return options;
}

export async function rollback(options: RollbackOptions): Promise<void> {
  if (!fs.existsSync(options.rollbackFilePath)) {
    throw new Error(`Rollback snapshot file not found: ${options.rollbackFilePath}`);
  }

  const rawSnapshot = fs.readFileSync(options.rollbackFilePath, 'utf-8');
  const snapshots: ExistingCameraSnapshot[] = JSON.parse(rawSnapshot);
  const snapshotMap = new Map<string, ExistingCameraSnapshot>();
  for (const s of snapshots) {
    snapshotMap.set(s.osm_id, s);
  }

  const tempGeoJson = path.join('/tmp', `rollback-temp-${Date.now()}.geojson`);
  extractGeoJsonFromPbf(options.pbfPath, tempGeoJson);
  const rawPbfGeoJson = fs.readFileSync(tempGeoJson, 'utf-8');
  fs.unlinkSync(tempGeoJson);

  const allRecords = parseAndFilterAlprRecords(rawPbfGeoJson);
  const allOsmIds = allRecords.map((r) => r.osmId);

  const insertedIds = allOsmIds.filter((id) => !snapshotMap.has(id));
  const updatedSnapshots = snapshots;

  console.log('====================================================');
  console.log(' Michigan OSM Surveillance ALPR Rollback Script');
  console.log('====================================================');
  console.log(`Mode:              ${options.apply ? 'APPLY (LIVE DB ROLLBACK)' : 'DRY-RUN'}`);
  console.log(`Rollback snapshot: ${options.rollbackFilePath}`);
  console.log(`Total ALPR IDs:    ${allOsmIds.length}`);
  console.log(`New to delete:     ${insertedIds.length}`);
  console.log(`To revert:         ${updatedSnapshots.length}`);
  console.log('----------------------------------------------------');

  if (!options.apply) {
    console.log('DRY RUN COMPLETE: Run with --apply to execute rollback.');
    return;
  }

  // 1. Delete the rows that were newly inserted
  if (insertedIds.length > 0) {
    const delRes = await adminQuery(
      `
        DELETE FROM app.alpr_cameras
        WHERE osm_id = ANY($1::bigint[])
      `,
      [insertedIds]
    );
    console.log(`Deleted ${delRes.rowCount} newly inserted rows.`);
  }

  // 2. Revert updated rows in chunks
  const chunkSize = 500;
  let totalReverted = 0;
  for (let i = 0; i < updatedSnapshots.length; i += chunkSize) {
    const chunk = updatedSnapshots.slice(i, i + chunkSize);
    const osmIds = chunk.map((c) => c.osm_id);
    const wkts = chunk.map((c) => c.geom_wkt);
    const props = chunk.map((c) => JSON.stringify(c.source_properties));
    const lastSeens = chunk.map((c) => c.last_seen);

    const updRes = await adminQuery(
      `
        UPDATE app.alpr_cameras AS a
        SET
          geom = ST_SetSRID(ST_GeomFromText(t.geom_wkt), 4326),
          source_properties = t.source_properties,
          last_seen = t.last_seen::timestamptz
        FROM UNNEST($1::bigint[], $2::text[], $3::jsonb[], $4::text[])
          AS t(osm_id, geom_wkt, source_properties, last_seen)
        WHERE a.osm_id = t.osm_id
      `,
      [osmIds, wkts, props, lastSeens]
    );
    totalReverted += updRes.rowCount || 0;
  }

  console.log(`Reverted ${totalReverted} rows to pre-port state.`);
  console.log('Rollback finished successfully.');
}

export async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  try {
    await rollback(options);
  } finally {
    await closeAdminPool();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Fatal error during rollback:', err);
    process.exit(1);
  });
}
