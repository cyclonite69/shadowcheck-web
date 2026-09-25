const { adminQuery } = require('../services/adminDbService');
const { query } = require('../config/database');

export interface RelatedNetworkMediaRow {
  id: number;
  requested_bssid: string;
  source_bssid: string;
  observation_id: number | null;
  media_type: string | null;
  filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: Date | string;
  exif_captured_at: Date | string | null;
  is_direct: boolean;
  source_kind: 'direct' | 'component';
}

export async function insertNetworkMedia(
  bssid: string,
  mediaType: string,
  filename: string,
  fileSize: number,
  mimeType: string,
  mediaBuffer: Buffer,
  description: string,
  exifLat: number | null = null,
  exifLon: number | null = null,
  exifCapturedAt: string | null = null,
  thumbnail: Buffer | null = null,
  observationId: number | string | null = null
): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_media
      (bssid, media_type, filename, file_size, mime_type, media_data, description, uploaded_by, exif_lat, exif_lon, exif_captured_at, thumbnail, observation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin', $8, $9, $10, $11, $12)
     RETURNING id, filename, file_size, created_at`,
    [
      bssid,
      mediaType,
      filename,
      fileSize,
      mimeType,
      mediaBuffer,
      description,
      exifLat,
      exifLon,
      exifCapturedAt,
      thumbnail,
      observationId ? parseInt(String(observationId), 10) : null,
    ]
  );
  return result.rows[0];
}

export async function selectNetworkMediaList(bssid: string): Promise<any[]> {
  const result = await query(
    `SELECT id, media_type, filename, original_filename, file_size, mime_type, description, uploaded_by, created_at
     FROM app.network_media WHERE bssid = $1 ORDER BY created_at DESC`,
    [bssid]
  );
  return result.rows;
}

export async function selectNetworkMediaFile(id: string): Promise<any | null> {
  const result = await query(
    'SELECT filename, mime_type, media_data, thumbnail FROM app.network_media WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Select only mime_type and thumbnail columns for a media record to avoid transferring the large media_data blob.
 *
 * @param {string} id Media record ID
 * @returns {Promise<any | null>} Object with mime_type and thumbnail bytes, or null
 */
export async function selectNetworkMediaThumbnail(id: string): Promise<any | null> {
  const result = await query('SELECT mime_type, thumbnail FROM app.network_media WHERE id = $1', [
    id,
  ]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Returns direct and component-surfaced media for a given BSSID.
 *
 * Direct media: records in app.network_media owned by the exact BSSID.
 * Component media: records surfaced from app.v_sibling_group_media where
 *   member_bssid matches and record_type = 'media' (excludes notes).
 *
 * If app.v_sibling_group_media does not exist (pre-migration), returns
 * direct media only. De-duplicates by media ID, direct rows win.
 *
 * @param {string} bssid The requested BSSID (case-insensitive)
 * @returns {Promise<any[]>} Media rows with provenance fields
 */
export async function selectRelatedNetworkMediaForBssid(
  bssid: string
): Promise<RelatedNetworkMediaRow[]> {
  const upperBssid = bssid.toUpperCase();

  // Guard: check whether v_sibling_group_media exists before referencing it
  const viewCheck = await query("SELECT to_regclass('app.v_sibling_group_media') AS oid", []);
  const viewExists = viewCheck.rows[0]?.oid !== null && viewCheck.rows[0]?.oid !== undefined;

  const directSql = `
    SELECT
      nm.id,
      $1::text            AS requested_bssid,
      nm.bssid            AS source_bssid,
      nm.observation_id,
      nm.media_type,
      nm.filename,
      nm.mime_type,
      nm.file_size,
      nm.created_at,
      nm.exif_captured_at,
      true                AS is_direct,
      'direct'::text      AS source_kind
    FROM app.network_media nm
    WHERE UPPER(nm.bssid) = $1
      AND nm.bssid != 'VISINT_UNMATCHED'
  `;

  if (!viewExists) {
    const result = await query(directSql, [upperBssid]);
    return result.rows;
  }

  const result = await query(
    `WITH direct_media AS (${directSql}),
    component_media AS (
      SELECT
        sgm.id,
        $1::text            AS requested_bssid,
        sgm.source_bssid,
        sgm.observation_id,
        sgm.media_type,
        sgm.filename,
        sgm.mime_type,
        sgm.file_size,
        sgm.created_at,
        sgm.exif_captured_at,
        (UPPER(sgm.source_bssid) = $1) AS is_direct,
        'component'::text   AS source_kind
      FROM app.v_sibling_group_media sgm
      WHERE UPPER(sgm.member_bssid) = $1
        AND sgm.record_type = 'media'
        AND sgm.source_bssid != 'VISINT_UNMATCHED'
    ),
    combined AS (
      SELECT * FROM direct_media
      UNION ALL
      SELECT * FROM component_media
    ),
    ranked AS (
      SELECT *,
        row_number() OVER (
          PARTITION BY id
          ORDER BY is_direct DESC
        ) AS rn
      FROM combined
    )
    SELECT id, requested_bssid, source_bssid, observation_id,
           media_type, filename, mime_type, file_size,
           created_at, exif_captured_at, is_direct, source_kind
    FROM ranked
    WHERE rn = 1
    ORDER BY is_direct DESC, created_at DESC`,
    [upperBssid]
  );
  return result.rows;
}

export async function selectUnmatchedMediaPoints(): Promise<any[]> {
  const result = await query(
    `SELECT id::text AS id, bssid, filename, exif_lat, exif_lon, exif_captured_at
     FROM app.network_media
     WHERE bssid = 'VISINT_UNMATCHED'
       AND exif_lat IS NOT NULL
       AND exif_lon IS NOT NULL
     ORDER BY exif_captured_at DESC, id DESC`
  );
  return result.rows;
}

export async function selectMatchedMediaPoints(): Promise<any[]> {
  const viewCheck = await query("SELECT to_regclass('app.mv_sibling_groups') AS oid", []);
  const hasSiblingGroups = viewCheck.rows[0]?.oid !== null && viewCheck.rows[0]?.oid !== undefined;

  let sql;
  if (hasSiblingGroups) {
    sql = `
      WITH component_media_resolved AS (
        SELECT
          COALESCE(sg.group_id, nm.bssid) AS component_id,
          nm.id AS media_id,
          nm.bssid AS member_bssid,
          nm.observation_id,
          nm.exif_lat,
          nm.exif_lon,
          o.lat AS observation_lat,
          o.lon AS observation_lon,
          ne.lat AS network_lat,
          ne.lon AS network_lon,
          -- Coordinate priority resolution (pair-safe CASE)
          CASE
            WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN o.lat
            WHEN nm.exif_lat IS NOT NULL AND nm.exif_lon IS NOT NULL THEN nm.exif_lat
            ELSE ne.lat
          END AS resolved_lat,
          CASE
            WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN o.lon
            WHEN nm.exif_lat IS NOT NULL AND nm.exif_lon IS NOT NULL THEN nm.exif_lon
            ELSE ne.lon
          END AS resolved_lon,
          -- Coordinate source indicator
          CASE
            WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN 'observation'
            WHEN nm.exif_lat IS NOT NULL AND nm.exif_lon IS NOT NULL THEN 'exif'
            ELSE 'network'
          END AS marker_location_source,
          -- Priority rank (1 = observation, 2 = exif, 3 = network)
          CASE
            WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN 1
            WHEN nm.exif_lat IS NOT NULL AND nm.exif_lon IS NOT NULL THEN 2
            ELSE 3
          END AS priority_score
        FROM app.network_media nm
        LEFT JOIN app.mv_sibling_groups sg ON UPPER(sg.bssid) = UPPER(nm.bssid)
        LEFT JOIN app.observations o ON o.id = nm.observation_id
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(nm.bssid)
        WHERE nm.bssid != 'VISINT_UNMATCHED'
      ),
      ranked_components AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY component_id
            ORDER BY priority_score ASC, media_id ASC
          ) AS rn
        FROM component_media_resolved
        WHERE resolved_lat IS NOT NULL AND resolved_lon IS NOT NULL
      ),
      component_aggregates AS (
        SELECT
          component_id,
          COUNT(DISTINCT media_id)::integer AS media_count,
          array_agg(DISTINCT media_id::text) AS media_ids,
          array_agg(DISTINCT member_bssid) AS member_bssids
        FROM component_media_resolved
        GROUP BY component_id
      )
      SELECT
        rc.component_id,
        rc.resolved_lat::numeric(10,8) AS lat,
        rc.resolved_lon::numeric(11,8) AS lon,
        ca.media_count,
        ca.media_ids,
        ca.member_bssids,
        'component_location'::text AS location_provenance,
        rc.marker_location_source,
        rc.observation_id,
        rc.exif_lat::numeric(10,8) AS capture_lat,
        rc.exif_lon::numeric(11,8) AS capture_lon,
        rc.observation_lat::numeric(10,8) AS observation_lat,
        rc.observation_lon::numeric(11,8) AS observation_lon,
        rc.network_lat::numeric(10,8) AS network_lat,
        rc.network_lon::numeric(11,8) AS network_lon
      FROM ranked_components rc
      JOIN component_aggregates ca ON ca.component_id = rc.component_id
      WHERE rc.rn = 1
    `;
  } else {
    sql = `
      WITH component_media_resolved AS (
        SELECT
          nm.bssid AS component_id,
          nm.id AS media_id,
          nm.bssid AS member_bssid,
          nm.observation_id,
          nm.exif_lat,
          nm.exif_lon,
          o.lat AS observation_lat,
          o.lon AS observation_lon,
          ne.lat AS network_lat,
          ne.lon AS network_lon,
          -- Coordinate priority resolution (pair-safe CASE)
          CASE
            WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN o.lat
            WHEN nm.exif_lat IS NOT NULL AND nm.exif_lon IS NOT NULL THEN nm.exif_lat
            ELSE ne.lat
          END AS resolved_lat,
          CASE
            WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN o.lon
            WHEN nm.exif_lat IS NOT NULL AND nm.exif_lon IS NOT NULL THEN nm.exif_lon
            ELSE ne.lon
          END AS resolved_lon,
          -- Coordinate source indicator
          CASE
            WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN 'observation'
            WHEN nm.exif_lat IS NOT NULL AND nm.exif_lon IS NOT NULL THEN 'exif'
            ELSE 'network'
          END AS marker_location_source,
          -- Priority rank (1 = observation, 2 = exif, 3 = network)
          CASE
            WHEN o.lat IS NOT NULL AND o.lon IS NOT NULL THEN 1
            WHEN nm.exif_lat IS NOT NULL AND nm.exif_lon IS NOT NULL THEN 2
            ELSE 3
          END AS priority_score
        FROM app.network_media nm
        LEFT JOIN app.observations o ON o.id = nm.observation_id
        LEFT JOIN app.api_network_explorer_mv ne ON UPPER(ne.bssid) = UPPER(nm.bssid)
        WHERE nm.bssid != 'VISINT_UNMATCHED'
      ),
      ranked_components AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY component_id
            ORDER BY priority_score ASC, media_id ASC
          ) AS rn
        FROM component_media_resolved
        WHERE resolved_lat IS NOT NULL AND resolved_lon IS NOT NULL
      ),
      component_aggregates AS (
        SELECT
          component_id,
          COUNT(DISTINCT media_id)::integer AS media_count,
          array_agg(DISTINCT media_id::text) AS media_ids,
          array_agg(DISTINCT member_bssid) AS member_bssids
        FROM component_media_resolved
        GROUP BY component_id
      )
      SELECT
        rc.component_id,
        rc.resolved_lat::numeric(10,8) AS lat,
        rc.resolved_lon::numeric(11,8) AS lon,
        ca.media_count,
        ca.media_ids,
        ca.member_bssids,
        'linked_network_location'::text AS location_provenance,
        rc.marker_location_source,
        rc.observation_id,
        rc.exif_lat::numeric(10,8) AS capture_lat,
        rc.exif_lon::numeric(11,8) AS capture_lon,
        rc.observation_lat::numeric(10,8) AS observation_lat,
        rc.observation_lon::numeric(11,8) AS observation_lon,
        rc.network_lat::numeric(10,8) AS network_lat,
        rc.network_lon::numeric(11,8) AS network_lon
      FROM ranked_components rc
      JOIN component_aggregates ca ON ca.component_id = rc.component_id
      WHERE rc.rn = 1
    `;
  }

  const result = await query(sql);
  return result.rows;
}

export async function insertNetworkNotation(
  bssid: string,
  text: string,
  type: string
): Promise<any> {
  const result = await adminQuery('SELECT app.network_add_notation($1, $2, $3) as notation', [
    bssid,
    text,
    type,
  ]);
  return result.rows[0].notation;
}

export async function selectNetworkNotations(bssid: string): Promise<any[]> {
  const result = await query('SELECT detailed_notes FROM app.network_tags WHERE bssid = $1', [
    bssid,
  ]);
  return result.rows.length > 0 ? result.rows[0].detailed_notes || [] : [];
}

export async function insertNetworkNote(
  bssid: string,
  content: string,
  noteType: string,
  userId: string
): Promise<number> {
  const normalizedBssid = String(bssid).toUpperCase();
  const result = await adminQuery(
    `WITH latest AS (
       SELECT id
       FROM app.network_notes
       WHERE UPPER(bssid) = UPPER($1)
         AND is_deleted IS NOT TRUE
       ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
       LIMIT 1
     ), updated AS (
       UPDATE app.network_notes nn
       SET content = $2,
           note_type = $3,
           user_id = $4,
           updated_at = NOW()
       FROM latest
       WHERE nn.id = latest.id
       RETURNING nn.id
     ), inserted AS (
       INSERT INTO app.network_notes (bssid, user_id, content, note_type)
       SELECT $1, $4, $2, $3
       WHERE NOT EXISTS (SELECT 1 FROM updated)
       RETURNING id
     )
     SELECT id AS note_id FROM updated
     UNION ALL
     SELECT id AS note_id FROM inserted`,
    [normalizedBssid, content, noteType, userId]
  );
  return result.rows[0].note_id;
}

export async function selectNetworkNotes(bssid: string): Promise<any[]> {
  const result = await query(
    `SELECT
       nn.id,
       nn.content,
       nn.note_type,
       nn.user_id,
       nn.created_at,
       nn.updated_at,
       COALESCE(nm.attachment_count, 0) AS attachment_count,
       COALESCE(nm.image_count, 0) AS image_count
     FROM app.network_notes nn
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::integer AS attachment_count,
         COUNT(*) FILTER (WHERE media_type = 'image')::integer AS image_count
       FROM app.note_media
       WHERE note_id = nn.id
     ) nm ON TRUE
     WHERE UPPER(nn.bssid) = UPPER($1) AND nn.is_deleted IS NOT TRUE
     ORDER BY nn.created_at DESC`,
    [bssid]
  );
  return result.rows;
}

export async function softDeleteNetworkNote(noteId: string): Promise<string | null> {
  const result = await adminQuery(
    `UPDATE app.network_notes
     SET is_deleted = TRUE, updated_at = NOW()
     WHERE id = $1 AND is_deleted IS NOT TRUE
     RETURNING bssid`,
    [noteId]
  );
  return result.rows.length > 0 ? result.rows[0].bssid : null;
}

export async function updateNetworkNoteContent(
  noteId: string,
  content: string
): Promise<any | null> {
  const result = await adminQuery(
    `UPDATE app.network_notes
     SET content = $1, updated_at = NOW()
     WHERE id = $2 AND is_deleted IS NOT TRUE
     RETURNING id, bssid, content, updated_at`,
    [content, noteId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function selectNetworkNoteById(noteId: string): Promise<any | null> {
  const result = await query(
    `SELECT id, bssid, content, note_type, user_id, created_at, updated_at
     FROM app.network_notes
     WHERE id = $1 AND is_deleted IS NOT TRUE`,
    [noteId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function insertNoteMedia(
  noteId: string,
  bssid: string,
  filePath: string | null,
  fileName: string,
  fileSize: number,
  mediaType: string,
  mediaData: Buffer | null = null,
  mimeType: string | null = null,
  storageBackend: string = 'db'
): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.note_media
      (note_id, bssid, file_path, file_name, file_size, media_type, media_data, mime_type, storage_backend)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, note_id, bssid, file_path, file_name, file_size, media_type, mime_type, storage_backend, created_at`,
    [noteId, bssid, filePath, fileName, fileSize, mediaType, mediaData, mimeType, storageBackend]
  );
  return result.rows[0];
}

export async function selectNoteMediaById(mediaId: string): Promise<any | null> {
  const result = await query(
    `SELECT id, note_id, bssid, file_path, file_name, file_size, media_type, media_data, mime_type, storage_backend, created_at
     FROM app.note_media
     WHERE id = $1`,
    [mediaId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function selectNoteMediaList(noteId: string): Promise<any[]> {
  const result = await query(
    `SELECT id, note_id, bssid, file_path, file_name, file_size, media_type, mime_type, storage_backend, created_at
     FROM app.note_media
     WHERE note_id = $1
     ORDER BY created_at DESC, id DESC`,
    [noteId]
  );
  return result.rows;
}

export async function deleteNoteMedia(mediaId: string): Promise<any | null> {
  const result = await adminQuery(
    `WITH deleted AS (
       DELETE FROM app.note_media
       WHERE id = $1
       RETURNING id, note_id, bssid, file_name, file_path
     )
     SELECT * FROM deleted`,
    [mediaId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}
