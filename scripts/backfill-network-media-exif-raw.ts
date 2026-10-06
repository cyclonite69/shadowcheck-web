#!/usr/bin/env tsx
import './loadEnv';
import { query } from '../server/src/config/database';
const { adminQuery } = require('../server/src/services/adminDbService');
import { extractMetadataDumpFromBuffer } from '../server/src/services/visint/visintMetadataDump';

const PAGE_SIZE = 50;

export interface ConnectionMetadata {
  currentDatabase: string;
  currentUser: string;
  serverAddr: string;
  serverPort: string;
}

export async function fetchConnectionMetadata(
  queryFn: (sql: string, params?: any[]) => Promise<any>
): Promise<ConnectionMetadata> {
  const res = await queryFn(
    "SELECT current_database(), current_user, coalesce(inet_server_addr()::text, 'socket') AS server_addr, coalesce(inet_server_port()::text, 'socket') AS server_port"
  );
  const row = res.rows[0] || {};
  return {
    currentDatabase: row.current_database || 'unknown',
    currentUser: row.current_user || 'unknown',
    serverAddr: row.server_addr || 'unknown',
    serverPort: row.server_port || 'unknown',
  };
}

export function parseConfirmDbArg(args: string[]): string | undefined {
  const prefix = '--confirm-db=';
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

export function validatePreflight(
  readMeta: ConnectionMetadata,
  adminMeta: ConnectionMetadata,
  isApply: boolean,
  confirmDbArg?: string
): void {
  if (readMeta.currentDatabase !== adminMeta.currentDatabase) {
    throw new Error(
      `Database mismatch: read query connects to '${readMeta.currentDatabase}', but admin query connects to '${adminMeta.currentDatabase}'. Aborting.`
    );
  }

  if (isApply) {
    if (!confirmDbArg) {
      throw new Error(
        '--apply requires explicit --confirm-db=<database_name> to prevent accidental writes. Aborting.'
      );
    }
    if (confirmDbArg !== readMeta.currentDatabase) {
      throw new Error(
        `--confirm-db='${confirmDbArg}' does not match connected database '${readMeta.currentDatabase}'. Aborting.`
      );
    }
  }
}

export async function runBackfill(argv: string[] = process.argv): Promise<void> {
  const isApply = argv.includes('--apply');
  const confirmDbArg = parseConfirmDbArg(argv);

  const readMeta = await fetchConnectionMetadata(query);
  const adminMeta = await fetchConnectionMetadata(adminQuery);

  console.log('--- Preflight Connection Information ---');
  console.log(
    `[read connection]  DB: ${readMeta.currentDatabase} | User: ${readMeta.currentUser} | Server: ${readMeta.serverAddr}:${readMeta.serverPort}`
  );
  console.log(
    `[admin connection] DB: ${adminMeta.currentDatabase} | User: ${adminMeta.currentUser} | Server: ${adminMeta.serverAddr}:${adminMeta.serverPort}`
  );
  console.log('----------------------------------------\n');

  validatePreflight(readMeta, adminMeta, isApply, confirmDbArg);

  console.log('=======================================================');
  console.log('Backfill EXIF Raw & Migration 058 Metadata');
  console.log(`Target database: ${readMeta.currentDatabase}`);
  console.log(`Mode: ${isApply ? 'APPLY (performing updates)' : 'DRY-RUN (read-only)'}`);
  console.log(`Batch size: ${PAGE_SIZE}`);
  console.log('=======================================================\n');

  let lastId = 0;
  let totalEvaluated = 0;
  let wouldUpdateCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let truncatedCount = 0;
  let totalPayloadBytes = 0;

  try {
    while (true) {
      // Keyset pagination: fetch IDs only, no large media_data blobs in page list
      const pageResult = await query(
        `SELECT id
         FROM app.network_media
         WHERE exif_raw IS NULL AND id > $1
         ORDER BY id ASC
         LIMIT $2`,
        [lastId, PAGE_SIZE]
      );

      if (pageResult.rows.length === 0) {
        break;
      }

      for (const item of pageResult.rows) {
        totalEvaluated++;
        const targetId = item.id;
        lastId = targetId;

        // Fetch single row's media_data buffer strictly one at a time
        const singleRowResult = await query(
          `SELECT id, media_data, exif_make, exif_model, exif_altitude, exif_bearing, exif_width, exif_height
           FROM app.network_media
           WHERE id = $1`,
          [targetId]
        );

        if (singleRowResult.rows.length === 0) {
          continue;
        }

        const row = singleRowResult.rows[0];
        let mediaBuffer: Buffer | null = row.media_data;

        if (!mediaBuffer || mediaBuffer.length === 0) {
          failedCount++;
          continue;
        }

        const { rawJson, typedExif } = await extractMetadataDumpFromBuffer(mediaBuffer);
        // Explicitly clear media buffer reference to ensure GC immediately releases memory
        mediaBuffer = null;
        row.media_data = null;

        if (!rawJson) {
          failedCount++;
          continue;
        }

        const payloadBytes = Buffer.byteLength(JSON.stringify(rawJson), 'utf8');
        totalPayloadBytes += payloadBytes;
        wouldUpdateCount++;

        if (rawJson.truncated) {
          truncatedCount++;
        }

        if (isApply) {
          await adminQuery(
            `UPDATE app.network_media
             SET exif_raw = $1,
                 exif_make = COALESCE(exif_make, $2),
                 exif_model = COALESCE(exif_model, $3),
                 exif_altitude = COALESCE(exif_altitude, $4),
                 exif_bearing = COALESCE(exif_bearing, $5),
                 exif_width = COALESCE(exif_width, $6),
                 exif_height = COALESCE(exif_height, $7)
             WHERE id = $8 AND exif_raw IS NULL`,
            [
              JSON.stringify(rawJson),
              typedExif.exifMake,
              typedExif.exifModel,
              typedExif.exifAltitude,
              typedExif.exifBearing,
              typedExif.exifWidth,
              typedExif.exifHeight,
              targetId,
            ]
          );
          updatedCount++;
        }
      }

      console.log(
        `Processed up to id ${lastId} (total evaluated: ${totalEvaluated}, ${
          isApply ? `updated: ${updatedCount}` : `would-update: ${wouldUpdateCount}`
        }, failed: ${failedCount}, truncated: ${truncatedCount})`
      );
    }

    console.log('\n=======================================================');
    console.log(`Backfill Summary (${isApply ? 'APPLY' : 'DRY-RUN'})`);
    console.log(`Total rows evaluated: ${totalEvaluated}`);
    console.log(
      `Rows ${isApply ? 'updated' : 'would update'}: ${isApply ? updatedCount : wouldUpdateCount}`
    );
    console.log(`Failed extractions: ${failedCount}`);
    console.log(`Truncated payloads (>512 KB): ${truncatedCount}`);
    console.log(
      `Total metadata payload: ${(totalPayloadBytes / 1024).toFixed(2)} KB (${totalPayloadBytes} bytes)`
    );
    console.log('=======================================================');
  } catch (error: any) {
    console.error('Backfill error:', error instanceof Error ? error.message : String(error));
    if (error && typeof error === 'object') {
      error.logged = true;
    }
    throw error;
  }
}

export async function main(
  argv: string[] = process.argv,
  exitFn: (code: number) => void = process.exit
): Promise<void> {
  try {
    await runBackfill(argv);
    exitFn(0);
  } catch (error: any) {
    if (!error?.logged) {
      console.error(`Backfill aborted: ${error instanceof Error ? error.message : String(error)}`);
    }
    exitFn(1);
  }
}

if (require.main === module) {
  main();
}
