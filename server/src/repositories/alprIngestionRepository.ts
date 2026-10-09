import { adminQuery } from '../services/adminDbService';

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

/**
 * Read existing ALPR camera values before an import batch so an applied run can be rolled back.
 */
export async function getExistingAlprCameras(osmIds: string[]): Promise<ExistingCameraSnapshot[]> {
  const result = await adminQuery(
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
  return result.rows as ExistingCameraSnapshot[];
}

/**
 * Upsert one bounded camera batch and report IDs newly inserted by this statement.
 */
export async function upsertAlprCameras(
  records: AlprImportRecord[],
  runStartedAt: Date
): Promise<{ insertedIds: string[]; updated: number }> {
  if (records.length === 0) {
    return { insertedIds: [], updated: 0 };
  }

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
      RETURNING osm_id::text, (xmax = 0) AS inserted;
    `,
    [
      records.map((record) => record.osmId),
      records.map((record) => record.lon),
      records.map((record) => record.lat),
      records.map((record) => JSON.stringify(record.sourceProperties)),
      runStartedAt.toISOString(),
    ]
  );
  const insertedIds = result.rows
    .filter((row: { inserted: boolean }) => row.inserted)
    .map((row: { osm_id: string }) => row.osm_id);
  return { insertedIds, updated: result.rows.length - insertedIds.length };
}

/**
 * Refresh table statistics after a completed national import.
 */
export async function vacuumAnalyzeAlprCameras(): Promise<void> {
  await adminQuery('VACUUM ANALYZE app.alpr_cameras');
}

/**
 * Restore a prior camera batch captured by getExistingAlprCameras.
 */
export async function restoreAlprCameras(records: ExistingCameraSnapshot[]): Promise<void> {
  if (records.length === 0) {
    return;
  }
  await adminQuery(
    `
      INSERT INTO app.alpr_cameras (osm_id, geom, source_properties, last_seen)
      SELECT
        t.osm_id,
        ST_SetSRID(ST_GeomFromText(t.geom_wkt), 4326),
        t.source_properties,
        t.last_seen::timestamptz
      FROM UNNEST($1::bigint[], $2::text[], $3::jsonb[], $4::text[])
        AS t(osm_id, geom_wkt, source_properties, last_seen)
      ON CONFLICT (osm_id) DO UPDATE SET
        geom = EXCLUDED.geom,
        source_properties = EXCLUDED.source_properties,
        last_seen = EXCLUDED.last_seen;
    `,
    [
      records.map((record) => record.osm_id),
      records.map((record) => record.geom_wkt),
      records.map((record) => JSON.stringify(record.source_properties)),
      records.map((record) => record.last_seen),
    ]
  );
}

/**
 * Remove IDs recorded as new by an import batch during rollback.
 */
export async function deleteInsertedAlprCameras(osmIds: string[]): Promise<void> {
  if (osmIds.length === 0) {
    return;
  }
  await adminQuery('DELETE FROM app.alpr_cameras WHERE osm_id = ANY($1::bigint[])', [osmIds]);
}
