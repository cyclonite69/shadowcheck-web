/**
 * Observation Service Layer
 * Encapsulates database queries for observation operations
 */

import { extractExif, ExifMissingError, ExifToolUnavailableError } from './visint/visintExif';
import { correlateVisINT, saveVisINTAttachment } from './visint/visintPipeline';

const { query } = require('../config/database');

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
            o.lat, o.lon, o.level as signal, (EXTRACT(EPOCH FROM o.time) * 1000)::float8 as time,
            COALESCE(o.accuracy, 3.79) as acc, o.altitude as alt,
            gc.address as geocoded_address, gc.city as geocoded_city, gc.state as geocoded_state,
            gc.poi_name as geocoded_poi_name,
            CASE
              WHEN $1::numeric IS NOT NULL AND $2::numeric IS NOT NULL THEN
                ST_Distance(
                  o.geom::geography,
                  ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) / 1000.0
              ELSE NULL
            END as distance_from_home_km
     FROM app.observations o
     LEFT JOIN app.geocoding_cache gc ON gc.precision = 4
       AND gc.lat_round = ROUND(o.lat::numeric, 4)
       AND gc.lon_round = ROUND(o.lon::numeric, 4)
     WHERE o.bssid = $3
       AND o.geom IS NOT NULL
       AND COALESCE(o.is_quality_filtered, false) = false
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
       WHERE UPPER(bssid) = $1
         AND lat IS NOT NULL
         AND lon IS NOT NULL
         AND COALESCE(is_quality_filtered, false) = false
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
     )
     SELECT we.bssid, we.lat, we.lon, (EXTRACT(EPOCH FROM we.time) * 1000)::float8 as time,
            we.level, we.ssid, we.frequency, we.channel, we.encryption, we.altitude, we.accuracy,
            we.is_matched,
            CASE
              WHEN NOT EXISTS (SELECT 1 FROM our_obs) THEN NULL
              ELSE ROUND(
                (
                  SELECT MIN(ST_Distance(we.geog, o.geog))
                  FROM our_obs o
                )::numeric,
                2
              )
            END as distance_from_our_center_m
     FROM wigle_enriched we
     ORDER BY we.time DESC`,
    [bssid]
  );
  return result.rows;
}

export async function getOurObservationCount(bssid: string): Promise<number> {
  const ourCount = await query(
    `SELECT COUNT(*) as count
     FROM app.observations
     WHERE UPPER(bssid) = $1
       AND COALESCE(is_quality_filtered, false) = false`,
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
       WHERE UPPER(bssid) = ANY($1)
         AND lat IS NOT NULL
         AND lon IS NOT NULL
         AND COALESCE(is_quality_filtered, false) = false
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
     )
     SELECT we.bssid, we.lat, we.lon, (EXTRACT(EPOCH FROM we.time) * 1000)::float8 as time,
            we.level, we.ssid, we.frequency, we.channel, we.encryption, we.altitude, we.accuracy,
            we.is_matched,
            CASE
              WHEN NOT EXISTS (
                SELECT 1 FROM our_obs o WHERE UPPER(o.bssid) = UPPER(we.bssid)
              ) THEN NULL
              ELSE ROUND(
                (
                  SELECT MIN(ST_Distance(we.geog, o.geog))
                  FROM our_obs o
                  WHERE UPPER(o.bssid) = UPPER(we.bssid)
                )::numeric,
                2
              )
            END as distance_from_our_center_m
     FROM wigle_enriched we
     ORDER BY we.bssid, we.time DESC`,
    [bssids]
  );
  return result.rows;
}

/**
 * Correlates a target image's GPS EXIF metadata with BLE observations in the database
 */
export async function correlateImageBLE(
  imagePath: string,
  options: {
    maxDistanceMeters?: number;
    timeWindowDaysBefore?: number;
    timeWindowDaysAfter?: number;
  } = {}
): Promise<{
  image: string;
  lat: number;
  lon: number;
  timestamp: string;
  matches: Array<{
    bssid: string;
    signal: number;
    dist_meters: number;
    delta_minutes: number;
  }>;
}> {
  const { maxDistanceMeters = 150, timeWindowDaysBefore = 30, timeWindowDaysAfter = 1 } = options;

  // Extract EXIF telemetry from physical file using imported function
  const { lat, lon, timestamp } = await extractExif(imagePath);

  // Query database using custom spatial-temporal parameters
  const { rows } = await query(
    `SELECT 
        bssid, 
        level AS signal,
        ROUND(ST_Distance(ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, ST_MakePoint($1, $2)::geography)::numeric, 2) AS dist_meters,
        ROUND(ABS(EXTRACT(EPOCH FROM (observed_at - $3::timestamp))) / 60, 1) AS delta_minutes
     FROM app.observations
     WHERE 
        radio_type = 'E'
        AND ST_DWithin(ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, ST_MakePoint($1, $2)::geography, $4)
        AND observed_at BETWEEN ($3::timestamp - $5 * INTERVAL '1 day') AND ($3::timestamp + $6 * INTERVAL '1 day')
     ORDER BY dist_meters ASC
     LIMIT 5`,
    [lon, lat, timestamp, maxDistanceMeters, timeWindowDaysBefore, timeWindowDaysAfter]
  );

  return {
    image: imagePath,
    lat,
    lon,
    timestamp,
    matches: rows.map((r: any) => ({
      bssid: r.bssid,
      signal: parseInt(r.signal) || 0,
      dist_meters: parseFloat(r.dist_meters),
      delta_minutes: parseFloat(r.delta_minutes),
    })),
  };
}

export { ExifMissingError, ExifToolUnavailableError, correlateVisINT, saveVisINTAttachment };

module.exports = {
  getHomeLocationForObservations,
  getObservationsByBSSID,
  checkWigleTableExists,
  getWigleObservationsByBSSID,
  getOurObservationCount,
  getWigleObservationsBatch,
  correlateImageBLE,
  correlateVisINT,
  saveVisINTAttachment,
  ExifMissingError,
  ExifToolUnavailableError,
};
