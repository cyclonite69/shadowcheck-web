const { query } = require('../config/database');

export type AlprBbox = [west: number, south: number, east: number, north: number];

/**
 * Fetches all ALPR camera locations from app.alpr_cameras as a GeoJSON FeatureCollection.
 * Maps top OSM tags from source_properties JSONB into clean feature properties.
 *
 * @param bbox - Optional west/south/east/north bounds to limit the result set.
 * @returns {Promise<any>} GeoJSON FeatureCollection containing ALPR camera features
 */
export async function fetchAlprCamerasGeoJSON(bbox?: AlprBbox): Promise<any> {
  const bboxFilter = bbox ? 'AND geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)' : '';
  const sql = `
    SELECT
      jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', osm_id,
            'geometry', ST_AsGeoJSON(geom)::jsonb,
            'properties', jsonb_build_object(
              'id', osm_id::text,
              'osm_id', osm_id::text,
              'manufacturer', source_properties->>'manufacturer',
              'direction', COALESCE(source_properties->>'direction', source_properties->>'camera:direction'),
              'camera_type', source_properties->>'camera:type',
              'surveillance_zone', source_properties->>'surveillance:zone',
              'camera_mount', source_properties->>'camera:mount',
              'operator', COALESCE(source_properties->>'operator', source_properties->>'operator:short'),
              'electricity', source_properties->>'electricity'
            )
          )
        ), '[]'::jsonb)
      ) as geojson
    FROM app.alpr_cameras
    WHERE geom IS NOT NULL
    ${bboxFilter};
  `;

  const result = bbox ? await query(sql, bbox) : await query(sql);
  return (
    result.rows[0]?.geojson || {
      type: 'FeatureCollection',
      features: [],
    }
  );
}
