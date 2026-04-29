import { Pool } from 'pg';
import type { ValidatedObservation, BatchResult } from './types';

export async function insertBatch(
  pool: Pool,
  records: ValidatedObservation[],
  debug: boolean
): Promise<BatchResult> {
  if (records.length === 0) return { inserted: 0, failed: 0, errors: [] };

  const values: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const r of records) {
    values.push(
      `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, ` +
        `$${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 11}, $${idx + 12}, $${idx + 13}, ` +
        `$${idx + 14}, $${idx + 15}, $${idx + 16}, $${idx + 17}, $${idx + 18}, $${idx + 19}, $${idx + 20}, ` +
        `ST_SetSRID(ST_MakePoint($${idx + 12}, $${idx + 11}), 4326))`
    );

    params.push(
      r.device_id,
      r.bssid,
      r.ssid,
      r.radio_type,
      r.radio_frequency,
      r.radio_capabilities,
      r.radio_service,
      r.radio_rcois,
      r.radio_lasttime_ms,
      r.level,
      r.lat,
      r.lon,
      r.altitude,
      r.accuracy,
      r.time,
      r.observed_at_ms,
      r.external,
      r.mfgrid,
      r.source_tag,
      r.source_pk,
      r.time_ms
    );

    idx += 21;
  }

  const sql = `
    INSERT INTO app.observations (
      device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities,
      radio_service, radio_rcois, radio_lasttime_ms, level, lat, lon, altitude,
      accuracy, time, observed_at_ms, external, mfgrid, source_tag, source_pk, time_ms, geom
    )
    VALUES ${values.join(', ')}
    ON CONFLICT (device_id, source_pk, bssid, level, lat, lon, altitude, accuracy, observed_at_ms, external, mfgrid) DO NOTHING
  `;

  try {
    const result = await pool.query(sql, params);
    return { inserted: result.rowCount ?? 0, failed: 0, errors: [] };
  } catch (error) {
    const err = error as Error;
    if (debug) {
      console.warn(`   Batch insert failed, retrying row-by-row: ${err.message}`);
    }

    let inserted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        inserted += await insertSingleRecord(pool, record);
      } catch (rowError) {
        const rowErr = rowError as Error;
        failed++;
        errors.push(`Row insert error (${record.bssid}/${record.source_pk}): ${rowErr.message}`);
        if (debug) {
          console.error(
            `   Row insert failed for ${record.bssid}/${record.source_pk}: ${rowErr.message}`
          );
        }
      }
    }

    return { inserted, failed, errors };
  }
}

export async function insertSingleRecord(
  pool: Pool,
  record: ValidatedObservation
): Promise<number> {
  const sql = `
    INSERT INTO app.observations (
      device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities,
      radio_service, radio_rcois, radio_lasttime_ms, level, lat, lon, altitude,
      accuracy, time, observed_at_ms, external, mfgrid, source_tag, source_pk, time_ms, geom
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21,
      ST_SetSRID(ST_MakePoint($12, $11), 4326)
    )
    ON CONFLICT (device_id, source_pk, bssid, level, lat, lon, altitude, accuracy, observed_at_ms, external, mfgrid) DO NOTHING
  `;

  const result = await pool.query(sql, [
    record.device_id,
    record.bssid,
    record.ssid,
    record.radio_type,
    record.radio_frequency,
    record.radio_capabilities,
    record.radio_service,
    record.radio_rcois,
    record.radio_lasttime_ms,
    record.level,
    record.lat,
    record.lon,
    record.altitude,
    record.accuracy,
    record.time,
    record.observed_at_ms,
    record.external,
    record.mfgrid,
    record.source_tag,
    record.source_pk,
    record.time_ms,
  ]);

  return result.rowCount ?? 0;
}
