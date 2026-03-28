export {};

const { adminQuery } = require('../adminDbService');
const { query } = require('../../config/database');

async function checkDuplicateObservations(bssid: string, time: number): Promise<any> {
  const { rows } = await query(
    `
    WITH target_obs AS (
      SELECT time, lat, lon, accuracy
      FROM app.observations
      WHERE bssid = $1 AND time = $2
      LIMIT 1
    )
    SELECT 
      COUNT(*) as total_observations,
      COUNT(DISTINCT l.bssid) as unique_networks,
      ARRAY_AGG(DISTINCT l.bssid ORDER BY l.bssid) as bssids,
      t.lat,
      t.lon,
      t.accuracy,
      to_timestamp(t.time / 1000.0) as timestamp
    FROM app.observations l
    JOIN target_obs t ON 
      l.time = t.time 
      AND l.lat = t.lat 
      AND l.lon = t.lon
      AND l.accuracy = t.accuracy
    GROUP BY t.lat, t.lon, t.accuracy, t.time
  `,
    [bssid, time]
  );
  return rows[0] || null;
}

async function addNetworkNote(bssid: string, content: string): Promise<number> {
  const result = await query("SELECT app.network_add_note($1, $2, 'general', 'user') as note_id", [
    bssid,
    content,
  ]);
  return result.rows[0].note_id;
}

async function getNetworkSummary(bssid: string): Promise<any | null> {
  const result = await query(
    `
    SELECT bssid, tags, tag_array, is_threat, is_investigate, is_false_positive, is_suspect,
           notes, detailed_notes, notation_count, image_count, video_count, total_media_count,
           created_at, updated_at
    FROM app.network_tags_full 
    WHERE bssid = $1
  `,
    [bssid]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function getBackupData(): Promise<{
  observations: any[];
  networks: any[];
  tags: any[];
}> {
  const [observations, networks, tags] = await Promise.all([
    query('SELECT * FROM app.observations ORDER BY observed_at DESC'),
    query('SELECT * FROM app.networks'),
    query('SELECT * FROM app.network_tags'),
  ]);

  return {
    observations: observations.rows,
    networks: networks.rows,
    tags: tags.rows,
  };
}

async function upsertNetworkTag(
  bssid: string,
  is_ignored: boolean | null,
  ignore_reason: string | null,
  threat_tag: string | null,
  threat_confidence: number | null,
  notes: string | null
): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_tags (
      bssid, is_ignored, ignore_reason, threat_tag, threat_confidence, notes
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (bssid) DO UPDATE SET
      is_ignored = COALESCE($2, app.network_tags.is_ignored),
      ignore_reason = CASE WHEN $2 IS NOT NULL THEN $3 ELSE app.network_tags.ignore_reason END,
      threat_tag = COALESCE($4, app.network_tags.threat_tag),
      threat_confidence = CASE WHEN $4 IS NOT NULL THEN $5 ELSE app.network_tags.threat_confidence END,
      notes = COALESCE($6, app.network_tags.notes),
      updated_at = NOW()
    RETURNING *`,
    [bssid, is_ignored, ignore_reason, threat_tag, threat_confidence, notes]
  );
  return result.rows[0];
}

async function updateNetworkTagIgnore(
  bssid: string,
  is_ignored: boolean,
  ignore_reason: string | null
): Promise<any> {
  const result = await adminQuery(
    `UPDATE app.network_tags SET is_ignored = $1, ignore_reason = $2, updated_at = NOW()
     WHERE bssid = $3 RETURNING *`,
    [is_ignored, ignore_reason, bssid]
  );
  return result.rows[0];
}

async function insertNetworkTagIgnore(
  bssid: string,
  is_ignored: boolean,
  ignore_reason: string | null
): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_tags (bssid, is_ignored, ignore_reason)
     VALUES ($1, $2, $3) RETURNING *`,
    [bssid, is_ignored, ignore_reason]
  );
  return result.rows[0];
}

async function updateNetworkThreatTag(
  bssid: string,
  threat_tag: string,
  threat_confidence: number | null
): Promise<any> {
  const result = await adminQuery(
    `UPDATE app.network_tags SET threat_tag = $1, threat_confidence = $2, updated_at = NOW()
     WHERE bssid = $3 RETURNING *`,
    [threat_tag, threat_confidence, bssid]
  );
  return result.rows[0];
}

async function insertNetworkThreatTag(
  bssid: string,
  threat_tag: string,
  threat_confidence: number | null
): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_tags (bssid, threat_tag, threat_confidence)
     VALUES ($1, $2, $3) RETURNING *`,
    [bssid, threat_tag, threat_confidence]
  );
  return result.rows[0];
}

async function updateNetworkTagNotes(bssid: string, notes: string): Promise<any> {
  const result = await adminQuery(
    `UPDATE app.network_tags SET notes = $1, updated_at = NOW()
     WHERE bssid = $2 RETURNING *`,
    [notes, bssid]
  );
  return result.rows[0];
}

async function insertNetworkTagNotes(bssid: string, notes: string): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_tags (bssid, notes) VALUES ($1, $2) RETURNING *`,
    [bssid, notes]
  );
  return result.rows[0];
}

async function deleteNetworkTag(bssid: string): Promise<number> {
  const result = await adminQuery(`DELETE FROM app.network_tags WHERE bssid = $1`, [bssid]);
  return result.rowCount || 0;
}

async function requestWigleLookup(bssid: string): Promise<any> {
  const result = await adminQuery(
    `UPDATE app.network_tags SET wigle_lookup_requested = true, updated_at = NOW()
     WHERE bssid = $1 RETURNING *`,
    [bssid]
  );
  return result.rows[0];
}

async function markNetworkInvestigate(bssid: string): Promise<any> {
  const result = await adminQuery(
    `INSERT INTO app.network_tags (bssid, threat_tag, tags, wigle_lookup_requested, updated_at)
     VALUES ($1, 'INVESTIGATE', '["investigate"]'::jsonb, TRUE, NOW())
     ON CONFLICT (bssid) DO UPDATE SET
       threat_tag = CASE
         WHEN app.network_tags.threat_tag IN ('THREAT', 'SUSPECT', 'FALSE_POSITIVE')
           THEN app.network_tags.threat_tag
         ELSE 'INVESTIGATE'
       END,
       tags = CASE
         WHEN COALESCE(app.network_tags.tags, '[]'::jsonb) @> '["investigate"]'::jsonb
           THEN COALESCE(app.network_tags.tags, '[]'::jsonb)
         ELSE COALESCE(app.network_tags.tags, '[]'::jsonb) || '["investigate"]'::jsonb
       END,
       wigle_lookup_requested = TRUE,
       updated_at = NOW()
     RETURNING *`,
    [bssid]
  );
  return result.rows[0];
}

async function fetchNetworksPendingWigleLookup(limit: number): Promise<any[]> {
  const result = await query(
    `SELECT bssid FROM app.network_tags
     WHERE wigle_lookup_requested = true AND wigle_result IS NULL
     ORDER BY updated_at ASC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function exportMLTrainingSet(): Promise<any[]> {
  const result = await query(
    `SELECT
      nt.bssid, nt.threat_tag, nt.threat_confidence, nt.is_ignored, nt.tag_history,
      n.ssid, n.type as network_type, n.frequency, n.capabilities, n.bestlevel as signal_dbm,
      COUNT(o.id) as observation_count,
      COUNT(DISTINCT DATE(o.observed_at)) as unique_days,
      ST_Distance(
        ST_MakePoint(MIN(o.lon), MIN(o.lat))::geography,
        ST_MakePoint(MAX(o.lon), MAX(o.lat))::geography
      ) / 1000.0 as distance_range_km
    FROM app.network_tags nt
    LEFT JOIN app.networks n ON nt.bssid = n.bssid
    LEFT JOIN app.observations o ON nt.bssid = o.bssid
    WHERE nt.threat_tag IS NOT NULL
    GROUP BY nt.bssid, nt.threat_tag, nt.threat_confidence, nt.is_ignored,
      nt.tag_history, n.ssid, n.type, n.frequency, n.capabilities, n.bestlevel, nt.updated_at
    ORDER BY nt.updated_at DESC`
  );
  return result.rows;
}

export {
  addNetworkNote,
  checkDuplicateObservations,
  deleteNetworkTag,
  exportMLTrainingSet,
  getBackupData,
  getNetworkSummary,
  fetchNetworksPendingWigleLookup,
  insertNetworkTagIgnore,
  insertNetworkTagNotes,
  insertNetworkThreatTag,
  markNetworkInvestigate,
  requestWigleLookup,
  updateNetworkTagIgnore,
  updateNetworkTagNotes,
  updateNetworkThreatTag,
  upsertNetworkTag,
};

export { fetchNetworksPendingWigleLookup as getNetworksPendingWigleLookup };
export { exportMLTrainingSet as exportMLTrainingData };
