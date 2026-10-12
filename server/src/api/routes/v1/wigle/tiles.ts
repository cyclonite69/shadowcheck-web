import type { Request, Response } from 'express';
import express from 'express';
const router = express.Router();
const { getAlprCameraTile } = require('../../../../repositories/alprTileRepository');
const { getObservationTile } = require('../../../../repositories/observationTileRepository');
const { asyncHandler } = require('../../../../utils/asyncHandler');

const MAX_TILE_ZOOM = 22;

function parseTileCoordinate(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null;
  }
  const coordinate = Number(value);
  return Number.isSafeInteger(coordinate) ? coordinate : null;
}

/**
 * GET /api/wigle/tiles/alpr/:z/:x/:y.pbf
 * Returns an ALPR camera Mapbox Vector Tile for a validated XYZ coordinate.
 */
router.get(
  '/tiles/alpr/:z/:x/:y.pbf',
  asyncHandler(async (req: Request, res: Response) => {
    const z = parseTileCoordinate(req.params.z);
    const x = parseTileCoordinate(req.params.x);
    const y = parseTileCoordinate(req.params.y);

    if (z === null || x === null || y === null || z > MAX_TILE_ZOOM || x >= 2 ** z || y >= 2 ** z) {
      res.status(400).json({ error: 'Invalid tile coordinates' });
      return;
    }

    const tile: Buffer | null = await getAlprCameraTile(z, x, y);
    if (!tile?.length) {
      res.status(204).end();
      return;
    }

    res.type('application/vnd.mapbox-vector-tile').send(tile);
  })
);

/**
 * GET /api/wigle/tiles/observations/:z/:x/:y.pbf
 * Returns a field-observation Mapbox Vector Tile for a validated XYZ coordinate.
 */
router.get(
  '/tiles/observations/:z/:x/:y.pbf',
  asyncHandler(async (req: Request, res: Response) => {
    const z = parseTileCoordinate(req.params.z);
    const x = parseTileCoordinate(req.params.x);
    const y = parseTileCoordinate(req.params.y);

    if (z === null || x === null || y === null || z > MAX_TILE_ZOOM || x >= 2 ** z || y >= 2 ** z) {
      res.status(400).json({ error: 'Invalid tile coordinates' });
      return;
    }

    const tile: Buffer | null = await getObservationTile(z, x, y);
    if (!tile?.length) {
      res.status(204).end();
      return;
    }

    res.type('application/vnd.mapbox-vector-tile').send(tile);
  })
);

export default router;
