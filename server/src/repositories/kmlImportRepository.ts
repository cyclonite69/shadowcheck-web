import { query } from '../config/database';

export interface KmlImportStatusRow {
  id: number;
  source_file: string;
  source_name: string | null;
  source_type: string | null;
  file_hash: string | null;
  hash_prefix: string | null;
  placemark_count: number;
  point_count: number;
  imported_at: string;
}

export interface KmlImportStatusResponse {
  files: KmlImportStatusRow[];
  totals: {
    file_count: number;
    point_count: number;
    wigle_file_count: number;
    latest_imported_at: string | null;
  };
}

export interface KmlHashMatch {
  id: number;
  source_file: string;
  file_hash: string;
  imported_at: string;
}

function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function normalizeLimit(rawLimit: unknown): number {
  const parsed = Number.parseInt(String(rawLimit ?? '500'), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 500;
  }
  return Math.min(parsed, 1000);
}

/**
 * Lists locally imported KML files with per-file point counts and aggregate totals.
 * Uses only existing staging tables: app.kml_files and app.kml_points.
 */
async function listKmlImportStatus(rawLimit: unknown = 500): Promise<KmlImportStatusResponse> {
  const limit = normalizeLimit(rawLimit);
  const [filesResult, totalsResult] = await Promise.all([
    query(
      `SELECT
         kf.id,
         kf.source_file,
         kf.source_name,
         kf.source_type,
         kf.file_hash,
         CASE WHEN kf.file_hash IS NULL THEN NULL ELSE LEFT(kf.file_hash, 12) END AS hash_prefix,
         kf.placemark_count,
         COALESCE(pc.point_count, 0)::integer AS point_count,
         kf.imported_at
       FROM app.kml_files kf
       LEFT JOIN (
         SELECT kml_file_id, COUNT(*)::integer AS point_count
         FROM app.kml_points
         GROUP BY kml_file_id
       ) pc ON pc.kml_file_id = kf.id
       ORDER BY kf.imported_at DESC, kf.id DESC
       LIMIT $1`,
      [limit]
    ),
    query(
      `SELECT
         (SELECT COUNT(*)::integer FROM app.kml_files) AS file_count,
         (SELECT COUNT(*)::integer FROM app.kml_points) AS point_count,
         (SELECT COUNT(*)::integer FROM app.kml_files WHERE source_type = 'wigle') AS wigle_file_count,
         (SELECT MAX(imported_at) FROM app.kml_files) AS latest_imported_at`
    ),
  ]);

  const totals = totalsResult.rows[0] ?? {};

  return {
    files: filesResult.rows.map((row: any) => ({
      id: Number(row.id),
      source_file: row.source_file,
      source_name: row.source_name ?? null,
      source_type: row.source_type ?? null,
      file_hash: row.file_hash ?? null,
      hash_prefix: row.hash_prefix ?? null,
      placemark_count: Number(row.placemark_count ?? 0),
      point_count: Number(row.point_count ?? 0),
      imported_at: toIsoString(row.imported_at) ?? '',
    })),
    totals: {
      file_count: Number(totals.file_count ?? 0),
      point_count: Number(totals.point_count ?? 0),
      wigle_file_count: Number(totals.wigle_file_count ?? 0),
      latest_imported_at: toIsoString(totals.latest_imported_at),
    },
  };
}

/**
 * Finds existing KML files by SHA-256 hash so upload routes can skip duplicates
 * before invoking the KML parser/importer.
 */
async function findKmlFilesByHashes(hashes: string[]): Promise<KmlHashMatch[]> {
  const uniqueHashes = Array.from(new Set(hashes.filter(Boolean)));
  if (uniqueHashes.length === 0) {
    return [];
  }

  const result = await query(
    `SELECT id, source_file, file_hash, imported_at
     FROM app.kml_files
     WHERE file_hash = ANY($1::text[])`,
    [uniqueHashes]
  );

  return result.rows.map((row: any) => ({
    id: Number(row.id),
    source_file: row.source_file,
    file_hash: row.file_hash,
    imported_at: toIsoString(row.imported_at) ?? '',
  }));
}

module.exports = {
  listKmlImportStatus,
  findKmlFilesByHashes,
};

export { listKmlImportStatus, findKmlFilesByHashes, normalizeLimit };
