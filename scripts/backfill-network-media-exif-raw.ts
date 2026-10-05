#!/usr/bin/env tsx
import './loadEnv';
import { query } from '../server/src/config/database';
const { adminQuery } = require('../server/src/services/adminDbService');
import { extractMetadataDumpFromBuffer } from '../server/src/services/visint/visintMetadataDump';

const PAGE_SIZE = 50;

async function runBackfill(): Promise<void> {
  const isApply = process.argv.includes('--apply');

  console.log('=======================================================');
  console.log('Backfill EXIF Raw & Migration 058 Metadata');
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
  } catch (error) {
    console.error('Backfill error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  runBackfill();
}
