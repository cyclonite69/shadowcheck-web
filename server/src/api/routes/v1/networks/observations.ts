/**
 * Network Observations Routes
 * Observation data and WiGLE crowdsourced observations
 */

import express from 'express';
const router = express.Router();
import { query } from '../../../../config/database';
import logger from '../../../../logging/logger';
import { validateBSSID } from '../../../../validation/schemas';

/**
 * GET /networks/observations/:bssid - Get all observations for a network
 */
router.get('/networks/observations/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    let home = null;
    try {
      const homeResult = await query(
        `SELECT ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat
         FROM app.location_markers WHERE marker_type = 'home' LIMIT 1`
      );
      home = homeResult.rows[0] || null;
    } catch {
      home = null;
    }

    const { rows } = await query(
      `SELECT ROW_NUMBER() OVER (ORDER BY o.time) as id, o.bssid,
              COALESCE(NULLIF(o.ssid, ''), '(hidden)') as ssid, o.radio_type as type,
              o.lat, o.lon, o.level as signal, EXTRACT(EPOCH FROM o.time)::BIGINT * 1000 as time,
              COALESCE(o.accuracy, 3.79) as acc, o.altitude as alt,
              CASE
                WHEN $1::numeric IS NOT NULL AND $2::numeric IS NOT NULL THEN
                  ST_Distance(
                    ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                  ) / 1000.0
                ELSE NULL
              END as distance_from_home_km
       FROM app.observations o
       WHERE o.bssid = $3 AND o.lat IS NOT NULL AND o.lon IS NOT NULL
       ORDER BY o.time ASC LIMIT 1000`,
      [home?.lon, home?.lat, bssidValidation.cleaned]
    );

    res.json({
      ok: true,
      bssid: bssidValidation.cleaned,
      observations: rows,
      home: home,
      count: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /networks/:bssid/wigle-observations - Get WiGLE crowdsourced observations
 */
router.get('/networks/:bssid/wigle-observations', async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const cleanBssid = bssidValidation.cleaned;

    const tableCheck = await query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'app' AND table_name = 'wigle_v3_observations'
       ) as exists`
    );

    if (!tableCheck.rows[0]?.exists) {
      return res.json({
        ok: true,
        bssid: cleanBssid,
        observations: [],
        stats: { total: 0, matched: 0, unique: 0 },
        message: 'WiGLE v3 observations table not available',
      });
    }

    const result = await query(
      `WITH our_obs AS (
         SELECT bssid, lat, lon, time, level, time::date as obs_date,
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography as geog
         FROM app.observations
         WHERE UPPER(bssid) = $1 AND lat IS NOT NULL AND lon IS NOT NULL
       ),
       wigle_enriched AS (
         SELECT w.netid as bssid, w.latitude as lat, w.longitude as lon, w.observed_at as time,
                w.signal as level, w.ssid, w.frequency, w.channel, w.encryption, w.altitude, w.accuracy,
                ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography as geog,
                EXISTS (
                  SELECT 1 FROM our_obs o
                  WHERE ST_DWithin(
                    ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography,
                    o.geog, 5
                  ) AND w.observed_at::date = o.obs_date
                ) as is_matched
         FROM app.wigle_v3_observations w
         WHERE UPPER(w.netid) = $1 AND w.latitude IS NOT NULL AND w.longitude IS NOT NULL
       ),
       our_bounds AS (
         SELECT MIN(lat) as min_lat, MAX(lat) as max_lat, MIN(lon) as min_lon, MAX(lon) as max_lon
         FROM our_obs
       )
       SELECT we.bssid, we.lat, we.lon, EXTRACT(EPOCH FROM we.time) * 1000 as time,
              we.level, we.ssid, we.frequency, we.channel, we.encryption, we.altitude, we.accuracy,
              we.is_matched,
              CASE
                WHEN ob.min_lat IS NULL THEN NULL
                ELSE ROUND(ST_Distance(
                  we.geog,
                  ST_SetSRID(ST_MakePoint(
                    (ob.min_lon + ob.max_lon) / 2,
                    (ob.min_lat + ob.max_lat) / 2
                  ), 4326)::geography
                )::numeric, 2)
              END as distance_from_our_center_m
       FROM wigle_enriched we
       CROSS JOIN our_bounds ob
       ORDER BY we.time DESC`,
      [cleanBssid]
    );

    const total = result.rows.length;
    const matched = result.rows.filter((r) => r.is_matched).length;
    const unique = total - matched;

    const ourCount = await query(
      'SELECT COUNT(*) as count FROM app.observations WHERE UPPER(bssid) = $1',
      [cleanBssid]
    );

    const maxDistance = result.rows.reduce((max, r) => {
      if (r.distance_from_our_center_m && r.distance_from_our_center_m > max) {
        return r.distance_from_our_center_m;
      }
      return max;
    }, 0);

    res.json({
      ok: true,
      bssid: cleanBssid,
      observations: result.rows.map((r) => ({
        lat: r.lat,
        lon: r.lon,
        time: r.time,
        level: r.level,
        ssid: r.ssid,
        frequency: r.frequency,
        channel: r.channel,
        encryption: r.encryption,
        altitude: r.altitude,
        accuracy: r.accuracy,
        source: r.is_matched ? 'matched' : 'wigle_unique',
        distance_from_our_center_m: r.distance_from_our_center_m,
      })),
      stats: {
        wigle_total: total,
        matched: matched,
        unique: unique,
        our_observations: parseInt(ourCount.rows[0]?.count || 0, 10),
        max_distance_from_our_sightings_m: maxDistance,
      },
    });
  } catch (err: any) {
    logger.error('Error fetching WiGLE observations', { error: err.message });
    next(err);
  }
});

/**
 * POST /networks/wigle-observations/batch - Get WiGLE observations for multiple networks
 */
router.post('/networks/wigle-observations/batch', async (req, res, next) => {
  try {
    const { bssids } = req.body;

    if (!Array.isArray(bssids) || bssids.length === 0) {
      return res.status(400).json({ error: 'bssids array is required' });
    }

    if (bssids.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 networks per request' });
    }

    const cleanBssids = [];
    for (const bssid of bssids) {
      const validation = validateBSSID(bssid);
      if (validation.valid) {
        cleanBssids.push(validation.cleaned);
      }
    }

    if (cleanBssids.length === 0) {
      return res.status(400).json({ error: 'No valid BSSIDs provided' });
    }

    const tableCheck = await query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'app' AND table_name = 'wigle_v3_observations'
       ) as exists`
    );

    if (!tableCheck.rows[0]?.exists) {
      return res.json({
        ok: true,
        networks: [],
        stats: { total_wigle: 0, total_matched: 0, total_unique: 0 },
        message: 'WiGLE v3 observations table not available',
      });
    }

    const result = await query(
      `WITH our_obs AS (
         SELECT bssid, lat, lon, time, level, time::date as obs_date,
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography as geog
         FROM app.observations
         WHERE UPPER(bssid) = ANY($1) AND lat IS NOT NULL AND lon IS NOT NULL
       ),
       wigle_enriched AS (
         SELECT w.netid as bssid, w.latitude as lat, w.longitude as lon, w.observed_at as time,
                w.signal as level, w.ssid, w.frequency, w.channel, w.encryption, w.altitude, w.accuracy,
                ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography as geog,
                EXISTS (
                  SELECT 1 FROM our_obs o
                  WHERE UPPER(o.bssid) = UPPER(w.netid)
                  AND ST_DWithin(
                    ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography,
                    o.geog, 5
                  ) AND w.observed_at::date = o.obs_date
                ) as is_matched
         FROM app.wigle_v3_observations w
         WHERE UPPER(w.netid) = ANY($1) AND w.latitude IS NOT NULL AND w.longitude IS NOT NULL
       ),
       our_centers AS (
         SELECT UPPER(bssid) as bssid, AVG(lat) as center_lat, AVG(lon) as center_lon
         FROM our_obs GROUP BY UPPER(bssid)
       )
       SELECT we.bssid, we.lat, we.lon, EXTRACT(EPOCH FROM we.time) * 1000 as time,
              we.level, we.ssid, we.frequency, we.channel, we.encryption, we.altitude, we.accuracy,
              we.is_matched,
              CASE
                WHEN oc.center_lat IS NULL THEN NULL
                ELSE ROUND(ST_Distance(
                  we.geog,
                  ST_SetSRID(ST_MakePoint(oc.center_lon, oc.center_lat), 4326)::geography
                )::numeric, 2)
              END as distance_from_our_center_m
       FROM wigle_enriched we
       LEFT JOIN our_centers oc ON UPPER(we.bssid) = oc.bssid
       ORDER BY we.bssid, we.time DESC`,
      [cleanBssids]
    );

    const networkMap = new Map();
    let totalMatched = 0;
    let totalUnique = 0;

    for (const row of result.rows) {
      const bssid = row.bssid.toUpperCase();
      if (!networkMap.has(bssid)) {
        networkMap.set(bssid, {
          bssid,
          observations: [],
          stats: { wigle_total: 0, matched: 0, unique: 0, max_distance_m: 0 },
        });
      }
      const network = networkMap.get(bssid);
      network.observations.push({
        lat: row.lat,
        lon: row.lon,
        time: row.time,
        level: row.level,
        ssid: row.ssid,
        frequency: row.frequency,
        channel: row.channel,
        encryption: row.encryption,
        altitude: row.altitude,
        accuracy: row.accuracy,
        source: row.is_matched ? 'matched' : 'wigle_unique',
        distance_from_our_center_m: row.distance_from_our_center_m,
      });
      network.stats.wigle_total++;
      if (row.is_matched) {
        network.stats.matched++;
        totalMatched++;
      } else {
        network.stats.unique++;
        totalUnique++;
      }
      if (row.distance_from_our_center_m > network.stats.max_distance_m) {
        network.stats.max_distance_m = row.distance_from_our_center_m;
      }
    }

    res.json({
      ok: true,
      networks: Array.from(networkMap.values()),
      stats: {
        total_wigle: result.rows.length,
        total_matched: totalMatched,
        total_unique: totalUnique,
        network_count: networkMap.size,
      },
    });
  } catch (err: any) {
    logger.error('Error fetching batch WiGLE observations', { error: err.message });
    next(err);
  }
});

export default router;
