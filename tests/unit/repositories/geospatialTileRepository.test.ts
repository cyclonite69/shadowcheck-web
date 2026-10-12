export {};

import type { GeospatialTileLayer } from '../../../server/src/repositories/geospatialTileRepository';

const mockQuery = jest.fn();
const tileFunctionCases: Array<[GeospatialTileLayer, string]> = [
  ['observations', 'app.fn_get_observation_tile'],
  ['alpr', 'app.fn_get_alpr_camera_tile'],
  ['kml', 'app.fn_get_kml_tile'],
  ['wigle-v2', 'app.fn_get_wigle_v2_tile'],
  ['wigle-v3', 'app.fn_get_wigle_v3_tile'],
  ['deflock', 'app.fn_get_deflock_camera_tile'],
  ['agencies', 'app.fn_get_agency_offices_tile'],
  ['courthouses', 'app.fn_get_courthouses_tile'],
  ['shotspotter', 'app.fn_get_shotspotter_tile'],
];

jest.mock('../../../server/src/config/database', () => ({
  query: mockQuery,
}));

describe('geospatialTileRepository', () => {
  let getGeospatialTile: (
    layer: GeospatialTileLayer,
    z: number,
    x: number,
    y: number
  ) => Promise<Buffer | null>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.mock('../../../server/src/config/database', () => ({ query: mockQuery }));
    ({ getGeospatialTile } = require('../../../server/src/repositories/geospatialTileRepository'));
  });

  it.each(tileFunctionCases)(
    'calls the whitelisted %s function with parameterized coordinates',
    async (layer, fn) => {
      const tile = Buffer.from([0x1a, 0x00]);
      mockQuery.mockResolvedValue({ rows: [{ tile }] });

      await expect(getGeospatialTile(layer, 13, 1234, 2710)).resolves.toBe(tile);
      expect(mockQuery).toHaveBeenCalledWith(`SELECT ${fn}($1, $2, $3) AS tile`, [13, 1234, 2710]);
    }
  );

  it.each([null, Buffer.alloc(0)])('returns null for empty database results', async (tile) => {
    mockQuery.mockResolvedValue({ rows: [{ tile }] });

    await expect(getGeospatialTile('kml', 0, 0, 0)).resolves.toBeNull();
  });
});
