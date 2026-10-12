import type { QueryResult } from 'pg';
const { query } = require('../config/database');

export const GEOSPATIAL_TILE_FUNCTIONS = {
  observations: 'app.fn_get_observation_tile',
  alpr: 'app.fn_get_alpr_camera_tile',
  kml: 'app.fn_get_kml_tile',
  'wigle-v2': 'app.fn_get_wigle_v2_tile',
  'wigle-v3': 'app.fn_get_wigle_v3_tile',
  deflock: 'app.fn_get_deflock_camera_tile',
  agencies: 'app.fn_get_agency_offices_tile',
  courthouses: 'app.fn_get_courthouses_tile',
  shotspotter: 'app.fn_get_shotspotter_tile',
} as const;

export type GeospatialTileLayer = keyof typeof GEOSPATIAL_TILE_FUNCTIONS;

/**
 * Fetch one MVT for a whitelisted persistent Geospatial Explorer layer.
 */
export async function getGeospatialTile(
  layer: GeospatialTileLayer,
  z: number,
  x: number,
  y: number
): Promise<Buffer | null> {
  const functionName = GEOSPATIAL_TILE_FUNCTIONS[layer];
  const result: QueryResult<{ tile: Buffer | null }> = await query(
    `SELECT ${functionName}($1, $2, $3) AS tile`,
    [z, x, y]
  );
  const tile = result.rows[0]?.tile;
  return tile?.length ? tile : null;
}
