import request from 'supertest';
import express from 'express';

const mockGetAlprCameraTile = jest.fn();
const mockGetObservationTile = jest.fn();

jest.mock('../../../../../server/src/repositories/alprTileRepository', () => ({
  getAlprCameraTile: mockGetAlprCameraTile,
}));
jest.mock('../../../../../server/src/repositories/observationTileRepository', () => ({
  getObservationTile: mockGetObservationTile,
}));

import tileRoutes from '../../../../../server/src/api/routes/v1/wigle/tiles';

const app = express();
app.use('/', tileRoutes);

describe('WiGLE MVT tile routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns observation tile bytes with the Mapbox vector-tile content type', async () => {
    const tile = Buffer.from([0x1a, 0x03, 0x0a, 0x01, 0x78]);
    mockGetObservationTile.mockResolvedValue(tile);

    const response = await request(app)
      .get('/tiles/observations/13/1234/2710.pbf')
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
    expect(mockGetObservationTile).toHaveBeenCalledWith(13, 1234, 2710);
  });

  it('returns 204 when the observation tile has no features', async () => {
    mockGetObservationTile.mockResolvedValue(null);

    const response = await request(app).get('/tiles/observations/0/0/0.pbf');

    expect(response.status).toBe(204);
    expect(mockGetObservationTile).toHaveBeenCalledWith(0, 0, 0);
  });

  it.each([
    ['/tiles/observations/23/0/0.pbf', 'zoom above supported maximum'],
    ['/tiles/observations/1/2/0.pbf', 'x outside zoom range'],
    ['/tiles/observations/1/0/2.pbf', 'y outside zoom range'],
    ['/tiles/observations/1.5/0/0.pbf', 'non-integer zoom'],
    ['/tiles/observations/1/abc/0.pbf', 'non-integer x'],
  ])('rejects observation tile %s (%s)', async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid tile coordinates' });
    expect(mockGetObservationTile).not.toHaveBeenCalled();
  });

  it('returns the tile bytes with the Mapbox vector-tile content type', async () => {
    const tile = Buffer.from([0x1a, 0x03, 0x0a, 0x01, 0x78]);
    mockGetAlprCameraTile.mockResolvedValue(tile);

    const response = await request(app)
      .get('/tiles/alpr/2/1/3.pbf')
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
    expect(mockGetAlprCameraTile).toHaveBeenCalledWith(2, 1, 3);
  });

  it('returns 204 when the tile has no features', async () => {
    mockGetAlprCameraTile.mockResolvedValue(null);

    const response = await request(app).get('/tiles/alpr/0/0/0.pbf');

    expect(response.status).toBe(204);
    expect(mockGetAlprCameraTile).toHaveBeenCalledWith(0, 0, 0);
  });

  it.each([
    ['/tiles/alpr/23/0/0.pbf', 'zoom above supported maximum'],
    ['/tiles/alpr/1/2/0.pbf', 'x outside zoom range'],
    ['/tiles/alpr/1/0/2.pbf', 'y outside zoom range'],
    ['/tiles/alpr/1.5/0/0.pbf', 'non-integer zoom'],
    ['/tiles/alpr/1/abc/0.pbf', 'non-integer x'],
  ])('rejects %s (%s)', async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid tile coordinates' });
    expect(mockGetAlprCameraTile).not.toHaveBeenCalled();
  });
});
