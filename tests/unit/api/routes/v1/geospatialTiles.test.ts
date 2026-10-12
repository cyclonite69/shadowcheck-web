import request from 'supertest';
import express from 'express';

const mockGetGeospatialTile = jest.fn();

jest.mock('../../../../../server/src/repositories/geospatialTileRepository', () => ({
  GEOSPATIAL_TILE_FUNCTIONS: {
    observations: 'app.fn_get_observation_tile',
    alpr: 'app.fn_get_alpr_camera_tile',
    kml: 'app.fn_get_kml_tile',
    'wigle-v2': 'app.fn_get_wigle_v2_tile',
    'wigle-v3': 'app.fn_get_wigle_v3_tile',
    deflock: 'app.fn_get_deflock_camera_tile',
    agencies: 'app.fn_get_agency_offices_tile',
    courthouses: 'app.fn_get_courthouses_tile',
    shotspotter: 'app.fn_get_shotspotter_tile',
  },
  getGeospatialTile: mockGetGeospatialTile,
}));

import tileRoutes from '../../../../../server/src/api/routes/v1/geospatial/tiles';

const app = express();
app.use('/', tileRoutes);

describe('Geospatial menu MVT tile route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    'observations',
    'alpr',
    'kml',
    'wigle-v2',
    'wigle-v3',
    'deflock',
    'agencies',
    'courthouses',
    'shotspotter',
  ])('returns the vector tile for supported layer %s', async (layer) => {
    const tile = Buffer.from([0x1a, 0x03, 0x0a, 0x01, 0x78]);
    mockGetGeospatialTile.mockResolvedValue(tile);

    const response = await request(app)
      .get(`/${layer}/13/1234/2710.pbf`)
      .buffer(true)
      .parse((stream, callback) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        stream.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(
      /^application\/vnd\.mapbox-vector-tile(?:;|$)/
    );
    expect(response.body).toEqual(tile);
    expect(mockGetGeospatialTile).toHaveBeenCalledWith(layer, 13, 1234, 2710);
  });

  it('returns 204 when the repository returns an empty tile', async () => {
    mockGetGeospatialTile.mockResolvedValue(null);

    const response = await request(app).get('/kml/0/0/0.pbf');

    expect(response.status).toBe(204);
    expect(mockGetGeospatialTile).toHaveBeenCalledWith('kml', 0, 0, 0);
  });

  it.each([
    ['/unknown/0/0/0.pbf', 'unsupported layer'],
    ['/observations/23/0/0.pbf', 'zoom above maximum'],
    ['/observations/1/2/0.pbf', 'x outside zoom range'],
    ['/observations/1/0/2.pbf', 'y outside zoom range'],
    ['/observations/1.5/0/0.pbf', 'non-integer zoom'],
    ['/observations/1/abc/0.pbf', 'non-integer x'],
    ['/observations/1/0/-1.pbf', 'negative y'],
  ])('rejects %s (%s)', async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid tile layer or coordinates' });
    expect(mockGetGeospatialTile).not.toHaveBeenCalled();
  });
});
