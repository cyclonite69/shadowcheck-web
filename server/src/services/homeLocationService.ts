/**
 * Home Location Service Layer
 * Encapsulates database queries for home location operations
 */

const { query } = require('../config/database');
const { adminQuery } = require('./adminDbService');
const { invalidateLayerCountsCache } = require('./layerCountsService');
const logger = require('../logging/logger');

export async function getCurrentHomeLocation(): Promise<any | null> {
  const result = await query(`
    SELECT
      latitude,
      longitude,
      radius,
      created_at
    FROM app.location_markers
    WHERE marker_type = 'home'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function setHomeLocation(
  latitude: number,
  longitude: number,
  radius: number = 100
): Promise<void> {
  await adminQuery("DELETE FROM app.location_markers WHERE marker_type = 'home'");
  await adminQuery(
    `INSERT INTO app.location_markers (marker_type, latitude, longitude, radius, location, created_at)
     VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($3, $2), 4326), NOW())`,
    ['home', latitude, longitude, radius]
  );
  try {
    await invalidateLayerCountsCache();
  } catch (err) {
    logger.warn('[homeLocationService] Failed to invalidate layer counts cache:', err);
  }
}

export async function deleteHomeLocation(): Promise<void> {
  await adminQuery("DELETE FROM app.location_markers WHERE marker_type = 'home'");
  try {
    await invalidateLayerCountsCache();
  } catch (err) {
    logger.warn('[homeLocationService] Failed to invalidate layer counts cache:', err);
  }
}

/**
 * Returns all location markers ordered by creation date.
 */
export async function getAllLocationMarkers(): Promise<any[]> {
  const result = await query(`
    SELECT
      id,
      marker_type,
      latitude,
      longitude,
      created_at
    FROM app.location_markers
    ORDER BY created_at DESC
  `);
  return result.rows;
}

/**
 * Returns the single home location marker row (with id, marker_type, lat/lon, created_at),
 * or null if no home is set.
 */
export async function getHomeLocationMarker(): Promise<any | null> {
  const result = await query(`
    SELECT
      id,
      marker_type,
      latitude,
      longitude,
      created_at
    FROM app.location_markers
    WHERE marker_type = 'home'
    LIMIT 1
  `);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Replaces the home marker for a given device (DELETE + INSERT).
 * Returns the newly created marker row.
 */
export async function setHomeLocationMarker(opts: {
  lat: number;
  lng: number;
  altGps: number | null;
  altBaro: number | null;
  devId: string;
  devType: string;
}): Promise<any> {
  const { lat, lng, altGps, altBaro, devId, devType } = opts;

  await adminQuery("DELETE FROM app.location_markers WHERE name = 'home' AND device_id = $1", [
    devId,
  ]);

  const result = await adminQuery(
    `INSERT INTO app.location_markers
       (name, marker_type, latitude, longitude, altitude_gps, altitude_baro, device_id, device_type, location)
     VALUES ('home', 'home', $1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($2, $1), 4326))
     RETURNING
       id,
       name as marker_type,
       latitude,
       longitude,
       altitude_gps,
       altitude_baro,
       device_id,
       device_type,
       created_at`,
    [lat, lng, altGps, altBaro, devId, devType]
  );

  return result.rows[0];
}

module.exports = {
  getCurrentHomeLocation,
  setHomeLocation,
  deleteHomeLocation,
  getAllLocationMarkers,
  getHomeLocationMarker,
  setHomeLocationMarker,
};
