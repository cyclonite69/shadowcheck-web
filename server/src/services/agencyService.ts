/**
 * Agency Service Layer
 * Encapsulates database queries for agency office operations
 */

const { query } = require('../config/database');
const pool = require('../config/database');

export async function getAgencyOfficesGeoJSON(): Promise<any> {
  const sql = `
    SELECT 
      jsonb_build_object(
        'type', 'FeatureCollection',
        'features', jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', id,
            'geometry', ST_AsGeoJSON(location)::jsonb,
            'properties', jsonb_build_object(
              'id', id,
              'name', name,
              'office_type', office_type,
              'address_line1', address_line1,
              'address_line2', address_line2,
              'city', city,
              'state', state,
              'postal_code', postal_code,
              'phone', phone,
              'website', website,
              'parent_office', parent_office
            )
          )
        )
      ) as geojson
    FROM app.agency_offices
    WHERE location IS NOT NULL;
  `;

  const result = await pool.query(sql);
  return (
    result.rows[0]?.geojson || {
      type: 'FeatureCollection',
      features: [],
    }
  );
}

export async function getAgencyOfficeCountByType(): Promise<any[]> {
  const sql = `
    SELECT 
      office_type,
      COUNT(*) as count
    FROM app.agency_offices
    GROUP BY office_type
    ORDER BY office_type;
  `;

  const result = await pool.query(sql);
  return result.rows;
}

export async function getNearestAgenciesToNetwork(bssid: string, radius: number): Promise<any[]> {
  const sql = `
    WITH all_observations AS (
      -- Local observations (exclude default (0,0) coordinates)
      SELECT DISTINCT lat, lon, 'local' as source
      FROM app.observations
      WHERE UPPER(bssid) = UPPER($1)
        AND lat IS NOT NULL AND lon IS NOT NULL
        AND NOT (lat = 0 AND lon = 0)
      UNION
      -- WiGLE v3 observations (exclude default (0,0) coordinates)
      SELECT DISTINCT latitude as lat, longitude as lon, 'wigle' as source
      FROM app.wigle_v3_observations
      WHERE UPPER(netid) = UPPER($1)
        AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND NOT (latitude = 0 AND longitude = 0)
    ),
    agency_distances AS (
      SELECT
        a.id,
        a.name,
        a.office_type,
        a.city,
        a.state,
        a.postal_code,
        ST_Y(a.location::geometry) as latitude,
        ST_X(a.location::geometry) as longitude,
        MIN(ST_Distance(
          ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
          a.location::geography
        )) as distance_meters,
        BOOL_OR(o.source = 'wigle') as has_wigle_obs
      FROM all_observations o
      CROSS JOIN app.agency_offices a
      GROUP BY a.id, a.name, a.office_type, a.city, a.state, a.postal_code, a.location
    )
    SELECT * FROM agency_distances
    WHERE distance_meters <= ($2 * 1000)
    ORDER BY distance_meters ASC
  `;

  const result = await query(sql, [bssid, radius]);
  return result.rows;
}

export async function getNearestAgenciesToNetworksBatch(
  bssids: string[],
  radius: number
): Promise<any[]> {
  const sql = `
    WITH all_observations AS (
      -- Local observations (exclude default (0,0) coordinates)
      SELECT DISTINCT lat, lon, 'local' as source
      FROM app.observations
      WHERE UPPER(bssid) = ANY($1)
        AND lat IS NOT NULL AND lon IS NOT NULL
        AND NOT (lat = 0 AND lon = 0)
      UNION
      -- WiGLE v3 observations (exclude default (0,0) coordinates)
      SELECT DISTINCT latitude as lat, longitude as lon, 'wigle' as source
      FROM app.wigle_v3_observations
      WHERE UPPER(netid) = ANY($1)
        AND latitude IS NOT NULL AND longitude IS NOT NULL
        AND NOT (latitude = 0 AND longitude = 0)
    ),
    agency_distances AS (
      SELECT
        a.id,
        a.name,
        a.office_type,
        a.city,
        a.state,
        a.postal_code,
        ST_Y(a.location::geometry) as latitude,
        ST_X(a.location::geometry) as longitude,
        MIN(ST_Distance(
          ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
          a.location::geography
        )) as distance_meters,
        BOOL_OR(o.source = 'wigle') as has_wigle_obs
      FROM all_observations o
      CROSS JOIN app.agency_offices a
      GROUP BY a.id, a.name, a.office_type, a.city, a.state, a.postal_code, a.location
    )
    SELECT * FROM agency_distances
    WHERE distance_meters <= ($2 * 1000)
    ORDER BY distance_meters ASC
  `;

  const result = await query(sql, [bssids, radius]);
  return result.rows;
}

module.exports = {
  getAgencyOfficesGeoJSON,
  getAgencyOfficeCountByType,
  getNearestAgenciesToNetwork,
  getNearestAgenciesToNetworksBatch,
};
