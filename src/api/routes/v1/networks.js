/**
 * Networks Routes
 * Handles all network-related endpoints
 */

const express = require('express');
const router = express.Router();
const { query, CONFIG } = require('../../../config/database');
const { escapeLikePattern } = require('../../../utils/escapeSQL');
const secretsManager = require('../../../services/secretsManager');

// Authentication middleware
const requireAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validKey = secretsManager.get('api_key');
  if (validKey && (!apiKey || apiKey !== validKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Utility: Sanitize BSSID
function sanitizeBSSID(bssid) {
  if (!bssid || typeof bssid !== 'string') {return null;}
  const cleaned = bssid.trim().toUpperCase();
  if (!/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/.test(cleaned)) {return null;}
  return cleaned;
}

// GET /api/networks - List all networks with pagination and filtering
router.get('/networks', async (req, res, next) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);

    if (isNaN(page) || page <= 0) {
      return res.status(400).json({ error: 'Invalid page parameter. Must be a positive integer.' });
    }
    if (isNaN(limit) || limit <= 0 || limit > 5000) {
      return res.status(400).json({ error: 'Invalid limit parameter. Must be between 1 and 5000.' });
    }

    const offset = (page - 1) * limit;

    // Filter parameters
    const search = req.query.search || '';
    const type = req.query.type || '';
    const security = req.query.security || '';
    const minSignal = req.query.minSignal ? parseInt(req.query.minSignal) : null;
    const maxSignal = req.query.maxSignal ? parseInt(req.query.maxSignal) : null;

    // Validate filter parameters
    if (search && typeof search !== 'string') {
      return res.status(400).json({ error: 'Search parameter must be a string.' });
    }
    if (type && typeof type !== 'string') {
      return res.status(400).json({ error: 'Type parameter must be a string.' });
    }
    if (security && typeof security !== 'string') {
      return res.status(400).json({ error: 'Security parameter must be a string.' });
    }
    if (minSignal !== null && isNaN(minSignal)) {
      return res.status(400).json({ error: 'minSignal parameter must be a valid number.' });
    }
    if (maxSignal !== null && isNaN(maxSignal)) {
      return res.status(400).json({ error: 'maxSignal parameter must be a valid number.' });
    }

    // Sorting parameters
    const sort = req.query.sort || 'lastSeen';
    const order = (req.query.order || 'DESC').toUpperCase();

    // Map frontend sort columns to database fields
    const sortColumnMap = {
      type: 'n.type',
      ssid: 'n.ssid',
      bssid: 'n.bssid',
      signal: 'COALESCE(l.signal_dbm, n.bestlevel)',
      security: 'n.encryption',
      frequency: 'n.frequency',
      channel: 'n.channel',
      observations: 'COALESCE(oc.obs_count, 1)',
      latitude: 'COALESCE(l.latitude, n.bestlat, n.lastlat, n.trilaterated_lat)',
      longitude: 'COALESCE(l.longitude, n.bestlon, n.lastlon, n.trilaterated_lon)',
      distanceFromHome: 'distance_from_home',
      accuracy: 'COALESCE(l.accuracy_meters, 0)',
      lastSeen: 'lastseen',
    };

    // Validate sort column
    if (!sortColumnMap[sort]) {
      return res.status(400).json({ error: `Invalid sort column: ${sort}. Allowed: ${Object.keys(sortColumnMap).join(', ')}` });
    }

    // Validate sort order
    if (!['ASC', 'DESC'].includes(order)) {
      return res.status(400).json({ error: 'Invalid sort order. Must be ASC or DESC.' });
    }

    const orderByClause = sort === 'lastSeen' ? `${sortColumnMap[sort]} ${order} NULLS LAST` : `${sortColumnMap[sort]} ${order}`;

    // Get home location for distance calculation
    const homeResult = await query(`
      SELECT
        ST_X(location::geometry) as lon,
        ST_Y(location::geometry) as lat
      FROM app.location_markers
      WHERE marker_type = 'home'
      LIMIT 1
    `);
    const home = homeResult.rows[0] || null;

    // Base query
    let queryText = `
      WITH latest_locations AS (
        SELECT DISTINCT ON (bssid)
          bssid, latitude, longitude, signal_dbm, accuracy_meters, observed_at
        FROM app.observations
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND observed_at >= to_timestamp($1 / 1000.0)
        ORDER BY bssid, observed_at DESC
      ),
      latest_times AS (
        SELECT DISTINCT ON (bssid)
          bssid, observed_at as last_time
        FROM app.observations
        WHERE observed_at IS NOT NULL
        ORDER BY bssid, observed_at DESC
      ),
      observation_counts AS (
        SELECT bssid, COUNT(*) as obs_count
        FROM app.observations
        WHERE observed_at >= to_timestamp($1 / 1000.0)
        GROUP BY bssid
      )
      SELECT
        n.unified_id, n.ssid, n.bssid, n.type,
        CASE
          WHEN n.type IN ('B', 'E') THEN 'N/A'
          WHEN UPPER(n.capabilities) LIKE '%WPA3%' OR UPPER(n.capabilities) LIKE '%SAE%' THEN
            CASE WHEN UPPER(n.capabilities) LIKE '%EAP%' OR UPPER(n.capabilities) LIKE '%MGT%' THEN 'WPA3-E' ELSE 'WPA3-P' END
          WHEN UPPER(n.capabilities) LIKE '%WPA2%' OR UPPER(n.capabilities) LIKE '%RSN%' THEN
            CASE WHEN UPPER(n.capabilities) LIKE '%EAP%' OR UPPER(n.capabilities) LIKE '%MGT%' THEN 'WPA2-E' ELSE 'WPA2-P' END
          WHEN UPPER(n.capabilities) LIKE '%WPA-%' AND UPPER(n.capabilities) NOT LIKE '%WPA2%' THEN 'WPA'
          WHEN UPPER(n.capabilities) LIKE '%WEP%' OR LOWER(n.encryption) = 'wep' THEN 'WEP'
          WHEN UPPER(n.capabilities) LIKE '%WPS%' AND UPPER(n.capabilities) NOT LIKE '%WPA%' THEN 'WPS'
          WHEN LOWER(n.encryption) = 'wpa3' THEN 'WPA3-P'
          WHEN LOWER(n.encryption) = 'wpa2' THEN 'WPA2-P'
          WHEN LOWER(n.encryption) = 'wpa' THEN 'WPA'
          WHEN n.capabilities IS NOT NULL AND n.capabilities != '' AND n.capabilities != 'Misc' AND n.capabilities != 'Uncategorized;10' THEN 'Unknown'
          ELSE 'OPEN'
        END as security,
        n.frequency, n.channel,
        CASE
          WHEN COALESCE(l.signal_dbm, n.bestlevel, 0) = 0 THEN NULL
          ELSE COALESCE(l.signal_dbm, n.bestlevel)
        END as signal,
        COALESCE(l.accuracy_meters, 0) as accuracy_meters,
        COALESCE(lt.last_time, l.observed_at, to_timestamp(n.lasttime / 1000.0)) as lastseen,
        COALESCE(l.latitude, n.bestlat, n.lastlat, n.trilaterated_lat) as lat,
        COALESCE(l.longitude, n.bestlon, n.lastlon, n.trilaterated_lon) as lng,
        COALESCE(oc.obs_count, 1) as observations, n.capabilities as misc,
        rm.organization_name as manufacturer,
        CASE
          WHEN COALESCE(l.signal_dbm, n.bestlevel, -999) = 0 OR COALESCE(l.signal_dbm, n.bestlevel) IS NULL THEN 'safe'
          WHEN COALESCE(l.signal_dbm, n.bestlevel) > -50 THEN 'threat'
          WHEN COALESCE(l.signal_dbm, n.bestlevel) > -70 THEN 'warning'
          ELSE 'safe'
        END as status,
        CASE
          WHEN $2::double precision IS NOT NULL AND $3::double precision IS NOT NULL
            AND COALESCE(l.latitude, n.bestlat) IS NOT NULL AND COALESCE(l.longitude, n.bestlon) IS NOT NULL
          THEN ST_Distance(
            ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
            ST_SetSRID(ST_MakePoint(COALESCE(l.longitude, n.bestlon), COALESCE(l.latitude, n.bestlat)), 4326)::geography
          ) / 1000.0
          ELSE NULL
        END as distance_from_home,
        COUNT(*) OVER() as total_networks_count
      FROM app.networks n
      LEFT JOIN latest_locations l ON n.bssid = l.bssid
      LEFT JOIN latest_times lt ON n.bssid = lt.bssid
      LEFT JOIN observation_counts oc ON n.bssid = oc.bssid
      LEFT JOIN app.radio_manufacturers rm ON UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', '')) = rm.oui_prefix_24bit
    `;

    const params = [
      CONFIG.MIN_VALID_TIMESTAMP,
      home?.latitude || null,
      home?.longitude || null,
    ];

    const whereClauses = [
      'n.bssid IS NOT NULL',
      '(n.lasttime IS NULL OR to_timestamp(n.lasttime / 1000.0) >= to_timestamp($1 / 1000.0))',
      'n.bestlevel != 0',
    ];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      whereClauses.push(`(LOWER(n.ssid) LIKE $${params.length} OR LOWER(n.bssid) LIKE $${params.length})`);
    }
    if (type) {
      params.push(type);
      whereClauses.push(`n.type = $${params.length}`);
    }
    if (security) {
      params.push(`%${security.toLowerCase()}%`);
      whereClauses.push(`LOWER(n.encryption) LIKE $${params.length}`);
    }
    if (minSignal !== null) {
      params.push(minSignal);
      whereClauses.push(`COALESCE(l.signal_dbm, n.bestlevel) >= $${params.length}`);
    }
    if (maxSignal !== null) {
      params.push(maxSignal);
      whereClauses.push(`COALESCE(l.signal_dbm, n.bestlevel) <= $${params.length}`);
    }

    if (whereClauses.length > 0) {
      queryText += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    queryText += ` ORDER BY ${orderByClause} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await query(queryText, params);
    const totalCount = rows.length > 0 ? parseInt(rows[0].total_networks_count) : 0;

    const networks = rows.map(row => ({
      id: row.unified_id,
      ssid: row.ssid,
      bssid: row.bssid,
      type: row.type || 'W',
      security: row.security,
      capabilities: row.misc,
      encryption: row.security,
      frequency: row.frequency ? parseFloat(row.frequency) / 1000 : null,
      channel: row.channel ? parseInt(row.channel) : null,
      signal: row.signal ? parseInt(row.signal) : null,
      accuracy: row.accuracy_meters ? parseFloat(row.accuracy_meters) : 0,
      observations: row.observations ? parseInt(row.observations) : 1,
      manufacturer: row.manufacturer || 'Unknown',
      lastSeen: row.lastseen ? new Date(row.lastseen).getTime() : null,
      timestamp: row.lastseen ? new Date(row.lastseen).getTime() : null,
      time: row.lastseen ? new Date(row.lastseen).getTime() : null,
      status: row.status,
      distanceFromHome: row.distance_from_home ? parseFloat(row.distance_from_home) : null,
      latitude: row.lat ? parseFloat(row.lat) : null,
      longitude: row.lng ? parseFloat(row.lng) : null,
      misc: row.misc,
      location: {
        lat: row.lat ? parseFloat(row.lat) : null,
        lng: row.lng ? parseFloat(row.lng) : null,
      },
    }));

    res.json({
      networks,
      total: totalCount,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/networks/search/:ssid - Search networks by SSID
router.get('/networks/search/:ssid', async (req, res, next) => {
  try {
    const { ssid } = req.params;

    if (!ssid || typeof ssid !== 'string' || ssid.trim() === '') {
      return res.status(400).json({ error: 'SSID parameter is required and cannot be empty.' });
    }

    const escapedSSID = escapeLikePattern(ssid);
    const searchPattern = `%${escapedSSID}%`;

    const { rows } = await query(`
      SELECT
        n.unified_id,
        n.ssid,
        n.bssid,
        n.type,
        n.encryption,
        n.bestlevel as signal,
        n.lasttime,
        COUNT(DISTINCT l.unified_id) as observation_count
      FROM app.networks n
      LEFT JOIN app.observations l ON n.bssid = l.bssid
      WHERE n.ssid ILIKE $1
      GROUP BY n.unified_id, n.ssid, n.bssid, n.type, n.encryption, n.bestlevel, n.lasttime
      ORDER BY observation_count DESC
      LIMIT 50
    `, [searchPattern]);

    res.json({
      ok: true,
      query: ssid,
      count: rows.length,
      networks: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/networks/observations/:bssid - Get all observations for a network
router.get('/networks/observations/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const homeResult = await query(`
      SELECT
        ST_X(location::geometry) as lon,
        ST_Y(location::geometry) as lat
      FROM app.location_markers
      WHERE marker_type = 'home'
      LIMIT 1
    `);
    const home = homeResult.rows[0] || null;

    const { rows } = await query(`
      SELECT
        l.unified_id as id,
        l.bssid,
        n.ssid,
        n.type,
        n.encryption,
        n.capabilities,
        l.latitude as lat,
        l.longitude as lon,
        l.signal_dbm as signal,
        EXTRACT(EPOCH FROM l.observed_at)::BIGINT * 1000 as time,
        l.accuracy_meters as acc,
        l.altitude_meters as alt,
        CASE
          WHEN $1::numeric IS NOT NULL AND $2::numeric IS NOT NULL THEN
            ST_Distance(
              ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            ) / 1000.0
          ELSE NULL
        END as distance_from_home_km
      FROM app.observations l
      LEFT JOIN app.networks n ON l.bssid = n.bssid
      WHERE l.bssid = $3
        AND l.latitude IS NOT NULL
        AND l.longitude IS NOT NULL
        AND l.observed_at >= to_timestamp($4 / 1000.0)
        AND (l.accuracy_meters IS NULL OR l.accuracy_meters <= 100)
        AND NOT EXISTS (
          SELECT 1 
          FROM app.observations dup
          WHERE dup.observed_at = l.observed_at 
            AND dup.latitude = l.latitude 
            AND dup.longitude = l.longitude
          GROUP BY dup.observed_at, dup.latitude, dup.longitude
          HAVING COUNT(DISTINCT dup.bssid) >= 50
        )
      ORDER BY l.observed_at ASC
    `, [home?.lon, home?.lat, bssid, CONFIG.MIN_VALID_TIMESTAMP]);

    res.json({
      ok: true,
      bssid: bssid,
      observations: rows,
      home: home,
      count: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/networks/tagged - Get tagged networks
router.get('/networks/tagged', async (req, res, next) => {
  try {
    const { tag_type } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const validTagTypes = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];
    if (!tag_type || !validTagTypes.includes(tag_type.toUpperCase())) {
      return res.status(400).json({ error: `Valid tag_type is required (one of: ${validTagTypes.join(', ')})` });
    }

    if (page <= 0) {
      return res.status(400).json({ error: 'Invalid page parameter. Must be a positive integer.' });
    }
    if (limit <= 0 || limit > 1000) {
      return res.status(400).json({ error: 'Invalid limit parameter. Must be between 1 and 1000.' });
    }

    const offset = (page - 1) * limit;

    const { rows } = await query(`
      SELECT
        t.bssid,
        n.ssid,
        t.tag_type,
        t.confidence,
        t.notes,
        t.tagged_at,
        t.updated_at,
        COUNT(*) OVER() as total_count
      FROM app.network_tags t
      LEFT JOIN app.networks n ON t.bssid = n.bssid
      WHERE t.tag_type = $1
      ORDER BY t.updated_at DESC
      LIMIT $2 OFFSET $3
    `, [tag_type.toUpperCase(), limit, offset]);

    const totalCount = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

    res.json({
      ok: true,
      tag_type: tag_type.toUpperCase(),
      networks: rows.map(row => ({
        bssid: row.bssid,
        ssid: row.ssid || '<Hidden>',
        tag_type: row.tag_type,
        confidence: parseFloat(row.confidence),
        notes: row.notes,
        tagged_at: row.tagged_at,
        updated_at: row.updated_at,
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tag-network - Tag a network
router.post('/tag-network', requireAuth, async (req, res, next) => {
  try {
    const { bssid, tag_type, confidence, notes } = req.body;

    const cleanBSSID = sanitizeBSSID(bssid);
    if (!cleanBSSID) {
      return res.status(400).json({ error: 'Invalid BSSID format' });
    }

    const validTagTypes = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];
    if (!tag_type || !validTagTypes.includes(tag_type.toUpperCase())) {
      return res.status(400).json({ error: `Valid tag_type is required (one of: ${validTagTypes.join(', ')})` });
    }

    const parsedConfidence = parseFloat(confidence);
    if (isNaN(parsedConfidence) || parsedConfidence < 0 || parsedConfidence > 100) {
      return res.status(400).json({ error: 'Confidence must be a number between 0 and 100' });
    }

    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    const networkResult = await query(`
      SELECT ssid FROM app.networks WHERE bssid = $1 LIMIT 1
    `, [cleanBSSID]);

    await query(`
      DELETE FROM app.network_tags WHERE bssid = $1
    `, [cleanBSSID]);

    const result = await query(`
      INSERT INTO app.network_tags (bssid, tag_type, confidence, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING bssid, tag_type, confidence, threat_score, ml_confidence
    `, [cleanBSSID, tag_type.toUpperCase(), parsedConfidence / 100.0, notes || null]);

    res.json({
      ok: true,
      tag: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tag-network/:bssid - Remove tag from network
router.delete('/tag-network/:bssid', requireAuth, async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const cleanBSSID = sanitizeBSSID(bssid);
    if (!cleanBSSID) {
      return res.status(400).json({ error: 'Invalid BSSID format' });
    }

    const result = await query(`
      DELETE FROM app.network_tags WHERE bssid = $1 RETURNING bssid
    `, [cleanBSSID]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tag not found for this BSSID' });
    }

    res.json({
      ok: true,
      message: 'Tag removed successfully',
      bssid: cleanBSSID,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/manufacturer/:bssid - Get manufacturer from MAC address
router.get('/manufacturer/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const cleanBSSID = sanitizeBSSID(bssid);
    if (!cleanBSSID) {
      return res.status(400).json({ error: 'Invalid BSSID format' });
    }

    const prefix = cleanBSSID.replace(/:/g, '').substring(0, 6).toUpperCase();

    const { rows } = await query(`
      SELECT
        oui_prefix_24bit as prefix,
        organization_name as manufacturer,
        organization_address as address
      FROM app.radio_manufacturers
      WHERE oui_prefix_24bit = $1
      LIMIT 1
    `, [prefix]);

    if (rows.length === 0) {
      return res.json({
        ok: true,
        bssid: cleanBSSID,
        manufacturer: 'Unknown',
        prefix: prefix,
      });
    }

    res.json({
      ok: true,
      bssid: cleanBSSID,
      manufacturer: rows[0].manufacturer,
      address: rows[0].address,
      prefix: rows[0].prefix,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
