import { Pool } from 'pg';
import { ValidatedObservation } from './types';

export class ObservationLoader {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async insertBatch(records: ValidatedObservation[]): Promise<number> {
    if (records.length === 0) return 0;

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

    const query = `
      INSERT INTO app.observations (
        device_id, bssid, ssid, radio_type, radio_frequency, radio_capabilities,
        radio_service, radio_rcois, radio_lasttime_ms, level, lat, lon,
        altitude, accuracy, observed_at, observed_at_ms, external, mfgrid,
        source_tag, source_pk, time_ms, geom
      ) VALUES ${values.join(', ')}
    `;

    await this.pool.query(query, params);
    return records.length;
  }
}
