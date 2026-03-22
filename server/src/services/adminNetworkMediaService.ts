export {};

const { adminQuery } = require('./adminDbService');
const { query } = require('../config/database');

// Network Media Methods
async function uploadNetworkMedia(
  bssid: string,
  mediaType: string,
  filename: string,
  fileSize: number,
  mimeType: string,
  mediaBuffer: Buffer,
  description: string
): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_media
      (bssid, media_type, filename, file_size, mime_type, media_data, description, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin')
     RETURNING id, filename, file_size, created_at`,
    [bssid, mediaType, filename, fileSize, mimeType, mediaBuffer, description]
  );
  return result.rows[0];
}

async function getNetworkMediaList(bssid: string): Promise<any[]> {
  const result = await query(
    `SELECT id, media_type, filename, original_filename, file_size, mime_type, description, uploaded_by, created_at
     FROM app.network_media WHERE bssid = $1 ORDER BY created_at DESC`,
    [bssid]
  );
  return result.rows;
}

async function getNetworkMediaFile(id: string): Promise<any | null> {
  const result = await query(
    'SELECT filename, mime_type, media_data FROM app.network_media WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Network Notes Methods
async function addNetworkNotation(bssid: string, text: string, type: string): Promise<any> {
  const result = await adminQuery('SELECT app.network_add_notation($1, $2, $3) as notation', [
    bssid,
    text,
    type,
  ]);
  return result.rows[0].notation;
}

async function getNetworkNotations(bssid: string): Promise<any[]> {
  const result = await query('SELECT detailed_notes FROM app.network_tags WHERE bssid = $1', [
    bssid,
  ]);
  return result.rows.length > 0 ? result.rows[0].detailed_notes || [] : [];
}

async function addNetworkNoteWithFunction(
  bssid: string,
  content: string,
  noteType: string,
  userId: string
): Promise<number> {
  const result = await adminQuery('SELECT app.network_add_note($1, $2, $3, $4) as note_id', [
    String(bssid).toUpperCase(),
    content,
    noteType,
    userId,
  ]);
  return result.rows[0].note_id;
}

async function getNetworkNotes(bssid: string): Promise<any[]> {
  const result = await query(
    `SELECT id, content, note_type, user_id, created_at, updated_at
     FROM app.network_notes
     WHERE UPPER(bssid) = UPPER($1) AND is_deleted IS NOT TRUE
     ORDER BY created_at DESC`,
    [bssid]
  );
  return result.rows;
}

async function deleteNetworkNote(noteId: string): Promise<string | null> {
  // Soft-delete: retain row for audit; is_deleted IS NOT TRUE guard prevents double-delete.
  const result = await adminQuery(
    `UPDATE app.network_notes
     SET is_deleted = TRUE, updated_at = NOW()
     WHERE id = $1 AND is_deleted IS NOT TRUE
     RETURNING bssid`,
    [noteId]
  );
  return result.rows.length > 0 ? result.rows[0].bssid : null;
}

async function updateNetworkNote(noteId: string, content: string): Promise<any | null> {
  const result = await adminQuery(
    `UPDATE app.network_notes
     SET content = $1, updated_at = NOW()
     WHERE id = $2 AND is_deleted IS NOT TRUE
     RETURNING id, bssid, content, updated_at`,
    [content, noteId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function addNoteMedia(
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
     RETURNING id, file_path, storage_backend`,
    [noteId, bssid, filePath, fileName, fileSize, mediaType, mediaData, mimeType, storageBackend]
  );
  return result.rows[0];
}

async function getNoteMediaById(mediaId: string): Promise<any | null> {
  const result = await query(
    `SELECT id, note_id, bssid, file_path, file_name, file_size, media_type, media_data, mime_type, storage_backend, created_at
     FROM app.note_media
     WHERE id = $1`,
    [mediaId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

module.exports = {
  uploadNetworkMedia,
  getNetworkMediaList,
  getNetworkMediaFile,
  addNetworkNotation,
  getNetworkNotations,
  addNetworkNoteWithFunction,
  getNetworkNotes,
  deleteNetworkNote,
  updateNetworkNote,
  addNoteMedia,
  getNoteMediaById,
};
