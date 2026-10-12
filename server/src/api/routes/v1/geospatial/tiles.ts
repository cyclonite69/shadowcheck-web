import type { Request, Response } from 'express';
import express from 'express';
import {
  GEOSPATIAL_TILE_FUNCTIONS,
  getGeospatialTile,
  type GeospatialTileLayer,
} from '../../../../repositories/geospatialTileRepository';
const { asyncHandler } = require('../../../../utils/asyncHandler');

const router = express.Router();
const MAX_TILE_ZOOM = 22;

function parseTileCoordinate(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null;
  }
  const coordinate = Number(value);
  return Number.isSafeInteger(coordinate) ? coordinate : null;
}

function isGeospatialTileLayer(value: string): value is GeospatialTileLayer {
  return Object.prototype.hasOwnProperty.call(GEOSPATIAL_TILE_FUNCTIONS, value);
}

/**
 * GET /api/geospatial/tiles/:layer/:z/:x/:y.pbf
 * Returns an authenticated, viewport-scoped Mapbox Vector Tile.
 */
router.get(
  '/:layer/:z/:x/:y.pbf',
  asyncHandler(async (req: Request, res: Response) => {
    const layer = req.params.layer;
    const z = parseTileCoordinate(req.params.z);
    const x = parseTileCoordinate(req.params.x);
    const y = parseTileCoordinate(req.params.y);

    if (
      typeof layer !== 'string' ||
      !isGeospatialTileLayer(layer) ||
      z === null ||
      x === null ||
      y === null ||
      z > MAX_TILE_ZOOM ||
      x >= 2 ** z ||
      y >= 2 ** z
    ) {
      res.status(400).json({ error: 'Invalid tile layer or coordinates' });
      return;
    }

    const tile = await getGeospatialTile(layer, z, x, y);
    if (!tile?.length) {
      res.status(204).end();
      return;
    }

    res.type('application/vnd.mapbox-vector-tile').send(tile);
  })
);

export default router;
