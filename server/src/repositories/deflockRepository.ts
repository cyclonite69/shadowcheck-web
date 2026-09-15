const { query } = require('../config/database');

/**
 * Fetches all DeFlock camera locations as a GeoJSON FeatureCollection.
 */
export async function fetchDeflockCamerasGeoJSON(): Promise<any> {
  const sql = `
    SELECT
      jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', id,
            'geometry', ST_AsGeoJSON(geom)::jsonb,
            'properties', jsonb_build_object(
              'id', id,
              'city', city,
              'state', state,
              'source', source,
              'source_id', source_id,
              'camera_type', camera_type,
              'agency', agency,
              'operator', operator,
              'name', name,
              'address', address,
              'street', street,
              'housenumber', housenumber,
              'postcode', postcode,
              'country', country,
              'manufacturer', manufacturer,
              'manufacturer_wikidata', manufacturer_wikidata,
              'direction', direction,
              'camera_mount', camera_mount,
              'surveillance', surveillance,
              'surveillance_type', surveillance_type,
              'surveillance_zone', surveillance_zone,
              'electricity', electricity,
              'website', website
            )
          )
        ), '[]'::jsonb)
      ) as geojson
    FROM app.deflock_cameras
    WHERE geom IS NOT NULL;
  `;

  const result = await query(sql);
  return (
    result.rows[0]?.geojson || {
      type: 'FeatureCollection',
      features: [],
    }
  );
}
