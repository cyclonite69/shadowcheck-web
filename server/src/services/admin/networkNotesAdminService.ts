/**
 * Network Notes Admin Service
 * Administrative operations for network notes and media
 */

const adminQuery = (text: string, params: any[]) =>
  require('../../config/container').adminDbService.adminQuery(text, params);
const query = (text: string, params: unknown[]) =>
  require('../../config/container').databaseService.query(text, params);
const { validators } = require('../../utils/validators');

export async function addNetworkNote(bssid: string, content: string): Promise<number> {
  const cleanBssid = validators.bssid(bssid);
  if (!cleanBssid) {
    throw new Error(`Invalid BSSID: ${bssid}`);
  }

  const { rows } = await adminQuery(
    'INSERT INTO app.network_notes (bssid, content) VALUES ($1, $2) RETURNING id',
    [cleanBssid, content]
  );
  return rows[0].id;
}

export async function getNetworkNotes(bssid: string): Promise<any[]> {
  const cleanBssid = validators.bssid(bssid);
  if (!cleanBssid) return [];

  const { rows } = await query(
    'SELECT id, bssid, content, created_at FROM app.network_notes WHERE bssid = $1 ORDER BY created_at DESC',
    [cleanBssid]
  );
  return rows;
}

export async function deleteNetworkNote(noteId: string): Promise<string | null> {
  const { rows } = await adminQuery('DELETE FROM app.network_notes WHERE id = $1 RETURNING bssid', [
    noteId,
  ]);
  return rows.length > 0 ? rows[0].bssid : null;
}

export async function uploadNetworkMedia(
  bssid: string,
  filename: string,
  mimeType: string,
  data: Buffer
): Promise<any> {
  const cleanBssid = validators.bssid(bssid);
  if (!cleanBssid) {
    throw new Error(`Invalid BSSID: ${bssid}`);
  }

  // Basic MIME-type validation based on magic numbers
  const isSafe = verifyMimeType(data, mimeType);
  if (!isSafe) {
    throw new Error(`MIME-type mismatch or unsupported file content: ${mimeType}`);
  }

  const { rows } = await adminQuery(
    'INSERT INTO app.network_media (bssid, filename, mime_type, data) VALUES ($1, $2, $3, $4) RETURNING id, filename, mime_type, created_at',
    [cleanBssid, filename, mimeType, data]
  );
  return rows[0];
}

function verifyMimeType(data: Buffer, mimeType: string): boolean {
  if (!data || data.length < 4) return false;

  const signatures: { [key: string]: number[] } = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
  };

  const signature = signatures[mimeType];
  if (!signature) {
    // If not in our list, allow but be cautious (in production we might want a stricter allowlist)
    return true;
  }

  return signature.every((byte, i) => data[i] === byte);
}

export async function getNetworkMediaList(bssid: string): Promise<any[]> {
  const { rows } = await query(
    'SELECT id, bssid, filename, mime_type, created_at FROM app.network_media WHERE bssid = $1 ORDER BY created_at DESC',
    [bssid]
  );
  return rows;
}

export async function getNetworkMediaFile(id: string): Promise<any | null> {
  const { rows } = await query(
    'SELECT id, bssid, filename, mime_type, data, created_at FROM app.network_media WHERE id = $1',
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function addNetworkNotation(bssid: string, text: string, type: string): Promise<any> {
  const { rows } = await adminQuery(
    'INSERT INTO app.network_notations (bssid, text, type) VALUES ($1, $2, $3) RETURNING *',
    [bssid, text, type]
  );
  return rows[0];
}

export async function getNetworkNotations(bssid: string): Promise<any[]> {
  const { rows } = await query(
    'SELECT id, bssid, text, type, created_at FROM app.network_notations WHERE bssid = $1 ORDER BY created_at DESC',
    [bssid]
  );
  return rows;
}

module.exports = {
  addNetworkNote,
  getNetworkNotes,
  deleteNetworkNote,
  uploadNetworkMedia,
  getNetworkMediaList,
  getNetworkMediaFile,
  addNetworkNotation,
  getNetworkNotations,
};
