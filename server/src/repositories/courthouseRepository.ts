const { query } = require('../config/database');

export async function fetchFederalCourthousesGeoJSON(): Promise<any> {
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
              'short_name', short_name,
              'courthouse_type', courthouse_type,
              'district', district,
              'circuit', circuit,
              'city', city,
              'state', state,
              'active', active
            )
          )
        )
      ) as geojson
    FROM app.federal_courthouses
    WHERE active = TRUE
      AND location IS NOT NULL;
  `;

  const result = await query(sql);
  return (
    result.rows[0]?.geojson || {
      type: 'FeatureCollection',
      features: [],
    }
  );
}
