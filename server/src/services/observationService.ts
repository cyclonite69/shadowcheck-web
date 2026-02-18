/**
 * Observation Service Layer
 * Encapsulates database queries for observation operations
 */

const { query } = require('../config/database');
const logger = require('../logging/logger');

export async function getHomeLocationForObservations(): Promise<{
  lon: number;
  lat: number;
} | null> {
  try {
    const homeResult = await query(
      `SELECT ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat
       FROM app.location_markers WHERE marker_type = 'home' LIMIT 1`
    );
    return homeResult.rows[0] || null;
  } catch {
    return null;
  }
}

export async function getObservationsByBSSID(
  bssid: string,
  homeLon: number | null,
  homeLat: number | null
): Promise<any[]> {
  const { rows } = await query(
    `SELECT ROW_NUMBER() OVER (ORDER BY o.time) as id, o.bssid,
            COALESCE(NULLIF(o.ssid, ''), '(hidden)') as ssid, o.radio_type as type,
            o.lat, o.lon, o.level as signal, EXTRACT(EPOCH FROM o.time)::BIGINT * 1000 as time,
            COALESCE(o.accuracy, 3.79) as acc, o.altitude as alt,
            CASE
              WHEN $1::numeric IS NOT NULL AND $2::numeric IS NOT NULL THEN
                ST_Distance(
                  o.geom::geography,
                  ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) / 1000.0
              ELSE NULL
            END as distance_from_home_km
     FROM app.observations o
     WHERE o.bssid = $3 AND o.geom IS NOT NULL
     ORDER BY o.time ASC LIMIT 1000`,
    [homeLon, homeLat, bssid]
  );
  return rows;
}

export async function checkWigleTableExists(): Promise<boolean> {
  const tableCheck = await query(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'app' AND table_name = 'wigle_v3_observations'
     ) as exists`
  );
  return tableCheck.rows[0]?.exists || false;
}

export async function getWigleObservationsByBSSID(bssid: string): Promise<any[]> {
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
    [bssid]
  );
  return result.rows;
}

export async function getOurObservationCount(bssid: string): Promise<number> {
  const ourCount = await query(
    'SELECT COUNT(*) as count FROM app.observations WHERE UPPER(bssid) = $1',
    [bssid]
  );
  return parseInt(ourCount.rows[0]?.count || 0, 10);
}

export async function getWigleObservationsBatch(bssids: string[]): Promise<any[]> {
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
    [bssids]
  );
  return result.rows;
}

module.exports = {
  getHomeLocationForObservations,
  getObservationsByBSSID,
  checkWigleTableExists,
  getWigleObservationsByBSSID,
  getOurObservationCount,
  getWigleObservationsBatch,
};
