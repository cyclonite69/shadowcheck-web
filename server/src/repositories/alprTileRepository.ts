const { query } = require('../config/database');

/**
 * Fetches a Mapbox Vector Tile for an ALPR camera XYZ tile coordinate.
 */
export async function getAlprCameraTile(z: number, x: number, y: number): Promise<Buffer | null> {
  const result = await query('SELECT app.fn_get_alpr_camera_tile($1, $2, $3) AS tile', [z, x, y]);
  const tile = result.rows[0]?.tile as Buffer | null | undefined;
  return tile && tile.length > 0 ? tile : null;
}
