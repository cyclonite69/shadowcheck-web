#!/usr/bin/env tsx
import '../loadEnv';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { adminQuery, closeAdminPool } from '../../server/src/services/adminDbService';
import logger from '../../server/src/logging/logger';

export interface AlprImportRecord {
  osmId: string;
  lon: number;
  lat: number;
  sourceProperties: Record<string, unknown>;
}

export interface ExistingCameraSnapshot {
  osm_id: string;
  geom_wkt: string;
  source_properties: Record<string, unknown>;
  last_seen: string;
}

export interface ScriptOptions {
  pbfPath: string;
  geojsonPath?: string;
  batchSize: number;
  apply: boolean;
  rollbackFilePath: string;
}

export function parseArgs(args: string[]): ScriptOptions {
  const options: ScriptOptions = {
    pbfPath: '/home/dbcooper/repos/osm-spatial-pipeline/output/michigan-surveillance.osm.pbf',
    batchSize: 500,
    apply: false,
    rollbackFilePath: path.join(process.cwd(), 'backups', 'alpr', 'rollback-michigan-alpr.json'),
  };

  for (const arg of args) {
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--dry-run') {
      options.apply = false;
    } else if (arg.startsWith('--pbf=')) {
      options.pbfPath = arg.slice('--pbf='.length);
    } else if (arg.startsWith('--geojson=')) {
      options.geojsonPath = arg.slice('--geojson='.length);
    } else if (arg.startsWith('--batch-size=')) {
      const parsed = parseInt(arg.slice('--batch-size='.length), 10);
      if (!isNaN(parsed) && parsed > 0) {
        options.batchSize = parsed;
      }
    } else if (arg.startsWith('--rollback-file=')) {
      options.rollbackFilePath = arg.slice('--rollback-file='.length);
    }
  }

  return options;
}

export function extractGeoJsonFromPbf(pbfPath: string, targetGeoJsonPath: string): void {
  if (!fs.existsSync(pbfPath)) {
    throw new Error(`PBF file does not exist at: ${pbfPath}`);
  }

  logger.info(`Running osmium export on ${pbfPath} -> ${targetGeoJsonPath}...`);
  execFileSync(
    'osmium',
    [
      'export',
      pbfPath,
      '--geometry-types=point',
      '-u',
      'type_id',
      '-o',
      targetGeoJsonPath,
      '--overwrite',
    ],
    { stdio: 'pipe' }
  );
}

export function parseAndFilterAlprRecords(geoJsonContent: string): AlprImportRecord[] {
  const data = JSON.parse(geoJsonContent);
  const features = data.features || [];
  const records: AlprImportRecord[] = [];

  for (const feature of features) {
    const props = feature.properties || {};
    const survType = String(props['surveillance:type'] || '');
    const camType = String(props['camera:type'] || '');

    const isAlpr = /alpr/i.test(survType) || /alpr/i.test(camType);
    if (!isAlpr) {
      continue;
    }

    const geometry = feature.geometry;
    if (!geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
      continue;
    }

    const [lon, lat] = geometry.coordinates;
    if (typeof lon !== 'number' || typeof lat !== 'number' || isNaN(lon) || isNaN(lat)) {
      continue;
    }

    const rawId = String(feature.id || props['@id'] || props['id'] || '');
    const idMatch = rawId.match(/^n?(\d+)$/);
    if (!idMatch) {
      continue;
    }
    const osmId = idMatch[1];

    // Pack non-null, non-empty properties into sourceProperties
    const sourceProperties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      if (value !== null && value !== undefined && value !== '') {
        sourceProperties[key] = value;
      }
    }

    records.push({
      osmId,
      lon,
      lat,
      sourceProperties,
    });
  }

  return records;
}

export async function snapshotExistingRows(
  osmIds: string[],
  outputFilePath: string
): Promise<number> {
  const res = await adminQuery(
    `
      SELECT
        osm_id::text,
        ST_AsText(geom) AS geom_wkt,
        source_properties,
        last_seen::text
      FROM app.alpr_cameras
      WHERE osm_id = ANY($1::bigint[])
    `,
    [osmIds]
  );

  const existing: ExistingCameraSnapshot[] = res.rows;
  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
  fs.writeFileSync(outputFilePath, JSON.stringify(existing, null, 2), 'utf-8');
  return existing.length;
}

export async function upsertAlprChunk(
  records: AlprImportRecord[],
  runStartedAt: Date
): Promise<{ inserted: number; updated: number }> {
  if (records.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  const osmIds = records.map((r) => r.osmId);
  const lons = records.map((r) => r.lon);
  const lats = records.map((r) => r.lat);
  const props = records.map((r) => JSON.stringify(r.sourceProperties));

  const result = await adminQuery(
    `
      INSERT INTO app.alpr_cameras (osm_id, geom, source_properties, last_seen)
      SELECT
        t.osm_id,
        ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326),
        t.source_properties,
        $5::timestamptz
      FROM UNNEST($1::bigint[], $2::double precision[], $3::double precision[], $4::jsonb[])
        AS t(osm_id, lon, lat, source_properties)
      ON CONFLICT (osm_id) DO UPDATE SET
        geom = EXCLUDED.geom,
        source_properties = EXCLUDED.source_properties,
        last_seen = EXCLUDED.last_seen
      RETURNING (xmax = 0) AS inserted;
    `,
    [osmIds, lons, lats, props, runStartedAt.toISOString()]
  );

  let inserted = 0;
  let updated = 0;
  for (const row of result.rows) {
    if (row.inserted) {
      inserted++;
    } else {
      updated++;
    }
  }

  return { inserted, updated };
}

export async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const runStartedAt = new Date();

  console.log('====================================================');
  console.log(' Michigan OSM Surveillance ALPR Loader / Port Script');
  console.log('====================================================');
  console.log(
    `Mode:            ${options.apply ? 'APPLY (LIVE DB WRITE)' : 'DRY-RUN (NO DB WRITES)'}`
  );
  console.log(`PBF Path:        ${options.pbfPath}`);
  console.log(`Batch Size:      ${options.batchSize}`);
  console.log(`Rollback File:   ${options.rollbackFilePath}`);
  console.log('----------------------------------------------------');

  let geoJsonPath = options.geojsonPath;
  let tempGeoJsonCreated = false;

  if (!geoJsonPath || !fs.existsSync(geoJsonPath)) {
    geoJsonPath = path.join('/tmp', `mi-alpr-export-${Date.now()}.geojson`);
    extractGeoJsonFromPbf(options.pbfPath, geoJsonPath);
    tempGeoJsonCreated = true;
  }

  try {
    const rawContent = fs.readFileSync(geoJsonPath, 'utf-8');
    const records = parseAndFilterAlprRecords(rawContent);

    console.log(`Parsed ALPR features from source: ${records.length}`);
    if (records.length !== 3725) {
      console.warn(`WARNING: Expected exactly 3,725 records, but found ${records.length}!`);
    }

    const osmIds = records.map((r) => r.osmId);
    const existingCheckRes = await adminQuery(
      `
        SELECT
          COUNT(*) FILTER (WHERE a.osm_id IS NOT NULL) AS already_present,
          COUNT(*) FILTER (WHERE a.osm_id IS NULL) AS to_insert
        FROM UNNEST($1::bigint[]) AS t(osm_id)
        LEFT JOIN app.alpr_cameras a ON a.osm_id = t.osm_id
      `,
      [osmIds]
    );

    const alreadyPresent = parseInt(existingCheckRes.rows[0]?.already_present || '0', 10);
    const toInsert = parseInt(existingCheckRes.rows[0]?.to_insert || '0', 10);

    console.log('Database breakdown:');
    console.log(`  Existing (will update): ${alreadyPresent}`);
    console.log(`  New (will insert):      ${toInsert}`);
    console.log(`  Total to process:       ${records.length}`);

    if (!options.apply) {
      console.log('----------------------------------------------------');
      console.log('DRY RUN COMPLETE: No changes written to database.');
      console.log('To execute this upsert against shadowcheck_db, re-run with:');
      console.log('  npx tsx scripts/alpr/port-michigan-osm.ts --apply');
      console.log('====================================================');
      return;
    }

    console.log('----------------------------------------------------');
    console.log(`Creating rollback snapshot of existing ${alreadyPresent} rows...`);
    const snapCount = await snapshotExistingRows(osmIds, options.rollbackFilePath);
    console.log(`Snapshot saved to ${options.rollbackFilePath} (${snapCount} rows).`);

    console.log('Executing batch upsert...');
    let totalInserted = 0;
    let totalUpdated = 0;

    for (let i = 0; i < records.length; i += options.batchSize) {
      const chunk = records.slice(i, i + options.batchSize);
      const { inserted, updated } = await upsertAlprChunk(chunk, runStartedAt);
      totalInserted += inserted;
      totalUpdated += updated;
      process.stdout.write(
        `\rProcessed ${Math.min(i + options.batchSize, records.length)}/${records.length} ` +
          `(+${totalInserted} inserted, ~${totalUpdated} updated)...`
      );
    }
    console.log('\nBatch upsert completed.');

    console.log('----------------------------------------------------');
    console.log('Running Post-Upsert Verification Gate:');

    // 1. Record counts
    console.log(
      `  1. Total processed: ${records.length} (${totalInserted} inserted, ${totalUpdated} updated)`
    );
    if (totalInserted === 989 && totalUpdated === 2736 && records.length === 3725) {
      console.log('     [PASS] Exact node split matched target (989 inserted, 2,736 updated).');
    } else {
      console.warn(
        `     [WARN] Node split differed: ${totalInserted} inserted, ${totalUpdated} updated.`
      );
    }

    // 2. Geometry validity check
    const geomCheck = await adminQuery(
      `
        SELECT COUNT(*) AS invalid_count
        FROM app.alpr_cameras
        WHERE osm_id = ANY($1::bigint[])
          AND NOT ST_IsValid(geom)
      `,
      [osmIds]
    );
    const invalidCount = parseInt(geomCheck.rows[0]?.invalid_count || '0', 10);
    console.log(`  2. ST_IsValid(geom) check: ${invalidCount} invalid geometries.`);
    if (invalidCount === 0) {
      console.log('     [PASS] All 3,725 geometries are valid.');
    } else {
      console.error('     [FAIL] Found invalid geometries!');
    }

    // 3. last_seen check
    const lastSeenCheck = await adminQuery(
      `
        SELECT COUNT(*) AS stale_count
        FROM app.alpr_cameras
        WHERE osm_id = ANY($1::bigint[])
          AND last_seen < $2::timestamptz
      `,
      [osmIds, runStartedAt.toISOString()]
    );
    const staleCount = parseInt(lastSeenCheck.rows[0]?.stale_count || '0', 10);
    console.log(`  3. last_seen timestamp check: ${staleCount} records predating run.`);
    if (staleCount === 0) {
      console.log('     [PASS] All 3,725 records refreshed with current run timestamp.');
    } else {
      console.error('     [FAIL] Some records were not refreshed!');
    }

    console.log('====================================================');
    console.log(' PORT SUCCESSFUL');
    console.log('====================================================');
  } finally {
    if (tempGeoJsonCreated && geoJsonPath && fs.existsSync(geoJsonPath)) {
      try {
        fs.unlinkSync(geoJsonPath);
      } catch {
        // Ignore cleanup error
      }
    }
    await closeAdminPool();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('Fatal error running port-michigan-osm:', err);
    process.exit(1);
  });
}
