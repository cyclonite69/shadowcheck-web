const { adminQuery } = require('../services/adminDbService');
const { query } = require('../config/database');

export async function getOUIGroups(): Promise<any[]> {
  const result = await query(`
    SELECT oui, device_count, collective_threat_score, threat_level, primary_bssid,
           secondary_bssids, has_randomization, randomization_confidence, last_updated
    FROM app.oui_device_groups
    WHERE device_count > 1
    ORDER BY collective_threat_score DESC
  `);
  return result.rows;
}

export async function getOUIGroupDetails(
  oui: string
): Promise<{ group: any; randomization: any; networks: any[] }> {
  const [group, randomization, networks] = await Promise.all([
    query('SELECT * FROM app.oui_device_groups WHERE oui = $1', [oui]),
    query('SELECT * FROM app.mac_randomization_suspects WHERE oui = $1', [oui]),
    query(
      `
      SELECT n.bssid, nts.final_threat_score, nts.final_threat_level, n.ssid,
             COUNT(obs.id) as observation_count
      FROM app.networks n
      LEFT JOIN app.network_threat_scores nts ON n.bssid = nts.bssid
      LEFT JOIN app.observations obs ON n.bssid = obs.bssid
      WHERE SUBSTRING(n.bssid, 1, 8) = $1
      GROUP BY n.bssid, nts.final_threat_score, nts.final_threat_level, n.ssid
      ORDER BY nts.final_threat_score DESC
    `,
      [oui]
    ),
  ]);
  return { group: group.rows[0], randomization: randomization.rows[0], networks: networks.rows };
}

export async function getMACRandomizationSuspects(): Promise<any[]> {
  const result = await query(`
    SELECT oui, status, confidence_score, avg_distance_km, movement_speed_kmh,
           array_length(mac_sequence, 1) as mac_count, created_at
    FROM app.mac_randomization_suspects
    ORDER BY confidence_score DESC
  `);
  return result.rows;
}

export async function insertNetworkTagWithNotes(
  bssid: string,
  tags: string[],
  notes: string | null
): Promise<void> {
  await adminQuery(
    `INSERT INTO app.network_tags (bssid, tags, notes, created_by)
     VALUES ($1, $2::jsonb, $3, 'admin')`,
    [bssid, JSON.stringify(tags), notes]
  );
}

export async function removeTagFromNetwork(bssid: string, tag: string): Promise<void> {
  await adminQuery(
    `UPDATE app.network_tags
     SET tags = app.network_remove_tag(tags, $2), updated_at = NOW()
     WHERE bssid = $1`,
    [bssid, tag]
  );
}

export async function addTagToNetwork(
  bssid: string,
  tag: string,
  notes: string | null
): Promise<void> {
  await adminQuery(
    `UPDATE app.network_tags
     SET tags = app.network_add_tag(tags, $2), notes = COALESCE($3, notes), updated_at = NOW()
     WHERE bssid = $1`,
    [bssid, tag, notes]
  );
}

export async function getNetworkTagsByBssid(bssid: string): Promise<any | null> {
  const result = await query('SELECT tags FROM app.network_tags WHERE bssid = $1', [bssid]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getNetworkTagsAndNotes(bssid: string): Promise<any | null> {
  const result = await query('SELECT bssid, tags, notes FROM app.network_tags WHERE bssid = $1', [
    bssid,
  ]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function getAllNetworkTags(): Promise<any[]> {
  const result = await query(
    `SELECT bssid, tags, notes, created_at, updated_at FROM app.network_tags
     WHERE tags IS NOT NULL AND array_length(tags, 1) > 0 ORDER BY updated_at DESC`
  );
  return result.rows;
}

export async function searchNetworksByTag(tag: string): Promise<any[]> {
  const result = await query(
    `SELECT nt.bssid, nt.tags, nt.notes, n.ssid, n.type, n.bestlevel as signal
     FROM app.network_tags nt
     LEFT JOIN app.networks n ON nt.bssid = n.bssid
     WHERE $1 = ANY(nt.tags) ORDER BY nt.updated_at DESC`,
    [tag]
  );
  return result.rows;
}

export async function getNetworkTagsExpanded(bssid: string): Promise<any | null> {
  const result = await query(
    `SELECT bssid, tags, tag_array, is_threat, is_investigate, is_false_positive, is_suspect,
            notes, created_at, updated_at
     FROM app.network_tags_expanded WHERE bssid = $1`,
    [bssid]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function searchNetworksByTagArray(tagArray: string[], limit: number): Promise<any[]> {
  const result = await query(
    `SELECT bssid, tags, tag_array, is_threat, is_investigate, is_false_positive, is_suspect,
            notes, updated_at
     FROM app.network_tags_expanded
     WHERE tags ?& $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [tagArray, limit]
  );
  return result.rows;
}
