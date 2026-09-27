/**
 * Admin Network Tag Repository
 *
 * Data access layer for administrative network tag operations and metadata queries.
 * Follows the Lane 2 repository pattern with explicit queryExecutor parameters.
 */

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any>;

/**
 * Checks for duplicate observations at the given bssid and time.
 */
export async function checkDuplicateObservations(
  queryExecutor: QueryExecutor,
  bssid: string,
  time: number
): Promise<any> {
  const { rows } = await queryExecutor(
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

/**
 * Adds a network note via stored procedure app.network_add_note.
 */
export async function addNetworkNote(
  queryExecutor: QueryExecutor,
  bssid: string,
  content: string
): Promise<number> {
  const result = await queryExecutor(
    "SELECT app.network_add_note($1, $2, 'general', 'user') as note_id",
    [bssid, content]
  );
  return result.rows[0].note_id;
}

/**
 * Retrieves network summary from app.network_tags_full view.
 */
export async function getNetworkSummary(
  queryExecutor: QueryExecutor,
  bssid: string
): Promise<any | null> {
  const result = await queryExecutor(
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

/**
 * Fetches backup data across observations, networks, and network_tags.
 */
export async function getBackupData(queryExecutor: QueryExecutor): Promise<{
  observations: any[];
  networks: any[];
  tags: any[];
}> {
  const [observations, networks, tags] = await Promise.all([
    queryExecutor('SELECT * FROM app.observations ORDER BY observed_at DESC'),
    queryExecutor('SELECT * FROM app.networks'),
    queryExecutor('SELECT * FROM app.network_tags'),
  ]);

  return {
    observations: observations.rows,
    networks: networks.rows,
    tags: tags.rows,
  };
}

/**
 * Upserts a network tag into app.network_tags.
 */
export async function upsertNetworkTag(
  queryExecutor: QueryExecutor,
  bssid: string,
  is_ignored: boolean | null,
  ignore_reason: string | null,
  threat_tag: string | null,
  threat_confidence: number | null,
  notes: string | null
): Promise<any> {
  const result = await queryExecutor(
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

/**
 * Updates ignore status on an existing network tag.
 */
export async function updateNetworkTagIgnore(
  queryExecutor: QueryExecutor,
  bssid: string,
  is_ignored: boolean,
  ignore_reason: string | null
): Promise<any> {
  const result = await queryExecutor(
    `UPDATE app.network_tags SET is_ignored = $1, ignore_reason = $2, updated_at = NOW()
     WHERE bssid = $3 RETURNING *`,
    [is_ignored, ignore_reason, bssid]
  );
  return result.rows[0];
}

/**
 * Inserts ignore status for a network tag.
 */
export async function insertNetworkTagIgnore(
  queryExecutor: QueryExecutor,
  bssid: string,
  is_ignored: boolean,
  ignore_reason: string | null
): Promise<any> {
  const result = await queryExecutor(
    `INSERT INTO app.network_tags (bssid, is_ignored, ignore_reason)
     VALUES ($1, $2, $3) RETURNING *`,
    [bssid, is_ignored, ignore_reason]
  );
  return result.rows[0];
}

/**
 * Updates threat tag and confidence on an existing network tag.
 */
export async function updateNetworkThreatTag(
  queryExecutor: QueryExecutor,
  bssid: string,
  threat_tag: string,
  threat_confidence: number | null
): Promise<any> {
  const result = await queryExecutor(
    `UPDATE app.network_tags SET threat_tag = $1, threat_confidence = $2, updated_at = NOW()
     WHERE bssid = $3 RETURNING *`,
    [threat_tag, threat_confidence, bssid]
  );
  return result.rows[0];
}

/**
 * Inserts threat tag and confidence for a network tag.
 */
export async function insertNetworkThreatTag(
  queryExecutor: QueryExecutor,
  bssid: string,
  threat_tag: string,
  threat_confidence: number | null
): Promise<any> {
  const result = await queryExecutor(
    `INSERT INTO app.network_tags (bssid, threat_tag, threat_confidence)
     VALUES ($1, $2, $3) RETURNING *`,
    [bssid, threat_tag, threat_confidence]
  );
  return result.rows[0];
}

/**
 * Updates notes on an existing network tag.
 */
export async function updateNetworkTagNotes(
  queryExecutor: QueryExecutor,
  bssid: string,
  notes: string
): Promise<any> {
  const result = await queryExecutor(
    `UPDATE app.network_tags SET notes = $1, updated_at = NOW()
     WHERE bssid = $2 RETURNING *`,
    [notes, bssid]
  );
  return result.rows[0];
}

/**
 * Inserts notes for a network tag.
 */
export async function insertNetworkTagNotes(
  queryExecutor: QueryExecutor,
  bssid: string,
  notes: string
): Promise<any> {
  const result = await queryExecutor(
    'INSERT INTO app.network_tags (bssid, notes) VALUES ($1, $2) RETURNING *',
    [bssid, notes]
  );
  return result.rows[0];
}

/**
 * Deletes a network tag row from app.network_tags.
 */
export async function deleteNetworkTag(
  queryExecutor: QueryExecutor,
  bssid: string
): Promise<number> {
  const result = await queryExecutor('DELETE FROM app.network_tags WHERE bssid = $1', [bssid]);
  return result.rowCount || 0;
}

/**
 * Flags a network tag for WiGLE lookup.
 */
export async function requestWigleLookup(
  queryExecutor: QueryExecutor,
  bssid: string
): Promise<any> {
  const result = await queryExecutor(
    `UPDATE app.network_tags SET wigle_lookup_requested = true, updated_at = NOW()
     WHERE bssid = $1 RETURNING *`,
    [bssid]
  );
  return result.rows[0];
}

/**
 * Marks network as investigate and requests WiGLE lookup.
 */
export async function markNetworkInvestigate(
  queryExecutor: QueryExecutor,
  bssid: string
): Promise<any> {
  const result = await queryExecutor(
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

/**
 * Fetches networks pending WiGLE lookup where result is null.
 */
export async function fetchNetworksPendingWigleLookup(
  queryExecutor: QueryExecutor,
  limit: number
): Promise<any[]> {
  const result = await queryExecutor(
    `SELECT bssid FROM app.network_tags
     WHERE wigle_lookup_requested = true AND wigle_result IS NULL
     ORDER BY updated_at ASC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Exports data for machine learning training set with observations distance range.
 */
export async function exportMLTrainingSet(queryExecutor: QueryExecutor): Promise<any[]> {
  const result = await queryExecutor(
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

export { fetchNetworksPendingWigleLookup as getNetworksPendingWigleLookup };
export { exportMLTrainingSet as exportMLTrainingData };
