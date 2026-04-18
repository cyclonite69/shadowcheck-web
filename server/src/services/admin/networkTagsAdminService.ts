/**
 * Network Tags Admin Service
 * Administrative operations for network tagging
 */

const adminQuery = (text: string, params: any[] = []) =>
  require('../../config/container').adminDbService.adminQuery(text, params);

export async function upsertNetworkTag(
  bssid: string,
  threatTag: string | null,
  isIgnored: boolean | null,
  notes: string | null
): Promise<any> {
  const existing = await adminQuery('SELECT bssid FROM app.network_tags WHERE bssid = $1', [bssid]);

  if (existing.rows.length > 0) {
    if (threatTag !== null) await updateNetworkThreatTag(bssid, threatTag);
    if (isIgnored !== null) await updateNetworkTagIgnore(bssid, isIgnored);
    if (notes !== null) await updateNetworkTagNotes(bssid, notes);
    return { bssid, updated: true };
  } else {
    if (threatTag !== null) await insertNetworkThreatTag(bssid, threatTag);
    if (isIgnored !== null) await insertNetworkTagIgnore(bssid, isIgnored);
    if (notes !== null) await insertNetworkTagNotes(bssid, notes);
    return { bssid, inserted: true };
  }
}

export async function updateNetworkTagIgnore(bssid: string, isIgnored: boolean): Promise<any> {
  const { rows } = await adminQuery(
    'UPDATE app.network_tags SET is_ignored = $1, updated_at = NOW() WHERE bssid = $2 RETURNING *',
    [isIgnored, bssid]
  );
  return rows[0];
}

export async function insertNetworkTagIgnore(bssid: string, isIgnored: boolean): Promise<any> {
  const { rows } = await adminQuery(
    'INSERT INTO app.network_tags (bssid, is_ignored) VALUES ($1, $2) RETURNING *',
    [bssid, isIgnored]
  );
  return rows[0];
}

export async function updateNetworkThreatTag(bssid: string, threatTag: string): Promise<any> {
  const { rows } = await adminQuery(
    'UPDATE app.network_tags SET threat_tag = $1, updated_at = NOW() WHERE bssid = $2 RETURNING *',
    [threatTag, bssid]
  );
  return rows[0];
}

export async function insertNetworkThreatTag(bssid: string, threatTag: string): Promise<any> {
  const { rows } = await adminQuery(
    'INSERT INTO app.network_tags (bssid, threat_tag) VALUES ($1, $2) RETURNING *',
    [bssid, threatTag]
  );
  return rows[0];
}

export async function updateNetworkTagNotes(bssid: string, notes: string): Promise<any> {
  const { rows } = await adminQuery(
    'UPDATE app.network_tags SET notes = $1, updated_at = NOW() WHERE bssid = $2 RETURNING *',
    [notes, bssid]
  );
  return rows[0];
}

export async function insertNetworkTagNotes(bssid: string, notes: string): Promise<any> {
  const { rows } = await adminQuery(
    'INSERT INTO app.network_tags (bssid, notes) VALUES ($1, $2) RETURNING *',
    [bssid, notes]
  );
  return rows[0];
}

export async function deleteNetworkTag(bssid: string): Promise<number> {
  const { rowCount } = await adminQuery('DELETE FROM app.network_tags WHERE bssid = $1', [bssid]);
  return rowCount;
}

module.exports = {
  upsertNetworkTag,
  updateNetworkTagIgnore,
  insertNetworkTagIgnore,
  updateNetworkThreatTag,
  insertNetworkThreatTag,
  updateNetworkTagNotes,
  insertNetworkTagNotes,
  deleteNetworkTag,
};
