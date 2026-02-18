/**
 * Home Location Service Layer
 * Encapsulates database queries for home location operations
 */

const { query } = require('../config/database');
const { adminQuery } = require('./adminDbService');

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
}

export async function deleteHomeLocation(): Promise<void> {
  await adminQuery("DELETE FROM app.location_markers WHERE marker_type = 'home'");
}

module.exports = {
  getCurrentHomeLocation,
  setHomeLocation,
  deleteHomeLocation,
};
