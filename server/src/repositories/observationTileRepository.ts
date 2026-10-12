const { query } = require('../config/database');

/**
 * Fetches a Mapbox Vector Tile for a validated observation XYZ tile coordinate.
 */
export async function getObservationTile(z: number, x: number, y: number): Promise<Buffer | null> {
  const result = await query('SELECT app.fn_get_observation_tile($1, $2, $3) AS tile', [z, x, y]);
  const tile = result.rows[0]?.tile as Buffer | null | undefined;
  return tile && tile.length > 0 ? tile : null;
}
